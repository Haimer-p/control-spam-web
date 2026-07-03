const CORE_GENERIC = [
  'web3',
  'blockchain',
  'crypto',
  'solana',
  'solana meme',
  'pump fun',
  'memecoin',
  'dexscreener',
  'trending',
  'gem',
  'alpha',
  'CT',
  'send it',
  'fresh launch',
  'still early',
];

function buildCoreKeywords(meta) {
  const sym = meta.symbol || '';
  const slug = sym.toLowerCase();
  const name = meta.name || sym;
  const pair = (meta.pairAddress || '').toLowerCase();
  const mint = meta.mintAddress || '';

  return [
    sym,
    `$${sym}`,
    name,
    name.toLowerCase(),
    `${sym} solana`,
    `${sym} pump fun`,
    `${sym} dexscreener`,
    `${sym} trending`,
    `${sym} chart`,
    `${sym} gem`,
    `${sym} moon`,
    `${sym} raid`,
    `${sym} alpha`,
    `buy ${sym}`,
    `${sym} community`,
    `${sym} memecoin`,
    `${sym} send it`,
    `${sym} pumpswap`,
    `${sym} fresh launch`,
    `${sym} still early`,
    pair,
    mint,
    meta.dexUrl,
    meta.website,
    meta.twitter ? meta.twitter.replace(/.*\//, '') : null,
    slug,
    `${slug} meme`,
    `${slug} solana`,
    `${slug} token`,
    ...CORE_GENERIC,
  ].filter(Boolean);
}

function distributeKeywords(allKeywords, accountNames, minPerAccount = 20) {
  const unique = [...new Set(allKeywords.map((k) => String(k).trim()).filter(Boolean))];
  const names = accountNames.filter(Boolean);
  if (!names.length) return {};

  const map = {};
  if (!unique.length) {
    names.forEach((name) => {
      map[name] = [];
    });
    return map;
  }

  // Mỗi account nhận tối thiểu minPerAccount keyword. Nếu pool đủ lớn thì chia đều,
  // nếu không thì dùng cửa sổ xoay vòng (wrap) — cho phép trùng giữa các account.
  const perAccount = Math.min(
    unique.length,
    Math.max(minPerAccount, Math.ceil(unique.length / names.length))
  );

  names.forEach((name, i) => {
    const offset = (i * perAccount) % unique.length;
    const slice = [];
    for (let j = 0; j < perAccount; j++) {
      slice.push(unique[(offset + j) % unique.length]);
    }
    map[name] = [...new Set(slice)];
  });
  return map;
}

function parseKeywordLines(text) {
  return String(text || '')
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  CORE_GENERIC,
  buildCoreKeywords,
  distributeKeywords,
  parseKeywordLines,
};
