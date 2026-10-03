# Paradigm Website

Paradigm 是一個純靜態的品牌商品網站，使用 HTML、CSS 與 Vanilla JavaScript 製作。

目前網站以商品瀏覽為核心：

- 根網址 `/` 直接顯示與 `/collections/all` 相同的全部商品頁，不改寫瀏覽器網址
- Collection 頁面展示全部商品或指定商品類型
- `All` 是商品目錄的上層；`Tees`、`Crewnecks`、`Hoodies`、`Shorts` 均提供直接返回 `All` 的導覽
- Product 頁面以商品編號作為穩定網址
- Teamwear 頁面介紹團隊服服務並導向外部詢問管道
- 購買按鈕導向 Shopee，不在網站內處理交易

專案沒有前端框架、打包工具、後端、購物車、結帳、會員或庫存系統；使用既有 Node 腳本從集中來源產生靜態 HTML/CSS/JS。

## 網址結構

正式公開網址不包含 `index.html`：

```text
https://prdm.tw/                         （全部商品首頁）
https://prdm.tw/collections/all
https://prdm.tw/collections/tees
https://prdm.tw/collections/crewnecks
https://prdm.tw/collections/hoodies
https://prdm.tw/collections/shorts
https://prdm.tw/products/BD24021
https://prdm.tw/products/ED14024
https://prdm.tw/teamwear
```

Collection 使用 `data/product-categories.json` 的商品類型名稱，只依 `typeCode` 分類：14 → Tees、23 → Crewnecks、24 → Hoodies、42 → Shorts。不發布產品線分類。舊 SS Tops、AW Tops、Bottoms 網址分別轉址至 Tees、All、Shorts。Product 使用不含 `#` 的商品編號；`#` 在網址中代表 fragment，因此只保留在畫面顯示的商品代碼中。詳見 [商品分類](docs/product-categories.md)。

每個資料夾內的 `index.html` 是靜態 hosting 的實作方式，不應出現在網站導覽、canonical URL 或對外分享連結中。根網址會直接提供全部商品內容。`_redirects` 是供 Cloudflare Pages 使用的舊網址與 `index.html` 轉址設定；目前 GitHub Pages 不會讀取這份規則，經過 Cloudflare proxy 也不會自動啟用它。

## 本機開啟方式

第一次取得專案時：

```bash
git clone https://github.com/lu-sugar-tiger/paradigm-website.git
cd paradigm-website
```

在專案根目錄啟動本機靜態伺服器：

```bash
python -m http.server 8000
```

打開 `http://localhost:8000/` 後即可看到商品列表，且根網址會保持不變。常用頁面：

- 全部商品：`http://localhost:8000/collections/all/`
- Tees：`http://localhost:8000/collections/tees/`
- Crewnecks：`http://localhost:8000/collections/crewnecks/`
- Hoodies：`http://localhost:8000/collections/hoodies/`
- Shorts：`http://localhost:8000/collections/shorts/`
- 商品詳情：`http://localhost:8000/products/BD24021/`
- Teamwear：`http://localhost:8000/teamwear/`

一般靜態伺服器可能在資料夾網址尾端補上 `/`；這不會把 `index.html` 顯示在網址中。

## 專案結構

```text
.
├── index.html                  # 根網址的全部商品頁
├── _redirects                 # Cloudflare Pages 用；目前 GitHub Pages 不套用
├── collections/
│   ├── all/index.html
│   ├── tees/index.html
│   ├── crewnecks/index.html
│   ├── hoodies/index.html
│   ├── shorts/index.html
│   └── ...                     # 舊 collection URL 的相容轉址
├── products/
│   ├── BD24021/index.html
│   ├── ED14024/index.html
│   └── ...
├── teamwear/index.html
├── assets/
│   ├── css/
│   └── js/
├── pages/                      # 舊網址 redirect stubs
└── references/
```

## 商品資料

