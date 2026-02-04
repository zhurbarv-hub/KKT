import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deadlinesApi, deadlineTypesApi, usersApi } from "../services/api";
import type { Deadline, DeadlineCreate, DeadlineUpdate, DeadlineType, User, StatusColor, DeadlineStatus } from "../types";
import { 
  Search, Plus, Edit2, Trash2, ChevronLeft, ChevronRight, X, 
  AlertCircle, Clock, Filter, Calendar, RefreshCw
} from "lucide-react";
import clsx from "clsx";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ background: "var(--bg-card)" }}>
          <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
            <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
            <button onClick={onClose} className="p-1 rounded" style={{ color: "var(--text-muted)" }}><X size={20} /></button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

interface DeadlineFormProps {
  deadline?: Deadline | null;
  users: User[];
  deadlineTypes: DeadlineType[];
  onSubmit: (data: DeadlineCreate | DeadlineUpdate) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function DeadlineForm({ deadline, users, deadlineTypes, onSubmit, onCancel, isLoading }: DeadlineFormProps) {
  const [formData, setFormData] = useState({
    user_id: deadline?.user_id || "",
    deadline_type_id: deadline?.deadline_type_id || "",
    expiration_date: deadline?.expiration_date?.split("T")[0] || "",
    notes: deadline?.notes || "",
    status: deadline?.status || "active" as DeadlineStatus,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      user_id: Number(formData.user_id),
      deadline_type_id: Number(formData.deadline_type_id),
      expiration_date: formData.expiration_date,
      notes: formData.notes || undefined,
      ...(deadline && { status: formData.status }),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Клиент *</label>
        <select required className="input" value={formData.user_id} onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}>
          <option value="">Выберите клиента</option>
          {users.filter(u => u.role === "client").map((user) => (
            <option key={user.id} value={user.id}>{user.full_name} {user.company_name ? `(${user.company_name})` : ""}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Тип услуги *</label>
        <select required className="input" value={formData.deadline_type_id} onChange={(e) => setFormData({ ...formData, deadline_type_id: e.target.value })}>
          <option value="">Выберите тип</option>
          {deadlineTypes.filter(t => t.is_active).map((type) => (
            <option key={type.id} value={type.id}>{type.type_name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Дата истечения *</label>
        <input type="date" required className="input" value={formData.expiration_date} onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })} />
      </div>
      {deadline && (
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Статус</label>
          <select className="input" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as DeadlineStatus })}>
            <option value="active">Активен</option>
            <option value="renewed">Продлён</option>
            <option value="expired">Истёк</option>
          </select>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Заметки</label>
        <textarea className="input min-h-[80px]" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
      </div>
      <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
        <button type="button" onClick={onCancel} className="btn btn-secondary">Отмена</button>
        <button type="submit" disabled={isLoading} className="btn btn-primary">{isLoading ? "Сохранение..." : deadline ? "Сохранить" : "Создать"}</button>
      </div>
    </form>
  );
}

function StatusBadge({ color }: { color: StatusColor }) {
  const config = {
    green: { bg: "rgba(34, 197, 94, 0.2)", text: "#22c55e", label: "Норма" },
    yellow: { bg: "rgba(234, 179, 8, 0.2)", text: "#eab308", label: "Внимание" },
    red: { bg: "rgba(239, 68, 68, 0.2)", text: "#ef4444", label: "Срочно" },
    expired: { bg: "rgba(107, 114, 128, 0.2)", text: "#9ca3af", label: "Просрочено" },
    unknown: { bg: "rgba(107, 114, 128, 0.2)", text: "#6b7280", label: "Неизвестно" },
  };
  const c = config[color] || config.unknown;
  return <span className="px-2 py-1 text-xs font-medium rounded-full" style={{ background: c.bg, color: c.text }}>{c.label}</span>;
}

export default function DeadlinesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusColor | "">("");
  const [typeFilter, setTypeFilter] = useState<number | "">("");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editDeadline, setEditDeadline] = useState<Deadline | null>(null);
  const [deleteDeadline, setDeleteDeadline] = useState<Deadline | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const limit = 15;

  const { data: deadlines = [], isLoading, refetch } = useQuery({
    queryKey: ["deadlines"],
    queryFn: () => deadlinesApi.list(),
  });

  const { data: deadlineTypes = [] } = useQuery({
    queryKey: ["deadline-types"],
    queryFn: deadlineTypesApi.list,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });

  const createMutation = useMutation({
    mutationFn: (data: DeadlineCreate) => deadlinesApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["deadlines"] }); setIsCreateOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: DeadlineUpdate }) => deadlinesApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["deadlines"] }); setEditDeadline(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deadlinesApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["deadlines"] }); setDeleteDeadline(null); },
  });

  const filteredDeadlines = useMemo(() => {
    return deadlines.filter((d: Deadline) => {
      if (statusFilter && d.status_color !== statusFilter) return false;
      if (typeFilter && d.deadline_type_id !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return d.client?.company_name?.toLowerCase().includes(s) || d.client?.full_name?.toLowerCase().includes(s) || d.deadline_type?.type_name?.toLowerCase().includes(s);
      }
      return true;
    });
  }, [deadlines, statusFilter, typeFilter, search]);

  const totalPages = Math.ceil(filteredDeadlines.length / limit);
  const paginatedDeadlines = filteredDeadlines.slice((page - 1) * limit, page * limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Дедлайны</h1>
          <p className="mt-1" style={{ color: "var(--text-secondary)" }}>Управление сроками услуг клиентов</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="btn btn-secondary"><RefreshCw size={18} /></button>
          <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary flex items-center gap-2"><Plus size={18} />Добавить</button>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} size={20} />
            <input type="text" placeholder="Поиск..." className="input" style={{ paddingLeft: "3rem" }} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={clsx("btn flex items-center gap-2", showFilters ? "btn-primary" : "btn-secondary")}><Filter size={18} />Фильтры</button>
        </div>
        
        {showFilters && (
          <div className="flex flex-wrap gap-4 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
            <div className="w-48">
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Статус</label>
              <select className="input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as StatusColor | ""); setPage(1); }}>
                <option value="">Все статусы</option>
                <option value="green">Норма</option>
                <option value="yellow">Внимание</option>
                <option value="red">Срочно</option>
                <option value="expired">Просрочено</option>
              </select>
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Тип услуги</label>
              <select className="input" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value ? Number(e.target.value) : ""); setPage(1); }}>
                <option value="">Все типы</option>
                {deadlineTypes.map((type: DeadlineType) => (<option key={type.id} value={type.id}>{type.type_name}</option>))}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => { setStatusFilter(""); setTypeFilter(""); setSearch(""); setPage(1); }} className="btn btn-secondary">Сбросить</button>
            </div>
          </div>
        )}
      </div>

      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>
        ) : paginatedDeadlines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64" style={{ color: "var(--text-muted)" }}><Clock size={48} className="mb-4 opacity-50" /><p>Дедлайны не найдены</p></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ background: "var(--bg-secondary)" }}>
                  <tr>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: "var(--text-secondary)" }}>Клиент</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: "var(--text-secondary)" }}>Тип услуги</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: "var(--text-secondary)" }}>Дата истечения</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: "var(--text-secondary)" }}>Осталось</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: "var(--text-secondary)" }}>Статус</th>
                    <th className="text-right py-3 px-4 font-medium" style={{ color: "var(--text-secondary)" }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDeadlines.map((deadline: Deadline) => (
                    <tr 
                      key={deadline.id} 
                      className="transition-colors"
                      style={{ borderTop: "1px solid var(--border-color)" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td className="py-3 px-4">
                        <p className="font-medium" style={{ color: "var(--text-primary)" }}>{deadline.client?.company_name || deadline.client?.full_name || "Не указан"}</p>
                        {deadline.client?.inn && <p className="text-sm" style={{ color: "var(--text-muted)" }}>{deadline.client?.inn}</p>}
                      </td>
                      <td className="py-3 px-4" style={{ color: "var(--text-secondary)" }}>{deadline.deadline_type?.type_name || "Не указан"}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                          <Calendar size={16} />
                          {format(new Date(deadline.expiration_date), "dd.MM.yyyy", { locale: ru })}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium" style={{ 
                          color: deadline.days_until_expiration !== undefined 
                            ? deadline.days_until_expiration < 0 ? "#9ca3af"
                            : deadline.days_until_expiration <= 7 ? "#ef4444"
                            : deadline.days_until_expiration <= 14 ? "#eab308"
                            : "#22c55e"
                            : "var(--text-muted)"
                        }}>
                          {deadline.days_until_expiration !== undefined ? (deadline.days_until_expiration < 0 ? `${Math.abs(deadline.days_until_expiration)} дн. назад` : `${deadline.days_until_expiration} дн.`) : "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4"><StatusBadge color={deadline.status_color || "unknown"} /></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditDeadline(deadline)} className="p-2 rounded transition-colors" style={{ color: "var(--text-muted)" }}><Edit2 size={16} /></button>
                          <button onClick={() => setDeleteDeadline(deadline)} className="p-2 rounded transition-colors" style={{ color: "var(--text-muted)" }}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Показано {(page - 1) * limit + 1}–{Math.min(page * limit, filteredDeadlines.length)} из {filteredDeadlines.length}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded disabled:opacity-50" style={{ color: "var(--text-muted)" }}><ChevronLeft size={18} /></button>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{page} из {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded disabled:opacity-50" style={{ color: "var(--text-muted)" }}><ChevronRight size={18} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Новый дедлайн">
        <DeadlineForm users={users} deadlineTypes={deadlineTypes} onSubmit={(data) => createMutation.mutate(data as DeadlineCreate)} onCancel={() => setIsCreateOpen(false)} isLoading={createMutation.isPending} />
      </Modal>

      <Modal isOpen={!!editDeadline} onClose={() => setEditDeadline(null)} title="Редактирование дедлайна">
        <DeadlineForm deadline={editDeadline} users={users} deadlineTypes={deadlineTypes} onSubmit={(data) => editDeadline && updateMutation.mutate({ id: editDeadline.id, data: data as DeadlineUpdate })} onCancel={() => setEditDeadline(null)} isLoading={updateMutation.isPending} />
      </Modal>

      {deleteDeadline && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteDeadline(null)} />
            <div className="relative rounded-xl shadow-xl max-w-sm w-full p-6" style={{ background: "var(--bg-card)" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/20 rounded-full"><AlertCircle className="text-red-400" size={24} /></div>
                <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Удалить дедлайн?</h3>
              </div>
              <p className="mb-6" style={{ color: "var(--text-secondary)" }}>Вы уверены, что хотите удалить дедлайн для <strong>{deleteDeadline.client?.company_name || deleteDeadline.client?.full_name}</strong>?</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteDeadline(null)} className="btn btn-secondary">Отмена</button>
                <button onClick={() => deleteMutation.mutate(deleteDeadline.id)} disabled={deleteMutation.isPending} className="btn bg-red-600 text-white hover:bg-red-700">{deleteMutation.isPending ? "Удаление..." : "Удалить"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
