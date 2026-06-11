// IPADIC Japanese POS → Chinese POS mapping
const POS_MAP = {
  '名詞': '名词',
  '動詞': '动词',
  '形容詞': '形容词',
  '形容動詞': '形容动词',
  '副詞': '副词',
  '連体詞': '连体词',
  '接続詞': '接续词',
  '感動詞': '感叹词',
  '助詞': '助词',
  '助動詞': '助动词',
  '接頭詞': '接头词',
  '接尾詞': '接尾词',
  '記号': '符号',
  'フィラー': '填充词',
  '非言語音': '非语言音',
};

const POS_SUB_MAP = {
  '格助詞': '格助词',
  '係助詞': '系助词',
  '終助詞': '终助词',
  '副助詞': '副助词',
  '副助詞／連語': '副助词',
  '並立助詞': '并列助词',
  '連語': '连语',
  '自立': '',
  '非自立': '',
  '一般': '',
  '代名詞': '代名词',
  '固有名詞': '固有名词',
  '数': '数词',
  'サ変接続': 'サ变动词连接',
  'ナイ形容詞': 'ナイ形容词',
  'タ依存': 'タ依存',
  '特殊': '特殊',
};

function mapPOS(pos, subPOS) {
  const main = POS_MAP[pos] || pos;
  if (subPOS && POS_SUB_MAP[subPOS]) {
    const sub = POS_SUB_MAP[subPOS];
    return sub ? `${main}-${sub}` : main;
  }
  return main;
}

module.exports = { mapPOS };
