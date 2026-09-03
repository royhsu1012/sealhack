// 網站導覽結構。slug 對應 src/content/docs 下的檔名。
export interface NavItem { label: string; slug: string; }
export interface NavGroup { group: string; items: NavItem[]; }

export const NAV: NavGroup[] = [
  {
    group: '照順序學',
    items: [
      { label: '🐣 新手:45 分鐘完成第一場', slug: 'workflow/handbook' },
      { label: '⚡ 進階:七步完賽攻略', slug: 'workflow/quickstart' },
      { label: '0｜怎麼讀懂一場比賽', slug: 'workflow/0-diagnose' },
      { label: '1｜建立可信的驗證', slug: 'workflow/1-validate' },
      { label: '2｜先跑出基準分數', slug: 'workflow/2-baseline' },
      { label: '3｜怎麼加特徵才有效', slug: 'workflow/3-features' },
      { label: '4–5｜組合模型與交卷', slug: 'workflow/4-ensemble' },
    ],
  },
  {
    group: '卡住時查',
    items: [
      { label: '資料很少怎麼辦', slug: 'workflow/small-n' },
      { label: '題型速查表', slug: 'maps/solution' },
      { label: '詞彙表', slug: 'glossary' },
    ],
  },
  {
    group: '為什麼可信',
    items: [
      { label: '我們驗證過的 14 件事', slug: 'claims' },
      { label: '實戰成績:七場比賽', slug: 'cases/titanic' },
    ],
  },
];

// 學習主線(文件頁「上/下頁」依它,與側欄順序脫鉤)。
// 「卡住時查」與「為什麼可信」是參考與支線,不在線性主線上——它們有自己的定位條。
export const LEARN_PATH: NavItem[] = [
  { label: '🐣 新手手冊', slug: 'workflow/handbook' },
  { label: '⚡ 進階七步', slug: 'workflow/quickstart' },
  { label: '0｜讀懂比賽', slug: 'workflow/0-diagnose' },
  { label: '1｜建立驗證', slug: 'workflow/1-validate' },
  { label: '2｜基準分數', slug: 'workflow/2-baseline' },
  { label: '3｜加特徵', slug: 'workflow/3-features' },
  { label: '4–5｜集成與交卷', slug: 'workflow/4-ensemble' },
];

export const href = (slug: string) => `/${slug}/`;
