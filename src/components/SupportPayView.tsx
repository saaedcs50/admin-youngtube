import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  HelpCircle,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { fetchSupportPay, saveSupportPay } from '../services/api';
import { SupportPayData } from '../types';
import { formatTimestamp } from '../utils/formatters';

interface SupportPayViewProps {
  onNotify: (type: 'success' | 'error' | 'info' | 'warning', title: string, desc?: string) => void;
}

export const SupportPayView: React.FC<SupportPayViewProps> = ({ onNotify }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // InstaPay fields
  const [instaPhone, setInstaPhone] = useState('');
  const [instaIpa, setInstaIpa] = useState('');
  const [instaUrl, setInstaUrl] = useState('');
  const [instaName, setInstaName] = useState('');

  // Vodafone Cash fields
  const [vodaPhone, setVodaPhone] = useState('');
  const [vodaName, setVodaName] = useState('');

  // Note
  const [note, setNote] = useState('');

  // Server state metadata
  const [updatedAt, setUpdatedAt] = useState<string | number | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setValidationError(null);
    try {
      const res = (await fetchSupportPay()) as any;
      const root = res?.payload ?? res?.data ?? res;

      const instapay = root?.instapay || root?.insta_pay || {};
      const vodafone = root?.vodafoneCash || root?.vodafone_cash || root?.vodafone || {};

      setInstaPhone(
        instapay.phone ? String(instapay.phone) : root?.instapayPhone || root?.instapay_phone ? String(root.instapayPhone || root.instapay_phone) : ''
      );
      setInstaIpa(
        instapay.ipa ? String(instapay.ipa) : root?.instapayIpa || root?.instapay_ipa ? String(root.instapayIpa || root.instapay_ipa) : ''
      );
      setInstaUrl(
        instapay.url ? String(instapay.url) : root?.instapayUrl || root?.instapay_url ? String(root.instapayUrl || root.instapay_url) : ''
      );
      setInstaName(
        instapay.name ? String(instapay.name) : root?.instapayName || root?.instapay_name ? String(root.instapayName || root.instapay_name) : ''
      );

      setVodaPhone(
        vodafone.phone ? String(vodafone.phone) : root?.vodafonePhone || root?.vodafone_phone ? String(root.vodafonePhone || root.vodafone_phone) : ''
      );
      setVodaName(
        vodafone.name ? String(vodafone.name) : root?.vodafoneName || root?.vodafone_name ? String(root.vodafoneName || root.vodafone_name) : ''
      );

      setNote(root?.note || root?.notes ? String(root.note || root.notes) : '');
      setUpdatedAt(res?.updatedAt || root?.updatedAt || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر جلب بيانات الدعم';
      onNotify('error', 'خطأ في جلب بيانات الدعم', msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const validateFields = (): boolean => {
    const trimmedInstaPhone = instaPhone.trim();
    const trimmedInstaIpa = instaIpa.trim();
    const trimmedInstaUrl = instaUrl.trim();
    const trimmedInstaName = instaName.trim();
    const trimmedVodaPhone = vodaPhone.trim();
    const trimmedVodaName = vodaName.trim();

    if (
      !trimmedInstaPhone ||
      !trimmedInstaIpa ||
      !trimmedInstaUrl ||
      !trimmedInstaName ||
      !trimmedVodaPhone ||
      !trimmedVodaName
    ) {
      const errorMsg =
        'يرجى ملء جميع الحقول المطلوبة لـ InstaPay (الهاتف، IPA، الرابط، الاسم) وفودافون كاش (الهاتف، الاسم) قبل الحفظ. (الملاحظات فقط اختيارية)';
      setValidationError(errorMsg);
      onNotify('error', 'بيانات الدعم غير مكتملة', errorMsg);
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateFields()) {
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    if (!validateFields()) {
      setShowConfirmModal(false);
      return;
    }

    setShowConfirmModal(false);
    setIsSaving(true);

    const payload: SupportPayData = {
      instapay: {
        phone: instaPhone.trim(),
        ipa: instaIpa.trim(),
        url: instaUrl.trim(),
        name: instaName.trim(),
      },
      vodafoneCash: {
        phone: vodaPhone.trim(),
        name: vodaName.trim(),
      },
      note: note.trim(),
    };

    try {
      const result = await saveSupportPay(payload);
      const newTimestamp = result?.updatedAt || new Date().toISOString();
      setUpdatedAt(newTimestamp);
      onNotify('success', 'تم حفظ بيانات الدعم بنجاح', 'تم تحديث البيانات في الخادم بنجاح.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل حفظ بيانات الدعم';
      onNotify('error', 'خطأ في الحفظ', msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="support-pay-view" className="space-y-6">
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              إدارة بيانات الدعم المالي والتبرع
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              البيانات المدخلة هنا يتم تخزينها في الـ Worker وتُعرض في واجهات التطبيق للمستخدمين الراغبين في دعم المشروع.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading || isSaving}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            title="إعادة جلب البيانات من الخادم"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
            <span>إعادة تحميل</span>
          </button>
        </div>
      </div>

      {/* Last updated indicator */}
      {updatedAt && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
          <Clock className="w-4 h-4 text-amber-500 shrink-0" />
          <span>آخر تحديث على الخادم:</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{formatTimestamp(updatedAt)}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSaveClick} className="space-y-6">
        {/* InstaPay Section */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                حساب انستاباي (InstaPay)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                بيانات الدفع عبر شبكة المدفوعات اللحظية انستاباي
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="instapay-phone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                رقم الهاتف (Phone)
              </label>
              <input
                id="instapay-phone"
                type="text"
                dir="ltr"
                value={instaPhone}
                onChange={(e) => setInstaPhone(e.target.value)}
                placeholder="مثال: 01xxxxxxxxx"
                disabled={isLoading || isSaving}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono"
              />
            </div>

            <div>
              <label htmlFor="instapay-ipa" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                عنوان الدفع اللحظي (IPA)
              </label>
              <input
                id="instapay-ipa"
                type="text"
                dir="ltr"
                value={instaIpa}
                onChange={(e) => setInstaIpa(e.target.value)}
                placeholder="username@instapay"
                disabled={isLoading || isSaving}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono"
              />
            </div>

            <div>
              <label htmlFor="instapay-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                اسم المستلم (Account Name)
              </label>
              <input
                id="instapay-name"
                type="text"
                value={instaName}
                onChange={(e) => setInstaName(e.target.value)}
                placeholder="الاسم المسجل في انستاباي"
                disabled={isLoading || isSaving}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>

            <div>
              <label htmlFor="instapay-url" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                رابط الدفع المباشر (URL)
              </label>
              <input
                id="instapay-url"
                type="url"
                dir="ltr"
                value={instaUrl}
                onChange={(e) => setInstaUrl(e.target.value)}
                placeholder="https://instapay.eg/..."
                disabled={isLoading || isSaving}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono"
              />
            </div>
          </div>
        </div>

        {/* Vodafone Cash Section */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                فودافون كاش (Vodafone Cash)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                بيانات التحويل للمحفظة الإلكترونية
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="vodafone-phone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                رقم المحفظة (Phone)
              </label>
              <input
                id="vodafone-phone"
                type="text"
                dir="ltr"
                value={vodaPhone}
                onChange={(e) => setVodaPhone(e.target.value)}
                placeholder="مثال: 01xxxxxxxxx"
                disabled={isLoading || isSaving}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono"
              />
            </div>

            <div>
              <label htmlFor="vodafone-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                اسم صاحب المحفظة (Name)
              </label>
              <input
                id="vodafone-name"
                type="text"
                value={vodaName}
                onChange={(e) => setVodaName(e.target.value)}
                placeholder="الاسم المسجل للمحفظة"
                disabled={isLoading || isSaving}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Note / Message Section */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                ملاحظات أو رسالة توضيحية للمستخدمين
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تظهر أسفل وسائل الدفع كإرشادات إضافية (اختياري)
              </p>
            </div>
          </div>

          <div>
            <textarea
              id="support-note"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="اكتب رسالة أو ملاحظة توضيحية للمتبرعين والداعمين..."
              disabled={isLoading || isSaving}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-y"
            />
          </div>
        </div>

        {/* Validation error display */}
        {validationError && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Actions bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            id="support-pay-save-btn"
            disabled={isLoading || isSaving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm shadow-sm shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>حفظ بيانات الدعم</span>
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  تأكيد حفظ بيانات الدعم
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  يرجى مراجعة وتأكيد العملية
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              هل أنت متأكد من حفظ وتحديث بيانات الدفع في الخادم؟ ستصبح هذه البيانات هي المعتمدة فوراً وتظهر للمستخدمين عند طلب الدعم.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>نعم، تأكيد وحفظ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
