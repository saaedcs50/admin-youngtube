import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  Baby,
  Calendar,
  Clock,
  Download,
  Flame,
  Globe2,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { fetchTelemetry } from '../services/api';
import { TelemetryCountry, TelemetryDaily, TelemetryData, TimeRangeDays } from '../types';
import { formatDuration, formatNumber, formatTimestamp, getCountryInfo } from '../utils/formatters';

interface TelemetryViewProps {
  onNotify: (type: 'success' | 'error' | 'info' | 'warning', title: string, desc?: string) => void;
}

type SortColumn = 'name' | 'parentSessions' | 'parentDuration' | 'childSessions' | 'childDuration' | 'unique';
type SortDirection = 'asc' | 'desc';

export const TelemetryView: React.FC<TelemetryViewProps> = ({ onNotify }) => {
  const [days, setDays] = useState<TimeRangeDays>(7);
  const [data, setData] = useState<TelemetryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Search & Filter state for country table
  const [countrySearch, setCountrySearch] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('childDuration');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showRawJson, setShowRawJson] = useState(false);

  const loadData = async (selectedDays: TimeRangeDays = days) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchTelemetry(selectedDays);
      setData(res);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error fetching telemetry:', err);
      const msg = err?.message || 'فشل تحميل بيانات الإحصائيات';
      setError(msg);
      onNotify('error', 'خطأ في تحميل الإحصائيات', msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(days);
  }, [days]);

  // Extract totals with multi-key fallbacks
  const parentSessions =
    data?.parentSessionsTotal ??
    data?.parent_sessions ??
    data?.parentSessions ??
    data?.parent?.sessions ??
    0;
  const parentDuration =
    data?.parentDurationSecTotal ??
    data?.parent_duration ??
    data?.parentDuration ??
    data?.parentDurationSec ??
    data?.parent?.duration ??
    0;

  const childSessions =
    data?.childSessionsTotal ??
    data?.child_sessions ??
    data?.childSessions ??
    data?.child?.sessions ??
    0;
  const childDuration =
    data?.childDurationSecTotal ??
    data?.child_duration ??
    data?.childDuration ??
    data?.childDurationSec ??
    data?.child?.duration ??
    0;

  const uniqueCount =
    data?.totalUniqueInstalls ??
    data?.uniqueInstallsTotal ??
    data?.unique_users ??
    data?.uniqueUsers ??
    data?.unique_devices ??
    data?.unique ??
    data?.total_unique ??
    undefined;

  // Extract countries list
  const rawCountries: TelemetryCountry[] = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data.countries) && data.countries.length > 0) return data.countries;
    if (Array.isArray(data.by_country) && data.by_country.length > 0) return data.by_country;
    if (Array.isArray(data.geo) && data.geo.length > 0) return data.geo;
    return [];
  }, [data]);

  // Filtered and sorted countries
  const processedCountries = useMemo(() => {
    let result = rawCountries.map((c) => {
      const info = getCountryInfo(c.country || c.code || c.country_code || c.name);
      const pSessions = c.parent_sessions ?? c.parentSessions ?? 0;
      const pDuration = c.parent_duration ?? c.parentDuration ?? c.parentDurationSec ?? 0;
      const cSessions = c.child_sessions ?? c.childSessions ?? 0;
      const cDuration = c.child_duration ?? c.childDuration ?? c.childDurationSec ?? 0;
      const uniq = c.unique_users ?? c.uniqueUsers ?? c.unique ?? undefined;

      return {
        ...c,
        name: info.name,
        code: info.code,
        flag: info.flag,
        pSessions,
        pDuration,
        cSessions,
        cDuration,
        uniq,
      };
    });

    if (countrySearch.trim()) {
      const q = countrySearch.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      switch (sortColumn) {
        case 'name':
          return sortDirection === 'asc'
            ? a.name.localeCompare(b.name, 'ar')
            : b.name.localeCompare(a.name, 'ar');
        case 'parentSessions':
          valA = a.pSessions;
          valB = b.pSessions;
          break;
        case 'parentDuration':
          valA = a.pDuration;
          valB = b.pDuration;
          break;
        case 'childSessions':
          valA = a.cSessions;
          valB = b.cSessions;
          break;
        case 'childDuration':
          valA = a.cDuration;
          valB = b.cDuration;
          break;
        case 'unique':
          valA = a.uniq ?? 0;
          valB = b.uniq ?? 0;
          break;
      }

      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [rawCountries, countrySearch, sortColumn, sortDirection]);

  // Extract Daily log if available
  const dailyLogs: TelemetryDaily[] = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data.daily) && data.daily.length > 0) return data.daily;
    if (Array.isArray(data.days) && data.days.length > 0) return data.days;
    if (Array.isArray(data.timeline)) return data.timeline;
    if (Array.isArray(data.history)) return data.history;
    if (Array.isArray(data.by_date)) return data.by_date;
    return [];
  }, [data]);

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('desc');
    }
  };

  const exportCsv = () => {
    if (processedCountries.length === 0) return;
    const headers = ['الدولة', 'رمز الدولة', 'جلسات الأهل', 'مدة الأهل (ث)', 'جلسات الطفل', 'مدة الطفل (ث)', 'مستخدمون فريدون'];
    const rows = processedCountries.map((c) => [
      `"${c.name}"`,
      `"${c.code}"`,
      c.pSessions,
      c.pDuration,
      c.cSessions,
      c.cDuration,
      c.uniq ?? '',
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `youngtube-telemetry-${days}days.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="telemetry-view-container" className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
          <Calendar className="w-4 h-4 mr-2 text-slate-500 hidden sm:block" />
          {([7, 30, 90] as TimeRangeDays[]).map((period) => (
            <button
              key={period}
              id={`telemetry-range-${period}-btn`}
              onClick={() => setDays(period)}
              disabled={isLoading}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                days === period
                  ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
            >
              آخر {period} {period === 7 ? 'أيام' : 'يوم'}
            </button>
          ))}
        </div>

        {/* Status / Refresh info */}
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          {lastUpdated && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>آخر تحديث: {formatTimestamp(lastUpdated.toISOString())}</span>
            </div>
          )}
          <button
            id="telemetry-manual-reload-btn"
            onClick={() => loadData(days)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
            <span>إعادة تحميل</span>
          </button>
        </div>
      </div>

      {/* Mandatory Explanatory Banner */}
      <div
        id="telemetry-duration-rule-banner"
        className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-amber-900 dark:text-amber-200"
      >
        <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm leading-relaxed">
          <span className="font-bold">قاعدة احتساب المدد:</span>{' '}
          <span className="font-semibold text-rose-700 dark:text-rose-300">مدة الطفل</span> =
          تشغيل فعلي للمحتوى والفيديوهات (<span className="font-mono text-xs">PLAYING</span>)؛ بينما{' '}
          <span className="font-semibold text-blue-700 dark:text-blue-300">مدة الأهل</span> = وقت
          فتح لوحة الوالدين وتعديل الإعدادات. الأرقام مطابقة تماماً لما يُرجعه الخادم.
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold">تعذر جلب بيانات الـ Telemetry</div>
            <div className="mt-1 font-mono text-xs opacity-90">{error}</div>
            <div className="mt-2 text-[11px] text-slate-500">
              تأكد من أن الـ Worker مفعّل ولديه إمكانية قراءة مسار <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">/api/admin/telemetry</code>
            </div>
          </div>
          <button
            onClick={() => loadData(days)}
            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Child Sessions (Playing) */}
        <div
          id="metric-card-child-sessions"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold">جلسات الأطفال (تشغيل)</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <Baby className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : formatNumber(childSessions)}
          </div>
          <div className="mt-2 text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
            <span>مدة التشغيل الفعلي:</span>
            <span className="font-bold font-mono">{formatDuration(childDuration)}</span>
          </div>
        </div>

        {/* Child Duration (Playing) */}
        <div
          id="metric-card-child-duration"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold">إجمالي وقت المشاهدة</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : formatDuration(childDuration)}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
            = {formatNumber(childDuration)} ثانية استهلاك
          </div>
        </div>

        {/* Parent Sessions & Duration */}
        <div
          id="metric-card-parent-sessions"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold">جلسات الأهل (الإعدادات)</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : formatNumber(parentSessions)}
          </div>
          <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
            <span>مدة فتح الإعدادات:</span>
            <span className="font-bold font-mono">{formatDuration(parentDuration)}</span>
          </div>
        </div>

        {/* Unique Users or Combined Ratio */}
        <div
          id="metric-card-unique-users"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold">
              {uniqueCount !== undefined ? 'المستخدمون الفريدون' : 'إجمالي الجلسات المشتركة'}
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : uniqueCount !== undefined ? (
              formatNumber(uniqueCount)
            ) : (
              formatNumber(childSessions + parentSessions)
            )}
          </div>
          <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {uniqueCount !== undefined
              ? 'مستخدم / جهاز فريد نشط'
              : `إجمالي الجلسات المنفذة خلال ${days} يوم`}
          </div>
        </div>
      </div>

      {/* Countries Breakdown Table */}
      <div
        id="telemetry-countries-section"
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
      >
        {/* Table Header Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Globe2 className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                توزيع الاستخدام حسب الدول ({processedCountries.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تفاصيل جلسات الأهل والأطفال والتشغيل الفعلي مصنفة جغرافياً
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="country-search-input"
                type="text"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="ابحث باسم الدولة أو الرمز..."
                className="w-full pr-9 pl-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Export CSV button */}
            <button
              id="export-countries-csv-btn"
              onClick={exportCsv}
              disabled={processedCountries.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-40 cursor-pointer"
              title="تصدير جدول الدول إلى ملف CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 select-none">
              <tr>
                <th
                  onClick={() => handleSort('name')}
                  className="py-3 px-4 cursor-pointer hover:text-amber-500 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>الدولة</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('childSessions')}
                  className="py-3 px-4 cursor-pointer hover:text-amber-500 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>جلسات الطفل</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('childDuration')}
                  className="py-3 px-4 cursor-pointer hover:text-amber-500 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>مدة الطفل (PLAYING)</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('parentSessions')}
                  className="py-3 px-4 cursor-pointer hover:text-amber-500 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>جلسات الأهل</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('parentDuration')}
                  className="py-3 px-4 cursor-pointer hover:text-amber-500 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>مدة الأهل</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('unique')}
                  className="py-3 px-4 cursor-pointer hover:text-amber-500 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>فريد (Unique)</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {isLoading && processedCountries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    جاري جلب إحصائيات الدول...
                  </td>
                </tr>
              ) : processedCountries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                    {countrySearch ? 'لم يتم العثور على دول مطابقة للبحث' : 'لا تتوفر بيانات دول في فترة الإحصائيات المحددة'}
                  </td>
                </tr>
              ) : (
                processedCountries.map((c, idx) => (
                  <tr
                    key={c.code || idx}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-sans font-medium text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{c.flag}</span>
                        <div>
                          <span>{c.name}</span>
                          <span className="mr-1.5 text-[10px] text-slate-400 font-mono">
                            ({c.code})
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-semibold">
                      {formatNumber(c.cSessions)}
                    </td>
                    <td className="py-3 px-4 text-rose-600 dark:text-rose-400 font-semibold">
                      {formatDuration(c.cDuration)}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {formatNumber(c.pSessions)}
                    </td>
                    <td className="py-3 px-4 text-blue-600 dark:text-blue-400">
                      {formatDuration(c.pDuration)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {c.uniq !== undefined ? formatNumber(c.uniq) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Timeline / Log (if returned by API) */}
      {dailyLogs.length > 0 && (
        <div
          id="telemetry-daily-logs-section"
          className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs p-5"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                السجل اليومي لنشاط المشاهدة ({dailyLogs.length} يوم)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                مخطط الحركة اليومية بين تشغيل الأطفال ولوحة الوالدين
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">التاريخ</th>
                  <th className="py-2.5 px-3">جلسات الطفل</th>
                  <th className="py-2.5 px-3">مدة الطفل (PLAYING)</th>
                  <th className="py-2.5 px-3">جلسات الأهل</th>
                  <th className="py-2.5 px-3">مدة الأهل</th>
                  <th className="py-2.5 px-3">فريد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {dailyLogs.map((day, idx) => {
                  const pS = day.parent_sessions ?? day.parentSessions ?? day.parentSessionsTotal ?? 0;
                  const pD = day.parent_duration ?? day.parentDuration ?? day.parentDurationSec ?? 0;
                  const cS = day.child_sessions ?? day.childSessions ?? day.childSessionsTotal ?? 0;
                  const cD = day.child_duration ?? day.childDuration ?? day.childDurationSec ?? 0;
                  const u = day.unique ?? day.unique_users ?? day.uniqueInstallsTotal ?? undefined;
                  return (
                    <tr key={day.date || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                        {day.date}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">{formatNumber(cS)}</td>
                      <td className="py-2.5 px-3 text-rose-600 dark:text-rose-400 font-semibold">{formatDuration(cD)}</td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{formatNumber(pS)}</td>
                      <td className="py-2.5 px-3 text-blue-600 dark:text-blue-400">{formatDuration(pD)}</td>
                      <td className="py-2.5 px-3 text-slate-500">{u !== undefined ? formatNumber(u) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Raw Inspector Accordion */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowRawJson(!showRawJson)}
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-mono cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{showRawJson ? 'إخفاء الاستجابة الأصلية (Raw JSON)' : 'عرض استجابة الخادم الأصلية (Raw JSON)'}</span>
        </button>

        {showRawJson && (
          <div className="mt-3 p-4 rounded-2xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-80 border border-slate-800">
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
