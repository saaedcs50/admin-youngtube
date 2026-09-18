import React from 'react';
import {
  Download,
  LogOut,
  Moon,
  RefreshCw,
  Sun,
  Tv,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { TabType } from '../types';

interface HeaderProps {
  activeTab: TabType;
  workerUrl: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  workerStatusText?: string;
  isWorkerHealthy?: boolean;
}

const TAB_TITLES: Record<TabType, { title: string; subtitle: string }> = {
  telemetry: {
    title: 'تحليلات وإحصائيات الاستخدام',
    subtitle: 'متابعة جلسات الأطفال والأهل وتوزيع الدول والتشغيل الفعلي',
  },
  blocks: {
    title: 'قوائم الحظر الشامل',
    subtitle: 'إدارة حظر القنوات وقوائم التشغيل على مستوى الخادم بالكامل',
  },
  channels: {
    title: 'القنوات وقوائم التشغيل',
    subtitle: 'إضافة ومزامنة المصادر المعتمدة للأطفال',
  },
  announcements: {
    title: 'التنبيهات والإعلانات',
    subtitle: 'نشر رسائل وتنبيهات فورية للمستخدمين وأولياء الأمور',
  },
  status: {
    title: 'حالة الخادم والبنية التحتية',
    subtitle: 'فحص صحة الـ Worker وسرعة الاستجابة وذاكرة التخزين المؤقت',
  },
  settings: {
    title: 'إعدادات النظام والاتصال',
    subtitle: 'تعديل رابط الـ Worker ومفتاح المشرف والتحكم بالبيئة',
  },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  workerUrl,
  isRefreshing,
  onRefresh,
  isDark,
  onToggleTheme,
  onLogout,
  workerStatusText = 'متصل',
  isWorkerHealthy = true,
}) => {
  const { isInstallable, install, isIOS } = usePWAInstall();
  const currentTabInfo = TAB_TITLES[activeTab] || {
    title: 'لوحة التحكم',
    subtitle: 'YoungTube Admin',
  };

  return (
    <header
      id="main-header"
      className="sticky top-0 z-30 flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors"
    >
      {/* Title & Worker indicator */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              {currentTabInfo.title}
            </h1>
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                isWorkerHealthy
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
              }`}
              title={workerUrl}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isWorkerHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="hidden sm:inline">الـ Worker:</span>
              <span className="font-mono text-[11px]">{workerStatusText}</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 hidden sm:block">
            {currentTabInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 self-end md:self-auto">
        {/* PWA Install Button */}
        {isInstallable && (
          <button
            id="pwa-install-header-btn"
            onClick={install}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="تثبيت التطبيق على جهازك (PWA)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تثبيت PWA</span>
          </button>
        )}

        {/* Refresh button */}
        <button
          id="header-refresh-btn"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          title="تحديث البيانات يدويًا"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-500' : ''}`} />
          <span className="hidden sm:inline">تحديث</span>
        </button>

        {/* Theme toggle */}
        <button
          id="header-theme-toggle-btn"
          onClick={onToggleTheme}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          title={isDark ? 'التحويل للوضع الفاتح' : 'التحويل للوضع الليلي'}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Logout button */}
        <button
          id="header-logout-btn"
          onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
          title="تسجيل الخروج"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">خروج</span>
        </button>
      </div>
    </header>
  );
};
