import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Download, Server, Cloud, CheckCircle, AlertCircle, 
  Loader2, Terminal, Plus, ExternalLink
} from "lucide-react";
import clsx from "clsx";

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

const deployerApi = {
  getVersion: async (): Promise<VersionInfo> => {
    const resp = await fetch("/api/deployer/version");
    return resp.json();
  },
  getUpdateStatus: async (): Promise<UpdateStatus> => {
    const resp = await fetch("/api/deployer/update/status");
    return resp.json();
  },
  startUpdate: async (): Promise<void> => {
    await fetch("/api/deployer/update", { method: "POST" });
  },
  getDeployments: async (): Promise<Deployment[]> => {
    const resp = await fetch("/api/deployer/deployments");
    return resp.json();
  },
  startDeployment: async (data: DeployFormData): Promise<{ id: string }> => {
    const resp = await fetch("/api/deployer/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return resp.json();
  },
  getDeploymentStatus: async (id: string): Promise<Deployment> => {
    const resp = await fetch(`/api/deployer/deploy/${id}`);
    return resp.json();
  },
};

interface DeployFormData {
  host: string;
  port: number;
  username: string;
  password?: string;
  ssh_key?: string;
  domain?: string;
  bot_token: string;
  admin_telegram_id: string;
  ssl_email?: string;
}

export default function SystemPage() {
  const queryClient = useQueryClient();
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [activeDeployment, setActiveDeployment] = useState<string | null>(null);

  const { data: version, isLoading: versionLoading } = useQuery({
    queryKey: ["system-version"],
    queryFn: deployerApi.getVersion,
    refetchInterval: 30000,
  });

  const { data: updateStatus } = useQuery({
    queryKey: ["update-status"],
    queryFn: deployerApi.getUpdateStatus,
    refetchInterval: 2000,
  });

  const { data: deployments = [] } = useQuery({
    queryKey: ["deployments"],
    queryFn: deployerApi.getDeployments,
    refetchInterval: 5000,
  });

  const updateMutation = useMutation({
    mutationFn: deployerApi.startUpdate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["update-status"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Управление системой
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          Обновления и развёртывание на новые серверы
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Local System Card */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-violet-500/20">
              <Server size={24} className="text-violet-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                Локальная система
              </h2>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Текущий сервер
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
                  v{version?.current}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                <span style={{ color: "var(--text-secondary)" }}>Последняя версия</span>
                <span className="font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
                  v{version?.latest}
                </span>
              </div>

              {version?.update_available && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <div className="flex items-center gap-2 text-yellow-500 mb-2">
                    <AlertCircle size={18} />
                    <span className="font-medium">Доступно обновление!</span>
                  </div>
                  {version.changelog.length > 0 && (
                    <ul className="text-sm space-y-1" style={{ color: "var(--text-secondary)" }}>
                      {version.changelog.slice(0, 5).map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

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
            </div>
          )}
        </div>

        {/* Remote Deployments Card */}
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
              </div>
            ) : (
              deployments.map((deployment) => (
                <div
                  key={deployment.id}
                  className="p-3 rounded-lg cursor-pointer transition-colors"
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
      </div>

      {/* Deploy Modal */}
      {showDeployModal && (
        <DeployModal onClose={() => setShowDeployModal(false)} />
      )}

      {/* Deployment Logs Modal */}
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
    ssl_email: "",
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
              Развернуть на новый сервер
            </h3>
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
                Развёртывание: {deployment?.host}
              </h3>
            </div>
            <div className={clsx(
              "px-2 py-1 rounded text-sm font-medium",
              deployment?.status === "success" && "bg-green-500/20 text-green-500",
              deployment?.status === "running" && "bg-yellow-500/20 text-yellow-500",
              deployment?.status === "failed" && "bg-red-500/20 text-red-500"
            )}>
              {deployment?.status}
            </div>
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
              {deployment?.logs.map((log, i) => (
                <div key={i} className="py-1" style={{ color: "var(--text-primary)" }}>
                  {log}
                </div>
              ))}
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
