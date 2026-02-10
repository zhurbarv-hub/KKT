import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Lock, User, AlertCircle, Loader2 } from "lucide-react";
import { setupApi } from "../services/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("KKT System");

  useEffect(() => {
    setupApi.getSettings().then((s) => setCompanyName(s.company_name)).catch(() => {});
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    const success = await login(username, password);
    if (success) navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%)" }}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl" style={{ background: "rgba(167, 139, 250, 0.3)" }} />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl" style={{ background: "rgba(139, 92, 246, 0.3)" }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="rounded-3xl shadow-2xl overflow-hidden" style={{ background: "white" }}>
          <div className="px-8 py-10 text-center" style={{ background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" }}>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 shadow-lg mb-4">
              <span className="text-white font-bold text-2xl">{companyName.charAt(0).toUpperCase()}</span>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">{companyName}</h1>
            <p className="mt-2 text-white/80">Система управления дедлайнами ККТ</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5" style={{ background: "white" }}>
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2" style={{ color: "#374151" }}>Логин</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: "#9ca3af" }} />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 pl-12 rounded-xl outline-none transition-all"
                  style={{ background: "#f3f4f6", border: "2px solid #e5e7eb", color: "#111827" }}
                  onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.background = "#fff"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f3f4f6"; }}
                  placeholder="Введите логин"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: "#374151" }}>Пароль</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: "#9ca3af" }} />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pl-12 rounded-xl outline-none transition-all"
                  style={{ background: "#f3f4f6", border: "2px solid #e5e7eb", color: "#111827" }}
                  onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.background = "#fff"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f3f4f6"; }}
                  placeholder="Введите пароль"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-4 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 font-semibold rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)", color: "white" }}
            >
              {isLoading ? (<><Loader2 className="h-5 w-5 animate-spin" /><span>Вход...</span></>) : <span>Войти в систему</span>}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{companyName}</p>
      </div>
    </div>
  );
}
