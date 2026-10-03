# Paradigm design system

This document connects the Paradigm Figma file to the static website. The visual source of truth remains the supplied Figma frames and exported reference images. The implementation source of truth is `assets/css/tokens.css`.

## Foundations

The current Figma work uses a restrained editorial system. Base semantic color values come from **Variables → Paradigm → Color Styles**—not from the separate `material-theme` collection. Brand Low is a deliberate extension requested for future branded editorial work:

| Semantic role | High | Mid | Low | Website use |
| --- | --- | --- | --- | --- |
| Brand | `#a6192e` | — | `#ff808b` | Brand emphasis and the title-gradient stops |
| Background | `#ffffff` | `#f7f7f7` | `#efefef` | Document and full-width page-section layers |
| On Background | `#181818` | `#404040` | `#808080` | Content placed directly on a Background layer |
| Surface | `#ffffff` | `#f7f7f7` | `#efefef` | Cards, galleries, panels, and subdued controls |
| On Surface | `#181818` | `#404040` | `#808080` | Content placed on a Surface layer |
| Container | `#181818` | `#404040` | `#dfdfdf` | Filled actions, footer, and filled control states |
| On Container | `#ffffff` | `#ffffff` | `#808080` | Content placed on a Container layer |
| Outline | `#181818` | `#808080` | `#bfbfbf` | Focus, medium-emphasis boundaries, and low-emphasis 1px controls or separators |

- brand: base `#a6192e`, low `#ff808b`
- backgrounds and surfaces: high `#ffffff`, mid `#f7f7f7`, low `#efefef`
- content on backgrounds and surfaces: high `#181818`, mid `#404040`, low `#808080`
- outlines: high `#181818`, mid `#808080`, and low `#bfbfbf`
- containers: high `#181818`, mid `#404040`, low `#dfdfdf`; their content colors are white, white, and `#808080`
- product and Teamwear colorways reference current `{ id, code, name }` records and the complete code-to-Hex `palette` in `data/colors.json`; generated CSS resolves each named color through its stable item color code without page-local Hex copies
- descriptions recognize adjacent two-digit Unicode superscript color handles, such as `⁰³Charcoal`, and resolve only the name through the central registry; unnamed palette codes keep their source name. `ꟲ⁰³Charcoal`, whitespace-separated forms, unknown codes, and longer digit sequences are not handles and do not receive name substitution. Source Unicode characters remain exact; rendering uses ordinary characters inside shared `<sup>`/`<sub>` markup, including table cells and selected swatch labels. Text remains selectable; plain-text copying produces `03Charcoal`. Color codes identify selection, availability, and imagery independently of names.
- Figma's purple `#8a38f5` component-boundary color is a canvas/prototype aid and is never an interface token
- the visitor's browser/OS default `sans-serif` for all interface and brand text until a website font is licensed
- an 8px-centered spacing rhythm, with 4px for compact details and 2px for intentional catalog-grid gaps
- a Markdown-style text-role scale with one 4:3 line-height ratio: Small 10px, Body 12px, h6 12px, h5 14px, h4 16px, h3 20px, h2 24px, and h1 32px through Medium; at Large, h3 becomes 32px, h2 becomes 48px, and h1 becomes 64px
- square product controls and actions; rounded corners are reserved for Teamwear editorial cards and accordions
- choice availability and selection are independent states: available/unavailable plus selected/unselected; unavailable choices remain selectable and never need blank filler controls
- choice visuals follow one availability x selection matrix across swatches and chips: available/unselected uses no backing fill with Outline Low and regular Body text; available/selected uses no backing fill with Outline High and emphasized Body text; unavailable/unselected uses Container Low with no outline and regular On Container Low text; unavailable/selected uses Container Low with an On Container Low outline and emphasized On Container Low text. For swatches, the backing fill is the inset area behind the registered color block.
- each choice fieldset owns its label and option row as one grid with an 8px internal gap. Parent stacks space complete choice sections, including their labels, rather than relying on a legend margin that can sit outside normal section rhythm.

Figma variable names are mirrored in `assets/css/tokens.css` when the website has a defined use for them, with Brand Low documented as a deliberate extension. Shared components consume the semantic role names directly: Brand, Background, On Background, Surface, On Surface, Container, On Container, and Outline. Components reference outline roles directly instead of routing them through border aliases. Convenience aliases such as `--color-text` or `--color-action` are intentionally prohibited. Product colorways stay separate so a garment swatch cannot accidentally become an interface role.

The Brand Title gradient is `Brand → Brand Low → Brand` at 105°. It is a composed gradient token, not another semantic color role. Teamwear section titles apply it through `.teamwear-title--brand-gradient` while retaining a Brand fallback for forced-colors mode.

Text selection uses the visitor's native browser and operating-system colors. The website does not override `::selection` with a Brand tint.

Background roles are layered by responsibility: the document and page use `Background Mid`, elevated cards and galleries use `Surface High`, subdued controls use `Surface Low`, and catalog-grid gaps expose `Surface Mid`. Backgrounds belong to full-width page sections; `.container` constrains content without clipping the section color.

At Base and Medium, navigation is a full-viewport overlay beneath the header controls, with the language/currency dropdown below its navigation groups. At Large (64rem and above), the header uses equal side columns around a centered logo: Product and Teamwear on the left, Search followed by the Material Symbols `language` globe on the right, with no hamburger. The usable row remains `--header-bar-height` plus the top safe area.

Large navigation panels contain only subcollection links. Mouse hover previews a compact downward panel; clicking its parent follows the destination immediately. On touch, the first tap pins the panel open and the second follows the parent destination. Keyboard Enter follows the parent destination; Arrow Down/Up opens the panel and focuses its first/last child. Modified link clicks retain native browser behavior. Outside clicks, Escape, leaving the navigation with keyboard focus, opening another control, or changing breakpoints dismiss panels. These panels do not shift content, lock scrolling, or trap focus. Panels use Background High, H6/On Background Low children, relaxed paragraph spacing, and Space-5 padding; header parents use H5/On Background High. Search retains its full-screen overlay and exact Search/close coordinates. The single language/currency dropdown moves between the drawer and a Search-style full-screen configurator at Large so its preference stays synchronized.

`data/storefronts.json` defines exactly three combined preferences: 中文 / TWD, English / TWD, and English / USD. Both TWD preferences explicitly map to market `taiwan`; English / USD maps to `international`. Currency comes from that market, and language is explicit option metadata. The shared boxed select places language on the left and currency on the right, preserving label casing. It uses Body 12/16, Space-3 row padding, Space-5 label separation, and the existing choice-size, outline, and focus tokens. Keyboard navigation, selection, collision handling, and native-select fallback reuse `dropdown.js`. Preferences save as one validated `paradigm.storefrontPreference` value, with legacy Taiwan/International preferences migrated to English / TWD or English / USD. A first visit retains English / TWD until reliable country detection is available. The controller exposes `window.PARADIGM_STOREFRONT` and the existing `paradigm:storefront-change` event. Pricing follows the selected market; full copy translation and payment integration are separate work.

