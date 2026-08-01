# Cloudflare Pages 部署指南

這份文件說明如何將 Paradigm 網站部署到 Cloudflare Pages，並使用 `prdm.tw` 作為正式網域。

目前專案是純靜態網站：

- HTML
- CSS
- Vanilla JavaScript
- 無 build tool
- 無 backend
- 無購物車、付款、會員、庫存或 Shopify API

因此 Cloudflare Pages 的部署設定應該保持簡單，不需要新增 framework 或建置流程。

## 為什麼改用 Cloudflare Pages

目前 `prdm.tw` 曾經透過 GitHub Pages 發布過，但 GitHub Pages 設定受到 private repository 與 GitHub billing plan 限制影響。

Cloudflare Pages 比較適合目前需求：

- GitHub repository 可以維持 private
- 網站可以公開
- 可直接連接 GitHub 自動部署
- 支援自訂網域與 HTTPS
- 適合純靜態 HTML/CSS/JS 網站
- 與目前 Cloudflare DNS 管理方式一致

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
- `http://localhost:8000/collections/`
- `http://localhost:8000/products/prdm-cosmos-hoodie/`
- `http://localhost:8000/pages/teamwear/`
- `http://localhost:8000/pages/about/`

確認後把要上線的內容 commit 並 push 到 GitHub。

建議正式部署 branch 使用：

```text
master
```

## Cloudflare Pages 建立專案

進入 Cloudflare Dashboard：

```text
Workers & Pages → Create application → Pages → Connect to Git
```

選擇 GitHub repository：

```text
Risetto-Kao/paradigm
```

如果 Cloudflare 還沒有 GitHub 權限，授權時建議只允許存取這個 repository。

## Build 設定

因為這個專案沒有 build tool，Cloudflare Pages 設定如下：

```text
Project name: paradigm
Production branch: master
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

目前專案沒有 `package.json` 或 build script。

## 自訂網域設定

Cloudflare Pages project 建立完成後，先確認 Cloudflare 提供的預覽網址可以正常開啟。

預覽網址通常類似：

```text
https://paradigm.pages.dev
```

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
Target: paradigm.pages.dev
Proxy status: Proxied
```

實際 target 以 Cloudflare 畫面提供的值為準。

如果也要支援 `www.prdm.tw`，再新增：

```text
www.prdm.tw
```

並設定 redirect 或同樣加入 Pages custom domain。

## GitHub Pages 停用建議

如果網站正式改用 Cloudflare Pages，建議在 GitHub repository 裡停用 GitHub Pages，避免之後混淆。

位置：

```text
GitHub → Risetto-Kao/paradigm → Settings → Pages
```

如果 GitHub Pages 已經因 private repository billing limitation 被停用，不需要額外處理。

重點是之後不要再把 `prdm.tw` 指回 GitHub Pages。

## 驗證部署

Cloudflare Pages 部署完成後，檢查：

```text
https://prdm.tw/
https://prdm.tw/collections/
https://prdm.tw/products/prdm-cosmos-hoodie/
https://prdm.tw/pages/teamwear/
https://prdm.tw/pages/about/
```

也可以用 terminal 檢查 response header：

```bash
curl -I https://prdm.tw/
```

改用 Cloudflare Pages 後，回應應該不再出現 GitHub Pages 相關 header，例如：

```text
x-github-request-id
x-github-edge-region
```

若還看到這些 header，代表 DNS 或 custom domain 可能仍指向 GitHub Pages。

## 日常更新流程

之後更新網站時：

1. 在本機修改 HTML、CSS、JS 或圖片
2. 用 `python3 -m http.server 8000` 本機檢查
3. commit 變更
4. push 到 `master`
5. Cloudflare Pages 自動部署
6. 到 Cloudflare Pages deployment 頁面確認狀態成功
7. 開啟 `https://prdm.tw/` 檢查正式站

## Rollback

如果部署後發現問題，可以到：

```text
Cloudflare Dashboard → Workers & Pages → paradigm → Deployments
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

