# 部署現況與兩個保留方案

使用者尚未決定是否遷移。這份文件同時保留「留在 GitHub Pages、不遷移」與「遷移至 Cloudflare Pages」兩個方案，不預設其中一個已獲選，也不以商業用途限制作為本次選擇依據。更新日期：2026-09-23。

## 目前已驗證的部署

- Repository：`lu-sugar-tiger/paradigm-website`。
- GitHub Pages API 顯示 source 為 `main`、path 為 `/`、custom domain 為 `prdm.tw`、build type 為 `legacy`。
- 截至 2026-09-23 本次發布前，已驗證的發布 commit 是 `7d2225b`；GitHub 的 `pages build and deployment` run `34741642483` 成功。後續發布需依 GitHub 最新 deployment 確認。
- 正式站 HEAD 回應帶有 `Server: cloudflare`、`x-github-request-id` 與 `x-github-edge-region`，顯示目前由 Cloudflare 代理 GitHub Pages origin。
- 因此目前流程是 `main` → GitHub Pages → Cloudflare proxy → `prdm.tw`，不能只因回應出現 Cloudflare 就認定已使用 Cloudflare Pages。

以下遷移步驟是參考方案，不是現在或未來自動執行遷移的授權；正常 GitHub 發布不包含建立 Cloudflare Pages 專案、修改 DNS 或停用 GitHub Pages。

## 方案 A：留在 GitHub Pages，不遷移

維持 `main` → GitHub Pages → Cloudflare proxy → `prdm.tw`，不需為此方案新增服務、變更 DNS 或重新設定帳戶。這可以是持續使用的方案，不只是等待遷移的過渡狀態。

依以下流程發布；定期檢查公開檔案容量及實際流量，圖片和影片維持最佳化。若另外決定調整快取或轉址，應獨立確認範圍；不要把主機遷移當作修正舊版內容的必要前提。

### 既有更新流程

僅在使用者要求發布時執行：

1. 修改集中來源、renderer、CSS、JS 或受控資料，不直接修改產生頁面。
2. 執行 `node scripts/build-site.mjs`，再執行 `node scripts/build-site.mjs --check` 與相關 `scripts/validate-*.mjs`；透過本機 HTTP 預覽檢查桌面、手機與互動。
3. 只 stage 本次要發布的內容，排除 `assets/temp/` 等暫存素材，執行 `git diff --cached --check`。
4. commit 並 `git push origin main`；比對本機 SHA 與 `git ls-remote origin refs/heads/main`。
5. 在 GitHub Actions 確認該 SHA 的 `pages build and deployment` 成功。
6. 檢查 `https://prdm.tw/` 與此次變更路由、資產版本。必要時加上 commit query 做查核；它不等同清除所有訪客的快取。

若需回復版本，應在明確要求下以可追蹤的 revert commit 發布；Cloudflare Pages 的 deployment rollback 不適用於目前的 GitHub Pages origin。

## 容量量測與限制（2026-09-23）

| 量測範圍 | 檔案數 | 容量（十進位 MB） |
| --- | ---: | ---: |
| 最新本機公開目錄與根檔案，包含未發布進度 | 736 | 243.33 |
| 全部未被 Git 忽略的工作樹檔案，另含來源、文件、參考素材 | 839 | 約 265.81 |
| 本機 HEAD `7d2225b` 的公開目錄與根檔案 | 214 | 28.14 |
| 本機 HEAD `7d2225b` 的完整 repository 檔案快照 | 290 | 49.78 |

量測方式：以 `git ls-files --cached --others --exclude-standard` 去重後加總現存檔案 bytes；HEAD 以 `git ls-tree -r -l HEAD` 計算。公開範圍是 `assets/`、`collections/`、`products/`、`pages/`、`search/`、`teamwear/`、`font-credits/`，以及 `index.html`、`favicon.svg`、`CNAME`、`_redirects`。不含 `.git/` 歷史、被忽略的暫存原始素材與瀏覽器驗證產物；完整工作樹數字是本次文件編修前的快照，不等同 repository 歷史大小或精確部署輸出。

目前圖片目錄約 211.52 MB；影片目錄（含 posters、manifest）約 29.86 MB。最大單檔是 `assets/videos/teamwear/hero-large.mp4`，10,872,800 bytes；本次量測沒有超過 25 MiB 的未忽略檔案。

[GitHub Pages 官方限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)：發布站點上限 1 GB、每月頻寬 soft limit 100 GB、每小時建置 soft limit 10 次（自訂 Actions 發布流程例外）、部署 timeout 10 分鐘；來源 repository 另有建議 1 GB 限制。該頁沒有列出獨立的檔案數上限，不代表承諾無限檔案。

用較保守的 1 GB = 1,000,000,000 bytes 計，最新公開範圍約占 24.33%；即使計入完整未忽略工作樹也約 26.58%，尚餘約 734 MB。依現有容量沒有迫切遷移需求；未量得持續成長速度，不能據此保證幾年內不會超限。大量新增影片或原始圖片會加速成長。未取得每月 origin 流量，不能判定頻寬餘裕；網站總容量也不是單次瀏覽下載量。

