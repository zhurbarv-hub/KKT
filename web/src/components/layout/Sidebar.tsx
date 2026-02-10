import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import {
  LayoutDashboard, Users, Clock, Tag, UserCog, Download,
  HelpCircle, Database, LogOut, Menu, X, Sun, Moon, Cloud,
} from "lucide-react";
import { useState, useEffect } from "react";
import clsx from "clsx";
import { setupApi } from "../../services/api";

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

function NavItem({ to, icon, label, onClick }: NavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        clsx(
          "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
          isActive
            ? "bg-gradient-to-r from-violet-500/20 to-violet-600/10 text-violet-600 font-medium shadow-sm"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
        )
      }
    >
      <span className="transition-transform duration-300 group-hover:scale-110">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export default function Sidebar() {
  const { user, logout, isAdmin, isManager } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [companyName, setCompanyName] = useState("KKT System");

  useEffect(() => {
    setupApi.getSettings().then((s) => setCompanyName(s.company_name)).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const closeMobile = () => setIsMobileOpen(false);

  const navItems = [
    { to: "/", icon: <LayoutDashboard size={20} />, label: "Статистика" },
    { to: "/users", icon: <Users size={20} />, label: "Клиенты" },
    { to: "/deadlines", icon: <Clock size={20} />, label: "Дедлайны" },
    { to: "/deadline-types", icon: <Tag size={20} />, label: "Типы услуг" },
  ];

  const adminItems = [
    { to: "/managers", icon: <UserCog size={20} />, label: "Пользователи" },
    { to: "/export", icon: <Download size={20} />, label: "Экспорт" },
    { to: "/support", icon: <HelpCircle size={20} />, label: "Обращения" },
  ];

  const superAdminItems = [
    { to: "/database", icon: <Database size={20} />, label: "База данных" },
    { to: "/system", icon: <Cloud size={20} />, label: "Система" },
  ];

  return (
    <>
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl shadow-lg"
        style={{ background: "var(--bg-card)" }}
      >
        <Menu size={22} style={{ color: "var(--text-primary)" }} />
      </button>

      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={closeMobile} />
      )}

      <aside className={clsx(
        "fixed lg:static inset-y-0 left-0 z-50 w-72 sidebar flex flex-col transition-transform duration-300 lg:translate-x-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-glow">
              <span className="text-white font-bold text-lg">{companyName.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{companyName}</h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Панель управления</p>
            </div>
          </div>
          <button onClick={closeMobile} className="lg:hidden p-2 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
            <X size={20} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} onClick={closeMobile} />
          ))}

          {isManager && (
            <>
              <div className="pt-6 pb-2 px-4">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Управление</span>
              </div>
              {adminItems.map((item) => (
                <NavItem key={item.to} {...item} onClick={closeMobile} />
              ))}
            </>
          )}

          {isAdmin && (
            <>
              <div className="pt-6 pb-2 px-4">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Администрирование</span>
              </div>
              {superAdminItems.map((item) => (
                <NavItem key={item.to} {...item} onClick={closeMobile} />
              ))}
            </>
          )}
        </nav>

        <div className="p-4" style={{ borderTop: "1px solid var(--border-color)" }}>
          <div className="flex items-center gap-3 p-3 rounded-xl mb-3" style={{ background: "var(--bg-secondary)" }}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center">
              <span className="text-white font-semibold">{user?.full_name?.charAt(0).toUpperCase() || "U"}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{user?.full_name || "Пользователь"}</p>
              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                {user?.role === "admin" ? "Администратор" : user?.role === "manager" ? "Менеджер" : "Клиент"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all hover:bg-red-50 hover:text-red-600"
              style={{ color: "var(--text-secondary)" }}
            >
              <LogOut size={18} />
              <span>Выйти</span>
            </button>
            
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl transition-all duration-300 hover:scale-110"
              style={{ background: "var(--bg-secondary)" }}
              title={isDark ? "Светлая тема" : "Тёмная тема"}
            >
              {isDark ? (
                <Sun size={20} className="text-amber-400" />
              ) : (
                <Moon size={20} className="text-violet-500" />
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
