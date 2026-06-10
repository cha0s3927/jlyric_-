/**
 * NetEase Cloud Music API wrapper
 * Uses Node.js native fetch (Node 18+)
 */

const BASE_URL = 'https://music.163.com/api';

async function searchSongs(query) {
  try {
    const url = `${BASE_URL}/search/get?s=${encodeURIComponent(query)}&type=1&limit=20&offset=0`;
    const res = await fetch(url, {
      headers: {
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const data = await res.json();
    if (data.result && data.result.songs) {
      return data.result.songs.map(song => ({
        id: song.id,
        name: song.name,
        artist: (song.artists || []).map(a => a.name).join(', '),
      }));
    }
    return [];
  } catch (err) {
    console.error('Search error:', err.message);
    return [];
  }
}

async function fetchLyrics(songId) {
  try {
    const url = `${BASE_URL}/song/lyric?id=${songId}&os=pc&lv=-1&tv=-1&rv=-1`;
    const res = await fetch(url, {
      headers: {
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const data = await res.json();
    return {
      original: data.lrc?.lyric || '',
      translation: data.tlyric?.lyric || '',
      romaji: data.romalrc?.lyric || '',
    };
  } catch (err) {
    console.error('Fetch lyrics error:', err.message);
    return null;
  }
}

async function fetchAndParseLyrics(songId) {
  const { alignLyrics } = require('./parser');

  const lyricData = await fetchLyrics(songId);
  if (!lyricData || !lyricData.original) return null;

  // Get song info for title/artist
  const songInfo = await getSongInfo(songId);

  const lyrics = alignLyrics(lyricData.original, lyricData.translation, lyricData.romaji);

  return {
    title: songInfo?.name || '未知歌曲',
    artist: songInfo?.artist || '',
    neteaseId: String(songId),
    lyrics,
  };
}

async function getSongInfo(songId) {
  try {
    const url = `${BASE_URL}/song/detail/?ids=[${songId}]`;
    const res = await fetch(url, {
      headers: {
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    const data = await res.json();
    if (data.songs && data.songs.length > 0) {
      const song = data.songs[0];
      return {
        name: song.name,
        artist: (song.artists || []).map(a => a.name).join(', '),
      };
    }
    return null;
  } catch {
    return null;
  }
}

module.exports = { searchSongs, fetchLyrics, fetchAndParseLyrics };
