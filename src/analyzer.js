const path = require('path');
const { katakanaToHiragana } = require('./kana-converter');
const { mapPOS } = require('./pos-mapping');
const { loadDictionary, lookupDefinition } = require('./jp-cn-dictionary');

let tokenizer = null;

async function ensureTokenizer() {
  if (tokenizer) return tokenizer;

  const kuromoji = require('kuromoji');
  const dictPath = path.join(path.dirname(require.resolve('kuromoji')), '..', 'dict');

  tokenizer = await new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: dictPath }).build((err, t) => {
      if (err) reject(err);
      else resolve(t);
    });
  });

  return tokenizer;
}

async function analyzeLine(text) {
  if (!text || !text.trim()) return [];

  const t = await ensureTokenizer();
  const tokens = t.tokenize(text).filter(tok => tok.pos !== '記号');

  // Merge verb stem + て/で (conjunctive particle) into one token
  const merged = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.surface_form === 'て' && tok.pos === '助詞' && merged.length > 0) {
      const prev = merged[merged.length - 1];
      if (prev._raw.pos === '動詞') {
        // Merge: combine surface forms
        merged[merged.length - 1] = {
          ...prev,
          surface: prev.surface + 'て',
          reading: prev.reading + 'て',
          definition: lookupDefinition(prev._raw.basic_form) || lookupDefinition(prev._raw.surface_form),
        };
        continue;
      }
    }
    if (tok.surface_form === 'で' && tok.pos === '助詞' && merged.length > 0) {
      const prev = merged[merged.length - 1];
      if (prev._raw.pos === '動詞') {
        merged[merged.length - 1] = {
          ...prev,
          surface: prev.surface + 'で',
          reading: prev.reading + 'で',
          definition: lookupDefinition(prev._raw.basic_form) || lookupDefinition(prev._raw.surface_form),
        };
        continue;
      }
    }
    merged.push(buildWord(tok));
  }

  // Clean up internal _raw field
  return merged.map(w => {
    const { _raw, ...rest } = w;
    return rest;
  });
}

function buildWord(tok) {
  const surface = tok.surface_form;
  const reading = katakanaToHiragana(tok.reading || '');
  const pos = mapPOS(tok.pos, tok.pos_detail_1);
  const rawBase = tok.basic_form;
  const baseForm = (rawBase && rawBase !== '*') ? rawBase : surface;
  const definition = lookupDefinition(baseForm) || lookupDefinition(surface);

  return {
    surface,
    reading,
    pos,
    baseForm: baseForm !== surface ? baseForm : '',
    definition,
    _raw: tok, // kept internally for merging
  };
}

function isReady() {
  return !!tokenizer;
}

module.exports = { analyzeLine, isReady, ensureTokenizer };
