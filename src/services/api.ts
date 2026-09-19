/**
 * API client for YoungTube admin — matches Cloudflare Worker contracts.
 */

import {
  AnnouncementItem,
  BlockItem,
  CategoryItem,
  ChannelItem,
  StatusResponse,
  TelemetryCountry,
  TelemetryDaily,
  TelemetryData,
  TimeRangeDays,
} from '../types';

export const DEFAULT_WORKER_URL = 'https://youngtube-worker.saaedbelal.workers.dev';
export const STORAGE_KEY_WORKER_URL = 'worker_url';
export const STORAGE_KEY_ADMIN = 'yt_admin_key';
export const STORAGE_KEY_REMEMBER = 'yt_admin_remember';
export const STORAGE_KEY_CATEGORIES = 'yt_admin_categories_cache';

type UnauthorizedHandler = (message?: string) => void;
let unauthorizedListener: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedListener = handler;
}

export function getWorkerUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_WORKER_URL;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_WORKER_URL);
    if (stored && stored.trim()) {
      return stored.trim().replace(/\/+$/, '');
    }
  } catch {
    /* ignore */
  }

  const envUrl = import.meta.env.VITE_WORKER_URL as string | undefined;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  return DEFAULT_WORKER_URL;
}

export function setWorkerUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY_WORKER_URL, url.trim().replace(/\/+$/, ''));
}

export function resetWorkerUrl(): void {
  localStorage.removeItem(STORAGE_KEY_WORKER_URL);
}

export function getAdminKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(STORAGE_KEY_ADMIN) || localStorage.getItem(STORAGE_KEY_ADMIN);
  } catch {
    return null;
  }
}

export function isRemembered(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true';
}

export function saveAdminKey(key: string, remember: boolean): void {
  const trimmed = key.trim();
  sessionStorage.setItem(STORAGE_KEY_ADMIN, trimmed);
  if (remember) {
    localStorage.setItem(STORAGE_KEY_ADMIN, trimmed);
    localStorage.setItem(STORAGE_KEY_REMEMBER, 'true');
  } else {
    localStorage.removeItem(STORAGE_KEY_ADMIN);
    localStorage.removeItem(STORAGE_KEY_REMEMBER);
  }
}

export function clearAdminKey(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY_ADMIN);
    localStorage.removeItem(STORAGE_KEY_ADMIN);
    localStorage.removeItem(STORAGE_KEY_REMEMBER);
  } catch {
    /* ignore */
  }
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getWorkerUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const adminKey = getAdminKey();

  const headers = new Headers(options.headers || {});
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (adminKey && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${adminKey}`);
  }

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل الاتصال بالخادم';
    throw new Error(`خطأ في الشبكة: ${message} (تأكد من رابط الـ Worker وCORS)`);
  }

  if (response.status === 401) {
    clearAdminKey();
    unauthorizedListener?.('مفتاح المشرف (ADMIN_KEY) غير صالح.');
    throw new Error('غير مصرح (401) — تم مسح المفتاح.');
  }

  if (!response.ok) {
    let errorDetails = '';
    try {
      const errJson = (await response.json()) as { message?: string; error?: string };
      errorDetails = errJson.message || errJson.error || JSON.stringify(errJson);
    } catch {
      try {
        errorDetails = await response.text();
      } catch {
        errorDetails = response.statusText;
      }
    }
    throw new Error(`خطأ من الخادم (${response.status}): ${errorDetails || response.statusText}`);
  }

  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export async function triggerBackfillAllBatch(): Promise<{
  processedChannels: any[];
  cursorBefore: number;
  cursorAfter: number;
  totalChannels: number;
  wrappedAround: boolean;
}> {
  return apiRequest<{
    processedChannels: any[];
    cursorBefore: number;
    cursorAfter: number;
    totalChannels: number;
    wrappedAround: boolean;
  }>('/api/admin/backfill-all-batch', {
    method: 'POST',
  });
}

export async function fetchStatus(): Promise<StatusResponse> {
  return apiRequest<StatusResponse>('/api/admin/status');
}

export async function validateAdminKey(key: string, customWorkerUrl?: string): Promise<StatusResponse> {
  const baseUrl = (customWorkerUrl || getWorkerUrl()).replace(/\/+$/, '');
  const url = `${baseUrl}/api/admin/status`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${key.trim()}`,
      Accept: 'application/json',
    },
  });

  if (response.status === 401) {
    throw new Error('مفتاح المشرف ADMIN_KEY غير صحيح (401)');
  }

  if (!response.ok) {
    throw new Error(`فشل التحقق من المفتاح (${response.status})`);
  }

  return response.json();
}

function asRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(v);
    if (!Number.isNaN(n)) out[k] = n;
  }
  return out;
}

function mergeCountryRecords(
  parentSessions: Record<string, number>,
  parentDuration: Record<string, number>,
  childSessions: Record<string, number>,
  childDuration: Record<string, number>,
  unique: Record<string, number>
): TelemetryCountry[] {
  const codes = new Set([
    ...Object.keys(parentSessions),
    ...Object.keys(parentDuration),
    ...Object.keys(childSessions),
    ...Object.keys(childDuration),
    ...Object.keys(unique),
  ]);
  return [...codes].map((code) => ({
    code,
    country: code,
    parentSessions: parentSessions[code] ?? 0,
    parentDuration: parentDuration[code] ?? 0,
    parentDurationSec: parentDuration[code] ?? 0,
    childSessions: childSessions[code] ?? 0,
    childDuration: childDuration[code] ?? 0,
    childDurationSec: childDuration[code] ?? 0,
    unique: unique[code] ?? 0,
    uniqueUsers: unique[code] ?? 0,
  }));
}

/** Normalize Worker telemetry (ADMIN_PLAN shape) for the dashboard. */
export function normalizeTelemetry(raw: unknown): TelemetryData {
  const res = raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
  const nested = res.data && typeof res.data === 'object' && !Array.isArray(res.data) ? res.data : {};
  const src = { ...nested, ...res };

  const parentSessionsByCountry = asRecord(
    src.parentSessionsByCountry ?? src.parent_sessions_by_country
  );
  const parentDurationSecByCountry = asRecord(
    src.parentDurationSecByCountry ?? src.parent_duration_sec_by_country
  );
  const childSessionsByCountry = asRecord(
    src.childSessionsByCountry ?? src.child_sessions_by_country
  );
  const childDurationSecByCountry = asRecord(
    src.childDurationSecByCountry ?? src.child_duration_sec_by_country
  );
  const uniqueByCountry = asRecord(src.uniqueByCountry ?? src.unique_by_country);

  let countries: TelemetryCountry[] = [];
  if (Array.isArray(src.countries)) countries = src.countries;
  else if (Array.isArray(src.by_country)) countries = src.by_country;
  else if (Array.isArray(src.geo)) countries = src.geo;

  const fromRecords = mergeCountryRecords(
    parentSessionsByCountry,
    parentDurationSecByCountry,
    childSessionsByCountry,
    childDurationSecByCountry,
    uniqueByCountry
  );
  if (fromRecords.length > 0) countries = fromRecords;

  const dailySrc: unknown[] = Array.isArray(src.days)
    ? src.days
    : Array.isArray(src.daily)
      ? src.daily
      : Array.isArray(src.timeline)
        ? src.timeline
        : Array.isArray(src.history)
          ? src.history
          : [];

  const daily: TelemetryDaily[] = dailySrc.map((d) => {
    const row = d && typeof d === 'object' ? (d as Record<string, any>) : {};
    const pS = asRecord(row.parentSessionsByCountry);
    const pD = asRecord(row.parentDurationSecByCountry);
    const cS = asRecord(row.childSessionsByCountry);
    const cD = asRecord(row.childDurationSecByCountry);
    const u = asRecord(row.uniqueByCountry);
    return {
      date: String(row.date ?? ''),
      parentSessions:
        Number(row.parentSessionsTotal ?? row.parentSessions ?? row.parent_sessions ?? 0) ||
        Object.values(pS).reduce((a, b) => a + b, 0),
      parentDuration:
        Number(row.parentDurationSecTotal ?? row.parentDurationSec ?? row.parentDuration ?? 0) ||
        Object.values(pD).reduce((a, b) => a + b, 0),
      childSessions:
        Number(row.childSessionsTotal ?? row.childSessions ?? row.child_sessions ?? 0) ||
        Object.values(cS).reduce((a, b) => a + b, 0),
      childDuration:
        Number(row.childDurationSecTotal ?? row.childDurationSec ?? row.childDuration ?? 0) ||
        Object.values(cD).reduce((a, b) => a + b, 0),
      unique:
        Number(row.uniqueInstallsTotal ?? row.unique ?? row.unique_users ?? 0) ||
        Object.values(u).reduce((a, b) => a + b, 0),
    };
  });

  const parentSessions =
    Number(src.parentSessionsTotal ?? src.parentSessions ?? src.parent_sessions ?? 0) ||
    countries.reduce((a, c) => a + Number(c.parentSessions ?? c.parent_sessions ?? 0), 0);
  const parentDuration =
    Number(src.parentDurationSecTotal ?? src.parentDurationSec ?? src.parentDuration ?? src.parent_duration ?? 0) ||
    countries.reduce((a, c) => a + Number(c.parentDuration ?? c.parentDurationSec ?? c.parent_duration ?? 0), 0);
  const childSessions =
    Number(src.childSessionsTotal ?? src.childSessions ?? src.child_sessions ?? 0) ||
    countries.reduce((a, c) => a + Number(c.childSessions ?? c.child_sessions ?? 0), 0);
  const childDuration =
    Number(src.childDurationSecTotal ?? src.childDurationSec ?? src.childDuration ?? src.child_duration ?? 0) ||
    countries.reduce((a, c) => a + Number(c.childDuration ?? c.childDurationSec ?? c.child_duration ?? 0), 0);
  const unique =
    Number(src.totalUniqueInstalls ?? src.uniqueInstallsTotal ?? src.uniqueUsers ?? src.unique ?? 0) ||
    countries.reduce((a, c) => a + Number(c.unique ?? c.uniqueUsers ?? 0), 0);

  return {
    ...src,
    parentSessions,
    parentDuration,
    childSessions,
    childDuration,
    unique,
    uniqueUsers: unique,
    parentSessionsTotal: parentSessions,
    parentDurationSecTotal: parentDuration,
    childSessionsTotal: childSessions,
    childDurationSecTotal: childDuration,
    totalUniqueInstalls: unique,
    countries,
    daily,
    parentSessionsByCountry,
    parentDurationSecByCountry,
    childSessionsByCountry,
    childDurationSecByCountry,
    uniqueByCountry,
  };
}

