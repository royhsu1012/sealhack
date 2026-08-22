// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://sealhack.com',
  integrations: [
    starlight({
      title: 'SealHack',
      favicon: '/favicon.svg',
      defaultLocale: 'root',
      locales: { root: { label: '繁體中文', lang: 'zh-TW' } },
      customCss: ['./src/styles/theme.css'],
      social: [],
      sidebar: [
        {
          label: '方法論',
          items: [
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
          label: '證據',
          items: [
            { label: '主張登錄表與 LB 教條', slug: 'claims' },
            { label: '示範案例:鐵達尼', slug: 'cases/titanic' },
          ],
        },
        {
          label: '地圖',
          items: [
            { label: '解題地圖', slug: 'maps/solution' },
            { label: '學習地圖', slug: 'maps/learning' },
          ],
        },
        { label: '詞彙表', slug: 'glossary' },
      ],
    }),
  ],
});
