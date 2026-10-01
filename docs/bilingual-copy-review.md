# Paradigm bilingual copy review

**Copy decisions and implementation reference.** The user-facing language label is **中文**, meaning Taiwan Traditional Chinese (`zh-Hant`). English remains the baseline. The approved copy is connected to the existing region/language selector: 中文 · TWD, English · TWD, and English · USD. Teamwear **landing-page** editorial copy, FAQ, and landing photos are reserved for a later discussion.

## Agreed content boundaries

- Keep product names, color names, and product description bullet points identical in both versions.
- Keep product numbers, size names (M/L/XL), measurement values, and centimetres unchanged.
- The published product-description prose is already in Chinese. English prose for those descriptions is a separate future copy task; it is not drafted here.
- Keep proper names and official license names unchanged. Proposed translations below are editable.
- Use one shared English header, menu, breadcrumb path, and footer in both language versions for now. This includes collection labels in the menu and breadcrumb path, header controls, and footer copyright text.
- Keep `Teamwear` unchanged wherever it appears. Keep the Credits page content in English.
- Keep availability notification messages and Teamwear inquiry messages in English for now; translation of these messages is deferred.
- Translate Teamwear `Pattern` as **圖樣** for now. Alternatives under consideration: 設計、款式、圖騰.
- `Home`, `Road`, and the pattern names remain terminology decisions to confirm.

### How to record text that stays unchanged

**Shared text** means both languages use one canonical value, without a separately maintained Chinese translation. This applies to product names, color names, description bullet points, the English header/menu/breadcrumb/footer, `Teamwear`, and Credits content. Record these in the shared-English inventory rather than keeping obsolete Chinese proposals in active translation tables.

**Deferred translation** means keep the current English wording until we review its Chinese version. Availability notification messages and Teamwear inquiry messages belong here. Their visible action labels remain part of this review.

## 1. Shared English header, breadcrumb, and footer

These are shared English content for both language versions, not pending translations.

| Area | Shared English content |
| --- | --- |
| Main menu | Product, Teamwear |
| Menu collections / categories | SS Tops, AW Tops, Bottoms, Basketball |
| Breadcrumb paths and headings inside them | All, SS Tops, AW Tops, Bottoms, Teamwear, Search, product names |
| Header controls | Search and navigation open/close labels |
| Existing preference control | Region and language; 中文 · TWD, English · TWD, English · USD |
| Footer links | Instagram, Shopee, Credits |
| Footer company / copyright | Paradigm Co., Ltd.; Copyright © {year} All Rights Reserved. |
| Accessibility text belonging to these English regions | Keep the corresponding English navigation names and instructions, including Breadcrumb and footer “opens in a new tab” text |

Other page-body UI translations remain in the tables below. Reuse the shared English collection names when presenting navigation destinations, including Search page entries.

## 2. Catalog and product controls

| English baseline | Proposed 中文 | Notes |
| --- | --- | --- |
| Color | 顏色 | Group label; color names stay unchanged |
| Size | 尺寸 | Group label; M/L/XL stay unchanged |
| Buy on Shopee | Shopee 購買 | External action |
| Notify me | 貨到通知我 | Action for unavailable selection; notification request actually opens Instagram |
| Unavailable / unavailable | 暫無供應 | Visible, accessible, and status text |
| None | 無 | Empty add-on selection |
| {product name} images | {product name} 商品圖片 | Gallery name |
| {product name}, view {n} | {product name}，第 {n} 張圖片 | Generated image alt text |
| {product name} product image | {product name} 商品圖片 | First image alt text |
| Product image. Open enlarged image gallery. | 商品圖片。開啟放大圖片瀏覽。 | Gallery instruction; preserve product-specific alt text before the second sentence |
| {product name} images enlarged view | {product name} 商品圖片放大檢視 | Gallery dialog name |
| Row heading | 列標題 | Size table accessibility label |

### Availability notification text copied to Instagram

Translation deferred. Keep the complete current English notification message, including its field labels and availability request sentence. This does not defer the visible “Notify me” action label above.

## 3. Search

