import { useState, useMemo } from "react";
import ClientDetailsModal from "../components/ClientDetailsModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "../services/api";
import type { User, UserCreate, UserUpdate } from "../types";
import { 
  Search, Plus, Edit2, Trash2, Key, ChevronLeft, ChevronRight, 
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>ФИО *</label>
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
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Компания</label>
          <input type="text" className="input" value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>ИНН</label>
          <input type="text" className="input" value={formData.inn} onChange={(e) => setFormData({ ...formData, inn: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Адрес</label>
          <input type="text" className="input" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Пароль {user ? "(оставьте пустым)" : "*"}</label>
          <input type="password" className="input" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required={!user} minLength={8} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Дни уведомлений</label>
          <input type="text" className="input" value={formData.notification_days} onChange={(e) => setFormData({ ...formData, notification_days: e.target.value })} placeholder="30,14,7,3,1" />
        </div>
        <div className="flex items-center">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formData.notifications_enabled} onChange={(e) => setFormData({ ...formData, notifications_enabled: e.target.checked })} className="w-4 h-4" />
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

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [viewClient, setViewClient] = useState<User | null>(null);
  const [codeMessage, setCodeMessage] = useState<{userId: number; code: string} | null>(null);
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

  const createMutation = useMutation({
    mutationFn: (data: UserCreate) => usersApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); setIsCreateOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserUpdate }) => usersApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); setEditUser(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); setDeleteUser(null); },
  });

  const generateCodeMutation = useMutation({
    mutationFn: (id: number) => usersApi.generateCode(id),
    onSuccess: (response, id) => {
      const code = response.code;
      if (code) setCodeMessage({ userId: id, code });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

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
                    <th className="text-left py-3 px-4 font-medium" style={{ color: "var(--text-secondary)" }}>Контакты</th>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: "var(--text-secondary)" }}>Клиент</th>
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
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 text-sm" style={{ color: "var(--text-secondary)" }}><Mail size={14} />{user.email}</div>
                          {user.phone && <div className="flex items-center gap-1 text-sm" style={{ color: "var(--text-secondary)" }}><Phone size={14} />{user.phone}</div>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium" style={{ color: "var(--text-primary)" }}>{user.full_name}</p>
                      </td>
                      <td className="py-3 px-4">
                        {user.telegram_id ? (
                          user.telegram_username ? (
                            <div className="flex items-center gap-1 text-blue-400"><MessageCircle size={16} />@{user.telegram_username}</div>
                          ) : (
                            <span className="flex items-center gap-1 text-green-400"><Check size={16} />Привязан</span>
                          )
                        ) : user.registration_code ? (
                          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">Код: {user.registration_code}</span>
                        ) : <span style={{ color: "var(--text-muted)" }}>Не привязан</span>}
                      </td>
                      <td className="py-3 px-4">
                        {user.is_active ? (
                          <span className="flex items-center gap-1 text-green-400"><Check size={16} />Активен</span>
                        ) : <span style={{ color: "var(--text-muted)" }}>Неактивен</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {!user.telegram_id && (
                            <button onClick={() => generateCodeMutation.mutate(user.id)} disabled={generateCodeMutation.isPending} className="p-2 rounded transition-colors" style={{ color: "var(--text-muted)" }} title="Сгенерировать код"><Key size={16} /></button>
                          )}
                          <button onClick={() => setViewClient(user)} className="p-2 rounded transition-colors" style={{ color: "var(--text-muted)" }} title="Карточка"><Users size={16} /></button>
                          <button onClick={() => setEditUser(user)} className="p-2 rounded transition-colors" style={{ color: "var(--text-muted)" }} title="Редактировать"><Edit2 size={16} /></button>
                          <button onClick={() => setDeleteUser(user)} className="p-2 rounded transition-colors" style={{ color: "var(--text-muted)" }} title="Удалить"><Trash2 size={16} /></button>
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
              <p className="mb-6" style={{ color: "var(--text-secondary)" }}>Вы уверены, что хотите удалить <strong>{deleteUser.full_name}</strong>? Это действие необратимо.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteUser(null)} className="btn btn-secondary">Отмена</button>
                <button onClick={() => deleteMutation.mutate(deleteUser.id)} disabled={deleteMutation.isPending} className="btn bg-red-600 text-white hover:bg-red-700">{deleteMutation.isPending ? "Удаление..." : "Удалить"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {codeMessage && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setCodeMessage(null)} />
            <div className="relative rounded-xl shadow-xl max-w-sm w-full p-6" style={{ background: "var(--bg-card)" }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Код регистрации</h3>
              <p className="mb-4" style={{ color: "var(--text-secondary)" }}>Отправьте этот код клиенту для привязки Telegram:</p>
              <div className="p-4 rounded-lg text-center" style={{ background: "var(--bg-secondary)" }}><code className="text-2xl font-mono font-bold text-violet-400">{codeMessage.code}</code></div>
              <div className="flex justify-end mt-6"><button onClick={() => setCodeMessage(null)} className="btn btn-primary">Закрыть</button></div>
            </div>
          </div>
        </div>
      )}
      {viewClient && <ClientDetailsModal client={viewClient} onClose={() => setViewClient(null)} />}
    </div>
  );
}
