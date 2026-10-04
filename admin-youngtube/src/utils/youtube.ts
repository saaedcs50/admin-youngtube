/**
 * YouTube URL Parser and Metadata Extractor
 * Supports parsing playlists, channel IDs, channel handles (@handle), custom URLs, and video URLs.
 */

import { resolveChannelFromWorkerApi } from '../services/api';

export interface ParsedYouTubeInfo {
  sourceType: 'channel' | 'playlist';
  sourceId: string;
  title?: string;
  rawInput: string;
  isHandleOrCustom?: boolean;
}

/**
 * Parses raw input (URL or ID) synchronously via regex.
 */
export function parseYouTubeInput(input: string): ParsedYouTubeInfo | null {
  if (!input) return null;
  const raw = input.trim();

  // 1. Direct Playlist ID (e.g. PL..., OLAK..., UU...)
  if (/^PL[a-zA-Z0-9_-]+$/i.test(raw) || /^OLAK[a-zA-Z0-9_-]+$/i.test(raw) || /^UU[a-zA-Z0-9_-]+$/i.test(raw)) {
    return {
      sourceType: 'playlist',
      sourceId: raw,
      rawInput: raw,
    };
  }

  // 2. Direct Channel ID (UC...)
  if (/^UC[a-zA-Z0-9_-]{20,}$/i.test(raw)) {
    return {
      sourceType: 'channel',
      sourceId: raw,
      rawInput: raw,
    };
  }

  // 3. Playlist URL (youtube.com/playlist?list=PL... or &list=PL...)
  const playlistMatch = raw.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
  if (playlistMatch && playlistMatch[1]) {
    const listId = playlistMatch[1];
    // Ignore non-playlist system lists like 'WL' (Watch Later) or 'LL' (Liked)
    if (listId.startsWith('PL') || listId.startsWith('OLAK') || listId.startsWith('UU') || listId.length > 10) {
      return {
        sourceType: 'playlist',
        sourceId: listId,
        rawInput: raw,
      };
    }
  }

  // 4. Channel URL with UC ID (e.g. youtube.com/channel/UC...)
  const channelUcMatch = raw.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/i);
  if (channelUcMatch && channelUcMatch[1]) {
    return {
      sourceType: 'channel',
      sourceId: channelUcMatch[1],
      rawInput: raw,
    };
  }

  // 5. Channel with Handle (e.g. youtube.com/@handle or @handle)
  const handleMatch = raw.match(/(?:youtube\.com\/)?@([a-zA-Z0-9_.-]+)/i);
  if (handleMatch && handleMatch[1]) {
    return {
      sourceType: 'channel',
      sourceId: `@${handleMatch[1]}`,
      isHandleOrCustom: true,
      rawInput: raw,
    };
  }

  // 6. Custom Channel URL (youtube.com/c/name or youtube.com/user/name)
  const customMatch = raw.match(/youtube\.com\/(?:c|user)\/([a-zA-Z0-9_.-]+)/i);
  if (customMatch && customMatch[1]) {
    return {
      sourceType: 'channel',
      sourceId: customMatch[1],
      isHandleOrCustom: true,
      rawInput: raw,
    };
  }

  // 7. Video URL (youtube.com/watch?v=xyz or youtu.be/xyz)
  const videoMatch = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (videoMatch && videoMatch[1]) {
    return {
      sourceType: 'channel',
      sourceId: videoMatch[1],
      isHandleOrCustom: true,
      rawInput: raw,
    };
  }

  return null;
}

/**
 * Resolves full metadata (Channel ID and Title) from a YouTube link, handle, or ID
 * using public oEmbed and lightweight web resolvers.
 */
