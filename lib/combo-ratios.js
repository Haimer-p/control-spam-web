const COMBO_RATIO_KEYS = [
  'like',
  'retweet',
  'reply',
  'follow',
  'like_retweet',
  'like_reply',
  'like_retweet_reply',
  'like_follow',
  'like_retweet_follow',
];

/** Chia đều phần còn lại; like_retweet_reply mặc định 50% */
function buildDefaultComboRatios(likeRetweetReply = 0.5) {
  const primary = Math.min(1, Math.max(0, likeRetweetReply));
  const restKeys = COMBO_RATIO_KEYS.filter((k) => k !== 'like_retweet_reply');
  const each = restKeys.length ? (1 - primary) / restKeys.length : 0;
  const ratios = {};
  for (const key of restKeys) {
    ratios[key] = each;
  }
  ratios.like_retweet_reply = primary;
  return ratios;
}

const DEFAULT_COMBO_RATIOS = buildDefaultComboRatios(0.5);

module.exports = {
  COMBO_RATIO_KEYS,
  buildDefaultComboRatios,
  DEFAULT_COMBO_RATIOS,
};
