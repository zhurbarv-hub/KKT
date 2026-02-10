import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useTheme } from "../../hooks/useTheme";
import { useEffect } from "react";

export default function MainLayout() {
  const { isDark } = useTheme();
  
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <div className="flex h-screen" style={{ background: "linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)" }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