export async function fetchTelemetry(days: TimeRangeDays = 7): Promise<TelemetryData> {
  const res = await apiRequest<unknown>(`/api/admin/telemetry?days=${days}`);
  return normalizeTelemetry(res);
}

function pushBlockIds(items: BlockItem[], ids: unknown, type: 'channel' | 'playlist') {
  if (!Array.isArray(ids)) return;
  for (const id of ids) {
    if (typeof id === 'string' && id.trim()) {
      items.push({ id: id.trim(), type });
    } else if (id && typeof id === 'object' && 'id' in (id as object)) {
      const rec = id as { id: string; type?: string };
      items.push({ id: String(rec.id), type: (rec.type as 'channel' | 'playlist') || type });
    }
  }
}

export async function fetchGlobalBlocks(): Promise<BlockItem[]> {
  const res = await apiRequest<any>('/api/global-blocks');
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.blocks)) return res.blocks;
  if (res && Array.isArray(res.items)) return res.items;
  if (res && res.data && Array.isArray(res.data)) return res.data;

  const items: BlockItem[] = [];
  if (res && typeof res === 'object') {
    pushBlockIds(items, res.channelIds, 'channel');
    pushBlockIds(items, res.playlistIds, 'playlist');
    pushBlockIds(items, res.channels, 'channel');
    pushBlockIds(items, res.playlists, 'playlist');
  }
  return items;
}

