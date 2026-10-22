import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Database, Film, ListChecks, Loader2, Play,
  RefreshCw, ShieldCheck, UploadCloud, XCircle,
} from 'lucide-react';
import {
  CatalogReviewItem, CatalogStatusResponse, fetchCatalogReviewQueue, fetchCatalogStatus,
  fetchCategories, publishCatalogGeneration, reviewCatalogVideo, startCatalogRebuild,
} from '../services/api';
import { CategoryItem } from '../types';

interface CatalogViewProps {
  onNotify: (type: 'success' | 'error' | 'info' | 'warning', title: string, desc?: string) => void;
}

const PRIMARY_CATEGORIES = new Set([
  'learn', 'science_discovery', 'stories_programs', 'music_songs',
  'arts_crafts', 'cooking_food', 'nature_life', 'movement_play', 'gaming', 'music_songs_no_music',
]);
const CATEGORY_LABELS: Record<string, string> = {
  learn: 'تعلّم',
  science_discovery: 'علوم واكتشاف',
  stories_programs: 'قصص وبرامج',
  music_songs: 'أغاني وأناشيد',
  arts_crafts: 'ارسم واصنع',
  cooking_food: 'طبخ وطعام',
  nature_life: 'طبيعة وحياة',
  movement_play: 'تحرّك والعب',
  gaming: 'ألعاب رقمية مناسبة',
  music_songs_no_music: 'أغاني وأناشيد بدون موسيقى',
};

function formatCount(value: number | undefined): string {
  return new Intl.NumberFormat('ar-EG').format(Number(value || 0));
}
function statusLabel(value: string): string {
  const labels: Record<string, string> = {
    SHORTS: 'Shorts — مرفوض',
    NOT_SHORTS: 'اجتاز فحص Shorts',
    SHORTS_UNKNOWN: 'لم يُحسم فحص Shorts',
    NEEDS_REVIEW: 'يحتاج مراجعة',
    CANDIDATE: 'مرشح',
    APPROVED: 'معتمد',
    REJECTED: 'مرفوض',
    SHORT_BLOCKED: 'محجوب كـ Shorts',
    UNAVAILABLE: 'غير متاح من YouTube',
  };
  return labels[value] || value || 'غير معروف';
}
const METADATA_MAX_AGE_MS = 20 * 24 * 60 * 60 * 1000;

function hasFreshMetadata(item: CatalogReviewItem): boolean {
  const checkedAt = Date.parse(String(item.metadata_checked_at || ''));
  return Number.isFinite(checkedAt) && Date.now() - checkedAt < METADATA_MAX_AGE_MS;
}

function canApprove(item: CatalogReviewItem): boolean {
  return hasFreshMetadata(item) && item.shorts_check_status === 'NOT_SHORTS' && Number.isFinite(Number(item.duration_seconds)) && Number(item.duration_seconds) > 0;
}
function canApproveForCategory(item: CatalogReviewItem, categoryId: string): boolean {
  if (!canApprove(item)) return false;
  if (categoryId !== 'music_songs_no_music') return true;
  try {
    const evidence = JSON.parse(String(item.music_classification_json || 'null'));
    return evidence?.publicCategory === 'music_songs_no_music' && evidence?.matchedField === 'title' && evidence?.confidence === 'HIGH';
  } catch {
    return false;
  }
}

