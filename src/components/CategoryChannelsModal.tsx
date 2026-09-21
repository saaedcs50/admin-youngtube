import React, { useEffect, useState } from 'react';
import {
  Ban,
  Check,
  CheckCircle2,
  ExternalLink,
  Film,
  FolderOutput,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Tv,
  X,
} from 'lucide-react';
import {
  addChannel,
  fetchChannelsLatest,
  fetchGlobalBlocks,
  manageBlock,
  removeChannel,
} from '../services/api';
import { ChannelItem } from '../types';
import { channelMatchesCategory } from '../utils/categoryAliases';

export interface CategoryChannelsModalProps {
  categoryId: string;
  categoryName: string;
  allCategories: Array<{ id: string; name: string }>;
  onClose: () => void;
  onNotify: (type: 'success' | 'error' | 'info' | 'warning', title: string, desc?: string) => void;
}

export const CategoryChannelsModal: React.FC<CategoryChannelsModalProps> = ({
  categoryId,
  categoryName,
  allCategories,
  onClose,
  onNotify,
}) => {
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [blockedSet, setBlockedSet] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Per-channel operation states
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Per-channel selected target category for Move / Copy
  const [selectedTargetCat, setSelectedTargetCat] = useState<Record<string, string>>({});

  // Available target categories (excluding current categoryId)
  const otherCategories = allCategories.filter((c) => c.id !== categoryId);
  const defaultTargetId = otherCategories.length > 0 ? otherCategories[0].id : '';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [channelsData, blocksData] = await Promise.all([
        fetchChannelsLatest(),
        fetchGlobalBlocks().catch(() => []),
      ]);

      // Filter channels linked to this category
      const matched = channelsData.filter((ch) =>
        channelMatchesCategory(ch.categories, categoryId, categoryName)
      );

      setChannels(matched);

      // Map blocked source IDs
      const blocked = new Set<string>();
      if (Array.isArray(blocksData)) {
        blocksData.forEach((b) => {
          if (b.id) blocked.add(b.id);
        });
      }
      setBlockedSet(blocked);
    } catch (err: any) {
      console.error('Error loading category channels:', err);
      onNotify('error', 'تعذر تحميل القنوات', err?.message || 'حدث خطأ أثناء قراءة القنوات والمحظورات.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [categoryId, categoryName]);

  // Action A: Delete Channel
  const handleDeleteChannel = async (channel: ChannelItem) => {
    setActionLoadingId(channel.sourceId);
    try {
      await removeChannel(channel.sourceId);
      setChannels((prev) => prev.filter((c) => c.sourceId !== channel.sourceId));
      setConfirmDeleteId(null);
      onNotify('success', 'تم حذف القناة بنجاح', `تمت إزالة القناة "${channel.title}" من النظام.`);
    } catch (err: any) {
      console.error('Error deleting channel:', err);
      onNotify('error', 'فشل حذف القناة', err?.message || 'تعذر حذف القناة.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Action B: Toggle Block Channel
  const handleToggleBlock = async (channel: ChannelItem) => {
    const isCurrentlyBlocked = blockedSet.has(channel.sourceId);
    setActionLoadingId(channel.sourceId);
    try {
      await manageBlock({
        action: isCurrentlyBlocked ? 'remove' : 'add',
        type: 'channel',
        id: channel.sourceId,
      });

      setBlockedSet((prev) => {
        const next = new Set(prev);
        if (isCurrentlyBlocked) {
          next.delete(channel.sourceId);
        } else {
          next.add(channel.sourceId);
        }
        return next;
      });

      onNotify(
        'success',
        isCurrentlyBlocked ? 'تم تفعيل القناة' : 'تم تعطيل القناة',
        isCurrentlyBlocked
          ? `تم إلغاء حظر القناة "${channel.title}".`
          : `تم حظر القناة "${channel.title}".`
      );
    } catch (err: any) {
      console.error('Error toggling block:', err);
      onNotify('error', 'فشل تغيير حالة القناة', err?.message || 'تعذر تحديث الحظر.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Get selected target category ID for a given channel
  const getTargetCatId = (channelId: string) => {
    return selectedTargetCat[channelId] || defaultTargetId;
  };

  // Action C: Move channel to another category
  const handleMoveChannel = async (channel: ChannelItem) => {
    const targetId = getTargetCatId(channel.sourceId);
    if (!targetId) {
      onNotify('warning', 'يرجى اختيار تصنيف', 'اختر التصنيف المستهدف للنقل أولاً.');
      return;
    }

    const targetCatObj = allCategories.find((c) => c.id === targetId);
    const targetName = targetCatObj?.name || targetId;

    setActionLoadingId(channel.sourceId);
    try {
      const existing = Array.isArray(channel.categories) ? channel.categories : [];
      // Remove current categoryId & categoryName from array, add new targetId
      const filtered = existing.filter(
        (c) => c !== categoryId && c !== categoryName && c.toLowerCase() !== categoryId.toLowerCase()
      );
      const newCategories = Array.from(new Set([...filtered, targetId]));

      await addChannel({
        sourceId: channel.sourceId,
        sourceType: channel.sourceType,
        title: channel.title,
        categories: newCategories,
      });

      // Remove from current modal's list since it's no longer in this category
      setChannels((prev) => prev.filter((c) => c.sourceId !== channel.sourceId));
      onNotify('success', 'تم نقل القناة', `تم نقل القناة "${channel.title}" إلى تصنيف "${targetName}".`);
    } catch (err: any) {
      console.error('Error moving channel:', err);
      onNotify('error', 'فشل نقل القناة', err?.message || 'حدث خطأ أثناء نقل القناة.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Action D: Copy channel to another category (keep in current category too)
  const handleCopyChannel = async (channel: ChannelItem) => {
    const targetId = getTargetCatId(channel.sourceId);
    if (!targetId) {
      onNotify('warning', 'يرجى اختيار تصنيف', 'اختر التصنيف المستهدف للنسخ أولاً.');
      return;
    }

    const targetCatObj = allCategories.find((c) => c.id === targetId);
    const targetName = targetCatObj?.name || targetId;

    setActionLoadingId(channel.sourceId);
    try {
      const existing = Array.isArray(channel.categories) ? channel.categories : [];
      const newCategories = Array.from(new Set([...existing, categoryId, targetId]));

      await addChannel({
        sourceId: channel.sourceId,
        sourceType: channel.sourceType,
        title: channel.title,
        categories: newCategories,
      });

      // Update local state categories for this channel
      setChannels((prev) =>
        prev.map((c) => (c.sourceId === channel.sourceId ? { ...c, categories: newCategories } : c))
      );
      onNotify('success', 'تم نسخ القناة للتصنيف', `أصبحت القناة "${channel.title}" تنتمي أيضاً إلى تصنيف "${targetName}".`);
    } catch (err: any) {
      console.error('Error copying channel:', err);
      onNotify('error', 'فشل نسخ القناة', err?.message || 'حدث خطأ أثناء نسخ القناة.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredChannels = channels.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.sourceId && c.sourceId.toLowerCase().includes(q))
    );
  });

  return (
    <div
      id="category-channels-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="category-channels-modal"
        className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
              <FolderOutput className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-slate-100 truncate">
                  قنوات تصنيف: {categoryName}
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  #{categoryId}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                عرض القنوات المرتبطة بهذه المجموّعة، نقلها أو نسخها لتصنيفات أخرى، أو تعطيل وحذف المصادر.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer disabled:opacity-50"
              title="تحديث القائمة"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Search */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في قنوات التصنيف (الاسم أو المعرف)..."
              className="w-full pr-9 pl-4 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold">
              إجمالي القنوات:{' '}
              <span className="font-mono font-extrabold text-amber-600 dark:text-amber-400 text-sm">
                {channels.length} قناة في هذا التصنيف
              </span>
            </span>
            {searchQuery && (
              <span className="text-[11px] text-slate-400">
                (المطابق: <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{filteredChannels.length}</span>)
              </span>
            )}
          </div>
        </div>

        {/* Channels List Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              <p className="text-xs font-medium">جاري قراءة القنوات المرتبطة والتأكد من الحظر...</p>
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500 space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <Tv className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold">
                {searchQuery ? 'لا توجد نتائج تطابق بحثك' : 'لا توجد قنوات مرتبطة بهذا التصنيف حالياً'}
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                يمكنك تخصيص القنوات وإضافتها لهذا التصنيف عبر قسم إدارة القنوات.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/60">
              {filteredChannels.map((channel, idx) => {
                const isBlocked = blockedSet.has(channel.sourceId);
                const isConfirmingDelete = confirmDeleteId === channel.sourceId;
                const isProcessing = actionLoadingId === channel.sourceId;
                const thumb = channel.thumbnail || (channel as any).avatar || (channel as any).thumbnailUrl;

                return (
                  <div
                    key={`${channel.sourceId}-${idx}`}
                    className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Thumbnail & Title info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-center">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={channel.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Tv className="w-6 h-6 text-slate-400" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={
                              channel.sourceType === 'playlist'
                                ? `https://www.youtube.com/playlist?list=${channel.sourceId}`
                                : `https://www.youtube.com/channel/${channel.sourceId}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-amber-600 dark:hover:text-amber-400 transition-colors line-clamp-1"
                            title="عرض على يوتيوب"
                          >
                            {channel.title}
                          </a>
                          <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />

                          {/* Status Badge */}
                          {isBlocked ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                              <Ban className="w-3 h-3" />
                              محظورة
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
                              <CheckCircle2 className="w-3 h-3" />
                              نشطة
                            </span>
                          )}

                          {channel.sourceType === 'playlist' ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                              قائمة تشغيل
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              قناة
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 font-mono">
                          {channel.sourceId}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons & Category Relocation */}
                    <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                      {/* Move / Copy dropdown controls */}
                      {otherCategories.length > 0 && (
                        <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                          <select
                            value={getTargetCatId(channel.sourceId)}
                            onChange={(e) =>
                              setSelectedTargetCat((prev) => ({
                                ...prev,
                                [channel.sourceId]: e.target.value,
                              }))
                            }
                            disabled={isProcessing}
                            className="px-2 py-1 text-xs font-medium rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-amber-500 max-w-[130px] truncate"
                          >
                            {otherCategories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => handleMoveChannel(channel)}
                            disabled={isProcessing}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer disabled:opacity-50"
                            title="نقل القناة لهذا التصنيف وإزالتها من التصنيف الحالي"
                          >
                            نقل
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyChannel(channel)}
                            disabled={isProcessing}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition cursor-pointer disabled:opacity-50"
                            title="إضافة القناة لهذا التصنيف مع الإبقاء عليها في التصنيف الحالي"
                          >
                            نسخ
                          </button>
                        </div>
                      )}

                      {/* Toggle Block Action */}
                      <button
                        type="button"
                        onClick={() => handleToggleBlock(channel)}
                        disabled={isProcessing}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer disabled:opacity-50 ${
                          isBlocked
                            ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300'
                            : 'border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300'
                        }`}
                        title={isBlocked ? 'تفعيل القناة وإلغاء حظرها' : 'تعطيل القناة وحظرها'}
                      >
                        {isBlocked ? (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>تفعيل</span>
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>تعطيل</span>
                          </>
                        )}
                      </button>

                      {/* Delete Action with Inline Confirmation */}
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 animate-in fade-in">
                          <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 px-1">
                            متأكد؟
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteChannel(channel)}
                            disabled={isProcessing}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            <span>نعم</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={isProcessing}
                            className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-semibold text-xs transition cursor-pointer"
                          >
                            لا
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(channel.sourceId)}
                          disabled={isProcessing}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-xs font-semibold transition cursor-pointer disabled:opacity-40"
                          title="حذف القناة بالكامل"
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
            أي تعديلات تُجرى هنا تُحدث فورياً تصنيفات القنوات في Worker وتطبيق الأطفال.
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

export default CategoryChannelsModal;
