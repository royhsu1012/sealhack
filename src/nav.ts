// 網站導覽結構(取代舊 Starlight sidebar)。slug 對應 src/content/docs 下的檔名。
export interface NavItem { label: string; slug: string; }
export interface NavGroup { group: string; items: NavItem[]; }

export const NAV: NavGroup[] = [
  {
    group: '方法論',
    items: [
      { label: '⚡ 快速版:最短完賽路', slug: 'workflow/quickstart' },
      { label: '讀題與五問診斷', slug: 'workflow/0-diagnose' },
      { label: '資料清洗與補全', slug: 'workflow/0-clean' },
      { label: '鎖死驗證', slug: 'workflow/1-validate' },
      { label: '多樣化基線', slug: 'workflow/2-baseline' },
      { label: '特徵迭代', slug: 'workflow/3-features' },
      { label: '集成', slug: 'workflow/4-ensemble' },
      { label: '收尾與提交', slug: 'workflow/5-submit' },
      { label: '小樣本作戰守則', slug: 'workflow/small-n' },
    ],
  },
  {
    group: '證據',
    items: [
      { label: '主張登錄表與 LB 教條', slug: 'claims' },
      { label: '示範案例:鐵達尼', slug: 'cases/titanic' },
    ],
  },
  {
    group: '地圖',
    items: [
      { label: '解題地圖', slug: 'maps/solution' },
      { label: '學習地圖', slug: 'maps/learning' },
      { label: '延伸學習資源', slug: 'resources' },
    ],
  },
  {
    group: '',
    items: [{ label: '詞彙表', slug: 'glossary' }],
  },
];

// 扁平化(給 prev/next 用),排除純標題組
export const FLAT: NavItem[] = NAV.flatMap((g) => g.items);
export const href = (slug: string) => `/${slug}/`;
