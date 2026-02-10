import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database, RefreshCw, Download, HardDrive, Clock, CheckCircle,
  Loader2, AlertTriangle, Upload, RotateCcw, X, ShieldAlert, Lock, Eye, EyeOff
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { databaseApi } from "../services/api";

export default function DatabasePage() {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const { data: backupsData, isLoading: backupsLoading } = useQuery({
    queryKey: ["database-backups"],
    queryFn: databaseApi.getBackups,
  });

  const { data: stats } = useQuery({
    queryKey: ["database-stats"],
    queryFn: databaseApi.getStats,
  });

  const createBackupMutation = useMutation({
    mutationFn: () => databaseApi.createBackup("Manual backup from web interface"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["database-backups"] });
      showToast(`Бэкап создан: ${data.filename}`, "success");
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.detail || "Ошибка создания бэкапа", "error");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => databaseApi.uploadBackup(file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["database-backups"] });
      showToast(`Файл загружен: ${data.filename}`, "success");
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.detail || "Ошибка загрузки файла", "error");
    },
  });

  const restoreMutation = useMutation({
    mutationFn: ({ filename, password }: { filename: string; password: string }) =>
      databaseApi.restoreBackup(filename, password),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["database-backups"] });
      queryClient.invalidateQueries({ queryKey: ["database-stats"] });
      setRestoreTarget(null);
      setRestorePassword("");
      if (data.status === "partial") {
        showToast(`Восстановление с ошибками. Страховочный бэкап: ${data.safety_backup}`, "error");
      } else {
        showToast(data.message, "success");
      }
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.detail || "Ошибка восстановления", "error");
    },
  });

  const handleDownload = async (filename: string) => {
    try {
      const url = databaseApi.downloadBackup(filename);
      const token = localStorage.getItem("access_token");
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      showToast("Ошибка скачивания файла", "error");
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith(".sql")) {
      showToast("Допустимы только .sql файлы", "error");
      return;
    }
    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setUploadDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const backups = backupsData?.backups || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>База данных</h1>
        <p style={{ color: "var(--text-muted)" }} className="mt-1">Администрирование и резервное копирование</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: "rgba(139, 92, 246, 0.15)" }}><Database className="text-violet-500" size={20} /></div>
            <div><p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{stats?.total_users || 0}</p><p className="text-sm" style={{ color: "var(--text-muted)" }}>Клиентов</p></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: "rgba(59, 130, 246, 0.15)" }}><HardDrive className="text-blue-500" size={20} /></div>
            <div><p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{stats?.database_size_mb?.toFixed(1) || 0} MB</p><p className="text-sm" style={{ color: "var(--text-muted)" }}>Размер БД</p></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: "rgba(16, 185, 129, 0.15)" }}><CheckCircle className="text-emerald-500" size={20} /></div>
            <div><p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{stats?.total_deadlines || 0}</p><p className="text-sm" style={{ color: "var(--text-muted)" }}>Дедлайнов</p></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: "rgba(245, 158, 11, 0.15)" }}><Clock className="text-amber-500" size={20} /></div>
            <div><p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{backupsData?.total_count || 0}</p><p className="text-sm" style={{ color: "var(--text-muted)" }}>Бэкапов</p></div>
          </div>
        </div>
      </div>

      {/* Backup Management Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Резервные копии</h2>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".sql"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="btn btn-secondary flex items-center gap-2"
            >
              {uploadMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
              Загрузить бэкап
            </button>
            <button
              onClick={() => createBackupMutation.mutate()}
              disabled={createBackupMutation.isPending}
              className="btn btn-primary flex items-center gap-2"
            >
              {createBackupMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              Создать бэкап
            </button>
          </div>
        </div>

        {/* Drag & Drop Zone */}
        <div
          className="mb-4 rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors"
          style={{
            borderColor: uploadDragOver ? "rgb(139, 92, 246)" : "var(--border-color)",
            background: uploadDragOver ? "rgba(139, 92, 246, 0.05)" : "transparent",
            color: "var(--text-muted)",
          }}
          onDragOver={(e) => { e.preventDefault(); setUploadDragOver(true); }}
          onDragLeave={() => setUploadDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload size={20} className="mx-auto mb-1 opacity-50" />
          Перетащите .sql файл сюда для загрузки
        </div>

        {/* Backups Table */}
        {backupsLoading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-violet-600" size={32} /></div>
        ) : backups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48" style={{ color: "var(--text-muted)" }}>
            <AlertTriangle size={32} className="mb-2 opacity-30" /><p>Резервных копий не найдено</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: "var(--text-muted)" }}>Файл</th>
                  <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: "var(--text-muted)" }}>Размер</th>
                  <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: "var(--text-muted)" }}>Дата создания</th>
                  <th className="text-left py-3 px-4 font-medium text-sm" style={{ color: "var(--text-muted)" }}>Создал</th>
                  <th className="text-right py-3 px-4 font-medium text-sm" style={{ color: "var(--text-muted)" }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup: any) => (
                  <tr key={backup.filename} className="transition-colors" style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td className="py-3 px-4">
                      <span className="font-mono text-sm" style={{ color: "var(--text-primary)" }}>{backup.filename}</span>
                      {backup.description && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{backup.description}</p>
                      )}
                    </td>
                    <td className="py-3 px-4" style={{ color: "var(--text-secondary)" }}>{backup.size_mb?.toFixed(2)} MB</td>
                    <td className="py-3 px-4" style={{ color: "var(--text-secondary)" }}>
                      {backup.created_at ? format(new Date(backup.created_at), "dd.MM.yyyy HH:mm", { locale: ru }) : "-"}
                    </td>
                    <td className="py-3 px-4" style={{ color: "var(--text-secondary)" }}>{backup.created_by || "system"}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDownload(backup.filename)}
                          className="p-2 rounded transition-colors hover:text-violet-500"
                          style={{ color: "var(--text-muted)" }}
                          title="Скачать"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => { setRestoreTarget(backup.filename); setRestorePassword(""); setShowPassword(false); }}
                          className="p-2 rounded transition-colors hover:text-amber-500"
                          style={{ color: "var(--text-muted)" }}
                          title="Восстановить из этого бэкапа"
                        >
                          <RotateCcw size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
          Всего: {backupsData?.total_size_mb?.toFixed(2) || 0} MB
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60" onClick={() => { setRestoreTarget(null); setRestorePassword(""); }} />
            <div className="relative rounded-xl shadow-2xl max-w-md w-full" style={{ background: "var(--bg-primary)" }}>
              {/* Header */}
              <div className="flex items-center gap-3 p-5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-t-xl">
                <div className="p-2 bg-white/20 rounded-full">
                  <ShieldAlert className="text-white" size={24} />
                </div>
                <div className="text-white">
                  <h3 className="text-lg font-semibold">Восстановление базы данных</h3>
                  <p className="text-sm text-amber-100">Требуется подтверждение</p>
                </div>
                <button
                  onClick={() => { setRestoreTarget(null); setRestorePassword(""); }}
                  className="ml-auto p-1 hover:bg-white/20 rounded text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-5">
                {/* Warning */}
                <div className="p-3 rounded-lg mb-4" style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                  <div className="flex gap-2">
                    <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-red-500 mb-1">Внимание! Это опасная операция.</p>
                      <p style={{ color: "var(--text-secondary)" }}>
                        Текущая база данных будет <strong>полностью заменена</strong> данными из бэкапа.
                        Перед восстановлением будет автоматически создан страховочный бэкап.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Backup info */}
                <div className="p-3 rounded-lg mb-4" style={{ background: "var(--bg-secondary)" }}>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Восстановить из:</p>
                  <p className="font-mono text-sm font-semibold mt-1" style={{ color: "var(--text-primary)" }}>{restoreTarget}</p>
                </div>

                {/* Password input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (restoreTarget && restorePassword) {
                      restoreMutation.mutate({ filename: restoreTarget, password: restorePassword });
                    }
                  }}
                >
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                    <Lock size={14} className="inline mr-1" />
                    Введите пароль администратора для подтверждения
                  </label>
                  <div className="relative mb-4">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      className="input w-full pr-10"
                      placeholder="Ваш пароль"
                      value={restorePassword}
                      onChange={(e) => setRestorePassword(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded"
                      style={{ color: "var(--text-muted)" }}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => { setRestoreTarget(null); setRestorePassword(""); }}
                      className="btn btn-secondary"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={restoreMutation.isPending || !restorePassword}
                      className="btn flex items-center gap-2 text-white"
                      style={{ background: restorePassword ? "rgb(239, 68, 68)" : "rgb(156, 163, 175)" }}
                    >
                      {restoreMutation.isPending ? (
                        <><Loader2 className="animate-spin" size={16} />Восстановление...</>
                      ) : (
                        <><RotateCcw size={16} />Восстановить</>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-white text-sm font-medium"
          style={{
            background: toast.type === "success"
              ? "linear-gradient(135deg, #10b981, #059669)"
              : "linear-gradient(135deg, #ef4444, #dc2626)",
            animation: "slideIn 0.3s ease-out",
            maxWidth: 420,
          }}
        >
          {toast.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 p-0.5 hover:bg-white/20 rounded"><X size={14} /></button>
        </div>
      )}
      <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
}
