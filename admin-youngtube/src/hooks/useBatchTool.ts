import { useEffect, useRef, useState } from 'react';

export interface BatchSuccessItem {
  sourceId: string;
  title: string;
  timestamp: string;
  [key: string]: any;
}

export interface BatchFailedItem {
  sourceId: string;
  title: string;
  error?: string;
  timestamp: string;
  [key: string]: any;
}

export interface InterpretResult<TResult> {
  /** Array of processed channel/item records from this batch */
  successItems?: any[];
  /** Array of failed channel/item records from this batch */
  failedItems?: any[];
  /** Total count of channels in system */
  totalChannels?: number;
  /** Whether the full sweep/pass completed and wrapped around */
  wrappedAround: boolean;
  /** Whether a single item/channel is complete (defaults to true if undefined) */
  channelComplete?: boolean;
  /** Current channel title if mid-progress */
  currentChannelTitle?: string | null;
  /** Number of channels to add to processed count (defaults to 1 or successItems.length) */
  processedDelta?: number;
  /** Custom metrics to accumulate (e.g., { videosChecked: 10, deadVideosRemoved: 2 }) */
  metricsDelta?: Record<string, number>;
  /** Custom fields to include in debug payload */
  debugExtra?: Record<string, any>;
}

export interface BatchToolMessages {
  startTitle?: string;
  startDesc?: string;
  completeTitle?: string;
  getCompleteDesc?: (ctx: {
    totalChannels: number;
    processedCount: number;
    skippedBatches: number;
    metrics: Record<string, number>;
  }) => string;
  stoppedTitle?: string;
  getStoppedDesc?: (ctx: {
    processedCount: number;
    metrics: Record<string, number>;
  }) => string;
  consecutiveFailuresTitle?: string;
  consecutiveFailuresDesc?: string;
  loopErrorTitle?: string;
}

export interface UseBatchToolOptions<TResult> {
  name: string;
  runOnce: (args: { reset: boolean }) => Promise<TResult>;
  interpret: (result: TResult) => InterpretResult<TResult>;
  onNotify: (type: 'success' | 'error' | 'info' | 'warning', title: string, desc?: string) => void;
  messages?: BatchToolMessages;
  intervalMs?: number;
}