### Storefront pricing

The resting header globe uses `--icon-size-small` (20px) to balance its fuller Material Symbols artwork against Search. Both retain the shared weight, 24px control box, focus/hit-area behavior, and 24px close glyph.

The Google spreadsheet format and source-price fields remain unchanged. `pricing-core.js` supplies the shared Node/browser calculation and formatting. Effective retail price is `salePrice ?? listPrice`, including a genuine zero sale price. TWD displays as `NT$1,580`; USD displays as `$59`, with grouping and no decimals regardless of interface language.

For an effective TWD price P and a reference rate R in TWD per USD, the USD anchor is P × 1.10 ÷ R and the floor is P ÷ R. Choose the nearest candidate in the 9 + 10k sequence, resolving exact ties upward. This includes −1 as an internal candidate, not as a displayed price. If the candidate falls below the floor, choose the first 5-ending price strictly above the anchor. Exact decimal fractions prevent binary rounding from changing these boundary decisions. A genuine zero remains zero; nonzero small prices may resolve to $5. Displayed prices are non-negative.

For surcharges, sum all selected TWD adjustments first, including Teamwear quantity surcharges and add-ons. Price the effective base and this one surcharge group separately using the same reference and first-pass rules. If either priced group is zero, return their sum without a second ending pass. Otherwise use the sum of their integer USD prices as the final anchor, with no further markup or conversion. Choose nearest-9 again, using (base TWD + surcharge TWD) ÷ R as the final domestic floor and first upward-5 strictly above the USD sum if necessary. Teamwear displays only this final total and copies the same price into its inquiry. A paid option may leave the rounded USD total unchanged. Fixed and percentage discount policies are deferred; negative adjustments are rejected rather than treated as surcharges. Existing sale-price precedence remains unchanged.

Static content retains TWD without JavaScript. Generated price elements expose `data-price-twd`; `pricing.js` updates them on storefront changes without altering their original amount. A configured surcharge total additionally carries `data-price-base-twd` and `data-price-surcharge-twd`, preserving the calculation's two groups during switching. Search index schema 4 adds numeric `priceTwd`, and newly rendered results use the current preference. Catalog, related products, product details, both Teamwear pages, and inquiry text share this contract.

`data/pricing-reference.json` freezes the previous calendar month's official Central Bank geometric average of business-day closing rates. `pricing-config.js` is generated from that snapshot and the storefront configuration; its script URL uses a content hash. Browsers never request FX directly.

A monthly Codex reminder in this chat runs on the 3rd at 10:00 Asia/Taipei. It checks the previous calendar month's official rate, summarizes representative USD price changes, and reviews concrete pending issues or decisions. It asks for approval before changing the reference, updating prices, committing, or pushing. There is no scheduled GitHub PR workflow and no additional repository approval permission is required. `sync-pricing-reference.mjs --check` reports an available update without writing. After explicit approval, run the sync without `--check`, rebuild, validate, and publish through the existing main/Jekyll Pages process. The sync keeps the last valid rate while publication is delayed and fails without writing on network or malformed-data errors. A reviewed month remains frozen.

Run `node scripts/validate-pricing.mjs` for price boundaries, source bridges, calendar rollover, and API failure handling; follow with the generated-output check and responsive browser verification.

## Layout and spacing

The primitive spacing scale is shared across layout and components:

| Token | Value | Typical use |
| --- | ---: | --- |
| `--space-1` | 2px | Intentional catalog-grid gaps and product-rail seams |
| `--space-2` | 4px | Tight internal separation |
| `--space-3` | 8px | Compact component gaps and padding |
| `--space-4` | 12px | Small grouped-content separation |
| `--space-5` | 16px | Standard component and mobile spacing |
| `--space-6` | 24px | Large component and layout spacing |
| `--space-7` | 32px | Large stack and content-gutter spacing |
| `--space-8` | 48px | Standard section spacing |
| `--space-9` | 64px | Large section and editorial spacing |

The Teamwear landing shell overrides `--primary-action-floating-bottom-gap` to `--space-7` (32px) for its Large floating action. Below Large, the fixed full-width action remains flush with the viewport bottom; safe-area padding stays inside the button. Other pages retain the shared floating-gap default.

The primitive scale deliberately stops at 64px. Responsive layout consumes semantic roles so future adjustments can be made without finding every component:

| Semantic role | Base | Medium | Large |
| --- | ---: | ---: | ---: |
| Inline gutter | 16px | 32px | 32px |
| Tight section padding | 24px | 24px | 24px |
| Default section padding | 48px | 48px | 48px |
| Editorial / Teamwear section padding | 64px | 64px | 64px |
| Section heading to content | 48px | 48px | 48px |

The responsive system has three layout ranges. Base uses compact spacing and mobile-friendly composition. Medium keeps mobile-friendly composition with more spacious spacing. Large combines spacious spacing with desktop-friendly composition. Input behavior follows the actual touch, mouse, or keyboard interaction independently of width:

| Range | Viewport | Catalog | Product detail | Teamwear |
| --- | --- | --- | --- | --- |
| Base | Below 768px | 2 columns | Single column, gallery carousel, fixed purchase action | Mobile composition, 32px content gutter |
| Medium | 768–1023px | 3 columns | Single column, gallery carousel, fixed purchase action | Mobile composition, 64px content gutter |
| Large | 1024px and above | 3 columns | Three-column grid: inset stacked gallery spans 2, information spans 1; static action | Desktop headings, FAQ split, 64px content gutter |

Teamwear colorway rails and the customizer's separate variant image share each pattern's `mediaByColor` mapping in `data/teamwear-options.json`. The 21 supplied square uniform images cover three patterns by seven colors, with front and back views. Each has uncropped 540/1080/2160px WebP derivatives generated by the shared product-image pipeline. No runtime recoloring is used. Color codes are C01 Black, C11 Burgundy, C13 Cardinal, C21 Mocha, C41 Ivy, C61 Midnight, and C63 Royalty. Pattern/color changes update both `src` and `srcset`. See `assets/images/teamwear/rail/README.md` for uniform import instructions.

Supplied basketball photographs are centralized in `data/teamwear-photography.json`, including source records, responsive derivatives, alt text, team attribution, and placement. Four photos fill the existing highlights cards and three fill the athletes cards. The customizer shows all seven NTUESOE photos in their authored order, followed by its separate configurable uniform image in the horizontal gallery. These photos use the same shared image renderer and zoom behavior; no new layout or visual tokens are introduced. See `docs/teamwear-photography.md` for the source-to-placement mapping and import command.

