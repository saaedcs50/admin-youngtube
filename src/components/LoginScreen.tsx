import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
  Tv,
} from 'lucide-react';
import {
  DEFAULT_WORKER_URL,
  getWorkerUrl,
  resetWorkerUrl,
  saveAdminKey,
  setWorkerUrl,
  validateAdminKey,
} from '../services/api';

interface LoginScreenProps {
  onLoginSuccess: (adminKey: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [adminKey, setAdminKeyInput] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Worker URL configuration state
  const [workerUrl, setWorkerUrlState] = useState<string>(getWorkerUrl());
  const [showWorkerConfig, setShowWorkerConfig] = useState(false);
  const [isTestingUrl, setIsTestingUrl] = useState(false);
  const [urlTestStatus, setUrlTestStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = adminKey.trim();
    if (!cleanKey) {
      setErrorMessage('الرجاء إدخال مفتاح المشرف (ADMIN_KEY)');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Verify via GET /api/admin/status
      const statusRes = await validateAdminKey(cleanKey, workerUrl);
      
      // 2. Save worker URL if changed
      setWorkerUrl(workerUrl);

      // 3. Save key to storage (sessionStorage always, localStorage if rememberMe)
      saveAdminKey(cleanKey, rememberMe);

      setSuccessMessage('تم التحقق بنجاح! جاري الدخول للوحة التحكم...');

      setTimeout(() => {
        onLoginSuccess(cleanKey);
      }, 400);
    } catch (err: any) {
      console.error('Login error:', err);
      const msg = err?.message || 'فشل تسجيل الدخول';
      if (msg.includes('401')) {
        setErrorMessage('مفتاح المشرف (ADMIN_KEY) غير صحيح. تحقق من المفتاح وحاول مجدداً.');
      } else {
        setErrorMessage(`${msg}. تأكد من صحة رابط الـ Worker والاتصال بالإنترنت.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestWorker = async () => {
    setIsTestingUrl(true);
    setUrlTestStatus(null);
    try {
      const sanitized = workerUrl.trim().replace(/\/+$/, '');
      const response = await fetch(`${sanitized}/api/admin/status`, {
        method: 'GET',
      });
      // 401 is actually a good sign that the endpoint exists and requires auth!
      if (response.status === 401 || response.ok) {
        setUrlTestStatus({
          ok: true,
          message: 'الخادم متصل ويعمل بصورة صحيحة (يستجيب للمصادقة)',
        });
      } else {
        setUrlTestStatus({
          ok: false,
          message: `استجاب الخادم برمز الحالة ${response.status}`,
        });
      }
    } catch (err: any) {
      setUrlTestStatus({
        ok: false,
        message: `تعذر الاتصال: ${err?.message || 'تحقق من الرابط أو CORS'}`,
      });
    } finally {
      setIsTestingUrl(false);
    }
  };

  const handleResetWorker = () => {
    resetWorkerUrl();
    setWorkerUrlState(DEFAULT_WORKER_URL);
    setUrlTestStatus(null);
  };

  return (
    <div
      id="login-screen-wrapper"
      className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 transition-colors"
    >
      <div
        id="login-card"
        className="w-full max-w-md bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-2xl backdrop-blur-xl"
      >
        {/* App Emblem & Title */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-lg shadow-red-500/25 mb-4">
            <Tv className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            admin-youngtube
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            لوحة الإدارة والتحليلات المستقلة لمنصة YoungTube للأطفال
          </p>
        </div>

        {/* Feedback banners */}
        {errorMessage && (
          <div
            id="login-error-banner"
            className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div
            id="login-success-banner"
            className="mb-5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{successMessage}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="admin-key-input"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2"
            >
              مفتاح المشرف (ADMIN_KEY)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="admin-key-input"
                type={showKey ? 'text' : 'password'}
                dir="ltr"
                value={adminKey}
                onChange={(e) => setAdminKeyInput(e.target.value)}
                placeholder="أدخل الـ ADMIN_KEY السري..."
                required
                disabled={isLoading}
                className="w-full pr-10 pl-11 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title={showKey ? 'إخفاء المفتاح' : 'إظهار المفتاح'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              يُحفظ المفتاح محلياً في المتصفح فقط ويُرسل مشفراً عبر Bearer Token
            </p>
          </div>

          {/* Remember me option */}
          <div className="flex items-center justify-between py-1">
            <label
              htmlFor="remember-me-checkbox"
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <input
                id="remember-me-checkbox"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 border-slate-300 dark:border-slate-700 focus:ring-amber-400 focus:ring-offset-0 bg-slate-50 dark:bg-slate-800 cursor-pointer"
              />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                تذكر على هذا الجهاز (نسخ إلى التخزين الدائم)
              </span>
            </label>
          </div>

          {/* Submit button */}
          <button
            id="login-submit-btn"
            type="submit"
            disabled={isLoading || !adminKey.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري التحقق عبر /api/admin/status...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>تسجيل الدخول والتحقق</span>
              </>
            )}
          </button>
        </form>

        {/* Worker URL Accordion */}
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
          <button
            id="toggle-worker-config-btn"
            type="button"
            onClick={() => setShowWorkerConfig(!showWorkerConfig)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-amber-500" />
              <span>إعدادات رابط الـ Worker (اختياري)</span>
            </div>
            <span className="text-[11px] underline">
              {showWorkerConfig ? 'إخفاء' : 'تعديل'}
            </span>
          </button>

          {showWorkerConfig && (
            <div className="mt-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  رابط الـ Worker (Cloudflare)
                </label>
                <input
                  id="login-worker-url-input"
                  type="url"
                  dir="ltr"
                  value={workerUrl}
                  onChange={(e) => setWorkerUrlState(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {urlTestStatus && (
                <div
                  className={`p-2 rounded-lg text-[11px] flex items-center gap-1.5 ${
                    urlTestStatus.ok
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {urlTestStatus.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{urlTestStatus.message}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestWorker}
                  disabled={isTestingUrl || !workerUrl}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-[11px] font-semibold text-slate-800 dark:text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isTestingUrl && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>اختبار الاتصال</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetWorker}
                  title="استعادة الرابط الافتراضي"
                  className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Security Notice */}
        <div className="mt-5 text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            <Lock className="w-3 h-3" />
            <span>اتصال محمي ومشفر عبر Cloudflare Workers</span>
          </div>
        </div>
      </div>
    </div>
  );
};
