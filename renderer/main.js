let currentSongId = null;
let currentSongData = null;

// === Song List ===
async function loadSongList() {
  const songs = await window.api.songs.list();
  const container = document.getElementById('songList');
  container.innerHTML = '';

  if (songs.length === 0) {
    container.innerHTML = '<p style="padding:16px;color:#555;font-size:13px;">暂无歌曲</p>';
    return;
  }

  for (const song of songs) {
    const div = document.createElement('div');
    div.className = 'song-item' + (song.id === currentSongId ? ' active' : '');
    div.innerHTML = `
      <div class="title">${escapeHtml(song.title)}</div>
      <div class="artist">${escapeHtml(song.artist || '')}</div>
      <div class="source">${song.source}</div>
    `;
    div.addEventListener('click', () => openSong(song.id));
    container.appendChild(div);
  }
}

async function openSong(songId) {
  currentSongId = songId;
  const song = await window.api.songs.get(songId);
  if (!song) return;

  currentSongData = song;

  // Show editor, hide others
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('lyricEditor').classList.remove('hidden');
  document.getElementById('searchResults').classList.add('hidden');
  document.getElementById('editorTitle').textContent = `${song.title} - ${song.artist || ''}`;

  renderLyricTable(song.lyrics);
  loadSongList();
}

function renderLyricTable(lyrics) {
  const container = document.getElementById('lyricTable');
  container.innerHTML = '';

  // Header row
  const header = document.createElement('div');
  header.className = 'lyric-row';
  header.innerHTML = `
    <span class="line-num">#</span>
    <span class="line-num" style="color:#888">原文</span>
    <span class="line-num" style="color:#888">罗马音</span>
    <span class="line-num" style="color:#888">翻译</span>
  `;
  container.appendChild(header);

  for (const line of lyrics) {
    const row = document.createElement('div');
    row.className = 'lyric-row';
    row.innerHTML = `
      <span class="line-num">${line.line_index + 1}</span>
      <textarea class="text-field" data-field="text" data-index="${line.line_index}">${escapeHtml(line.text)}</textarea>
      <textarea class="reading-field" data-field="reading" data-index="${line.line_index}">${escapeHtml(line.reading)}</textarea>
      <textarea class="translation-field" data-field="translation" data-index="${line.line_index}">${escapeHtml(line.translation)}</textarea>
    `;
    container.appendChild(row);
  }

  // Auto-save on blur
  container.querySelectorAll('textarea').forEach(textarea => {
    textarea.addEventListener('blur', async () => {
      const field = textarea.dataset.field;
      const lineIndex = parseInt(textarea.dataset.index);
      await window.api.songs.updateLyric({
        songId: currentSongId,
        lineIndex,
        field,
        value: textarea.value,
      });
      // Update local data
      const lyric = currentSongData.lyrics.find(l => l.line_index === lineIndex);
      if (lyric) lyric[field] = textarea.value;
    });
  });
}

// === Search ===
document.getElementById('searchBtn').addEventListener('click', doSearch);
document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});

document.getElementById('closeResults').addEventListener('click', () => {
  document.getElementById('searchResults').classList.add('hidden');
});

async function doSearch() {
  const query = document.getElementById('searchInput').value.trim();
  if (!query) return;

  const results = await window.api.songs.search(query);
  const container = document.getElementById('resultList');
  container.innerHTML = '';

  if (results.length === 0) {
    container.innerHTML = '<p style="padding:16px;color:#555;">未找到歌曲</p>';
  } else {
    for (const song of results) {
      const div = document.createElement('div');
      div.className = 'result-item';
      div.innerHTML = `
        <div>
          <div class="title">${escapeHtml(song.name)}</div>
          <div class="artist">${escapeHtml(song.artist)}</div>
        </div>
        <button class="import-btn" data-id="${song.id}">导入</button>
      `;
      const btn = div.querySelector('.import-btn');
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = '导入中...';
        const result = await window.api.songs.importNetease(song.id);
        if (result.success) {
          btn.textContent = '已导入';
          loadSongList();
        } else {
          btn.textContent = '失败';
          btn.disabled = false;
        }
      });
      container.appendChild(div);
    }
  }

  document.getElementById('searchResults').classList.remove('hidden');
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('lyricEditor').classList.add('hidden');
}

// === File Import ===
document.getElementById('importFileBtn').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const content = await file.text();
  const ext = file.name.split('.').pop().toLowerCase();
  let format;
  if (ext === 'lrc') format = 'lrc';
  else if (ext === 'json') format = 'json';
  else if (ext === 'yaml' || ext === 'yml') format = 'yaml';
  else return;

  const result = await window.api.songs.importFile({
    content,
    format,
    title: file.name.replace(/\.[^.]+$/, ''),
  });

  if (result.success) {
    loadSongList();
  } else {
    alert('导入失败: ' + (result.error || '未知错误'));
  }

  e.target.value = '';
});

// === Editor Actions ===
document.getElementById('showOverlayBtn').addEventListener('click', async () => {
  if (currentSongId) {
    await window.api.overlay.show(currentSongId);
  }
});