The public Teamwear landing page omits the entire fabric section while it is under development, including the Construction eyebrow, Made for players title, feature copy, and fabric photograph. Colorways lead directly into the athletes gallery. Its markup, styles, and image are retained under `_archive/teamwear-fabric/`, excluded from GitHub Pages.

At Large, product-detail panels use a three-column grid. The stacked gallery occupies the first two grid columns, but its own box has a 32px margin on both sides so its visible edges follow the text inset marked in the reference. The panel is transparent so the page background shows beside the narrowed gallery, with no white surround. The information panel occupies the third column and has no left padding at Large: its content starts 32px after the gallery image. Both areas stretch to the same grid-row height. No fixed or content-specific height is imposed on the information panel. Related products begin 32px after the gallery-and-information panel.
Product-detail information uses 16px vertical padding at every range. Horizontal padding is 16px at Base and 32px at Medium; at Large, the right padding remains 32px while the left padding is removed to leave 32px between the gallery and information content. The Medium padding change does not alter its single-column carousel composition. Product Size uses the shared chip variation without a visual label while retaining its accessible legend. Product Header to Color uses 16px `--space-5`; the Color label retains the shared 8px `--space-3` internal gap; Color controls to Size controls use 24px `--space-6`; Size controls to description use 32px `--space-7` when the action is fixed. At Large, the static action uses the same 32px separation before the action and description.

Product Detail and Teamwear Customize use `renderProductDetail()` in `scripts/lib/site-renderers.mjs` for the complete gallery and summary structure. Their page templates supply `{{PRODUCT_DETAIL}}` and only own surrounding page sections. `assets/css/components.css` owns detail layout at every breakpoint, gallery presentation, choice styles, and rich descriptions; `pages.css` must not override those components. Description line height uses `--type-body-line-height` (16px).

The build adapters in `scripts/build-site.mjs` supply the shared renderer with media, choices, price, action, and description. Product data comes from `data/products-source.json`; Teamwear configuration and description come from `data/teamwear-options.json`, with supporting photographs from `data/teamwear-photography.json`. Both resolve swatch values through `data/colors.json`. Product options are Color and Size. Teamwear options are Color, Pattern, Quantity, and Add-On; Add-On uses the existing checkbox chip with its plus/check symbol. These groups all use `renderChoiceGroup()` and the keyboard, selection, and availability handling in `assets/js/choices.js`. Teamwear price and inquiry updates remain in `assets/js/teamwear.js`. `assets/js/app.js` owns general site interaction, not product-detail rendering.

Gallery presentation and inspection use the same shared structure and `assets/js/media-zoom.js`. Retail gallery images 1–9 and Teamwear supporting photographs keep their authored order. The selected variant image (retail image 0 or the Teamwear pattern/color image) occupies a separate outlined slot at the end of Base and Medium galleries. At Large, that slot is hidden on entry and appears first only after clicking a variant option, including one already selected; a retail variant catalog link selects controls without revealing it. Retail Color/Size and Teamwear Color/Pattern determine their respective variant images. Teamwear Quantity and Add-On do not reveal or change the image. Identical photos in the authored gallery and variant slot remain visible in both positions. Repeated option changes replace the variant slot without reordering photographs. Gallery browsing never changes options.

Base and Medium detail carousels use grab-and-drag browsing without previous/next buttons, matching the clean presentation of Teamwear landing card rails at those widths. Mouse users can grab an image, drag horizontally, and release to settle onto the nearest image; touch keeps native swipe. Browsing preserves selected options. No counter, extra control row, or custom carousel keyboard shortcuts are added. Native scrolling remains available without JavaScript. At Large, detail galleries remain stacked and Teamwear landing rails retain their existing previous/next buttons. Reduced motion uses instant drag settling. Touch inspection uses the same temporary in-place pinch at every width; only mouse clicks and keyboard activation open the enlarged gallery at Large, including when the device also supports touch.

`--layout-canvas-width` is `90rem` (1440px) and is available for designated visual-canvas modules; the Teamwear hero currently spans the viewport without this cap. `--content-width` is `60rem` (960px) through Medium and changes to `80rem` (1280px) at Large. The 1280px value is the centered shared reference region rather than the final readable width. Base viewports remain naturally limited by their viewport and container gutters. `--content-narrow: 58rem` (928px) and `.container--narrow` are defined but currently unused. The exact 928px value is project-specific rather than a required industry convention.

`.container` is active throughout headers, footers, catalogs, product pages, and Teamwear. `.reference-page` is also active on all current public page templates; it deliberately lets selected catalog and product structures reach the viewport edges until the responsive 960px / 1280px maximum. Do not remove either as unused legacy. Shared header and footer content apply `--layout-shell-gutter-inline` inside the centered reference region, producing 1216px of inner content at Large. Teamwear main containers use the same nested model with their independent `--space-7` Base and `--space-9` Medium/Large gutters, producing 1152px of inner content once the reference region reaches 1280px.

Teamwear rails remain tied to the physical layout viewport rather than a visual-canvas cap. Each rail viewport is an inline-size query container so its initial scroll padding can combine the actual centered reference-region offset with the Teamwear inner gutter, including the stable browser scrollbar gutter. The trailing padding adds one rail gap so every directional-button move can reach a complete card-plus-gap snap position without a shorter clamped final step. The first card therefore aligns exactly with ordinary section content. The floating action continues to use the separately defined page edge. Rails use mandatory start-edge snap scrolling, and button navigation targets indexed snap positions rather than scrolling relative to a potentially intermediate position. Their gap is one spacing level below the Teamwear content gutter: `--space-6` at Base and `--space-8` from Medium upward. Base cards equal the inner content-region width minus one rail gap. Medium and Large cards equal `(reference container - 2 content gutters + 1 outer margin - 2 rail gaps) / 2`; the one-sided outer margin is zero until the layout viewport exceeds the capped reference container. The Next control still disappears as soon as the final card is fully visible, including the two-card Medium and Large composition. Only the photo media surface uses `grab` and `grabbing` cursors; rail gaps and card copy retain their normal cursor. Teamwear motion uses the shared structural motion roles below; component dimensions such as 40px and 48px controls use size roles rather than spacing tokens. Radius roles describe shape only and must never be used as gaps or padding.

The unused generic `.split` recipe, `.spec-list`, `.spec-card`, and the old 1px grid gaps have been removed. Active catalog seams are true `--space-1` (2px) grid gaps exposing `Surface Mid`; they are not outlines. Active 1px borders reference Outline Low directly rather than using a border alias.

## Interaction and motion

