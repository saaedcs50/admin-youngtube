import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FolderLock,
  Link as LinkIcon,
  ListFilter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Tv,
  Youtube,
} from 'lucide-react';
import { fetchGlobalBlocks, manageBlock } from '../services/api';
import { BlockItem } from '../types';
import { parseYouTubeInput, resolveYouTubeMetadata } from '../utils/youtube';
import { ConfirmModal } from './ConfirmModal';

interface BlocksViewProps {
  onNotify: (type: 'success' | 'error' | 'info' | 'warning', title: string, desc?: string) => void;
}

export const BlocksView: React.FC<BlocksViewProps> = ({ onNotify }) => {
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'channel' | 'playlist'>('all');

  // Add Block Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [newId, setNewId] = useState('');
  const [newType, setNewType] = useState<'channel' | 'playlist'>('channel');
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  // Delete Block Confirmation Modal
  const [blockToDelete, setBlockToDelete] = useState<BlockItem | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  const loadBlocks = async () => {
    setIsLoading(true);
    try {
      const list = await fetchGlobalBlocks();
      setBlocks(list);
    } catch (err: any) {
      console.error('Error loading blocks:', err);
      onNotify('error', 'فشل تحميل قائمة الحظر', err?.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBlocks();
  }, []);

  const handleUrlInputChange = (val: string) => {
    setUrlInput(val);
    setAutoFilled(false);

    if (!val.trim()) return;

    const parsed = parseYouTubeInput(val);
    if (parsed) {
      setNewType(parsed.sourceType);
      if (!parsed.isHandleOrCustom) {
        setNewId(parsed.sourceId);
      }
    }
  };

  const handleResolveUrl = async () => {
    const raw = urlInput.trim() || newId.trim();
    if (!raw) {
      onNotify('warning', 'الرابط مطلوب', 'يرجى إدخال رابط يوتيوب أو المعرف للاستخراج');
      return;
    }

    setIsResolvingUrl(true);
    try {
      const resolved = await resolveYouTubeMetadata(raw);
      setNewType(resolved.sourceType);
      setNewId(resolved.sourceId);
      setAutoFilled(true);
      onNotify(
        'info',
        'تم تحليل الرابط بنجاح',
        `تم استخراج: ${resolved.sourceType === 'playlist' ? 'قائمة تشغيل' : 'قناة'} (${resolved.sourceId})`
      );
    } catch (err: any) {
      console.error('Error resolving YouTube URL:', err);
      onNotify('error', 'تعذر استخراج البيانات تلقائياً', 'يمكنك إدخال المعرف يدوياً');
    } finally {
      setIsResolvingUrl(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newId.trim();
    if (!cleanId) {
      onNotify('warning', 'حقل المعرّف مطلوب', 'الرجاء إدخال معرّف القناة أو قائمة التشغيل');
      return;
    }

    setIsSubmittingAdd(true);
    try {
      await manageBlock({
        action: 'add',
        type: newType,
        id: cleanId,
      });

      onNotify(
        'success',
        'تمت إضافة الحظر بنجاح',
        `تم حظر الـ ${newType === 'channel' ? 'قناة' : 'قائمة التشغيل'} ذات المعرف ${cleanId}`
      );
      setUrlInput('');
      setNewId('');
      setAutoFilled(false);
      setIsAddOpen(false);
      await loadBlocks();
    } catch (err: any) {
      console.error('Error adding block:', err);
      onNotify('error', 'فشل إضافة الحظر', err?.message || 'تحقق من المفتاح وصلاحيات الـ Worker');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!blockToDelete) return;
    setIsSubmittingDelete(true);
    try {
      await manageBlock({
        action: 'remove',
        type: blockToDelete.type,
        id: blockToDelete.id,
      });

      onNotify(
        'success',
        'تم رفع الحظر بنجاح',
        `تم إلغاء حظر الـ ${blockToDelete.type === 'channel' ? 'قناة' : 'قائمة التشغيل'} (${blockToDelete.id})`
      );
      setBlockToDelete(null);
      await loadBlocks();
    } catch (err: any) {
      console.error('Error deleting block:', err);
      onNotify('error', 'فشل رفع الحظر', err?.message || 'خطأ أثناء الاتصال بالخادم');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  const filteredBlocks = blocks.filter((item) => {
    // Type filter
    if (typeFilter !== 'all' && item.type !== typeFilter) {
      return false;
    }
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const idMatch = item.id.toLowerCase().includes(q);
      const titleMatch = item.title?.toLowerCase().includes(q) || false;
      return idMatch || titleMatch;
    }
    return true;
  });

  return (
    <div id="blocks-view-container" className="space-y-6">
      {/* Top Banner / Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter pills */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              الكل ({blocks.length})
            </button>
            <button
              onClick={() => setTypeFilter('channel')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                typeFilter === 'channel'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              قنوات ({blocks.filter((b) => b.type === 'channel').length})
            </button>
            <button
              onClick={() => setTypeFilter('playlist')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                typeFilter === 'playlist'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              قوائم تشغيل ({blocks.filter((b) => b.type === 'playlist').length})
            </button>
          </div>

          <button
            onClick={loadBlocks}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
            title="تحديث قائمة الحظر"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="blocks-search-input"
              type="text"
              dir="ltr"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالمعرّف ID..."
              className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-mono"
            />
          </div>

          {/* Add block button */}
          <button
            id="open-add-block-modal-btn"
            onClick={() => {
              setUrlInput('');
              setNewId('');
              setAutoFilled(false);
              setIsAddOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-sm shadow-red-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة حظر</span>
          </button>
        </div>
      </div>

      {/* Info Callout */}
      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-slate-900 dark:text-slate-100">الحظر الشامل (Global Blocks):</span>{' '}
          أي قناة أو قائمة تشغيل مضافة هنا ستُحظر تماماً من الظهور في تطبيق YoungTube للأطفال لكافة المستخدمين. يتم التحقق وتطبيق الحظر مباشرة عبر الـ Worker.
        </div>
      </div>

      {/* Blocks List / Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderLock className="w-5 h-5 text-red-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              العناصر المحظورة حالياً ({filteredBlocks.length})
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">النوع</th>
                <th className="py-3 px-4">المعرّف (ID)</th>
                <th className="py-3 px-4">الاسم / العنوان</th>
                <th className="py-3 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading && blocks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    جاري تحميل قائمة الحظر من الـ Worker...
                  </td>
                </tr>
              ) : filteredBlocks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    {searchQuery ? 'لا توجد عناصر تطابق معايير البحث' : 'قائمة الحظر فارغة حالياً (لم يتم حظر أي قنوات أو قوائم)'}
                  </td>
                </tr>
              ) : (
                filteredBlocks.map((item) => (
                  <tr
                    key={item.id}
                    id={`block-row-${item.id}`}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      {item.type === 'playlist' ? (
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
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {item.id}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {item.title || '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        id={`delete-block-btn-${item.id}`}
                        onClick={() => setBlockToDelete(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900/80 text-xs font-semibold transition cursor-pointer"
                        title="رفع الحظر"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>رفع الحظر</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Block Modal */}
      {isAddOpen && (
        <div
          id="add-block-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
        >
          <div
            id="add-block-modal"
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  إضافة عنصر إلى الحظر الشامل
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  يمكنك لصق رابط يوتيوب أو إدخال المعرف مباشرة
                </p>
              </div>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Smart URL / Input Box */}
              <div className="p-3 rounded-xl bg-red-50/60 dark:bg-red-950/30 border border-red-200/80 dark:border-red-900/50 space-y-2">
                <label
                  htmlFor="smart-block-url-input"
                  className="block text-xs font-bold text-red-900 dark:text-red-300 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-red-600" />
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
                    id="smart-block-url-input"
                    type="text"
                    dir="ltr"
                    value={urlInput}
                    onChange={(e) => handleUrlInputChange(e.target.value)}
                    placeholder="https://www.youtube.com/@Channel أو رابط قائمة..."
                    className="flex-1 px-3 py-2 rounded-xl border border-red-300/80 dark:border-red-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-red-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleResolveUrl}
                    disabled={isResolvingUrl || (!urlInput.trim() && !newId.trim())}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                    title="استخراج المعرف تلقائياً"
                  >
                    {isResolvingUrl ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span className="whitespace-nowrap">تحليل</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  نوع العنصر
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewType('channel')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      newType === 'channel'
                        ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-700 dark:text-rose-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <Tv className="w-4 h-4" />
                    <span>قناة (Channel)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewType('playlist')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      newType === 'playlist'
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
                  htmlFor="block-id-input"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  المعرّف ID
                </label>
                <input
                  id="block-id-input"
                  type="text"
                  dir="ltr"
                  required
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  placeholder={newType === 'channel' ? 'UCxxxxxxxxxxxxxxxx أو @handle' : 'PLxxxxxxxxxxxxxxxx'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-red-500 focus:outline-hidden"
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
                  id="submit-add-block-btn"
                  type="submit"
                  disabled={isSubmittingAdd || !newId.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingAdd && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>تأكيد الحظر</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!blockToDelete}
        title="تأكيد رفع الحظر"
        message={`هل أنت متأكد من رفع الحظر عن الـ ${blockToDelete?.type === 'channel' ? 'قناة' : 'قائمة التشغيل'} ذات المعرّف (${blockToDelete?.id})؟ ستصبح متاحة مجدداً للأطفال.`}
        confirmLabel="نعم، رفع الحظر"
        cancelLabel="تراجع"
        isDestructive={false}
        isLoading={isSubmittingDelete}
        onConfirm={handleConfirmDelete}
        onCancel={() => setBlockToDelete(null)}
      />
    </div>
  );
};
