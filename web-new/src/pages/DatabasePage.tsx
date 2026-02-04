import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, RefreshCw, Download, HardDrive, Clock, CheckCircle, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { databaseApi } from "../services/api";

export default function DatabasePage() {
  const queryClient = useQueryClient();
  const [backupSuccess, setBackupSuccess] = useState(false);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["database-backups"] });
      setBackupSuccess(true);
      setTimeout(() => setBackupSuccess(false), 3000);
    },
  });

  const backups = backupsData?.backups || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">База данных</h1>
        <p className="text-gray-600 mt-1">Администрирование и резервное копирование</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg"><Database className="text-violet-600" size={20} /></div>
            <div><p className="text-2xl font-bold text-gray-900">{stats?.total_users || 0}</p><p className="text-sm text-gray-500">Пользователей</p></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><HardDrive className="text-blue-600" size={20} /></div>
            <div><p className="text-2xl font-bold text-gray-900">{stats?.database_size_mb?.toFixed(1) || 0} MB</p><p className="text-sm text-gray-500">Размер БД</p></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="text-green-600" size={20} /></div>
            <div><p className="text-2xl font-bold text-gray-900">{stats?.total_deadlines || 0}</p><p className="text-sm text-gray-500">Дедлайнов</p></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg"><Clock className="text-yellow-600" size={20} /></div>
            <div><p className="text-2xl font-bold text-gray-900">{backupsData?.total_count || 0}</p><p className="text-sm text-gray-500">Бэкапов</p></div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Резервные копии</h2>
          <button onClick={() => createBackupMutation.mutate()} disabled={createBackupMutation.isPending} className="btn btn-primary flex items-center gap-2">
            {createBackupMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Создать бэкап
          </button>
        </div>

        {backupSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
            <CheckCircle size={16} /><span>Резервная копия успешно создана!</span>
          </div>
        )}

        {backupsLoading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-violet-600" size={32} /></div>
        ) : backups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <AlertTriangle size={32} className="mb-2 text-gray-300" /><p>Резервных копий не найдено</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Файл</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Размер</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Дата создания</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Создал</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Действия</th>
              </tr></thead>
              <tbody>
                {backups.map((backup: any) => (
                  <tr key={backup.filename} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4"><span className="font-mono text-sm">{backup.filename}</span></td>
                    <td className="py-3 px-4 text-gray-600">{backup.size_mb?.toFixed(2)} MB</td>
                    <td className="py-3 px-4 text-gray-600">{backup.created_at ? format(new Date(backup.created_at), "dd.MM.yyyy HH:mm", { locale: ru }) : "-"}</td>
                    <td className="py-3 px-4 text-gray-600">{backup.created_by || "system"}</td>
                    <td className="py-3 px-4 text-right">
                      <button className="p-2 hover:bg-gray-100 rounded text-gray-600 hover:text-violet-600" title="Скачать"><Download size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">Всего: {backupsData?.total_size_mb?.toFixed(2) || 0} MB</div>
      </div>
    </div>
  );
}
