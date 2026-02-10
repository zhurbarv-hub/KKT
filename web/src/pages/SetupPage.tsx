import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Mail, Lock, User, AlertCircle, Loader2, CheckCircle } from "lucide-react";
import { setupApi } from "../services/api";

export default function SetupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== passwordConfirm) {
      setError("Пароли не совпадают");
      return;
    }
    if (password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }

    setIsLoading(true);
    try {
      await setupApi.createAdmin({ email, password, full_name: fullName });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Ошибка при создании администратора");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)" }}>
        <div className="w-full max-w-md relative z-10">
          <div className="rounded-3xl shadow-2xl overflow-hidden" style={{ background: "white" }}>
            <div className="px-8 py-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: "#d1fae5" }}>
                <CheckCircle className="h-8 w-8" style={{ color: "#059669" }} />
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: "#111827" }}>Система настроена!</h2>
              <p className="mb-2" style={{ color: "#6b7280" }}>Администратор создан. Перенаправление на страницу входа...</p>
              <div className="mt-4">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" style={{ color: "#059669" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Первоначальная настройка</h1>
            <p className="mt-2 text-white/80">Создайте аккаунт администратора системы</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5" style={{ background: "white" }}>
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium mb-2" style={{ color: "#374151" }}>ФИО</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: "#9ca3af" }} />
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 pl-12 rounded-xl outline-none transition-all"
                  style={{ background: "#f3f4f6", border: "2px solid #e5e7eb", color: "#111827" }}
                  onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.background = "#fff"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f3f4f6"; }}
                  placeholder="Иванов Иван Иванович"
                  required
                  minLength={2}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: "#374151" }}>Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: "#9ca3af" }} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 pl-12 rounded-xl outline-none transition-all"
                  style={{ background: "#f3f4f6", border: "2px solid #e5e7eb", color: "#111827" }}
                  onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.background = "#fff"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f3f4f6"; }}
                  placeholder="admin@company.ru"
                  required
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
                  placeholder="Минимум 6 символов"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium mb-2" style={{ color: "#374151" }}>Подтверждение пароля</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: "#9ca3af" }} />
                <input
                  id="passwordConfirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="w-full px-4 py-3 pl-12 rounded-xl outline-none transition-all"
                  style={{ background: "#f3f4f6", border: "2px solid #e5e7eb", color: "#111827" }}
                  onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; e.target.style.background = "#fff"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f3f4f6"; }}
                  placeholder="Повторите пароль"
                  required
                  minLength={6}
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
              {isLoading ? (<><Loader2 className="h-5 w-5 animate-spin" /><span>Создание...</span></>) : <span>Создать администратора</span>}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Первоначальная настройка системы</p>
      </div>
    </div>
  );
}