商品來源快照位於 `data/products-source.json`，使用 schema version 4：`items[]` 中的 `code`、`name`、`lineCode`、`typeCode`、`sequence`、`listPrice`、`salePrice`、`link`、`descriptionSource`，以及 variants 中的 `sku`、`colorCode`、`colorName`、`sizeCode`、`sizeName` 與 `lots[].code`／`lots[].id`。欄位採 lower camelCase；識別碼保留字串與前導零。完整欄位對照與匯入規則見 [item schema](docs/item-schema.md)。

`scripts/build-site.mjs` 驗證並直接讀取來源 schema，從集中資料與共用 renderer 產生商品、商品分類、Teamwear、導覽、頁尾、選項與主要操作；`scripts/build-product-catalog.mjs` 保留為相容入口。產生檔帶有 do-not-edit 標記，請勿直接修改。下方是網站 `items[]` 呈現模型的示意；與來源採同樣命名，另加 `priceLabel`、圖片呈現資料與文案 tokens，不再轉回舊欄位名稱。公開網址不變：

```js
{
  slug: "everyday-tee",
  code: "ED14001",
  name: "PRDM Everyday Tee",
  category: "Tees",
  listPrice: 590,
  salePrice: null,
  priceLabel: "NT$590",
  image: "assets/images/everyday-tee.webp",
  images: ["assets/images/everyday-tee.webp"],
  colors: [{ id: "black", colorCode: "C01", label: "Black" }],
  sizes: ["M", "L", "XL"],
  variants: [{ sku: "ED14001-C01-S1", colorCode: "C01", colorName: "Black", sizeCode: "S1", sizeName: "M", visible: true, soldOut: false, lots: [] }],
  description: [
    { type: "text", text: "• 100% cotton" },
    { type: "blank", text: "\n" },
    { type: "divider", text: "-" },
    { type: "blank", text: "\n" },
    {
      type: "table",
      sourceLines: ["     M   L", "肩寬 50.0 51.5", "胸寬 55.5 57.5"],
      columnCount: 3,
      header: ["", "M", "L"],
      body: [["肩寬", "50.0", "51.5"], ["胸寬", "55.5", "57.5"]]
    },
    { type: "hashtag", text: "#ED14001" }
  ],
  link: "https://shopee.tw/..."
}
```

常用欄位：

- `code`：網址與資料查找使用的商品編號，不含 `#`
- `name`、`category`、`listPrice`、`salePrice`：商品基本資料；`priceLabel` 是以 `salePrice ?? listPrice` 產生的顯示字串
- `image`、`images`、`media`、`alt`：商品圖片與替代文字；`media[].derivatives` 提供 540、1080、2160 短邊的 content-addressed WebP 與 `srcset` 資料；沒有真實圖片時 `image` 為 `null`、`images` 與 `media` 為空陣列
- `colors`、`sizes`、`variants`：款式與尺寸資料；`sku` 可以保留於資料但不顯示在網站
- `description`：由來源的 `descriptionSource` 產生；普通文字與空白段落依來源順序保留；空白段落以可選取的 `U+000A` 表示，單獨破折號只轉成單行水平線，已確認的矩形尺寸資料轉為無格線表格
- `link`：外部購買連結，目前導向 Shopee

商品同步與文案正規化規則詳見 `docs/product-sync.md`。

## 圖片與文案

商品圖片放在 `assets/images/`，優先使用尺寸合適且壓縮過的 WebP。若來源沒有圖片，保留既有真實商品照片；完全沒有照片時顯示空白媒體區，不使用替代插圖或提示標籤。例如：

```js
image: "assets/images/cosmos-hoodie-front.webp"
```

`teamwear/index.html` 是產生檔。服務說明、流程與靜態 FAQ 的來源是 `scripts/templates/teamwear-page.html`；選項、攝影與影片資料分別維護在 `data/teamwear-options.json`、`data/teamwear-photography.json` 與 `data/teamwear-video.json`。共用 renderer 和 build adapter 處理資產路徑與詢問操作，請勿直接修改產生頁面。