export async function manageBlock(payload: {
  action: 'add' | 'remove';
  type: 'channel' | 'playlist';
  id: string;
}): Promise<unknown> {
  return apiRequest('/api/admin/blocks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchChannelsLatest(): Promise<ChannelItem[]> {
  const res = await apiRequest<any>('/api/channels-latest');
  // apiRequest already attaches Bearer if logged in; public endpoint also works without
  const list = Array.isArray(res) ? res
    : Array.isArray(res?.channels) ? res.channels
    : Array.isArray(res?.items) ? res.items
    : [];
  return list.map(normalizeChannelItem).filter((x) => x.sourceId);
}

export function extractChannelsFromStatus(status: StatusResponse): ChannelItem[] {
  const candidates = [
    status.channels,
    status.sources,
    (status as any).items,
    (status as any).list,
    (status as any).archive,
    (status as any).channelList,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length >= 0) {
      return c.map(normalizeChannelItem).filter((x) => x.sourceId);
    }
  }
  if (status.archive && typeof status.archive === 'object') {
    const inner = (status.archive as any).channels || (status.archive as any).items;
    if (Array.isArray(inner)) return inner.map(normalizeChannelItem).filter((x) => x.sourceId);
  }
  return [];
}

function normalizeChannelItem(raw: any): ChannelItem {
  if (typeof raw === 'string') {
    return { sourceId: raw, sourceType: raw.startsWith('PL') ? 'playlist' : 'channel', title: raw };
  }
  const sourceId = String(raw.sourceId || raw.id || raw.channelId || raw.playlistId || '');
  const sourceType: 'channel' | 'playlist' =
    raw.sourceType === 'playlist' || String(sourceId).startsWith('PL') ? 'playlist' : 'channel';
  const title = String(raw.title || raw.name || sourceId);
  const categories = Array.isArray(raw.categories) ? raw.categories : undefined;
  return {
    ...raw,
    sourceId,
    sourceType,
    title,
    categories,
  };
}

export async function addChannel(item: {
  sourceId: string;
  sourceType: 'channel' | 'playlist';
  title: string;
  categories?: string[];
}): Promise<unknown> {
  return apiRequest('/api/admin/channels', {
    method: 'POST',
    body: JSON.stringify({
      action: 'add',
      channel: item,
      item,
    }),
  });
}

export async function removeChannel(sourceId: string): Promise<unknown> {
  return apiRequest('/api/admin/channels', {
    method: 'POST',
    body: JSON.stringify({ action: 'remove', sourceId }),
  });
}

export async function fetchAnnouncements(): Promise<AnnouncementItem[]> {
  const res = await apiRequest<any>('/api/announcements?all=true');
  let list: unknown[] = [];
  if (Array.isArray(res)) list = res;
  else if (res && Array.isArray(res.announcements)) list = res.announcements;
  else if (res && Array.isArray(res.items)) list = res.items;
  else if (res && res.data && Array.isArray(res.data)) list = res.data;

  return list.map((a: any) => ({
    id: String(a.id ?? ''),
    title: String(a.title ?? ''),
    body: String(a.body ?? a.message ?? ''),
    severity: a.severity === 'warning' || a.severity === 'critical' ? 'warning' : 'info',
    active: a.active !== false,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    ...a,
  })).filter((a) => a.id);
}

export async function postAnnouncement(announcement: {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning';
  active: boolean;
}): Promise<unknown> {
  return apiRequest('/api/admin/announcements', {
    method: 'POST',
    body: JSON.stringify(announcement),
  });
}

