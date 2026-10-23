// 退休人格的配件:像素圖案,畫在海豹同一個格子上(座標同 seal-pixels.json:海豹頭頂 y = 35、身體中心 x = 95.5)。
// 字元:O 輪廓、C 身體、E 眼睛、W 反光、S 陰影(以上取參考圖的色票)、G 金、A 木頭色、R 紅;. = 不畫。
// 由 scripts/seal-css.mjs 轉成 CSS;改這裡之後重跑 npm run seal。

/** 帽子(28 格寬,蓋在頭頂):fill 帽身、band 帽帶、ridge 中間的稜線 */
const hat = (fill, band, ridge = fill) => [
  '..........OOOOOOOO..........',
  `.......OOO${fill.repeat(3)}${ridge.repeat(2)}${fill.repeat(3)}OOO.......`,
  `.....OO${fill.repeat(6)}${ridge.repeat(2)}${fill.repeat(4)}WW${fill}OO....`,
  `....O${fill.repeat(8)}${ridge.repeat(2)}${fill.repeat(5)}WW${fill.repeat(2)}O...`,
  `...O${fill.repeat(9)}${ridge.repeat(2)}${fill.repeat(6)}W${fill.repeat(3)}O..`,
  `...O${band.repeat(21)}O..`,
  `..O${fill.repeat(23)}O.`,
  `O${'A'.repeat(26)}O`,
  `O${'A'.repeat(26)}O`,
  'O'.repeat(28),
];

export const ACCESSORIES = {
  diligent: [{ x: 82, y: 27, rows: hat('G', 'G', 'A') }],
  adventure: [{ x: 82, y: 27, rows: hat('A', 'R') }],
  chill: [{ x: 83, y: 44, rows: [
    'E'.repeat(26),
    `EWWEEEEEE${'E'.repeat(8)}EWWEEEEEE`,
    'EWEEEEEEE........EWEEEEEEE',
    'EEEEEEEEE........EEEEEEEEE',
    'EEEEEEEEE........EEEEEEEEE',
    '.EEEEEEE..........EEEEEEE.',
    '..EEEEE............EEEEE..',
  ] }],
  hoard: [{ x: 119, y: 65, rows: ['..OOOOOOOO..', '.OGGGGGGWGO.', 'OGGGGGGGGGGO', 'OAAAAAAAAAAO', 'OGGGGGGGGGGO', 'OAAAAAAAAAAO',
    'OGGGGGGGGGGO', 'OAAAAAAAAAAO', 'OGGGGGGGGGGO', 'OAAAAAAAAAAO', '.OOOOOOOOOO.'] }],
  slow: [{ x: 119, y: 61, rows: ['...S..S......', '....S..S.....', '...S..S......', '.............', 'OOOOOOOOO....',
    'OAAAAAAAOOO..', 'OWWWWWWWO..O.', 'OWWWWWWWO..O.', 'OWWWWWWSOOO..', '.OWWWWSO.....', '..OOOOO......'] }],
  sprint: [
    { x: 83, y: 40, rows: ['R'.repeat(26), `.${'R'.repeat(26)}`] },
    { x: 74, y: 38, rows: ['...RR....', '.RRRRR...', 'RR...RRRR', 'R....RRRR', '.....RR..'] },
    { x: 58, y: 55, rows: ['SSSSSS', '......', '......', '......', 'SSSSSSSS', '......', '......', '......', '..SSSSS'] },
  ],
};
