export const CATEGORY_TAG_ALIASES: Record<string, string[]> = {
  all: ['all', 'الكل', 'الرئيسية'],
  quran: [
    'quran', 'faith', 'islamic', 'islam', 'deen', 'deeny', 'religion', 'religious',
    'duas', 'azkar', 'prophets', 'quran_recitation', 'nasheed',
    'قرآن', 'قرآن كريم', 'أذكار', 'إيمانيات', 'دين', 'إسلاميات', 'سير وقيم', 'قصص الأنبياء',
  ],
  stories: [
    'stories', 'story', 'storytime', 'reading', 'books', 'book', 'tales', 'fairy_tales',
    'fairytales', 'bedtime_stories',
    'قصص', 'حكايات', 'قراءة', 'كتب', 'مغامرات', 'حكاية', 'قصة',
  ],
  cartoons: [
    'cartoons', 'cartoon', 'shows', 'show', 'animation', 'series', 'songs', 'song',
    'music', 'nursery_rhymes', 'rhymes', 'anashid', 'kids_songs', 'tv', 'episodes',
    'كرتون', 'أناشيد', 'أغاني', 'برامج', 'رسوم متحركة', 'مسلسلات', 'طرب الصغار',
  ],
  education: [
    'education', 'educational', 'learn', 'learning', 'language', 'languages', 'english',
    'arabic', 'math', 'mathematics', 'numbers', 'letters', 'alphabet', 'alphablocks',
    'numberblocks', 'phonics', 'grammar', 'preschool', 'kindergarten', 'study', 'skills',
    'تعليم', 'لغات', 'أرقام', 'حروف', 'رياضيات', 'لغة عربية', 'لغة إنجليزية', 'دراسة', 'مهارات',
  ],
  science: [
    'science', 'stem', 'experiments', 'experiment', 'nature', 'discovery', 'discoveries',
    'space', 'astronomy', 'physics', 'biology', 'chemistry', 'animals', 'wildlife', 'earth',
    'technology', 'tech', 'how_it_works',
    'علوم', 'استكشاف', 'تجارب', 'طبيعة', 'فضاء', 'حيوانات', 'تكنولوجيا', 'ابتكار',
  ],
  crafts: [
    'crafts', 'craft', 'arts', 'art', 'drawing', 'draw', 'coloring', 'colors', 'origami',
    'diy', 'painting', 'paint', 'sketch', 'handicrafts', 'clay', 'making',
    'رسم', 'فنون', 'أشغال', 'أعمال يدوية', 'تلوين', 'أشغال يدوية', 'ابتكار وفنون',
  ],
  sports: [
    'sports', 'sport', 'active', 'activity', 'fitness', 'movement', 'move', 'exercise',
    'workout', 'yoga', 'gymnastics', 'football', 'soccer', 'games', 'play', 'challenges',
    'حركة', 'رياضة', 'نشاط', 'تمارين', 'لياقة', 'ألعاب حركية', 'يوغا', 'تحديات',
  ],
  gaming: ['gaming', 'games', 'play', 'ألعاب'],
  cooking: ['cooking', 'food', 'kitchen', 'طبخ'],
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