export const INITIAL_DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: 'quran', name: 'قرآن كريم وأذكار', icon: 'BookOpen', order: 1, description: 'تلاوات، تجويد، وقصص القرآن للأطفال' },
  { id: 'stories', name: 'قصص وحكايات', icon: 'Sparkles', order: 2, description: 'قصص الأنبياء، الحكايات الهادفة والتربوية' },
  { id: 'cartoons', name: 'كرتون وأناشيد', icon: 'Smile', order: 3, description: 'رسوم متحركة هادفة وأناشيد أطفال نظيفة' },
  { id: 'education', name: 'تعليم ولغات', icon: 'GraduationCap', order: 4, description: 'الحروف، الأرقام، الإنجليزية، والتأسيس' },
  { id: 'science', name: 'علوم واستكشاف', icon: 'Atom', order: 5, description: 'تجارب علمية، الطبيعة، والحيوانات' },
  { id: 'crafts', name: 'رسم وفنون', icon: 'Palette', order: 6, description: 'أشغال يدوية، تلوين، وتنمية المهارات' },
  { id: 'sports', name: 'حركة ورياضة', icon: 'Dumbbell', order: 7, description: 'تمارين رياضية ونشاط بدني للأطفال' },
];

export async function fetchCategories(): Promise<CategoryItem[]> {
  try {
    const res = await apiRequest<any>('/api/categories');
    let list: unknown[] = [];
    if (Array.isArray(res)) list = res;
    else if (res && Array.isArray(res.categories)) list = res.categories;
    else if (res && Array.isArray(res.items)) list = res.items;
    else if (res && Array.isArray(res.data)) list = res.data;

    if (list.length > 0) {
      const parsed = list.map((c: any, index: number): CategoryItem => ({
        id: String(c.id ?? c.slug ?? c.name ?? `cat-${index}`),
        name: String(c.name ?? c.title ?? c.id ?? ''),
        icon: c.icon || 'Tag',
        order: Number(c.order ?? index + 1),
        description: c.description || '',
        ...c,
      })).filter((c) => c.id && c.name);

      // Cache locally
      try {
        localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(parsed));
      } catch {
        /* ignore */
      }
      return parsed;
    }
  } catch (err) {
    console.warn('Could not fetch categories from server endpoint, attempting fallback...', err);
  }

  // Fallback to local storage cache or initial defaults
  try {
    const cached = localStorage.getItem(STORAGE_KEY_CATEGORIES);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }

  return INITIAL_DEFAULT_CATEGORIES;
}

export async function saveCategory(category: CategoryItem): Promise<unknown> {
  // 1. Try sending to Worker
  let workerResult: unknown = null;
  try {
    workerResult = await apiRequest('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify({
        action: 'save',
        category,
        item: category,
      }),
    });
  } catch (err) {
    console.warn('Worker save category failed, persisting locally in cache:', err);
  }

  // 2. Also update local cache
  try {
    const current = await fetchCategories();
    const existingIndex = current.findIndex((c) => c.id === category.id);
    let updated: CategoryItem[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = { ...updated[existingIndex], ...category };
    } else {
      updated = [...current, { ...category, order: category.order || current.length + 1 }];
    }
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(updated));
  } catch {
    /* ignore */
  }

  return workerResult || { ok: true, savedLocally: true };
}

export async function deleteCategory(categoryId: string): Promise<unknown> {
  // 1. Try sending delete to Worker
  let workerResult: unknown = null;
  try {
    workerResult = await apiRequest('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify({
        action: 'delete',
        id: categoryId,
        categoryId,
      }),
    });
  } catch (err) {
    console.warn('Worker delete category failed, deleting from local cache:', err);
  }

  // 2. Remove from local cache
  try {
    const current = await fetchCategories();
    const updated = current.filter((c) => c.id !== categoryId);
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(updated));
  } catch {
    /* ignore */
  }

  return workerResult || { ok: true, deletedLocally: true };
}

export async function reorderCategories(categories: CategoryItem[]): Promise<unknown> {
  const ordered = categories.map((c, idx) => ({ ...c, order: idx + 1 }));

  // 1. Send to Worker
  let workerResult: unknown = null;
  try {
    workerResult = await apiRequest('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify({
        action: 'reorder',
        categories: ordered,
        categoryIds: ordered.map((c) => c.id),
      }),
    });
  } catch (err) {
    console.warn('Worker reorder failed, updating local cache:', err);
  }

  // 2. Update local cache
  try {
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(ordered));
  } catch {
    /* ignore */
  }

  return workerResult || { ok: true };
}

