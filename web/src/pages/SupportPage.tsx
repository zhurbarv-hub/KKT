import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { HelpCircle, MessageSquare, Clock, CheckCircle, AlertCircle, Send, Loader2 } from "lucide-react";
import clsx from "clsx";
import { supportApi } from '../services/api';
import type { SupportRequest } from "../services/api";

const statusConfig = {
  new: { label: "Новое", icon: AlertCircle, color: "text-red-600", bg: "bg-red-100" },
  in_progress: { label: "В работе", icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100" },
  resolved: { label: "Решено", icon: CheckCircle, color: "text-blue-600", bg: "bg-blue-100" },
  closed: { label: "Закрыто", icon: CheckCircle, color: "text-green-600", bg: "bg-green-100" },
};

export default function SupportPage() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [replyText, setReplyText] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "in_progress" | "resolved" | "closed">("all");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["support-requests", filter],
    queryFn: () => supportApi.list(filter === "all" ? undefined : filter),
  });

  const { data: stats } = useQuery({
    queryKey: ["support-stats"],
    queryFn: supportApi.getStats,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status?: string; resolution_notes?: string } }) =>
      supportApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-requests"] });
      queryClient.invalidateQueries({ queryKey: ["support-stats"] });
      setReplyText("");
    },
  });

  const getStatusBadge = (status: SupportRequest["status"]) => {
    const config = statusConfig[status] || statusConfig.new;
    const Icon = config.icon;
    return (
      <span className={clsx("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", config.bg, config.color)}>
        <Icon size={12} />
        {config.label}
      </span>
    );
  };

  const handleStatusChange = (newStatus: string) => {
    if (selectedRequest) {
      updateMutation.mutate({
        id: selectedRequest.id,
        data: { status: newStatus, resolution_notes: replyText || undefined },
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Обращения</h1>
        <p className="text-gray-600 mt-1">Обработка запросов от клиентов</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="card"><div className="flex items-center gap-3"><div className="p-2 bg-red-100 rounded-lg"><AlertCircle className="text-red-600" size={20} /></div><div><p className="text-2xl font-bold text-gray-900">{stats?.new || 0}</p><p className="text-sm text-gray-500">Новых</p></div></div></div>
        <div className="card"><div className="flex items-center gap-3"><div className="p-2 bg-yellow-100 rounded-lg"><Clock className="text-yellow-600" size={20} /></div><div><p className="text-2xl font-bold text-gray-900">{stats?.in_progress || 0}</p><p className="text-sm text-gray-500">В работе</p></div></div></div>
        <div className="card"><div className="flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><CheckCircle className="text-blue-600" size={20} /></div><div><p className="text-2xl font-bold text-gray-900">{stats?.resolved || 0}</p><p className="text-sm text-gray-500">Решено</p></div></div></div>
        <div className="card"><div className="flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="text-green-600" size={20} /></div><div><p className="text-2xl font-bold text-gray-900">{stats?.closed || 0}</p><p className="text-sm text-gray-500">Закрыто</p></div></div></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Список обращений</h2>
            <select className="input w-40" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
              <option value="all">Все</option>
              <option value="new">Новые</option>
              <option value="in_progress">В работе</option>
              <option value="resolved">Решённые</option>
              <option value="closed">Закрытые</option>
            </select>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-violet-600" size={32} /></div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500"><HelpCircle size={32} className="mb-2 text-gray-300" /><p>Обращений не найдено</p></div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {requests.map((request) => (
                <div key={request.id} onClick={() => setSelectedRequest(request)} className={clsx("p-3 border rounded-lg cursor-pointer transition-colors", selectedRequest?.id === request.id ? "border-violet-500 bg-violet-50" : "border-gray-200 hover:border-gray-300")}>
                  <div className="flex items-start justify-between mb-2"><div><p className="font-medium text-gray-900">{request.subject}</p><p className="text-sm text-gray-500">{request.client_company || request.client_name}</p></div>{getStatusBadge(request.status)}</div>
                  <p className="text-sm text-gray-600 line-clamp-2">{request.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          {selectedRequest ? (
            <>
              <div className="mb-4"><div className="flex items-start justify-between mb-2"><h2 className="text-lg font-semibold text-gray-900">{selectedRequest.subject}</h2>{getStatusBadge(selectedRequest.status)}</div><p className="text-sm text-gray-500">От: {selectedRequest.client_company || selectedRequest.client_name} | Тел: {selectedRequest.contact_phone}</p></div>
              <div className="p-4 bg-gray-50 rounded-lg mb-4"><p className="text-gray-700">{selectedRequest.message}</p><p className="text-xs text-gray-400 mt-2">{new Date(selectedRequest.created_at).toLocaleString("ru-RU")}</p></div>
              {selectedRequest.resolution_notes && (<div className="p-4 bg-blue-50 rounded-lg mb-4"><p className="text-sm font-medium text-blue-800 mb-1">Решение:</p><p className="text-blue-700">{selectedRequest.resolution_notes}</p></div>)}
              {selectedRequest.status !== "closed" && (
                <div className="space-y-3">
                  <textarea className="input min-h-[100px]" placeholder="Введите комментарий..." value={replyText} onChange={(e) => setReplyText(e.target.value)} />
                  <div className="flex gap-2">
                    {selectedRequest.status === "new" && (<button onClick={() => handleStatusChange("in_progress")} className="btn btn-secondary flex-1" disabled={updateMutation.isPending}>Взять в работу</button>)}
                    {selectedRequest.status === "in_progress" && (<><button onClick={() => handleStatusChange("resolved")} className="btn btn-primary flex-1" disabled={updateMutation.isPending}><Send size={16} className="mr-2" />Решено</button><button onClick={() => handleStatusChange("closed")} className="btn bg-green-600 text-white hover:bg-green-700" disabled={updateMutation.isPending}>Закрыть</button></>)}
                    {selectedRequest.status === "resolved" && (<button onClick={() => handleStatusChange("closed")} className="btn bg-green-600 text-white hover:bg-green-700 flex-1" disabled={updateMutation.isPending}>Закрыть обращение</button>)}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500"><MessageSquare size={48} className="mb-4 text-gray-300" /><p>Выберите обращение</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
