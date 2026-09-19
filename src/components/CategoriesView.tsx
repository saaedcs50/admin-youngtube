import React, { useEffect, useState } from 'react';
import {
  Atom,
  BookOpen,
  Bot,
  Compass,
  Dumbbell,
  Edit2,
  Film,
  FolderPlus,
  Gamepad2,
  GraduationCap,
  Heart,
  HelpCircle,
  Layers,
  Lightbulb,
  Loader2,
  Music,
  Palette,
  Plus,
  RefreshCw,
  Search,
  Smile,
  Sparkles,
  Star,
  Tag,
  Tags,
  Trash2,
  Tv,
} from 'lucide-react';
import {
  deleteCategory,
  fetchCategories,
  fetchChannelsLatest,
  INITIAL_DEFAULT_CATEGORIES,
  saveCategory,
} from '../services/api';
import { CategoryItem, ChannelItem } from '../types';
import { channelMatchesCategory } from '../utils/categoryAliases';
import { ConfirmModal } from './ConfirmModal';

// Available icons library for categories
export const AVAILABLE_ICONS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  BookOpen: { label: 'كتاب / قرآن', icon: BookOpen, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800' },
  Sparkles: { label: 'قصص وحكايات', icon: Sparkles, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800' },
  Smile: { label: 'كرتون ومرح', icon: Smile, color: 'text-sky-500 bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800' },
  GraduationCap: { label: 'تعليم ولغات', icon: GraduationCap, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800' },
  Atom: { label: 'علوم وتجارب', icon: Atom, color: 'text-teal-500 bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800' },
  Palette: { label: 'رسم وفنون', icon: Palette, color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800' },
  Dumbbell: { label: 'رياضة ونشاط', icon: Dumbbell, color: 'text-orange-500 bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-800' },
  Music: { label: 'أناشيد وموسيقى', icon: Music, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800' },
  Gamepad2: { label: 'ألعاب وذكاء', icon: Gamepad2, color: 'text-violet-500 bg-violet-50 dark:bg-violet-950/60 border-violet-200 dark:border-violet-800' },
  Heart: { label: 'أخلاق وسلوك', icon: Heart, color: 'text-pink-500 bg-pink-50 dark:bg-pink-950/60 border-pink-200 dark:border-pink-800' },
  Film: { label: 'أفلام ومسلسلات', icon: Film, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800' },
  Star: { label: 'مميز ومفضل', icon: Star, color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-950/60 border-yellow-200 dark:border-yellow-800' },
  Compass: { label: 'استكشاف وعالم', icon: Compass, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800' },
  Lightbulb: { label: 'ابتكار وأفكار', icon: Lightbulb, color: 'text-lime-500 bg-lime-50 dark:bg-lime-950/60 border-lime-200 dark:border-lime-800' },
  Bot: { label: 'تقنية وذكاء', icon: Bot, color: 'text-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/60 border-fuchsia-200 dark:border-fuchsia-800' },
  Tag: { label: 'تصنيف عام', icon: Tag, color: 'text-slate-500 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
};

interface CategoriesViewProps {
  onNotify: (type: 'success' | 'error' | 'info' | 'warning', title: string, desc?: string) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({ onNotify }) => {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [idInput, setIdInput] = useState('');
  const [iconInput, setIconInput] = useState('BookOpen');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation Modal
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cats, chs] = await Promise.all([
        fetchCategories(),
        fetchChannelsLatest().catch(() => []),
      ]);
      setCategories(cats);
      setChannels(chs);
    } catch (err: any) {
      console.error('Error loading categories:', err);
      onNotify('error', 'فشل قراءة التصنيفات', err?.message || 'تعذر تحميل التصنيفات من الـ Worker');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calculate channels count per category using alias matching
  const getChannelCountForCategory = (cat: CategoryItem): number => {
    return channels.filter((ch) => channelMatchesCategory(ch.categories, cat.id, cat.name)).length;
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditId('');
    setNameInput('');
    setIdInput('');
    setIconInput('BookOpen');
    setDescriptionInput('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: CategoryItem) => {
    setIsEditing(true);
    setEditId(cat.id);
    setNameInput(cat.name);
    setIdInput(cat.id);
    setIconInput(cat.icon || 'Tag');
    setDescriptionInput(cat.description || '');
    setIsModalOpen(true);
  };

  // Auto-generate English slug from Arabic name if ID is empty
  const handleNameChange = (val: string) => {
    setNameInput(val);
    if (!isEditing && (!idInput || idInput === slugify(nameInput))) {
      setIdInput(slugify(val));
    }
  };

  const slugify = (text: string) => {
    const arabicToEngMap: Record<string, string> = {
      قرآن: 'quran',
      قصص: 'stories',
      حكايات: 'stories',
      كرتون: 'cartoons',
      اناشيد: 'nasheed',
      أناشيد: 'nasheed',
      تعليم: 'education',
      علوم: 'science',
      رسم: 'crafts',
      فنون: 'arts',
      رياضة: 'sports',
      العاب: 'games',
      ألعاب: 'games',
    };

    const trimmed = text.trim().toLowerCase();
    for (const [ar, en] of Object.entries(arabicToEngMap)) {
      if (trimmed.includes(ar)) return en;
    }

    return trimmed
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'category-' + Math.floor(Math.random() * 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameInput.trim();
    const cleanId = idInput.trim().toLowerCase();

    if (!cleanName || !cleanId) {
      onNotify('warning', 'بيانات غير مكتملة', 'يرجى إدخال اسم التصنيف والمعرف');
      return;
    }

    setIsSubmitting(true);
    try {
      const categoryData: CategoryItem = {
        id: cleanId,
        name: cleanName,
        icon: iconInput,
        description: descriptionInput.trim(),
        order: isEditing
          ? categories.find((c) => c.id === editId)?.order || 1
          : categories.length + 1,
        updatedAt: Date.now(),
      };

      await saveCategory(categoryData);
      onNotify(
        'success',
        isEditing ? 'تم تحديث التصنيف بنجاح' : 'تمت إضافة التصنيف بنجاح',
        `التصنيف "${cleanName}" أصبح متاحاً الآن لتطبيق الأطفال ولتخصيص القنوات.`
      );

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Error saving category:', err);
      onNotify('error', 'فشل حفظ التصنيف', err?.message || 'خطأ أثناء الاتصال بالخادم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);
    try {
      await deleteCategory(categoryToDelete.id);
      onNotify(
        'success',
        'تم حذف التصنيف بنجاح',
        `تم حذف التصنيف "${categoryToDelete.name}" ولن يظهر في شريط تصنيفات تطبيق الأطفال.`
      );
      setCategoryToDelete(null);
      await loadData();
    } catch (err: any) {
      console.error('Error deleting category:', err);
      onNotify('error', 'فشل حذف التصنيف', err?.message || 'خطأ أثناء الاتصال بالخادم');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreDefaults = async () => {
    setIsLoading(true);
    try {
      for (const cat of INITIAL_DEFAULT_CATEGORIES) {
        await saveCategory(cat);
      }
      onNotify('success', 'تمت استعادة التصنيفات القياسية', 'تم حفظ 7 تصنيفات أساسية معتمدة لتطبيق الأطفال.');
      await loadData();
    } catch (err: any) {
      console.error('Error restoring defaults:', err);
      onNotify('error', 'فشل استعادة التصنيفات', err?.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCategories = categories.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  });

  return (
    <div id="categories-view-container" className="space-y-6">
      {/* Top Banner / Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <Tags className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              إجمالي التصنيفات المعتمدة
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              {categories.length}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              القنوات المصنفة
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {channels.filter((c) => Array.isArray(c.categories) && c.categories.length > 0).length}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              مزامنة تطبيق الطفل
            </div>
            <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
              ديناميكي (Live API)
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="categories-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو المعرف..."
            className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="categories-reload-btn"
            onClick={loadData}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
            title="تحديث القائمة"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
          </button>

          {categories.length === 0 && (
            <button
              onClick={handleRestoreDefaults}
              disabled={isLoading}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              استعادة الافتراضيات
            </button>
          )}

          <button
            id="open-add-category-btn"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة تصنيف جديد</span>
          </button>
        </div>
      </div>

      {/* Info Callout */}
      <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-slate-900 dark:text-slate-100">تحكم كامل بتطبيق الطفل:</span>{' '}
          أي تصنيف تضيفه أو تعدله أو تحذفه هنا يتم تحديثه فورياً في شريط التبويبات العلوي لتطبيق YoungTube للأطفال، وتظهر الفيديوهات والقنوات المرتبطة به تلقائياً.
        </div>
      </div>

      {/* Categories Grid */}
      {isLoading && categories.length === 0 ? (
        <div className="p-12 text-center text-slate-400 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-amber-500" />
          جاري قراءة التصنيفات من الـ Worker...
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="p-12 text-center text-slate-400 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <Tags className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
          <p className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-1">
            {searchQuery ? 'لا توجد تصنيفات تطابق البحث' : 'لا توجد تصنيفات مضافة حتى الآن'}
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            يمكنك إضافة تصنيفات جديدة لتنظيم الفيديوهات والقنوات في تطبيق الأطفال.
          </p>
          <button
            onClick={handleRestoreDefaults}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition shadow-xs cursor-pointer"
          >
            تعبئة التصنيفات القياسية المقترحة
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => {
            const iconKey = cat.icon || 'Tag';
            const iconMeta = AVAILABLE_ICONS[iconKey] || AVAILABLE_ICONS.Tag;
            const IconComponent = iconMeta.icon;
            const channelCount = getChannelCountForCategory(cat);

            return (
              <div
                key={cat.id}
                id={`category-card-${cat.id}`}
                className="group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-400/60 dark:hover:border-amber-500/40 transition-all shadow-xs space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-2xl border ${iconMeta.color} shadow-xs`}>
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <span>{cat.name}</span>
                        </h4>
                        <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                          #{cat.id}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      <button
                        id={`edit-category-btn-${cat.id}`}
                        onClick={() => handleOpenEdit(cat)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition cursor-pointer"
                        title="تعديل التصنيف"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id={`delete-category-btn-${cat.id}`}
                        onClick={() => setCategoryToDelete(cat)}
                        className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                        title="حذف التصنيف بالكامل"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {cat.description ? (
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                      {cat.description}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                      بدون وصف تفصيلي
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:divide-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {channelCount} قنوات مرتبطة
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold">
                    الترتيب: {cat.order || 1}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {isModalOpen && (
        <div
          id="category-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
        >
          <div
            id="category-modal"
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <FolderPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {isEditing ? 'تعديل التصنيف' : 'إضافة تصنيف جديد لتطبيق الطفل'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  سيظهر هذا التصنيف كشريط تبويب رئيسي في تطبيق الأطفال
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="category-name-input"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  اسم التصنيف (بالعربية)
                </label>
                <input
                  id="category-name-input"
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="مثال: قصص الأنبياء، علوم وتجارب..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label
                  htmlFor="category-id-input"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between"
                >
                  <span>المعرّف الإنجليزي (ID / Slug)</span>
                  <span className="text-[10px] text-slate-400">يُستخدم للربط الداخلي</span>
                </label>
                <input
                  id="category-id-input"
                  type="text"
                  dir="ltr"
                  required
                  disabled={isEditing}
                  value={idInput}
                  onChange={(e) => setIdInput(e.target.value)}
                  placeholder="مثال: stories, science, quran"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden disabled:opacity-60"
                />
              </div>

              {/* Icon Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  أيقونة التصنيف
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 max-h-36 overflow-y-auto">
                  {Object.entries(AVAILABLE_ICONS).map(([key, meta]) => {
                    const IconComp = meta.icon;
                    const isSelected = iconInput === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setIconInput(key)}
                        title={meta.label}
                        className={`p-2 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 font-bold'
                            : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <IconComp className="w-5 h-5 mb-0.5" />
                        <span className="text-[9px] truncate max-w-full">{meta.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="category-desc-input"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  وصف التصنيف (اختياري)
                </label>
                <textarea
                  id="category-desc-input"
                  rows={2}
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  placeholder="وصف مختصر لمحتوى هذا القسم للأطفال..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  id="submit-category-btn"
                  type="submit"
                  disabled={isSubmitting || !nameInput.trim() || !idInput.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isEditing ? 'حفظ التعديلات' : 'إضافة التصنيف'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!categoryToDelete}
        title="تأكيد حذف التصنيف"
        message={`هل أنت متأكد من حذف تصنيف "${categoryToDelete?.name}" بالكامل؟ سيتم إزالته من شريط التبويبات في تطبيق الأطفال، ولن تظهر الفيديوهات تحته.`}
        confirmLabel="نعم، حذف التصنيف"
        cancelLabel="تراجع"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setCategoryToDelete(null)}
      />
    </div>
  );
};
