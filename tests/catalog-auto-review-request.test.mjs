import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

// Regression coverage for the 2026-10-26 production observation: the "ابدأ اختبار العينة"
// sample test was clicked once and, after 60s + 300s + refresh + reload, counters stayed
// exactly 0/10, 0/2000, 0/480 with no error text. Root cause in the admin panel: the
// mode-change handler used a blocking window.confirm (silently dismissible with no trace)
// and then discarded the API response, so any HTTP 200 — including {ok:false} or an empty
// body — produced the "بدأ الاختبار الآلي" success toast. These tests pin the replacement
// behavior: in-panel confirmation, response validation, and post-reload mode verification
// with a persistent in-section outcome (not toast-only).
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Auto-review mode changes are confirmed through the in-panel modal, not window.confirm', () => {
  const view = read('src/components/CatalogView.tsx');
  assert.match(view, /import \{ ConfirmModal \} from '\.\/ConfirmModal';/);
  assert.match(view, /const \[pendingAutoReviewMode, setPendingAutoReviewMode\]/);
  assert.match(view, /<ConfirmModal/);
  assert.match(view, /isOpen=\{pendingAutoReviewMode !== null\}/);
  assert.match(view, /onCancel=\{\(\) => setPendingAutoReviewMode\(null\)\}/);
  assert.match(view, /onConfirm=\{\(\) => void confirmAutoReviewMode\(\)\}/);

  // The modal confirmation text must still disclose the same limits as the old dialog.
  assert.match(view, /سيبدأ اختبارًا آليًا لا يعتمد الفيديوهات ولا يرفضها تلقائيًا/);
  assert.match(view, /لا تفعّل هذا الخيار إلا بعد فحص نتائج 10 فيديوهات على الأقل من العينة التجريبية/);
  assert.match(view, /إيقاف جدولة الفحص الآلي الجديد؟ ستظل الفيديوهات المعتمدة سابقًا كما هي/);

  // Scope the window.confirm ban to the mode-change path: extract from the request
  // handler to the next handler and assert no native dialog remains inside it.
  const requestStart = view.indexOf('const requestAutoReviewMode');
  const confirmEnd = view.indexOf('const decide =');
  assert.ok(requestStart >= 0, 'requestAutoReviewMode should exist');
  assert.ok(confirmEnd > requestStart, 'mode-change handlers should precede the review handler');
  assert.doesNotMatch(view.slice(requestStart, confirmEnd), /window\.confirm/);
  // The old response-blind handler must be gone entirely.
  assert.doesNotMatch(view, /changeAutoReviewMode/);
});

test('Auto-review mode change validates the API response before reporting success', () => {
  const view = read('src/components/CatalogView.tsx');
  const confirmStart = view.indexOf('const confirmAutoReviewMode');
  const decideStart = view.indexOf('const decide =');
  assert.ok(confirmStart >= 0, 'confirmAutoReviewMode should exist');
  const body = view.slice(confirmStart, decideStart);

  assert.match(body, /const result = await setCatalogAutoReviewMode\(/);
  assert.match(body, /result\?\.ok !== true \|\| result\?\.autoReviewMode !== mode/);
  assert.match(body, /kind: 'failed'/);
  // A rejected response must not fall through to the success toast.
  const failedPos = body.indexOf("kind: 'failed'");
  const successPos = body.indexOf("onNotify('success'");
  assert.ok(failedPos >= 0 && successPos > failedPos, 'failure state must be set before any success path');
});

test('Auto-review mode change verifies the reloaded mode and keeps the outcome persistent', () => {
  const view = read('src/components/CatalogView.tsx');
  const confirmStart = view.indexOf('const confirmAutoReviewMode');
  const decideStart = view.indexOf('const decide =');
  const body = view.slice(confirmStart, decideStart);

  // The fresh status is read directly (not from async component state) and compared
  // against the requested mode; a mismatch is a persistent warning, not a silent toast.
  assert.match(body, /const nextStatus = await fetchCatalogStatus\(\)/);
  assert.match(body, /if \(nextStatus\.autoReview\?\.mode !== mode\)/);
  assert.match(body, /kind: 'mismatch'/);
  assert.match(body, /kind: 'confirmed'/);
  assert.match(body, /onNotify\('warning', 'وضع الفحص لم يتغير'/);

  // The outcome lives in section state rendered next to the buttons, so it survives
  // the 4500ms toast lifetime.
  assert.match(view, /const \[autoReviewRequest, setAutoReviewRequest\]/);
  assert.match(view, /\{autoReviewRequest && \(/);
  assert.match(view, /autoReviewRequest\.message/);
});

test('Auto-review mode gates are preserved: provider check and the 10-sample enforce gate', () => {
  const view = read('src/components/CatalogView.tsx');
  const requestStart = view.indexOf('const requestAutoReviewMode');
  const messageStart = view.indexOf('const pendingAutoReviewTitle');
  assert.ok(requestStart >= 0 && messageStart > requestStart, 'request handler should exist');
  const body = view.slice(requestStart, messageStart);

  assert.match(body, /mode !== 'off' && autoReview\?\.providerConfigured !== true/);
  assert.match(body, /مفتاح الفحص غير متاح/);
  assert.match(body, /mode === 'enforce' && Number\(autoReview\?\.shadowSampleCount \|\| 0\) < 10/);
  assert.match(body, /العينة التجريبية غير كافية/);
  // The enforce request still carries the sample-audit confirmation flag.
  assert.match(view, /mode === 'enforce' \? \{ sampleAuditConfirmed: true \} : \{\}/);
});

test('Auto-review mode buttons only open the modal; the API call lives in the confirm path', () => {
  const view = read('src/components/CatalogView.tsx');
  assert.match(view, /onClick=\{\(\) => requestAutoReviewMode\('shadow'\)\}/);
  assert.match(view, /onClick=\{\(\) => requestAutoReviewMode\('enforce'\)\}/);
  assert.match(view, /onClick=\{\(\) => requestAutoReviewMode\('off'\)\}/);
  // Exactly one call site for the mode endpoint, inside confirmAutoReviewMode.
  const callSites = view.match(/setCatalogAutoReviewMode\(/g) || [];
  assert.equal(callSites.length, 1, 'the mode endpoint should be called from exactly one place');
  const confirmStart = view.indexOf('const confirmAutoReviewMode');
  const callPos = view.indexOf('setCatalogAutoReviewMode(');
  assert.ok(callPos > confirmStart, 'the single call site should be inside confirmAutoReviewMode');
});

test('Modal limit fallbacks match the Worker server defaults, not the old dialog values', () => {
  const view = read('src/components/CatalogView.tsx');
  assert.match(view, /dailyVideoLimit \?\? 2000/);
  assert.match(view, /dailyVideoSecondsLimit \?\? 28800/);
  assert.match(view, /maxVideoSeconds \?\? 1800/);
  assert.doesNotMatch(view, /dailyVideoLimit \?\? 24/);
  assert.doesNotMatch(view, /maxVideoSeconds \?\? 600/);
});
