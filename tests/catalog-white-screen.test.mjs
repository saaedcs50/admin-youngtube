import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('CatalogView handles the initial null status before rendering status-dependent UI', () => {
  const view = read('src/components/CatalogView.tsx');
  const initialStatus = view.indexOf('useState<CatalogStatusResponse | null>(null)');
  const nullGuard = view.indexOf('if (!status) {');
  const statusDependentUi = view.indexOf("status.autoReview?.mode");

  assert.ok(initialStatus >= 0, 'CatalogView should make the loading state explicit');
  assert.ok(nullGuard > initialStatus, 'CatalogView should guard null status before the main render');
  assert.ok(statusDependentUi > nullGuard, 'status-dependent JSX should only be reached after the guard');
  assert.match(view.slice(nullGuard, statusDependentUi), /aria-live="polite"/);
  assert.match(view, /setLoadError\(message\)/);
  assert.match(view, /إعادة المحاولة/);
});

test('Admin dashboard contains rendering failures inside a recoverable ErrorBoundary', () => {
  const app = read('src/App.tsx');
  const boundary = read('src/components/ErrorBoundary.tsx');

  assert.match(app, /import \{ ErrorBoundary \} from '\.\/components\/ErrorBoundary';/);
  assert.match(app, /<ErrorBoundary fallbackTitle="تعذر عرض هذا القسم">/);
  assert.match(app, /<\/ErrorBoundary>/);
  assert.match(boundary, /static getDerivedStateFromError/);
  assert.match(boundary, /إعادة المحاولة/);
});
