const initSqlJs = require('sql.js');
const fs = require('fs');

let db;

async function initDB(dbPath) {
  const SQL = await initSqlJs({ locateFile: (f) => require.resolve('sql.js/dist/' + f) });

  let fileBuffer = null;
  if (fs.existsSync(dbPath)) {
    fileBuffer = fs.readFileSync(dbPath);
  }

  if (fileBuffer) {
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT,
    netease_id TEXT,
    cover_url TEXT,
    source TEXT DEFAULT 'manual',
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS lyrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id INTEGER NOT NULL,
    line_index INTEGER NOT NULL,
    text TEXT DEFAULT '',
    reading TEXT DEFAULT '',
    translation TEXT DEFAULT '',
    timestamp INTEGER,
    FOREIGN KEY(song_id) REFERENCES songs(id) ON DELETE CASCADE,
    UNIQUE(song_id, line_index)
  )`);

  saveDB(dbPath);
  return { getAllSongs, getSongWithLyrics, deleteSong, importSong, updateLyricLine, exportSongAsJSON, close };
}

function saveDB(dbPath) {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function getAllSongs() {
  const stmt = db.prepare('SELECT id, title, artist, source, created_at FROM songs ORDER BY updated_at DESC');
  const songs = [];
  while (stmt.step()) {
    songs.push(stmt.getAsObject());
  }
  stmt.free();
  return songs;
}

function getSongWithLyrics(songId) {
  const songStmt = db.prepare('SELECT * FROM songs WHERE id = ?');
  songStmt.bind([songId]);
  let song = null;
  if (songStmt.step()) {
    song = songStmt.getAsObject();
  }
  songStmt.free();
  if (!song) return null;

  const lyricStmt = db.prepare('SELECT line_index, text, reading, translation, timestamp FROM lyrics WHERE song_id = ? ORDER BY line_index');
  lyricStmt.bind([songId]);
  const lyrics = [];
  while (lyricStmt.step()) {
    lyrics.push(lyricStmt.getAsObject());
  }
  lyricStmt.free();

  song.lyrics = lyrics;
  return song;
}

function deleteSong(songId) {
  db.run('DELETE FROM lyrics WHERE song_id = ?', [songId]);
  db.run('DELETE FROM songs WHERE id = ?', [songId]);
  return { success: true };
}

function importSong(lyricData, source) {
  const { title, artist, neteaseId, lyrics } = lyricData;

  db.run('INSERT INTO songs (title, artist, netease_id, source) VALUES (?, ?, ?, ?)',
    [title, artist || '', neteaseId || '', source || 'manual']);

  const songId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

  const stmt = db.prepare('INSERT INTO lyrics (song_id, line_index, text, reading, translation, timestamp) VALUES (?, ?, ?, ?, ?, ?)');
  for (let i = 0; i < lyrics.length; i++) {
    const line = lyrics[i];
    stmt.run([songId, i, line.text || '', line.reading || '', line.translation || '', line.timestamp || null]);
  }
  stmt.free();

  return { success: true, songId };
}

function updateLyricLine(songId, lineIndex, field, value) {
  db.run(`UPDATE lyrics SET ${field} = ? WHERE song_id = ? AND line_index = ?`,
    [value, songId, lineIndex]);
  return { success: true };
}

function exportSongAsJSON(songId) {
  const song = getSongWithLyrics(songId);
  if (!song) return null;
  return {
    title: song.title,
    artist: song.artist,
    lyrics: song.lyrics.map(l => ({
      text: l.text,
      reading: l.reading,
      translation: l.translation,
    })),
  };
}

function close() {
  // sql.js doesn't have a close method, just save
}

module.exports = initDB;
