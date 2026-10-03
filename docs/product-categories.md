# Product collections

Edit `data/product-categories.json` to configure retail collections. Collection membership uses only the imported `typeCode`. Product names and line codes never determine membership.

Display the plain collection titles without codes: `Tees`, `Crewnecks`, `Hoodies`, `Shorts`. Navigation, collection headings, browser titles, product category breadcrumbs, and search page titles reuse these labels. The current collection routes are listed below; former collection routes are compatibility redirects. Canonical product URLs and raw product data remain unchanged.

| Membership field | Code | Collection | Public route |
| --- | --- | --- | --- |
| `typeCode` | `14` | Tees | `/collections/tees` |
| `typeCode` | `23` | Crewnecks | `/collections/crewnecks` |
| `typeCode` | `24` | Hoodies | `/collections/hoodies` |
| `typeCode` | `42` | Shorts | `/collections/shorts` |

Type `14` includes both Tees and Football Jerseys. The registry order is the navigation order. The shared category module supplies navigation, product breadcrumbs, collection generation, catalog metadata, and collection search pages. Raw product data is preserved. Visible items with an unknown type code fail generation until that code is configured.

All four collections link back to `/collections/all` and retain descending numeric `sequence` order. The home page and `/collections/all` retain all visible items. Line collections are not published. Products retain their type-based category metadata and canonical product breadcrumbs.

The registry also owns compatibility redirects. The former SS Tops URL points to Tees, Bottoms points to Shorts, and AW Tops points to All because its items now span Crewnecks and Hoodies. Generation updates both static HTML redirects and the managed collection block in `_redirects`; other hosting redirects are retained. Search indexes only the current collection URLs.

After editing the registry, run `scripts/build-site.mjs`, `scripts/validate-product-categories.mjs`, and the shared navigation/search validators.
