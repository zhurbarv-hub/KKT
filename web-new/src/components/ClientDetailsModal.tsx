import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Building2, Phone, Mail, MapPin, Calendar, Clock, Package, Edit2, Trash2, Plus, AlertCircle, Search } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cashRegistersApi, clientApi, ofdProvidersApi } from "../services/api";
import type { User, Deadline } from "../types";
import type { CashRegister, CashRegisterCreate, CashRegisterUpdate, OFDProvider } from "../services/api";
import clsx from "clsx";

interface Props {
  client: User;
  onClose: () => void;
}

interface KktFormData {
  register_name: string;
  model: string;
  factory_number: string;
  registration_number: string;
  fn_number: string;
  installation_address: string;
  fn_expiry_date: string;
  ofd_expiry_date: string;
  ofd_provider_id: string;
  notes: string;
}

const emptyFormData: KktFormData = {
  register_name: "",
  model: "",
  factory_number: "",
  registration_number: "",
  fn_number: "",
  installation_address: "",
  fn_expiry_date: "",
  ofd_expiry_date: "",
  ofd_provider_id: "",
  notes: "",
};

function KktForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  ofdProviders
}: {
  initialData: KktFormData;
  onSubmit: (data: KktFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
  ofdProviders: OFDProvider[];
}) {
  const [formData, setFormData] = useState<KktFormData>(initialData);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Название кассы *</label>
          <input type="text" required className="input" value={formData.register_name} onChange={(e) => setFormData({ ...formData, register_name: e.target.value })} placeholder="Например: Касса 1" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Модель</label>
          <input type="text" className="input" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} placeholder="Атол 30Ф" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Заводской номер</label>
          <input type="text" className="input" value={formData.factory_number} onChange={(e) => setFormData({ ...formData, factory_number: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Регистрационный номер</label>
          <input type="text" className="input" value={formData.registration_number} onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Номер ФН</label>
          <input type="text" className="input" value={formData.fn_number} onChange={(e) => setFormData({ ...formData, fn_number: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Адрес установки</label>
          <input type="text" className="input" value={formData.installation_address} onChange={(e) => setFormData({ ...formData, installation_address: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Срок ФН до</label>
          <input type="date" className="input" value={formData.fn_expiry_date} onChange={(e) => setFormData({ ...formData, fn_expiry_date: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Срок ОФД до</label>
          <input type="date" className="input" value={formData.ofd_expiry_date} onChange={(e) => setFormData({ ...formData, ofd_expiry_date: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Оператор ОФД</label>
          <select
            className="input"
            value={formData.ofd_provider_id}
            onChange={(e) => setFormData({ ...formData, ofd_provider_id: e.target.value })}
          >
            <option value="">— Не выбран —</option>
            {ofdProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Примечание</label>
          <textarea className="input min-h-[60px]" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn btn-secondary">Отмена</button>
        <button type="submit" disabled={isLoading} className="btn btn-primary">{isLoading ? "Сохранение..." : "Сохранить"}</button>
      </div>
    </form>
  );
}

export default function ClientDetailsModal({ client, onClose }: Props) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"info" | "kkt" | "deadlines">("info");
  const [editKkt, setEditKkt] = useState<CashRegister | null>(null);
  const [isCreateKkt, setIsCreateKkt] = useState(false);
  const [deleteKkt, setDeleteKkt] = useState<CashRegister | null>(null);
  const [kktSearch, setKktSearch] = useState("");

  const { data: cashRegisters = [], isLoading: kktLoading } = useQuery({
    queryKey: ["cash-registers", client.id],
    queryFn: () => cashRegistersApi.getByClient(client.id),
  });

  const filteredCashRegisters = useMemo(() => {
    if (!kktSearch.trim()) return cashRegisters;
    const search = kktSearch.toLowerCase();
    return cashRegisters.filter((kkt: CashRegister) =>
      kkt.register_name?.toLowerCase().includes(search) ||
      kkt.model?.toLowerCase().includes(search) ||
      kkt.factory_number?.toLowerCase().includes(search) ||
      kkt.registration_number?.toLowerCase().includes(search) ||
      kkt.fn_number?.toLowerCase().includes(search) ||
      kkt.installation_address?.toLowerCase().includes(search)
    );
  }, [cashRegisters, kktSearch]);
  const { data: deadlines = [], isLoading: deadlinesLoading } = useQuery({
    queryKey: ["client-deadlines", client.id],
    queryFn: () => clientApi.getDeadlines(client.id),
  });

  const { data: ofdProviders = [] } = useQuery({
    queryKey: ["ofd-providers"],
    queryFn: () => ofdProvidersApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CashRegisterCreate) => cashRegistersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-registers", client.id] });
      queryClient.invalidateQueries({ queryKey: ["client-deadlines", client.id] });
      setIsCreateKkt(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CashRegisterUpdate }) => cashRegistersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-registers", client.id] });
      queryClient.invalidateQueries({ queryKey: ["client-deadlines", client.id] });
      setEditKkt(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cashRegistersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-registers", client.id] });
      queryClient.invalidateQueries({ queryKey: ["client-deadlines", client.id] });
      setDeleteKkt(null);
    },
  });

  const handleCreate = (formData: KktFormData) => {
    createMutation.mutate({
      client_id: client.id,
      register_name: formData.register_name || undefined,
      model: formData.model || undefined,
      factory_number: formData.factory_number || undefined,
      registration_number: formData.registration_number || undefined,
      fn_number: formData.fn_number || undefined,
      installation_address: formData.installation_address || undefined,
      fn_expiry_date: formData.fn_expiry_date || undefined,
      ofd_expiry_date: formData.ofd_expiry_date || undefined,
      ofd_provider_id: formData.ofd_provider_id ? parseInt(formData.ofd_provider_id) : undefined,
      notes: formData.notes || undefined,
    });
  };

  const handleUpdate = (formData: KktFormData) => {
    if (!editKkt) return;
    updateMutation.mutate({
      id: editKkt.id,
      data: {
        register_name: formData.register_name || undefined,
        model: formData.model || undefined,
        factory_number: formData.factory_number || undefined,
        registration_number: formData.registration_number || undefined,
        fn_number: formData.fn_number || undefined,
        installation_address: formData.installation_address || undefined,
        fn_expiry_date: formData.fn_expiry_date || null,
        ofd_expiry_date: formData.ofd_expiry_date || null,
        ofd_provider_id: formData.ofd_provider_id ? parseInt(formData.ofd_provider_id) : undefined,
        notes: formData.notes || undefined,
      },
    });
  };

  const getStatusColor = (days?: number) => {
    if (days === undefined) return "bg-gray-100 text-gray-600";
    if (days < 0) return "bg-gray-100 text-gray-600";
    if (days <= 7) return "bg-red-100 text-red-700";
    if (days <= 14) return "bg-yellow-100 text-yellow-700";
    return "bg-green-100 text-green-700";
  };

  const getOfdProviderName = (providerId?: number) => {
    if (!providerId) return null;
    const provider = ofdProviders.find(p => p.id === providerId);
    return provider?.name || null;
  };

  const kktToFormData = (kkt: CashRegister): KktFormData => ({
    register_name: kkt.register_name || "",
    model: kkt.model || "",
    factory_number: kkt.factory_number || "",
    registration_number: kkt.registration_number || "",
    fn_number: kkt.fn_number || "",
    installation_address: kkt.installation_address || "",
    fn_expiry_date: kkt.fn_expiry_date || "",
    ofd_expiry_date: kkt.ofd_expiry_date || "",
    ofd_provider_id: kkt.ofd_provider_id?.toString() || "",
    notes: kkt.notes || "",
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-violet-600 to-violet-700">
            <div className="text-white">
              <h3 className="text-lg font-semibold">{client.company_name || client.full_name}</h3>
              <p className="text-sm text-violet-200">ИНН: {client.inn || "не указан"}</p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded text-white"><X size={24} /></button>
          </div>

          <div className="border-b">
            <div className="flex">
              <button onClick={() => setActiveTab("info")} className={clsx("px-6 py-3 font-medium text-sm border-b-2 transition-colors", activeTab === "info" ? "border-violet-600 text-violet-600" : "border-transparent text-gray-500 hover:text-gray-700")}>Информация</button>
              <button onClick={() => setActiveTab("kkt")} className={clsx("px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2", activeTab === "kkt" ? "border-violet-600 text-violet-600" : "border-transparent text-gray-500 hover:text-gray-700")}>
                <Package size={16} />ККТ <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">{cashRegisters.length}</span>
              </button>
              <button onClick={() => setActiveTab("deadlines")} className={clsx("px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2", activeTab === "deadlines" ? "border-violet-600 text-violet-600" : "border-transparent text-gray-500 hover:text-gray-700")}>
                <Clock size={16} />Дедлайны <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">{deadlines.length}</span>
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {activeTab === "info" && (
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3"><Building2 size={20} className="text-gray-400 mt-0.5" /><div><p className="text-sm text-gray-500">Компания</p><p className="font-medium">{client.company_name || "—"}</p></div></div>
                  <div className="flex items-start gap-3"><Mail size={20} className="text-gray-400 mt-0.5" /><div><p className="text-sm text-gray-500">Email</p><p className="font-medium">{client.email}</p></div></div>
                  <div className="flex items-start gap-3"><Phone size={20} className="text-gray-400 mt-0.5" /><div><p className="text-sm text-gray-500">Телефон</p><p className="font-medium">{client.phone || "—"}</p></div></div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3"><MapPin size={20} className="text-gray-400 mt-0.5" /><div><p className="text-sm text-gray-500">Адрес</p><p className="font-medium">{client.address || "—"}</p></div></div>
                  <div className="flex items-start gap-3"><Calendar size={20} className="text-gray-400 mt-0.5" /><div><p className="text-sm text-gray-500">Дата регистрации</p><p className="font-medium">{client.registered_at ? format(new Date(client.registered_at), "dd.MM.yyyy", { locale: ru }) : "—"}</p></div></div>
                </div>
                {client.notes && <div className="col-span-2 p-4 bg-gray-50 rounded-lg"><p className="text-sm text-gray-500 mb-1">Примечания</p><p className="whitespace-pre-wrap">{client.notes}</p></div>}
              </div>
            )}

            {activeTab === "kkt" && (
              <>
                <div className="flex gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2" size={18} style={{ color: "var(--text-muted)" }} />
                    <input type="text" placeholder="Поиск по названию, номеру, адресу..." className="input w-full" style={{ paddingLeft: "3rem" }} value={kktSearch} onChange={(e) => setKktSearch(e.target.value)} />
                  </div>
                  <button onClick={() => setIsCreateKkt(true)} className="btn btn-primary flex items-center gap-2"><Plus size={18} />Добавить ККТ</button>
                </div>
                {kktLoading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div> :
                filteredCashRegisters.length === 0 ? <div className="text-center py-8 text-gray-500"><Package size={48} className="mx-auto mb-2 text-gray-300" /><p>{kktSearch ? "Ничего не найдено" : "Нет зарегистрированных ККТ"}</p></div> :
                <div className="space-y-4">
                  {filteredCashRegisters.map((kkt: CashRegister) => (
                    <div key={kkt.id} className="border rounded-lg p-4 hover:border-violet-300 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div><p className="font-semibold text-gray-900">{kkt.register_name || kkt.model || "ККТ #" + kkt.id}</p><p className="text-sm text-gray-500">{kkt.installation_address || "Адрес не указан"}</p></div>
                        <div className="flex items-center gap-2">
                          <span className={clsx("px-2 py-1 rounded text-xs font-medium", kkt.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>{kkt.is_active ? "Активна" : "Неактивна"}</span>
                          <button onClick={() => setEditKkt(kkt)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-violet-600" title="Редактировать"><Edit2 size={16} /></button>
                          <button onClick={() => setDeleteKkt(kkt)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600" title="Удалить"><Trash2 size={16} /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div><span className="text-gray-500">Зав. номер:</span> {kkt.factory_number || "—"}</div>
                        <div><span className="text-gray-500">Рег. номер:</span> {kkt.registration_number || "—"}</div>
                        <div><span className="text-gray-500">ФН:</span> {kkt.fn_number || "—"}</div>
                      </div>
                      {getOfdProviderName(kkt.ofd_provider_id) && (
                        <div className="mt-2 text-sm">
                          <span className="text-gray-500">ОФД:</span> <span className="font-medium text-violet-600">{getOfdProviderName(kkt.ofd_provider_id)}</span>
                        </div>
                      )}
                      {(kkt.fn_expiry_date || kkt.ofd_expiry_date) && (
                        <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-4 text-sm">
                          {kkt.fn_expiry_date && <div><span className="text-gray-500">ФН до:</span> <span className="font-medium">{format(new Date(kkt.fn_expiry_date), "dd.MM.yyyy")}</span></div>}
                          {kkt.ofd_expiry_date && <div><span className="text-gray-500">ОФД до:</span> <span className="font-medium">{format(new Date(kkt.ofd_expiry_date), "dd.MM.yyyy")}</span></div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>}
              </>
            )}

            {activeTab === "deadlines" && (
              deadlinesLoading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div> :
              deadlines.length === 0 ? <div className="text-center py-8 text-gray-500"><Clock size={48} className="mx-auto mb-2 text-gray-300" /><p>Нет активных дедлайнов</p></div> :
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b"><th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Тип</th><th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Дата</th><th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Осталось</th><th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Примечание</th></tr></thead>
                  <tbody>
                    {deadlines.map((d: Deadline) => (
                      <tr key={d.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3">{d.deadline_type?.type_name || "—"}</td>
                        <td className="py-2 px-3">{format(new Date(d.expiration_date), "dd.MM.yyyy")}</td>
                        <td className="py-2 px-3"><span className={clsx("px-2 py-1 rounded text-xs font-medium", getStatusColor(d.days_until_expiration))}>{d.days_until_expiration !== undefined ? (d.days_until_expiration < 0 ? `${Math.abs(d.days_until_expiration)} дн. назад` : `${d.days_until_expiration} дн.`) : "—"}</span></td>
                        <td className="py-2 px-3 text-sm text-gray-500">{d.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create KKT Modal */}
      {isCreateKkt && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setIsCreateKkt(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Новая ККТ</h3>
                <button onClick={() => setIsCreateKkt(false)} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
              </div>
              <div className="p-4">
                <KktForm initialData={emptyFormData} onSubmit={handleCreate} onCancel={() => setIsCreateKkt(false)} isLoading={createMutation.isPending} ofdProviders={ofdProviders} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit KKT Modal */}
      {editKkt && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setEditKkt(null)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Редактирование ККТ</h3>
                <button onClick={() => setEditKkt(null)} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
              </div>
              <div className="p-4">
                <KktForm initialData={kktToFormData(editKkt)} onSubmit={handleUpdate} onCancel={() => setEditKkt(null)} isLoading={updateMutation.isPending} ofdProviders={ofdProviders} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteKkt && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteKkt(null)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full"><AlertCircle className="text-red-600" size={24} /></div>
                <h3 className="text-lg font-semibold text-gray-900">Удалить ККТ?</h3>
              </div>
              <p className="text-gray-600 mb-2">Вы уверены, что хотите удалить кассу <strong>{deleteKkt.register_name || deleteKkt.model || "ККТ #" + deleteKkt.id}</strong>?</p>
              <p className="text-sm text-red-600 mb-6">Все связанные дедлайны также будут удалены.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteKkt(null)} className="btn btn-secondary">Отмена</button>
                <button onClick={() => deleteMutation.mutate(deleteKkt.id)} disabled={deleteMutation.isPending} className="btn bg-red-600 text-white hover:bg-red-700">{deleteMutation.isPending ? "Удаление..." : "Удалить"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