export function useBatchTool<TResult = any>(options: UseBatchToolOptions<TResult>) {
  const [isRunning, setIsRunning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalChannels, setTotalChannels] = useState<number | null>(null);
  const [skippedBatchesCount, setSkippedBatchesCount] = useState(0);
  const [currentChannelTitle, setCurrentChannelTitle] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'success' | 'failed'>('success');
  const [lastBatchDebug, setLastBatchDebug] = useState<any>(null);
  const [recentSuccesses, setRecentSuccesses] = useState<BatchSuccessItem[]>([]);
  const [recentFailures, setRecentFailures] = useState<BatchFailedItem[]>([]);

  const stopRef = useRef(false);
  const processedCountRef = useRef(0);
  const skippedBatchesRef = useRef(0);
  const metricsRef = useRef<Record<string, number>>({});
  const wrappedAroundRef = useRef(false);

  // Helper for interruptible delay between batch ticks
  const waitWithCancellation = async (ms: number) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (stopRef.current) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  };

  // Clean up on unmount (set abort flag)
  useEffect(() => {
    return () => {
      stopRef.current = true;
    };
  }, []);

  const start = async (opts?: { reset?: boolean }) => {
    if (isRunning) return;
    setIsRunning(true);
    setIsStopping(false);
    stopRef.current = false;

    const isReset = opts?.reset === true || wrappedAroundRef.current;
    if (isReset) {
      wrappedAroundRef.current = false;
      processedCountRef.current = 0;
      skippedBatchesRef.current = 0;
      metricsRef.current = {};
      setProcessedCount(0);
      setSkippedBatchesCount(0);
      setCurrentChannelTitle(null);
      setMetrics({});
      setRecentSuccesses([]);
      setRecentFailures([]);
    }
    setActiveTab('success');

    if (options.messages?.startTitle) {
      options.onNotify('info', options.messages.startTitle, options.messages.startDesc);
    }

    let accumulatedProcessed = isReset ? 0 : processedCountRef.current;
    let accumulatedSkippedBatches = isReset ? 0 : skippedBatchesRef.current;
    let consecutiveFailedBatches = 0;
    let isFirstCall = true;
    const accumulatedMetrics: Record<string, number> = isReset
      ? {}
      : { ...metricsRef.current };

    try {
      while (!stopRef.current) {
        let res: TResult | null = null;
        const shouldReset = opts?.reset ?? isFirstCall;

        // Try up to 3 total attempts for the current batch
        for (let attempt = 1; attempt <= 3; attempt++) {
          if (stopRef.current) break;
          try {
            res = await options.runOnce({ reset: shouldReset });
            break;
          } catch (err: any) {
            console.warn(`[${options.name}] Batch attempt ${attempt}/3 failed:`, err);
            if (stopRef.current) break;
            if (attempt < 3) {
              await waitWithCancellation(3000);
            }
          }
        }

        isFirstCall = false;

        // Check if stopped during retry or request
        if (stopRef.current) {
          if (options.messages?.stoppedTitle) {
            const desc = options.messages.getStoppedDesc
              ? options.messages.getStoppedDesc({
                  processedCount: accumulatedProcessed,
                  metrics: accumulatedMetrics,
                })
              : `توقفت العملية عند معالجة ${accumulatedProcessed} قناة.`;
            options.onNotify('warning', options.messages.stoppedTitle, desc);
          }
          break;
        }

        // If all 3 attempts failed for this batch (skipped batch)
        if (!res) {
          accumulatedSkippedBatches++;
          skippedBatchesRef.current = accumulatedSkippedBatches;
          setSkippedBatchesCount(accumulatedSkippedBatches);
          consecutiveFailedBatches++;

          // Emit network warning on skipped batch without resetting cumulative counters
          options.onNotify(
            'warning',
            'تحذير شبكة: تم تخطي دفعة',
            `تعذرت معالجة الدفعة بعد 3 محاولات. سيتم المتابعة تلقائيًا مع الحفاظ على العدادات الحالية (${accumulatedProcessed} قناة).`
          );

          if (consecutiveFailedBatches >= 3) {
            options.onNotify(
              'error',
              options.messages?.consecutiveFailuresTitle || 'توقفت العملية بسبب خطأ متكرر',
              options.messages?.consecutiveFailuresDesc ||
                'تعذرت معالجة 3 دفعات متتالية بعد استنفاد محاولات الإعادة (3 محاولات لكل دفعة). يرجى التحقق من اتصال الخادم ومفتاح المشرف.'
            );
            break;
          }

          await waitWithCancellation(3000);
          continue;
        }

        // Batch call succeeded -> reset consecutive failure counter
        consecutiveFailedBatches = 0;

        const info = options.interpret(res);

        const nowStr = new Date().toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        // Diagnostics debug state update
        setLastBatchDebug({
          sentReset: shouldReset,
          cursorBefore: (res as any).cursorBefore,
          cursorAfter: (res as any).cursorAfter,
          totalChannels: (res as any).totalChannels,
          wrappedAround: info.wrappedAround,
          processedCount: Array.isArray(info.successItems) ? info.successItems.length : 0,
          failedCount: Array.isArray(info.failedItems) ? info.failedItems.length : 0,
          failedChannelsDetail: Array.isArray(info.failedItems) ? info.failedItems : [],
          timestamp: nowStr,
          ...(info.debugExtra || {}),
        });

        if (typeof info.totalChannels === 'number') {
          setTotalChannels(info.totalChannels);
        }

        // Accumulate domain metrics
        if (info.metricsDelta) {
          for (const [k, v] of Object.entries(info.metricsDelta)) {
            accumulatedMetrics[k] = (accumulatedMetrics[k] || 0) + (Number(v) || 0);
          }
          metricsRef.current = { ...accumulatedMetrics };
          setMetrics({ ...accumulatedMetrics });
        }

        // Check channel complete state for mid-progress title
        const isChannelComplete = info.channelComplete !== false;
        if (info.channelComplete === false) {
          setCurrentChannelTitle(info.currentChannelTitle || 'قناة جاري معالجتها');
        } else {
          setCurrentChannelTitle(null);
        }

        // Update processed count if complete
        if (isChannelComplete) {
          const delta =
            typeof info.processedDelta === 'number'
              ? info.processedDelta
              : Array.isArray(info.successItems) && info.successItems.length > 0
              ? info.successItems.length
              : 1;
          accumulatedProcessed += delta;
          processedCountRef.current = accumulatedProcessed;
          setProcessedCount(accumulatedProcessed);
        }

        // Record successful channels (limit to latest 10, newest first)
        if (Array.isArray(info.successItems) && info.successItems.length > 0) {
          const mappedSuccess = info.successItems.map((c: any) => ({
            ...c,
            sourceId: String(c.sourceId || c.id || ''),
            title: String(c.title || c.name || c.sourceId || 'قناة بدون اسم'),
            timestamp: nowStr,
          }));
          setRecentSuccesses((prev) => [...mappedSuccess.reverse(), ...prev].slice(0, 10));
        }

        // Record failed channels in this batch
        if (Array.isArray(info.failedItems) && info.failedItems.length > 0) {
          const mappedFailures = info.failedItems.map((c: any) => ({
            ...c,
            sourceId: String(c.sourceId || c.id || ''),
            title: String(c.title || c.name || c.sourceId || 'قناة بدون اسم'),
            error: String(c.error || c.message || 'تعذر معالجة الأرشيف'),
            timestamp: nowStr,
          }));
          setRecentFailures((prev) => [...mappedFailures.reverse(), ...prev].slice(0, 10));
        }

        // Check if full pass wrapped around
        if (info.wrappedAround) {
          wrappedAroundRef.current = true;
          const desc = options.messages?.getCompleteDesc
            ? options.messages.getCompleteDesc({
                totalChannels: info.totalChannels || accumulatedProcessed,
                processedCount: accumulatedProcessed,
                skippedBatches: accumulatedSkippedBatches,
                metrics: accumulatedMetrics,
              })
            : `تم الانتهاء من معالجة جميع القنوات (${info.totalChannels || accumulatedProcessed} قناة).`;
          options.onNotify('success', options.messages?.completeTitle || 'اكتملت العملية! ✅', desc);
          break;
        }

        if (stopRef.current) {
          if (options.messages?.stoppedTitle) {
            const desc = options.messages.getStoppedDesc
              ? options.messages.getStoppedDesc({
                  processedCount: accumulatedProcessed,
                  metrics: accumulatedMetrics,
                })
              : `توقفت العملية عند معالجة ${accumulatedProcessed} قناة.`;
            options.onNotify('warning', options.messages.stoppedTitle, desc);
          }
          break;
        }

        // Wait interval between batch calls (default 1.5s)
        await waitWithCancellation(options.intervalMs ?? 1500);

        if (stopRef.current) {
          if (options.messages?.stoppedTitle) {
            const desc = options.messages.getStoppedDesc
              ? options.messages.getStoppedDesc({
                  processedCount: accumulatedProcessed,
                  metrics: accumulatedMetrics,
                })
              : `توقفت العملية عند معالجة ${accumulatedProcessed} قناة.`;
            options.onNotify('warning', options.messages.stoppedTitle, desc);
          }
          break;
        }
      }
    } catch (err: any) {
      console.error(`Error in [${options.name}] batch loop:`, err);
      options.onNotify(
        'error',
        options.messages?.loopErrorTitle || 'فشل أثناء التنفيذ',
        err?.message || 'خطأ أثناء تنفيذ الدفعة.'
      );
    } finally {
      setIsRunning(false);
      setIsStopping(false);
      stopRef.current = false;
      setCurrentChannelTitle(null);
    }
  };

  const stop = () => {
    if (!isRunning) return;
    setIsStopping(true);
    stopRef.current = true;
    options.onNotify('info', 'جاري إيقاف العملية...', 'سيتم التوقف فور انتهاء المحاولة الحالية.');
  };

  const handleStart = (opts?: { reset?: boolean } | unknown) => {
    const isReset = typeof opts === 'object' && opts !== null && 'reset' in opts && (opts as any).reset === true;
    return start({ reset: isReset });
  };

  return {
    isRunning,
    isStopping,
    processedCount,
    totalChannels,
    skippedBatchesCount,
    currentChannelTitle,
    metrics,
    activeTab,
    setActiveTab,
    lastBatchDebug,
    recentSuccesses,
    recentFailures,
    recentProcessedItems: recentSuccesses,
    failedItemsLog: recentFailures,
    start: handleStart,
    stop,
  };
}

export default useBatchTool;
