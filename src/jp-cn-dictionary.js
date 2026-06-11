const path = require('path');
const fs = require('fs');

let dictionary = null;

function loadDictionary(dictPath) {
  if (dictionary) return;
  const data = fs.readFileSync(dictPath, 'utf-8');
  dictionary = JSON.parse(data);
}

function lookupDefinition(word) {
  if (!dictionary) return '';
  const defs = dictionary[word];
  if (!defs) return '';
  return Array.isArray(defs) ? defs.join('，') : String(defs);
}

function isLoaded() {
  return !!dictionary;
}

module.exports = { loadDictionary, lookupDefinition, isLoaded };
