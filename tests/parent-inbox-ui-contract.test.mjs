import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('admin inbox is registered in navigation and header types', () => {
  assert.match(read('src/types.ts'), /'parent-inbox'/);
  assert.match(read('src/components/Sidebar.tsx'), /id: 'parent-inbox'.*وارد الأهل/);
  assert.match(read('src/components/Header.tsx'), /'parent-inbox':\s*\{/);
  assert.match(read('src/App.tsx'), /activeTab === 'parent-inbox'/);
});

test('admin screen uses the existing authenticated API helper and expected route names', () => {
  const view = read('src/components/ParentInboxView.tsx');
  const api = read('src/services/api.ts');
  assert.match(view, /apiRequest<InboxResponse>\(`\/api\/admin\/parent-inbox/);
  assert.match(view, /action: 'reply'/);
  assert.match(view, /action: name/);
  assert.match(api, /Authorization', `Bearer \$\{adminKey\}`/);
  assert.match(view, /window\.confirm\('الرد ده هيظهر لولي الأمر/);
});

test('admin supports required states, filters, pinning, archive, and private notes', () => {
  const view = read('src/components/ParentInboxView.tsx');
  for (const expected of ['new', 'read', 'replied', 'closed', 'archived', 'mark_read', 'pin', 'archive', 'adminNote', 'noteDraft', 'search']) {
    assert.ok(view.includes(expected), `missing admin inbox feature: ${expected}`);
  }
  assert.equal(view.includes('dangerouslySetInnerHTML'), false);
});
