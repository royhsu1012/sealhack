// SealHack 海豹吉祥物(純 SVG 字串,頁面與結果共用;顏色只用 global.css 的 token)
// variant:wave(揮手)、hoard 囤糧、diligent 勤勞、sprint 衝刺、slow 慢活、chill 悠哉、adventure 冒險

const EYES_OPEN = `
  <circle cx="66" cy="58" r="6.5" fill="var(--seal-eye)"/><circle cx="94" cy="58" r="6.5" fill="var(--seal-eye)"/>
  <circle cx="68.5" cy="55.5" r="2.2" fill="var(--seal-shine)"/><circle cx="96.5" cy="55.5" r="2.2" fill="var(--seal-shine)"/>`;
const EYES_HAPPY = `
  <path d="M59 59 Q66 51 73 59" fill="none" stroke="var(--seal-eye)" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M87 59 Q94 51 101 59" fill="none" stroke="var(--seal-eye)" stroke-width="3.2" stroke-linecap="round"/>`;

const ACCESSORY = {
  wave: '',
  hoard: `
    <g stroke="var(--seal-eye)" stroke-width="1.2">
      <ellipse cx="136" cy="121" rx="13" ry="4.5" fill="var(--gold)"/>
      <ellipse cx="136" cy="114" rx="13" ry="4.5" fill="var(--gold)"/>
      <ellipse cx="136" cy="107" rx="13" ry="4.5" fill="var(--gold)"/>
    </g>
    <path d="M24 112 q-6 -14 4 -18 q10 4 4 18 z" fill="var(--seal-acorn)" stroke="var(--seal-eye)" stroke-width="1.2"/>
    <path d="M21 96 q7 -6 14 0 z" fill="var(--seal-eye)"/>`,
  diligent: `
    <path d="M44 44 Q80 4 116 44 Z" fill="var(--gold)" stroke="var(--seal-eye)" stroke-width="1.5"/>
    <rect x="38" y="41" width="84" height="8" rx="4" fill="var(--gold)" stroke="var(--seal-eye)" stroke-width="1.5"/>
    <rect x="76" y="18" width="8" height="24" rx="3" fill="var(--seal-shine)" opacity=".55"/>`,
  sprint: `
    <path d="M44 41 Q80 29 116 41 L116 49 Q80 37 44 49 Z" fill="var(--warn)"/>
    <path d="M44 43 L30 36 L33 47 Z M44 47 L31 54 L36 44 Z" fill="var(--warn)"/>
    <g stroke="var(--ink-2)" stroke-width="3" stroke-linecap="round" opacity=".55">
      <line x1="6" y1="78" x2="22" y2="78"/><line x1="2" y1="92" x2="22" y2="92"/><line x1="8" y1="106" x2="24" y2="106"/>
    </g>`,
  slow: `
    <path d="M124 106 h22 v8 a11 11 0 0 1 -22 0 z" fill="var(--seal-shine)" stroke="var(--seal-eye)" stroke-width="1.5"/>
    <path d="M146 108 q7 0 6 6 q-1 5 -7 4" fill="none" stroke="var(--seal-eye)" stroke-width="1.5"/>
    <path d="M130 100 q-3 -5 0 -10 M138 100 q-3 -5 0 -10" fill="none" stroke="var(--ink-2)" stroke-width="1.8" stroke-linecap="round" opacity=".6"/>`,
  chill: `
    <rect x="53" y="50" width="25" height="15" rx="6" fill="var(--seal-eye)"/>
    <rect x="82" y="50" width="25" height="15" rx="6" fill="var(--seal-eye)"/>
    <path d="M78 55 h4" stroke="var(--seal-eye)" stroke-width="3"/>
    <path d="M58 55 l6 -2 M87 55 l6 -2" stroke="var(--seal-shine)" stroke-width="2" stroke-linecap="round" opacity=".7"/>`,
  adventure: `
    <path d="M42 46 Q80 8 118 46 Q80 32 42 46 Z" fill="var(--warn)"/>
    <circle cx="66" cy="32" r="2.5" fill="var(--seal-shine)"/><circle cx="82" cy="26" r="2.5" fill="var(--seal-shine)"/><circle cx="98" cy="33" r="2.5" fill="var(--seal-shine)"/>
    <circle cx="120" cy="45" r="5" fill="var(--warn)"/>
    <path d="M122 47 l12 6 l-3 -10 Z M121 49 l7 12 l2 -10 Z" fill="var(--warn)"/>`,
};

