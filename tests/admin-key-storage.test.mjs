import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const api = fs.readFileSync(path.join(root, 'src/services/api.ts'), 'utf8');
const login = fs.readFileSync(path.join(root, 'src/components/LoginScreen.tsx'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'src/components/SettingsView.tsx'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
test('raw ADMIN_KEY is session-only and old persistent copies are removed', () => {
 assert.ok(api.includes('sessionStorage.getItem(STORAGE_KEY_ADMIN)'));
 assert.ok(api.includes('sessionStorage.setItem(STORAGE_KEY_ADMIN, trimmed)'));
 assert.ok(api.includes('localStorage.removeItem(STORAGE_KEY_ADMIN)'));
 assert.equal(api.includes('localStorage.getItem(STORAGE_KEY_ADMIN)'), false);
 assert.equal(api.includes('localStorage.setItem(STORAGE_KEY_ADMIN'), false);
 assert.ok(api.includes("localStorage.removeItem('yt_admin_remember')"));
 assert.doesNotMatch(login, /rememberMe|remember-me-checkbox|setRememberMe/);
 assert.doesNotMatch(settings, /rememberDevice|settings-remember-checkbox|handleToggleRemember|isRemembered/);
});
test('admin dev and preview servers bind to loopback by default', () => {
 assert.ok(pkg.scripts.dev.includes('127.0.0.1'));
 assert.ok(pkg.scripts.preview.includes('127.0.0.1'));
 assert.equal(pkg.scripts.dev.includes('0.0.0.0'), false);
 assert.equal(pkg.scripts.preview.includes('0.0.0.0'), false);
});
