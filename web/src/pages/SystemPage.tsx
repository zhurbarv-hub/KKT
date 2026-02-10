import { useEscapeKey } from "../hooks/useEscapeKey";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Download, Server, Cloud, CheckCircle, AlertCircle, 
  Loader2, Terminal, Plus, ExternalLink, WifiOff, RefreshCw, Zap
} from "lucide-react";
import clsx from "clsx";

interface SystemInfo {
  version: string;
  is_master: boolean;
  hostname: string;
  auto_update: boolean;
}

interface VersionInfo {
  current: string;
  latest: string;
  update_available: boolean;
  changelog: string[];
}

interface UpdateStatus {
  status: "idle" | "running" | "success" | "failed";
  message: string;
  progress: number;
}

interface Deployment {
  id: string;
  host: string;
  status: "pending" | "running" | "success" | "failed";
  progress: number;
  message: string;
  started_at: string;
  finished_at?: string;
  logs: string[];
}

interface DeployFormData {
  host: string;
  port: number;
  username: string;
  password?: string;
  domain?: string;
  bot_token: string;
  admin_telegram_id: string;
}

const deployerApi = {
  getInfo: async (): Promise<SystemInfo> => {
    const resp = await fetch("/api/deployer/info");
    if (!resp.ok) throw new Error("Service unavailable");
    return resp.json();
  },
  getVersion: async (): Promise<VersionInfo> => {
    const resp = await fetch("/api/deployer/version");
    if (!resp.ok) throw new Error("Service unavailable");
    return resp.json();
  },
  getUpdateStatus: async (): Promise<UpdateStatus> => {
    const resp = await fetch("/api/deployer/update/status");
    if (!resp.ok) throw new Error("Service unavailable");
    return resp.json();
  },
  startUpdate: async (): Promise<void> => {
    const resp = await fetch("/api/deployer/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!resp.ok) throw new Error("Failed to start update");
  },
  getDeployments: async (): Promise<Deployment[]> => {
    const resp = await fetch("/api/deployer/deployments");
    if (!resp.ok) return [];
    return resp.json();
  },
  startDeployment: async (data: DeployFormData): Promise<{ id: string }> => {
    const resp = await fetch("/api/deployer/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error("Failed to start deployment");
    return resp.json();
  },
  getDeploymentStatus: async (id: string): Promise<Deployment> => {
    const resp = await fetch(`/api/deployer/deploy/${id}`);
    if (!resp.ok) throw new Error("Deployment not found");
    return resp.json();
  },
};

export default function SystemPage() {
  const queryClient = useQueryClient();
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [activeDeployment, setActiveDeployment] = useState<string | null>(null);

  // Close modal on ESC
  useEscapeKey(() => setShowDeployModal(false), showDeployModal);

  // Fetch system info first
  const { data: systemInfo, isLoading: infoLoading, isError: infoError } = useQuery({
    queryKey: ["system-info"],
    queryFn: deployerApi.getInfo,
    retry: false,
    staleTime: 60000,
  });

  const { data: version, isLoading: versionLoading } = useQuery({
    queryKey: ["system-version"],
    queryFn: deployerApi.getVersion,
    refetchInterval: 30000,
    retry: false,
    enabled: !infoError,
  });

  const { data: updateStatus } = useQuery({
    queryKey: ["update-status"],
    queryFn: deployerApi.getUpdateStatus,
    refetchInterval: 3000,
    retry: false,
    enabled: !infoError && systemInfo?.is_master,
  });

  const { data: deployments = [] } = useQuery({
    queryKey: ["deployments"],
    queryFn: deployerApi.getDeployments,
    refetchInterval: 5000,
    retry: false,
    enabled: !infoError && systemInfo?.is_master,
  });

  const updateMutation = useMutation({
    mutationFn: deployerApi.startUpdate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["update-status"] });
    },
  });

  // Show service unavailable
  if (infoError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Управление системой
          </h1>
          <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
            Обновления и развёртывание
          </p>
        </div>
        
        <div className="card">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-yellow-500/20 mb-4">
              <WifiOff size={48} className="text-yellow-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              Сервис управления недоступен
            </h2>
            <p className="max-w-md" style={{ color: "var(--text-secondary)" }}>
              Deployer сервис не запущен. Система работает на базе systemd. 
              Для полного функционала требуется переход на Docker Compose.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (infoLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  const isMaster = systemInfo?.is_master;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Управление системой
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          {isMaster ? "Обновления и развёртывание на новые серверы" : "Информация о системе и обновлениях"}
        </p>
      </div>

      {/* System type badge */}
      <div className="flex items-center gap-2">
        <span className={clsx(
          "px-3 py-1 rounded-full text-sm font-medium",
          isMaster ? "bg-violet-500/20 text-violet-400" : "bg-blue-500/20 text-blue-400"
        )}>
          {isMaster ? "🏠 Мастер-система" : "📡 Клиентская система"}
        </span>
        {systemInfo?.auto_update && (
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400">
            <Zap size={14} className="inline mr-1" />
            Авто-обновления
          </span>
        )}
      </div>

      <div className={clsx("grid gap-6", isMaster ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 max-w-xl")}>
        {/* Version Card */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-violet-500/20">
              <Server size={24} className="text-violet-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {isMaster ? "Локальная система" : "Версия системы"}
              </h2>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {systemInfo?.hostname || "localhost"}
              </p>
            </div>
          </div>

          {versionLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                <span style={{ color: "var(--text-secondary)" }}>Текущая версия</span>
                <span className="font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
                  v{version?.current || "?"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                <span style={{ color: "var(--text-secondary)" }}>Последняя версия</span>
                <span className="font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
                  v{version?.latest || "?"}
                </span>
              </div>

              {version?.update_available && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <div className="flex items-center gap-2 text-yellow-500 mb-2">
                    <AlertCircle size={18} />
                    <span className="font-medium">Доступно обновление!</span>
                  </div>
                  {!isMaster && (
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      Обновление будет установлено автоматически через Watchtower
                    </p>
                  )}
                </div>
              )}

              {!version?.update_available && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <div className="flex items-center gap-2 text-green-500">
                    <CheckCircle size={18} />
                    <span>Установлена последняя версия</span>
                  </div>
                </div>
              )}

              {/* Update controls - only for master */}
              {isMaster && (
                <>
                  {updateStatus?.status === "running" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span style={{ color: "var(--text-secondary)" }}>{updateStatus.message}</span>
                        <span style={{ color: "var(--text-primary)" }}>{updateStatus.progress}%</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-secondary)" }}>
                        <div 
                          className="h-full bg-violet-500 transition-all duration-300"
                          style={{ width: `${updateStatus.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {updateStatus?.status === "success" && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="flex items-center gap-2 text-green-500">
                        <CheckCircle size={18} />
                        <span>{updateStatus.message}</span>
                      </div>
                    </div>
                  )}

                  {updateStatus?.status === "failed" && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                      <div className="flex items-center gap-2 text-red-500">
                        <AlertCircle size={18} />
                        <span>{updateStatus.message}</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => updateMutation.mutate()}
                    disabled={updateStatus?.status === "running" || !version?.update_available}
                    className="btn btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {updateStatus?.status === "running" ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Обновление...
                      </>
                    ) : (
                      <>
                        <Download size={18} />
                        Обновить систему
                      </>
                    )}
                  </button>
                </>
              )}

              {/* Auto-update info for clients */}
              {!isMaster && (
                <div className="p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                  <div className="flex items-center gap-2 mb-2" style={{ color: "var(--text-primary)" }}>
                    <RefreshCw size={18} />
                    <span className="font-medium">Автоматические обновления</span>
                  </div>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Watchtower проверяет обновления каждые 5 минут и автоматически 
                    обновляет систему при появлении новых версий.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Deployments Card - only for master */}
        {isMaster && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Cloud size={24} className="text-blue-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                    Удалённые инстансы
                  </h2>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Развёрнутые системы
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDeployModal(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <Plus size={18} />
                Развернуть
              </button>
            </div>

            <div className="space-y-3">
              {deployments.length === 0 ? (
                <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
                  <Cloud size={48} className="mx-auto mb-2 opacity-50" />
                  <p>Нет развёрнутых инстансов</p>
                  <p className="text-sm mt-1">Нажмите "Развернуть" чтобы установить систему на новый VDS</p>
                </div>
              ) : (
                deployments.map((deployment) => (
                  <div
                    key={deployment.id}
                    className="p-3 rounded-lg cursor-pointer transition-colors hover:opacity-80"
                    style={{ background: "var(--bg-secondary)" }}
                    onClick={() => setActiveDeployment(deployment.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          "w-2 h-2 rounded-full",
                          deployment.status === "success" && "bg-green-500",
                          deployment.status === "running" && "bg-yellow-500 animate-pulse",
                          deployment.status === "failed" && "bg-red-500",
                          deployment.status === "pending" && "bg-gray-500"
                        )} />
                        <div>
                          <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                            {deployment.host}
                          </p>
                          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                            {deployment.message}
                          </p>
                        </div>
                      </div>
                      {deployment.status === "running" && (
                        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                          {deployment.progress}%
                        </span>
                      )}
                      {deployment.status === "success" && (
                        <a
                          href={`http://${deployment.host}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded hover:bg-white/10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {showDeployModal && (
        <DeployModal onClose={() => setShowDeployModal(false)} />
      )}

      {activeDeployment && (
        <DeploymentLogsModal
          deploymentId={activeDeployment}
          onClose={() => setActiveDeployment(null)}
        />
      )}
    </div>
  );
}

function DeployModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<DeployFormData>({
    host: "",
    port: 22,
    username: "root",
    password: "",
    domain: "",
    bot_token: "",
    admin_telegram_id: "",
  });

  const deployMutation = useMutation({
    mutationFn: deployerApi.startDeployment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployments"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    deployMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative rounded-xl shadow-xl max-w-lg w-full" style={{ background: "var(--bg-card)" }}>
          <div className="p-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
            <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Развернуть на новый VDS
            </h3>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Система будет установлена с автоматическими обновлениями
            </p>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  IP адрес сервера *
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="192.168.1.100"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  SSH порт
                </label>
                <input
                  type="number"
                  className="input"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  Пользователь
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  SSH пароль *
                </label>
                <input
                  type="password"
                  required
                  className="input"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  Домен (опционально)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="example.com"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  Telegram Bot Token *
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="123456:ABC-DEF..."
                  value={formData.bot_token}
                  onChange={(e) => setFormData({ ...formData, bot_token: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  Telegram ID администратора *
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="123456789"
                  value={formData.admin_telegram_id}
                  onChange={(e) => setFormData({ ...formData, admin_telegram_id: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Отмена
              </button>
              <button type="submit" disabled={deployMutation.isPending} className="btn btn-primary">
                {deployMutation.isPending ? "Запуск..." : "Развернуть"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function DeploymentLogsModal({ deploymentId, onClose }: { deploymentId: string; onClose: () => void }) {
  const { data: deployment } = useQuery({
    queryKey: ["deployment", deploymentId],
    queryFn: () => deployerApi.getDeploymentStatus(deploymentId),
    refetchInterval: 2000,
    retry: false,
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative rounded-xl shadow-xl max-w-2xl w-full" style={{ background: "var(--bg-card)" }}>
          <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
            <div className="flex items-center gap-3">
              <Terminal size={20} />
              <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {deployment?.host || "..."}
              </h3>
            </div>
            {deployment && (
              <div className={clsx(
                "px-2 py-1 rounded text-sm font-medium",
                deployment.status === "success" && "bg-green-500/20 text-green-500",
                deployment.status === "running" && "bg-yellow-500/20 text-yellow-500",
                deployment.status === "failed" && "bg-red-500/20 text-red-500",
                deployment.status === "pending" && "bg-gray-500/20 text-gray-400"
              )}>
                {deployment.status === "success" && "Готово"}
                {deployment.status === "running" && "Выполняется"}
                {deployment.status === "failed" && "Ошибка"}
                {deployment.status === "pending" && "В очереди"}
              </div>
            )}
          </div>
          <div className="p-4">
            {deployment?.status === "running" && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span style={{ color: "var(--text-secondary)" }}>{deployment.message}</span>
                  <span>{deployment.progress}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-secondary)" }}>
                  <div 
                    className="h-full bg-violet-500 transition-all"
                    style={{ width: `${deployment.progress}%` }}
                  />
                </div>
              </div>
            )}
            <div 
              className="font-mono text-sm p-4 rounded-lg max-h-96 overflow-y-auto"
              style={{ background: "var(--bg-secondary)" }}
            >
              {deployment?.logs?.map((log, i) => (
                <div key={i} className="py-1" style={{ color: "var(--text-primary)" }}>
                  {log}
                </div>
              )) || <p style={{ color: "var(--text-muted)" }}>Ожидание логов...</p>}
            </div>
          </div>
          <div className="flex justify-end p-4" style={{ borderTop: "1px solid var(--border-color)" }}>
            <button onClick={onClose} className="btn btn-secondary">
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
