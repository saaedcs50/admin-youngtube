import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Globe,
  Layers,
  Loader2,
  RefreshCw,
  Server,
  Trash2,
  Tv,
  Zap,
} from 'lucide-react';
import { fetchStatus, getWorkerUrl, triggerBackfillAllBatch, triggerCleanupDeadVideosBatch, triggerScanCleanupBatch } from '../services/api';
import { StatusResponse } from '../types';
import { formatTimestamp } from '../utils/formatters';
import { useBatchTool } from '../hooks/useBatchTool';
import { BatchToolCard } from './BatchToolCard';

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

      {/* 1. Deep Backfill Batch Tool Card */}
      <BatchToolCard
        id="backfill"
        cardId="deep-backfill-card"
        title="Backfill عميق لكل القنوات"
        description="يقوم هذا الإجراء بجلب أرشيف أعمق (حتى 1000 فيديو) لكل قناة على دفعات، للسماح بالبحث العميق داخل الأرشيف من تطبيق الأطفال."
        icon={<Layers className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
        tool={backfillTool}
      />

      {/* 2. Cleanup Dead Videos Batch Tool Card */}
      <BatchToolCard
        id="cleanup"
        cardId="cleanup-dead-videos-card"
        title="تنظيف الفيديوهات الميتة"
        description="يتحقق هذا الإجراء من كل فيديو في الأرشيف عبر YouTube API ويحذف الفيديوهات المحذوفة أو الخاصة تلقائيًا من الأرشيف، على دفعات."
        icon={<Trash2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
        tool={cleanupTool}
        renderMetrics={(m) => (
          <span>
            تم فحص {m.videosChecked || 0} فيديو، حُذف {m.deadVideosRemoved || 0} فيديو ميت
          </span>
        )}
      />

      {/* 3. Scan Cleanup Shorts & Portrait Batch Tool Card */}
      <BatchToolCard
        id="scan-cleanup"
        cardId="scan-cleanup-shorts-card"
        title="تنظيف الفيديوهات القصيرة والعمودية"
        description="يفحص هذا الإجراء مدة واتجاه كل فيديو في الأرشيف، ويحذف تلقائيًا أي فيديو أقل من دقيقتين أو ذو اتجاه عمودي (Shorts)، على دفعات."
        icon={<Trash2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
        tool={scanTool}
        resetButtonLabel="إعادة من الصفر"
        renderMetrics={(m) => (
          <span>
            تم فحص {m.videosChecked || 0} فيديو — حُذف {m.removedShortDuration || 0} (قصير المدة)، حُذف {m.removedPortrait || 0} (عمودي)
          </span>
        )}
      />

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
