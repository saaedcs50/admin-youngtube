import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Github,
  Globe,
  HardDrive,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Moon,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
  Sun,
  Terminal,
  Trash2,
} from 'lucide-react';
import {
  clearAdminKey,
  DEFAULT_WORKER_URL,
  getAdminKey,
  getWorkerUrl,
  isRemembered,
  resetWorkerUrl,
  saveAdminKey,
  setWorkerUrl,
  validateAdminKey,
} from '../services/api';

interface SettingsViewProps {
  onNotify: (type: 'success' | 'error' | 'info' | 'warning', title: string, desc?: string) => void;
  onLogout: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onNotify,
  onLogout,
  isDark,
  onToggleTheme,
}) => {
  const [workerUrlInput, setWorkerUrlInput] = useState<string>(getWorkerUrl());
  const [rememberDevice, setRememberDevice] = useState<boolean>(isRemembered());
  const [isTestingUrl, setIsTestingUrl] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Masked admin key viewer
  const currentKey = getAdminKey() || '';
  const maskedKey = currentKey
    ? `${currentKey.slice(0, 4)}••••••••${currentKey.slice(-3)}`
    : 'غير متوفر';

  const handleSaveWorkerUrl = () => {
    const clean = workerUrlInput.trim().replace(/\/+$/, '');
    if (!clean) {
      onNotify('warning', 'الرابط مطلوب', 'الرجاء إدخال رابط صالح لخادم الـ Worker');
      return;
    }
    setWorkerUrl(clean);
    onNotify('success', 'تم حفظ الرابط', `تم تحديث رابط الـ Worker إلى: ${clean}`);
  };

  const handleResetWorkerUrl = () => {
    resetWorkerUrl();
    setWorkerUrlInput(DEFAULT_WORKER_URL);
    onNotify('info', 'تمت الاستعادة', 'تمت استعادة رابط الـ Worker الافتراضي');
  };

  const handleTestConnection = async () => {
    setIsTestingUrl(true);
    setTestResult(null);
    try {
      if (!currentKey) {
        throw new Error('لا يوجد مفتاح مشرف مسجل للفحص');
      }
      await validateAdminKey(currentKey, workerUrlInput);
      setTestResult({
        ok: true,
        message: 'الاتصال والمصادقة يعملان بنجاح (200 OK)',
      });
      onNotify('success', 'الاتصال سليم', 'تم التحقق من الـ Worker ومفتاح المشرف بنجاح');
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err?.message || 'فشل الاتصال بالخادم',
      });
      onNotify('error', 'فشل التحقق', err?.message || 'تأكد من الرابط أو المفتاح');
    } finally {
      setIsTestingUrl(false);
    }
  };

  const handleToggleRemember = (checked: boolean) => {
    setRememberDevice(checked);
    if (currentKey) {
      saveAdminKey(currentKey, checked);
      onNotify(
        'info',
        checked ? 'تم تفعيل التذكر' : 'تم إلغاء التذكر',
        checked
          ? 'تم حفظ المفتاح في التخزين الدائم (localStorage)'
          : 'تم قصر المفتاح على الجلسة فقط (sessionStorage)'
      );
    }
  };

  return (
    <div id="settings-view-container" className="space-y-6 max-w-4xl mx-auto">
      {/* 1. Worker URL Configuration Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              رابط الـ Worker (Cloudflare Workers)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              يُحفظ ويُعدل محلياً في المتصفح تحت مفتاح <code className="font-mono">localStorage: worker_url</code>
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            رابط الخادم النشط
          </label>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              id="settings-worker-url-input"
              type="url"
              dir="ltr"
              value={workerUrlInput}
              onChange={(e) => setWorkerUrlInput(e.target.value)}
              className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              placeholder="https://..."
            />
            <button
              onClick={handleSaveWorkerUrl}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>حفظ الرابط</span>
            </button>
            <button
              onClick={handleResetWorkerUrl}
              title="استعادة الافتراضي"
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>الافتراضي</span>
            </button>
          </div>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              testResult.ok
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <span className="text-[11px] text-slate-400">
            الافتراضي: <code className="font-mono">{DEFAULT_WORKER_URL}</code>
          </span>
          <button
            onClick={handleTestConnection}
            disabled={isTestingUrl}
            className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold cursor-pointer disabled:opacity-50"
          >
            {isTestingUrl && <Loader2 className="w-3 h-3 animate-spin" />}
            <span>اختبار الاتصال والمصادقة</span>
          </button>
        </div>
      </div>

      {/* 2. Authentication & Storage Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              أمان ومصادقة المشرف (ADMIN_KEY)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              يُرسل في ترويسة الطلب: <code className="font-mono">Authorization: Bearer &lt;ADMIN_KEY&gt;</code>
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400 font-medium">المفتاح النشط حالياً:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{maskedKey}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700/60">
            <label
              htmlFor="settings-remember-checkbox"
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <input
                id="settings-remember-checkbox"
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => handleToggleRemember(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 border-slate-300 dark:border-slate-700 focus:ring-amber-400 focus:ring-offset-0 bg-white dark:bg-slate-900 cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                تذكر على هذا الجهاز (نسخ إلى localStorage)
              </span>
            </label>
            <span className="text-[11px] text-slate-400">
              {rememberDevice ? 'محفوظ في localStorage' : 'محفوظ في sessionStorage فقط'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-slate-400 max-w-sm">
            عند استقبال استجابة 401، يتم مسح المفاتيح تلقائياً والعودة لشاشة الدخول لحماية الجلسة.
          </p>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs font-bold transition cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>تسجيل الخروج ومسح المفتاح</span>
          </button>
        </div>
      </div>

      {/* 3. Appearance & Preferences */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              المظهر (Theme Mode)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              التبديل بين الوضع الليلي (Dark) والوضع الفاتح (Light)
            </p>
          </div>
        </div>

        <button
          onClick={onToggleTheme}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 transition cursor-pointer"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          <span>{isDark ? 'الوضع الليلي مفعّل' : 'الوضع الفاتح مفعّل'}</span>
        </button>
      </div>

      {/* 4. Deployment to GitHub & Vercel Guide */}
      <div className="p-6 rounded-2xl bg-slate-900 text-slate-100 border border-slate-800 shadow-md space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-800 text-amber-400">
            <Github className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">
              جاهزية النشر على GitHub ثم Vercel
            </h3>
            <p className="text-xs text-slate-400">
              هذا المشروع SPA مستقل تماماً يُبنى بـ Vite دون أي استيراد من تطبيق الأطفال
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <Terminal className="w-4 h-4" />
            <span>خطوات الرفع على GitHub و Vercel:</span>
          </div>
          <p className="text-slate-400 font-sans">
            1. قم بتنزيل المشروع أو تصديره عبر القائمة إلى مستودع GitHub جديد باسم <code className="text-white">admin-youngtube</code>
          </p>
          <p className="text-slate-400 font-sans">
            2. في Vercel، اضغط <strong>Add New Project</strong> واختر المستودع.
          </p>
          <p className="text-slate-400 font-sans">
            3. الإعدادات الافتراضية لـ Vite جاهزة تماماً: <code className="text-white">npm run build</code> والمجلد الناتج <code className="text-white">dist</code>.
          </p>
          <p className="text-slate-400 font-sans">
            4. أضف متغير البيئة (اختياري) في Vercel:
            <br />
            <code className="text-emerald-400 block mt-1 p-2 bg-slate-900 rounded">
              VITE_WORKER_URL=https://youngtube-worker.saaedbelal.workers.dev
            </code>
          </p>
          <p className="text-slate-400 font-sans">
            5. لا تقم أبداً بإضافة <code className="text-rose-400">ADMIN_KEY</code> في متغيرات البيئة العامة؛ يدخله المشرف شخصياً عند تسجيل الدخول ليُحفظ في المتصفح فقط.
          </p>
        </div>
      </div>
    </div>
  );
};
