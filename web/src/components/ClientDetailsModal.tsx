import { useEscapeKey } from "../hooks/useEscapeKey";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Building2, Phone, Mail, MapPin, Calendar, Clock, Package, Trash2, Plus, AlertCircle, Search, Key, Copy, Check, Pencil } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cashRegistersApi, clientApi, ofdProvidersApi, usersApi, deadlinesApi, deadlineTypesApi } from "../services/api";
import type { User, Deadline, DeadlineType } from "../types";
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
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Название кассы *</label>
          <input type="text" required className="input" value={formData.register_name} onChange={(e) => setFormData({ ...formData, register_name: e.target.value })} placeholder="Например: Касса 1" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Модель</label>
          <input type="text" className="input" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} placeholder="Атол 30Ф" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Заводской номер</label>
          <input type="text" className="input" value={formData.factory_number} onChange={(e) => setFormData({ ...formData, factory_number: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Регистрационный номер</label>
          <input type="text" className="input" value={formData.registration_number} onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Номер ФН</label>
          <input type="text" className="input" value={formData.fn_number} onChange={(e) => setFormData({ ...formData, fn_number: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Адрес установки</label>
          <input type="text" className="input" value={formData.installation_address} onChange={(e) => setFormData({ ...formData, installation_address: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Срок ФН до</label>
          <input type="date" className="input" value={formData.fn_expiry_date} onChange={(e) => setFormData({ ...formData, fn_expiry_date: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Срок ОФД до</label>
          <input type="date" className="input" value={formData.ofd_expiry_date} onChange={(e) => setFormData({ ...formData, ofd_expiry_date: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Оператор ОФД</label>
          <select className="input" value={formData.ofd_provider_id} onChange={(e) => setFormData({ ...formData, ofd_provider_id: e.target.value })}>
            <option value="">— Не выбран —</option>
            {ofdProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.name}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Примечание</label>
          <textarea className="input min-h-[60px]" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
        <button type="button" onClick={onCancel} className="btn btn-secondary">Отмена</button>
        <button type="submit" disabled={isLoading} className="btn btn-primary">{isLoading ? "Сохранение..." : "Сохранить"}</button>
      </div>
    </form>
  );
}


interface DeadlineFormData {
  deadline_type_id: string;
  expiration_date: string;
  notes: string;
}

function DeadlineForm({
  deadlineTypes,
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  mode = "create",
}: {
  deadlineTypes: DeadlineType[];
  initialData?: DeadlineFormData;
  onSubmit: (data: { deadline_type_id: number; expiration_date: string; notes?: string }) => void;
  onCancel: () => void;
  isLoading: boolean;
  mode?: "create" | "edit";
}) {
  const [formData, setFormData] = useState<DeadlineFormData>(
    initialData || {
      deadline_type_id: "",
      expiration_date: "",
      notes: "",
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      deadline_type_id: parseInt(formData.deadline_type_id),
      expiration_date: formData.expiration_date,
      notes: formData.notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Тип услуги *</label>
        <select required className="input" value={formData.deadline_type_id} onChange={(e) => setFormData({ ...formData, deadline_type_id: e.target.value })}>
          <option value="">— Выберите тип —</option>
          {deadlineTypes.filter((t: DeadlineType) => t.is_active).map((t: DeadlineType) => (
            <option key={t.id} value={t.id}>{t.type_name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Дата истечения *</label>
        <input type="date" required className="input" value={formData.expiration_date} onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Примечание</label>
        <textarea className="input min-h-[60px]" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
      </div>
      <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
        <button type="button" onClick={onCancel} className="btn btn-secondary">Отмена</button>
        <button type="submit" disabled={isLoading} className="btn btn-primary">
          {isLoading
            ? (mode === "edit" ? "Сохранение..." : "Создание...")
            : (mode === "edit" ? "Сохранить" : "Создать")
          }
        </button>
      </div>
    </form>
  );
}

export default function ClientDetailsModal({ client, onClose }: Props) {
  const queryClient = useQueryClient();
  useEscapeKey(onClose);
  const [activeTab, setActiveTab] = useState<"info" | "kkt" | "deadlines">("info");
  const [editKkt, setEditKkt] = useState<CashRegister | null>(null);
  const [isCreateKkt, setIsCreateKkt] = useState(false);
  const [deleteKkt, setDeleteKkt] = useState<CashRegister | null>(null);
  const [kktSearch, setKktSearch] = useState("");
  const [isCreateDeadline, setIsCreateDeadline] = useState(false);
  const [editDeadline, setEditDeadline] = useState<Deadline | null>(null);
  const [deleteDeadline, setDeleteDeadline] = useState<Deadline | null>(null);
  const [telegramCode, setTelegramCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

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

  const { data: deadlineTypes = [] } = useQuery({
    queryKey: ["deadline-types"],
    queryFn: () => deadlineTypesApi.list(),
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

  const createDeadlineMutation = useMutation({
    mutationFn: (data: { user_id: number; deadline_type_id: number; expiration_date: string; notes?: string }) => deadlinesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-deadlines", client.id] });
      queryClient.invalidateQueries({ queryKey: ["deadlines"] });
      setIsCreateDeadline(false);
    },
  });

  const updateDeadlineMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { deadline_type_id?: number; expiration_date?: string; notes?: string } }) => deadlinesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-deadlines", client.id] });
      queryClient.invalidateQueries({ queryKey: ["deadlines"] });
      setEditDeadline(null);
    },
  });

  const deleteDeadlineMutation = useMutation({
    mutationFn: (id: number) => deadlinesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-deadlines", client.id] });
      queryClient.invalidateQueries({ queryKey: ["deadlines"] });
      setDeleteDeadline(null);
    },
  });

  const generateCodeMutation = useMutation({
    mutationFn: () => usersApi.generateCode(client.id),
    onSuccess: (data: any) => {
      setTelegramCode(data.message || data.code);
    },
  });

  const copyCode = () => {
    if (telegramCode) {
      navigator.clipboard.writeText(telegramCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

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

  const handleUpdateDeadline = (data: { deadline_type_id: number; expiration_date: string; notes?: string }) => {
    if (!editDeadline) return;
    updateDeadlineMutation.mutate({
      id: editDeadline.id,
      data: {
        deadline_type_id: data.deadline_type_id,
        expiration_date: data.expiration_date,
        notes: data.notes,
      },
    });
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

  const deadlineToFormData = (d: Deadline): DeadlineFormData => ({
    deadline_type_id: d.deadline_type_id?.toString() || "",
    expiration_date: d.expiration_date ? d.expiration_date.split("T")[0] : "",
    notes: d.notes || "",
  });

  const getStatusColor = (days?: number) => {
    if (days === undefined || days < 0) return "#ef4444";
    if (days <= 7) return "#ef4444";
    if (days <= 14) return "#f59e0b";
    return "#10b981";
  };

  const getStatusBg = (days?: number) => {
    if (days === undefined || days < 0) return "rgba(239, 68, 68, 0.1)";
    if (days <= 7) return "rgba(239, 68, 68, 0.1)";
    if (days <= 14) return "rgba(245, 158, 11, 0.1)";
    return "rgba(16, 185, 129, 0.1)";
  };

  const getStatusLabel = (days?: number) => {
    if (days === undefined) return "—";
    if (days < 0) return `Просрочен на ${Math.abs(days)} дн.`;
    if (days === 0) return "Истекает сегодня";
    if (days === 1) return "Остался 1 день";
    if (days <= 4) return `Осталось ${days} дня`;
    return `Осталось ${days} дн.`;
  };

  const getDeadlineTypeName = (d: Deadline) => {
    return d.deadline_type_name || deadlineTypes.find((t: DeadlineType) => t.id === d.deadline_type_id)?.type_name || "Без типа";
  };

  const modalBg = "var(--bg-primary)";
  const contentBg = "var(--bg-secondary)";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/60" onClick={onClose} />
        <div className="relative rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden" style={{ background: modalBg }}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-600 to-violet-700">
            <div className="text-white">
              <h3 className="text-lg font-semibold">{client.company_name || client.full_name}</h3>
              <p className="text-sm text-violet-200">ИНН: {client.inn || "не указан"}</p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded text-white"><X size={24} /></button>
          </div>

          {/* Tabs */}
          <div style={{ borderBottom: "1px solid var(--border-color)", background: modalBg }}>
            <div className="flex">
              <button onClick={() => setActiveTab("info")} className={clsx("px-6 py-3 font-medium text-sm border-b-2 transition-colors", activeTab === "info" ? "border-violet-600 text-violet-500" : "border-transparent")} style={activeTab !== "info" ? { color: "var(--text-muted)" } : {}}>Информация</button>
              <button onClick={() => setActiveTab("kkt")} className={clsx("px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2", activeTab === "kkt" ? "border-violet-600 text-violet-500" : "border-transparent")} style={activeTab !== "kkt" ? { color: "var(--text-muted)" } : {}}>
                <Package size={16} />ККТ <span className="badge badge-primary">{cashRegisters.length}</span>
              </button>
              <button onClick={() => setActiveTab("deadlines")} className={clsx("px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2", activeTab === "deadlines" ? "border-violet-600 text-violet-500" : "border-transparent")} style={activeTab !== "deadlines" ? { color: "var(--text-muted)" } : {}}>
                <Clock size={16} />Дедлайны <span className="badge badge-primary">{deadlines.length}</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]" style={{ background: modalBg }}>
            {activeTab === "info" && (
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3"><Building2 size={20} style={{ color: "var(--text-muted)" }} className="mt-0.5" /><div><p className="text-sm" style={{ color: "var(--text-muted)" }}>Компания</p><p className="font-medium" style={{ color: "var(--text-primary)" }}>{client.company_name || "—"}</p></div></div>
                  <div className="flex items-start gap-3"><Mail size={20} style={{ color: "var(--text-muted)" }} className="mt-0.5" /><div><p className="text-sm" style={{ color: "var(--text-muted)" }}>Email</p><p className="font-medium" style={{ color: "var(--text-primary)" }}>{client.email}</p></div></div>
                  <div className="flex items-start gap-3"><Phone size={20} style={{ color: "var(--text-muted)" }} className="mt-0.5" /><div><p className="text-sm" style={{ color: "var(--text-muted)" }}>Телефон</p><p className="font-medium" style={{ color: "var(--text-primary)" }}>{client.phone || "—"}</p></div></div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3"><MapPin size={20} style={{ color: "var(--text-muted)" }} className="mt-0.5" /><div><p className="text-sm" style={{ color: "var(--text-muted)" }}>Адрес</p><p className="font-medium" style={{ color: "var(--text-primary)" }}>{client.address || "—"}</p></div></div>
                  <div className="flex items-start gap-3"><Calendar size={20} style={{ color: "var(--text-muted)" }} className="mt-0.5" /><div><p className="text-sm" style={{ color: "var(--text-muted)" }}>Дата регистрации</p><p className="font-medium" style={{ color: "var(--text-primary)" }}>{client.registered_at ? format(new Date(client.registered_at), "dd.MM.yyyy", { locale: ru }) : "—"}</p></div></div>
                </div>
                {client.notes && <div className="col-span-2 p-4 rounded-lg" style={{ background: contentBg }}><p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>Примечания</p><p className="whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{client.notes}</p></div>}

                {/* Telegram Code Section */}
                <div className="col-span-2 p-4 rounded-lg" style={{ background: contentBg }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Key size={20} style={{ color: "var(--text-muted)" }} />
                      <div>
                        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Код для Telegram</p>
                        {telegramCode ? (
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-lg font-mono font-bold text-violet-500">{telegramCode}</code>
                            <button onClick={copyCode} className="p-1 rounded hover:bg-white/10" title="Копировать">
                              {codeCopied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} style={{ color: "var(--text-muted)" }} />}
                            </button>
                          </div>
                        ) : (
                          <p className="font-medium" style={{ color: "var(--text-primary)" }}>{client.telegram_id ? "Привязан" : "Не привязан"}</p>
                        )}
                      </div>
                    </div>
                    <button onClick={() => generateCodeMutation.mutate()} disabled={generateCodeMutation.isPending} className="btn btn-secondary flex items-center gap-2">
                      <Key size={16} />
                      {generateCodeMutation.isPending ? "Генерация..." : "Получить код"}
                    </button>
                  </div>
                </div>
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
                filteredCashRegisters.length === 0 ? <div className="text-center py-8" style={{ color: "var(--text-muted)" }}><Package size={48} className="mx-auto mb-2 opacity-50" /><p>{kktSearch ? "Ничего не найдено" : "Нет зарегистрированных ККТ"}</p></div> :
                <div className="space-y-4">
                  {filteredCashRegisters.map((kkt: CashRegister) => (
                    <div key={kkt.id} className="rounded-lg p-4 transition-colors cursor-pointer hover:shadow-lg" style={{ border: "1px solid var(--border-color)", background: contentBg }} onClick={() => setEditKkt(kkt)}>
                      <div className="flex justify-between items-start mb-2">
                        <div><p className="font-semibold" style={{ color: "var(--text-primary)" }}>{kkt.register_name || kkt.model || "ККТ #" + kkt.id}</p><p className="text-sm" style={{ color: "var(--text-muted)" }}>{kkt.installation_address || "Адрес не указан"}</p></div>
                        <div className="flex items-center gap-2">
                          <span className={clsx("badge", kkt.is_active ? "badge-success" : "badge-secondary")}>{kkt.is_active ? "Активна" : "Неактивна"}</span>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteKkt(kkt); }} className="p-1.5 rounded transition-colors hover:text-red-500" style={{ color: "var(--text-muted)" }} title="Удалить"><Trash2 size={16} /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div><span style={{ color: "var(--text-muted)" }}>Зав. номер:</span> <span style={{ color: "var(--text-secondary)" }}>{kkt.factory_number || "—"}</span></div>
                        <div><span style={{ color: "var(--text-muted)" }}>Рег. номер:</span> <span style={{ color: "var(--text-secondary)" }}>{kkt.registration_number || "—"}</span></div>
                        <div><span style={{ color: "var(--text-muted)" }}>ФН:</span> <span style={{ color: "var(--text-secondary)" }}>{kkt.fn_number || "—"}</span></div>
                      </div>
                      {getOfdProviderName(kkt.ofd_provider_id) && (
                        <div className="mt-2 text-sm">
                          <span style={{ color: "var(--text-muted)" }}>ОФД:</span> <span className="font-medium text-violet-500">{getOfdProviderName(kkt.ofd_provider_id)}</span>
                        </div>
                      )}
                      {(kkt.fn_expiry_date || kkt.ofd_expiry_date) && (
                        <div className="mt-3 pt-3 grid grid-cols-2 gap-4 text-sm" style={{ borderTop: "1px solid var(--border-color)" }}>
                          {kkt.fn_expiry_date && <div><span style={{ color: "var(--text-muted)" }}>ФН до:</span> <span className="font-medium" style={{ color: "var(--text-primary)" }}>{format(new Date(kkt.fn_expiry_date), "dd.MM.yyyy")}</span></div>}
                          {kkt.ofd_expiry_date && <div><span style={{ color: "var(--text-muted)" }}>ОФД до:</span> <span className="font-medium" style={{ color: "var(--text-primary)" }}>{format(new Date(kkt.ofd_expiry_date), "dd.MM.yyyy")}</span></div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>}
              </>
            )}

            {activeTab === "deadlines" && (
              <>
                <div className="flex justify-end mb-4">
                  <button onClick={() => setIsCreateDeadline(true)} className="btn btn-primary flex items-center gap-2"><Plus size={18} />Добавить дедлайн</button>
                </div>
                {deadlinesLoading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div> :
                deadlines.length === 0 ? <div className="text-center py-8" style={{ color: "var(--text-muted)" }}><Clock size={48} className="mx-auto mb-2 opacity-50" /><p>Нет активных дедлайнов</p></div> :
                <div className="space-y-3">
                  {deadlines.map((d: Deadline) => (
                    <div
                      key={d.id}
                      className="rounded-lg p-4 transition-all cursor-pointer hover:shadow-lg"
                      style={{
                        border: "1px solid var(--border-color)",
                        background: contentBg,
                        borderLeft: `4px solid ${getStatusColor(d.days_until_expiration)}`,
                      }}
                      onClick={() => setEditDeadline(d)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <Clock size={18} style={{ color: getStatusColor(d.days_until_expiration), flexShrink: 0 }} />
                            <h4 className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                              {getDeadlineTypeName(d)}
                            </h4>
                          </div>
                          <div className="flex items-center gap-4 ml-[30px]">
                            <div className="flex items-center gap-1.5 text-sm">
                              <Calendar size={14} style={{ color: "var(--text-muted)" }} />
                              <span style={{ color: "var(--text-secondary)" }}>
                                {format(new Date(d.expiration_date), "dd MMMM yyyy", { locale: ru })}
                              </span>
                            </div>
                            <span
                              className="text-xs font-semibold px-2.5 py-1 rounded-full"
                              style={{
                                color: getStatusColor(d.days_until_expiration),
                                background: getStatusBg(d.days_until_expiration),
                              }}
                            >
                              {getStatusLabel(d.days_until_expiration)}
                            </span>
                          </div>
                          {d.notes && (
                            <p className="text-sm mt-2 ml-[30px] truncate" style={{ color: "var(--text-muted)" }}>
                              {d.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditDeadline(d); }}
                            className="p-1.5 rounded transition-colors hover:text-violet-500"
                            style={{ color: "var(--text-muted)" }}
                            title="Редактировать"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteDeadline(d); }}
                            className="p-1.5 rounded transition-colors hover:text-red-500"
                            style={{ color: "var(--text-muted)" }}
                            title="Удалить"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Create KKT Modal */}
      {isCreateKkt && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60" onClick={() => setIsCreateKkt(false)} />
            <div className="relative rounded-xl shadow-2xl max-w-lg w-full" style={{ background: modalBg }}>
              <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
                <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Новая ККТ</h3>
                <button onClick={() => setIsCreateKkt(false)} className="p-1 rounded" style={{ color: "var(--text-muted)" }}><X size={20} /></button>
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
            <div className="fixed inset-0 bg-black/60" onClick={() => setEditKkt(null)} />
            <div className="relative rounded-xl shadow-2xl max-w-lg w-full" style={{ background: modalBg }}>
              <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
                <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Редактирование ККТ</h3>
                <button onClick={() => setEditKkt(null)} className="p-1 rounded" style={{ color: "var(--text-muted)" }}><X size={20} /></button>
              </div>
              <div className="p-4">
                <KktForm initialData={kktToFormData(editKkt)} onSubmit={handleUpdate} onCancel={() => setEditKkt(null)} isLoading={updateMutation.isPending} ofdProviders={ofdProviders} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Deadline Modal */}
      {isCreateDeadline && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60" onClick={() => setIsCreateDeadline(false)} />
            <div className="relative rounded-xl shadow-2xl max-w-md w-full" style={{ background: modalBg }}>
              <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
                <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Новый дедлайн</h3>
                <button onClick={() => setIsCreateDeadline(false)} className="p-1 rounded" style={{ color: "var(--text-muted)" }}><X size={20} /></button>
              </div>
              <div className="p-4">
                <DeadlineForm
                  deadlineTypes={deadlineTypes}
                  onSubmit={(data) => createDeadlineMutation.mutate({ ...data, user_id: client.id })}
                  onCancel={() => setIsCreateDeadline(false)}
                  isLoading={createDeadlineMutation.isPending}
                  mode="create"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Deadline Modal */}
      {editDeadline && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60" onClick={() => setEditDeadline(null)} />
            <div className="relative rounded-xl shadow-2xl max-w-md w-full" style={{ background: modalBg }}>
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-600 to-violet-700 rounded-t-xl">
                <div className="text-white">
                  <h3 className="text-lg font-semibold">Редактирование дедлайна</h3>
                  <p className="text-sm text-violet-200">{getDeadlineTypeName(editDeadline)}</p>
                </div>
                <button onClick={() => setEditDeadline(null)} className="p-1 hover:bg-white/20 rounded text-white"><X size={20} /></button>
              </div>
              <div className="p-4">
                <DeadlineForm
                  key={editDeadline.id}
                  deadlineTypes={deadlineTypes}
                  initialData={deadlineToFormData(editDeadline)}
                  onSubmit={handleUpdateDeadline}
                  onCancel={() => setEditDeadline(null)}
                  isLoading={updateDeadlineMutation.isPending}
                  mode="edit"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Deadline Confirmation */}
      {deleteDeadline && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60" onClick={() => setDeleteDeadline(null)} />
            <div className="relative rounded-xl shadow-2xl max-w-sm w-full p-6" style={{ background: modalBg }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/20 rounded-full"><AlertCircle className="text-red-500" size={24} /></div>
                <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Удалить дедлайн?</h3>
              </div>
              <p style={{ color: "var(--text-secondary)" }} className="mb-2">
                Вы уверены, что хотите удалить дедлайн <strong>{getDeadlineTypeName(deleteDeadline)}</strong>?
              </p>
              <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>
                Дата: {format(new Date(deleteDeadline.expiration_date), "dd.MM.yyyy")}
              </p>
              <p className="text-sm text-red-500 mb-6">Это действие нельзя отменить.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteDeadline(null)} className="btn btn-secondary">Отмена</button>
                <button onClick={() => deleteDeadlineMutation.mutate(deleteDeadline.id)} disabled={deleteDeadlineMutation.isPending} className="btn bg-red-600 text-white hover:bg-red-700">
                  {deleteDeadlineMutation.isPending ? "Удаление..." : "Удалить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete KKT Confirmation */}
      {deleteKkt && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60" onClick={() => setDeleteKkt(null)} />
            <div className="relative rounded-xl shadow-2xl max-w-sm w-full p-6" style={{ background: modalBg }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/20 rounded-full"><AlertCircle className="text-red-500" size={24} /></div>
                <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Удалить ККТ?</h3>
              </div>
              <p style={{ color: "var(--text-secondary)" }} className="mb-2">Вы уверены, что хотите удалить кассу <strong>{deleteKkt.register_name || deleteKkt.model || "ККТ #" + deleteKkt.id}</strong>?</p>
              <p className="text-sm text-red-500 mb-6">Все связанные дедлайны также будут удалены.</p>
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
