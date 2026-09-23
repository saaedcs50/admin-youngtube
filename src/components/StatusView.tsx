import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Database,
  Film,
  Globe,
  HardDrive,
  Layers,
  ListVideo,
  Loader2,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Square,
  Terminal,
  Trash2,
  Tv,
  Zap,
} from 'lucide-react';
import { fetchStatus, getWorkerUrl, triggerBackfillAllBatch, triggerCleanupDeadVideosBatch, triggerScanCleanupBatch } from '../services/api';
import { StatusResponse } from '../types';
import { formatTimestamp } from '../utils/formatters';
import { useBatchTool } from '../hooks/useBatchTool';

interface StatusViewProps {
  onNotify: (type: 'success' | 'error' | 'info' | 'warning', title: string, desc?: string) => void;
}

export const StatusView: React.FC<StatusViewProps> = ({ onNotify }) => {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);

  // 1. Deep Backfill All Channels tool hook
  const backfillTool = useBatchTool({
    name: 'backfill',
    runOnce: ({ reset }) => triggerBackfillAllBatch(reset),
    interpret: (res) => ({
      successItems: Array.isArray(res.processedChannels)
        ? res.processedChannels.map((c: any) => ({
            sourceId: String(c.sourceId || c.id || ''),
            title: String(c.title || c.name || c.sourceId || 'قناة بدون اسم'),
            videoCount: Number(c.videoCount ?? c.count ?? 0),
          }))
        : [],
      failedItems: res.failedChannels,
      totalChannels: res.totalChannels,
      wrappedAround: res.wrappedAround,
    }),
    onNotify,
    messages: {
      startTitle: 'بدء Backfill الأرشيف العميق',
      startDesc: 'جاري جلب الفيديوهات على دفعات مع دعم إعادة المحاولة التلقائية...',
      completeTitle: 'اكتمل Backfill لكل القنوات! ✅',
      getCompleteDesc: ({ totalChannels, processedCount, skippedBatches }) =>
        skippedBatches > 0
          ? `تم الانتهاء من فحص وتحديث أرشيف جميع القنوات (${totalChannels || processedCount} قناة) مع تخطي ${skippedBatches} دفعة بسبب مشاكل شبكة.`
          : `تم الانتهاء من فحص وتحديث أرشيف جميع القنوات (${totalChannels || processedCount} قناة).`,
      stoppedTitle: 'تم إيقاف Backfill',
      getStoppedDesc: ({ processedCount }) => `توقفت العملية عند معالجة ${processedCount} قناة.`,
      consecutiveFailuresTitle: 'توقف Backfill بسبب خطأ متكرر',
      consecutiveFailuresDesc:
        'تعذرت معالجة 3 دفعات متتالية بعد استنفاد محاولات الإعادة (3 محاولات لكل دفعة). يرجى التحقق من اتصال الخادم ومفتاح المشرف.',
      loopErrorTitle: 'فشل أثناء Backfill',
    },
  });

  // 2. Cleanup Dead Videos tool hook
  const cleanupTool = useBatchTool({
    name: 'cleanup',
    runOnce: ({ reset }) => triggerCleanupDeadVideosBatch(reset),
    interpret: (res) => ({
      successItems: Array.isArray(res.channelsProcessed)
        ? res.channelsProcessed.map((c: any) => ({
            sourceId: String(c.sourceId || c.id || ''),
            title: String(c.title || c.name || c.sourceId || 'قناة بدون اسم'),
            videosChecked: Number(c.videosChecked ?? 0),
            deadVideosRemoved: Number(c.deadVideosRemoved ?? 0),
          }))
        : [],
      failedItems: res.failedChannels,
      totalChannels: res.totalChannels,
      wrappedAround: res.wrappedAround,
      metricsDelta: {
        videosChecked: Number(res.totalVideosChecked || 0),
        deadVideosRemoved: Number(res.totalDeadVideosRemoved || 0),
      },
      debugExtra: {
        totalVideosChecked: res.totalVideosChecked,
        totalDeadVideosRemoved: res.totalDeadVideosRemoved,
      },
    }),
    onNotify,
    messages: {
      startTitle: 'بدء تنظيف الفيديوهات الميتة',
      startDesc: 'جاري فحص فيديوهات الأرشيف على دفعات وحذف الفيديوهات المحذوفة أو الخاصة...',
      completeTitle: 'اكتمل تنظيف الفيديوهات الميتة! ✅',
      getCompleteDesc: ({ totalChannels, processedCount, skippedBatches, metrics }) =>
        skippedBatches > 0
          ? `تم الانتهاء من فحص أرشيف جميع القنوات (${totalChannels || processedCount} قناة) مع تخطي ${skippedBatches} دفعة بسبب مشاكل شبكة. تم فحص ${metrics.videosChecked || 0} فيديو وحذف ${metrics.deadVideosRemoved || 0} فيديو ميت.`
          : `تم الانتهاء من فحص أرشيف جميع القنوات (${totalChannels || processedCount} قناة). تم فحص ${metrics.videosChecked || 0} فيديو وحذف ${metrics.deadVideosRemoved || 0} فيديو ميت.`,
      stoppedTitle: 'تم إيقاف تنظيف الفيديوهات',
      getStoppedDesc: ({ processedCount, metrics }) =>
        `توقفت العملية عند معالجة ${processedCount} قناة (فُحص ${metrics.videosChecked || 0} فيديو، حُذف ${metrics.deadVideosRemoved || 0} فيديو).`,
      consecutiveFailuresTitle: 'توقف تنظيف الفيديوهات بسبب خطأ متكرر',
      consecutiveFailuresDesc:
        'تعذرت معالجة 3 دفعات متتالية بعد استنفاد محاولات الإعادة (3 محاولات لكل دفعة). يرجى التحقق من اتصال الخادم ومفتاح المشرف.',
      loopErrorTitle: 'فشل أثناء تنظيف الفيديوهات',
    },
  });

  // 3. Scan Cleanup Shorts & Portrait tool hook
  const scanTool = useBatchTool({
    name: 'scan',
    runOnce: ({ reset }) => triggerScanCleanupBatch(reset),
    interpret: (res) => {
      const batchChannels = Array.isArray(res.channelsProcessed) ? res.channelsProcessed : [];
      const isChannelComplete =
        res.channelComplete === true || (res.channelComplete === undefined && batchChannels.length > 0);
      const currentTitle = res.title || batchChannels[0]?.title || '';

      const extra = (res as any).extraFields || {};
      // 1) Accumulate metrics.videosChecked by ADDING videosCheckedThisCall (or totalVideosChecked from extraFields)
      // per successful batch — not by replacing with a wrong field and not by double-counting full archive sizes.
      const videosCheckedThisCall =
        typeof extra.videosCheckedThisCall === 'number'
          ? extra.videosCheckedThisCall
          : typeof (res as any).videosCheckedThisCall === 'number'
          ? (res as any).videosCheckedThisCall
          : typeof extra.totalVideosChecked === 'number'
          ? extra.totalVideosChecked
          : typeof res.totalVideosChecked === 'number'
          ? res.totalVideosChecked
          : 0;

      const removedShortDelta =
        typeof extra.removedShortDurationThisCall === 'number'
          ? extra.removedShortDurationThisCall
          : typeof (res as any).removedShortDurationThisCall === 'number'
          ? (res as any).removedShortDurationThisCall
          : typeof extra.totalRemovedShortDuration === 'number'
          ? extra.totalRemovedShortDuration
          : typeof res.totalRemovedShortDuration === 'number'
          ? res.totalRemovedShortDuration
          : 0;

      const removedPortraitDelta =
        typeof extra.removedPortraitThisCall === 'number'
          ? extra.removedPortraitThisCall
          : typeof (res as any).removedPortraitThisCall === 'number'
          ? (res as any).removedPortraitThisCall
          : typeof extra.totalRemovedPortrait === 'number'
          ? extra.totalRemovedPortrait
          : typeof res.totalRemovedPortrait === 'number'
          ? res.totalRemovedPortrait
          : 0;

      return {
        successItems: batchChannels.map((c: any) => ({
          sourceId: String(c.sourceId || c.id || ''),
          title: String(c.title || c.name || c.sourceId || 'قناة بدون اسم'),
          videosChecked: Number(c.videosChecked ?? 0),
          removedShortDuration: Number(c.removedShortDuration ?? 0),
          removedPortrait: Number(c.removedPortrait ?? 0),
        })),
        failedItems: res.failedChannels,
        totalChannels: res.totalChannels,
        wrappedAround: res.wrappedAround,
        channelComplete: isChannelComplete,
        currentChannelTitle: res.channelComplete === false ? (currentTitle || 'قناة جاري معالجتها') : null,
        processedDelta: isChannelComplete ? (batchChannels.length > 0 ? batchChannels.length : 1) : 0,
        metricsDelta: {
          videosChecked: videosCheckedThisCall,
          removedShortDuration: removedShortDelta,
          removedPortrait: removedPortraitDelta,
        },
        debugExtra: {
          channelComplete: res.channelComplete,
          title: res.title,
          videosCheckedThisCall,
          cursorBefore: res.cursorBefore,
          cursorAfter: res.cursorAfter,
          totalVideosChecked: res.totalVideosChecked,
          totalRemovedShortDuration: res.totalRemovedShortDuration,
          totalRemovedPortrait: res.totalRemovedPortrait,
          extraFields: extra,
        },
      };
    },
    onNotify,
    messages: {
      startTitle: 'بدء تنظيف الفيديوهات القصيرة والعمودية',
      startDesc: 'جاري فحص مدة واتجاه الفيديوهات على دفعات وحذف القصير والعمودي...',
      completeTitle: 'اكتمل تنظيف الفيديوهات القصيرة والعمودية! ✅',
      getCompleteDesc: ({ totalChannels, processedCount, skippedBatches, metrics }) =>
        skippedBatches > 0
          ? `تم الانتهاء من فحص أرشيف جميع القنوات (${totalChannels || processedCount} قناة) مع تخطي ${skippedBatches} دفعة بسبب مشاكل شبكة. تم فحص ${metrics.videosChecked || 0} فيديو وحذف ${metrics.removedShortDuration || 0} فيديو قصير و ${metrics.removedPortrait || 0} فيديو عمودي.`
          : `تم الانتهاء من فحص أرشيف جميع القنوات (${totalChannels || processedCount} قناة). تم فحص ${metrics.videosChecked || 0} فيديو وحذف ${metrics.removedShortDuration || 0} فيديو قصير و ${metrics.removedPortrait || 0} فيديو عمودي.`,
      stoppedTitle: 'تم إيقاف تنظيف الفيديوهات القصيرة والعمودية',
      getStoppedDesc: ({ processedCount, metrics }) =>
        `توقفت العملية عند معالجة ${processedCount} قناة (فُحص ${metrics.videosChecked || 0} فيديو، حُذف ${metrics.removedShortDuration || 0} قصير، حُذف ${metrics.removedPortrait || 0} عمودي).`,
      consecutiveFailuresTitle: 'توقف التنظيف بسبب خطأ متكرر',
      consecutiveFailuresDesc:
        'تعذرت معالجة 3 دفعات متتالية بعد استنفاد محاولات الإعادة (3 محاولات لكل دفعة). يرجى التحقق من اتصال الخادم ومفتاح المشرف.',
      loopErrorTitle: 'فشل أثناء تنظيف الفيديوهات القصيرة والعمودية',
    },
  });

  const loadStatus = async () => {
    setIsLoading(true);
    const start = performance.now();
    try {
      const res = await fetchStatus();
      const end = performance.now();
      setLatency(Math.round(end - start));
      setStatus(res);
      setLastCheck(new Date());
    } catch (err: any) {
      console.error('Error checking status:', err);
      onNotify('error', 'فشل فحص حالة الخادم', err?.message || 'خطأ أثناء طلب /api/admin/status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleCopyJson = () => {
    if (!status) return;
    navigator.clipboard.writeText(JSON.stringify(status, null, 2));
    setCopied(true);
    onNotify('info', 'تم النسخ', 'تم نسخ استجابة الـ Status إلى الحافظة');
    setTimeout(() => setCopied(false), 2000);
  };

  const isHealthy = status?.ok !== false && status?.status !== 'error';

  return (
    <div id="status-view-container" className="space-y-6">
      {/* Top Banner Status */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${
              isHealthy
                ? 'bg-emerald-600 shadow-emerald-500/25'
                : 'bg-rose-600 shadow-rose-500/25'
            }`}
          >
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                حالة الخادم (Worker Health)
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isHealthy
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                }`}
              >
                {isHealthy ? 'سليم ومتصل 100%' : 'هناك مشكلة'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
              مسار الفحص: GET /api/admin/status
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {latency !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>{latency} ms</span>
            </div>
          )}

          <button
            id="status-refresh-btn"
            onClick={loadStatus}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-amber-500/20 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>فحص جديد</span>
          </button>
        </div>
      </div>

      {/* Grid of status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Worker URL */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">النطاق والـ Host</span>
            <Globe className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 truncate" title={getWorkerUrl()}>
            {getWorkerUrl().replace('https://', '')}
          </div>
          <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Cloudflare Edge Worker</span>
          </div>
        </div>

        {/* Channels in Status */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">القنوات والمصادر</span>
            <Tv className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
            {status?.channels_count ?? status?.channelsCount ?? (Array.isArray(status?.channels) ? status.channels.length : '—')}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            المصادر المسجلة في الـ Worker
          </div>
        </div>

        {/* Cache status */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">الذاكرة المؤقتة (Cache)</span>
            <Database className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
            {status?.cache?.cached ? 'مفعّل (Active)' : 'مباشر (Live)'}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            {status?.cache?.ttl ? `TTL: ${status.cache.ttl} ثانية` : 'Cloudflare KV / Cache API'}
          </div>
        </div>

        {/* Server Time / Uptime */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">توقيت الخادم والبيئة</span>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xs font-mono font-semibold text-slate-900 dark:text-slate-100">
            {status?.server_time ? formatTimestamp(status.server_time) : lastCheck ? formatTimestamp(lastCheck.toISOString()) : '—'}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            النسخة: <span className="font-mono">{status?.version || 'production'}</span>
          </div>
        </div>
      </div>

      {/* Deep Backfill Section */}
      <div id="deep-backfill-card" className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Backfill عميق لكل القنوات
              </h3>
              {backfillTool.isRunning && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                  {backfillTool.isStopping ? 'جاري الإيقاف...' : 'جاري المعالجة على دفعات...'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
              يقوم هذا الإجراء بجلب أرشيف أعمق (حتى 1000 فيديو) لكل قناة على دفعات، للسماح بالبحث العميق داخل الأرشيف من تطبيق الأطفال.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
            <button
              id="backfill-start-btn"
              onClick={backfillTool.start}
              disabled={backfillTool.isRunning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm shadow-purple-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {backfillTool.isRunning && !backfillTool.isStopping ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>بدء</span>
            </button>

            <button
              id="backfill-stop-btn"
              onClick={backfillTool.stop}
              disabled={!backfillTool.isRunning || backfillTool.isStopping}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{backfillTool.isStopping ? 'جاري الإيقاف...' : 'إيقاف'}</span>
            </button>
          </div>
        </div>

        {/* Progress Display */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                حالة التقدم:
              </span>
              <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                {backfillTool.totalChannels !== null
                  ? `تمت معالجة ${backfillTool.processedCount} من ${backfillTool.totalChannels} قناة`
                  : `تمت معالجة ${backfillTool.processedCount} قناة`}
              </span>
            </div>
            {backfillTool.totalChannels !== null && backfillTool.totalChannels > 0 && (
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {Math.min(100, Math.round((backfillTool.processedCount / backfillTool.totalChannels) * 100))}%
              </span>
            )}
          </div>

          {backfillTool.totalChannels !== null && backfillTool.totalChannels > 0 && (
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-600 dark:bg-purple-500 rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${Math.min(100, Math.max(0, (backfillTool.processedCount / backfillTool.totalChannels) * 100))}%`,
                }}
              />
            </div>
          )}

          {/* Secondary line when batches were skipped due to network/timeout issues */}
          {backfillTool.skippedBatchesCount > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              <span>تم تخطي {backfillTool.skippedBatchesCount} دفعة بسبب مشاكل شبكة مؤقتة</span>
            </div>
          )}
        </div>

        {/* Diagnostic Debug Block */}
        {backfillTool.lastBatchDebug !== null && (
          <div className="p-3.5 rounded-xl bg-slate-950 text-slate-200 border border-slate-800 font-mono text-xs overflow-x-auto space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-amber-400 font-bold border-b border-slate-800/80 pb-1">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                آخر استجابة للدفعة (Last Batch Response Diagnostics)
              </span>
              <span className="text-slate-400 font-normal text-[10px]">
                {backfillTool.lastBatchDebug.timestamp}
              </span>
            </div>
            <div className="text-slate-300 text-[11px] leading-relaxed break-all">
              آخر استجابة: reset المُرسل = <span className={backfillTool.lastBatchDebug.sentReset ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{String(backfillTool.lastBatchDebug.sentReset)}</span>, cursorBefore = <span className="text-purple-300 font-bold">{backfillTool.lastBatchDebug.cursorBefore}</span>, cursorAfter = <span className="text-purple-300 font-bold">{backfillTool.lastBatchDebug.cursorAfter}</span>, totalChannels = <span className="text-blue-300 font-bold">{backfillTool.lastBatchDebug.totalChannels}</span>, wrappedAround = <span className={backfillTool.lastBatchDebug.wrappedAround ? 'text-amber-400 font-bold' : 'text-slate-400'}>{String(backfillTool.lastBatchDebug.wrappedAround)}</span>, نجح = <span className="text-emerald-400 font-bold">{backfillTool.lastBatchDebug.processedCount}</span>, فشل = <span className={backfillTool.lastBatchDebug.failedCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>{backfillTool.lastBatchDebug.failedCount}</span>, الوقت = <span className="text-slate-300">{backfillTool.lastBatchDebug.timestamp}</span>
            </div>

            {Array.isArray(backfillTool.lastBatchDebug.failedChannelsDetail) && backfillTool.lastBatchDebug.failedChannelsDetail.length > 0 && (
              <div className="pt-1.5 mt-1.5 border-t border-slate-800/80 space-y-1 text-[11px] text-rose-300/90 font-mono">
                {backfillTool.lastBatchDebug.failedChannelsDetail.map((fc: any, idx: number) => {
                  const idOrTitle = fc.sourceId || fc.title || `قناة #${idx + 1}`;
                  const errType = fc.error || 'other';
                  const extra = fc.status !== undefined
                    ? `(status: ${fc.status})`
                    : fc.message
                    ? `— ${fc.message}`
                    : '';
                  return (
                    <div key={`${fc.sourceId || idx}-${idx}`} className="break-all">
                      - {idOrTitle}: {errType} {extra}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Live-updating small log of the last few processed channel titles & failed channels */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => backfillTool.setActiveTab('success')}
                className={`flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  backfillTool.activeTab === 'success'
                    ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <ListVideo className="w-3.5 h-3.5 text-purple-500" />
                <span>آخر القنوات المعالجة (أحدث 10)</span>
                {backfillTool.recentProcessedItems.length > 0 && (
                  <span className="font-mono text-[10px] px-1.5 py-0.2 bg-purple-200/60 dark:bg-purple-900/60 rounded-full">
                    {backfillTool.recentProcessedItems.length}
                  </span>
                )}
              </button>

              {backfillTool.failedItemsLog.length > 0 && (
                <button
                  type="button"
                  onClick={() => backfillTool.setActiveTab('failed')}
                  className={`flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    backfillTool.activeTab === 'failed'
                      ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>تعذر جلبها ({backfillTool.failedItemsLog.length})</span>
                </button>
              )}
            </div>

            {backfillTool.activeTab === 'success' && backfillTool.recentProcessedItems.length > 0 && (
              <span className="font-mono text-[11px]">
                {backfillTool.recentProcessedItems.length} قنوات مسجلة
              </span>
            )}
          </div>

          {backfillTool.activeTab === 'success' ? (
            backfillTool.recentProcessedItems.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 dark:text-slate-500">
                لم تبدأ المعالجة بعد. اضغط على &quot;بدء&quot; لمعالجة دفعات القنوات.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/40">
                {backfillTool.recentProcessedItems.map((item, idx) => (
                  <div
                    key={`${item.sourceId}-${idx}-${item.timestamp}`}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {item.title}
                      </span>
                      {item.sourceId && (
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 hidden sm:inline truncate">
                          ({item.sourceId})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-semibold flex items-center gap-1">
                        <Film className="w-3 h-3" />
                        {item.videoCount} فيديو
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {item.timestamp}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/40">
              {backfillTool.failedItemsLog.map((item, idx) => (
                <div
                  key={`${item.sourceId}-${idx}-${item.timestamp}`}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      {item.title}
                    </span>
                    {item.sourceId && (
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 hidden sm:inline truncate">
                        ({item.sourceId})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-mono text-[11px] font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {item.error || 'تعذر الجلب'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {item.timestamp}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cleanup Dead Videos Section */}
      <div id="cleanup-dead-videos-card" className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                تنظيف الفيديوهات الميتة
              </h3>
              {cleanupTool.isRunning && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  {cleanupTool.isStopping ? 'جاري الإيقاف...' : 'جاري الفحص والتنظيف...'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
              يتحقق هذا الإجراء من كل فيديو في الأرشيف عبر YouTube API ويحذف الفيديوهات المحذوفة أو الخاصة تلقائيًا من الأرشيف، على دفعات.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
            <button
              id="cleanup-start-btn"
              onClick={cleanupTool.start}
              disabled={cleanupTool.isRunning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm shadow-amber-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cleanupTool.isRunning && !cleanupTool.isStopping ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>بدء</span>
            </button>

            <button
              id="cleanup-stop-btn"
              onClick={cleanupTool.stop}
              disabled={!cleanupTool.isRunning || cleanupTool.isStopping}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{cleanupTool.isStopping ? 'جاري الإيقاف...' : 'إيقاف'}</span>
            </button>
          </div>
        </div>

        {/* Progress Display */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                حالة التقدم:
              </span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                {cleanupTool.totalChannels !== null
                  ? `تمت معالجة ${cleanupTool.processedCount} من ${cleanupTool.totalChannels} قناة`
                  : `تمت معالجة ${cleanupTool.processedCount} قناة`}
              </span>
            </div>
            {cleanupTool.totalChannels !== null && cleanupTool.totalChannels > 0 && (
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {Math.min(100, Math.round((cleanupTool.processedCount / cleanupTool.totalChannels) * 100))}%
              </span>
            )}
          </div>

          {/* Running total for videos checked and dead videos removed */}
          <div className="flex flex-wrap items-center gap-4 text-xs pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">الإجمالي:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                تم فحص {cleanupTool.metrics.videosChecked || 0} فيديو، حُذف {cleanupTool.metrics.deadVideosRemoved || 0} فيديو ميت
              </span>
            </div>
          </div>

          {cleanupTool.totalChannels !== null && cleanupTool.totalChannels > 0 && (
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-600 dark:bg-amber-500 rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${Math.min(100, Math.max(0, (cleanupTool.processedCount / cleanupTool.totalChannels) * 100))}%`,
                }}
              />
            </div>
          )}

          {/* Secondary line when batches were skipped due to network/timeout issues */}
          {cleanupTool.skippedBatchesCount > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              <span>تم تخطي {cleanupTool.skippedBatchesCount} دفعة بسبب مشاكل شبكة مؤقتة</span>
            </div>
          )}
        </div>

        {/* Diagnostic Debug Block */}
        {cleanupTool.lastBatchDebug !== null && (
          <div className="p-3.5 rounded-xl bg-slate-950 text-slate-200 border border-slate-800 font-mono text-xs overflow-x-auto space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-amber-400 font-bold border-b border-slate-800/80 pb-1">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                آخر استجابة للدفعة (Last Batch Response Diagnostics)
              </span>
              <span className="text-slate-400 font-normal text-[10px]">
                {cleanupTool.lastBatchDebug.timestamp}
              </span>
            </div>
            <div className="text-slate-300 text-[11px] leading-relaxed break-all">
              آخر استجابة: reset المُرسل = <span className={cleanupTool.lastBatchDebug.sentReset ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{String(cleanupTool.lastBatchDebug.sentReset)}</span>, cursorBefore = <span className="text-purple-300 font-bold">{cleanupTool.lastBatchDebug.cursorBefore}</span>, cursorAfter = <span className="text-purple-300 font-bold">{cleanupTool.lastBatchDebug.cursorAfter}</span>, totalChannels = <span className="text-blue-300 font-bold">{cleanupTool.lastBatchDebug.totalChannels}</span>, wrappedAround = <span className={cleanupTool.lastBatchDebug.wrappedAround ? 'text-amber-400 font-bold' : 'text-slate-400'}>{String(cleanupTool.lastBatchDebug.wrappedAround)}</span>, totalVideosChecked = <span className="text-cyan-300 font-bold">{cleanupTool.lastBatchDebug.totalVideosChecked}</span>, totalDeadVideosRemoved = <span className="text-rose-400 font-bold">{cleanupTool.lastBatchDebug.totalDeadVideosRemoved}</span>, قنوات فُحصت = <span className="text-emerald-400 font-bold">{cleanupTool.lastBatchDebug.processedCount}</span>, فشل = <span className={cleanupTool.lastBatchDebug.failedCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>{cleanupTool.lastBatchDebug.failedCount}</span>, الوقت = <span className="text-slate-300">{cleanupTool.lastBatchDebug.timestamp}</span>
            </div>

            {Array.isArray(cleanupTool.lastBatchDebug.failedChannelsDetail) && cleanupTool.lastBatchDebug.failedChannelsDetail.length > 0 && (
              <div className="pt-1.5 mt-1.5 border-t border-slate-800/80 space-y-1 text-[11px] text-rose-300/90 font-mono">
                {cleanupTool.lastBatchDebug.failedChannelsDetail.map((fc: any, idx: number) => {
                  const idOrTitle = fc.sourceId || fc.title || `قناة #${idx + 1}`;
                  const errType = fc.error || 'other';
                  const extra = fc.status !== undefined
                    ? `(status: ${fc.status})`
                    : fc.message
                    ? `— ${fc.message}`
                    : '';
                  return (
                    <div key={`${fc.sourceId || idx}-${idx}`} className="break-all">
                      - {idOrTitle}: {errType} {extra}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Live-updating small log of the last few processed channel titles & failed channels */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => cleanupTool.setActiveTab('success')}
                className={`flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  cleanupTool.activeTab === 'success'
                    ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <ListVideo className="w-3.5 h-3.5 text-amber-500" />
                <span>آخر القنوات المفحوصة (أحدث 10)</span>
                {cleanupTool.recentProcessedItems.length > 0 && (
                  <span className="font-mono text-[10px] px-1.5 py-0.2 bg-amber-200/60 dark:bg-amber-900/60 rounded-full">
                    {cleanupTool.recentProcessedItems.length}
                  </span>
                )}
              </button>

              {cleanupTool.failedItemsLog.length > 0 && (
                <button
                  type="button"
                  onClick={() => cleanupTool.setActiveTab('failed')}
                  className={`flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    cleanupTool.activeTab === 'failed'
                      ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>قنوات تعذر فحصها</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 bg-rose-200/60 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 rounded-full font-bold">
                    {cleanupTool.failedItemsLog.length}
                  </span>
                </button>
              )}
            </div>

            <span className="text-[11px] text-slate-400 hidden sm:inline">
              يتم التحديث تلقائيًا أثناء تشغيل الدفعات
            </span>
          </div>

          {/* Success Tab Content */}
          {cleanupTool.activeTab === 'success' && (
            <div className="space-y-1.5">
              {cleanupTool.recentProcessedItems.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  لم يتم فحص أي قنوات بعد في هذه الدورة. اضغط &quot;بدء&quot; لتنظيف الأرشيف.
                </div>
              ) : (
                cleanupTool.recentProcessedItems.map((item, idx) => (
                  <div
                    key={`${item.sourceId}-${idx}`}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800/60 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {item.title}
                      </span>
                      {item.sourceId && (
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 hidden sm:inline truncate">
                          ({item.sourceId})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-mono text-[11px] font-semibold">
                        فُحص {item.videosChecked} فيديو
                      </span>
                      {(item.deadVideosRemoved ?? 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-mono text-[11px] font-semibold">
                          حُذف {item.deadVideosRemoved} ميت
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-slate-400">
                        {item.timestamp}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Failed Tab Content */}
          {cleanupTool.activeTab === 'failed' && (
            <div className="space-y-1.5">
              {cleanupTool.failedItemsLog.map((item, idx) => (
                <div
                  key={`failed-${item.sourceId}-${idx}`}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/40 dark:border-rose-900/40 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="font-semibold text-rose-900 dark:text-rose-200 truncate">
                      {item.title}
                    </span>
                    {item.sourceId && (
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 hidden sm:inline truncate">
                        ({item.sourceId})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-mono text-[11px] font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {item.error || 'تعذر الفحص'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {item.timestamp}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Scan Cleanup Shorts & Portrait Section */}
      <div id="scan-cleanup-shorts-card" className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                تنظيف الفيديوهات القصيرة والعمودية
              </h3>
              {scanTool.isRunning && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  {scanTool.isStopping ? 'جاري الإيقاف...' : 'جاري الفحص والتنظيف...'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
              يفحص هذا الإجراء مدة واتجاه كل فيديو في الأرشيف، ويحذف تلقائيًا أي فيديو أقل من دقيقتين أو ذو اتجاه عمودي (Shorts)، على دفعات.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
            <button
              id="scan-cleanup-start-btn"
              onClick={scanTool.start}
              disabled={scanTool.isRunning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm shadow-amber-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scanTool.isRunning && !scanTool.isStopping ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>بدء</span>
            </button>

            <button
              id="scan-cleanup-reset-btn"
              onClick={() => scanTool.start({ reset: true })}
              disabled={scanTool.isRunning}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="إعادة الفحص من الصفر (reset)"
            >
              <RefreshCw className="w-3 h-3" />
              <span>إعادة من الصفر</span>
            </button>

            <button
              id="scan-cleanup-stop-btn"
              onClick={scanTool.stop}
              disabled={!scanTool.isRunning || scanTool.isStopping}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{scanTool.isStopping ? 'جاري الإيقاف...' : 'إيقاف'}</span>
            </button>
          </div>
        </div>

        {/* Progress Display */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                حالة التقدم:
              </span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                {scanTool.totalChannels !== null
                  ? `تم معالجة ${scanTool.processedCount} من ${scanTool.totalChannels} قناة`
                  : `تم معالجة ${scanTool.processedCount} قناة`}
              </span>
            </div>
            {scanTool.totalChannels !== null && scanTool.totalChannels > 0 && (
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {Math.min(100, Math.round((scanTool.processedCount / scanTool.totalChannels) * 100))}%
              </span>
            )}
          </div>

          {/* Running total for videos checked and removed shorts/portrait */}
          <div className="flex flex-wrap items-center gap-4 text-xs pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">الإجمالي:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                تم فحص {scanTool.metrics.videosChecked || 0} فيديو — حُذف {scanTool.metrics.removedShortDuration || 0} (قصير المدة)، حُذف {scanTool.metrics.removedPortrait || 0} (عمودي)
              </span>
            </div>
          </div>

          {/* Status line shown when channel is mid-progress (channelComplete === false) */}
          {scanTool.lastBatchDebug?.channelComplete === false && (
            <div
              id="scan-cleanup-channel-partial-notice"
              className="flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-900/50"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-amber-600 dark:text-amber-400" />
              <span>نفس القناة قيد المعالجة (دفعة جزئية) — المؤشر لن يزيد حتى تكتمل القناة.</span>
              {scanTool.currentChannelTitle && (
                <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80 font-mono">
                  ({scanTool.currentChannelTitle})
                </span>
              )}
            </div>
          )}

          {scanTool.totalChannels !== null && scanTool.totalChannels > 0 && (
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-600 dark:bg-amber-500 rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${Math.min(100, Math.max(0, (scanTool.processedCount / scanTool.totalChannels) * 100))}%`,
                }}
              />
            </div>
          )}

          {/* Secondary line when batches were skipped due to network/timeout issues */}
          {scanTool.skippedBatchesCount > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              <span>تم تخطي {scanTool.skippedBatchesCount} دفعة بسبب مشاكل شبكة مؤقتة</span>
            </div>
          )}
        </div>

        {/* Diagnostic Debug Block */}
        {scanTool.lastBatchDebug !== null && (
          <div className="p-3.5 rounded-xl bg-slate-950 text-slate-200 border border-slate-800 font-mono text-xs overflow-x-auto space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-amber-400 font-bold border-b border-slate-800/80 pb-1">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                آخر استجابة للدفعة (Last Batch Response Diagnostics)
              </span>
              <span className="text-slate-400 font-normal text-[10px]">
                {scanTool.lastBatchDebug.timestamp}
              </span>
            </div>
            <div className="text-slate-300 text-[11px] leading-relaxed break-all">
              آخر استجابة: reset المُرسل = <span className={scanTool.lastBatchDebug.sentReset ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{String(scanTool.lastBatchDebug.sentReset)}</span>, cursorBefore = <span className="text-purple-300 font-bold">{scanTool.lastBatchDebug.cursorBefore}</span>, cursorAfter = <span className="text-purple-300 font-bold">{scanTool.lastBatchDebug.cursorAfter}</span>, totalChannels = <span className="text-blue-300 font-bold">{scanTool.lastBatchDebug.totalChannels}</span>, channelComplete = <span className={scanTool.lastBatchDebug.channelComplete === false ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>{String(scanTool.lastBatchDebug.channelComplete ?? true)}</span>, wrappedAround = <span className={scanTool.lastBatchDebug.wrappedAround ? 'text-amber-400 font-bold' : 'text-slate-400'}>{String(scanTool.lastBatchDebug.wrappedAround)}</span>, videosCheckedThisCall = <span className="text-cyan-300 font-bold">{scanTool.lastBatchDebug.videosCheckedThisCall}</span>, totalVideosChecked = <span className="text-cyan-300 font-bold">{scanTool.lastBatchDebug.totalVideosChecked}</span>, totalRemovedShortDuration = <span className="text-rose-400 font-bold">{scanTool.lastBatchDebug.totalRemovedShortDuration}</span>, totalRemovedPortrait = <span className="text-rose-400 font-bold">{scanTool.lastBatchDebug.totalRemovedPortrait}</span>, قنوات فُحصت = <span className="text-emerald-400 font-bold">{scanTool.lastBatchDebug.processedCount}</span>, فشل = <span className={scanTool.lastBatchDebug.failedCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>{scanTool.lastBatchDebug.failedCount}</span>, الوقت = <span className="text-slate-300">{scanTool.lastBatchDebug.timestamp}</span>
            </div>

            {Array.isArray(scanTool.lastBatchDebug.failedChannelsDetail) && scanTool.lastBatchDebug.failedChannelsDetail.length > 0 && (
              <div className="pt-1.5 mt-1.5 border-t border-slate-800/80 space-y-1 text-[11px] text-rose-300/90 font-mono">
                {scanTool.lastBatchDebug.failedChannelsDetail.map((fc: any, idx: number) => {
                  const idOrTitle = fc.sourceId || fc.title || `قناة #${idx + 1}`;
                  const errType = fc.error || 'other';
                  const extra = fc.status !== undefined
                    ? `(status: ${fc.status})`
                    : fc.message
                    ? `— ${fc.message}`
                    : '';
                  return (
                    <div key={`${fc.sourceId || idx}-${idx}`} className="break-all">
                      - {idOrTitle}: {errType} {extra}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Live-updating small log of the last few processed channel titles & failed channels */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scanTool.setActiveTab('success')}
                className={`flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  scanTool.activeTab === 'success'
                    ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <ListVideo className="w-3.5 h-3.5 text-amber-500" />
                <span>آخر القنوات المفحوصة (أحدث 10)</span>
                {scanTool.recentProcessedItems.length > 0 && (
                  <span className="font-mono text-[10px] px-1.5 py-0.2 bg-amber-200/60 dark:bg-amber-900/60 rounded-full">
                    {scanTool.recentProcessedItems.length}
                  </span>
                )}
              </button>

              {scanTool.failedItemsLog.length > 0 && (
                <button
                  type="button"
                  onClick={() => scanTool.setActiveTab('failed')}
                  className={`flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    scanTool.activeTab === 'failed'
                      ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>قنوات تعذر فحصها</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 bg-rose-200/60 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 rounded-full font-bold">
                    {scanTool.failedItemsLog.length}
                  </span>
                </button>
              )}
            </div>

            <span className="text-[11px] text-slate-400 hidden sm:inline">
              يتم التحديث تلقائيًا أثناء تشغيل الدفعات
            </span>
          </div>

          {/* Success Tab Content */}
          {scanTool.activeTab === 'success' && (
            <div className="space-y-1.5">
              {scanTool.recentProcessedItems.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  لم يتم فحص أي قنوات بعد في هذه الدورة. اضغط &quot;بدء&quot; لتنظيف الأرشيف.
                </div>
              ) : (
                scanTool.recentProcessedItems.map((item, idx) => (
                  <div
                    key={`${item.sourceId}-${idx}`}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800/60 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {item.title}
                      </span>
                      {item.sourceId && (
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 hidden sm:inline truncate">
                          ({item.sourceId})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-mono text-[11px] font-semibold">
                        فُحص {item.videosChecked} فيديو
                      </span>
                      {((item.removedShortDuration ?? 0) > 0 || (item.removedPortrait ?? 0) > 0) && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-mono text-[11px] font-semibold">
                          حُذف {item.removedShortDuration ?? 0} قصير / {item.removedPortrait ?? 0} عمودي
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-slate-400">
                        {item.timestamp}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Failed Tab Content */}
          {scanTool.activeTab === 'failed' && (
            <div className="space-y-1.5">
              {scanTool.failedItemsLog.map((item, idx) => (
                <div
                  key={`failed-${item.sourceId}-${idx}`}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/40 dark:border-rose-900/40 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="font-semibold text-rose-900 dark:text-rose-200 truncate">
                      {item.title}
                    </span>
                    {item.sourceId && (
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 hidden sm:inline truncate">
                        ({item.sourceId})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-mono text-[11px] font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {item.error || 'تعذر الفحص'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {item.timestamp}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Raw JSON viewer */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200">
              الاستجابة البرمجية الكاملة (Status Response Payload)
            </h3>
          </div>
          <button
            onClick={handleCopyJson}
            disabled={!status}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copied ? 'تم النسخ!' : 'نسخ JSON'}</span>
          </button>
        </div>

        <div className="p-4 bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto max-h-96">
          {isLoading && !status ? (
            <div className="py-8 text-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
              جاري الاتصال...
            </div>
          ) : (
            <pre>{JSON.stringify(status, null, 2)}</pre>
          )}
        </div>
      </div>
    </div>
  );
};
