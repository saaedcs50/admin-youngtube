export const CATEGORY_TAG_ALIASES: Record<string, string[]> = {
  quran: ['quran', 'faith', 'islamic', 'duas', 'religion', 'قرآن', 'أذكار', 'إيمانيات'],
  stories: ['stories', 'reading', 'books', 'fairy_tales', 'tales', 'قصص', 'حكايات', 'قراءة'],
  cartoons: ['cartoons', 'shows', 'songs', 'music', 'animation', 'series', 'كرتون', 'أناشيد', 'أغاني', 'برامج'],
  education: ['education', 'learn', 'language', 'english', 'arabic', 'math', 'alphablocks', 'numberblocks', 'تعليم', 'لغات'],
  science: ['science', 'experiments', 'nature', 'discovery', 'space', 'stem', 'علوم', 'استكشاف'],
  crafts: ['crafts', 'arts', 'drawing', 'coloring', 'origami', 'diy', 'رسم', 'فنون', 'أشغال', 'تلوين'],
  sports: ['sports', 'active', 'yoga', 'movement', 'exercise', 'games', 'حركة', 'رياضة', 'نشاط'],
  // optional buckets if those category ids exist later:
  cooking: ['cooking', 'food', 'kitchen', 'طبخ'],
  gaming: ['gaming', 'games', 'play', 'ألعاب'],
  calm: ['calm', 'sleep', 'relax', 'هدوء', 'نوم'],
};

export function channelMatchesCategory(
  channelCategories: string[] | string | undefined,
  categoryId: string,
  categoryName?: string
): boolean {
  if (!categoryId || categoryId === 'all') return true;
  if (!channelCategories) return false;

  const rawList = Array.isArray(channelCategories) ? channelCategories : [channelCategories];
  const tags: string[] = [];
  for (const item of rawList) {
    if (!item) continue;
    const s = String(item).toLowerCase().trim();
    if (s.includes(',') || s.includes('،')) {
      for (const part of s.split(/[,،]+/)) {
        const trimmed = part.trim();
        if (trimmed) tags.push(trimmed);
      }
    } else if (s) {
      tags.push(s);
    }
  }

  const id = categoryId.toLowerCase().trim();
  const name = (categoryName || '').toLowerCase().trim();
  const aliases = CATEGORY_TAG_ALIASES[id] || [id];

  for (const tag of tags) {
    if (tag === id) return true;
    if (name && (tag === name || name.includes(tag) || tag.includes(name))) return true;
    if (aliases.includes(tag)) return true;
    // reverse: tag is itself a known category key whose aliases include id
    const tagAliases = CATEGORY_TAG_ALIASES[tag];
    if (tagAliases && tagAliases.includes(id)) return true;
  }

  return false;
}
