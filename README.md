# Paradigm Website

Paradigm 是一個純靜態的品牌商品網站，使用 HTML、CSS 與 Vanilla JavaScript 製作。

目前網站以商品瀏覽為核心：

- 根網址 `/` 直接顯示與 `/collections/all` 相同的全部商品頁，不改寫瀏覽器網址
- Collection 頁面展示全部商品或指定系列
- `All` 是商品目錄的上層；`SS Tops`、`AW Tops`、`Bottoms` 均提供直接返回 `All` 的導覽
- Product 頁面以商品編號作為穩定網址
- Teamwear 頁面介紹團隊服服務並導向外部詢問管道
- 購買按鈕導向 Shopee，不在網站內處理交易

專案沒有前端框架、build tool、後端、購物車、結帳、會員或庫存系統。

## 網址結構

正式公開網址不包含 `index.html`：

```text
https://prdm.tw/                         （全部商品首頁）
https://prdm.tw/collections/all
https://prdm.tw/collections/ss-tops
https://prdm.tw/collections/aw-tops
https://prdm.tw/collections/bottoms
https://prdm.tw/products/BD24021
https://prdm.tw/products/PL-002
https://prdm.tw/teamwear
```

Collection 使用系列名稱，Product 使用不含 `#` 的商品編號。`#` 在網址中代表 fragment，因此只保留在畫面顯示的商品代碼中。

每個資料夾內的 `index.html` 是靜態 hosting 的實作方式，不應出現在網站導覽、canonical URL 或對外分享連結中。根網址會直接提供全部商品內容；Cloudflare Pages 的 `_redirects` 只用於整理舊網址與含有 `index.html` 的網址。

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
- SS Tops：`http://localhost:8000/collections/ss-tops/`
- AW Tops：`http://localhost:8000/collections/aw-tops/`
- Bottoms：`http://localhost:8000/collections/bottoms/`
- 商品詳情：`http://localhost:8000/products/BD24021/`
- Teamwear：`http://localhost:8000/teamwear/`

一般靜態伺服器可能在資料夾網址尾端補上 `/`；這不會把 `index.html` 顯示在網址中。

## 專案結構

```text
.
├── index.html                  # 根網址的全部商品頁
├── _redirects                 # Cloudflare Pages redirects
├── collections/
│   ├── all/index.html
│   ├── ss-tops/index.html
│   ├── aw-tops/index.html
│   └── bottoms/index.html
├── products/
│   ├── BD24021/index.html
│   ├── PL-002/index.html
│   └── ...
├── teamwear/index.html
├── assets/
│   ├── css/
│   └── js/
├── pages/                      # 舊網址 redirect stubs
└── references/
```

## 商品資料

商品來源快照位於 `data/products-source.json`。`scripts/build-site.mjs` 會從集中資料與共用 renderer 產生商品、商品分類、Teamwear、導覽、頁尾、選項與主要操作；`scripts/build-product-catalog.mjs` 保留為相容入口。產生檔帶有 do-not-edit 標記，請勿直接修改。每個商品都有穩定且唯一的 `productNumber`：

```js
{
  slug: "everyday-tee",
  productNumber: "ED14001",
  title: "PRDM Everyday Tee",
  category: "SS Tops",
  price: "NT$1,180",
  image: "assets/images/everyday-tee.webp",
  images: ["assets/images/everyday-tee.webp"],
  colors: [{ label: "Black", colorId: "black" }],
  sizes: ["M", "L", "XL"],
  variants: [{ sku: "...", color: "Black", size: "M", visible: true, soldOut: false }],
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
  shopeeUrl: "https://shopee.tw/..."
}
```

常用欄位：

- `productNumber`：網址與資料查找使用的商品編號，不含 `#`
- `title`、`category`、`price`：商品基本資料
- `image`、`images`、`media`、`alt`：商品圖片與替代文字；`media[].derivatives` 提供 540、1080、2160 短邊的 content-addressed WebP 與 `srcset` 資料；沒有真實圖片時 `image` 為 `null`、`images` 與 `media` 為空陣列
- `colors`、`sizes`、`variants`：款式與尺寸資料；`sku` 可以保留於資料但不顯示在網站
- `copy`：普通文字與空白段落依來源順序保留；空白段落以可選取的 `U+000A` 表示，單獨破折號只轉成單行水平線，已確認的矩形尺寸資料轉為無格線表格
- `shopeeUrl`：外部 Shopee 商品連結

商品同步與文案正規化規則詳見 `docs/product-sync.md`。

## 圖片與文案

商品圖片放在 `assets/images/`，優先使用尺寸合適且壓縮過的 WebP。若來源沒有圖片，保留既有真實商品照片；完全沒有照片時顯示空白媒體區，不使用替代插圖或提示標籤。例如：

```js
image: "assets/images/cosmos-hoodie-front.webp"
```

Teamwear 頁面位於 `teamwear/index.html`，可調整服務說明、流程、FAQ 與詢問連結。從該檔案引用共用圖片時使用 `../assets/...`。

Shopee、Instagram、Discord 等外部連結目前直接寫在各主要 HTML 頁面的 footer 或 CTA 中，可用以下指令查找：

```bash
rg "shopee|instagram|discord|https://" collections products teamwear
```

## 部署

正式環境採用 Cloudflare Pages；完整設定請見 `docs/cloudflare-pages-deployment.md`。

商品資料由 Google Sheet 的 `網站參照` 分頁定期同步；欄位規則、Google Docs 文案截取、圖片保留策略、修改時間追蹤與驗證流程請見 `docs/product-sync.md`。

```text
Production branch: main
Framework preset: None
Build command: 留空
Build output directory: / 或 .
Root directory: 留空
```

Repository：`https://github.com/lu-sugar-tiger/paradigm-website`

日常更新流程：修改 → 本機驗證 → commit → push 到 `main` → 確認 Cloudflare Pages deployment。

## 上線前檢查

- `/` 與 `/collections/all` 會顯示相同的全部商品內容，且 `/` 不會重新導向
- Collection、每個 Product 與 Teamwear 頁面都可正常開啟
- 網站內沒有導向 `index.html`、舊 `/pages/...` 或 query-string 商品網址的連結
- 手機與桌面寬度沒有水平捲動
- 行動導覽與 FAQ 可使用鍵盤操作
- 圖片沒有 404，瀏覽器 console 沒有錯誤
- Shopee 連結清楚表示使用者將離開本站
- 缺少商品圖片的媒體區保持空白，且沒有提示標籤

## 範圍限制

- 不加入購物車、結帳、會員、庫存同步或後端功能，除非另有明確決定。
- 商品資料維護在 `data/products-source.json`；顏色維護在 `data/colors.json`；Teamwear 選項維護在 `data/teamwear-options.json`。`assets/js/catalog.js` 與公開 HTML 都是產生檔。
- 未來可將既有 HTML/CSS 元件轉成 Shopify sections/snippets，目前不寫 Liquid 或 Shopify API。