| English baseline | Proposed 中文 | Notes |
| --- | --- | --- |
| SEARCH PRDM.TW | 搜尋 PRDM.TW | Input placeholder |
| Search Paradigm | 搜尋 Paradigm | Input label |
| Search for {query} | 搜尋「{query}」 | Submit name |
| Suggested searches | 建議搜尋 | Result group |
| Pages | 頁面 | Result group |
| Products | 商品 | Result group |
| Search results | 搜尋結果 | Results section |
| Loading search… | 正在載入搜尋結果… | Loading state |
| Search is unavailable. Please try again. | 搜尋暫時無法使用，請再試一次。 | Error state |
| Search is unavailable. | 搜尋暫時無法使用。 | Screen-reader status |
| Search the product catalog. | 搜尋商品目錄。 | Empty Search page status |
| {n} product result(s) for {query}. | 「{query}」有 {n} 筆商品結果。 | Screen-reader status |
| {n} page results and {m} product results for {query}. | 「{query}」有 {n} 筆頁面結果和 {m} 筆商品結果。 | Screen-reader status |
| {n} suggested searches. | {n} 個建議搜尋詞。 | Screen-reader status |
| JavaScript is required to search the Paradigm catalog. | 搜尋 Paradigm 商品目錄需要啟用 JavaScript。 | No-JavaScript note |
| Search for “{query}” | 搜尋「{query}」 | Browser document title; visible breadcrumb heading stays English |

Header Search open/close controls and the Search breadcrumb heading use shared English. The remaining Search interface and result messages above are page-content translation proposals.

### Search page entries and discovery text

The page titles below are shown in Search. Summaries and keywords support ranking; proposed Chinese terms are for discoverability, not a separate product-name translation.

| Page | Proposed Chinese title | Proposed Chinese summary / search terms |
| --- | --- | --- |
| All Products | All Products | 瀏覽 Paradigm 全部商品與系列；全部商品、服飾、目錄 |
| SS Tops | SS Tops | 瀏覽 Paradigm 短袖上衣與足球球衣；短Ｔ、球衣、上衣 |
| AW Tops | AW Tops | 瀏覽 Paradigm 大學Ｔ與帽Ｔ；大學Ｔ、帽Ｔ、上衣 |
| Bottoms | Bottoms | 瀏覽 Paradigm 短褲；短褲、褲裝 |
| PE Basketball Teamwear | PE Basketball Teamwear | 認識 Paradigm 籃球 Teamwear；Teamwear、籃球、球衣 |
| Customize PE Basketball Teamwear | 訂製 PE Basketball Teamwear | 選擇圖樣、顏色、數量與加購項目；訂製、圖樣、數量、加購 |
| Instagram | Instagram | 追蹤 Paradigm 的 Instagram |
| Shopee | Shopee | 前往 Shopee 選購 Paradigm 商品 |

Popular English search terms such as `Teamwear`, `Everyday`, `Paradigm`, `Hoodie`, `Tee`, `Cotton`, `Mesh`, `Oversized`, and `Quick Dry` should remain searchable. Add Chinese synonyms such as `帽Ｔ`, `短Ｔ`, `棉`, `網眼`, `寬鬆`, and `快乾`; review the exact list with the final copy.

## 4. Teamwear customization only

| English baseline | Proposed 中文 | Notes |
| --- | --- | --- |
| Color | 顏色 | Color names remain unchanged |
| Pattern | 圖樣 | Current decision; considering 設計、款式、圖騰. `Essential`, `Classic`, `Signature` proposed to remain design names |
| Quantity | 數量 | Numeric ranges remain unchanged |
| Add-On | 加購 | Group name |
| Front Pockets on Shorts | 球褲前口袋 | Add-on name |
| Direct Message | Instagram 私訊 | Opens Instagram |
| PE Basketball Teamwear images | PE Basketball Teamwear 商品圖片 | Gallery label |
| {pattern} PE Basketball Teamwear in {color}, front and back | {pattern} PE Basketball Teamwear，{color}，正反面 | Generated image alt; names unchanged |

The three Teamwear description bullets and the model name stay unchanged. Proposed translation of the paragraph after those bullets:

> 在此選擇圖樣和 Road 顏色。Paradigm 將透過 Instagram 與你的團隊確認完整名單、圖稿、價格及製作時程。

