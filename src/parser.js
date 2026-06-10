/**
 * Parse LRC format: [mm:ss.xx]歌词内容
 * Returns: { title, artist, lyrics: [{ text, timestamp }] }
 */
function parseLRC(content, title) {
  const lines = content.split('\n');
  const lyrics = [];

  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const millis = parseInt(match[3].padEnd(3, '0'));
      const timestamp = minutes * 60000 + seconds * 1000 + millis;
      const text = match[4].trim();
      if (text) {
        lyrics.push({ text, reading: '', translation: '', timestamp });
      }
    }
  }

  return { title: title || '未知歌曲', artist: '', lyrics };
}

/**
 * Parse JSON format
 * Expected: { title, artist, lyrics: [{ text, reading, translation }] }
 */
function parseJSON(content) {
  try {
    const data = JSON.parse(content);
    if (!data.title || !Array.isArray(data.lyrics)) {
      return null;
    }
    return {
      title: data.title,
      artist: data.artist || '',
      lyrics: data.lyrics.map((line, i) => ({
        text: line.text || '',
        reading: line.reading || '',
        translation: line.translation || '',
        timestamp: line.timestamp || null,
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Parse YAML format (simple parser without external dependency)
 * Expected format:
 * title: 歌曲名
 * artist: 歌手
 * lyrics:
 *   - text: 原文
 *     reading: 罗马音
 *     translation: 翻译
 */
function parseYAML(content) {
  try {
    const lines = content.split('\n');
    const result = { title: '', artist: '', lyrics: [] };
    let currentLyric = null;
    let inLyrics = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('title:')) {
        result.title = trimmed.replace('title:', '').trim().replace(/^["']|["']$/g, '');
        inLyrics = false;
      } else if (trimmed.startsWith('artist:')) {
        result.artist = trimmed.replace('artist:', '').trim().replace(/^["']|["']$/g, '');
        inLyrics = false;
      } else if (trimmed === 'lyrics:') {
        inLyrics = true;
      } else if (inLyrics && trimmed.startsWith('- text:')) {
        currentLyric = {
          text: trimmed.replace('- text:', '').trim().replace(/^["']|["']$/g, ''),
          reading: '',
          translation: '',
        };
        result.lyrics.push(currentLyric);
      } else if (inLyrics && currentLyric && trimmed.startsWith('reading:')) {
        currentLyric.reading = trimmed.replace('reading:', '').trim().replace(/^["']|["']$/g, '');
      } else if (inLyrics && currentLyric && trimmed.startsWith('translation:')) {
        currentLyric.translation = trimmed.replace('translation:', '').trim().replace(/^["']|["']$/g, '');
      }
    }

    if (result.lyrics.length === 0) return null;
    return result;
  } catch {
    return null;
  }
}

/**
 * Align three LRC sources (original, translation, romaji) by timestamp
 * Tolerance: ±500ms
 */
function alignLyrics(originalLRC, translationLRC, romajiLRC) {
  const original = parseLRCToTimestamp(originalLRC);
  const translations = parseLRCToTimestamp(translationLRC);
  const romaji = parseLRCToTimestamp(romajiLRC);

  const lyrics = [];
  for (const orig of original) {
    const matchingTranslation = findByTimestamp(translations, orig.timestamp, 500);
    const matchingRomaji = findByTimestamp(romaji, orig.timestamp, 500);

    lyrics.push({
      text: orig.text,
      reading: matchingRomaji ? matchingRomaji.text : '',
      translation: matchingTranslation ? matchingTranslation.text : '',
      timestamp: orig.timestamp,
    });
  }

  return lyrics;
}

function parseLRCToTimestamp(content) {
  if (!content) return [];
  const lines = content.split('\n');
  const result = [];
  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const millis = parseInt(match[3].padEnd(3, '0'));
      const timestamp = minutes * 60000 + seconds * 1000 + millis;
      const text = match[4].trim();
      if (text) {
        result.push({ text, timestamp });
      }
    }
  }
  return result;
}

function findByTimestamp(arr, timestamp, tolerance) {
  return arr.find(item => Math.abs(item.timestamp - timestamp) <= tolerance) || null;
}

module.exports = { parseLRC, parseJSON, parseYAML, alignLyrics };
