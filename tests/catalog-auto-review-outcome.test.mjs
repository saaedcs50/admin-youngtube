import assert from 'node:assert/strict';
import { test } from 'node:test';

// Logic tests for the pure outcome derivation in src/lib/autoReviewOutcome.ts.
// Unlike the source-pattern tests, these execute the derivation itself: given an
// endpoint response, a re-read status (or re-read error), and the pre-request
// shadowSampleCount, they assert the exact outcome state the panel must show.
// The three facts stay separate: mode confirmed, execution started (NOT proven
// by mode confirmation — the mode endpoint returns no enqueue/eligible/
// scheduler information), and an actual result completed (proven only by a
// completed result visible in actual status).
// No test in this file requests 'enforce': the enforce-activation guard below
// asserts that no tested transition ever produces enforce on its own.
import { deriveAutoReviewRequestOutcome } from '../src/lib/autoReviewOutcome.ts';

const acceptedShadow = {
  requestedMode: 'shadow',
  responseReceived: true,
  responseOk: true,
  rereadFailed: false,
};

test('Mode-change acceptance with no evidence any review started stays awaiting-result, not completed', () => {
  const outcome = deriveAutoReviewRequestOutcome({
    ...acceptedShadow,
    rereadMode: 'shadow',
    rereadCount: 0,
    previousCount: 0,
  });
  assert.equal(outcome.kind, 'mode-confirmed-awaiting-result');
  assert.notEqual(outcome.kind, 'result-completed');
  assert.match(outcome.message, /تم تأكيد وضع Shadow؛ جارٍ التحقق من نتائج المراجعة/);
  assert.match(outcome.message, /لم تُثبت نتيجة جديدة بعد/);
});

test('Mode-change acceptance without a shadowSampleCount increase is explicitly not complete', () => {
  const outcome = deriveAutoReviewRequestOutcome({
    ...acceptedShadow,
    rereadMode: 'shadow',
    rereadCount: 3,
    previousCount: 3,
  });
  assert.equal(outcome.kind, 'mode-confirmed-awaiting-result');
  assert.notEqual(outcome.kind, 'result-completed');
  assert.match(outcome.message, /لم يزد العدد/);
  assert.match(outcome.message, /3/);
});

test('Actual review result completion visible in status produces a completed state with the confirmed count', () => {
  const byCount = deriveAutoReviewRequestOutcome({
    ...acceptedShadow,
    rereadMode: 'shadow',
    rereadCount: 5,
    previousCount: 2,
  });
  assert.equal(byCount.kind, 'result-completed');
  assert.equal(byCount.confirmedCount, 5);
  assert.equal(byCount.previousCount, 2);
  assert.match(byCount.message, /ظهرت نتيجة مراجعة جديدة مؤكدة/);
  assert.match(byCount.message, /5/);

  const byVisibleResult = deriveAutoReviewRequestOutcome({
    ...acceptedShadow,
    rereadMode: 'shadow',
    rereadCount: 4,
    previousCount: 4,
    completedResultVisible: true,
  });
  assert.equal(byVisibleResult.kind, 'result-completed');
  assert.match(byVisibleResult.message, /عدد نتائج العينة المؤكدة الآن: 4/);

  // Flag with no usable count still completes, via the visible-result clause.
  const byVisibleResultNoCount = deriveAutoReviewRequestOutcome({
    ...acceptedShadow,
    rereadMode: 'shadow',
    rereadCount: null,
    previousCount: null,
    completedResultVisible: true,
  });
  assert.equal(byVisibleResultNoCount.kind, 'result-completed');
  assert.match(byVisibleResultNoCount.message, /نتيجة مراجعة مكتملة ظاهرة في الحالة الحالية/);

  // Without a baseline count, a non-zero count alone cannot prove a NEW result.
  const noBaseline = deriveAutoReviewRequestOutcome({
    ...acceptedShadow,
    rereadMode: 'shadow',
    rereadCount: 7,
    previousCount: null,
  });
  assert.equal(noBaseline.kind, 'mode-confirmed-awaiting-result');
  assert.notEqual(noBaseline.kind, 'result-completed');
});

