import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Database, ExternalLink, Film, ListChecks, Loader2, Play,
  RefreshCw, ShieldCheck, UploadCloud, XCircle,
} from 'lucide-react';
import {
  ApiRequestError, CatalogReviewItem, CatalogStatusResponse, fetchCatalogReviewQueue, fetchCatalogStatus,
  fetchCategories, publishCatalogGeneration, reviewCatalogVideo, startCatalogRebuild, setCatalogAutoReviewMode, setCatalogAutoReviewBudget,
} from '../services/api';
import { CategoryItem } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { deriveAutoReviewRequestOutcome, type AutoReviewRequestOutcome } from '../lib/autoReviewOutcome';

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

function AutoReviewEvidence({ item }: { item: CatalogReviewItem }) {
  let scan: any = null;
  try {
    scan = JSON.parse(String(item.review_evidence_json || '{}'))?.autoReview || null;
  } catch {
    scan = null;
  }
  if (!scan || typeof scan !== 'object') return null;
  const verdictLabels: Record<string, string> = {
    SAFE: 'تقييم الآلة: آمن مبدئيًا',
    REVIEW: 'تقييم الآلة: يحتاج تدقيقًا',
    UNSAFE: 'تقييم الآلة: إشارة خطر',
  };
  const modeLabel = scan.mode === 'shadow' ? 'اختبار بلا اعتماد' : scan.mode === 'enforce' ? 'فحص في مسار الاعتماد' : 'فحص آلي';
  const timestamps = Array.isArray(scan.evidenceTimestamps) ? scan.evidenceTimestamps.filter((value: unknown) => typeof value === 'string').slice(0, 8) : [];
  return (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs leading-5 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100">
      <div className="flex flex-wrap items-center gap-2 font-extrabold">
        <span>{verdictLabels[String(scan.verdict || '')] || 'نتيجة فحص آلي'}</span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 dark:bg-slate-900/70">{modeLabel}</span>
        {Number.isFinite(Number(scan.confidence)) && <span>درجة الثقة: {Math.round(Number(scan.confidence) * 100)}%</span>}
      </div>
      {typeof scan.summary === 'string' && scan.summary && <p className="mt-1">{scan.summary}</p>}
      {timestamps.length > 0 && <p className="mt-1">الأزمنة التي ذكرها الفحص: {timestamps.join('، ')}</p>}
      {Array.isArray(scan.policyFlags) && scan.policyFlags.length > 0 && <p className="mt-1">إشارات السياسة: {scan.policyFlags.join('، ')}</p>}
      <p className="mt-1 opacity-80">النتيجة الآلية مؤشر للمراجعة وليست ضمانًا بأن الفيديو خالٍ من كل مشكلة.</p>
    </div>
  );
}

