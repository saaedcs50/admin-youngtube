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
import { fetchStatus, getWorkerUrl, triggerBackfillAllBatch, triggerCleanupDeadVideosBatch } from '../services/api';
import { StatusResponse } from '../types';
import { formatTimestamp } from '../utils/formatters';

interface StatusViewProps {
  onNotify: (type: 'success' | 'error' | 'info' | 'warning', title: string, desc?: string) => void;
}

export const StatusView: React.FC<StatusViewProps> = ({ onNotify }) => {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);

  // Backfill All Channels state
  const [isBackfillRunning, setIsBackfillRunning] = useState(false);
  const [isBackfillStopping, setIsBackfillStopping] = useState(false);
  const [backfillProcessedCount, setBackfillProcessedCount] = useState(0);
  const [backfillTotalChannels, setBackfillTotalChannels] = useState<number | null>(null);
  const [skippedBatchesCount, setSkippedBatchesCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'success' | 'failed'>('success');
  const [lastBatchDebug, setLastBatchDebug] = useState<any>(null);
  const [recentProcessedChannels, setRecentProcessedChannels] = useState<
    Array<{
      sourceId: string;
      title: string;
      videoCount: number;
      timestamp: string;
    }>
  >([]);
  const [failedChannelsLog, setFailedChannelsLog] = useState<
    Array<{
      sourceId: string;
      title: string;
      error?: string;
      timestamp: string;
    }>
  >([]);

  const stopBackfillRef = useRef(false);

  // Cleanup Dead Videos state
  const [isCleanupRunning, setIsCleanupRunning] = useState(false);
  const [isCleanupStopping, setIsCleanupStopping] = useState(false);
  const [cleanupProcessedCount, setCleanupProcessedCount] = useState(0);
  const [cleanupTotalChannels, setCleanupTotalChannels] = useState<number | null>(null);
  const [cleanupSkippedBatchesCount, setCleanupSkippedBatchesCount] = useState(0);
  const [cleanupVideosCheckedTotal, setCleanupVideosCheckedTotal] = useState(0);
  const [cleanupDeadVideosRemovedTotal, setCleanupDeadVideosRemovedTotal] = useState(0);
  const [cleanupActiveTab, setCleanupActiveTab] = useState<'success' | 'failed'>('success');
  const [cleanupLastBatchDebug, setCleanupLastBatchDebug] = useState<any>(null);
  const [recentCleanupChannels, setRecentCleanupChannels] = useState<
    Array<{
      sourceId: string;
      title: string;
      videosChecked: number;
      deadVideosRemoved: number;
      timestamp: string;
    }>
  >([]);
  const [cleanupFailedChannelsLog, setCleanupFailedChannelsLog] = useState<
    Array<{
      sourceId: string;
      title: string;
      error?: string;
      timestamp: string;
    }>
  >([]);

  const stopCleanupRef = useRef(false);

  // Helper for cleanup interruptible sleep
  const waitWithCleanupCancellation = async (ms: number) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (stopCleanupRef.current) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };

  // Cleanup on unmount for cleanup dead videos
  useEffect(() => {
    return () => {
      stopCleanupRef.current = true;
    };
  }, []);

  // Helper for interruptible sleep
  const waitWithCancellation = async (ms: number) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (stopBackfillRef.current) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopBackfillRef.current = true;
    };
  }, []);

  const handleStartBackfill = async () => {
    if (isBackfillRunning) return;
    setIsBackfillRunning(true);
    setIsBackfillStopping(false);
    stopBackfillRef.current = false;
    setBackfillProcessedCount(0);
    setSkippedBatchesCount(0);
    setRecentProcessedChannels([]);
    setFailedChannelsLog([]);
    setActiveTab('success');

    onNotify('info', 'بدء Backfill الأرشيف العميق', 'جاري جلب الفيديوهات على دفعات مع دعم إعادة المحاولة التلقائية...');

    let accumulatedCount = 0;
    let skippedBatches = 0;
    let consecutiveFailedBatches = 0;
    let isFirstCall = true;

    try {
      while (!stopBackfillRef.current) {
        let res: {
          processedChannels: any[];
          failedChannels?: any[];
          cursorBefore: number;
          cursorAfter: number;
          totalChannels: number;
          wrappedAround: boolean;
        } | null = null;

        const shouldReset = isFirstCall;

        // Try up to 3 total attempts for the current batch
        for (let attempt = 1; attempt <= 3; attempt++) {
          if (stopBackfillRef.current) break;

          try {
            res = await triggerBackfillAllBatch(shouldReset);
            setLastBatchDebug({
              sentReset: shouldReset,
              cursorBefore: res.cursorBefore,
              cursorAfter: res.cursorAfter,
              totalChannels: res.totalChannels,
              wrappedAround: res.wrappedAround,
              processedCount: Array.isArray(res.processedChannels) ? res.processedChannels.length : 0,
              failedCount: Array.isArray(res.failedChannels) ? res.failedChannels.length : 0,
              failedChannelsDetail: Array.isArray(res.failedChannels) ? res.failedChannels : [],
              timestamp: new Date().toLocaleTimeString('ar-EG'),
            });
            break; // Batch call succeeded!
          } catch (batchErr: any) {
            console.warn(`Backfill batch attempt ${attempt}/3 failed:`, batchErr);
            if (stopBackfillRef.current) break;

            if (attempt < 3) {
              // Wait 3 seconds before next retry of the same batch
              await waitWithCancellation(3000);
            }
          }
        }

        // Mark first call as completed so subsequent batches do not reset
        isFirstCall = false;

        // If stopped during requests or retries
        if (stopBackfillRef.current) {
          onNotify('warning', 'تم إيقاف Backfill', `توقفت العملية عند معالجة ${accumulatedCount} قناة.`);
          break;
        }

        // If all 3 attempts failed for this batch
        if (!res) {
          skippedBatches++;
          setSkippedBatchesCount(skippedBatches);
          consecutiveFailedBatches++;

          if (consecutiveFailedBatches >= 3) {
            onNotify(
              'error',
              'توقف Backfill بسبب خطأ متكرر',
              'تعذرت معالجة 3 دفعات متتالية بعد استنفاد محاولات الإعادة (3 محاولات لكل دفعة). يرجى التحقق من اتصال الخادم ومفتاح المشرف.'
            );
            break;
          }

          // Non-fatal: wait 3 seconds before trying next batch
          await waitWithCancellation(3000);
          continue;
        }

        // Batch succeeded -> reset consecutive failures counter
        consecutiveFailedBatches = 0;

        const batchChannels = Array.isArray(res.processedChannels) ? res.processedChannels : [];
        accumulatedCount += batchChannels.length;
        setBackfillProcessedCount(accumulatedCount);

        if (typeof res.totalChannels === 'number') {
          setBackfillTotalChannels(res.totalChannels);
        }

        const nowStr = new Date().toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        // Record successful channels (limit to latest 10, newest first)
        if (batchChannels.length > 0) {
          const mapped = batchChannels.map((c: any) => ({
            sourceId: String(c.sourceId || c.id || ''),
            title: String(c.title || c.name || c.sourceId || 'قناة بدون اسم'),
            videoCount: Number(c.videoCount ?? c.count ?? 0),
            timestamp: nowStr,
          }));

          setRecentProcessedChannels((prev) => {
            const combined = [...mapped.reverse(), ...prev];
            return combined.slice(0, 10);
          });
        }

        // Record failed channels in this batch (if returned in Worker response)
        const failedInBatch = Array.isArray(res.failedChannels) ? res.failedChannels : [];
        if (failedInBatch.length > 0) {
          const mappedFailed = failedInBatch.map((c: any) => ({
            sourceId: String(c.sourceId || c.id || ''),
            title: String(c.title || c.name || c.sourceId || 'قناة بدون اسم'),
            error: String(c.error || c.message || 'تعذر جلب الأرشيف'),
            timestamp: nowStr,
          }));

          setFailedChannelsLog((prev) => {
            const combined = [...mappedFailed.reverse(), ...prev];
            return combined.slice(0, 10);
          });
        }

        // Check if full pass finished
        if (res.wrappedAround) {
          const summaryDesc =
            skippedBatches > 0
              ? `تم الانتهاء من فحص وتحديث أرشيف جميع القنوات (${res.totalChannels || accumulatedCount} قناة) مع تخطي ${skippedBatches} دفعة بسبب مشاكل شبكة.`
              : `تم الانتهاء من فحص وتحديث أرشيف جميع القنوات (${res.totalChannels || accumulatedCount} قناة).`;
          onNotify('success', 'اكتمل Backfill لكل القنوات! ✅', summaryDesc);
          break;
        }

        if (stopBackfillRef.current) {
          onNotify('warning', 'تم إيقاف Backfill', `توقفت العملية عند معالجة ${accumulatedCount} قناة.`);
          break;
        }

        // Wait ~1.5s delay between batch calls
        await waitWithCancellation(1500);

        if (stopBackfillRef.current) {
          onNotify('warning', 'تم إيقاف Backfill', `توقفت العملية عند معالجة ${accumulatedCount} قناة.`);
          break;
        }
      }
    } catch (err: any) {
      console.error('Error in backfill batch loop:', err);
      onNotify('error', 'فشل أثناء Backfill', err?.message || 'خطأ أثناء تنفيذ دفعة Backfill.');
    } finally {
      setIsBackfillRunning(false);
      setIsBackfillStopping(false);
      stopBackfillRef.current = false;
    }
  };

  const handleStopBackfill = () => {
    if (!isBackfillRunning) return;
    setIsBackfillStopping(true);
    stopBackfillRef.current = true;
    onNotify('info', 'جاري إيقاف العملية...', 'سيتم التوقف فور انتهاء المحاولة الحالية.');
  };

  const handleStartCleanup = async () => {
    if (isCleanupRunning) return;
    setIsCleanupRunning(true);
    setIsCleanupStopping(false);
    stopCleanupRef.current = false;
    setCleanupProcessedCount(0);
    setCleanupSkippedBatchesCount(0);
    setCleanupVideosCheckedTotal(0);
    setCleanupDeadVideosRemovedTotal(0);
    setRecentCleanupChannels([]);
    setCleanupFailedChannelsLog([]);
    setCleanupActiveTab('success');

    onNotify('info', 'بدء تنظيف الفيديوهات الميتة', 'جاري فحص فيديوهات الأرشيف على دفعات وحذف الفيديوهات المحذوفة أو الخاصة...');

    let accumulatedChannels = 0;
    let accumulatedVideosChecked = 0;
    let accumulatedDeadVideosRemoved = 0;
    let skippedBatches = 0;
    let consecutiveFailedBatches = 0;
    let isFirstCall = true;

    try {
      while (!stopCleanupRef.current) {
        let res: {
          channelsProcessed: Array<{
            sourceId: string;
            title: string;
            videosChecked: number;
            deadVideosRemoved: number;
          }>;
          totalVideosChecked: number;
          totalDeadVideosRemoved: number;
          cursorBefore: number;
          cursorAfter: number;
          totalChannels: number;
          wrappedAround: boolean;
          failedChannels?: any[];
        } | null = null;

        const shouldReset = isFirstCall;

        // Try up to 3 total attempts for the current batch
        for (let attempt = 1; attempt <= 3; attempt++) {
          if (stopCleanupRef.current) break;

          try {
            res = await triggerCleanupDeadVideosBatch(shouldReset);
            setCleanupLastBatchDebug({
              sentReset: shouldReset,
              cursorBefore: res.cursorBefore,
              cursorAfter: res.cursorAfter,
              totalChannels: res.totalChannels,
              wrappedAround: res.wrappedAround,
              totalVideosChecked: res.totalVideosChecked,
              totalDeadVideosRemoved: res.totalDeadVideosRemoved,
              processedCount: Array.isArray(res.channelsProcessed) ? res.channelsProcessed.length : 0,
              failedCount: Array.isArray(res.failedChannels) ? res.failedChannels.length : 0,
              failedChannelsDetail: Array.isArray(res.failedChannels) ? res.failedChannels : [],
              timestamp: new Date().toLocaleTimeString('ar-EG'),
            });
            break; // Batch call succeeded!
          } catch (batchErr: any) {
            console.warn(`Cleanup batch attempt ${attempt}/3 failed:`, batchErr);
            if (stopCleanupRef.current) break;

            if (attempt < 3) {
              // Wait 3 seconds before next retry of the same batch
              await waitWithCleanupCancellation(3000);
            }
          }
        }

        // Mark first call as completed so subsequent batches do not reset
        isFirstCall = false;

        // If stopped during requests or retries
        if (stopCleanupRef.current) {
          onNotify(
            'warning',
            'تم إيقاف تنظيف الفيديوهات',
            `توقفت العملية عند معالجة ${accumulatedChannels} قناة (فُحص ${accumulatedVideosChecked} فيديو، حُذف ${accumulatedDeadVideosRemoved} فيديو).`
          );
          break;
        }

        // If all 3 attempts failed for this batch
        if (!res) {
          skippedBatches++;
          setCleanupSkippedBatchesCount(skippedBatches);
          consecutiveFailedBatches++;

          if (consecutiveFailedBatches >= 3) {
            onNotify(
              'error',
              'توقف تنظيف الفيديوهات بسبب خطأ متكرر',
              'تعذرت معالجة 3 دفعات متتالية بعد استنفاد محاولات الإعادة (3 محاولات لكل دفعة). يرجى التحقق من اتصال الخادم ومفتاح المشرف.'
            );
            break;
          }

          // Non-fatal: wait 3 seconds before trying next batch
          await waitWithCleanupCancellation(3000);
          continue;
        }

        // Batch succeeded -> reset consecutive failures counter
        consecutiveFailedBatches = 0;

        const batchChannels = Array.isArray(res.channelsProcessed) ? res.channelsProcessed : [];
        accumulatedChannels += batchChannels.length;
        setCleanupProcessedCount(accumulatedChannels);

        const batchChecked = Number(res.totalVideosChecked || 0);
        const batchDead = Number(res.totalDeadVideosRemoved || 0);
        accumulatedVideosChecked += batchChecked;
        accumulatedDeadVideosRemoved += batchDead;
        setCleanupVideosCheckedTotal(accumulatedVideosChecked);
        setCleanupDeadVideosRemovedTotal(accumulatedDeadVideosRemoved);

        if (typeof res.totalChannels === 'number') {
          setCleanupTotalChannels(res.totalChannels);
        }

        const nowStr = new Date().toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        // Record successful channels (limit to latest 10, newest first)
        if (batchChannels.length > 0) {
          const mapped = batchChannels.map((c: any) => ({
            sourceId: String(c.sourceId || c.id || ''),
            title: String(c.title || c.name || c.sourceId || 'قناة بدون اسم'),
            videosChecked: Number(c.videosChecked ?? 0),
            deadVideosRemoved: Number(c.deadVideosRemoved ?? 0),
            timestamp: nowStr,
          }));

          setRecentCleanupChannels((prev) => {
            const combined = [...mapped.reverse(), ...prev];
            return combined.slice(0, 10);
          });
        }

        // Record failed channels in this batch (if returned in Worker response)
        const failedInBatch = Array.isArray(res.failedChannels) ? res.failedChannels : [];
        if (failedInBatch.length > 0) {
          const mappedFailed = failedInBatch.map((c: any) => ({
            sourceId: String(c.sourceId || c.id || ''),
            title: String(c.title || c.name || c.sourceId || 'قناة بدون اسم'),
            error: String(c.error || c.message || 'تعذر فحص الأرشيف'),
            timestamp: nowStr,
          }));

          setCleanupFailedChannelsLog((prev) => {
            const combined = [...mappedFailed.reverse(), ...prev];
            return combined.slice(0, 10);
          });
        }

        // Check if full pass finished
        if (res.wrappedAround) {
          const summaryDesc =
            skippedBatches > 0
              ? `تم الانتهاء من فحص أرشيف جميع القنوات (${res.totalChannels || accumulatedChannels} قناة) مع تخطي ${skippedBatches} دفعة بسبب مشاكل شبكة. تم فحص ${accumulatedVideosChecked} فيديو وحذف ${accumulatedDeadVideosRemoved} فيديو ميت.`
              : `تم الانتهاء من فحص أرشيف جميع القنوات (${res.totalChannels || accumulatedChannels} قناة). تم فحص ${accumulatedVideosChecked} فيديو وحذف ${accumulatedDeadVideosRemoved} فيديو ميت.`;
          onNotify('success', 'اكتمل تنظيف الفيديوهات الميتة! ✅', summaryDesc);
          break;
        }

        if (stopCleanupRef.current) {
          onNotify(
            'warning',
            'تم إيقاف تنظيف الفيديوهات',
            `توقفت العملية عند معالجة ${accumulatedChannels} قناة (فُحص ${accumulatedVideosChecked} فيديو، حُذف ${accumulatedDeadVideosRemoved} فيديو).`
          );
          break;
        }

        // Wait ~1.5s delay between batch calls
        await waitWithCleanupCancellation(1500);

        if (stopCleanupRef.current) {
          onNotify(
            'warning',
            'تم إيقاف تنظيف الفيديوهات',
            `توقفت العملية عند معالجة ${accumulatedChannels} قناة (فُحص ${accumulatedVideosChecked} فيديو، حُذف ${accumulatedDeadVideosRemoved} فيديو).`
          );
          break;
        }
      }
    } catch (err: any) {
      console.error('Error in cleanup batch loop:', err);
      onNotify('error', 'فشل أثناء تنظيف الفيديوهات', err?.message || 'خطأ أثناء تنفيذ الدفعة.');
    } finally {
      setIsCleanupRunning(false);
      setIsCleanupStopping(false);
      stopCleanupRef.current = false;
    }
  };

  const handleStopCleanup = () => {
    if (!isCleanupRunning) return;
    setIsCleanupStopping(true);
    stopCleanupRef.current = true;
    onNotify('info', 'جاري إيقاف العملية...', 'سيتم التوقف فور انتهاء المحاولة الحالية.');
  };

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
              {isBackfillRunning && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                  {isBackfillStopping ? 'جاري الإيقاف...' : 'جاري المعالجة على دفعات...'}
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
              onClick={handleStartBackfill}
              disabled={isBackfillRunning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm shadow-purple-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBackfillRunning && !isBackfillStopping ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>بدء</span>
            </button>

            <button
              id="backfill-stop-btn"
              onClick={handleStopBackfill}
              disabled={!isBackfillRunning || isBackfillStopping}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{isBackfillStopping ? 'جاري الإيقاف...' : 'إيقاف'}</span>
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
                {backfillTotalChannels !== null
                  ? `تمت معالجة ${backfillProcessedCount} من ${backfillTotalChannels} قناة`
                  : `تمت معالجة ${backfillProcessedCount} قناة`}
              </span>
            </div>
            {backfillTotalChannels !== null && backfillTotalChannels > 0 && (
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {Math.min(100, Math.round((backfillProcessedCount / backfillTotalChannels) * 100))}%
              </span>
            )}
          </div>

          {backfillTotalChannels !== null && backfillTotalChannels > 0 && (
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-600 dark:bg-purple-500 rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${Math.min(100, Math.max(0, (backfillProcessedCount / backfillTotalChannels) * 100))}%`,
                }}
              />
            </div>
          )}

          {/* Secondary line when batches were skipped due to network/timeout issues */}
          {skippedBatchesCount > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              <span>تم تخطي {skippedBatchesCount} دفعة بسبب مشاكل شبكة مؤقتة</span>
            </div>
          )}
        </div>

        {/* Diagnostic Debug Block */}
        {lastBatchDebug !== null && (
          <div className="p-3.5 rounded-xl bg-slate-950 text-slate-200 border border-slate-800 font-mono text-xs overflow-x-auto space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-amber-400 font-bold border-b border-slate-800/80 pb-1">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                آخر استجابة للدفعة (Last Batch Response Diagnostics)
              </span>
              <span className="text-slate-400 font-normal text-[10px]">
                {lastBatchDebug.timestamp}
              </span>
            </div>
            <div className="text-slate-300 text-[11px] leading-relaxed break-all">
              آخر استجابة: reset المُرسل = <span className={lastBatchDebug.sentReset ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{String(lastBatchDebug.sentReset)}</span>, cursorBefore = <span className="text-purple-300 font-bold">{lastBatchDebug.cursorBefore}</span>, cursorAfter = <span className="text-purple-300 font-bold">{lastBatchDebug.cursorAfter}</span>, totalChannels = <span className="text-blue-300 font-bold">{lastBatchDebug.totalChannels}</span>, wrappedAround = <span className={lastBatchDebug.wrappedAround ? 'text-amber-400 font-bold' : 'text-slate-400'}>{String(lastBatchDebug.wrappedAround)}</span>, نجح = <span className="text-emerald-400 font-bold">{lastBatchDebug.processedCount}</span>, فشل = <span className={lastBatchDebug.failedCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>{lastBatchDebug.failedCount}</span>, الوقت = <span className="text-slate-300">{lastBatchDebug.timestamp}</span>
            </div>

            {Array.isArray(lastBatchDebug.failedChannelsDetail) && lastBatchDebug.failedChannelsDetail.length > 0 && (
              <div className="pt-1.5 mt-1.5 border-t border-slate-800/80 space-y-1 text-[11px] text-rose-300/90 font-mono">
                {lastBatchDebug.failedChannelsDetail.map((fc: any, idx: number) => {
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
                onClick={() => setActiveTab('success')}
                className={`flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'success'
                    ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <ListVideo className="w-3.5 h-3.5 text-purple-500" />
                <span>آخر القنوات المعالجة (أحدث 10)</span>
                {recentProcessedChannels.length > 0 && (
                  <span className="font-mono text-[10px] px-1.5 py-0.2 bg-purple-200/60 dark:bg-purple-900/60 rounded-full">
                    {recentProcessedChannels.length}
                  </span>
                )}
              </button>

              {failedChannelsLog.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('failed')}
                  className={`flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'failed'
                      ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>تعذر جلبها ({failedChannelsLog.length})</span>
                </button>
              )}
            </div>

            {activeTab === 'success' && recentProcessedChannels.length > 0 && (
              <span className="font-mono text-[11px]">
                {recentProcessedChannels.length} قنوات مسجلة
              </span>
            )}
          </div>

          {activeTab === 'success' ? (
            recentProcessedChannels.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 dark:text-slate-500">
                لم تبدأ المعالجة بعد. اضغط على &quot;بدء&quot; لمعالجة دفعات القنوات.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/40">
                {recentProcessedChannels.map((item, idx) => (
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
              {failedChannelsLog.map((item, idx) => (
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
              {isCleanupRunning && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  {isCleanupStopping ? 'جاري الإيقاف...' : 'جاري الفحص والتنظيف...'}
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
              onClick={handleStartCleanup}
              disabled={isCleanupRunning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm shadow-amber-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCleanupRunning && !isCleanupStopping ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>بدء</span>
            </button>

            <button
              id="cleanup-stop-btn"
              onClick={handleStopCleanup}
              disabled={!isCleanupRunning || isCleanupStopping}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{isCleanupStopping ? 'جاري الإيقاف...' : 'إيقاف'}</span>
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
                {cleanupTotalChannels !== null
                  ? `تمت معالجة ${cleanupProcessedCount} من ${cleanupTotalChannels} قناة`
                  : `تمت معالجة ${cleanupProcessedCount} قناة`}
              </span>
            </div>
            {cleanupTotalChannels !== null && cleanupTotalChannels > 0 && (
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {Math.min(100, Math.round((cleanupProcessedCount / cleanupTotalChannels) * 100))}%
              </span>
            )}
          </div>

          {/* Running total for videos checked and dead videos removed */}
          <div className="flex flex-wrap items-center gap-4 text-xs pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">الإجمالي:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                تم فحص {cleanupVideosCheckedTotal} فيديو، حُذف {cleanupDeadVideosRemovedTotal} فيديو ميت
              </span>
            </div>
          </div>

          {cleanupTotalChannels !== null && cleanupTotalChannels > 0 && (
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-600 dark:bg-amber-500 rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${Math.min(100, Math.max(0, (cleanupProcessedCount / cleanupTotalChannels) * 100))}%`,
                }}
              />
            </div>
          )}

          {/* Secondary line when batches were skipped due to network/timeout issues */}
          {cleanupSkippedBatchesCount > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              <span>تم تخطي {cleanupSkippedBatchesCount} دفعة بسبب مشاكل شبكة مؤقتة</span>
            </div>
          )}
        </div>

        {/* Diagnostic Debug Block */}
        {cleanupLastBatchDebug !== null && (
          <div className="p-3.5 rounded-xl bg-slate-950 text-slate-200 border border-slate-800 font-mono text-xs overflow-x-auto space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-amber-400 font-bold border-b border-slate-800/80 pb-1">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                آخر استجابة للدفعة (Last Batch Response Diagnostics)
              </span>
              <span className="text-slate-400 font-normal text-[10px]">
                {cleanupLastBatchDebug.timestamp}
              </span>
            </div>
            <div className="text-slate-300 text-[11px] leading-relaxed break-all">
              آخر استجابة: reset المُرسل = <span className={cleanupLastBatchDebug.sentReset ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{String(cleanupLastBatchDebug.sentReset)}</span>, cursorBefore = <span className="text-purple-300 font-bold">{cleanupLastBatchDebug.cursorBefore}</span>, cursorAfter = <span className="text-purple-300 font-bold">{cleanupLastBatchDebug.cursorAfter}</span>, totalChannels = <span className="text-blue-300 font-bold">{cleanupLastBatchDebug.totalChannels}</span>, wrappedAround = <span className={cleanupLastBatchDebug.wrappedAround ? 'text-amber-400 font-bold' : 'text-slate-400'}>{String(cleanupLastBatchDebug.wrappedAround)}</span>, totalVideosChecked = <span className="text-cyan-300 font-bold">{cleanupLastBatchDebug.totalVideosChecked}</span>, totalDeadVideosRemoved = <span className="text-rose-400 font-bold">{cleanupLastBatchDebug.totalDeadVideosRemoved}</span>, قنوات فُحصت = <span className="text-emerald-400 font-bold">{cleanupLastBatchDebug.processedCount}</span>, فشل = <span className={cleanupLastBatchDebug.failedCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>{cleanupLastBatchDebug.failedCount}</span>, الوقت = <span className="text-slate-300">{cleanupLastBatchDebug.timestamp}</span>
            </div>

            {Array.isArray(cleanupLastBatchDebug.failedChannelsDetail) && cleanupLastBatchDebug.failedChannelsDetail.length > 0 && (
              <div className="pt-1.5 mt-1.5 border-t border-slate-800/80 space-y-1 text-[11px] text-rose-300/90 font-mono">
                {cleanupLastBatchDebug.failedChannelsDetail.map((fc: any, idx: number) => {
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
                onClick={() => setCleanupActiveTab('success')}
                className={`flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  cleanupActiveTab === 'success'
                    ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <ListVideo className="w-3.5 h-3.5 text-amber-500" />
                <span>آخر القنوات المفحوصة (أحدث 10)</span>
                {recentCleanupChannels.length > 0 && (
                  <span className="font-mono text-[10px] px-1.5 py-0.2 bg-amber-200/60 dark:bg-amber-900/60 rounded-full">
                    {recentCleanupChannels.length}
                  </span>
                )}
              </button>

              {cleanupFailedChannelsLog.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCleanupActiveTab('failed')}
                  className={`flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    cleanupActiveTab === 'failed'
                      ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>قنوات تعذر فحصها</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 bg-rose-200/60 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 rounded-full font-bold">
                    {cleanupFailedChannelsLog.length}
                  </span>
                </button>
              )}
            </div>

            <span className="text-[11px] text-slate-400 hidden sm:inline">
              يتم التحديث تلقائيًا أثناء تشغيل الدفعات
            </span>
          </div>

          {/* Success Tab Content */}
          {cleanupActiveTab === 'success' && (
            <div className="space-y-1.5">
              {recentCleanupChannels.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  لم يتم فحص أي قنوات بعد في هذه الدورة. اضغط &quot;بدء&quot; لتنظيف الأرشيف.
                </div>
              ) : (
                recentCleanupChannels.map((item, idx) => (
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
                      {item.deadVideosRemoved > 0 && (
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
          {cleanupActiveTab === 'failed' && (
            <div className="space-y-1.5">
              {cleanupFailedChannelsLog.map((item, idx) => (
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
