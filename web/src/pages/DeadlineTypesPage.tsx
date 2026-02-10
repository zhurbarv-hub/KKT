import { useEscapeKey } from "../hooks/useEscapeKey";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deadlineTypesApi } from '../services/api';
import type { DeadlineType, DeadlineTypeCreate } from '../types';
import { Plus, Edit2, Trash2, X, AlertCircle, Tag, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

// Modal Component
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
        <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X size={20} />
            </button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

// Type Form
interface TypeFormProps {
  type?: DeadlineType | null;
  onSubmit: (data: DeadlineTypeCreate) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function TypeForm({ type, onSubmit, onCancel, isLoading }: TypeFormProps) {
  const [formData, setFormData] = useState({
    type_name: type?.type_name || '',
    description: type?.description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
        <input
          type="text"
          required
          className="input"
          value={formData.type_name}
          onChange={(e) => setFormData({ ...formData, type_name: e.target.value })}
          placeholder="Например: ОФД, ЭЦП, Касса"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
        <textarea
          className="input min-h-[100px]"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Описание типа услуги..."
        />
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn btn-secondary">Отмена</button>
        <button type="submit" disabled={isLoading} className="btn btn-primary">
          {isLoading ? 'Сохранение...' : type ? 'Сохранить' : 'Создать'}
        </button>
      </div>
    </form>
  );
}

export default function DeadlineTypesPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editType, setEditType] = useState<DeadlineType | null>(null);
  const [deleteType, setDeleteType] = useState<DeadlineType | null>(null);

  // Close any open modal on ESC
  useEscapeKey(() => {
    if (deleteType) setDeleteType(null);
    else if (editType) setEditType(null);
    else if (isCreateOpen) setIsCreateOpen(false);
  }, isCreateOpen || !!editType || !!deleteType);

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['deadline-types'],
    queryFn: deadlineTypesApi.list,
  });

  const createMutation = useMutation({
    mutationFn: (data: DeadlineTypeCreate) => deadlineTypesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadline-types'] });
      setIsCreateOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DeadlineTypeCreate> }) => 
      deadlineTypesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadline-types'] });
      setEditType(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deadlineTypesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadline-types'] });
      setDeleteType(null);
    },
  });

  const activeTypes = types.filter(t => t.is_active);
  const inactiveTypes = types.filter(t => !t.is_active);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Типы услуг</h1>
          <p className="text-gray-600 mt-1">Управление типами дедлайнов</p>
        </div>
        <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary flex items-center gap-2">
          <Plus size={18} />
          Добавить тип
        </button>
      </div>

      {/* Active Types */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Активные типы</h2>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
          </div>
        ) : activeTypes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <Tag size={32} className="mb-2 text-gray-300" />
            <p>Нет активных типов</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeTypes.map((type) => (
              <div
                key={type.id}
                className="p-4 border border-gray-200 rounded-lg hover:border-violet-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Tag size={18} className="text-violet-600" />
                    <h3 className="font-medium text-gray-900">{type.type_name}</h3>
                  </div>
                  {type.is_system ? (
                    <span title="Системный тип">
                      <Lock size={16} className="text-gray-400" />
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditType(type)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-violet-600"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteType(type)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
                {type.description && (
                  <p className="text-sm text-gray-600 mb-2">{type.description}</p>
                )}
                <p className="text-xs text-gray-400">
                  Создан: {format(new Date(type.created_at), 'dd.MM.yyyy', { locale: ru })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inactive Types */}
      {inactiveTypes.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-500 mb-4">Неактивные типы</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inactiveTypes.map((type) => (
              <div
                key={type.id}
                className="p-4 border border-gray-200 rounded-lg bg-gray-50 opacity-60"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Tag size={18} className="text-gray-400" />
                  <h3 className="font-medium text-gray-600">{type.type_name}</h3>
                </div>
                {type.description && (
                  <p className="text-sm text-gray-500">{type.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Новый тип услуги">
        <TypeForm
          onSubmit={(data) => createMutation.mutate(data)}
          onCancel={() => setIsCreateOpen(false)}
          isLoading={createMutation.isPending}
        />
      </Modal>

      <Modal isOpen={!!editType} onClose={() => setEditType(null)} title="Редактирование типа">
        <TypeForm
          type={editType}
          onSubmit={(data) => editType && updateMutation.mutate({ id: editType.id, data })}
          onCancel={() => setEditType(null)}
          isLoading={updateMutation.isPending}
        />
      </Modal>

      {/* Delete Dialog */}
      {deleteType && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteType(null)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertCircle className="text-red-600" size={24} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Удалить тип услуги?</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Вы уверены, что хотите удалить тип <strong>{deleteType.type_name}</strong>?
                Это может повлиять на связанные дедлайны.
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteType(null)} className="btn btn-secondary">Отмена</button>
                <button 
                  onClick={() => deleteMutation.mutate(deleteType.id)}
                  disabled={deleteMutation.isPending}
                  className="btn bg-red-600 text-white hover:bg-red-700"
                >
                  {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
