import React, { useEffect, useState } from 'react';
import {
  Archive,
  Ban,
  CheckCircle2,
  FolderPlus,
  Layers,
  Link as LinkIcon,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  Tags,
  Tv,
  Youtube,
} from 'lucide-react';
import {
  addChannel,
  fetchCategories,
  fetchChannelsLatest,
  fetchGlobalBlocks,
  fetchStatus,
  manageBlock,
} from '../services/api';
import { BlockItem, CategoryItem, ChannelItem, StatusResponse } from '../types';
import { channelMatchesCategory } from '../utils/categoryAliases';
import { parseYouTubeInput, resolveYouTubeMetadata } from '../utils/youtube';
import { ChannelArchiveManager } from './ChannelArchiveManager';
import { ConfirmModal } from './ConfirmModal';

interface ChannelsViewProps {
  onNotify: (type: 'success' | 'error' | 'info' | 'warning', title: string, desc?: string) => void;
}

export const ChannelsView: React.FC<ChannelsViewProps> = ({ onNotify }) => {
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [availableCategories, setAvailableCategories] = useState<CategoryItem[]>([]);
  const [globalBlocks, setGlobalBlocks] = useState<BlockItem[]>([]);
  const [statusData, setStatusData] = useState<StatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Add Channel Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [sourceType, setSourceType] = useState<'channel' | 'playlist'>('channel');
  const [title, setTitle] = useState('');
  const [categoriesInput, setCategoriesInput] = useState('');
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  // Block / Unblock Modal State
  const [blockTarget, setBlockTarget] = useState<{
    channel: ChannelItem;
    action: 'block' | 'unblock';
  } | null>(null);
  const [isSubmittingBlock, setIsSubmittingBlock] = useState(false);

  // Archive Manager Modal State
  const [archiveTarget, setArchiveTarget] = useState<{
    sourceId: string;
    sourceType: 'channel' | 'playlist' | string;
    title: string;
  } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Parallel fetch:
      const [latestRes, blocksRes, statusRes, catsRes] = await Promise.allSettled([
        fetchChannelsLatest(),
        fetchGlobalBlocks(),
        fetchStatus(),
        fetchCategories(),
      ]);

      if (latestRes.status === 'fulfilled') {
        setChannels(latestRes.value);
      } else {
        console.error('Error fetching latest channels:', latestRes.reason);
        onNotify('error', 'فشل قراءة قائمة القنوات', latestRes.reason?.message || 'تعذر تحميل القنوات من Worker');
      }

      if (blocksRes.status === 'fulfilled') {
        setGlobalBlocks(blocksRes.value);
      } else {
        console.error('Error fetching global blocks:', blocksRes.reason);
      }

      if (statusRes.status === 'fulfilled') {
        setStatusData(statusRes.value);
      } else {
        console.error('Error fetching status:', statusRes.reason);
      }

      if (catsRes.status === 'fulfilled') {
        setAvailableCategories(catsRes.value);
      }
    } catch (err: any) {
      console.error('Unexpected error fetching channels data:', err);
      onNotify('error', 'خطأ أثناء قراءة البيانات', err?.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle immediate parsing when user enters/pastes a URL or ID
  const handleUrlInputChange = (val: string) => {
    setUrlInput(val);
    setAutoFilled(false);

    if (!val.trim()) {
      return;
    }

    const parsed = parseYouTubeInput(val);
    if (parsed) {
      setSourceType(parsed.sourceType);
      if (!parsed.isHandleOrCustom) {
        setSourceId(parsed.sourceId);
      }
    }
  };

  // Smart resolution from YouTube URL/Handle/ID
  const handleResolveUrl = async () => {
    const raw = urlInput.trim() || sourceId.trim();
    if (!raw) {
      onNotify('warning', 'الرابط مطلوب', 'يرجى إدخال رابط يوتيوب أو المعرف للاستخراج');
      return;
    }

    setIsResolvingUrl(true);
    try {
      const resolved = await resolveYouTubeMetadata(raw);
      setSourceType(resolved.sourceType);
      setSourceId(resolved.sourceId);
      if (resolved.title && (!title || title.trim() === '')) {
        setTitle(resolved.title);
      }
      setAutoFilled(true);
      onNotify(
        'info',
        'تم تحليل الرابط بنجاح',
        `تم استخراج: ${resolved.sourceType === 'playlist' ? 'قائمة تشغيل' : 'قناة'} (${resolved.sourceId})`
      );
    } catch (err: any) {
      console.error('Error resolving YouTube URL:', err);
      onNotify('error', 'تعذر استخراج البيانات تلقائياً', 'يمكنك إدخال المعرف والعنوان يدوياً');
    } finally {
      setIsResolvingUrl(false);
    }
  };

  const handleConfirmBlockToggle = async () => {
    if (!blockTarget) return;
    setIsSubmittingBlock(true);
    const { channel, action } = blockTarget;
    const targetType: 'channel' | 'playlist' =
      channel.sourceType === 'playlist' ? 'playlist' : 'channel';

    try {
      if (action === 'block') {
        await manageBlock({
          action: 'add',
          type: targetType,
          id: channel.sourceId,
        });
        onNotify(
          'success',
          'تم حظر المصدر بنجاح',
          `تم حظر "${channel.title || channel.sourceId}" وإضافتها لقائمة الحظر العام`
        );
      } else {
        await manageBlock({
          action: 'remove',
          type: targetType,
          id: channel.sourceId,
        });
        onNotify(
          'success',
          'تم رفع الحظر بنجاح',
          `تم إلغاء حظر "${channel.title || channel.sourceId}" بنجاح`
        );
      }

      // 4) After block/unblock: refresh fetchGlobalBlocks(). Do not remove row from table.
      const updatedBlocks = await fetchGlobalBlocks();
      setGlobalBlocks(updatedBlocks);
      setBlockTarget(null);
    } catch (err: any) {
      console.error('Error toggling block state:', err);
      onNotify('error', 'فشل تنفيذ الإجراء', err?.message || 'خطأ أثناء الاتصال بالخادم');
    } finally {
      setIsSubmittingBlock(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSourceId = sourceId.trim();
    const cleanTitle = title.trim();

    if (!cleanSourceId || !cleanTitle) {
      onNotify('warning', 'بيانات ناقصة', 'الرجاء إدخال معرّف المصدر وعنوان القناة/القائمة');
      return;
    }

    const categories = categoriesInput
      .split(/[,،]+/)
      .map((c) => c.trim())
      .filter(Boolean);

    setIsSubmittingAdd(true);
    try {
      await addChannel({
        sourceId: cleanSourceId,
        sourceType,
        title: cleanTitle,
        ...(categories.length > 0 ? { categories } : {}),
      });

      onNotify('success', 'تمت إضافة القناة/المصدر بنجاح', `تم حفظ "${cleanTitle}" بنجاح في الـ Worker`);

      // Reset form
      setUrlInput('');
      setSourceId('');
      setTitle('');
      setCategoriesInput('');
      setAutoFilled(false);
      setIsAddOpen(false);

      // Refresh data
      await loadData();
    } catch (err: any) {
      console.error('Error adding channel:', err);
      onNotify('error', 'فشل إضافة القناة', err?.message || 'خطأ أثناء تنفيذ POST /api/admin/channels');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Build a Set of blocked sourceIds for fast O(1) lookup
  const blockedIdSet = new Set(globalBlocks.map((b) => b.id));

  // Filter channels based on search query AND category dropdown
  const filteredChannels = channels.filter((c) => {
    // 1. Category filter
    if (selectedCategoryFilter !== 'all') {
      const selectedCatObj = availableCategories.find(
        (cat) =>
          cat.id === selectedCategoryFilter ||
          cat.name === selectedCategoryFilter ||
          cat.name.toLowerCase().includes(selectedCategoryFilter.toLowerCase())
      );
      const catId = selectedCatObj ? selectedCatObj.id : selectedCategoryFilter;
      const catName = selectedCatObj ? selectedCatObj.name : selectedCategoryFilter;

      if (!channelMatchesCategory(c.categories, catId, catName)) {
        return false;
      }
    }

    // 2. Search query filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = c.title?.toLowerCase().includes(q);
    const idMatch = c.sourceId?.toLowerCase().includes(q);
    const catMatch = c.categories?.some((cat) => cat.toLowerCase().includes(q));
    return titleMatch || idMatch || catMatch;
  });

  // Toggle category pill inside Add Modal
  const toggleCategoryInInput = (catName: string) => {
    const current = categoriesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const exists = current.includes(catName);
    let updated: string[];
    if (exists) {
      updated = current.filter((c) => c !== catName);
    } else {
      updated = [...current, catName];
    }
    setCategoriesInput(updated.join(', '));
  };

  // Summary card "إجمالي القنوات" = status.channelsCount ?? list.length
  const channelsCount =
    statusData?.channelsCount ??
    statusData?.channels_count ??
    channels.length;

  const blockedCount = channels.filter((c) => blockedIdSet.has(c.sourceId)).length;

  return (
    <div id="channels-view-container" className="space-y-6">
      {/* Top Banner / Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              إجمالي القنوات والمصادر
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              {channelsCount}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400">
            <Ban className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              المصادر المحظورة حالياً
            </div>
            <div className="text-2xl font-extrabold text-red-600 dark:text-red-400 font-mono">
              {blockedCount}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              حالة الكاش والاتصال
            </div>
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {statusData?.cache?.cached ? 'مفعل (Cached)' : 'تحديث مباشر'}
            </div>
          </div>
        </div>
      </div>

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 flex-1 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="channels-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالعنوان أو المعرف أو التصنيف..."
              className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Category Filter dropdown */}
          <div className="flex items-center gap-1.5">
            <Tags className="w-4 h-4 text-slate-400 shrink-0 hidden sm:inline" />
            <select
              id="channels-category-filter"
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
            >
              <option value="all">كل التصنيفات ({channels.length})</option>
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({channels.filter((c) => channelMatchesCategory(c.categories, cat.id, cat.name)).length})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="channels-reload-btn"
            onClick={loadData}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
            title="تحديث القائمة والحالة"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
          </button>

          <button
            id="open-add-channel-modal-btn"
            onClick={() => {
              setUrlInput('');
              setSourceId('');
              setTitle('');
              setCategoriesInput('');
              setAutoFilled(false);
              setIsAddOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة قناة / قائمة</span>
          </button>
        </div>
      </div>

      {/* Channels List */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              قائمة القنوات والمصادر المعتمدة ({filteredChannels.length})
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">النوع</th>
                <th className="py-3 px-4">العنوان</th>
                <th className="py-3 px-4">معرّف المصدر (sourceId)</th>
                <th className="py-3 px-4">التصنيفات</th>
                <th className="py-3 px-4 text-center">إجراءات الحظر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading && channels.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    جاري تحميل القنوات من الـ Worker...
                  </td>
                </tr>
              ) : filteredChannels.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    {searchQuery ? 'لا توجد قنوات تطابق البحث' : 'لا توجد قنوات متاحة حالياً.'}
                  </td>
                </tr>
              ) : (
                filteredChannels.map((c) => {
                  const isBlocked = blockedIdSet.has(c.sourceId);

                  return (
                    <tr
                      key={c.sourceId}
                      id={`channel-row-${c.sourceId}`}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        {c.sourceType === 'playlist' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold text-[11px] border border-purple-200 dark:border-purple-900/60">
                            <Youtube className="w-3.5 h-3.5" />
                            <span>قائمة تشغيل</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold text-[11px] border border-amber-200 dark:border-amber-900/60">
                            <Tv className="w-3.5 h-3.5" />
                            <span>قناة</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            id={`manage-archive-btn-${c.sourceId}`}
                            type="button"
                            onClick={() =>
                              setArchiveTarget({
                                sourceId: c.sourceId,
                                sourceType: c.sourceType || 'channel',
                                title: c.title || 'بدون عنوان',
                              })
                            }
                            className="font-bold text-slate-900 dark:text-slate-100 text-sm hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1.5 cursor-pointer text-right group"
                            title="اضغط لإدارة أرشيف وفيديوهات القناة"
                          >
                            <span>{c.title || 'بدون عنوان'}</span>
                            <Archive className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 transition-colors shrink-0" />
                          </button>
                          {isBlocked && (
                            <span
                              id={`channel-blocked-badge-${c.sourceId}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 font-bold text-[10px] border border-red-200 dark:border-red-900/80"
                            >
                              <ShieldAlert className="w-3 h-3" />
                              <span>محظورة</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-600 dark:text-slate-400">
                        {c.sourceId}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(c.categories) && c.categories.length > 0 ? (
                            c.categories.map((cat, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px]"
                              >
                                <Tag className="w-2.5 h-2.5" />
                                <span>{cat}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-[11px]">عام</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isBlocked ? (
                          <button
                            id={`unblock-channel-btn-${c.sourceId}`}
                            onClick={() => setBlockTarget({ channel: c, action: 'unblock' })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 font-bold text-xs transition cursor-pointer"
                            title="إلغاء حظر القناة / القائمة"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>رفع الحظر</span>
                          </button>
                        ) : (
                          <button
                            id={`block-channel-btn-${c.sourceId}`}
                            onClick={() => setBlockTarget({ channel: c, action: 'block' })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/80 font-bold text-xs transition cursor-pointer"
                            title="حظر القناة / القائمة"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>حظر</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Channel Modal */}
      {isAddOpen && (
        <div
          id="add-channel-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
        >
          <div
            id="add-channel-modal"
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <FolderPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  إضافة قناة أو قائمة تشغيل
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  يمكنك لصق رابط يوتيوب العادي وسيقوم النظام باستخراج البيانات تلقائياً
                </p>
              </div>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Smart URL / Input Box */}
              <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 space-y-2">
                <label
                  htmlFor="smart-url-input"
                  className="block text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-amber-600" />
                    رابط القناة أو القائمة (YouTube Link / Handle / ID)
                  </span>
                  {autoFilled && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> تم الاستخراج
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    id="smart-url-input"
                    type="text"
                    dir="ltr"
                    value={urlInput}
                    onChange={(e) => handleUrlInputChange(e.target.value)}
                    placeholder="https://www.youtube.com/@Channel أو رابط قائمة تشغيل أو فيديو..."
                    className="flex-1 px-3 py-2 rounded-xl border border-amber-300/80 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleResolveUrl}
                    disabled={isResolvingUrl || (!urlInput.trim() && !sourceId.trim())}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                    title="استخراج المعرف واسم القناة تلقائياً"
                  >
                    {isResolvingUrl ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span className="whitespace-nowrap">تحليل</span>
                  </button>
                </div>
                <div className="text-[10px] text-amber-800/80 dark:text-amber-400/80">
                  يدعم: روابط القنوات (@handle)، روابط قوائم التشغيل (list=PL...)، روابط الفيديوهات، أو معرّف القناة المباشر (UC...)
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  نوع المصدر
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSourceType('channel')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      sourceType === 'channel'
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-700 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <Tv className="w-4 h-4" />
                    <span>قناة (Channel)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceType('playlist')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      sourceType === 'playlist'
                        ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 text-purple-700 dark:text-purple-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <Youtube className="w-4 h-4" />
                    <span>قائمة تشغيل (Playlist)</span>
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="channel-title-input"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  عنوان القناة / القائمة
                </label>
                <input
                  id="channel-title-input"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: قناة براعم للأطفال"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label
                  htmlFor="channel-source-id-input"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  معرّف المصدر (sourceId)
                </label>
                <input
                  id="channel-source-id-input"
                  type="text"
                  dir="ltr"
                  required
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  placeholder={sourceType === 'channel' ? 'UCxxxxxxxxxxxxxxxx أو @handle' : 'PLxxxxxxxxxxxxxxxx'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label
                  htmlFor="channel-categories-input"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  التصنيفات (اختياري - مفصولة بفاصلة)
                </label>
                <input
                  id="channel-categories-input"
                  type="text"
                  value={categoriesInput}
                  onChange={(e) => setCategoriesInput(e.target.value)}
                  placeholder="تعليمي, قصص, كرتون, أناشيد"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden mb-2"
                />

                {/* Quick Select Category Badges */}
                {availableCategories.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-medium">
                      اضغط للتحديد السريع:
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-0.5">
                      {availableCategories.map((cat) => {
                        const isSelected = categoriesInput
                          .split(',')
                          .map((s) => s.trim().toLowerCase())
                          .includes(cat.name.toLowerCase());
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => toggleCategoryInInput(cat.name)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950 font-bold ring-1 ring-amber-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            + {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  disabled={isSubmittingAdd}
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  id="submit-add-channel-btn"
                  type="submit"
                  disabled={isSubmittingAdd || !sourceId.trim() || !title.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingAdd && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>حفظ وإضافة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Block/Unblock Dialog */}
      <ConfirmModal
        isOpen={!!blockTarget}
        title={blockTarget?.action === 'block' ? 'تأكيد حظر المصدر' : 'تأكيد رفع الحظر'}
        message={
          blockTarget?.action === 'block'
            ? `هل أنت متأكد من حظر "${blockTarget?.channel.title || blockTarget?.channel.sourceId}"؟ سيتم منع ظهور فيديوهات هذا المصدر في تطبيق الأطفال فوراً.`
            : `هل أنت متأكد من رفع الحظر عن "${blockTarget?.channel.title || blockTarget?.channel.sourceId}"؟ سيتم السماح بعرض محتواها مجدداً في تطبيق الأطفال.`
        }
        confirmLabel={blockTarget?.action === 'block' ? 'نعم، حظر المصدر' : 'نعم، رفع الحظر'}
        cancelLabel="تراجع"
        isDestructive={blockTarget?.action === 'block'}
        isLoading={isSubmittingBlock}
        onConfirm={handleConfirmBlockToggle}
        onCancel={() => setBlockTarget(null)}
      />
      {/* Channel Archive Manager Overlay */}
      {archiveTarget && (
        <ChannelArchiveManager
          sourceId={archiveTarget.sourceId}
          sourceType={archiveTarget.sourceType}
          channelTitle={archiveTarget.title}
          onClose={() => setArchiveTarget(null)}
          onNotify={onNotify}
        />
      )}
    </div>
  );
};
