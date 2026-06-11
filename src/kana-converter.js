// Katakana to Hiragana conversion via Unicode offset (U+30A1 → U+3041, offset 0x60)
const KATAKANA_TO_HIRAGANA = {};
for (let code = 0x30A1; code <= 0x30F6; code++) {
  KATAKANA_TO_HIRAGANA[String.fromCharCode(code)] = String.fromCharCode(code - 0x60);
}

// Also handle prolonged sound mark ー → remove it (contextual, no direct hiragana equivalent)
KATAKANA_TO_HIRAGANA['ー'] = '';

function katakanaToHiragana(text) {
  if (!text) return '';
  return text.replace(/[ァ-ヶー]/g, (match) =>
    KATAKANA_TO_HIRAGANA[match] || match
  );
}

module.exports = { katakanaToHiragana };
