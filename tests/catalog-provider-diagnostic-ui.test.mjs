import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = fs.readFileSync(path.join(root, 'src/services/api.ts'), 'utf8');
const catalogView = fs.readFileSync(path.join(root, 'src/components/CatalogView.tsx'), 'utf8');

test('Gemini provider diagnostic exposes API version and operation in the Admin contract', () => {
  assert.match(api, /export interface CatalogAutoReviewProviderDiagnostic[\s\S]*?apiVersion\?: string/);
  assert.match(api, /export interface CatalogAutoReviewProviderDiagnostic[\s\S]*?operation\?: 'create_interaction' \| 'poll_interaction'/);
  assert.ok(catalogView.includes('status.autoReview.lastProviderDiagnostic.apiVersion'));
  assert.ok(catalogView.includes('status.autoReview.lastProviderDiagnostic.operation'));
  assert.ok(catalogView.includes('نسخة API'));
  assert.ok(catalogView.includes('نوع العملية'));
  assert.ok(catalogView.includes("testCatalogAutoReviewProvider()"));
});

test('the Gemini diagnostic UI labels create versus poll operations without exposing credentials', () => {
  assert.ok(catalogView.includes("=== 'create_interaction' ? 'إنشاء التفاعل'"));
  assert.ok(catalogView.includes("=== 'poll_interaction' ? 'متابعة التفاعل'"));
  assert.equal(catalogView.includes('GEMINI_API_KEY'), false);
  assert.equal(catalogView.includes('ADMIN_KEY'), false);
});
