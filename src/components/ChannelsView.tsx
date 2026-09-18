import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FolderPlus,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Tv,
  Youtube,
} from 'lucide-react';
import { addChannel, extractChannelsFromStatus, fetchStatus, removeChannel } from '../services/api';
import { ChannelItem, StatusResponse } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface ChannelsViewProps {
  onNotify: (type: 'success' | 'error' | 'info' | 'warning', title: string, desc?: string) => void;
}

export const ChannelsView: React.FC<ChannelsViewProps> = ({ onNotify }) => {
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [statusData, setStatusData] = useState<StatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Channel Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [sourceType, setSourceType] = useState<'channel' | 'playlist'>('channel');
  const [title, setTitle] = useState('');
  const [categoriesInput, setCategoriesInput] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Delete Channel Modal State
  const [itemToDelete, setItemToDelete] = useState<ChannelItem | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch status to see channels count and items if returned
      const statusRes = await fetchStatus();
      setStatusData(statusRes);
      const extracted = extractChannelsFromStatus(statusRes);
      if (extracted.length > 0) {
        setChannels(extracted);
      }
    } catch (err: any) {
      console.error('Error fetching channels status:', err);
      onNotify('error', 'فشل قراءة حالة القنوات', err?.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

      // Optimistically update list
      const newItem: ChannelItem = {
        sourceId: cleanSourceId,
        sourceType,
        title: cleanTitle,
        categories,
        addedAt: Date.now(),
      };
      setChannels((prev) => [newItem, ...prev.filter((c) => c.sourceId !== cleanSourceId)]);

      // Reset form
      setSourceId('');
      setTitle('');
      setCategoriesInput('');
      setIsAddOpen(false);

      // Refresh status
      await loadData();
    } catch (err: any) {
      console.error('Error adding channel:', err);
      onNotify('error', 'فشل إضافة القناة', err?.message || 'خطأ أثناء تنفيذ POST /api/admin/channels');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsSubmittingDelete(true);
    try {
      await removeChannel(itemToDelete.sourceId);

      onNotify('success', 'تم حذف المصدر', `تم حذف "${itemToDelete.title || itemToDelete.sourceId}" بنجاح`);

      setChannels((prev) => prev.filter((c) => c.sourceId !== itemToDelete.sourceId));
      setItemToDelete(null);

      // Refresh status
      await loadData();
    } catch (err: any) {
      console.error('Error removing channel:', err);
      onNotify('error', 'فشل حذف القناة', err?.message || 'خطأ أثناء تنفيذ الحذف');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  const filteredChannels = channels.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = c.title?.toLowerCase().includes(q);
    const idMatch = c.sourceId?.toLowerCase().includes(q);
    const catMatch = c.categories?.some((cat) => cat.toLowerCase().includes(q));
    return titleMatch || idMatch || catMatch;
  });

  const channelsCount =
    statusData?.channels_count ??
    statusData?.channelsCount ??
    channels.length;

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
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <Youtube className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              حالة الكاش والذاكرة
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
              {statusData?.cache?.cached ? 'مفعل (Cached)' : 'تحديث مباشر'}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              التحقق من حالة الـ Worker
            </div>
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {statusData?.status || 'متصل (200 OK)'}
            </div>
          </div>
        </div>
      </div>

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
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
            onClick={() => setIsAddOpen(true)}
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
                <th className="py-3 px-4 text-center">إجراءات</th>
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
                    {searchQuery ? 'لا توجد قنوات تطابق البحث' : 'لا توجد قنوات معروضة حالياً. يمكنك إضافة أول قناة باستخدام الزر أعلاه.'}
                  </td>
                </tr>
              ) : (
                filteredChannels.map((c) => (
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
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {c.title || 'بدون عنوان'}
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
                      <button
                        id={`delete-channel-btn-${c.sourceId}`}
                        onClick={() => setItemToDelete(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                        title="حذف القناة من المنصة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
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
                  إضافة قناة أو قائمة تشغيل معتمدة
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  إرسال طلب POST إلى /api/admin/channels
                </p>
              </div>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
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
                  placeholder={sourceType === 'channel' ? 'UCxxxxxxxxxxxxxxxx' : 'PLxxxxxxxxxxxxxxxx'}
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
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

      {/* Confirm Delete Dialog */}
      <ConfirmModal
        isOpen={!!itemToDelete}
        title="تأكيد حذف القناة"
        message={`هل أنت متأكد من حذف (${itemToDelete?.title || itemToDelete?.sourceId}) من مصادر المنصة؟ لن تظهر محتوياتها بعد الآن.`}
        confirmLabel="نعم، حذف القناة"
        cancelLabel="تراجع"
        isDestructive={true}
        isLoading={isSubmittingDelete}
        onConfirm={handleConfirmDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};
