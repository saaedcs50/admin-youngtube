import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, CheckCheck, Clock3, Inbox, Loader2, LockKeyhole, MessageSquareReply, Pin, RefreshCw, RotateCcw, Search, Send, StickyNote, XCircle } from 'lucide-react';
import { apiRequest } from '../services/api';
import type { ToastMessage } from '../types';

type MessageType = 'bug' | 'suggestion' | 'thanks' | 'question';
type MessageStatus = 'new' | 'read' | 'replied' | 'closed';
type InboxFilter = 'all' | 'new' | 'read' | 'replied' | 'closed' | 'archived';
interface InboxMessage {
  id: string; deviceId: string; createdAt: string; updatedAt: string; type: MessageType; body: string;
  contact: string; appVersion: string; platform: string; status: MessageStatus; readAt: string | null;
  reply: string | null; repliedAt: string | null; adminNote: string; pinned: boolean; archived: boolean;
  closedAt: string | null; archivedAt: string | null;
}
interface InboxResponse { ok: boolean; messages: InboxMessage[]; newCount: number; retainedCount: number }
interface Props { onNotify: (type: ToastMessage['type'], title: string, description?: string) => void; onNewCountChange?: (count: number) => void }
const TEMPLATES_KEY = 'yt_parent_inbox_reply_templates';
const DEFAULT_TEMPLATES = [
  'وصلتنا رسالتك، شكرًا لتواصلك مع YoungTube.',
  'هنراجع الموضوع ونتابع معاك.',
  'تم تسجيل المشكلة، وهنعمل اللازم.',
  'تم إصلاح المشكلة في التحديث الحالي.',
];
const FILTERS: Array<{ value: InboxFilter; label: string }> = [
  { value: 'all', label: 'الكل' }, { value: 'new', label: 'جديدة' }, { value: 'read', label: 'مقروءة' },
  { value: 'replied', label: 'فيها رد' }, { value: 'closed', label: 'مغلقة' }, { value: 'archived', label: 'مؤرشفة' },
];
function typeLabel(value: MessageType): string { return ({ bug: 'مشكلة', suggestion: 'اقتراح', thanks: 'شكر', question: 'سؤال' })[value]; }
function statusLabel(value: MessageStatus): string { return ({ new: 'جديدة', read: 'مقروءة', replied: 'فيها رد', closed: 'مغلقة' })[value]; }
function dateLabel(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'تاريخ غير متاح' : date.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }); }
function loadTemplates(): string[] {
  try { const parsed: unknown = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || 'null'); if (Array.isArray(parsed)) { const values = parsed.filter((x): x is string => typeof x === 'string').slice(0, 5).map((x) => x.slice(0, 200)); if (values.length >= 3) return values; } } catch { /* use defaults */ }
  return [...DEFAULT_TEMPLATES];
}
function friendlyError(error: unknown): string {
  if (!(error instanceof Error)) return 'تعذر إكمال العملية. حاول مرة أخرى.';
  if (error.message.includes('401') || error.message.includes('غير مصرح')) return 'مفتاح المشرف غير صالح أو انتهت صلاحيته. سجل الدخول مرة أخرى.';
  if (error.message.includes('network') || error.message.includes('الشبكة')) return 'تعذر الاتصال بالخادم. تحقق من رابط Worker والاتصال.';
  return error.message.slice(0, 240) || 'تعذر إكمال العملية. حاول مرة أخرى.';
}

