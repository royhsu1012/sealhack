// SealHack 海豹吉祥物:純 CSS 畫的像素海豹(依使用者提供的參考圖 1:1 還原,只有海豹本體)。
// 每一層是一個空的 <i>,圖案在 src/styles/seal.css(scripts/seal-css.mjs 產生);像素大小由 CSS 的 --p 控制。
// variant:wave(開場)、hoard 囤糧、diligent 勤勞、sprint 衝刺、slow 慢活、chill 悠哉、adventure 冒險

/** 回傳一隻海豹的 HTML(title 給螢幕閱讀器);睜眼的海豹會眨眼、身體會上下跳一格(reduced motion 時不動) */
export function seal(variant = 'wave', title = 'SealHack 海豹') {
  const happy = variant === 'slow';
  const blink = !happy && variant !== 'chill';
  const acc = variant === 'wave' ? '' : `<i class="px-l px-acc-${variant}"></i>`;
  return `<div class="px-seal" role="img" aria-label="${title}"><div class="px-hop">`
    + '<i class="px-l px-body"></i>'
    + `<i class="px-l ${happy ? 'px-happy' : 'px-eyes'}"></i>`
    + (blink ? '<i class="px-l px-shut"></i>' : '')
    + `${acc}</div></div>`;
}

/** 退休人格:存錢力 × 投資風格 → 哪一種海豹 */
export const PERSONAS = {
  'saver-safe': { variant: 'hoard', name: '囤糧海豹', tag: '存得多、放得穩,景氣再冷也有存糧。', tint: 'var(--pastel-lemon)' },
  'saver-steady': { variant: 'diligent', name: '勤勞海豹', tag: '規律存、穩穩投,一步一步把魚缸裝滿。', tint: 'var(--pastel-mint)' },
  'saver-bold': { variant: 'sprint', name: '衝刺海豹', tag: '存得兇也敢衝,目標是提早下班。', tint: 'var(--pastel-peach)' },
  'spender-safe': { variant: 'slow', name: '慢活海豹', tag: '照自己的步調走,穩穩的最安心。', tint: 'var(--pastel-lilac)' },
  'spender-steady': { variant: 'chill', name: '悠哉海豹', tag: '現在的生活要顧,未來也想顧到。', tint: 'var(--pastel-sky)' },
  'spender-bold': { variant: 'adventure', name: '冒險海豹', tag: '存得不算多,靠投資拚一把。', tint: 'var(--pastel-pink)' },
};