export const CatalogView: React.FC<CatalogViewProps> = ({ onNotify }) => {
  const [status, setStatus] = useState<CatalogStatusResponse | null>(null);
  const [queue, setQueue] = useState<CatalogReviewItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [autoReviewSaving, setAutoReviewSaving] = useState(false);
  const [autoReviewBudgetSaving, setAutoReviewBudgetSaving] = useState(false);
  const [autoReviewDailyHours, setAutoReviewDailyHours] = useState<number>(8);
  const [pendingAutoReviewMode, setPendingAutoReviewMode] = useState<'off' | 'shadow' | 'enforce' | null>(null);
  const [autoReviewRequest, setAutoReviewRequest] = useState<AutoReviewRequestOutcome | null>(null);
  const [autoReviewRefreshing, setAutoReviewRefreshing] = useState(false);
  const [autoReviewRefreshError, setAutoReviewRefreshError] = useState<string | null>(null);
  const [busyVideo, setBusyVideo] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Record<string, string>>({});
  const [safetyReviewed, setSafetyReviewed] = useState<Record<string, boolean>>({});
  const [showAllJobs, setShowAllJobs] = useState(false);

  const categoryOptions = useMemo(
    () => categories.filter((category) => PRIMARY_CATEGORIES.has(category.id)),
    [categories],
  );

  const reload = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setLoadError(null);
    try {
      const [nextStatus, nextQueue, nextCategories] = await Promise.all([
        fetchCatalogStatus(),
        fetchCatalogReviewQueue(50),
        fetchCategories(),
      ]);
      setStatus(nextStatus);
      setAutoReviewDailyHours([8, 24, 72].includes(Number(nextStatus.autoReview?.dailyVideoHours)) ? Number(nextStatus.autoReview?.dailyVideoHours) : 8);
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
      setLoadError(message);
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

  const changeAutoReviewBudget = async () => {
    if (!status?.autoReview) return;
    const hours = autoReviewDailyHours as 8 | 24 | 72;
    let paidTierConfirmed = false;
    if (hours > 8) {
      paidTierConfirmed = window.confirm(
        'هذا الإعداد يسمح لـ YoungTube بطلب فحص حتى ' + hours + ' ساعة من محتوى الفيديو يوميًا. لا يرفع هذا حدود Google نفسها؛ يتطلب مشروع Gemini على الخطة المدفوعة، وقد تنشأ رسوم بحسب استهلاك النموذج. هل تحققت من الخطة والميزانية وتريد الحفظ؟',
      );
      if (!paidTierConfirmed) return;
    }
    setAutoReviewBudgetSaving(true);
    try {
      const result = await setCatalogAutoReviewBudget({
        dailyVideoHours: hours,
        dailyVideoLimit: Math.max(2000, Number(status.autoReview.dailyVideoLimit || 2000)),
        paidTierConfirmed,
      });
      onNotify('success', 'تم حفظ حدود الفحص', 'الحد اليومي الآن ' + result.dailyVideoHours + ' ساعة فيديو، مع دفعات من ' + result.batchSize + ' فيديوهات لكل طلب.');
      await reload(true);
    } catch (error) {
      onNotify('error', 'تعذر حفظ حدود الفحص', error instanceof Error ? error.message : 'خطأ غير معروف');
    } finally {
      setAutoReviewBudgetSaving(false);
    }
  };

  // Mode changes are confirmed through the in-panel ConfirmModal, not a native dialog:
  // a native dialog can be dismissed silently by the browser/automation with no trace,
  // which previously left the panel showing a "success" toast while the mode never changed.
  // requestAutoReviewMode only opens the modal; confirmAutoReviewMode performs the request,
  // validates the response, and verifies the reloaded mode before reporting anything.
  const requestAutoReviewMode = (mode: 'off' | 'shadow' | 'enforce') => {
    const autoReview = status?.autoReview;
    if (mode !== 'off' && autoReview?.providerConfigured !== true) {
      onNotify('warning', 'مفتاح الفحص غير متاح', 'يجب إضافة GEMINI_API_KEY كسرّ إلى Worker أولًا؛ لم يتم تشغيل أي فحص.');
      return;
    }
    if (mode === 'enforce' && Number(autoReview?.shadowSampleCount || 0) < 10) {
      onNotify('warning', 'العينة التجريبية غير كافية', 'يلزم الحصول على 10 نتائج تجريبية على الأقل قبل تفعيل الاعتماد الآلي.');
      return;
    }
    setPendingAutoReviewMode(mode);
  };

  const pendingAutoReviewTitle = pendingAutoReviewMode === 'shadow'
    ? 'بدء اختبار العينة'
    : pendingAutoReviewMode === 'enforce'
      ? 'تفعيل الاعتماد الآلي'
      : 'إيقاف الفحص الآلي';

  const pendingAutoReviewMessage = (() => {
    if (pendingAutoReviewMode === 'shadow') {
      const dailyVideoLimit = Number(status?.autoReview?.dailyVideoLimit ?? 2000);
      const dailyVideoSecondsLimit = Number(status?.autoReview?.dailyVideoSecondsLimit ?? 28800);
      const maxVideoSeconds = Number(status?.autoReview?.maxVideoSeconds ?? 1800);
      const dailyVideoHours = (dailyVideoSecondsLimit / 3600).toLocaleString('ar-EG', { maximumFractionDigits: 1 });
      const maxVideoMinutes = Math.max(1, Math.round(maxVideoSeconds / 60));
      return `سيبدأ اختبارًا آليًا لا يعتمد الفيديوهات ولا يرفضها تلقائيًا. الحدود الحالية: حتى ${formatCount(dailyVideoLimit)} فيديو يوميًا، و${dailyVideoHours} ساعة محتوى يوميًا، ومدة ${maxVideoMinutes} دقيقة كحد أقصى للفيديو الواحد. يظل التنفيذ خاضعًا لحصص Google. هل تريد تشغيل الاختبار؟`;
    }
    if (pendingAutoReviewMode === 'enforce') {
      return 'لا تفعّل هذا الخيار إلا بعد فحص نتائج 10 فيديوهات على الأقل من العينة التجريبية. ستُعتمد تلقائيًا الحالات عالية الثقة في نطاق محدود فقط؛ الحالات غير الواضحة ستظل خارج الفيد. هل راجعت العينة وتريد المتابعة؟';
    }
    if (pendingAutoReviewMode === 'off') {
      return 'إيقاف جدولة الفحص الآلي الجديد؟ ستظل الفيديوهات المعتمدة سابقًا كما هي، ولن تُحذف نتائج الفحص.';
    }
    return '';
  })();

  // The outcome of a mode-change request is derived, never asserted from the
  // mode value alone. Three facts stay separate: (a) the mode changed
  // (validated response + re-read showing the requested mode), (b) a review
  // execution started (NOT proven by (a) — the mode endpoint returns no
  // enqueue/eligible/scheduler information), (c) an actual result completed
  // (proven only by shadowSampleCount increasing since before the request).
  // The persistent in-section outcome below is the single record of the last
  // request; the section badge above always shows the live mode.
  const confirmAutoReviewMode = async () => {
    const mode = pendingAutoReviewMode;
    if (!mode) return;
    const previousCount = typeof status?.autoReview?.shadowSampleCount === 'number' ? status.autoReview.shadowSampleCount : null;
    setAutoReviewSaving(true);
    setAutoReviewRefreshError(null);
    try {
      let responseReceived = false;
      let responseOk = false;
      let requestFailureKind: 'network' | 'http' | 'unknown' = 'unknown';
      let requestHttpStatus: number | undefined;
      try {
        const result = await setCatalogAutoReviewMode({ mode, ...(mode === 'enforce' ? { sampleAuditConfirmed: true } : {}) });
        responseReceived = true;
        responseOk = result?.ok === true && result?.autoReviewMode === mode;
      } catch (error) {
        if (error instanceof ApiRequestError) {
          requestFailureKind = error.kind;
          requestHttpStatus = error.status;
          responseReceived = error.kind === 'http';
        } else {
          requestFailureKind = 'unknown';
          responseReceived = false;
        }
      }
      if (!responseReceived || !responseOk) {
        const outcome = deriveAutoReviewRequestOutcome({ requestedMode: mode, responseReceived, responseOk, rereadFailed: false, previousCount, requestFailureKind, requestHttpStatus });
        setAutoReviewRequest(outcome);
        onNotify('error', 'تعذر تغيير وضع الفحص', outcome.message);
        return;
      }
      let rereadFailed = false;
      let rereadMode: string | undefined;
      let rereadCount: number | null = null;
      try {
        const nextStatus = await fetchCatalogStatus();
        rereadMode = nextStatus.autoReview?.mode;
        rereadCount = typeof nextStatus.autoReview?.shadowSampleCount === 'number' ? nextStatus.autoReview.shadowSampleCount : null;
      } catch {
        rereadFailed = true;
      }
      const outcome = deriveAutoReviewRequestOutcome({ requestedMode: mode, responseReceived: true, responseOk: true, rereadFailed, rereadMode, rereadCount, previousCount });
      setAutoReviewRequest(outcome);
      if (outcome.kind === 'result-completed') {
        onNotify('success', 'ظهرت نتيجة مراجعة جديدة', outcome.message);
      } else if (outcome.kind === 'mode-confirmed-awaiting-result') {
        onNotify('success', 'تم تأكيد وضع Shadow', 'جارٍ التحقق من نتائج المراجعة؛ لم تُثبت نتيجة جديدة بعد.');
      } else if (outcome.kind === 'mode-confirmed') {
        onNotify('success', mode === 'off' ? 'تم إيقاف الفحص الآلي' : 'تم تفعيل مسار الاعتماد الآلي', outcome.message);
      } else if (outcome.kind === 'mismatch') {
        onNotify('warning', 'وضع الفحص لم يتغير', outcome.message);
      } else if (outcome.kind === 're-read-failed') {
        onNotify('warning', 'تعذر التحقق النهائي من وضع الفحص', outcome.message);
      } else {
        onNotify('error', 'تعذر تغيير وضع الفحص', outcome.message);
      }
      await reload(true);
    } catch (error) {
      // reload(true) never throws (it catches internally); this is a safety net
      // for unexpected failures outside the request/re-read steps.
      const outcome: AutoReviewRequestOutcome = { kind: 'request-failed', message: `تعذر إتمام طلب تغيير وضع الفحص: ${error instanceof Error ? error.message : 'خطأ غير معروف'}` };
      setAutoReviewRequest(outcome);
      onNotify('error', 'تعذر تغيير وضع الفحص', outcome.message);
    } finally {
      setAutoReviewSaving(false);
      setPendingAutoReviewMode(null);
    }
  };

  // Manual status refresh for the auto-review outcome: re-fetches catalog status
  // ONLY — no mode POST, no sample run. Its single job is to detect a newly
  // completed result after a mode-confirmed-awaiting-result outcome: if the
  // confirmed count rose above the pre-request count (and the mode is still
  // shadow), the outcome upgrades to result-completed. Every other outcome is
  // left untouched (the outcome block records the last request; the section
  // badge shows the live mode), and a refresh failure is shown persistently
  // without clearing the prior outcome.
  const refreshAutoReviewStatus = async () => {
    setAutoReviewRefreshing(true);
    setAutoReviewRefreshError(null);
    try {
      const nextStatus = await fetchCatalogStatus();
      setStatus(nextStatus);
      const nextCount = typeof nextStatus.autoReview?.shadowSampleCount === 'number' ? nextStatus.autoReview.shadowSampleCount : null;
      setAutoReviewRequest((previous) => {
        if (!previous) return previous;
        if (previous.kind === 're-read-failed') {
          return deriveAutoReviewRequestOutcome({
            requestedMode: previous.mode,
            responseReceived: true,
            responseOk: true,
            rereadFailed: false,
            rereadMode: nextStatus.autoReview?.mode,
            rereadCount: nextCount,
            previousCount: previous.previousCount,
          });
        }
        if (previous.kind !== 'mode-confirmed-awaiting-result') return previous;
        if (nextStatus.autoReview?.mode !== 'shadow') return previous;
        if (nextCount !== null && previous.previousCount !== null && nextCount > previous.previousCount) {
          return deriveAutoReviewRequestOutcome({ requestedMode: 'shadow', responseReceived: true, responseOk: true, rereadFailed: false, rereadMode: 'shadow', rereadCount: nextCount, previousCount: previous.previousCount });
        }
        return previous;
      });
    } catch (error) {
      setAutoReviewRefreshError(`تعذر تحديث حالة الفحص: ${error instanceof Error ? error.message : 'خطأ غير معروف'} — لم يتغير آخر طلب مسجل، ويمكن إعادة المحاولة.`);
    } finally {
      setAutoReviewRefreshing(false);
    }
  };

  const decide = async (item: CatalogReviewItem, action: 'approve' | 'reject') => {
    const categoryId = selectedCategory[item.video_id] || 'stories_programs';
    if (action === 'approve' && safetyReviewed[item.video_id] !== true) {
      onNotify('warning', 'تأكيد المراجعة مطلوب', 'افتح الفيديو وشاهده وراجع ملاءمته للأطفال قبل الاعتماد.');
      return;
    }
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
        ...(action === 'approve' ? { primaryCategoryId: categoryId, safetyReviewConfirmed: safetyReviewed[item.video_id] === true } : {}),
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

  if (!status) {
    return (
      <section className="m-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" role={loading ? 'status' : 'alert'} dir="rtl" aria-live="polite">
        <h2 className="font-extrabold">{loading ? 'جاري تحميل كتالوج المحتوى…' : 'تعذر تحميل كتالوج المحتوى'}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{loading ? 'يتم جلب حالة الكتالوج من Worker.' : loadError || 'لم تصل حالة صالحة من Worker. تحقق من الاتصال ثم أعد المحاولة.'}</p>
        {!loading && <button onClick={() => void reload()} className="mt-4 rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950">إعادة المحاولة</button>}
      </section>
    );
  }

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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-violet-500" />
              <h2 className="font-extrabold">مراجعة السلامة الآلية</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              يبدأ النظام باختبار لا يغيّر قرارات النشر. يختبر محتوى الفيديو نفسه، لا اسم القناة أو العنوان وحدهما. لا يُفعّل الاعتماد الآلي إلا بعد مراجعة عينة، وفي فئات قليلة منخفضة المخاطر فقط.
            </p>
          </div>
          <span className={status.autoReview?.mode === 'enforce' ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : status.autoReview?.mode === 'shadow' ? 'rounded-full bg-sky-100 px-3 py-1 text-xs font-extrabold text-sky-800 dark:bg-sky-950 dark:text-sky-300' : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-300'}>
            {status.autoReview?.mode === 'enforce' ? 'الاعتماد الآلي مفعّل' : status.autoReview?.mode === 'shadow' ? 'اختبار بلا اعتماد' : 'الفحص الآلي متوقف'}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['مفتاح Gemini', status.autoReview?.providerConfigured ? 'متصل' : 'غير مضاف'],
            ['عينة الاختبار', formatCount(status.autoReview?.shadowSampleCount) + ' / 10'],
            ['فحوص اليوم', formatCount(status.autoReview?.scannedToday) + ' / ' + formatCount(status.autoReview?.dailyVideoLimit)],
            ['مدة الفحص اليوم', Math.floor(Number(status.autoReview?.scannedVideoSecondsToday || 0) / 60) + ' / ' + Math.floor(Number(status.autoReview?.dailyVideoSecondsLimit || 14400) / 60) + ' دقيقة'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 font-extrabold">{value}</p>
            </div>
          ))}
        </div>
        {!status.autoReview?.providerConfigured && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">لم يتم إعداد مفتاح Gemini في Worker؛ لا يمكن بدء الاختبار حتى يُضاف كسرّ آمن في Cloudflare.</p>}
        <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label htmlFor="catalog-auto-review-hours" className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">حد ساعات الفيديو المفحوصة يوميًا</label>
            <select id="catalog-auto-review-hours" value={autoReviewDailyHours} onChange={(event) => setAutoReviewDailyHours(Number(event.target.value))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value={8}>8 ساعات — مجاني أو غير متحقق من الخطة</option>
              <option value={24}>24 ساعة — يتطلب خطة مدفوعة</option>
              <option value={72}>72 ساعة — تسريع أعلى، يتطلب خطة مدفوعة</option>
            </select>
            <p className="mt-1 text-xs leading-5 text-slate-500">يظل الحد الفعلي خاضعًا لحصص Google ومعدل الطلبات. الدفعات الجديدة تشمل حتى 10 فيديوهات في الطلب، ولا يعني ذلك أن كل فيديو سيُعتمد.</p>
          </div>
          <button onClick={() => void changeAutoReviewBudget()} disabled={autoReviewBudgetSaving || !status.autoReview} className="rounded-xl border border-violet-300 px-4 py-2 text-sm font-bold text-violet-800 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950">
            {autoReviewBudgetSaving ? 'جار الحفظ…' : 'حفظ سقف الساعات'}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => requestAutoReviewMode('shadow')} disabled={autoReviewSaving || !status.autoReview?.providerConfigured || status.autoReview?.mode === 'shadow' || status.autoReview?.mode === 'enforce'} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40">
            {autoReviewSaving ? 'جار الحفظ…' : 'ابدأ اختبار العينة'}
          </button>
          <button onClick={() => requestAutoReviewMode('enforce')} disabled={autoReviewSaving || !status.autoReview?.providerConfigured || Number(status.autoReview?.shadowSampleCount || 0) < 10 || status.autoReview?.mode === 'enforce'} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">
            تفعيل الاعتماد الآلي
          </button>
          <button onClick={() => requestAutoReviewMode('off')} disabled={autoReviewSaving || status.autoReview?.mode === 'off'} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            إيقاف الفحص الآلي
          </button>
        </div>
        {autoReviewRequest && (
          <p className={`mt-3 rounded-xl border p-3 text-xs leading-5 ${autoReviewRequest.kind === 'mode-confirmed' || autoReviewRequest.kind === 'result-completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100' : autoReviewRequest.kind === 'mode-confirmed-awaiting-result' ? 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100' : autoReviewRequest.kind === 'mismatch' || autoReviewRequest.kind === 're-read-failed' ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100' : 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100'}`}>
            {autoReviewRequest.message}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => void refreshAutoReviewStatus()} disabled={autoReviewRefreshing || autoReviewSaving} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            {autoReviewRefreshing ? 'جار تحديث حالة الفحص…' : 'تحديث حالة الفحص (دون إعادة تشغيل)'}
          </button>
          <span className="text-xs text-slate-500">يعيد قراءة الحالة فقط؛ لا يرسل طلب تغيير وضع ولا يبدأ فحصًا جديدًا.</span>
        </div>
        {autoReviewRefreshError && (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            {autoReviewRefreshError}
          </p>
        )}
        <ConfirmModal
          isOpen={pendingAutoReviewMode !== null}
          title={pendingAutoReviewTitle}
          message={pendingAutoReviewMessage}
          confirmLabel={pendingAutoReviewMode === 'shadow' ? 'بدء الاختبار' : pendingAutoReviewMode === 'enforce' ? 'تفعيل الاعتماد' : 'إيقاف الفحص'}
          cancelLabel="إلغاء"
          isLoading={autoReviewSaving}
          onConfirm={() => void confirmAutoReviewMode()}
          onCancel={() => setPendingAutoReviewMode(null)}
        />
        <p className="mt-3 text-xs leading-5 text-slate-500">حدود التشغيل: حتى 2,000 فيديو يوميًا على دفعات من 10، وبحد محتوى افتراضي 8 ساعات يوميًا؛ يمكن اختيار 24 أو 72 ساعة لمشروع Gemini مدفوع بعد تأكيد الميزانية. أقصى مدة للفيديو في هذا المسار 30 دقيقة. الفيديوهات غير المتاحة أو غير الواضحة لا تُعتمد آليًا. بسبب أخذ عينات من الفيديو بواسطة النموذج، لا يُعد هذا ضمانًا كاملًا للسلامة.</p>
      </section>

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
            ينشر الفيديوهات المعتمدة فقط بعد اجتياز بوابة Shorts وفحص السلامة؛ الاعتماد الآلي للحالات الواضحة متاح ضمن نطاق محدود، وتظل الحالات غير الواضحة في مسار الاستثناء. يتبدل مؤشر الفيد عند اكتمال كل الصفحات بنجاح.
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
                <a
                  href={`https://www.youtube.com/watch?v=${encodeURIComponent(item.video_id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`فتح الفيديو ${item.title} على YouTube في تبويب جديد`}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-sky-700 underline underline-offset-2 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-200"
                >
                  فتح الفيديو على YouTube للمراجعة
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
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
                <AutoReviewEvidence item={item} />
              </div>
              <div className="flex min-w-[240px] flex-col gap-2">
                <label className="text-xs font-bold text-slate-500" htmlFor={`catalog-category-${item.video_id}`}>التصنيف الرئيسي المقترح</label>
                <select id={`catalog-category-${item.video_id}`} value={selectedCategory[item.video_id] || 'stories_programs'} onChange={(event) => setSelectedCategory((old) => ({ ...old, [item.video_id]: event.target.value }))} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
                  {categoryOptions.map((category) => <option key={category.id} value={category.id}>{CATEGORY_LABELS[category.id] || category.name}</option>)}
                </select>
                <label className="mb-2 flex items-start gap-2 rounded-xl border border-slate-200 p-2 text-xs leading-5 text-slate-700 dark:border-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={safetyReviewed[item.video_id] === true} onChange={(event) => setSafetyReviewed((old) => ({ ...old, [item.video_id]: event.target.checked }))} className="mt-1 h-4 w-4 shrink-0 accent-emerald-600" />
                  <span>شاهدت الفيديو كاملًا وراجعت ملاءمته للأطفال</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => void decide(item, 'approve')}
                    disabled={busyVideo === item.video_id || safetyReviewed[item.video_id] !== true || !canApproveForCategory(item, selectedCategory[item.video_id] || 'stories_programs')}
                    title={safetyReviewed[item.video_id] !== true ? 'افتح الفيديو وراجعه، ثم أكّد ملاءمته للأطفال' : !canApproveForCategory(item, selectedCategory[item.video_id] || 'stories_programs') ? 'يتطلب بيانات حديثة، واجتياز Shorts ومدة معروفة؛ وفئة بدون موسيقى تتطلب تصريحًا واضحًا في العنوان' : 'اعتماد الفيديو'}
className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">
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