/** 回傳一隻海豹的 SVG(title 給螢幕閱讀器) */
export function seal(variant = 'wave', title = 'SealHack 海豹') {
  const eyes = variant === 'slow' ? EYES_HAPPY : variant === 'chill' ? '' : EYES_OPEN;
  const rightFlipper = variant === 'wave'
    ? '<ellipse cx="130" cy="66" rx="9" ry="19" transform="rotate(35 130 66)" fill="var(--seal-dark)"/>'
    : '<ellipse cx="122" cy="98" rx="9" ry="18" transform="rotate(-30 122 98)" fill="var(--seal-dark)"/>';
  return `<svg viewBox="0 0 160 140" role="img" aria-label="${title}">
    <ellipse cx="80" cy="130" rx="48" ry="6" fill="var(--ink)" opacity=".08"/>
    <ellipse cx="44" cy="122" rx="15" ry="7" transform="rotate(-18 44 122)" fill="var(--seal-dark)"/>
    <ellipse cx="116" cy="122" rx="15" ry="7" transform="rotate(18 116 122)" fill="var(--seal-dark)"/>
    <ellipse cx="80" cy="94" rx="50" ry="33" fill="var(--seal)"/>
    <circle cx="80" cy="62" r="38" fill="var(--seal)"/>
    <ellipse cx="80" cy="101" rx="30" ry="21" fill="var(--seal-belly)"/>
    <ellipse cx="38" cy="98" rx="9" ry="18" transform="rotate(30 38 98)" fill="var(--seal-dark)"/>
    ${rightFlipper}
    ${eyes}
    <ellipse cx="55" cy="71" rx="7" ry="4" fill="var(--seal-blush)"/>
    <ellipse cx="105" cy="71" rx="7" ry="4" fill="var(--seal-blush)"/>
    <ellipse cx="80" cy="73" rx="15" ry="10" fill="var(--seal-belly)"/>
    <ellipse cx="80" cy="67.5" rx="5.5" ry="3.8" fill="var(--seal-eye)"/>
    <path d="M73 75 Q76.5 80 80 75 Q83.5 80 87 75" fill="none" stroke="var(--seal-eye)" stroke-width="2" stroke-linecap="round"/>
    <g fill="var(--seal-eye)" opacity=".45"><circle cx="70" cy="72" r="1.2"/><circle cx="68" cy="76" r="1.2"/><circle cx="90" cy="72" r="1.2"/><circle cx="92" cy="76" r="1.2"/></g>
    ${ACCESSORY[variant] ?? ''}
  </svg>`;
}

/** 退休人格:存錢力 × 投資風格 → 哪一種海豹 */
export const PERSONAS = {
  'saver-safe': { variant: 'hoard', name: '囤糧海豹', tag: '存得多、放得穩,景氣再冷也有存糧。', tint: 'var(--pastel-lemon)' },
  'saver-steady': { variant: 'diligent', name: '勤勞海豹', tag: '規律存、穩穩投,一步一步把魚缸裝滿。', tint: 'var(--pastel-mint)' },
  'saver-bold': { variant: 'sprint', name: '衝刺海豹', tag: '存得兇也敢衝,目標是提早下班。', tint: 'var(--pastel-peach)' },
  'spender-safe': { variant: 'slow', name: '慢活海豹', tag: '照自己的步調走,穩穩的最安心。', tint: 'var(--pastel-lilac)' },
  'spender-steady': { variant: 'chill', name: '悠哉海豹', tag: '現在的生活要顧,未來也想顧到。', tint: 'var(--pastel-sky)' },
  'spender-bold': { variant: 'adventure', name: '冒險海豹', tag: '存得不算多,靠報酬拚一把。', tint: 'var(--pastel-pink)' },
};