Interaction targets must not change established layout geometry. Use an out-of-flow 48×48px `--control-size-large` hit region only when the surrounding space can contain it without covering another control; otherwise preserve the component's intrinsic box and crop the hit region at the neighboring control's boundary. The header keeps 24px glyph boxes separated by `--space-5` (16px). Search preserves its full left reach and crops only its right edge by the tokenized 4px amount where it meets Menu, producing a 44×48px target; Menu crops only its left edge by the same amount, also producing 44×48px. The logo anchor retains the visible logo's intrinsic width and uses auto margin for header distribution, so empty header space does not become an oversized Home target. Breadcrumbs remain a single line and clip horizontally at the headline's content boundary with `overflow-x: clip`. The row's existing `--layout-shell-gutter-inline` provides equal left and right gutters; breadcrumbs do not extend into either gutter. Ancestor links and current-page text receive the same clipping, with no scrolling, ellipsis, wrapping, or overflow controls. Expanded link targets are clipped at that same boundary, and focusing an overflowing link does not scroll the breadcrumb. The 48px Search frame, intrinsic navigation and footer rows, and boxed buttons and choices retain their existing sizing contracts.

Hover and press are one shared visual contract. Do not gate hover styling behind `hover`, `any-hover`, `pointer`, or `any-pointer` capability media queries. Every hover treatment must also apply through `:active` so touch and pointer input receive the same feedback while the control is pressed. The press state is momentary and returns to rest on release; do not add JavaScript to persist a hover-equivalent state after a tap.

Keyboard focus remains independent and visible through `:focus-visible`. When the hover treatment also helps keyboard wayfinding, include `:focus-visible` in the same selector without replacing the component's focus ring.

The logo is an explicitly pointer-only Home shortcut: its anchor has `tabindex="-1"` and no focus treatment. Hover and press vary its artwork through the shared transparency treatment (100% at rest, 85% on hover/press), revealing the header surface while preserving transparency, dimensions, and the supplied image.

Visited links have no distinct appearance. Shared anchor and component colors apply equally before and after a visit; do not introduce a `:visited` color, underline, or history indicator.

Search feedback is deferred. Run `node scripts/preview-feedback.mjs` to generate the local comparison at `/output/playwright/feedback-experiment/` for later review. Loading, empty, and error outcomes are simulated; suggestions do not change production Search behavior. Additional availability explanations and copy confirmations were declined; retain the existing chips, Notify me action, and copy behavior without additional visible feedback.

The shared focus ring uses `--focus-ring-width: 1px` and `--focus-ring-offset: 1px`. A keyboard-accessible Skip to content link appears before the header and targets the main landmark. Search and navigation start inert, become interactive only while open, and return to inert before closing; Tab stays within the active overlay and its header toggle. Navigation reserves `aria-current="page"` for a link whose destination is the current page. `data-current-section="true"` marks ancestor sections on subcollection, product-detail, and Teamwear Customize routes without claiming they are the current page. Desktop and drawer navigation follow breadcrumb links: only the label underlines on hover, momentary press, and keyboard focus, with the focus ring remaining independent. Current and ancestor markers have no visual treatment, and expansion alone adds no persistent underline. The current breadcrumb item remains non-clickable text or a heading.

An applicable state may deliberately share the resting appearance. Large product browsing cards keep rest, hover, and press visually identical because the catalog can fill the viewport and scrolling or pointer movement would repeatedly trigger decorative effects. Their keyboard focus remains visible. Selection and current-page states apply only where a persistent choice or destination exists. Product swatches and chips retain their approved designs. External-link arrows supplement the base component's feedback.

### State variation

