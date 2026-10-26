// Pure outcome derivation for Catalog V2 auto-review mode requests.
//
// Three facts must never be conflated:
//   (a) the review MODE changed — proven only by a validated endpoint response
//       (ok === true AND autoReviewMode === requested mode) PLUS a status
//       re-read showing the requested mode;
//   (b) a review EXECUTION started — NOT proven by (a). The mode endpoint
//       returns no enqueue count, no eligible-video count, and no scheduler
//       outcome, so mode confirmation alone proves nothing about execution;
//   (c) an actual review RESULT completed — proven only by a completed result
//       visible in actual status: shadowSampleCount increased since before
//       the request, or an explicitly visible completed shadow result.
//
// This module is deliberately free of React, network, and DOM access so it can
// be unit-tested directly with node:test. It uses only erasable TypeScript
// syntax (type aliases, interfaces, annotations) for that reason.

export type AutoReviewMode = 'off' | 'shadow' | 'enforce';

export type AutoReviewRequestOutcome =
  | { kind: 'mode-confirmed'; mode: AutoReviewMode; message: string }
  | { kind: 'mode-confirmed-awaiting-result'; mode: 'shadow'; confirmedCount: number | null; previousCount: number | null; message: string }
  | { kind: 'result-completed'; mode: 'shadow'; confirmedCount: number | null; previousCount: number | null; message: string }
  | { kind: 're-read-failed'; mode: AutoReviewMode; message: string }
  | { kind: 'request-failed'; message: string }
  | { kind: 'mismatch'; mode: AutoReviewMode; actualMode: string | undefined; message: string };

export function autoReviewModeLabel(mode?: string): string {
  return mode === 'enforce'
    ? 'الاعتماد الآلي مفعّل'
    : mode === 'shadow'
      ? 'اختبار بلا اعتماد'
      : 'الفحص الآلي متوقف';
}

export interface AutoReviewOutcomeInput {
  requestedMode: AutoReviewMode;
  /** True only when the POST returned a response at all (as opposed to throwing). */
  responseReceived: boolean;
  /** True only when the response validated: ok === true AND autoReviewMode === requestedMode. */
  responseOk: boolean;
  /** True when the status re-read after an accepted response threw. */
  rereadFailed: boolean;
  /** Mode reported by the re-read status (undefined when the re-read failed or reported none). */
  rereadMode?: string;
  /** shadowSampleCount from the re-read status; null when unavailable. */
  rereadCount?: number | null;
  /** shadowSampleCount observed before the request; null when unknown. */
  previousCount?: number | null;
  /** True when a completed shadow result row is explicitly visible (never inferred from a mode value). */
  completedResultVisible?: boolean;
}

function toCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function deriveAutoReviewRequestOutcome(input: AutoReviewOutcomeInput): AutoReviewRequestOutcome {
  const { requestedMode } = input;
  if (!input.responseReceived || !input.responseOk) {
    return {
      kind: 'request-failed',
      message: input.responseReceived
        ? 'وصلت استجابة غير مؤكدة من Worker؛ لم يتم تأكيد تغيير وضع الفحص. أعد المحاولة أو راجع حالة الخدمة.'
        : 'تعذر إرسال طلب تغيير وضع الفحص؛ لم يصل أي رد من Worker.',
    };
  }
  if (input.rereadFailed) {
    return {
      kind: 're-read-failed',
      mode: requestedMode,
      message: `تم قبول طلب تغيير الوضع إلى "${autoReviewModeLabel(requestedMode)}"، لكن إعادة قراءة الحالة فشلت، فلم يمكن التحقق النهائي من الوضع الحالي. هذا ليس فشلًا في طلب التغيير نفسه؛ استخدم تحديث حالة الفحص للمحاولة مجددًا.`,
    };
  }
  if (input.rereadMode !== requestedMode) {
    const actualLabel = input.rereadMode === undefined ? 'غير معروف' : autoReviewModeLabel(input.rereadMode);
    return {
      kind: 'mismatch',
      mode: requestedMode,
      actualMode: input.rereadMode,
      message: `تم إرسال الطلب وقبله Worker، لكن الوضع الحالي ما زال "${actualLabel}" وليس الوضع المطلوب — لم يتغير وضع الفحص رغم قبول الطلب. أعد المحاولة أو راجع حالة الخدمة.`,
    };
  }
  if (requestedMode !== 'shadow') {
    return {
      kind: 'mode-confirmed',
      mode: requestedMode,
      message: requestedMode === 'off'
        ? 'تم تأكيد إيقاف الفحص الآلي. ستظل الموافقات السابقة محفوظة.'
        : 'تم تأكيد وضع الفحص: الاعتماد الآلي مفعّل. الاعتماد يقتصر على الحالات التي تجتاز كل البوابات؛ غير الواضح يبقى خارج الفيد.',
    };
  }
  const current = toCount(input.rereadCount);
  const previous = toCount(input.previousCount);
  if (input.completedResultVisible === true || (previous !== null && current !== null && current > previous)) {
    const countClause = current !== null
      ? ` عدد نتائج العينة المؤكدة الآن: ${current}${previous !== null ? ` (كان ${previous} قبل الطلب).` : '.'}`
      : ' نتيجة مراجعة مكتملة ظاهرة في الحالة الحالية.';
    return {
      kind: 'result-completed',
      mode: 'shadow',
      confirmedCount: current,
      previousCount: previous,
      message: `ظهرت نتيجة مراجعة جديدة مؤكدة.${countClause}`,
    };
  }
  let countClause = '';
  if (current !== null && previous !== null) {
    countClause = ` عدد نتائج العينة المؤكدة حاليًا: ${current} (كان ${previous} قبل الطلب)؛ لم يزد العدد، فلم تُثبت نتيجة جديدة بعد.`;
  } else if (current !== null) {
    countClause = ` عدد نتائج العينة المؤكدة حاليًا: ${current}؛ لا توجد مقارنة بعدد سابق، فلا يمكن إثبات نتيجة جديدة من هذا الطلب وحده.`;
  } else {
    countClause = ' عدد النتائج المؤكدة غير متاح في الحالة الحالية، فلا توجد نتيجة جديدة مثبتة بعد.';
  }
  return {
    kind: 'mode-confirmed-awaiting-result',
    mode: 'shadow',
    confirmedCount: current,
    previousCount: previous,
    message: `تم تأكيد وضع Shadow؛ جارٍ التحقق من نتائج المراجعة.${countClause}`,
  };
}
