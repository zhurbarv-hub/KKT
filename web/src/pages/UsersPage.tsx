import { useEscapeKey } from "../hooks/useEscapeKey";
import { useState, useMemo, useEffect, useCallback } from "react";
import ClientDetailsModal from "../components/ClientDetailsModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "../services/api";
import type { User, UserCreate, UserUpdate } from "../types";
import { 
  Search, Plus, Edit2, Trash2, ChevronLeft, ChevronRight, 
  X, Check, AlertCircle, Phone, Mail, Building2, MessageCircle, Users
} from "lucide-react";


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

interface UserFormProps {
  user?: User | null;
  onSubmit: (data: UserCreate | UserUpdate) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function UserForm({ user, onSubmit, onCancel, isLoading }: UserFormProps) {
  const [formData, setFormData] = useState({
    email: user?.email || "",
    full_name: user?.full_name || "",
    company_name: user?.company_name || "",
    inn: user?.inn || "",
    phone: user?.phone || "",
    address: user?.address || "",
    notes: user?.notes || "",
    notification_days: user?.notification_days || "30,14,7,3,1",
    notifications_enabled: user?.notifications_enabled ?? true,
    password: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: UserCreate = {
      email: formData.email,
      full_name: formData.full_name,
      company_name: formData.company_name || undefined,
      inn: formData.inn || undefined,
      phone: formData.phone || undefined,
      address: formData.address || undefined,
      notes: formData.notes || undefined,
      notification_days: formData.notification_days || undefined,
      notifications_enabled: formData.notifications_enabled,
      password: formData.password || undefined,
      role: user ? undefined : "client",
    };
    onSubmit(data);
  };

  const NOTIFICATION_DAY_OPTIONS = [
    { value: 30, label: "30 дней" },
    { value: 14, label: "14 дней" },
    { value: 7, label: "7 дней" },
    { value: 3, label: "3 дня" },
    { value: 1, label: "1 день" },
  ];

  const selectedDays = formData.notification_days
    .split(",")
    .map((d) => parseInt(d.trim()))
    .filter((d) => !isNaN(d));

  const toggleDay = (day: number) => {
    const newDays = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day].sort((a, b) => b - a);
    setFormData({ ...formData, notification_days: newDays.join(",") });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Компания</label>
          <input type="text" className="input" value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>ИНН</label>
          <input type="text" className="input" value={formData.inn} onChange={(e) => setFormData({ ...formData, inn: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Контактное лицо *</label>
          <input type="text" required className="input" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Email *</label>
          <input type="email" required className="input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Телефон</label>
          <input type="tel" className="input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Адрес</label>
          <input type="text" className="input" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Дни уведомлений</label>
          <div className="flex flex-wrap gap-2">
            {NOTIFICATION_DAY_OPTIONS.map((opt) => {
              const isActive = selectedDays.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleDay(opt.value)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    border: isActive ? "1px solid rgba(139,92,246,0.5)" : "1px solid var(--border-color)",
                    background: isActive ? "rgba(139,92,246,0.15)" : "transparent",
                    color: isActive ? "#a78bfa" : "var(--text-muted)",
                  }}
                >
                  {isActive && <span style={{ marginRight: 4 }}>&#10003;</span>}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="col-span-2">
          <label
            className="flex items-center gap-3 cursor-pointer select-none"
            style={{ padding: "8px 0" }}
          >
            <div
              style={{
                width: 40,
                height: 22,
                borderRadius: 11,
                background: formData.notifications_enabled ? "rgba(139,92,246,0.6)" : "var(--border-color)",
                position: "relative",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
              onClick={(e) => { e.preventDefault(); setFormData({ ...formData, notifications_enabled: !formData.notifications_enabled }); }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: formData.notifications_enabled ? "#a78bfa" : "var(--text-muted)",
                  position: "absolute",
                  top: 2,
                  left: formData.notifications_enabled ? 20 : 2,
                  transition: "all 0.2s",
                }}
              />
            </div>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Уведомления включены</span>
          </label>
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Заметки</label>
          <textarea className="input min-h-[80px]" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
        <button type="button" onClick={onCancel} className="btn btn-secondary">Отмена</button>
        <button type="submit" disabled={isLoading} className="btn btn-primary">{isLoading ? "Сохранение..." : user ? "Сохранить" : "Создать"}</button>
      </div>
    </form>
  );
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 20px",
        borderRadius: 12,
        background: type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
        border: "1px solid " + (type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"),
        backdropFilter: "blur(12px)",
        color: type === "success" ? "#4ade80" : "#f87171",
        fontSize: 14,
        fontWeight: 500,
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        animation: "toast-in 0.3s ease-out",
      }}
    >
      {type === "success" ? <Check size={18} /> : <AlertCircle size={18} />}
      <span>{message}</span>
      <button onClick={onClose} style={{ marginLeft: 8, opacity: 0.6, cursor: "pointer", background: "none", border: "none", color: "inherit" }}><X size={14} /></button>
      <style>{"@keyframes toast-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }"}</style>
    </div>
  );
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [viewClient, setViewClient] = useState<User | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  }, []);

  // Close any open modal on ESC
  useEscapeKey(() => {
    if (deleteUser) setDeleteUser(null);
    else if (viewClient) setViewClient(null);
    else if (editUser) setEditUser(null);
    else if (isCreateOpen) setIsCreateOpen(false);
  }, isCreateOpen || !!editUser || !!deleteUser || !!viewClient);
  const limit = 15;

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });

  const clients = useMemo(() => users.filter((u: User) => u.role === "client"), [users]);

  const filteredClients = useMemo(() => {
    if (!search) return clients;
    const s = search.toLowerCase();
    return clients.filter((u: User) => 
      u.full_name?.toLowerCase().includes(s) || 
      u.email?.toLowerCase().includes(s) || 
      u.company_name?.toLowerCase().includes(s) ||
      u.phone?.includes(s)
    );
  }, [clients, search]);

  const totalPages = Math.ceil(filteredClients.length / limit);
  const paginatedClients = filteredClients.slice((page - 1) * limit, page * limit);

  const getErrorMessage = (error: any): string => {
    const data = error?.response?.data;
    if (data?.detail) {
      if (typeof data.detail === "string") return data.detail;
      if (Array.isArray(data.detail)) return data.detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join("; ");
    }
    if (data?.error?.message) return data.error.message;
    return "Произошла ошибка";
  };

  const createMutation = useMutation({
    mutationFn: (data: UserCreate) => usersApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); setIsCreateOpen(false); showToast("Клиент успешно создан"); },
    onError: (error: any) => { showToast(getErrorMessage(error), "error"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserUpdate }) => usersApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); setEditUser(null); showToast("Клиент обновлён"); },
    onError: (error: any) => { showToast(getErrorMessage(error), "error"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); setDeleteUser(null); showToast("Клиент удалён"); },
    onError: (error: any) => { showToast(getErrorMessage(error), "error"); },
  });

  const handleRowClick = (user: User, e: React.MouseEvent) => {
    // Don't open modal if clicking on action buttons
    if ((e.target as HTMLElement).closest('button')) return;
    setViewClient(user);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Клиенты</h1>
          <p className="mt-1" style={{ color: "var(--text-secondary)" }}>Управление базой клиентов</p>
        </div>
        <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary flex items-center gap-2"><Plus size={18} />Добавить клиента</button>
      </div>

      <div className="card">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2" size={20} style={{ color: "var(--text-muted)" }} />
          <input type="text" placeholder="Поиск по имени, email, компании, телефону..." className="input" style={{ paddingLeft: "3rem" }} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>
        ) : paginatedClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64" style={{ color: "var(--text-muted)" }}><Users size={48} className="mb-4 opacity-50" /><p>Клиенты не найдены</p></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ background: "var(--bg-secondary)" }}>
                  <tr>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: "var(--text-secondary)" }}>Компания</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: "var(--text-secondary)" }}>Контактное лицо</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: "var(--text-secondary)" }}>Telegram</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: "var(--text-secondary)" }}>Статус</th>
                    <th className="text-right py-3 px-4 font-medium" style={{ color: "var(--text-secondary)" }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClients.map((user: User) => (
                    <tr 
                      key={user.id} 
                      className="transition-colors cursor-pointer"
                      style={{ borderTop: "1px solid var(--border-color)" }}
                      onClick={(e) => handleRowClick(user, e)}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td className="py-3 px-4">
                        {user.company_name ? (
                          <>
                            <div className="flex items-center gap-1 font-medium" style={{ color: "var(--text-primary)" }}><Building2 size={16} />{user.company_name}</div>
                            {user.inn && <p className="text-sm" style={{ color: "var(--text-muted)" }}>ИНН: {user.inn}</p>}
                          </>
                        ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <p className="font-medium" style={{ color: "var(--text-primary)" }}>{user.full_name}</p>
                          {user.phone && <div className="flex items-center gap-1 text-sm" style={{ color: "var(--text-secondary)" }}><Phone size={14} />{user.phone}</div>}
                          <div className="flex items-center gap-1 text-sm" style={{ color: "var(--text-secondary)" }}><Mail size={14} />{user.email}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {user.telegram_id ? (
                          user.telegram_username ? (
                            <div className="flex items-center gap-1 text-blue-400"><MessageCircle size={16} />@{user.telegram_username}</div>
                          ) : (
                            <span className="flex items-center gap-1 text-green-400"><Check size={16} />Привязан</span>
                          )
                        ) : <span style={{ color: "var(--text-muted)" }}>Не привязан</span>}
                      </td>
                      <td className="py-3 px-4">
                        {user.is_active ? (
                          <span className="flex items-center gap-1 text-green-400"><Check size={16} />Активен</span>
                        ) : <span style={{ color: "var(--text-muted)" }}>Неактивен</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={(e) => { e.stopPropagation(); setEditUser(user); }} className="p-2 rounded transition-colors" style={{ color: "var(--text-muted)" }} title="Редактировать"><Edit2 size={16} /></button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteUser(user); }} className="p-2 rounded transition-colors" style={{ color: "var(--text-muted)" }} title="Удалить"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Показано {(page - 1) * limit + 1}–{Math.min(page * limit, filteredClients.length)} из {filteredClients.length}</p>
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

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Новый клиент">
        <UserForm onSubmit={(data) => createMutation.mutate(data as UserCreate)} onCancel={() => setIsCreateOpen(false)} isLoading={createMutation.isPending} />
      </Modal>

      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Редактирование клиента">
        <UserForm user={editUser} onSubmit={(data) => editUser && updateMutation.mutate({ id: editUser.id, data: data as UserUpdate })} onCancel={() => setEditUser(null)} isLoading={updateMutation.isPending} />
      </Modal>

      {deleteUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteUser(null)} />
            <div className="relative rounded-xl shadow-xl max-w-sm w-full p-6" style={{ background: "var(--bg-card)" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/20 rounded-full"><AlertCircle className="text-red-400" size={24} /></div>
                <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Удалить клиента?</h3>
              </div>
              <p className="mb-6" style={{ color: "var(--text-secondary)" }}>Вы уверены, что хотите удалить <strong>{deleteUser.company_name || deleteUser.full_name}</strong>? Это действие необратимо.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteUser(null)} className="btn btn-secondary">Отмена</button>
                <button onClick={() => deleteMutation.mutate(deleteUser.id)} disabled={deleteMutation.isPending} className="btn bg-red-600 text-white hover:bg-red-700">{deleteMutation.isPending ? "Удаление..." : "Удалить"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewClient && <ClientDetailsModal client={viewClient} onClose={() => setViewClient(null)} />}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