`assets/css/state-variation.css` owns one hover/press family with four controlled treatments: **screen**, **multiply**, **opacity**, and **transparency**. Screen and multiply retain `--state-variation-strength: 6.27451%` (equivalent to #101010 screen / #EFEFEF multiply); the shared low endpoint is `--state-variation-opacity: 85%`, a 15 percentage-point variation. **Opacity** increases alpha from 85% at rest to 100% on hover/press; **transparency** decreases alpha from 100% at rest to 85% on hover/press. Static semantic colors remain in the component styles. Hover and momentary press share one treatment without amplification, scaling, or geometry changes. Disabled controls receive no variation. Focus rings remain independent and opaque; the logo remains the explicit exception with no keyboard focus treatment.

Choose screen for dark filled buttons and multiply for light filled buttons. Standalone logo/icon artwork and outlined action artwork use transparency because a neutral color mix has little visible effect on narrow strokes. Image actions also use transparency because the artwork can contain both light and dark colors. Opacity changes the resting appearance and is reserved for the previous/next card rail arrows. Keep these mappings centralized rather than selecting effects independently on each page.

The component collection and default treatments are grouped at the top of `state-variation.css`. For artwork, set `--state-variation-filter` to the corresponding `--state-*-filter` recipe. For filled controls, set `--state-variation-fill` to the corresponding `--state-*-fill` recipe. Opacity mode also sets the resting filter/fill to `--state-alpha-filter` / `--state-alpha-fill`; other modes keep the opaque resting recipes. An individual instance can override its default with `data-state-variation="screen|multiply|opacity|transparency"`. Apply that attribute to the actual control, not its surrounding section. An image or outlined action can opt in with `data-state-variation="transparency"` on its semantic link/button and `data-state-variation-artwork` on the image or artwork layer. Do not put the artwork marker on a wrapper containing a label or focus ring. Both alpha modes affect only the artwork or backing fill; they never fade the entire control, label, or focus ring. CSS whole-element opacity would composite the text and fill together before blending with the page; setting translucent text and fill independently instead causes two separate blends. The fill-only design leaves button text fully opaque.

Image variation is an explicit action treatment, not a rule for all images. Catalog cards retain no hover/press decoration; gallery and rail photographs used for dragging or inspection retain their appearance. Non-interactive editorial images receive no state treatment. There are currently no separate published outlined buttons or image actions to opt in; the local preview demonstrates the shared artwork path without changing browsing media.

| Component collection | Current default | Opacity reveals | Public usage |
| --- | --- | --- | --- |
| Logo (`.site-logo`) | Transparency 100% → 85% | White header | Every page |
| Standalone icons (`.icon-button`) | Transparency 100% → 85% | White header, Search field, or gallery controls row | Search, region/language, menu/close, Search submit, and Base/Medium gallery previous/next |
| Headline icon (`.page-headline__action--icon`) | Transparency 100% → 85% | Surface Mid headline | Reusable 24px trailing icon in a breadcrumb/headline bar; no published instance |
| Explicit image/outlined action (`[data-state-variation]` + `[data-state-variation-artwork]`) | Transparency 100% → 85% | The control's containing surface | Opt-in artwork path; local preview only, no published instance |
| Filled action (`.button`) | Screen | Underlying page or, for fixed/floating actions, the current content beneath | Build yours, Direct Message, Buy on Shopee, Notify me, and Skip to content |
| Dark secondary (`.button--secondary`) | Screen | Its containing surface | Reusable variant; no published instance |
| Light secondary (`.reference-page--detail .button--secondary`) | Multiply | Surface Mid product summary, often the same color as its fill | Reusable pale rectangle with dark text; no published instance |
| Rail circle (`.teamwear-rail-button`) | Opacity 85% → 100% | The photograph or rail/page area beneath the circle | Teamwear rails; preserve the transparent chevron cutout |

Run `node scripts/preview-state-variation.mjs` for the local collection at `/output/playwright/state-variation/`. Each row switches the actual shared component between all four treatments; the overrides remain local to the preview. Reusable variants with no published instances are explicitly identified. Text links remain a separate underline family; chips, swatches, product cards, and current/ancestor/visited rules keep their approved treatments. External-link arrows remain an additional indicator.

Teamwear rail arrow buttons intentionally keep their clear 32px circular target. Their chevrons are transparent cutouts in the button surface so the underlying photograph remains visible; they are not intended to become solid Material Symbol glyphs or 48px controls.

Structural motion combines Apple-style spatial continuity with Material 3's explicit web transition values. Entering content uses `--motion-duration-enter` (400ms) with `--motion-ease-enter` (`cubic-bezier(.05, .7, .1, 1)`); exiting content uses `--motion-duration-exit` (200ms) with `--motion-ease-exit` (`cubic-bezier(.3, 0, .8, .15)`). Utility transitions use `--motion-duration-standard` (300ms) and `--motion-ease-emphasized` (`cubic-bezier(.2, 0, 0, 1)`), while compact surface entrances use 250ms with `cubic-bezier(0, 0, 0, 1)`. Sequential content uses the 40ms `--motion-stagger-short` role. Future gesture springs default to response 350ms and damping ratio 1; damping .8 is reserved for real momentum gestures and is not synthesized for native scrolling.

Cross-document page motion is progressive enhancement. The parser-blocking route controller follows the shared stylesheets in the head and precedes deferred interactions: its media query must not flush styles before the view-transition opt-in is parsed. Transition promise cancellation is handled and temporary state clears after completion or cancellation. Catalog routes form the hierarchy All (depth 0), subcollections and Search (depth 1), then product detail (depth 2). Teamwear forms Landing (depth 0) then Customize (depth 1). Moving deeper enters from inline-end while the previous page recedes 24% toward inline-start; moving upward reverses the same path. Same-depth, cross-family, and unknown routes fade through. `/` and `/collections/all` are equivalent and do not animate between each other. Navigation from an open Search or menu overlay fades through instead of inheriting the covered page's direction. Direct loads, reloads, external navigation, unsupported browsers, and native browser navigation gestures remain native.

The early controller also sets `data-site-enhanced` before content paints. The shared detail renderer declares thumbnail-capable panels in HTML, and enhanced gallery geometry is gated by that root marker. This reserves the final Large gallery column immediately while retaining the original gallery without JavaScript. Thumbnail synchronization batches geometry reads, runs at most once per animation frame, and leaves unchanged nodes and attributes alone; hidden Base and Medium thumbnails need no synchronization. The search footer remains visually hidden while results are busy, then appears at its final position when loading completes or fails. These startup treatments preserve the settled design and document height.

Search and navigation share one overlay state contract: `closed`, `opening`, `open`, and `closing`. The background reveals downward from the top using clipping plus opacity. The active resting Search or menu glyph does not animate: it remains fixed beneath a non-interactive overlay-colored cover, while only that control's Material close symbol follows after 40ms. The Search field or first navigation group follows at 80ms, and later groups follow in 40ms steps. Closing reverses and compresses the sequence into no more than 280ms; the cover remains until closing completes, then reveals the unchanged resting glyph. The controller must remain interruptible, retain focus containment and restoration, and never delay destination navigation. Search results sequence only on the first completed render of each open cycle, not after each keystroke. The root viewport keeps its stable scrollbar gutter while an overlay locks page scrolling, so the underlying content and fixed header never resize. Each full-viewport overlay uses 100vw and reserves its own gutter in the same viewport track; the header does not add a second gutter. This keeps overlay content aligned without changing background card widths, document height, or scroll position during opening, closing, or reversals. Overlays use `overflow-y: auto`; never force overflow, synthesize extra content height, or calculate scrollbar compensation in JavaScript.

Teamwear rail entrances consume the shared short stagger token. Photos keep a fixed crop. The copy reading zone spans all complete presentation slots, derived from the viewport, initial content edge, card width, and gap. Every card in that zone stays opaque and aligned, including the card moving between two desktop positions. Outside the zone, text fades and translates toward its respective edge. `--rail-copy-enter-range` and `--rail-copy-exit-range` are card-width fractions (0.5 each); the spatial curves alias shared exit and enter curves respectively. `--rail-copy-offset` uses `--space-7` at base width and `--space-9` from medium upward, one spacing level above the rail gap. The spatial ranges and 700ms settling duration remain unchanged; the increased offset affects text displacement, not rail timing. Opacity and translation are independently mapped from position, with no timed copy fade or half-visible threshold. Card overflow is visible so translated copy can cross the photo boundary; photo wrappers retain their own clipping and the rail scrollport clips at viewport edges. Existing trailing padding must remain at least as large as the maximum copy offset so translated copy cannot extend the scroll range. Reduced motion leaves all copy opaque and removes translation. Arrow and mouse-release settling use `--rail-settle-duration` (shared medium/700ms) and `--rail-settle-ease` (editorial), and cancel on pointer, wheel, keyboard, resize, or preference changes. Mouse dragging starts on photos; native touch scrolling and snapping remain browser-controlled rather than duration-token-controlled. These settings are a project adaptation of the Apple reference, not Apple's measured constants.

The Large Teamwear `fixed-to-float` primary action uses one shared `entering → floating → exiting → inline` state path. When its inline mount passes above the viewport, the fixed action enters from 12px toward block-end with opacity over the 400ms enter role. Returning to the inline mount reverses that path over the 200ms exit role before fixed positioning is removed. A scroll-direction reversal retargets from the current rendered opacity and translation rather than waiting for completion. Base and Medium retain their existing fixed full-width action, and reduced motion settles either position immediately. The action never scales, bounces, docks into the footer, or delays activation.

The menu region dropdown joins the navigation sequence: Product enters at 80ms, Teamwear at 120ms, and the region control at 160ms, each using the shared 400ms fade and 12px travel. Closing reverses the order: region at 0ms, Teamwear at 40ms, Product at 80ms, using the shared 200ms exit. Dropdown selection and keyboard behavior remain unchanged.

`prefers-reduced-motion: reduce` disables page sliding, overlay sequencing, Teamwear entrances, card staggering, and rail parallax. Content must render immediately and remain operable; motion is never the only state indicator.

Automatic scaling and zooming are prohibited in production design. Do not use the CSS `scale()` transform or `scale` property for hover, active, entrance, exit, image, or decorative effects. Tokenized translation and opacity motion remain available when they clarify state or spatial continuity, and reduced-motion behavior must remain intact. If a scale-only effect is removed, do not invent a replacement unless the component needs feedback for an actual interaction.

Direct product-media inspection is the sole scaling exception. Only populated product or photo media explicitly marked with `data-media-zoom-touch` may start the shared two-finger pinch gesture; an empty or unmarked element is ineligible even if it is inside a supported page. The gesture creates a temporary fixed copy, hides the in-flow photo for the life of the gesture, follows the live midpoint from the point that was grabbed, ranges from 1× through 4×, hands movement to the remaining finger, and disappears when the final finger lifts or the gesture is cancelled. The shared active-source treatment keeps the source geometry in place, makes its backing media layer transparent, and hides only the in-flow image content. When a separate immediate backing layer must also clear, mark that layer with `data-media-zoom-surface`; the shared controller toggles it without page-specific active-state CSS. The floating copy retains its normal photo surface. One-finger taps, navigation, vertical scrolling, gallery swiping, and Teamwear rail swiping remain native. Outside an eligible opt-in, the module never cancels touch events or starts custom pinch inspection; native browser accessibility zoom remains untouched. The temporary copy changes its measured width, height, and translated position through `requestAnimationFrame`; it never uses a CSS scale transform or scaling transition. Do not opt non-product editorial imagery, hero imagery, fabric macros, page decoration, or empty media into this contract.

Retail product-detail and Teamwear Customize galleries additionally use `data-media-zoom-gallery` at Large. A mouse click, Enter, or Space opens the source-ordered gallery in an accessible full-viewport dialog: one gapless column at twice the measured gallery width, centered horizontally, and vertically aligned to the chosen image. Touch taps keep the normal gallery available for in-place pinch inspection. A stationary click anywhere, Escape, or leaving the Large breakpoint closes the dialog and restores focus and document scrolling. Large pointer hover does not create a magnifier or any other automatic zoom surface. Hero imagery, fabric macros, non-product Search results, and non-media decoration never inherit this exception.

## Typography

Visual H1–H3 roles display uppercase through `--type-heading-transform: uppercase` and CSS `text-transform`, preserving the original source copy. Inline emphasis follows the heading casing. H4–H6 and product-detail H5 overrides retain their original case; breadcrumbs retain their separate interface-label casing. Negra, 90% horizontal width, and −50 tracking are unchanged.

The website loads the Google Fonts Roboto variable family at the Semi Condensed width (`wdth 87.5`) across its complete Thin through Black range (`wght 100..900`). `renderDocument()` owns the preconnects and shared stylesheet request, uses `display=swap`, and places the font resource before local CSS. `--font-latin` resolves to Roboto and `--font-sans` composes the standard text stack. Roboto's proposed minus-100 weight remapping is deferred; existing weight values remain unchanged. The former Brand typography role was removed because the active logo is an image and no interface component consumed it.

Visual H1–H3 roles use `--font-heading`: Reforma1969, followed by `--font-sans`. `assets/css/fonts.css` declares only the original self-hosted upright Negra 700 WOFF2 (31,220 bytes) with `font-display: swap`. Both default titles (semantic weight request 550) and Strong titles (700) select Negra 700, the sole available Reforma face; there is no interpolation. CJK and failed-font fallbacks follow the same 550 role request. Gris, Blanca, and italic files are not shipped. Fonts load on demand, with no blanket preload on catalog/search pages whose headings use smaller roles.

H1–H3 display treatment uses `--type-heading-width-scale: 0.9` and `--type-heading-tracking: -0.05em` (design-tool tracking −50, or −50/1000 em). Reforma is static, so `scale: 0.9 1` compresses the rendered heading horizontally without editing its font file or changing its height. Tracking participates in line wrapping before scaling; the CSS line box and existing line-height are retained. The default transform origin is left center; the centered Teamwear hero overrides the origin to center. This treatment applies to the whole heading, including inline Strong and any fallback glyphs, and does not animate. Explicit smaller roles, Body breadcrumbs, and H5 product-detail title overrides reset scale and tracking. No custom kerning or text feature overrides are applied: `font-kerning` remains browser-default `auto`.

Family selection follows visual roles, not HTML heading levels: an unclassed semantic h1 uses the H3 font and scale; `.type-h1`–`.type-h3` use Reforma, while `.type-h4`–`.type-h6`, `.type-body`, and `.type-small` explicitly restore Roboto. The product-detail header overrides semantic h1 to the H5 visual role and therefore retains Roboto, as do catalog product-card names and breadcrumb headings. The shared footer links to `/font-credits/`, which carries the required Reforma attribution, source and CC BY-ND 4.0 links, and the original license/disclaimer at `/assets/fonts/reforma/LICENSE.txt`. Keep the supplied font binaries unchanged.

Traditional Chinese remains on the local `--font-cjk` stack: PingFang TC, Noto Sans CJK TC, Noto Sans TC, Source Han Sans TC, Microsoft JhengHei, then the generic sans-serif fallback. The Android-oriented Noto families and Source Han Sans TC are checked before the Windows-specific Microsoft JhengHei face. 阿里巴巴普惠體TC is intentionally deferred and must not be requested or bundled. Do not set `font-stretch` globally: the Google stylesheet supplies Roboto's 87.5% face, while CJK fallback faces retain their native width. Type is defined by semantic roles rather than by page:

| Role | Base / Medium size and line height | Large size and line height | Default weight | Token prefix |
| --- | --- | --- | --- | --- |
| Small | 10px / 13.333px | unchanged | Regular 400 | `--type-small-*` |
| Body | 12px / 16px | unchanged | Regular 400 | `--type-body-*` |
| h6 | 12px / 16px | unchanged | 550 | `--type-h6-*` |
| h5 | 14px / 18.667px | unchanged | 550 | `--type-h5-*` |
| h4 | 16px / 21.333px | unchanged | 550 | `--type-h4-*` |
| h3 | 20px / 26.667px | 32px / 42.667px | 550 | `--type-h3-*` |
| h2 | 24px / 32px | 48px / 64px | 550 | `--type-h2-*` |
| h1 | 32px / 42.667px | 64px / 85.333px | 550 | `--type-h1-*` |

Each role has `size`, `line-height`, and `weight` tokens. `.type-h1` through `.type-h6` apply the complete visual roles independently from the semantic document outline. The previous h1–h5 roles shifted intact to h2–h6, making room for the 32px Base and Medium h1. Existing semantic headings and explicit Teamwear role classes were remapped to those shifted roles. At the shared 64rem Large breakpoint, only h1, h2, and h3 change to 64px, 48px, and 32px respectively; their line heights retain the 4:3 ratio. `body` supplies the Body role, `.type-body` reapplies it explicitly, and `small` and `.type-small` consume the complete Small role. Drawer navigation remains a component-specific role.

Legacy `--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`, and `--text-hero` tokens are removed. Components consume the semantic roles directly; every breadcrumb uses the complete Body role.
Catalog product names use the complete h6 role: 12px size, 16px line height, and 550 weight.
Catalog product names and prices use the 4px `--space-2` box-to-box gap. The card-body minimum height is derived from both 16px line roles, that gap, and the 8px bottom padding so flex distribution cannot enlarge the rendered gap.

Font weight is a separate semantic axis. All nine CSS weight values are available as tokens even when a weight is not currently used:

| Weight role | Value | Token |
| --- | ---: | --- |
| Thin | 100 | `--font-weight-thin` |
| Extra Light | 200 | `--font-weight-extra-light` |
| Light | 300 | `--font-weight-light` |
| Regular | 400 | `--font-weight-regular` |
| Medium | 500 | `--font-weight-medium` |
| Semi Bold | 600 | `--font-weight-semi-bold` |
| Bold | 700 | `--font-weight-bold` |
| Extra Bold | 800 | `--font-weight-extra-bold` |
| Black | 900 | `--font-weight-black` |

Do not place numeric font weights in component CSS. Each weighted text context declares its semantic `--font-weight-base` and consumes that value, allowing inline modifiers to respond to the surrounding role.

Style modifiers remain independent from whole-text roles:

| Modifier | Behavior | Website contract |
| --- | --- | --- |
| Normal | Uses the surrounding role's base weight and normal style | Default text behavior |
| Italic | Changes only `font-style` to Italic | `<em>` or `.text-italic` |
| Strong | Adds 150 to the surrounding semantic base weight, capped at Black 900 | `<strong>` or `.text-strong` |
| Weak | Subtracts the same `--font-weight-strong-offset: 150` from the surrounding semantic base weight, floored at Thin 100 | `.text-weak` on an inline element such as `<span>` |
| Superscript | Inherits family, weight, style, and color; relative size with raised baseline | `<sup>`; `--type-script-size: 0.75em`, `--type-sup-offset: -0.5em` |
| Subscript | Inherits family, weight, style, and color; relative size with lowered baseline | `<sub>`; `--type-script-size: 0.75em`, `--type-sub-offset: 0.25em` |

Superscript and subscript are inline modifiers, not the Small role. Their zero inline line-height and relative positioning preserve the surrounding line box and paragraph spacing; offsets are relative to the script's own font size. `assets/js/inline-type.js` owns the explicit Unicode mapping and escaped static rendering, ordinary-text conversion, and safe DOM-node updates for language and selection changes. Supported characters are superscript/subscript digits, operators and parentheses, superscript Latin modifier letters, and the available subscript Latin letters listed in that module. Consecutive characters of the same kind form one run. Unlisted characters (including `ꟲ`) remain literal; there is no whole-string normalization or raw-HTML interpretation. Google Docs authors write Unicode notation such as `m²` and `H₂O`, not native text formatting or HTML tags. Source data is unchanged, while rendered/copy text becomes `m2` and `H2O`.

Examples: Body and Small 400 become Strong 550, heading 550 becomes 700, Bold 700 becomes 850, and Extra Bold 800 is capped at Black 900.

Weak uses that same offset in reverse: Body and Small 400 become 250, heading 550 becomes 400, and a Bold 700 role becomes 550. Weights at or below 250 stop at Thin 100. Weak changes only weight; family, size, style, color, line height, and paragraph rhythm remain inherited. It is opt-in and is not applied to existing content by default. Like Strong, it resolves from the surrounding role's `--font-weight-base`; nesting modifiers does not cumulatively add or subtract weight. There is no native HTML Weak element and no separate Weak offset token.

State-driven emphasis must use the same Strong calculation instead of replacing a component's base role. Selected chips therefore remain Body text and resolve from 400 to Strong Body 550. Unselected chips remain Body 400. Primary and secondary buttons are not state-emphasis variations; they use the complete h5 role, including its default 550 weight.

Component roles own their default weights just like the Markdown-style roles; components must not assign a standalone weight in place of their role. Body content that explicitly resets native browser emphasis, including rich-description table headings, uses `--type-body-weight` rather than a raw Regular token. Extra Bold 800 remains available in the complete primitive weight scale even though no current role consumes it.

Paragraph spacing is also a typography decision. Relative values are calculated from the consuming text role's own font size:

| Paragraph rhythm | Value | Token | Use |
| --- | ---: | --- | --- |
| Default | 0 | `--type-paragraph-spacing-default` | Reset and layouts where the parent owns vertical rhythm |
| Compact | 0 | `--type-paragraph-spacing-compact` | Dense text groups that still need a distinct semantic role |
| Standard | 1/3 × text-role size (`0.333333em`) | `--type-paragraph-spacing-standard` | Product-description lines and short component copy |
| Relaxed | 1 × text-role size (`1em`) | `--type-paragraph-spacing-relaxed` | Editorial or long-form copy when the composition calls for more air |

Use either a paragraph margin or a parent layout gap to create the same intended rhythm, never both. The shared rich-description renderer uses Body 12px with Standard spacing, so its effective value remains exactly 4px while preserving source blank lines. Product Detail and Teamwear Customize both receive this markup exclusively through `renderDescription()`; authored templates contain only renderer placeholders. Divider and hashtag tokens use On Surface Low while ordinary text remains On Surface High. Inline product-code links also use On Surface Low, matching the ending hashtag, and underline on hover, momentary press, and keyboard focus. References to the current product remain plain text, including its ending hashtag; no link or interactive state is added to them.

## Iconography

Interface icons use the outlined Google Material Symbols font. `renderIcon()` owns the semantic icon-name map, and each generated page requests only that mapped subset from Google Fonts with `opsz 24`, a `wght` range of 100–700 that contains every active interface-icon weight, `FILL 0`, and `GRAD 0`. The global CSS configuration fixes grade through `--material-icon-grade` and derives every symbol weight from its owning semantic text role through `--material-icon-weight-offset: 100`: icon weight equals text weight minus 100. Body 400 controls and arrows use icon weight 300; H5/H6 550 controls and arrows use 450; the selected Add-On label moves to Strong Body 550 while its `check` uses 450. Standalone header and rail controls inherit Body 400 and therefore use icon weight 300. Ligature names must retain `text-transform: none`.

When a Material Symbol should appear visually equal in prominence to adjacent Body text, use the established `20px / 12px` ratio: `--icon-size-small` over `--type-body-size`, or `5:3` (`1.666667×`). This is an optical relationship rather than a universal geometric rule. Directional indicators such as the external-link arrow instead match the label's font size at `1em`, remain separated by `--space-1` (2px), and are vertically centered without entering the label's layout width.

## Consistency status

The system is partially consistent, not yet project-wide:

- All active pages load the same foundation stack in the same order: local font faces, tokens, motion, reset, base, layout, components, pages, and color options. Teamwear adds its two scoped stylesheets after that stack.
- The shared storefront shell uses the Figma-derived semantic color roles directly, the default sans-serif family, common layout variables, full-viewport navigation, and reusable component classes.
- Shared storefront color usage is strict: literal colors and undeclared color aliases fail `scripts/validate-color-system.mjs`. Teamwear garment colorways remain scoped merchandising data rather than interface roles.
- Typography weights and relative paragraph roles are enforced by `scripts/validate-typography-system.mjs`; component CSS may not introduce raw numeric font weights.
- The generic `--text-*` scale overlaps with the semantic Markdown-style `--type-*` roles. New component work should use Small, Body, or h1 through h6; the generic scale should be migrated and then deprecated.
- Teamwear uses `.type-h1` for its 32px Base/Medium and 64px Large hero title, and `.type-h2` with the Brand Title gradient for its 24px Base/Medium and 48px Large section titles. These display roles use the shared 90% horizontal width and −50 tracking. Child and card titles remain semantic h3 elements but use the 14px `.type-h5` visual role. Eyebrows remain semantic h5 elements and use the default shifted h6 visual role at 12px. Smaller roles retain default tracking, and text stacks retain Standard paragraph spacing.
- Interface icons use the outlined Google Material Symbols font through `renderIcon()`. The renderer owns the semantic-to-Material name map, and the generated document loads only the mapped symbols. Do not add hand-drawn SVG icon assets or inline SVG icon markup.
- Draft imagery and copy must read naturally in the composition. Do not render labels, captions, notes, or badges that announce placeholder status.

### Improvement order

1. Keep Figma Variables > Paradigm > Color Styles as the base source for global semantic color tokens; document deliberate extensions such as Brand Low, and keep product swatches outside the interface state palette.
2. Adjust shared typography, paragraph rhythm, spacing, radii, motion, and responsive layout through their semantic roles before changing individual components.
3. Keep Teamwear mapped to the shared foundation roles as its editorial composition evolves; extend the system only when a genuinely reusable role is missing.
4. Add component tokens only for repeated intentional decisions, such as control height or card radius; avoid aliases for one-off coordinates.
5. Keep `scripts/validate-color-system.mjs`, `scripts/validate-typography-system.mjs`, and `scripts/validate-layout-system.mjs` in the validation workflow so new literals, undeclared roles, or responsive-layout drift cannot silently expand the shared system.

## Choice overflow

`renderChoiceGroup()` defaults to a shared responsive rail for Color, Size, Pattern, Quantity, and Add-On. Below the Large breakpoint (`64rem`), swatches retain `--choice-size` (32px), while chips share an equal width. Chips fill the available row until the longest label, horizontal padding, and borders set their intrinsic minimum, then overflow horizontally. Both tracks retain `--space-3` (8px) gaps. Standard chips use `--space-2` (4px) vertical and `--space-3` (8px) horizontal padding; Add-On retains its square plus/check column and existing checkbox treatment.

Rails use independent native touch scrolling, mouse/pen grab-and-drag, and keyboard radio selection without browsing arrows or visible scrollbars. A drag suppresses the resulting click so browsing does not select an option. Focus outlines retain clearance equal to `--focus-ring-width` plus `--focus-ring-offset` on each side of the scrollport. Existing labels, unavailable states, purchase/inquiry behavior, and gallery updates remain owned by their shared components.

At Large, every swatch and chip wraps into rows with no hidden options or disclosure control. Chip columns share an equal width; the longest label measured with the Strong weight sets `--choice-chip-min`, including the Add-On icon column where applicable. Sizers follow localization and font changes. Without JavaScript, options remain selectable and browsable by native scrolling; Large chip rows use the tokenized control-width fallback and allow labels to wrap. `overflow: "wrap"` is reserved for explicit preview comparisons. The approved experiment reuses the production renderer, styles, and controller.

## Figma-to-code map

| Figma component | Website contract |
| --- | --- |
| Header | `.site-header`, `.site-header__inner`, `.site-logo`, `.site-actions`, `.icon-button` |
| Side menu | `.nav-drawer`, `.nav-drawer__panel`, `.drawer-nav` |
| Collection / Item Headline | `renderPageHeadline()` with one 48px Surface Mid row, a hierarchy/back `renderBreadcrumb()`, and an optional intrinsic icon/text trailing action; interactive text underlines on hover, press, and keyboard focus |
| Product Card | `.product-card`, `.product-card__media`, `.product-card__body` |
| Product Detail / Teamwear Customize | `renderProductDetail()` owns the shared gallery and summary; build adapters supply content and controlled product/Teamwear hooks |
| Product / Teamwear Color | `renderChoiceGroup()` with `.choice-group--swatch` and `.choice-option--swatch`, with `data-color-id` and `data-availability` |
| Size / Pattern / Quantity | `renderChoiceGroup()` with `.choice-group--chip` and `.choice-option--chip`, with equal flexible widths and radio selection |
| Add-On | The same chip renderer with `variant: "add-on"`, checkbox selection, and the shared plus/check symbol |
| Product / Teamwear description | `renderDescription()` with `.rich-description`, using the same typography, spacing, dividers, hashtags, and tables |
| Primary action | `renderPrimaryAction()` with independent intent and controlled `fixed-to-static` or `fixed-to-float` responsive behavior; Large floating actions use the page gutter on the right, a fixed `--space-7` bottom gap, and a permanently reserved dock footprint before the footer |
| Footer | `.site-footer` and `.site-footer__grid` |
| Teamwear page | `.teamwear-page`, `.teamwear-story-page`, and its editorial sections |

## Adjustment workflow

1. Change a shared visual decision in `assets/css/tokens.css` first.
2. For color changes, verify **Variables → Paradigm → Color Styles**; do not copy values from `material-theme`.
3. Change merchandising hues only in `data/colors.json`; options reference `colorId` and never carry local values.
4. Run `node scripts/build-site.mjs`, then `node scripts/build-site.mjs --check` and `node scripts/validate-shared-components.mjs`.
5. Keep component selectors mapped to the Figma component names above.
6. Add a component-level token only when a value is intentional and reused; keep one-off editorial composition in `pages.css`.
7. Use the reference PNG as the visual source of truth and its companion exported CSS for dimensions, spacing, and typography.
8. Verify collection, product-detail, navigation, footer, and Teamwear surfaces at 320px, 390px, 402px, 768px, and 1440px.
9. Preserve a visible keyboard focus ring. Pointer taps and clicks intentionally suppress the browser's blue tap highlight, but `:focus-visible` remains enabled.
10. Run `node scripts/validate-color-system.mjs`; it enforces the 23 semantic roles, canonical color references, and page-local color prohibition.

Do not turn prototype hotspot outlines, selection borders, or Figma canvas effects into website styling.
