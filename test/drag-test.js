/**
 * Drag test for overlay window
 *
 * Verifies:
 * 1. Native -webkit-app-region: drag is set in CSS (OS handles drag, no jitter)
 * 2. Position save on 'move' event in main.js (debounced)
 * 3. setPosition uses setPosition() not setBounds() (no width change)
 *
 * Run: node test/drag-test.js
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
    passed++;
  } else {
    console.log(`  FAIL: ${msg}`);
    failed++;
  }
}

console.log('=== Overlay Drag Tests ===\n');

// --- Test 1: CSS has -webkit-app-region: drag ---
const css = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'overlay.css'), 'utf-8');

console.log('Test 1: CSS -webkit-app-region setup');
assert(
  css.includes('-webkit-app-region: drag'),
  '.overlay has -webkit-app-region: drag (native OS drag)'
);
assert(
  css.includes('-webkit-app-region: no-drag'),
  '.close-btn has -webkit-app-region: no-drag (remains clickable)'
);
assert(
  !css.includes('cursor: grab'),
  'no JS-drag cursor styles (drag is handled by OS)'
);

// --- Test 2: overlay.js does NOT have JS drag logic ---
const overlayJs = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'overlay.js'), 'utf-8');

console.log('\nTest 2: overlay.js - no JS drag logic');
assert(
  !overlayJs.includes('e.clientX') && !overlayJs.includes('e.clientY'),
  'no clientX/Y coordinate tracking'
);
assert(
  !overlayJs.includes('e.screenX') && !overlayJs.includes('e.screenY'),
  'no screenX/Y coordinate tracking (OS handles drag)'
);
assert(
  !overlayJs.includes('isDragging'),
  'no isDragging state (OS handles drag)'
);
assert(
  !overlayJs.includes('setPosition('),
  'no setPosition calls in renderer (main.js saves position via move event)'
);
assert(
  !overlayJs.includes('mouseenter'),
  'no mouseenter handler (overlay always interactive)'
);
assert(
  overlayJs.includes('setIgnoreMouse(false)'),
  'overlay always interactive (setIgnoreMouse(false) at init)'
);

// --- Test 3: main.js has move event listener with debounce ---
const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf-8');

console.log('\nTest 3: main.js - position persistence');
assert(
  mainJs.includes("overlayWindow.on('move'") || mainJs.includes('overlayWindow.on("move"'),
  'move event listener registered on overlayWindow'
);
assert(
  mainJs.includes('setTimeout'),
  'debounced save (prevents excessive disk writes during drag)'
);
assert(
  mainJs.includes('clearTimeout'),
  'debounce timer cleared on each move event'
);

// --- Test 4: set-position handler uses setPosition (not setBounds) ---
console.log('\nTest 4: main.js - set-position handler');
assert(
  mainJs.includes("'overlay:set-position'"),
  'overlay:set-position handler exists'
);
assert(
  mainJs.includes('setPosition('),
  'handler uses setPosition (position-only, no size change)'
);
const handlerSection = mainJs.substring(
  mainJs.indexOf("'overlay:set-position'"),
  mainJs.indexOf("'overlay:state'")
);
assert(
  !handlerSection.includes('setBounds'),
  'handler does NOT use setBounds (would cause width change)'
);
assert(
  !handlerSection.includes('getSize'),
  'handler does NOT call getSize (was causing size drift)'
);
assert(
  handlerSection.includes('Math.round'),
  'handler uses Math.round (prevents sub-pixel drift)'
);

// --- Test 5: Toggle shortcut setup ---
console.log('\nTest 5: main.js - click-through toggle shortcut');
assert(
  mainJs.includes('registerOverlayShortcuts'),
  'registerOverlayShortcuts function exists'
);
assert(
  mainJs.includes('CommandOrControl+Shift+T'),
  'Ctrl+Shift+T registered as toggle shortcut'
);
assert(
  mainJs.includes('overlayIgnoreState'),
  'tracks overlay ignore state'
);
assert(
  mainJs.includes("'overlay:ignore-state'"),
  'sends ignore-state IPC message to renderer'
);
assert(
  mainJs.includes('unregisterOverlayShortcuts'),
  'unregisters overlay shortcuts on close'
);

// --- Test 6: Renderer listens for ignore state ---
const preloadJs = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf-8');
console.log('\nTest 6: preload.js - onIgnoreState bridge');
assert(
  preloadJs.includes('onIgnoreState'),
  'preload exposes onIgnoreState callback'
);
assert(
  overlayJs.includes('onIgnoreState'),
  'overlay.js listens for ignore-state changes'
);

// --- Test 7: CSS visual indicator ---
console.log('\nTest 7: CSS - click-through visual indicator');
assert(
  css.includes('.status-indicator'),
  'status indicator element styled'
);
assert(
  css.includes('.click-through'),
  'click-through mode has visual styling'
);
assert(
  css.includes('.click-through .status-indicator'),
  'status indicator visible in click-through mode'
);

// --- Summary ---
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