export const ParentInboxView: React.FC<Props> = ({ onNotify, onNewCountChange }) => {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [retainedCount, setRetainedCount] = useState(0);
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [templates, setTemplates] = useState<string[]>(loadTemplates);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const loadInbox = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      const result = await apiRequest<InboxResponse>(`/api/admin/parent-inbox${query}`, { method: 'GET' });
      const items = Array.isArray(result.messages) ? result.messages : [];
      setMessages(items); setNewCount(Number(result.newCount || 0)); setRetainedCount(Number(result.retainedCount || items.length));
      onNewCountChange?.(Number(result.newCount || 0));
      setSelectedId((current) => current && items.some((item) => item.id === current) ? current : items[0]?.id || null);
    } catch (error) { setLoadError(friendlyError(error)); }
    finally { setLoading(false); }
  }, [search, onNewCountChange]);
  useEffect(() => { void loadInbox(); }, [loadInbox]);

  const visible = useMemo(() => {
    if (filter === 'archived') return messages.filter((message) => message.archived);
    const active = messages.filter((message) => !message.archived);
    if (filter === 'all') return active;
    if (filter === 'new') return active.filter((message) => message.status === 'new');
    if (filter === 'read') return active.filter((message) => message.status === 'read');
    if (filter === 'replied') return active.filter((message) => message.status === 'replied');
    return active.filter((message) => message.status === 'closed');
  }, [messages, filter]);
  const selected = visible.find((message) => message.id === selectedId) || null;
  useEffect(() => { setReplyDraft(''); setNoteDraft(selected?.adminNote || ''); }, [selectedId, selected?.adminNote]);

  const action = async (message: InboxMessage, name: string, extra: Record<string, unknown> = {}, success = 'تم حفظ التعديل.') => {
    if (busy) return;
    setBusy(`${message.id}:${name}`);
    try {
      await apiRequest(`/api/admin/parent-inbox/${encodeURIComponent(message.id)}`, { method: 'POST', body: JSON.stringify({ action: name, ...extra }) });
      onNotify('success', success);
      await loadInbox();
    } catch (error) { onNotify('error', 'تعذر تنفيذ العملية', friendlyError(error)); }
    finally { setBusy(null); }
  };
  const submitSearch = (event: FormEvent) => { event.preventDefault(); setSearch(searchInput.trim().slice(0, 100)); };
  const submitReply = async (event: FormEvent) => {
    event.preventDefault(); if (!selected || busy) return;
    const reply = replyDraft.trim();
    if (!reply || reply.length > 2000) { onNotify('warning', 'راجع الرد', 'الرد لازم يكون من حرف إلى 2000 حرف.'); return; }
    if (selected.status === 'closed') { onNotify('warning', 'الرسالة مغلقة', 'أعد فتح الرسالة أولًا، ثم ابعت الرد.'); return; }
    if (!window.confirm('الرد ده هيظهر لولي الأمر داخل التطبيق. هل تريد إرساله؟')) return;
    setBusy(`${selected.id}:reply`);
    try {
      await apiRequest(`/api/admin/parent-inbox/${encodeURIComponent(selected.id)}`, { method: 'POST', body: JSON.stringify({ action: 'reply', reply }) });
      setReplyDraft(''); onNotify('success', 'تم إرسال الرد', 'الرد سيظهر على جهاز ولي الأمر المرتبط بالرسالة.'); await loadInbox();
    } catch (error) { onNotify('error', 'تعذر إرسال الرد', friendlyError(error)); }
    finally { setBusy(null); }
  };
  const saveNote = async () => {
    if (!selected || busy) return;
    if (noteDraft.length > 2000) { onNotify('warning', 'الملاحظة طويلة', 'الملاحظة لا تتجاوز 2000 حرف.'); return; }
    await action(selected, 'note', { note: noteDraft }, 'تم حفظ الملاحظة الداخلية.');
  };
  const saveTemplates = () => {
    const values = templates.slice(0, 5).map((item) => item.trim().slice(0, 200));
    if (values.length < 3 || values.some((item) => !item)) { onNotify('warning', 'القوالب غير مكتملة', 'احتفظ بثلاثة قوالب على الأقل، واكتب نصًا في كل قالب.'); return; }
    try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(values)); setTemplates(values); onNotify('success', 'تم حفظ القوالب', 'تم الحفظ في متصفح الأدمن الحالي.'); }
    catch { onNotify('error', 'تعذر حفظ القوالب', 'تأكد أن تخزين المتصفح متاح.'); }
  };

  const statusPill = (message: InboxMessage) => {
    const style = message.status === 'new' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : message.status === 'replied' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : message.status === 'closed' ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' : 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300';
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${style}`}>{statusLabel(message.status)}</span>;
  };

  return <section id="parent-inbox-admin-view" className="space-y-5" dir="rtl">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
      <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0"><Inbox className="w-5 h-5" /></div><div><h2 className="font-extrabold text-base sm:text-lg">وارد الأهل</h2><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">الرسائل الأحدث أولًا. الملاحظات الداخلية لا تظهر لولي الأمر.</p></div></div>
      <div className="flex items-center gap-2 self-start sm:self-auto"><span className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-300">جديدة: {newCount}</span><button type="button" onClick={() => void loadInbox()} disabled={loading || Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> تحديث</button></div>
    </div>
    <form onSubmit={submitSearch} className="flex flex-col sm:flex-row gap-2"><div className="relative flex-1"><Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} maxLength={100} placeholder="ابحث في نص آخر 200 رسالة..." className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-10 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/30" /></div><button type="submit" className="rounded-xl bg-slate-900 dark:bg-amber-500 px-4 py-3 text-sm font-bold text-white dark:text-slate-950 inline-flex justify-center items-center gap-2"><Search className="h-4 w-4" /> بحث</button>{search && <button type="button" onClick={() => { setSearchInput(''); setSearch(''); }} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-bold">مسح البحث</button>}</form>
    <div className="flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label="فلاتر وارد الأهل">{FILTERS.map((item) => <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition ${filter === item.value ? 'border-amber-500 bg-amber-500 text-slate-950' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'}`}>{item.label}</button>)}<span className="text-[11px] text-slate-400 mr-auto shrink-0">المحفوظ: {retainedCount}/500</span></div>
    {loadError && <div role="alert" className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-3.5 text-sm text-rose-800 dark:text-rose-300 flex items-start gap-2"><XCircle className="h-4 w-4 mt-0.5 shrink-0" />{loadError}<button className="mr-auto underline font-bold" type="button" onClick={() => void loadInbox()}>إعادة المحاولة</button></div>}
    {loading ? <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />جاري تحميل الوارد...</div> : visible.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center"><Inbox className="h-8 w-8 mx-auto text-slate-400 mb-3" /><p className="font-bold">لا توجد رسائل في الفلتر ده</p><p className="text-xs text-slate-500 mt-1">جرب فلترًا آخر أو حدّث الوارد.</p></div> : <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.4fr)] gap-4 items-start">
      <div className="space-y-2 max-h-[70vh] overflow-y-auto" aria-label="قائمة الرسائل">{visible.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full text-right rounded-xl border p-3.5 transition ${selectedId === item.id ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20 ring-1 ring-amber-500/20' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70'}`}><div className="flex items-center justify-between gap-2 mb-2"><span className="text-xs font-extrabold">{typeLabel(item.type)}</span><span className="flex items-center gap-1.5">{item.pinned && <Pin className="h-3.5 w-3.5 text-amber-600" />}{statusPill(item)}</span></div><p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2 whitespace-pre-wrap break-words">{item.body}</p><div className="flex items-center justify-between gap-2 mt-3 text-[10px] text-slate-500 dark:text-slate-400"><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{dateLabel(item.createdAt)}</span>{item.archived && <span>مؤرشفة</span>}</div></button>)}</div>
      {selected && <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden min-w-0"><div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-3"><div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-extrabold">{typeLabel(selected.type)} من ولي أمر</h3><p className="text-[11px] text-slate-500 mt-1">{dateLabel(selected.createdAt)} · {selected.id}</p></div><div className="flex flex-wrap items-center justify-end gap-2">{statusPill(selected)}{selected.pinned && <span className="rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold">مثبتة</span>}{selected.archived && <span className="rounded-full bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold">مؤرشفة</span>}</div></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3"><span className="text-slate-500">إصدار التطبيق</span><p className="font-bold mt-1">{selected.appVersion || 'غير معروف'}</p></div><div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3"><span className="text-slate-500">المنصة</span><p className="font-bold mt-1">{selected.platform || 'غير معروفة'}</p></div><div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 sm:col-span-2"><span className="text-slate-500">وسيلة التواصل</span><p className="font-bold mt-1 break-words">{selected.contact || 'لم يضف وسيلة تواصل'}</p></div></div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4"><h4 className="text-xs font-extrabold mb-2">نص الرسالة</h4><p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{selected.body}</p></div>
        <div className="flex flex-wrap gap-2">{selected.status === 'new' && <button type="button" disabled={Boolean(busy)} onClick={() => void action(selected, 'mark_read', {}, 'تم تعليم الرسالة كمقروءة.')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold disabled:opacity-50"><CheckCheck className="h-3.5 w-3.5" /> مقروءة</button>}<button type="button" disabled={Boolean(busy)} onClick={() => void action(selected, 'pin', { pinned: !selected.pinned }, selected.pinned ? 'تم إلغاء التثبيت.' : 'تم تثبيت الرسالة.')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold disabled:opacity-50"><Pin className="h-3.5 w-3.5" />{selected.pinned ? 'إلغاء التثبيت' : 'تثبيت'}</button>{selected.status === 'closed' ? <button type="button" disabled={Boolean(busy)} onClick={() => void action(selected, 'reopen', {}, 'تم إعادة فتح الرسالة.')} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 dark:border-sky-900 text-sky-700 dark:text-sky-300 px-3 py-2 text-xs font-bold disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" /> إعادة فتح</button> : <button type="button" disabled={Boolean(busy)} onClick={() => { if (window.confirm('هل تريد إغلاق الرسالة؟')) void action(selected, 'close', {}, 'تم إغلاق الرسالة.'); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold disabled:opacity-50"><LockKeyhole className="h-3.5 w-3.5" /> إغلاق</button>}<button type="button" disabled={Boolean(busy)} onClick={() => void action(selected, 'archive', { archived: !selected.archived }, selected.archived ? 'تم إلغاء الأرشفة.' : 'تمت أرشفة الرسالة.')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold disabled:opacity-50"><Archive className="h-3.5 w-3.5" />{selected.archived ? 'إلغاء الأرشفة' : 'أرشفة'}</button></div>
      </div><div className="p-4 sm:p-5 space-y-5">{selected.reply && <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 p-3.5"><h4 className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 mb-1">الرد الظاهر لولي الأمر</h4><p className="text-sm text-emerald-950 dark:text-emerald-100 whitespace-pre-wrap break-words">{selected.reply}</p>{selected.repliedAt && <p className="text-[10px] text-emerald-800/70 dark:text-emerald-300/70 mt-2">{dateLabel(selected.repliedAt)}</p>}</div>}
        <form onSubmit={submitReply} className="space-y-3"><div className="flex items-center justify-between gap-2"><h4 className="text-sm font-extrabold flex items-center gap-2"><MessageSquareReply className="h-4 w-4" />{selected.reply ? 'تعديل الرد' : 'اكتب ردًا'}</h4><span className="text-[10px] text-slate-500">{replyDraft.length}/2000</span></div>{selected.status === 'closed' && <p className="text-xs text-amber-700 dark:text-amber-300">الرسالة مغلقة. أعد فتحها قبل إرسال الرد.</p>}<textarea value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} maxLength={2000} rows={4} placeholder="اكتب الرد الذي سيظهر لولي الأمر..." disabled={selected.status === 'closed' || Boolean(busy)} className="w-full resize-y rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-50" /><div className="flex flex-wrap gap-2"><button type="submit" disabled={!replyDraft.trim() || selected.status === 'closed' || Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 px-4 py-2.5 text-xs font-extrabold text-slate-950"><Send className="h-3.5 w-3.5" />{busy === `${selected.id}:reply` ? 'جاري الإرسال...' : 'إرسال الرد'}</button><button type="button" onClick={() => setTemplatesOpen((v) => !v)} className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-bold">إدارة القوالب</button></div><div className="flex flex-wrap gap-2">{templates.map((template, index) => <button key={`${index}-${template.slice(0, 12)}`} type="button" onClick={() => setReplyDraft(template)} className="rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-[11px] font-semibold hover:border-amber-500">قالب {index + 1}</button>)}</div></form>
        {templatesOpen && <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-3"><div><h4 className="text-xs font-extrabold">قوالب الردود الجاهزة</h4><p className="text-[10px] text-slate-500 mt-1">تُحفظ في متصفح الأدمن الحالي.</p></div>{templates.map((template, index) => <label key={index} className="block space-y-1"><span className="text-[11px] font-bold text-slate-500">القالب {index + 1}</span><textarea value={template} maxLength={200} rows={2} onChange={(e) => setTemplates((prev) => prev.map((item, i) => i === index ? e.target.value : item))} className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs outline-none" /></label>)}<button type="button" onClick={saveTemplates} className="rounded-lg bg-slate-900 dark:bg-amber-500 px-3 py-2 text-xs font-bold text-white dark:text-slate-950">حفظ القوالب</button></div>}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2.5"><h4 className="text-sm font-extrabold flex items-center gap-2"><StickyNote className="h-4 w-4" />ملاحظة داخلية للأدمن</h4><p className="text-[11px] text-slate-500">الملاحظة خاصة بالأدمن ولا تظهر لولي الأمر.</p><textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3} maxLength={2000} placeholder="ملاحظة داخلية (حتى 2000 حرف)..." disabled={Boolean(busy)} className="w-full resize-y rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/30" /><button type="button" disabled={Boolean(busy) || noteDraft === selected.adminNote || noteDraft.length > 2000} onClick={() => void saveNote()} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-bold disabled:opacity-50 inline-flex items-center gap-2"><StickyNote className="h-3.5 w-3.5" />حفظ الملاحظة</button></div>
      </div></article>}
    </div>}
    {busy && <div className="fixed bottom-20 left-4 z-50 rounded-xl bg-slate-900 text-white px-3 py-2 text-xs shadow-lg inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />جاري حفظ التعديل...</div>}
  </section>;
};