### Teamwear inquiry text copied to Instagram

Translation deferred. Keep the complete current English inquiry message, including its field labels. This does not defer the customization interface labels above.

## 5. Size charts: English version to add

These chart values are transcribed from the 23 published product descriptions. The source uses stylized digits; ordinary digits below represent the **same values**. Each chart shows M / L / XL, and every value remains in **cm**. A chart is listed once where multiple products share the same dimensions.

When applying the English version, translate only the dimension labels using the abbreviations below. Preserve the existing table structure, row and column order, measurement values, digit styling, spacing, and cm unit. The Markdown tables here are review references, not a proposed table-format change.

| Current label | Proposed English label |
| --- | --- |
| 肩寬 | Shoulder W |
| 胸寬 | Chest W |
| 袖長 | Sleeve L |
| 衣長 | Body L |
| 褲頭寬 | Waist W |
| 褲腳寬 | Leg W |
| 內側長 | Inseam L |
| 外側長 | Outseam L |

### Chart A — ED14001, PD14007, AE14008, TL14009

| cm | M | L | XL |
| --- | ---: | ---: | ---: |
| Shoulder W | 50.0 | 53.0 | 54.5 |
| Chest W | 55.5 | 60.0 | 62.5 |
| Sleeve L | 25.5 | 26.5 | 28.5 |
| Body L | 72.0 | 74.0 | 78.0 |

### Chart B — PH14010, PH14011

| cm | M | L | XL |
| --- | ---: | ---: | ---: |
| Shoulder W | 53.0 | 54.5 | 56.0 |
| Chest W | 56.5 | 59.0 | 61.5 |
| Sleeve L | 23.5 | 24.5 | 25.5 |
| Body L | 71.0 | 73.0 | 75.0 |

### Chart C — ED14024, PD14025, AE14026, TL14027, BD14028

| cm | M | L | XL |
| --- | ---: | ---: | ---: |
| Shoulder W | 54.0 | 56.5 | 59.0 |
| Chest W | 55.5 | 58.0 | 60.5 |
| Sleeve L | 21.0 | 22.0 | 23.0 |
| Body L | 67.5 | 69.5 | 72.5 |

### Chart D — ED24014, PD24015, AE24017, TL24019, BT24020, BD24021

| cm | M | L | XL |
| --- | ---: | ---: | ---: |
| Shoulder W | 60.0 | 62.5 | 65.0 |
| Chest W | 63.0 | 65.5 | 68.0 |
| Sleeve L | 60.0 | 61.5 | 63.0 |
| Body L | 68.5 | 71.0 | 73.5 |

### Chart E — ED23002, PD23006, AE23016, TL23018

| cm | M | L | XL |
| --- | ---: | ---: | ---: |
| Shoulder W | 60.0 | 63.0 | 64.5 |
| Chest W | 66.0 | 71.0 | 73.5 |
| Sleeve L | 56.0 | 57.0 | 59.0 |
| Body L | 71.0 | 73.0 | 77.0 |

### Chart F — GM42022, GM42023

| cm | M | L | XL |
| --- | ---: | ---: | ---: |
| Waist W | 34.0 | 37.0 | 42.0 |
| Leg W | 33.0 | 34.5 | 37.0 |
| Inseam L | 13.5 | 14.5 | 15.5 |
| Outseam L | 37.5 | 39.0 | 40.5 |

### Size recommendations

The first pattern appears on all tops above; the second appears on the two shorts. Use the format **For Height < 173, Size M** and retain the tilde (`~`) for ranges. State **cm** once with the recommendation group; keep the same measurement values.

| Current Chinese | Proposed English |
| --- | --- |
| 建議身高 < 173 著用 M | For Height < 173, Size M |
| 建議身高 173~178 著用 L | For Height 173~178, Size L |
| 建議身高 > 178 著用 XL | For Height > 178, Size XL |
| 建議腰圍 < 80 著用 M | For Waist < 80, Size M |
| 建議腰圍 80~90 著用 L | For Waist 80~90, Size L |
| 建議腰圍 > 90 著用 XL | For Waist > 90, Size XL |