export async function resolveYouTubeMetadata(input: string): Promise<{
  sourceType: 'channel' | 'playlist';
  sourceId: string;
  title: string;
}> {
  const cleanInput = input.trim();
  if (!cleanInput) {
    return { sourceType: 'channel', sourceId: '', title: '' };
  }

  const parsed = parseYouTubeInput(cleanInput);

  // Extract handle or clean query
  let handleStr = '';
  if (parsed && parsed.isHandleOrCustom) {
    handleStr = parsed.sourceId;
  } else if (cleanInput.includes('@')) {
    const m = cleanInput.match(/@([a-zA-Z0-9_.-]+)/);
    handleStr = m ? `@${m[1]}` : cleanInput;
  } else if (parsed && parsed.sourceType === 'channel' && !parsed.sourceId.startsWith('UC')) {
    handleStr = parsed.sourceId.startsWith('@') ? parsed.sourceId : `@${parsed.sourceId}`;
  }

  // 1. Primary: If it's a handle (@handle or youtube.com/@handle) or text handle, call GET /api/resolve-channel?handle=...
  if (handleStr || (parsed && parsed.isHandleOrCustom)) {
    const query = handleStr || cleanInput;
    const workerRes = await resolveChannelFromWorkerApi(query);
    if (workerRes) {
      const resUcId = String(
        workerRes.sourceId ||
          workerRes.channelId ||
          workerRes.id ||
          workerRes.channel?.id ||
          workerRes.channel?.sourceId ||
          ''
      ).trim();
      const resTitle = String(
        workerRes.title ||
          workerRes.name ||
          workerRes.channelTitle ||
          workerRes.channel?.title ||
          workerRes.channel?.name ||
          ''
      ).trim();

      if (resUcId && /^UC[a-zA-Z0-9_-]{20,}$/i.test(resUcId)) {
        return {
          sourceType: 'channel',
          sourceId: resUcId,
          title: resTitle || resUcId,
        };
      }
    }
  }

  // 2. If already a clean Channel ID (UC...)
  if (parsed && !parsed.isHandleOrCustom && parsed.sourceType === 'channel' && /^UC[a-zA-Z0-9_-]{20,}$/i.test(parsed.sourceId)) {
    let title = '';
    const workerRes = await resolveChannelFromWorkerApi(parsed.sourceId);
    if (workerRes) {
      title = String(workerRes.title || workerRes.name || workerRes.channelTitle || '').trim();
    }
    if (!title) {
      title = (await fetchChannelTitle(parsed.sourceId)) || parsed.sourceId;
    }
    return {
      sourceType: 'channel',
      sourceId: parsed.sourceId,
      title,
    };
  }

  // 3. If already a clean Playlist ID (PL...)
  if (parsed && !parsed.isHandleOrCustom && parsed.sourceType === 'playlist') {
    let title = '';
    const workerRes = await resolveChannelFromWorkerApi(parsed.sourceId);
    if (workerRes) {
      title = String(workerRes.title || workerRes.name || workerRes.channelTitle || '').trim();
    }
    if (!title) {
      title = (await fetchPlaylistTitle(parsed.sourceId)) || `قائمة ${parsed.sourceId}`;
    }
    return {
      sourceType: 'playlist',
      sourceId: parsed.sourceId,
      title,
    };
  }

  // Fallback A: Try noembed / oembed
  let normalizedUrl = cleanInput;
  if (!cleanInput.startsWith('http')) {
    if (cleanInput.startsWith('@')) {
      normalizedUrl = `https://www.youtube.com/${cleanInput}`;
    } else {
      normalizedUrl = `https://www.youtube.com/@${cleanInput}`;
    }
  }

  try {
    const oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(normalizedUrl)}`;
    const res = await fetch(oembedUrl, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      if (data && !data.error) {
        const title = data.title || data.author_name || '';
        const authorUrl = data.author_url || '';

        const ucMatch = authorUrl.match(/\/channel\/(UC[a-zA-Z0-9_-]+)/i);
        if (ucMatch && ucMatch[1]) {
          return {
            sourceType: 'channel',
            sourceId: ucMatch[1],
            title: data.author_name || title || ucMatch[1],
          };
        }
      }
    }
  } catch (e) {
    console.warn('oEmbed lookup failed, trying next resolver...', e);
  }

  // Fallback B: Fetch page HTML via CORS proxy to extract canonical channel ID (UC...)
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(normalizedUrl)}`;
    const pageRes = await fetch(proxyUrl);
    if (pageRes.ok) {
      const html = await pageRes.text();
      const channelIdMatch =
        html.match(/itemprop="channelId"\s+content="(UC[a-zA-Z0-9_-]+)"/i) ||
        html.match(/itemprop="identifier"\s+content="(UC[a-zA-Z0-9_-]+)"/i) ||
        html.match(/canonical"\s+href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)"/i) ||
        html.match(/"externalId":"(UC[a-zA-Z0-9_-]+)"/i) ||
        html.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/i);

      const titleMatch =
        html.match(/<meta property="og:title" content="([^"]+)"/i) ||
        html.match(/<title>([^<]+)<\/title>/i);

      let extractedTitle = '';
      if (titleMatch && titleMatch[1]) {
        extractedTitle = titleMatch[1].replace(' - YouTube', '').trim();
      }

      if (channelIdMatch && channelIdMatch[1]) {
        return {
          sourceType: 'channel',
          sourceId: channelIdMatch[1],
          title: extractedTitle || channelIdMatch[1],
        };
      }
    }
  } catch (e) {
    console.warn('HTML scrape resolver failed:', e);
  }

  // Fallback: If we parsed anything initially
  if (parsed) {
    return {
      sourceType: parsed.sourceType,
      sourceId: parsed.sourceId,
      title: parsed.title || parsed.sourceId,
    };
  }

  // Final fallback
  return {
    sourceType: cleanInput.startsWith('PL') ? 'playlist' : 'channel',
    sourceId: cleanInput,
    title: cleanInput,
  };
}

async function fetchChannelTitle(channelId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/channel/${channelId}`);
    if (res.ok) {
      const data = await res.json();
      return data.title || data.author_name || null;
    }
  } catch {
    // ignore
  }
  return null;
}

async function fetchPlaylistTitle(playlistId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/playlist?list=${playlistId}`);
    if (res.ok) {
      const data = await res.json();
      return data.title || null;
    }
  } catch {
    // ignore
  }
  return null;
}
