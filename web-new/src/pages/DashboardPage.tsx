import { useQuery } from "@tanstack/react-query";
import { dashboardApi, deadlinesApi } from "../services/api";
import { Users, Clock, AlertTriangle, AlertCircle, CheckCircle, Printer, TrendingUp } from "lucide-react";
import clsx from "clsx";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: "primary" | "success" | "warning" | "danger" | "info";
  subtitle?: string;
}

function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  const colorClasses = {
    primary: { card: "stat-card-primary", icon: "from-violet-400 to-violet-600", text: "text-violet-500" },
    success: { card: "stat-card-success", icon: "from-emerald-400 to-emerald-600", text: "text-emerald-500" },
    warning: { card: "stat-card-warning", icon: "from-amber-400 to-amber-600", text: "text-amber-500" },
    danger: { card: "stat-card-danger", icon: "from-red-400 to-red-600", text: "text-red-500" },
    info: { card: "stat-card-info", icon: "from-blue-400 to-blue-600", text: "text-blue-500" },
  };

  return (
    <div className={clsx("stat-card hover:shadow-lg hover:-translate-y-1 transition-all duration-300", colorClasses[color].card)}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{title}</p>
          <p className={clsx("text-3xl font-bold", colorClasses[color].text)}>{value}</p>
          {subtitle && <p className="text-sm" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
        </div>
        <div className={clsx("p-3 rounded-xl bg-gradient-to-br shadow-lg", colorClasses[color].icon)}>
          <span className="text-white">{icon}</span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: dashboardApi.getStats,
    refetchInterval: 60000,
  });

  const { data: allDeadlines, isLoading: deadlinesLoading } = useQuery({
    queryKey: ["all-deadlines-dashboard"],
    queryFn: () => deadlinesApi.list(),
    refetchInterval: 60000,
  });

  const urgentDeadlines = allDeadlines
    ?.filter(d => d.days_until_expiration !== undefined && d.days_until_expiration <= 30)
    ?.sort((a, b) => (a.days_until_expiration ?? 0) - (b.days_until_expiration ?? 0)) || [];

  const getStatusColor = (days: number | undefined) => {
    if (days === undefined) return "var(--text-muted)";
    if (days < 0) return "#ef4444";
    if (days <= 7) return "#f87171";
    if (days <= 14) return "#f59e0b";
    if (days <= 30) return "#f97316";
    return "#10b981";
  };

  const getStatusBadge = (days: number | undefined) => {
    if (days === undefined) return null;
    if (days < 0) return <span className="badge badge-danger">Просрочено</span>;
    if (days <= 7) return <span className="badge badge-danger">Срочно</span>;
    if (days <= 14) return <span className="badge badge-warning">Внимание</span>;
    if (days <= 30) return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Скоро</span>;
    return <span className="badge badge-success">Норма</span>;
  };

  const formatDays = (days: number | undefined) => {
    if (days === undefined) return "—";
    if (days < 0) return `${Math.abs(days)} дн. назад`;
    return `${days} дн.`;
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
          <TrendingUp className="text-violet-500" />
          Панель управления
        </h1>
        <p style={{ color: "var(--text-secondary)" }} className="mt-1">Обзор состояния дедлайнов и клиентов</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Всего клиентов" value={stats?.total_clients || 0} icon={<Users size={24} />} color="primary" subtitle={`Активных: ${stats?.active_clients || 0}`} />
        <StatCard title="Всего дедлайнов" value={stats?.total_deadlines || 0} icon={<Clock size={24} />} color="info" />
        <StatCard title="Всего касс" value={stats?.total_cash_registers || 0} icon={<Printer size={24} />} color="success" />
        <StatCard title="Истекает скоро" value={(stats?.status_red || 0) + (stats?.status_yellow || 0)} icon={<AlertTriangle size={24} />} color="warning" subtitle="До 14 дней" />
        <StatCard title="Просрочено" value={stats?.status_expired || 0} icon={<AlertCircle size={24} />} color="danger" subtitle="Требуют продления" />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Дедлайны до 30 дней</h2>
          <span className="badge badge-primary">{urgentDeadlines.length} записей</span>
        </div>

        {deadlinesLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-600 border-t-transparent" />
          </div>
        ) : urgentDeadlines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32" style={{ color: "var(--text-muted)" }}>
            <CheckCircle size={40} className="text-emerald-500 mb-3" />
            <p className="font-medium">Нет дедлайнов в ближайшие 30 дней</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="table-modern">
              <thead>
                <tr>
                  <th className="pl-6">Клиент</th>
                  <th>Тип услуги</th>
                  <th>Дата истечения</th>
                  <th>Осталось</th>
                  <th className="pr-6">Статус</th>
                </tr>
              </thead>
              <tbody>
                {urgentDeadlines.map((deadline) => (
                  <tr key={deadline.id} className={clsx(
                    deadline.days_until_expiration !== undefined && deadline.days_until_expiration < 0 && "bg-red-500/10"
                  )}>
                    <td className="pl-6">
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {deadline.client?.company_name || deadline.client?.full_name || "Не указан"}
                      </span>
                    </td>
                    <td>{deadline.deadline_type?.type_name || "Не указан"}</td>
                    <td>{format(new Date(deadline.expiration_date), "dd.MM.yyyy", { locale: ru })}</td>
                    <td className="font-semibold" style={{ color: getStatusColor(deadline.days_until_expiration) }}>
                      {formatDays(deadline.days_until_expiration)}
                    </td>
                    <td className="pr-6">{getStatusBadge(deadline.days_until_expiration)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
