import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
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
  Tv,
  Zap,
} from 'lucide-react';
import { fetchStatus, getWorkerUrl, triggerBackfillAllBatch } from '../services/api';
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
  const [recentProcessedChannels, setRecentProcessedChannels] = useState<
    Array<{
      sourceId: string;
      title: string;
      videoCount: number;
      timestamp: string;
    }>
  >([]);

  const stopBackfillRef = useRef(false);

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
    setRecentProcessedChannels([]);

    onNotify('info', 'بدء Backfill الأرشيف العميق', 'جاري جلب الفيديوهات على دفعات (5 قنوات في كل دفعة)...');

    try {
      let accumulatedCount = 0;
      while (!stopBackfillRef.current) {
        const res = await triggerBackfillAllBatch();

        const batchChannels = Array.isArray(res?.processedChannels) ? res.processedChannels : [];
        accumulatedCount += batchChannels.length;
        setBackfillProcessedCount(accumulatedCount);

        if (typeof res?.totalChannels === 'number') {
          setBackfillTotalChannels(res.totalChannels);
        }

        if (batchChannels.length > 0) {
          const nowStr = new Date().toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
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

        // Check if full pass finished
        if (res?.wrappedAround) {
          onNotify(
            'success',
            'اكتمل Backfill لكل القنوات! ✅',
            `تم الانتهاء من فحص وتحديث أرشيف جميع القنوات (${res.totalChannels || accumulatedCount} قناة).`
          );
          break;
        }

        // If stopped during request
        if (stopBackfillRef.current) {
          onNotify('warning', 'تم إيقاف Backfill', `توقفت العملية عند معالجة ${accumulatedCount} قناة.`);
          break;
        }

        // Wait ~1.5s delay between batch calls
        await new Promise((resolve) => setTimeout(resolve, 1500));

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
    onNotify('info', 'جاري إيقاف العملية...', 'سيتم التوقف فور اكتمال الدفعة الحالية الجارية.');
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
          <div className="flex items-center justify-between text-xs">
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
        </div>

        {/* Live-updating small log of the last few processed channel titles (most recent 10) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5 font-semibold">
              <ListVideo className="w-3.5 h-3.5 text-purple-500" />
              <span>آخر القنوات المعالجة (أحدث 10):</span>
            </div>
            {recentProcessedChannels.length > 0 && (
              <span className="font-mono text-[11px]">
                {recentProcessedChannels.length} قنوات مسجلة
              </span>
            )}
          </div>

          {recentProcessedChannels.length === 0 ? (
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
