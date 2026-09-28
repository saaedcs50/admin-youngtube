import React, { ReactNode, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Film,
  ListVideo,
  Loader2,
  Play,
  RefreshCw,
  Square,
  Terminal,
} from 'lucide-react';

export interface BatchToolLike {
  isRunning: boolean;
  isStopping: boolean;
  processedCount: number;
  totalChannels: number | null;
  skippedBatchesCount: number;
  currentChannelTitle?: string | null;
  metrics: Record<string, number>;
  activeTab: 'success' | 'failed';
  setActiveTab: (tab: 'success' | 'failed') => void;
  lastBatchDebug?: any;
  recentSuccesses?: any[];
  recentProcessedItems?: any[];
  recentFailures?: any[];
  failedItemsLog?: any[];
  start: (opts?: { reset?: boolean } | any) => Promise<void> | void;
  stop: () => void;
}

export interface BatchToolCardProps {
  id: string;
  cardId?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  tool: BatchToolLike;
  metricLabels?: Record<string, string>;
  renderMetrics?: (metrics: Record<string, number>) => ReactNode;
  primaryButtonLabel?: string;
  resetButtonLabel?: string;
  renderSuccessExtra?: (item: any) => ReactNode;
  renderFailureExtra?: (item: any) => ReactNode;
}

