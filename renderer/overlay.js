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

// === Native drag via -webkit-app-region ===
// The overlay element has -webkit-app-region: drag set in CSS.
// This lets the OS handle dragging natively — no JS coordinate math needed.
// The close button has -webkit-app-region: no-drag so it remains clickable.
// Mouse events are toggled on hover to allow interaction.

const overlay = document.getElementById('overlay');
const closeBtn = document.getElementById('closeBtn');

// Start as click-through (mouse passes through to windows below)
window.api.overlay.setIgnoreMouse(true);

overlay.addEventListener('mouseenter', () => {
  window.api.overlay.setIgnoreMouse(false);
});

overlay.addEventListener('mouseleave', (e) => {
  if (!closeBtn.contains(e.relatedTarget)) {
    window.api.overlay.setIgnoreMouse(true);
  }
});

closeBtn.addEventListener('mouseleave', () => {
  window.api.overlay.setIgnoreMouse(true);
});