[Cloudflare Pages Free 限制](https://developers.cloudflare.com/pages/platform/limits/)：每站 20,000 個檔案、單一資產 25 MiB、每月 500 次建置。本機全部 839 個檔案約占檔案數限制 4.20%，現有最大單檔也符合限制。

GitHub Pages API 於 2026-09-23 仍回報 `main`、`/`、`prdm.tw`、`legacy`、`built`。先前成功 run `34741642483` 的 `github-pages` artifact 已 expired，API 的封裝 artifact 大小不等同未壓縮的發布站點大小，因此表格沒有將它當成精確線上容量；HEAD 快照與未發布本機進度也分開列示。

## 方案 B：遷移至 Cloudflare Pages（待另行決定）

下列建立專案、設定 domain、切換 DNS 與停用舊主機的步驟，僅在使用者明確要求遷移後執行。

目前專案是純靜態網站：

- HTML
- CSS
- Vanilla JavaScript
- 無 build tool
- 無 backend
- 無購物車、付款、會員、庫存或 Shopify API

因此 Cloudflare Pages 的部署設定應該保持簡單，不需要新增 framework 或建置流程。

## 方案 B 的差異與工作量

這是選項，不是已選定的方向。仍保留 GitHub repository、`main` 與既有本機產生器；更換的是靜態網站主機。沒有資料庫或 backend 要搬，也不需要重寫網站。

可透過 [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/) 自動部署，並套用現有的 [`_redirects` 規則](https://developers.cloudflare.com/pages/configuration/redirects/)。目前 GitHub Pages 不處理 `_redirects`；Cloudflare proxy 本身也不會讀取 repo 中這份檔案。遷移時需要實測轉址，不應假定兩邊路由行為完全相同。

工作主要是一次性帳戶／專案設定、確認發布檔案範圍、預覽驗證、DNS／HTTPS 切換與切換後驗證。對這個純靜態專案屬相對簡單的遷移，但登入授權、既有 DNS／快取規則與 TLS 生效時間仍需確認。

### 需要手動設定的項目

1. 帳戶擁有者登入 Cloudflare／GitHub，必要時完成 MFA，授權 Cloudflare 存取指定 repo。
2. 建立 Pages Git integration 專案，選擇 repo、正式分支 `main` 與下列部署設定。
3. 先驗證 `pages.dev` 預覽，再於 Pages 加入 `prdm.tw` custom domain，確認或替換既有網站 DNS record；不要改到 email 等無關紀錄。Apex domain 必須位於同一 Cloudflare account 的 zone 並使用 Cloudflare nameservers；先檢查現況，不預設需要向 registrar 改 nameservers。詳見 [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)。
4. 確認 HTTPS、路由、影片、字體、轉址與快取規則，通過後才考慮停用 GitHub Pages。

網站端的檔案範圍檢查及測試可以由開發工具處理；帳戶登入／授權與正式網域切換仍須擁有者參與或明確授權。完成設定後不需每次手動上傳，日常仍是經要求後 push `main`，再確認自動部署成功。

## 部署前確認

部署前先確認本機網站可以正常開啟。

在專案根目錄執行：

```bash
python3 -m http.server 8000
```

打開：

```text
http://localhost:8000/
```

至少檢查這些頁面：

- `http://localhost:8000/`
- `http://localhost:8000/collections/all/`
- `http://localhost:8000/collections/ss-tops/`
- `http://localhost:8000/collections/aw-tops/`
- `http://localhost:8000/collections/bottoms/`
- `http://localhost:8000/products/BD24021/`
- `http://localhost:8000/teamwear/`

根網址應直接顯示與 `/collections/all` 相同的全部商品內容，不應重新導向，且瀏覽器網址不應包含 `index.html`。

遷移獲核准後，先確認要部署的 commit；在切換正式網域前完成預覽驗證。

建議正式部署 branch 使用：

```text
main
```

## Cloudflare Pages 建立專案

進入 Cloudflare Dashboard：

```text
Workers & Pages → Create application → Pages → Connect to Git
```

選擇 GitHub repository：

```text
lu-sugar-tiger/paradigm-website
```

如果 Cloudflare 還沒有 GitHub 權限，授權時建議只允許存取這個 repository。

## Build 設定

因為這個專案沒有 build tool，Cloudflare Pages 設定如下：

```text
Project name: paradigm-website（新專案建議；既有 Cloudflare project 可保留原名）
Production branch: main
Framework preset: None
Build command: 留空
Build output directory: /
Root directory: 留空
```

如果 Cloudflare UI 不接受 `/` 作為 output directory，可以改用：

```text
Build output directory: .
```

不要填：

```text
npm run build
```

目前專案沒有 `package.json` 的 `npm run build` 流程，但有既有的 Node 產生器 `scripts/build-site.mjs`。這個部署方案使用在本機產生、驗證並 commit 的靜態輸出，因此 Cloudflare build command 可留空；這不表示專案沒有產生步驟。

根目錄輸出是最少設定的方案，但可能一併發布 `docs/`、`scripts/`、`data/`、`references/` 等非網站必要檔案；Git 忽略規則也不代表所有已追蹤來源都會被排除。正式遷移前先審核發布清單。若要只發布公開檔案，可另行核准一個簡單的複製／封裝步驟到獨立輸出目錄，不需要引入 framework；本次僅記錄選項，沒有新增封裝流程。

切換前也應確認發布範圍與 [Cloudflare Pages 限制](https://developers.cloudflare.com/pages/platform/limits/)：單檔上限為 25 MiB。檢查欲發布的影片、圖片與檔案數，排除暫存原始檔；不要只因本機預覽正常就假定能直接部署全部檔案。

## 自訂網域設定

Cloudflare Pages project 建立完成後，先確認 Cloudflare 提供的預覽網址可以正常開啟。

預覽網址通常類似：

```text
https://paradigm-website.pages.dev
```

既有 Cloudflare Pages project 的 `pages.dev` 網址不會因 GitHub repository 改名而自動變更；請以 Dashboard 顯示的網址為準。

確認可正常開啟後，到 Pages project 裡新增自訂網域：

```text
Custom domains → Set up a custom domain
```

新增：

```text
prdm.tw
```

Cloudflare 會自動建立或提示需要的 DNS record。

如果需要手動設定 DNS，通常會是：

```text
Type: CNAME
Name: prdm.tw
Target: <Cloudflare Pages project>.pages.dev
Proxy status: Proxied
```

實際 target 以 Cloudflare 畫面提供的值為準。

如果也要支援 `www.prdm.tw`，再新增：

```text
www.prdm.tw
```

並設定 redirect 或同樣加入 Pages custom domain。

## GitHub Pages 停用建議

只有在 Cloudflare Pages 預覽、`prdm.tw` custom domain、HTTPS、資產與轉址均驗證成功，且切換已獲授權後，才停用 GitHub Pages。切換完成前保留既有 origin。

位置：

```text
GitHub → lu-sugar-tiger/paradigm-website → Settings → Pages
```

目前查核 GitHub Pages 仍有設定，不應預設它已因 billing 限制停用。

切換後再更新本文的「目前已驗證的部署」與 README，記錄新的專案、正式分支與成功 deployment；不要提前將建議方案寫成已完成現況。

## 驗證部署

Cloudflare Pages 部署完成後，檢查：

```text
https://prdm.tw/
https://prdm.tw/collections/all
https://prdm.tw/collections/ss-tops
https://prdm.tw/collections/aw-tops
https://prdm.tw/collections/bottoms
https://prdm.tw/products/BD24021
https://prdm.tw/teamwear
```

`https://prdm.tw/` 應直接回應全部商品頁並保留根網址；`https://prdm.tw/collections/all` 也應提供相同內容。其他對外網址不應包含 `index.html`。

也可以用 terminal 檢查 response header：

```bash
curl -I https://prdm.tw/
```

改用 Cloudflare Pages 後，回應應該不再出現 GitHub Pages 相關 header，例如：

```text
x-github-request-id
x-github-edge-region
```

若還看到這些 header，代表回應可能仍來自 GitHub origin 或舊快取。應搭配 Cloudflare Pages deployment 的 commit SHA、custom domain 狀態與正式路由內容判斷；header 的存在或消失都不是單獨充分的遷移證明。

## 遷移完成後的日常更新流程

僅在正式完成切換並更新部署紀錄後使用：

1. 在本機修改集中來源、CSS、JS 或圖片
2. 執行既有產生器與驗證，再用 `python3 -m http.server 8000` 本機檢查
3. commit 變更
4. push 到 `main`
5. Cloudflare Pages 自動部署
6. 到 Cloudflare Pages deployment 頁面確認狀態成功
7. 開啟 `https://prdm.tw/` 檢查正式站

## Cloudflare Pages Rollback（遷移後）

如果部署後發現問題，可以到：

```text
Cloudflare Dashboard → Workers & Pages → 目前的 Paradigm project → Deployments
```

選擇上一個正常版本，執行 rollback。

Rollback 後仍建議在 GitHub 裡修正問題，避免下一次 push 又把問題部署回去。

## 注意事項

- 不要新增 cart、checkout、payment、inventory、account 或 backend
- 不要新增 Shopify Liquid 或 Shopify API
- 不要新增 build tool，除非未來明確決定要引入
- 正式圖片建議放在 `assets/images/`
- 外部購買連結應清楚導向 Shopee
- 部署前要確認 mobile 與 desktop 版面
- 部署後要確認沒有 404、沒有 console error、沒有水平 overflow
- 另外測試不存在的路徑是否回傳預期的 404，避免主機預設 fallback 改變網站行為

