// 網站導覽結構。slug 對應 src/content/docs 下的檔名。
export interface NavItem { label: string; slug: string; }
export interface NavGroup { group: string; items: NavItem[]; }

export const NAV: NavGroup[] = [
  {
    group: '方法論',
    items: [
      { label: '🐣 傻瓜手冊:第一場比賽', slug: 'workflow/handbook' },
      { label: '⚡ 快速版:最短完賽路', slug: 'workflow/quickstart' },
      { label: '0｜讀題診斷與清洗', slug: 'workflow/0-diagnose' },
      { label: '1｜鎖死驗證', slug: 'workflow/1-validate' },
      { label: '2｜多樣化基線', slug: 'workflow/2-baseline' },
      { label: '3｜特徵迭代', slug: 'workflow/3-features' },
      { label: '4–5｜集成與提交', slug: 'workflow/4-ensemble' },
      { label: '小樣本作戰守則', slug: 'workflow/small-n' },
      { label: '解題地圖:九軌道速查', slug: 'maps/solution' },
    ],
  },
  {
    group: '證據與參考',
    items: [
      { label: '主張登錄表與 LB 教條', slug: 'claims' },
      { label: '示範案例:鐵達尼', slug: 'cases/titanic' },
      { label: '詞彙表', slug: 'glossary' },
    ],
  },
];

// 扁平化(給 prev/next 用)
export const FLAT: NavItem[] = NAV.flatMap((g) => g.items);
export const href = (slug: string) => `/${slug}/`;
