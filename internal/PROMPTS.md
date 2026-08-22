# Claude Code 執行 Prompts v5(最終版)

前置:解壓 sealhack_kit.zip,在該目錄開 Claude Code。
逐階段貼,驗收通過才進下一階段。CLAUDE.md 會被自動讀取,是最高準則。

---

## 階段 1|建站與灌內容

```
初始化這個專案,嚴格遵守 CLAUDE.md:

1. 建立 Astro + Starlight 專案(官方 starter,最新穩定版,zh-TW locale,
   accent #E8481F,site title「SealHack」)。
2. 按 CLAUDE.md「網站結構」把 content/ 的 Markdown 拆分灌入:
   - KAGGLE_FRAMEWORK.md 按對照表拆成 workflow/ 八頁與 claims 一頁
     (§號對照寫在 CLAUDE.md 裡,照做)
   - MAPS.md → maps/solution 與 maps/learning 兩頁
   - GLOSSARY.md → glossary
   - MASTER_PLAN.md 不建頁面
   - 所有 ASCII 圖包 ```text 圍欄,表格逐一檢查沒跑版
3. 建 /cases/titanic:依 validation/case_titanic.py 與 CLAUDE.md 給的
   關鍵數字撰寫「六階段示範敘事」——基調是方法論的完整示範,
   每階段一節;集成翻車與雙提交救場寫成階段 5 的教學點
   (用 tip/caution Aside 呈現),文末附腳本連結與重跑說明。
4. validation/ 目錄照 CLAUDE.md 指定方式收進 repo,
   /claims 與 /cases/titanic 頁尾附連結。
5. 首頁 splash 照 CLAUDE.md 文案;sidebar 分組與順序照結構表。
6. 鐵律與陷阱套 Aside(caution),每頁最多 3 個。
7. npm run build 零錯誤,然後告訴我本地預覽指令。
```

**驗收清單**(逐項回報):
- [ ] 13 個頁面全部有內容
- [ ] 「下一頁」能從 0-diagnose 走到 small-n
- [ ] /claims 三張主張表完整
- [ ] 搜尋能搜到「OOF」「配對比較」
- [ ] 手機視窗無橫向捲動

---

## 階段 2|部署上線

```
部署這個站:

1. 建 GitHub repo 並推上去(給我指令,或直接用 gh CLI)。
2. Cloudflare Pages:連接 repo,告訴我 build command 與
   output directory 該填什麼。
3. sealhack.com 綁定步驟(DNS 已在 Cloudflare)。
4. SEO:每頁 title/description、og tags、sitemap、robots.txt。
5. 部署完成後我貼上線網址,你全站檢查一遍並回報問題清單。
```

**驗收**:https://sealhack.com 可開、https 正常、手機實測從首頁走完八個 workflow 頁。

---

## 迭代守則(上線後)

- 內容更新 = 改 content/ 的 MD → push → 自動部署。不碰程式碼。
- 方法論更新走它自己的規矩:先有文獻或 L2 實驗,才改 MD。
- 視覺客製、互動功能(診斷器、進度、Discord)一律 backlog,
  等 Phase 0 的卡關數據出來再決定做什麼。
- 每次只給 Claude Code 一個任務,做完驗收再下一個。
```