export const CatalogView: React.FC<CatalogViewProps> = ({ onNotify }) => {
  const [status, setStatus] = useState<CatalogStatusResponse | null>(null);
  const [queue, setQueue] = useState<CatalogReviewItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [busyVideo, setBusyVideo] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Record<string, string>>({});
  const [showAllJobs, setShowAllJobs] = useState(false);

  const categoryOptions = useMemo(
    () => categories.filter((category) => PRIMARY_CATEGORIES.has(category.id)),
    [categories],
  );

  const reload = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [nextStatus, nextQueue, nextCategories] = await Promise.all([
        fetchCatalogStatus(),
        fetchCatalogReviewQueue(50),
        fetchCategories(),
      ]);
      setStatus(nextStatus);
      setQueue(nextQueue);
      setCategories(nextCategories);
      setSelectedCategory((previous) => {
        const next = { ...previous };
        for (const item of nextQueue) {
          if (!PRIMARY_CATEGORIES.has(next[item.video_id] || '')) {
            next[item.video_id] = PRIMARY_CATEGORIES.has(item.primary_category_id || '')
              ? String(item.primary_category_id)
              : 'stories_programs';
          }
        }
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر الاتصال بخدمة الكتالوج';
      if (!quiet) onNotify('error', 'تعذر تحميل الكتالوج', message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { void reload(); }, [reload]);

  const runRebuild = async () => {
    const confirmed = window.confirm(
      'سيبدأ نسخ أرشيف KV إلى الكتالوج الجديد على دفعات. ستظل النسخة القديمة هي النشطة، وكل الفيديوهات المنقولة ستبقى مرشحة وغير معتمدة حتى اجتياز فحص Shorts والمراجعة. هل تريد المتابعة؟',
    );
    if (!confirmed) return;
    setRebuilding(true);
    try {
      const result = await startCatalogRebuild();
      onNotify('success', 'بدأت إعادة بناء الكتالوج', `المصادر المضافة للطابور: ${formatCount(result?.queuedSources)}. وضع التشغيل: shadow.`);
      await reload(true);
    } catch (error) {
      onNotify('error', 'فشل بدء إعادة البناء', error instanceof Error ? error.message : 'خطأ غير معروف');
    } finally {
      setRebuilding(false);
    }
  };

  const publish = async () => {
    const approved = status?.counts.approvedNonShorts || 0;
    const confirmed = window.confirm(
      `سيتم تكوين جيل جديد من الفيديوهات المعتمدة فقط، بعد اجتياز فحص Shorts وتوفّر مدة معروفة للفيديو. شرط 120 ثانية يظل مرتبطًا بإعداد مفتاح YouTube العائلي في تطبيق الطفل. عدد الفيديوهات المؤهلة الآن: ${formatCount(approved)}. لن يتغير الجيل النشط حتى تكتمل كتابة كل الصفحات. متابعة؟`,
    );
    if (!confirmed) return;
    setPublishing(true);
    try {
      const result = await publishCatalogGeneration();
      onNotify('success', 'بدأ تجهيز جيل الفيد', `معرّف الجيل: ${result?.generationId || '—'}؛ الصفحات في الطابور: ${formatCount(result?.pagesQueued)}.`);
      await reload(true);
    } catch (error) {
      onNotify('error', 'تعذر تجهيز الفيد', error instanceof Error ? error.message : 'خطأ غير معروف');
    } finally {
      setPublishing(false);
    }
  };

  const decide = async (item: CatalogReviewItem, action: 'approve' | 'reject') => {
    const categoryId = selectedCategory[item.video_id] || 'stories_programs';
    if (action === 'approve' && !canApproveForCategory(item, categoryId)) {
      onNotify('warning', 'الفيديو غير مؤهل للاعتماد', categoryId === 'music_songs_no_music' ? 'هذا المسار يتطلب تصريحًا واضحًا عالي الثقة في العنوان بأن النسخة بدون موسيقى.' : 'لا يمكن الاعتماد قبل اجتياز Shorts، ومعرفة المدة، وحداثة بيانات YouTube خلال آخر 20 يومًا؛ شرط 120 ثانية يُطبّق فقط عند استخدام مفتاح YouTube العائلي.');
      return;
    }
    if (action === 'reject' && !window.confirm(`رفض الفيديو «${item.title}»؟`)) return;
    setBusyVideo(item.video_id);
    try {
      await reviewCatalogVideo({
        videoId: item.video_id,
        action,
        ...(action === 'approve' ? { primaryCategoryId: categoryId } : {}),
      });
      onNotify('success', action === 'approve' ? 'تم اعتماد الفيديو' : 'تم رفض الفيديو', item.title);
      await reload(true);
    } catch (error) {
      onNotify('error', 'تعذر حفظ قرار المراجعة', error instanceof Error ? error.message : 'خطأ غير معروف');
    } finally {
      setBusyVideo(null);
    }
  };

  const counts = status?.counts;
  const bindingStatus = status?.bindings;
  const hasBindings = Boolean(bindingStatus?.kv && bindingStatus?.d1 && bindingStatus?.discoveryQueue && bindingStatus?.processingQueue);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl font-extrabold">كتالوج المحتوى الجديد</h1>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            إعادة بناء قابلة للاستئناف، مع فصل التصنيف الموضوعي عن نوع الأغنية وفحص Shorts ومراجعة ملاءمة المحتوى. الأرشيف القديم يظل المصدر النشط حتى اكتمال جيل جديد صالح.
          </p>
        </div>
        <button onClick={() => void reload()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          تحديث الحالة
        </button>
      </div>

      {status && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${status.mode === 'published' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
                {status.mode === 'published' ? 'الفيد الجديد منشور' : 'وضع تجريبي — Shadow'}
              </span>
              <span className="text-xs text-slate-500">التصنيف: {status.taxonomyVersion}</span>
              <span className="text-xs text-slate-500">الجيل النشط: {status.activeGeneration || 'غير معروف'}</span>
            </div>
            <div className="mt-3 flex items-start gap-2 text-sm">
              {hasBindings ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
              <div>
                <p className="font-bold">{hasBindings ? 'كل روابط Cloudflare الأساسية متاحة' : 'هناك موارد غير مرتبطة بالـ Worker'}</p>
                <p className="mt-1 text-slate-500">
                  KV: {bindingStatus?.kv ? 'متصل' : 'غير متصل'} · D1: {bindingStatus?.d1 ? 'متصل' : 'غير متصل'} · طابور الاكتشاف: {bindingStatus?.discoveryQueue ? 'متصل' : 'غير متصل'} · طابور المعالجة: {bindingStatus?.processingQueue ? 'متصل' : 'غير متصل'}
                </p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['التصنيفات الفعالة', counts?.categories],
              ['المصادر', counts?.sources],
              ['الفيديوهات المنقولة', counts?.videos],
              ['تحتاج مراجعة', counts?.needsReview],
              ['مرشحة', counts?.candidates],
              ['فيديوهات فُحصت بياناتها', counts?.metadataChecked],
              ['معتمدة وغير Shorts', counts?.approvedNonShorts],
              ['مصادر عينة الفحص', counts?.pilotSources],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-extrabold tabular-nums">{formatCount(Number(value || 0))}</p>
              </div>
            ))}
          </section>
        </>
      )}

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Play className="h-5 w-5 text-amber-500" />
            <h2 className="font-extrabold">1. نقل الأرشيف إلى الكتالوج</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            يقرأ المصادر الحالية إلى D1 ويضيف مهام قابلة للاستئناف. لا يمنح الفيديو موافقة تلقائية، ولا يغير الفيد النشط.
          </p>
          <button onClick={() => void runRebuild()} disabled={rebuilding || loading || !hasBindings} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50">
            {rebuilding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            {rebuilding ? 'جاري جدولة النقل…' : 'ابدأ / استأنف نقل الأرشيف'}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-emerald-500" />
            <h2 className="font-extrabold">2. تجهيز جيل الفيد</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            ينشر الفيديوهات المعتمدة فقط بعد إكمال بوابة Shorts والمراجعة البشرية. يتبدل مؤشر الفيد عند اكتمال كل الصفحات بنجاح.
          </p>
          <button onClick={() => void publish()} disabled={publishing || loading || !status || (counts?.approvedNonShorts || 0) < 10} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {publishing ? 'جاري تجهيز الجيل…' : 'تجهيز جيل جديد آمن'}
          </button>
          <p className="mt-2 text-xs text-slate-500">يتطلب 10 فيديوهات على الأقل مستوفية الشروط.</p>
        </div>
      </section>

      {status?.jobs && status.jobs.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <button className="flex w-full items-center justify-between gap-3 text-right" onClick={() => setShowAllJobs((value) => !value)}>
            <span className="flex items-center gap-2 font-extrabold"><ListChecks className="h-5 w-5 text-sky-500" /> حالة مهام النقل والمعالجة</span>
            <span className="text-xs text-slate-500">{showAllJobs ? 'إخفاء' : 'عرض التفاصيل'}</span>
          </button>
          {showAllJobs && <div className="mt-3 flex flex-wrap gap-2">{status.jobs.map((job) => <span key={job.status} className="rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800">{statusLabel(job.status)}: <strong>{formatCount(job.count)}</strong></span>)}</div>}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-sky-500" />
            <h2 className="text-lg font-extrabold">قائمة المراجعة</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold dark:bg-slate-800">{formatCount(queue.length)}</span>
          </div>
          <span className="text-xs text-slate-500">أول 50 فيديو كحد أقصى</span>
        </div>

        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          <div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>فحص Shorts مستقل عن التصنيف. وحتى عند الاعتماد، فإن «بدون موسيقى» تعني أن العنوان يعلن ذلك؛ لا تعني تحليلًا صوتيًا. أي فيديو لم تُحسم بياناته يبقى خارج الفيد المنشور.</p></div>
        </div>

        {loading && queue.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 p-10 text-slate-500 dark:border-slate-800"><Loader2 className="h-5 w-5 animate-spin" /> جار تحميل قائمة المراجعة…</div>
        ) : queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <Film className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 font-bold">لا توجد فيديوهات في قائمة المراجعة حاليًا</p>
            <p className="mt-1 text-sm text-slate-500">ابدأ نقل الأرشيف ثم حدّث الحالة بعد وصول مهام الطوابير.</p>
          </div>
        ) : queue.map((item) => (
          <article key={item.video_id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold leading-6">{item.title}</h3>
                <p className="mt-1 text-xs text-slate-500">{item.source_title || 'مصدر غير معروف'} · {item.video_id}{item.published_at ? ` · ${new Date(item.published_at).toLocaleDateString('ar-EG')}` : ''}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs dark:bg-slate-800">{statusLabel(item.review_status)}</span>
                  <span className={`rounded-lg px-2.5 py-1 text-xs ${item.shorts_check_status === 'NOT_SHORTS' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>{statusLabel(item.shorts_check_status)}</span>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs dark:bg-slate-800">المدة: {item.duration_seconds ? `${Math.floor(item.duration_seconds / 60)}د ${item.duration_seconds % 60}ث` : 'غير معروفة'}</span>
                  <span className={`rounded-lg px-2.5 py-1 text-xs ${hasFreshMetadata(item) ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
                    {hasFreshMetadata(item) ? `بيانات YouTube حديثة · ${new Date(String(item.metadata_checked_at)).toLocaleDateString('ar-EG')}` : 'بيانات YouTube قديمة أو غير متحققة'}
                  </span>
                  {item.music_variant && item.music_variant !== 'STANDARD_OR_UNSPECIFIED' && <span className="rounded-lg bg-violet-100 px-2.5 py-1 text-xs text-violet-800 dark:bg-violet-950 dark:text-violet-200">نسخة الأغنية: {item.music_variant}</span>}
                </div>
                {item.review_reason && <p className="mt-2 text-xs text-slate-500">السبب: {item.review_reason}</p>}
              </div>
              <div className="flex min-w-[240px] flex-col gap-2">
                <label className="text-xs font-bold text-slate-500" htmlFor={`catalog-category-${item.video_id}`}>التصنيف الرئيسي المقترح</label>
                <select id={`catalog-category-${item.video_id}`} value={selectedCategory[item.video_id] || 'stories_programs'} onChange={(event) => setSelectedCategory((old) => ({ ...old, [item.video_id]: event.target.value }))} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
                  {categoryOptions.map((category) => <option key={category.id} value={category.id}>{CATEGORY_LABELS[category.id] || category.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => void decide(item, 'approve')} disabled={busyVideo === item.video_id || !canApproveForCategory(item, selectedCategory[item.video_id] || 'stories_programs')} title={!canApproveForCategory(item, selectedCategory[item.video_id] || 'stories_programs') ? 'يتطلب بيانات حديثة، واجتياز Shorts ومدة معروفة؛ وفئة بدون موسيقى تتطلب تصريحًا واضحًا في العنوان' : 'اعتماد الفيديو'} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">
                    {busyVideo === item.video_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} اعتماد
                  </button>
                  <button onClick={() => void decide(item, 'reject')} disabled={busyVideo === item.video_id} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-300 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950">
                    <XCircle className="h-4 w-4" /> رفض
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};