頁尾由 `scripts/lib/site-renderers.mjs` 的 `renderSiteFooter()` 產生；Shopee 商店連結維護在 `data/store-links.json`，商品購買連結來自商品及 variant 的 `link`，詢問操作由 build adapter 與共享操作 renderer 組成。請在來源中查找並修改連結，再重新產生頁面：

```bash
rg "shopee|instagram|discord|https://" data scripts/lib/site-renderers.mjs scripts/build-site.mjs
```

## 部署

截至 2026-09-22 實際查核，正式站使用 `main` → GitHub Pages → Cloudflare proxy → `prdm.tw`。GitHub Pages 的 source 是 `main` 的根目錄 `/`；正式站回應同時帶有 Cloudflare 與 GitHub origin headers。Cloudflare proxy 與 Cloudflare Pages 是不同的服務。

截至 2026-09-23 的部署記錄保留兩個方案：A. 留在 GitHub Pages、不遷移；B. 另行核准後遷移至 Cloudflare Pages。不以商業用途限制作為本次選擇依據，也不預設未來一定遷移。當日的本機公開檔案快照（含尚未發布的進度）約 243.33 MB、736 個檔案；這是歷史量測，不代表目前容量或最新線上部署。量測範圍、兩個方案與手動設定項目見 [部署指南](docs/cloudflare-pages-deployment.md)。

商品資料由 Google Sheet 的 `網站參照` 分頁定期同步；欄位規則、Google Docs 文案截取、圖片保留策略、修改時間追蹤與驗證流程請見 `docs/product-sync.md`。

```text
Current hosting: GitHub Pages
Source branch: main
Source directory: / (root)
Custom domain: prdm.tw
Front proxy: Cloudflare
```

Repository：`https://github.com/lu-sugar-tiger/paradigm-website`

既有更新流程：修改來源 → 本機產生與驗證 → commit → push 到 `main` → 確認 GitHub 的 `pages build and deployment` 成功且 commit SHA 相符 → 檢查正式站。方案 A 繼續使用此流程；只有在使用者要求發布時才執行發布。方案 B 未經另行決定，不建立新主機或變更 DNS。

## 封存中的功能

Catalog Refine 與 Teamwear fabric section 的開發來源保留在 [`_archive/`](./_archive/README.md)，不參與公開頁面產生。`_config.yml` 將封存目錄排除於目前 GitHub Pages 的 Jekyll 發布流程；請勿加入 `.nojekyll` 繞過此設定。正常產生與 push 不會重新啟用這兩項功能。推送前另執行 `node scripts/validate-feature-archive.mjs`。

## 上線前檢查

- `/` 與 `/collections/all` 會顯示相同的全部商品內容，且 `/` 不會重新導向
- Collection、每個 Product 與 Teamwear 頁面都可正常開啟
- 網站內沒有導向 `index.html`、舊 `/pages/...` 或舊 collection URL 的導覽連結；`/products/{code}?variant={sku}` 是目前合法的款式連結，產品 canonical 仍為 `/products/{code}`
- 手機與桌面寬度沒有水平捲動
- 行動導覽、搜尋、偏好選單、商品選項與互動連結可使用鍵盤操作；FAQ 是靜態問答內容
- 圖片沒有 404，瀏覽器 console 沒有錯誤
- Shopee 連結清楚表示使用者將離開本站
- 缺少商品圖片的媒體區保持空白，且沒有提示標籤

## 範圍限制

- 不加入購物車、結帳、會員、庫存同步或後端功能，除非另有明確決定。
- 商品資料維護在 `data/products-source.json`；顏色維護在 `data/colors.json`；Teamwear 選項維護在 `data/teamwear-options.json`。`assets/js/catalog.js` 與公開 HTML 都是產生檔。
- 未來可將既有 HTML/CSS 元件轉成 Shopify sections/snippets，目前不寫 Liquid 或 Shopify API。
