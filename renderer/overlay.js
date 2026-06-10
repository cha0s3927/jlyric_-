let songData = null;
let currentIndex = 0;

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

function render() {
  if (!songData) return;

  const current = songData.lyrics[currentIndex];
  const next = songData.lyrics[currentIndex + 1];

  document.getElementById('currentText').textContent = current?.text || '';
  document.getElementById('currentReading').textContent = current?.reading || '';
  document.getElementById('currentTranslation').textContent = current?.translation || '';
  document.getElementById('nextText').textContent = next?.text || '';
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
