import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../services/api';
import type { User, UserCreate, UserUpdate, UserRole } from '../types';
import { Plus, Edit2, Trash2, X, AlertCircle, UserCog, Shield, User as UserIcon } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
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
    email: user?.email || '',
    full_name: user?.full_name || '',
    role: user?.role || 'manager' as UserRole,
    password: '',
    is_active: user?.is_active ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: UserCreate = {
      email: formData.email,
      full_name: formData.full_name,
      role: formData.role,
      password: formData.password || undefined,
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ФИО *</label>
        <input type="text" required className="input" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
        <input type="email" required className="input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Роль *</label>
        <select className="input" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}>
          <option value="manager">Менеджер</option>
          <option value="admin">Администратор</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{user ? 'Новый пароль' : 'Пароль *'}</label>
        <input type="password" className="input" required={!user} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder={user ? 'Оставьте пустым для сохранения' : ''} minLength={8} />
      </div>
      {user && (
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4 text-violet-600 rounded" />
            <span className="text-sm text-gray-700">Активен</span>
          </label>
        </div>
      )}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn btn-secondary">Отмена</button>
        <button type="submit" disabled={isLoading} className="btn btn-primary">{isLoading ? 'Сохранение...' : user ? 'Сохранить' : 'Создать'}</button>
      </div>
    </form>
  );
}

export default function ManagersPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
  });

  const managers = useMemo(() => users.filter((u: User) => u.role === 'manager' || u.role === 'admin'), [users]);

  const createMutation = useMutation({
    mutationFn: (data: UserCreate) => usersApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setIsCreateOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserUpdate }) => usersApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setEditUser(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setDeleteUser(null); },
  });

  const getRoleIcon = (role: UserRole) => {
    if (role === 'admin') return <Shield size={16} className="text-violet-600" />;
    return <UserIcon size={16} className="text-blue-600" />;
  };

  const getRoleName = (role: UserRole) => {
    if (role === 'admin') return 'Администратор';
    if (role === 'manager') return 'Менеджер';
    return 'Клиент';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Пользователи</h1>
          <p className="text-gray-600 mt-1">Управление менеджерами и администраторами</p>
        </div>
        <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary flex items-center gap-2"><Plus size={18} />Добавить пользователя</button>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>
        ) : managers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500"><UserCog size={48} className="mb-4 text-gray-300" /><p>Пользователи не найдены</p></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {managers.map((user: User) => (
              <div key={user.id} className={clsx('p-4 border rounded-lg transition-colors', user.is_active ? 'border-gray-200 hover:border-violet-300' : 'border-gray-200 bg-gray-50 opacity-60')}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                      <span className="text-violet-700 font-semibold">{user.full_name?.charAt(0) || 'U'}</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{user.full_name}</h3>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditUser(user)} className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-violet-600"><Edit2 size={16} /></button>
                    <button onClick={() => setDeleteUser(user)} className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">{getRoleIcon(user.role)}<span className="text-sm text-gray-600">{getRoleName(user.role)}</span></div>
                  <span className={clsx('px-2 py-1 text-xs font-medium rounded-full', user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>{user.is_active ? 'Активен' : 'Неактивен'}</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">Создан: {format(new Date(user.created_at), 'dd.MM.yyyy', { locale: ru })}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Новый пользователь">
        <UserForm onSubmit={(data) => createMutation.mutate(data as UserCreate)} onCancel={() => setIsCreateOpen(false)} isLoading={createMutation.isPending} />
      </Modal>

      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Редактирование пользователя">
        <UserForm user={editUser} onSubmit={(data) => editUser && updateMutation.mutate({ id: editUser.id, data: data as UserUpdate })} onCancel={() => setEditUser(null)} isLoading={updateMutation.isPending} />
      </Modal>

      {deleteUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteUser(null)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full"><AlertCircle className="text-red-600" size={24} /></div>
                <h3 className="text-lg font-semibold text-gray-900">Удалить пользователя?</h3>
              </div>
              <p className="text-gray-600 mb-6">Вы уверены, что хотите удалить пользователя <strong>{deleteUser.full_name}</strong>?</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteUser(null)} className="btn btn-secondary">Отмена</button>
                <button onClick={() => deleteMutation.mutate(deleteUser.id)} disabled={deleteMutation.isPending} className="btn bg-red-600 text-white hover:bg-red-700">{deleteMutation.isPending ? 'Удаление...' : 'Удалить'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