document.getElementById('exportJSONBtn').addEventListener('click', async () => {
  if (!currentSongId) return;
  const data = await window.api.songs.exportJSON(currentSongId);
  if (!data) return;

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.title}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('deleteSongBtn').addEventListener('click', async () => {
  if (!currentSongId) return;
  if (!confirm('确定删除这首歌吗？')) return;

  await window.api.songs.delete(currentSongId);
  currentSongId = null;
  currentSongData = null;
  document.getElementById('lyricEditor').classList.add('hidden');
  document.getElementById('emptyState').classList.remove('hidden');
  loadSongList();
});

// === Utility ===
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// === Settings ===
let pendingSettings = null;

document.getElementById('settingsBtn').addEventListener('click', async () => {
  const settings = await window.api.settings.get();
  pendingSettings = settings;
  populateSettingsUI(settings);
  document.getElementById('settingsModal').classList.remove('hidden');
});

document.getElementById('closeSettings').addEventListener('click', () => {
  document.getElementById('settingsModal').classList.add('hidden');
});

document.getElementById('resetSettingsBtn').addEventListener('click', async () => {
  pendingSettings = await window.api.settings.reset();
  populateSettingsUI(pendingSettings);
});

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  // Save all pending changes
  await window.api.settings.update('fonts.textSize', pendingSettings.fonts.textSize);
  await window.api.settings.update('fonts.readingSize', pendingSettings.fonts.readingSize);
  await window.api.settings.update('fonts.translationSize', pendingSettings.fonts.translationSize);
  await window.api.settings.update('shortcuts.next', pendingSettings.shortcuts.next);
  await window.api.settings.update('shortcuts.prev', pendingSettings.shortcuts.prev);
  await window.api.settings.update('shortcuts.close', pendingSettings.shortcuts.close);
  await window.api.settings.update('analysis.showAnalysis', pendingSettings.analysis?.showAnalysis ?? false);
  document.getElementById('settingsModal').classList.add('hidden');
});

function populateSettingsUI(settings) {
  // Font sliders
  document.getElementById('textSizeSlider').value = settings.fonts.textSize;
  document.getElementById('textSizeValue').textContent = settings.fonts.textSize + 'px';
  document.getElementById('readingSizeSlider').value = settings.fonts.readingSize;
  document.getElementById('readingSizeValue').textContent = settings.fonts.readingSize + 'px';
  document.getElementById('translationSizeSlider').value = settings.fonts.translationSize;
  document.getElementById('translationSizeValue').textContent = settings.fonts.translationSize + 'px';

  // Shortcut inputs
  document.getElementById('shortcutNext').value = settings.shortcuts.next;
  document.getElementById('shortcutPrev').value = settings.shortcuts.prev;
  document.getElementById('shortcutClose').value = settings.shortcuts.close;

  // Analysis toggle
  document.getElementById('showAnalysisToggle').checked = settings.analysis?.showAnalysis ?? false;
}

// Font slider live update
['textSize', 'readingSize', 'translationSize'].forEach(key => {
  const sliderId = key === 'textSize' ? 'textSizeSlider' : key === 'readingSize' ? 'readingSizeSlider' : 'translationSizeSlider';
  const valueId = key === 'textSize' ? 'textSizeValue' : key === 'readingSize' ? 'readingSizeValue' : 'translationSizeValue';
  const settingsKey = key;

  document.getElementById(sliderId).addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById(valueId).textContent = val + 'px';
    pendingSettings.fonts[settingsKey] = val;
  });
});

// Analysis toggle
document.getElementById('showAnalysisToggle').addEventListener('change', (e) => {
  if (!pendingSettings.analysis) pendingSettings.analysis = {};
  pendingSettings.analysis.showAnalysis = e.target.checked;
});

// Shortcut recording
function setupShortcutInput(inputId, shortcutKey) {
  const input = document.getElementById(inputId);
  let recording = false;

  input.addEventListener('click', () => {
    if (!recording) {
      recording = true;
      input.value = '按下快捷键...';
      input.style.borderColor = '#e94560';
    }
  });

  input.addEventListener('keydown', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const parts = [];
    if (e.ctrlKey) parts.push('CommandOrControl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    if (e.metaKey) parts.push('Meta');

    let key = e.key;
    // Normalize key names
    if (key === 'Control' || key === 'Meta' || key === 'Alt' || key === 'Shift') return;
    if (key === ' ') key = 'Space';
    if (key.length === 1) key = key.toUpperCase();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      key = key.replace('Arrow', '');
    }

    if (parts.length === 0) {
      // Single key not allowed for navigation shortcuts
      input.value = '需要修饰键 (Ctrl/Alt/Shift)';
      setTimeout(() => { input.value = pendingSettings.shortcuts[shortcutKey]; }, 1000);
      return;
    }

    parts.push(key);
    const shortcut = parts.join('+');
    pendingSettings.shortcuts[shortcutKey] = shortcut;
    input.value = shortcut;
    recording = false;
    input.style.borderColor = '';
  });

  input.addEventListener('blur', () => {
    if (recording) {
      recording = false;
      input.value = pendingSettings.shortcuts[shortcutKey];
      input.style.borderColor = '';
    }
  });
}

setupShortcutInput('shortcutNext', 'next');
setupShortcutInput('shortcutPrev', 'prev');
setupShortcutInput('shortcutClose', 'close');

// Close modal on backdrop click
document.getElementById('settingsModal').addEventListener('click', (e) => {
  if (e.target.id === 'settingsModal') {
    document.getElementById('settingsModal').classList.add('hidden');
  }
});

// === Init ===
loadSongList();