test('Status re-read failure after mode-change acceptance is distinct from request failure', () => {
  const outcome = deriveAutoReviewRequestOutcome({
    ...acceptedShadow,
    rereadFailed: true,
    previousCount: 0,
  });
  assert.equal(outcome.kind, 're-read-failed');
  assert.notEqual(outcome.kind, 'request-failed');
  assert.match(outcome.message, /تم قبول طلب تغيير الوضع/);
  assert.match(outcome.message, /إعادة قراءة الحالة فشلت/);
  assert.match(outcome.message, /هذا ليس فشلًا في طلب التغيير نفسه/);
});

test('Mode-change request failure and unconfirmed responses all yield the failed state', () => {
  const thrown = deriveAutoReviewRequestOutcome({
    requestedMode: 'shadow',
    responseReceived: false,
    responseOk: false,
    rereadFailed: false,
    previousCount: 0,
  });
  assert.equal(thrown.kind, 'request-failed');
  assert.match(thrown.message, /لم يصل أي رد من Worker/);

  const okFalse = deriveAutoReviewRequestOutcome({
    ...acceptedShadow,
    responseOk: false,
    rereadFailed: false,
  });
  assert.equal(okFalse.kind, 'request-failed');
  assert.match(okFalse.message, /استجابة غير مؤكدة/);

  const modeMismatch = deriveAutoReviewRequestOutcome({
    ...acceptedShadow,
    responseOk: false,
    rereadFailed: false,
  });
  assert.equal(modeMismatch.kind, 'request-failed');

  // Empty body: no ok flag, no mode — unconfirmed, not success.
  const emptyBody = deriveAutoReviewRequestOutcome({
    requestedMode: 'shadow',
    responseReceived: true,
    responseOk: false,
    rereadFailed: false,
  });
  assert.equal(emptyBody.kind, 'request-failed');

  // Accepted response but re-read shows the old mode: mismatch, not failure.
  const mismatch = deriveAutoReviewRequestOutcome({
    ...acceptedShadow,
    rereadMode: 'off',
    rereadCount: 0,
    previousCount: 0,
  });
  assert.equal(mismatch.kind, 'mismatch');
  assert.equal(mismatch.actualMode, 'off');
  assert.match(mismatch.message, /لم يتغير وضع الفحص رغم قبول الطلب/);
});

test('No tested transition ever produces enforce unless explicitly requested — and no test requests it', () => {
  const requestedModes = ['off', 'shadow'];
  const variants = [
    { responseReceived: true, responseOk: true, rereadFailed: false, rereadMode: 'shadow', rereadCount: 1, previousCount: 0 },
    { responseReceived: true, responseOk: true, rereadFailed: false, rereadMode: 'off', rereadCount: 0, previousCount: 0 },
    { responseReceived: true, responseOk: false, rereadFailed: false },
    { responseReceived: false, responseOk: false, rereadFailed: false },
    { responseReceived: true, responseOk: true, rereadFailed: true },
    { responseReceived: true, responseOk: true, rereadFailed: false, rereadMode: 'shadow', rereadCount: 0, previousCount: 0, completedResultVisible: true },
  ];
  for (const requestedMode of requestedModes) {
    for (const variant of variants) {
      const outcome = deriveAutoReviewRequestOutcome({ requestedMode, previousCount: 0, ...variant });
      if ('mode' in outcome) {
        assert.notEqual(outcome.mode, 'enforce', `requested ${requestedMode} must never yield enforce`);
        assert.equal(outcome.mode, requestedMode, `outcome mode must track the requested mode, not synthesize one`);
      }
    }
  }
});

test('Non-shadow mode confirmation stays a plain mode confirmation with no result claim', () => {
  const outcome = deriveAutoReviewRequestOutcome({
    requestedMode: 'off',
    responseReceived: true,
    responseOk: true,
    rereadFailed: false,
    rereadMode: 'off',
    rereadCount: 0,
    previousCount: 0,
  });
  assert.equal(outcome.kind, 'mode-confirmed');
  assert.equal(outcome.mode, 'off');
  assert.match(outcome.message, /تم تأكيد إيقاف الفحص الآلي/);
  assert.doesNotMatch(outcome.message, /نتيجة/);
});
