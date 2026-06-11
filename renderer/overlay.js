let songData = null;
let currentIndex = 0;
let analysisCache = new Map(); // key: "songId:lineIndex" -> results[]

// Apply settings (fonts)
function applySettings(settings) {
  if (!settings) return;
  const root = document.documentElement;
  root.style.setProperty('--text-size', settings.fonts.textSize + 'px');
  root.style.setProperty('--reading-size', settings.fonts.readingSize + 'px');
  root.style.setProperty('--translation-size', settings.fonts.translationSize + 'px');
}

// Listen for settings
window.api.overlay.onSettings((settings) => {
  applySettings(settings);
});

// Listen for song load
window.api.overlay.onLoadSong((data) => {
  if (!data || !data.lyrics || data.lyrics.length === 0) return;
  songData = data;
  currentIndex = 0;
  analysisCache.clear();
  render();
});

// Listen for navigation
window.api.overlay.onNavigate(({ direction }) => {
  if (!songData) return;
  if (direction === 'down') {
    currentIndex = Math.min(currentIndex + 1, songData.lyrics.length - 1);
  } else if (direction === 'up') {
    currentIndex = Math.max(currentIndex - 1, 0);
  }
  render();
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function renderAnalysis() {
  const container = document.getElementById('currentAnalysis');
  if (!songData) {
    container.className = 'word-cards hidden';
    container.innerHTML = '';
    return;
  }

  const settings = await window.api.settings.get();
  if (!settings.analysis?.showAnalysis) {
    container.className = 'word-cards hidden';
    container.innerHTML = '';
    return;
  }

  const current = songData.lyrics[currentIndex];
  if (!current || !current.text?.trim()) {
    container.className = 'word-cards hidden';
    container.innerHTML = '';
    return;
  }

  const cacheKey = `${songData.id}:${currentIndex}`;
  let analysis = analysisCache.get(cacheKey);

  if (!analysis) {
    container.className = 'word-cards loading';
    container.innerHTML = '';

    try {
      const result = await window.api.lyric.analyze(
        songData.id, currentIndex, current.text
      );
      if (result.error) throw new Error(result.error);
      analysis = result.results;
      analysisCache.set(cacheKey, analysis);
    } catch (err) {
      container.className = 'word-cards hidden';
      console.warn('Analysis failed:', err.message);
      return;
    }
  }

  container.className = 'word-cards';
  container.innerHTML = '';

  for (const word of analysis) {
    const card = document.createElement('span');
    card.className = 'word-card';
    card.innerHTML =
      `<span class="card-surface">${escapeHtml(word.surface)}</span>` +
      (word.reading ? `<span class="card-reading">${escapeHtml(word.reading)}</span>` : '') +
      (word.pos ? `<span class="card-pos">${escapeHtml(word.pos)}</span>` : '') +
      `<span class="card-definition">${word.definition ? escapeHtml(word.definition) : ''}</span>` +
      (word.baseForm ? `<span class="card-base-form">[${escapeHtml(word.baseForm)}]</span>` : '');
    container.appendChild(card);
  }
}

async function render() {
  if (!songData) return;

  const current = songData.lyrics[currentIndex];
  const next = songData.lyrics[currentIndex + 1];

  document.getElementById('currentText').textContent = current?.text || '';
  document.getElementById('currentReading').textContent = current?.reading || '';
  document.getElementById('currentTranslation').textContent = current?.translation || '';
  document.getElementById('nextText').textContent = next?.text || '';

  await renderAnalysis();

  // Auto-resize overlay height to fit content
  requestAnimationFrame(() => {
    const el = document.getElementById('overlay');
    if (el) {
      window.api.overlay.resizeHeight(el.scrollHeight + 8);
    }
  });
}

// === Close button ===
document.getElementById('closeBtn').addEventListener('click', () => {
  window.api.overlay.close();
});

// === Mouse pass-through toggle ===
const overlay = document.getElementById('overlay');
const closeBtn = document.getElementById('closeBtn');

// Overlay is always interactive so -webkit-app-region: drag works immediately
window.api.overlay.setIgnoreMouse(false);

// Listen for click-through state changes (Ctrl+Shift+T shortcut)
window.api.overlay.onIgnoreState((ignored) => {
  overlay.classList.toggle('click-through', ignored);
});
