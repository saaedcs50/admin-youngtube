import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('catalog review queue exposes metadata freshness and blocks approvals with missing or stale metadata', () => {
  const api = read('src/services/api.ts');
  const view = read('src/components/CatalogView.tsx');

  assert.match(api, /metadata_checked_at\?: string \| null;/);
  assert.match(view, /const METADATA_MAX_AGE_MS = 20 \* 24 \* 60 \* 60 \* 1000;/);
  assert.match(view, /function hasFreshMetadata\(item: CatalogReviewItem\): boolean/);
  assert.match(view, /Number\.isFinite\(checkedAt\) && Date\.now\(\) - checkedAt < METADATA_MAX_AGE_MS/);
  assert.match(view, /return hasFreshMetadata\(item\) && item\.shorts_check_status === 'NOT_SHORTS'/);
  assert.match(view, /بيانات YouTube قديمة أو غير متحققة/);
});