export const BatchToolCard: React.FC<BatchToolCardProps> = ({
  id,
  cardId,
  title,
  description,
  icon,
  tool,
  metricLabels,
  renderMetrics,
  primaryButtonLabel = 'بدء',
  resetButtonLabel,
  renderSuccessExtra,
  renderFailureExtra,
}) => {
  const [isDebugExpanded, setIsDebugExpanded] = useState(true);

  const successItems = tool.recentProcessedItems || tool.recentSuccesses || [];
  const failedItems = tool.failedItemsLog || tool.recentFailures || [];

  const hasMetrics = Object.keys(tool.metrics || {}).length > 0;
  const isPartialChannel =
    tool.lastBatchDebug?.channelComplete === false || Boolean(tool.currentChannelTitle);

  return (
    <div
      id={cardId || `${id}-card`}
      className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-5"
    >
      {/* 1. Header: title + description + status pill + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            {icon && (
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                {icon}
              </div>
            )}
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">{title}</h3>

            {/* Status Pill (idle / running / stopping) */}
            {tool.isRunning ? (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                {tool.isStopping ? 'جاري الإيقاف...' : 'جاري المعالجة على دفعات...'}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                جاهز (متوقف)
              </span>
            )}
          </div>

          {description && (
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>

        {/* 4. Actions: Start, Optional Reset, Stop */}
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
          <button
            id={`${id}-start-btn`}
            type="button"
            onClick={() => tool.start()}
            disabled={tool.isRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm shadow-amber-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tool.isRunning && !tool.isStopping ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{primaryButtonLabel}</span>
          </button>

          {resetButtonLabel && (
            <button
              id={`${id}-reset-btn`}
              type="button"
              onClick={() => tool.start({ reset: true })}
              disabled={tool.isRunning}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="إعادة الفحص من الصفر (reset)"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{resetButtonLabel}</span>
            </button>
          )}

          <button
            id={`${id}-stop-btn`}
            type="button"
            onClick={tool.stop}
            disabled={!tool.isRunning || tool.isStopping}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>{tool.isStopping ? 'جاري الإيقاف...' : 'إيقاف'}</span>
          </button>
        </div>
      </div>

      {/* 2. Progress Display */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">حالة التقدم:</span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
              {tool.totalChannels !== null
                ? `تم معالجة ${tool.processedCount} من ${tool.totalChannels} قناة`
                : `تمت معالجة ${tool.processedCount} قناة`}
            </span>
          </div>

          {tool.totalChannels !== null && tool.totalChannels > 0 && (
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
              {Math.min(100, Math.round((tool.processedCount / tool.totalChannels) * 100))}%
            </span>
          )}
        </div>

        {/* 3. Metrics row */}
        {hasMetrics && (
          <div className="flex flex-wrap items-center gap-4 text-xs pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-500 dark:text-slate-400">الإجمالي:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 flex-wrap">
                {renderMetrics ? (
                  renderMetrics(tool.metrics)
                ) : (
                  Object.entries(tool.metrics).map(([key, val], idx) => {
                    const label = metricLabels?.[key] || key;
                    return (
                      <span key={key} className="inline-flex items-center gap-1">
                        {idx > 0 && <span className="text-slate-400 mx-1">—</span>}
                        <span>
                          {label}: <span className="font-mono text-amber-600 dark:text-amber-400">{val}</span>
                        </span>
                      </span>
                    );
                  })
                )}
              </span>
            </div>
          </div>
        )}

        {/* Partial channel notice */}
        {isPartialChannel && (
          <div
            id={`${id}-channel-partial-notice`}
            className="flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-900/50"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-amber-600 dark:text-amber-400" />
            <span>نفس القناة قيد المعالجة (دفعة جزئية) — المؤشر لن يزيد حتى تكتمل القناة.</span>
            {tool.currentChannelTitle && (
              <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80 font-mono">
                ({tool.currentChannelTitle})
              </span>
            )}
          </div>
        )}

        {/* Progress Bar */}
        {tool.totalChannels !== null && tool.totalChannels > 0 && (
          <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-600 dark:bg-amber-500 rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${Math.min(100, Math.max(0, (tool.processedCount / tool.totalChannels) * 100))}%`,
              }}
            />
          </div>
        )}

        {/* Skipped Batches Count Warning */}
        {tool.skippedBatchesCount > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
            <span>تم تخطي {tool.skippedBatchesCount} دفعة بسبب مشاكل شبكة مؤقتة</span>
          </div>
        )}
      </div>

      {/* 7. Collapsible lastBatchDebug Diagnostics */}
      {tool.lastBatchDebug && (
        <div className="p-3.5 rounded-xl bg-slate-950 text-slate-200 border border-slate-800 font-mono text-xs overflow-x-auto space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-amber-400 font-bold border-b border-slate-800/80 pb-1">
            <button
              type="button"
              onClick={() => setIsDebugExpanded((prev) => !prev)}
              className="flex items-center gap-1.5 cursor-pointer hover:text-amber-300 transition-colors"
            >
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              <span>آخر استجابة للدفعة (Last Batch Diagnostics)</span>
              {isDebugExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            <span className="text-slate-400 font-normal text-[10px]">
              {tool.lastBatchDebug.timestamp}
            </span>
          </div>

          {isDebugExpanded && (
            <>
              <div className="text-slate-300 text-[11px] leading-relaxed break-all">
                آخر استجابة: reset المُرسل ={' '}
                <span
                  className={
                    tool.lastBatchDebug.sentReset ? 'text-emerald-400 font-bold' : 'text-slate-400'
                  }
                >
                  {String(tool.lastBatchDebug.sentReset)}
                </span>
                {tool.lastBatchDebug.cursorBefore !== undefined && (
                  <>
                    , cursorBefore ={' '}
                    <span className="text-purple-300 font-bold">
                      {String(tool.lastBatchDebug.cursorBefore)}
                    </span>
                  </>
                )}
                {tool.lastBatchDebug.cursorAfter !== undefined && (
                  <>
                    , cursorAfter ={' '}
                    <span className="text-purple-300 font-bold">
                      {String(tool.lastBatchDebug.cursorAfter)}
                    </span>
                  </>
                )}
                {tool.lastBatchDebug.totalChannels !== undefined && (
                  <>
                    , totalChannels ={' '}
                    <span className="text-blue-300 font-bold">
                      {tool.lastBatchDebug.totalChannels}
                    </span>
                  </>
                )}
                {tool.lastBatchDebug.channelComplete !== undefined && (
                  <>
                    , channelComplete ={' '}
                    <span
                      className={
                        tool.lastBatchDebug.channelComplete === false
                          ? 'text-amber-400 font-bold'
                          : 'text-emerald-400 font-bold'
                      }
                    >
                      {String(tool.lastBatchDebug.channelComplete)}
                    </span>
                  </>
                )}
                {tool.lastBatchDebug.wrappedAround !== undefined && (
                  <>
                    , wrappedAround ={' '}
                    <span
                      className={
                        tool.lastBatchDebug.wrappedAround
                          ? 'text-amber-400 font-bold'
                          : 'text-slate-400'
                      }
                    >
                      {String(tool.lastBatchDebug.wrappedAround)}
                    </span>
                  </>
                )}
                {tool.lastBatchDebug.videosCheckedThisCall !== undefined && (
                  <>
                    , videosCheckedThisCall ={' '}
                    <span className="text-cyan-300 font-bold">
                      {tool.lastBatchDebug.videosCheckedThisCall}
                    </span>
                  </>
                )}
                {tool.lastBatchDebug.totalVideosChecked !== undefined && (
                  <>
                    , totalVideosChecked ={' '}
                    <span className="text-cyan-300 font-bold">
                      {tool.lastBatchDebug.totalVideosChecked}
                    </span>
                  </>
                )}
                , نجح ={' '}
                <span className="text-emerald-400 font-bold">
                  {tool.lastBatchDebug.processedCount ?? 0}
                </span>
                , فشل ={' '}
                <span
                  className={
                    (tool.lastBatchDebug.failedCount ?? 0) > 0
                      ? 'text-rose-400 font-bold'
                      : 'text-slate-400'
                  }
                >
                  {tool.lastBatchDebug.failedCount ?? 0}
                </span>
                , الوقت = <span className="text-slate-300">{tool.lastBatchDebug.timestamp}</span>
              </div>

              {Array.isArray(tool.lastBatchDebug.failedChannelsDetail) &&
                tool.lastBatchDebug.failedChannelsDetail.length > 0 && (
                  <div className="pt-1.5 mt-1.5 border-t border-slate-800/80 space-y-1 text-[11px] text-rose-300/90 font-mono">
                    {tool.lastBatchDebug.failedChannelsDetail.map((fc: any, idx: number) => {
                      const idOrTitle = fc.sourceId || fc.title || `قناة #${idx + 1}`;
                      const errType = fc.error || 'other';
                      const extra =
                        fc.status !== undefined
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
            </>
          )}
        </div>
      )}

      {/* 5. Tabs & 6. Lists */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => tool.setActiveTab('success')}
              className={`flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                tool.activeTab === 'success'
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <ListVideo className="w-3.5 h-3.5 text-amber-500" />
              <span>آخر القنوات المعالجة (أحدث 10)</span>
              {successItems.length > 0 && (
                <span className="font-mono text-[10px] px-1.5 py-0.2 bg-amber-200/60 dark:bg-amber-900/60 rounded-full">
                  {successItems.length}
                </span>
              )}
            </button>

            {failedItems.length > 0 && (
              <button
                type="button"
                onClick={() => tool.setActiveTab('failed')}
                className={`flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  tool.activeTab === 'failed'
                    ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                <span>تعذر معالجتها</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 bg-rose-200/60 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 rounded-full font-bold">
                  {failedItems.length}
                </span>
              </button>
            )}
          </div>

          <span className="text-[11px] text-slate-400 hidden sm:inline">
            يتم التحديث تلقائيًا أثناء تشغيل الدفعات
          </span>
        </div>

        {/* Success Tab Content */}
        {tool.activeTab === 'success' && (
          <div className="space-y-1.5">
            {successItems.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 dark:text-slate-500">
                لم تبدأ المعالجة بعد. اضغط على &quot;{primaryButtonLabel}&quot; لمعالجة دفعات القنوات.
              </div>
            ) : (
              successItems.map((item, idx) => (
                <div
                  key={`${item.sourceId || idx}-${idx}-${item.timestamp || ''}`}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800/60 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {item.title || 'قناة بدون اسم'}
                    </span>
                    {item.sourceId && (
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 hidden sm:inline truncate">
                        ({item.sourceId})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Render extra details */}
                    {renderSuccessExtra ? (
                      renderSuccessExtra(item)
                    ) : (
                      <>
                        {item.videoCount !== undefined && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-semibold flex items-center gap-1">
                            <Film className="w-3 h-3" />
                            {item.videoCount} فيديو
                          </span>
                        )}
                        {item.videosChecked !== undefined && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-mono text-[11px] font-semibold">
                            فُحص {item.videosChecked} فيديو
                          </span>
                        )}
                        {(item.deadVideosRemoved ?? 0) > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-mono text-[11px] font-semibold">
                            حُذف {item.deadVideosRemoved} ميت
                          </span>
                        )}
                        {((item.removedShortDuration ?? 0) > 0 ||
                          (item.removedPortrait ?? 0) > 0) && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-mono text-[11px] font-semibold">
                            حُذف {item.removedShortDuration ?? 0} قصير /{' '}
                            {item.removedPortrait ?? 0} عمودي
                          </span>
                        )}
                      </>
                    )}

                    {item.timestamp && (
                      <span className="text-[10px] font-mono text-slate-400">{item.timestamp}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Failed Tab Content */}
        {tool.activeTab === 'failed' && (
          <div className="space-y-1.5">
            {failedItems.map((item, idx) => (
              <div
                key={`failed-${item.sourceId || idx}-${idx}-${item.timestamp || ''}`}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/40 dark:border-rose-900/40 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="font-semibold text-rose-900 dark:text-rose-200 truncate">
                    {item.title || 'قناة بدون اسم'}
                  </span>
                  {item.sourceId && (
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 hidden sm:inline truncate">
                      ({item.sourceId})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {renderFailureExtra ? (
                    renderFailureExtra(item)
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-mono text-[11px] font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {item.error || 'تعذر المعالجة'}
                    </span>
                  )}
                  {item.timestamp && (
                    <span className="text-[10px] font-mono text-slate-400">{item.timestamp}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchToolCard;
