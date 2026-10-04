import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Info,
  Loader2,
  Megaphone,
  Plus,
  Power,
  RefreshCw,
  Search,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from 'lucide-react';
import { fetchAnnouncements, postAnnouncement } from '../services/api';
import { AnnouncementItem } from '../types';
import { formatTimestamp } from '../utils/formatters';

interface AnnouncementsViewProps {
  onNotify: (type: 'success' | 'error' | 'info' | 'warning', title: string, desc?: string) => void;
}

export const AnnouncementsView: React.FC<AnnouncementsViewProps> = ({ onNotify }) => {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warning'>('info');
  const [active, setActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toggling loading per item
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadAnnouncements = async () => {
    setIsLoading(true);
    try {
      const list = await fetchAnnouncements();
      setAnnouncements(list);
    } catch (err: any) {
      console.error('Error fetching announcements:', err);
      onNotify('error', 'فشل تحميل الإعلانات', err?.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const openAddModal = () => {
    setId(`ann_${Date.now().toString().slice(-6)}`);
    setTitle('');
    setBody('');
    setSeverity('info');
    setActive(true);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = id.trim();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();

    if (!cleanId || !cleanTitle || !cleanBody) {
      onNotify('warning', 'حقول مطلوبة', 'الرجاء تعبئة معرّف الإعلان والعنوان والنص الكامل');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: AnnouncementItem = {
        id: cleanId,
        title: cleanTitle,
        body: cleanBody,
        severity,
        active,
      };

      await postAnnouncement(payload);

      onNotify('success', 'تم حفظ الإعلان بنجاح', `تم نشر التحديث للإعلان "${cleanTitle}"`);
      setIsModalOpen(false);
      await loadAnnouncements();
    } catch (err: any) {
      console.error('Error saving announcement:', err);
      onNotify('error', 'فشل حفظ الإعلان', err?.message || 'خطأ في الخادم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (item: AnnouncementItem) => {
    setTogglingId(item.id);
    try {
      const updated: AnnouncementItem = {
        ...item,
        active: !item.active,
      };

      await postAnnouncement(updated);

      onNotify(
        'success',
        updated.active ? 'تم تفعيل الإعلان' : 'تم تعطيل الإعلان',
        `أصبح الإعلان "${item.title}" ${updated.active ? 'نشطاً' : 'معطلاً'} الآن`
      );

      // Optimistically update
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, active: updated.active } : a))
      );
    } catch (err: any) {
      console.error('Error toggling announcement active state:', err);
      onNotify('error', 'فشل تعديل حالة الإعلان', err?.message || 'خطأ في الخادم');
    } finally {
      setTogglingId(null);
    }
  };

  const filteredAnnouncements = announcements.filter((a) => {
    if (statusFilter === 'active' && !a.active) return false;
    if (statusFilter === 'inactive' && a.active) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = a.title?.toLowerCase().includes(q);
      const bodyMatch = a.body?.toLowerCase().includes(q);
      const idMatch = a.id?.toLowerCase().includes(q);
      return titleMatch || bodyMatch || idMatch;
    }
    return true;
  });

  return (
    <div id="announcements-view-container" className="space-y-6">
      {/* Top action and filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filters */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              الكل ({announcements.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              النشطة ({announcements.filter((a) => a.active).length})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              المعطلة ({announcements.filter((a) => !a.active).length})
            </button>
          </div>

          <button
            onClick={loadAnnouncements}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
            title="تحديث الإعلانات"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="announcements-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في الإعلانات..."
              className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <button
            id="open-add-announcement-modal-btn"
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إعلان جديد</span>
          </button>
        </div>
      </div>

      {/* Announcements Cards Grid */}
      {isLoading && announcements.length === 0 ? (
        <div className="py-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2 text-amber-500" />
          <span>جاري جلب الإعلانات من /api/announcements...</span>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="py-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-40 text-slate-400" />
          <h4 className="text-base font-bold text-slate-700 dark:text-slate-300">
            {searchQuery ? 'لا توجد إعلانات تطابق البحث' : 'لا توجد إعلانات حالياً'}
          </h4>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            يمكنك إنشاء إعلان جديد وتحديد درجة الخطورة (معلومات أو تحذير) لتظهر لأولياء الأمور
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-sm hover:bg-amber-600 transition"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء أول إعلان</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAnnouncements.map((item) => {
            const isWarning = item.severity === 'warning';
            const isToggling = togglingId === item.id;

            return (
              <div
                key={item.id}
                id={`announcement-card-${item.id}`}
                className={`rounded-2xl border p-5 transition-all shadow-xs relative flex flex-col justify-between ${
                  item.active
                    ? isWarning
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    : 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-70'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {isWarning ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-xs font-bold border border-amber-300 dark:border-amber-700/60">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>تحذير (Warning)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-xs font-bold border border-blue-300 dark:border-blue-700/60">
                          <Info className="w-3.5 h-3.5" />
                          <span>معلومات (Info)</span>
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          item.active
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.active ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        <span>{item.active ? 'نشط' : 'معطل'}</span>
                      </span>
                    </div>

                    <span className="text-[11px] font-mono text-slate-400" title="المعرّف">
                      {item.id}
                    </span>
                  </div>

                  {/* Title & Body */}
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2 leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {item.body}
                  </p>
                </div>

                {/* Footer Controls */}
                <div className="mt-5 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatTimestamp(item.updatedAt || item.createdAt)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      id={`toggle-announcement-btn-${item.id}`}
                      onClick={() => handleToggleActive(item)}
                      disabled={isToggling}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        item.active
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                      }`}
                    >
                      {isToggling ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : item.active ? (
                        <Power className="w-3.5 h-3.5" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>{item.active ? 'تعطيل' : 'تفعيل'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Announcement Modal */}
      {isModalOpen && (
        <div
          id="announcement-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
        >
          <div
            id="announcement-modal"
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Megaphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  إنشاء إعلان أو تنبيه جديد
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  إرسال طلب POST إلى /api/admin/announcements
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  معرّف الإعلان (ID)
                </label>
                <input
                  id="announcement-id-input"
                  type="text"
                  dir="ltr"
                  required
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="مثال: maintenance_alert_01"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  عنوان الإعلان
                </label>
                <input
                  id="announcement-title-input"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: تحديث محتوى قنوات العلوم للأطفال"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نص الإعلان
                </label>
                <textarea
                  id="announcement-body-input"
                  rows={3}
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="اكتب تفاصيل التنبيه أو الرسالة التي ستظهر للمستخدمين..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    درجة الخطورة (Severity)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSeverity('info')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        severity === 'info'
                          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>معلومات (info)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeverity('warning')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        severity === 'warning'
                          ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-700 dark:text-amber-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>تحذير (warning)</span>
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    ملاحظة: مقتصر على info و warning حسب وثائق الـ Worker
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    حالة النشر
                  </label>
                  <button
                    type="button"
                    onClick={() => setActive(!active)}
                    className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      active
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    {active ? <Check className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                    <span>{active ? 'نشط الآن (Active)' : 'مسودة معطلة (Inactive)'}</span>
                  </button>
                </div>
              </div>

              {/* Live Preview Box */}
              {(title || body) && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    <span>معاينة الإعلان كما يظهر للأهل:</span>
                  </div>
                  <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
                    {title || 'عنوان الإعلان'}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {body || 'نص الإعلان...'}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  id="submit-announcement-btn"
                  type="submit"
                  disabled={isSubmitting || !title.trim() || !body.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>حفظ ونشر</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