Here, **Waist** in recommendations means the person's waist circumference; **Waist W** in the chart means the garment's waist width. `W` means width and `L` means length.

## 6. Page titles, descriptions, and accessibility copy

Use the approved page-body copy in Chinese browser titles, meta descriptions, product controls, image alt text, gallery dialog names, and status announcements. Keep header, menu, visible breadcrumb paths, and footer in shared English. Proposed meta-description patterns:

| Page | Proposed 中文 meta description |
| --- | --- |
| Home / All | 瀏覽 Paradigm 全部商品與系列。 |
| SS Tops | 瀏覽 Paradigm 短袖上衣。 |
| AW Tops | 瀏覽 Paradigm 長袖上衣。 |
| Bottoms | 瀏覽 Paradigm 下身單品。 |
| Product detail | {product name}，由 Paradigm 呈現。 |
| Search | 搜尋 Paradigm 頁面與商品。 |
| Teamwear customize | 預覽 PE Basketball Teamwear 的三種圖樣與七種顏色，並查看正反面效果。 |
| Font credits | Keep the current English title and description with the Credits content. |

Some generated catalog and product pages currently declare `zh-Hant` even when the UI is mostly English. When language behavior is implemented, the English and Chinese versions should declare the language of their actual text. This is an implementation note, not a copy decision.

## 7. Accessibility translation scope

Routine invisible text, image alt text, and accessibility text are delegated to the implementation. Use conventional 中文 wording and follow the terminology and tone of the approved visible copy. These strings do not require individual user review. Ask the user only for a special case where the intended meaning is ambiguous or a choice would affect product or brand meaning.

- Translate functional instructions and status messages for the selected language: open/close controls, search loading/errors/results, selection availability, external-link behavior, and image enlargement instructions.
- Reuse approved visible labels for accessible names rather than drafting separate terminology. Keep shared product names, color names, `Product`, and `Teamwear` unchanged inside those sentences.
- Keep accessibility text belonging to the English header, menu, breadcrumb, and footer consistent with those English regions. Other page-body accessibility text follows the selected content language.
- Reuse the product-image templates in section 2 across products. Translate descriptive photograph alt text conventionally from the image content and approved visible wording; ask only when the intended meaning is unclear. Teamwear landing content remains deferred.
- Decorative images use empty alt text and need no translation. Text hidden from assistive technology also needs no translation unless it appears elsewhere to the user.
- English-only Credits content can retain its English language annotation when shown within the Chinese site.

The accessibility rows elsewhere in this document are implementation references, not pending copy decisions. Availability notification and inquiry messages remain deferred under their separate instructions.

## 8. Credits page

Keep the complete current Credits page content in English, including headings, font descriptions, attribution, license wording, and links. No Chinese version is required for this page under the current decision.

## Review points

1. `Pattern` currently means **圖樣**; consider 設計、款式、圖騰 during further review.
2. Confirm remaining vocabulary such as `Home`, `Road`, and pattern names.
3. Review the remaining proposed copy; user-revised chart labels and recommendation format are now recorded.
4. Availability notification and inquiry message translations are deferred.
5. Return to the Teamwear landing page copy in a separate discussion.

## Source map

- Approved Chinese copy: `data/localization.json`; shared English content is intentionally omitted from this translation registry.
- Localization generation and chart/recommendation labels: `scripts/lib/localization.mjs`.
- Runtime language changes: `assets/js/localization.js`, using the existing `paradigm:storefront-change` event and saved preference. Without JavaScript, the full English baseline remains available.
- Browser verification: `scripts/verify-localization-browser.mjs` checks language persistence, English shared regions, chart values, prices, selections, copied English messages, keyboard controls, and overflow at 320 / 390 / 768 / 1440 px.
- Shared navigation, controls, footer, and accessible text: `scripts/lib/site-renderers.mjs`
- Collection/product/Search/Teamwear page composition and metadata: `scripts/build-site.mjs`
- Search page terms: `data/search.json`, `assets/js/search.js`
- Product charts and recommendations: `data/products-source.json`
- Teamwear customization data and text: `data/teamwear-options.json`, `assets/js/teamwear.js`
- Availability text: `assets/js/choices.js`
- Font page: `scripts/templates/font-credits.html`
