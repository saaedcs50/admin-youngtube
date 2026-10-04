/**
 * Utility formatters for Arabic UI & Telemetry
 */

export function formatDuration(secondsOrMs: number | undefined | null): string {
  if (secondsOrMs === undefined || secondsOrMs === null || isNaN(Number(secondsOrMs))) {
    return '0 ث';
  }

  let totalSecs = Math.round(Number(secondsOrMs));
  if (totalSecs < 0) totalSecs = 0;

  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  if (hours > 0) {
    return `${hours.toLocaleString('ar-EG')} س ${minutes.toLocaleString('ar-EG')} د`;
  }
  if (minutes > 0) {
    return `${minutes.toLocaleString('ar-EG')} د ${seconds.toLocaleString('ar-EG')} ث`;
  }
  return `${seconds.toLocaleString('ar-EG')} ث`;
}

export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(Number(num))) {
    return '0';
  }
  return Number(num).toLocaleString('ar-EG');
}

export function formatTimestamp(val: string | number | undefined | null): string {
  if (!val) return '—';
  try {
    const date = new Date(val);
    if (isNaN(date.getTime())) return String(val);
    return date.toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(val);
  }
}

const COUNTRY_MAP: Record<string, { name: string; flag: string }> = {
  SA: { name: 'المملكة العربية السعودية', flag: '🇸🇦' },
  EG: { name: 'مصر', flag: '🇪🇬' },
  AE: { name: 'الإمارات العربية المتحدة', flag: '🇦🇪' },
  KW: { name: 'الكويت', flag: '🇰🇼' },
  QA: { name: 'قطر', flag: '🇶🇦' },
  BH: { name: 'البحرين', flag: '🇧🇭' },
  OM: { name: 'عُمان', flag: '🇴🇲' },
  JO: { name: 'الأردن', flag: '🇯🇴' },
  IQ: { name: 'العراق', flag: '🇮🇶' },
  SY: { name: 'سوريا', flag: '🇸🇾' },
  LB: { name: 'لبنان', flag: '🇱🇧' },
  PS: { name: 'فلسطين', flag: '🇵🇸' },
  YE: { name: 'اليمن', flag: '🇾🇪' },
  MA: { name: 'المغرب', flag: '🇲🇦' },
  DZ: { name: 'الجزائر', flag: '🇩🇿' },
  TN: { name: 'تونس', flag: '🇹🇳' },
  LY: { name: 'ليبيا', flag: '🇱🇾' },
  SD: { name: 'السودان', flag: '🇸🇩' },
  TR: { name: 'تركيا', flag: '🇹🇷' },
  US: { name: 'الولايات المتحدة', flag: '🇺🇸' },
  GB: { name: 'المملكة المتحدة', flag: '🇬🇧' },
  DE: { name: 'ألمانيا', flag: '🇩🇪' },
  FR: { name: 'فرنسا', flag: '🇫🇷' },
  CA: { name: 'كندا', flag: '🇨🇦' },
  SE: { name: 'السويد', flag: '🇸🇪' },
  NL: { name: 'هولندا', flag: '🇳🇱' },
  MY: { name: 'ماليزيا', flag: '🇲🇾' },
  ID: { name: 'إندونيسيا', flag: '🇮🇩' },
  XX: { name: 'غير محدد', flag: '🌐' },
  T1: { name: 'Tor', flag: '🌐' },
};

export function getCountryInfo(rawCodeOrName?: string): { code: string; name: string; flag: string } {
  if (!rawCodeOrName) return { code: '??', name: 'غير معروف', flag: '🌐' };

  const clean = rawCodeOrName.trim().toUpperCase();
  if (COUNTRY_MAP[clean]) {
    return { code: clean, ...COUNTRY_MAP[clean] };
  }

  for (const [code, info] of Object.entries(COUNTRY_MAP)) {
    if (info.name.toLowerCase() === rawCodeOrName.toLowerCase()) {
      return { code, ...info };
    }
  }

  return {
    code: clean.slice(0, 3),
    name: rawCodeOrName,
    flag: '🌍',
  };
}
