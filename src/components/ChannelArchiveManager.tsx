import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Archive,
  ArrowUpDown,
  Calendar,
  Check,
  ExternalLink,
  Film,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Tv,
  X,
  Youtube,
  Zap,
} from 'lucide-react';
import {
  BackfillChannelResponse,
  deleteChannelVideo,
  fetchChannelArchive,
  triggerChannelBackfill,
} from '../services/api';
import { formatTimestamp } from '../utils/formatters';

export interface ArchiveVideoItem {
  id?: string;
  videoId?: string;
  title?: string;
  publishedAt?: string | number;
  published_at?: string | number;
  addedAt?: string | number;
  [key: string]: any;
}

interface ChannelArchiveManagerProps {
  sourceId: string;
  sourceType?: 'channel' | 'playlist' | string;
  channelTitle: string;
  onClose: () => void;
  onNotify: (type: 'success' | 'error' | 'info' | 'warning', title: string, desc?: string) => void;
}

export const ChannelArchiveManager: React.FC<ChannelArchiveManagerProps> = ({
  sourceId,
  sourceType = 'channel',
  channelTitle,
  onClose,
  onNotify,
}) => {
  const [videos, setVideos] = useState<ArchiveVideoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [hasMore, setHasMore] = useState<boolean | null>(null);

  // Load archive data on mount or sourceId change
  const loadArchive = async (isRefetch: boolean = false) => {
    if (!isRefetch) {
      setIsLoading(true);
    }
    try {
      const data = await fetchChannelArchive(sourceId);
      // The worker may return { items: [...] } or { videos: [...] } or an array directly
      let list: ArchiveVideoItem[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.items)) {
        list = data.items;
      } else if (data && Array.isArray(data.videos)) {
        list = data.videos;
      } else if (data && Array.isArray((data as any).archive)) {
        list = (data as any).archive;
      }

      setVideos(list);
    } catch (err: any) {
      console.error('Error loading channel archive:', err);
      onNotify('error', 'تعذر جلب أرشيف القناة', err?.message || 'حدث خطأ أثناء قراءة الفيديوهات.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadArchive();
  }, [sourceId]);

  // Handle deep backfill
  const handleDeepBackfill = async (reset: boolean = false) => {
    if (isBackfilling) return;
    setIsBackfilling(true);
    onNotify(
      'info',
      reset ? 'إعادة جلب الأرشيف من البداية...' : 'بدء تعميق الأرشيف...',
      'جاري جلب الفيديوهات عبر خادم الإنتاج وتحديث الأرشيف...'
    );
    try {
      let res: BackfillChannelResponse;
      try {
        res = await triggerChannelBackfill(sourceId, reset);
        const resErr = String(res?.error || res?.message || '');
        if (!reset && /invalid\s*page\s*token/i.test(resErr)) {
          throw new Error(resErr);
        }
      } catch (firstErr: any) {
        const errMsg = String(firstErr?.message || '');
        // On error containing invalidPageToken / invalid page token: retry once with reset:true
        if (!reset && /invalid\s*page\s*token/i.test(errMsg)) {
          console.warn('Invalid page token detected, retrying once with reset:true...', firstErr);
          res = await triggerChannelBackfill(sourceId, true);
        } else {
          throw firstErr;
        }
      }
      const added = typeof res?.addedVideosCount === 'number'
        ? res.addedVideosCount
        : (typeof res?.added === 'number' ? res.added : 0);
      const total = typeof res?.totalVideosInArchive === 'number'
        ? res.totalVideosInArchive
        : (typeof res?.total === 'number' ? res.total : 0);
      const fetched = typeof res?.fetchedFromYoutubeCount === 'number'
        ? res.fetchedFromYoutubeCount
        : undefined;
      const hasMoreAvailable = Boolean(res?.hasMore);

      setHasMore(hasMoreAvailable);

      if (added > 0) {
        let desc = `أُضيف جديد: ${added}. إجمالي الأرشيف: ${total}.`;
        if (typeof fetched === 'number' && fetched !== added) {
          desc += ` (جُلب من يوتيوب: ${fetched}).`;
        }
        onNotify('success', 'تم تعميق الأرشيف بنجاح', desc);
      } else if (hasMoreAvailable) {
        onNotify(
          'info',
          'دفعة الأرشيف',
          'لا فيديوهات جديدة في هذه الدفعة؛ يوجد المزيد — اضغط تعميق مرة أخرى.'
        );
      } else {
        onNotify(
          'success',
          'اكتمال الأرشيف',
          'الأرشيف مكتمل لهذا المصدر (لا صفحات تالية).'
        );
      }

      // Reload archive list via GET /api/channel-archive?id=
      await loadArchive(true);
    } catch (err: any) {
      console.error('Error during channel backfill:', err);
      const errMsg = String(err?.message || '');
      if (errMsg.includes('no_api_key')) {
        onNotify(
          'error',
          'تعذّر الجلب',
          'تعذّر الجلب — تحقق من مفتاح YouTube على السيرفر أو أعد المحاولة.'
        );
      } else {
        onNotify(
          'error',
          'فشل تعميق الأرشيف',
          err?.message || 'تعذّر الجلب — تحقق من مفتاح YouTube على السيرفر أو أعد المحاولة.'
        );
      }
    } finally {
      setIsBackfilling(false);
    }
  };

  // Handle video delete
  const handleDeleteVideo = async (videoId: string) => {
    setDeletingVideoId(videoId);
    try {
      await deleteChannelVideo(sourceId, videoId);
      // Remove video row from state
      setVideos((prev) =>
        prev.filter((v) => {
          const id = v.videoId || v.id;
          return id !== videoId;
        })
      );
      setConfirmDeleteId(null);
      onNotify('success', 'تم حذف الفيديو من الأرشيف', `تمت إزالة الفيديو (${videoId}) بنجاح.`);
    } catch (err: any) {
      console.error('Error deleting video:', err);
      onNotify('error', 'فشل حذف الفيديو', err?.message || 'تعذر حذف الفيديو من الأرشيف.');
    } finally {
      setDeletingVideoId(null);
    }
  };

  // Filtered videos
  const filteredVideos = videos.filter((v) => {
    const vidId = String(v.videoId || v.id || '').toLowerCase();
    const vidTitle = String(v.title || '').toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return vidId.includes(q) || vidTitle.includes(q);
  });

  return (
    <div
      id="channel-archive-manager-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="channel-archive-manager-modal"
        className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
              <Archive className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-slate-100 truncate">
                  إدارة أرشيف: {channelTitle}
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {sourceId}
                </span>
                {sourceType === 'playlist' ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50">
                    قائمة تشغيل
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                    قناة
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                عرض وإدارة فيديوهات الأرشيف، حذف فيديوهات فردية، وتعميق الأرشيف لجلب المحتوى القديم
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
            {/* Deep Backfill Button */}
            <button
              id="channel-archive-backfill-btn"
              type="button"
              onClick={() => handleDeepBackfill(false)}
              disabled={isBackfilling || isLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-sm shadow-amber-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="تعميق الأرشيف واستيراد الفيديوهات القديمة من يوتيوب"
            >
              {isBackfilling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 fill-current" />
              )}
              <span>
                {isBackfilling
                  ? 'جاري التعميق...'
                  : hasMore
                  ? 'تعميق دفعة إضافية'
                  : 'تعميق الأرشيف'}
              </span>
            </button>

            {/* Reset / From scratch button */}
            <button
              id="channel-archive-reset-btn"
              type="button"
              onClick={() => handleDeepBackfill(true)}
              disabled={isBackfilling || isLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium transition cursor-pointer disabled:opacity-50"
              title="إعادة جلب الأرشيف من البداية وتحديث مؤشر الصفحات"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة من الصفر</span>
            </button>

            {/* Refresh Button */}
            <button
              id="channel-archive-refresh-btn"
              type="button"
              onClick={() => loadArchive(true)}
              disabled={isLoading || isBackfilling}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer disabled:opacity-50"
              title="تحديث القائمة"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* Close Button */}
            <button
              id="channel-archive-close-btn"
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* HasMore Notice Banner */}
        {hasMore && (
          <div
            id="channel-archive-hasmore-banner"
            className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200 animate-in fade-in"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 fill-current" />
              <span className="font-medium">تم جلب دفعة — اضغط تعميق مرة أخرى للمزيد.</span>
            </div>
            <button
              id="channel-archive-deepen-more-btn"
              type="button"
              onClick={() => handleDeepBackfill(false)}
              disabled={isBackfilling}
              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isBackfilling ? 'جاري الجلب...' : 'تعميق دفعة إضافية'}
            </button>
          </div>
        )}

        {/* Toolbar & Search */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="channel-archive-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في فيديوهات الأرشيف (العنوان أو المعرف)..."
              className="w-full pr-9 pl-4 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">
              إجمالي الفيديوهات:{' '}
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                {videos.length}
              </span>
            </span>
            {searchQuery && (
              <span className="text-[11px] text-slate-400">
                (المطابق:{' '}
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                  {filteredVideos.length}
                </span>
                )
              </span>
            )}
          </div>
        </div>

        {/* Body Video List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              <p className="text-xs font-medium">جاري قراءة فيديوهات الأرشيف...</p>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500 space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <Film className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold">
                {searchQuery ? 'لا توجد نتائج تطابق بحثك' : 'لا توجد فيديوهات في أرشيف هذه القناة بعد'}
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                يمكنك الضغط على زر &quot;تعميق الأرشيف&quot; أعلاه لجلب فيديوهات القناة تلقائياً من يوتيوب.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/60">
              {filteredVideos.map((v, idx) => {
                const videoId = String(v.videoId || v.id || '');
                const publishedAt = v.publishedAt || v.published_at;
                const isConfirming = confirmDeleteId === videoId;
                const isDeleting = deletingVideoId === videoId;

                return (
                  <div
                    key={`${videoId}-${idx}`}
                    id={`archive-video-row-${videoId}`}
                    className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Thumbnail + Video Info */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Thumbnail with fallback */}
                      <div className="relative w-24 h-14 sm:w-28 sm:h-16 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200/80 dark:border-slate-700/60">
                        {videoId ? (
                          <img
                            src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
                            alt={v.title || videoId}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              // If mqdefault fails, hide img and fallback
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <Film className="w-5 h-5" />
                          </div>
                        )}
                        <span className="absolute bottom-1 right-1 font-mono text-[9px] bg-slate-950/70 text-slate-200 px-1 rounded-sm">
                          {idx + 1}
                        </span>
                      </div>

                      {/* Title & Metadata */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <a
                            href={`https://www.youtube.com/watch?v=${videoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 hover:text-amber-600 dark:hover:text-amber-400 transition-colors line-clamp-2"
                            title="مشاهدة على يوتيوب"
                          >
                            {v.title || `فيديو ${videoId}`}
                          </a>
                          <ExternalLink className="w-3 h-3 text-slate-400 shrink-0 inline-block" />
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-sm text-slate-600 dark:text-slate-300">
                            {videoId}
                          </span>
                          {publishedAt && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{formatTimestamp(publishedAt)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Delete Action with Inline Confirm */}
                    <div className="flex items-center justify-end sm:justify-center shrink-0 self-end sm:self-center">
                      {isConfirming ? (
                        <div
                          id={`inline-confirm-delete-${videoId}`}
                          className="flex items-center gap-2 p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 animate-in fade-in"
                        >
                          <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 px-1">
                            متأكد؟
                          </span>
                          <button
                            id={`confirm-delete-yes-${videoId}`}
                            type="button"
                            onClick={() => handleDeleteVideo(videoId)}
                            disabled={isDeleting}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            <span>نعم</span>
                          </button>
                          <button
                            id={`confirm-delete-no-${videoId}`}
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={isDeleting}
                            className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-semibold text-xs transition cursor-pointer"
                          >
                            لا
                          </button>
                        </div>
                      ) : (
                        <button
                          id={`delete-video-btn-${videoId}`}
                          type="button"
                          onClick={() => setConfirmDeleteId(videoId)}
                          disabled={deletingVideoId !== null}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-xs font-semibold transition cursor-pointer disabled:opacity-40"
                          title="حذف هذا الفيديو من الأرشيف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            يتم تخزين فيديوهات الأرشيف على KV ويتم تحديثها دورياً عبر المجدول (Cron).
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChannelArchiveManager;
