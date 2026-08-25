// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://sealhack.com',
  integrations: [mdx(), sitemap()],
  vite: { plugins: [tailwindcss()] },
  // 收斂(2026-08-25):學習地圖併入快速版、延伸資源併入 claims;舊網址轉向
  redirects: {
    '/maps/learning/': '/workflow/quickstart/',
    '/resources/': '/claims/',
  },
});
