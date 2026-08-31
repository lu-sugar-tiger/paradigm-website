# Paradigm design system

This document connects the Paradigm Figma file to the static website. The visual source of truth remains the supplied Figma frames and exported reference images. The implementation source of truth is `assets/css/tokens.css`.

## Foundations

The current Figma work uses a restrained editorial system. Base semantic color values come from **Variables → Paradigm → Color Styles**—not from the separate `material-theme` collection. Brand Low is a deliberate extension requested for future branded editorial work:

| Semantic role | High | Mid | Low | Website use |
| --- | --- | --- | --- | --- |
| Brand | `#a6192e` | — | `#ff808b` | Brand emphasis, selection highlight, and the lighter title-gradient stop |
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
- product and Teamwear colorways reference the canonical `{ id, name, value }` records in `data/colors.json`; generated CSS exposes those values without page-local hex copies
- Figma's purple `#8a38f5` component-boundary color is a canvas/prototype aid and is never an interface token
- the visitor's browser/OS default `sans-serif` for all interface and brand text until a website font is licensed
- an 8px-centered spacing rhythm, with 4px for compact details and 2px for intentional catalog-grid gaps
- a Markdown-style text-role scale with one 4:3 line-height ratio: Small 10px, Body 12px, h6 12px, h5 14px, h4 16px, h3 20px, h2 24px, and h1 32px
- square product controls and actions; rounded corners are reserved for Teamwear editorial cards and accordions
- choice availability and selection are independent states: available/unavailable plus selected/unselected; unavailable choices remain selectable and never need blank filler controls
- choice visuals follow one availability x selection matrix across swatches and chips: available/unselected uses no backing fill with Outline Low and regular Body text; available/selected uses no backing fill with Outline High and emphasized Body text; unavailable/unselected uses Container Low with no outline and regular On Container Low text; unavailable/selected uses Container Low with an On Container Low outline and emphasized On Container Low text. For swatches, the backing fill is the inset area behind the registered color block.
- each choice fieldset owns its label and option row as one grid with an 8px internal gap. Parent stacks space complete choice sections, including their labels, rather than relying on a legend margin that can sit outside normal section rhythm.

Figma variable names are mirrored in `assets/css/tokens.css` when the website has a defined use for them, with Brand Low documented as a deliberate extension. Shared components consume the semantic role names directly: Brand, Background, On Background, Surface, On Surface, Container, On Container, and Outline. Components reference outline roles directly instead of routing them through border aliases. Convenience aliases such as `--color-text` or `--color-action` are intentionally prohibited. Product colorways stay separate so a garment swatch cannot accidentally become an interface role.

The Brand Title gradient is `Brand → Brand Low → Brand` at 105°. It is a composed gradient token, not another semantic color role. Teamwear section titles apply it through `.teamwear-title--brand-gradient` while retaining a Brand fallback for forced-colors mode.

Background roles are layered by responsibility: the document and page use `Background Mid`, elevated cards and galleries use `Surface High`, subdued controls use `Surface Low`, and catalog-grid gaps expose `Surface Mid`. Backgrounds belong to full-width page sections; `.container` constrains content without clipping the section color.

The navigation menu is a full-viewport overlay at every breakpoint. The header remains its top control layer, while the menu surface extends underneath it to every viewport edge.

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

The primitive scale deliberately stops at 64px. Responsive layout consumes semantic roles so future adjustments can be made without finding every component:

| Semantic role | Base | Medium | Large |
| --- | ---: | ---: | ---: |
| Inline gutter | 16px | 32px | 32px |
| Tight section padding | 24px | 24px | 24px |
| Default section padding | 48px | 48px | 48px |
| Editorial / Teamwear section padding | 64px | 64px | 64px |
| Section heading to content | 48px | 48px | 48px |

The responsive system has three layout ranges. Base and Medium retain mobile interaction patterns; Large introduces desktop composition:

| Range | Viewport | Catalog | Product detail | Teamwear |
| --- | --- | --- | --- | --- |
| Base | Below 768px | 2 columns | Single column, gallery carousel, fixed purchase action | Mobile composition, 16px gutter |
| Medium | 768–1023px | 3 columns | Single column, gallery carousel, fixed purchase action | Mobile composition, 32px gutter |
| Large | 1024px and above | 3 columns | Gapless 5-column grid: gallery spans 3, information spans 2; stacked gallery and static action | Desktop headings, FAQ split, three-column bento, 32px gutter |

Large product-detail columns stretch to the same grid-row height. No fixed or content-specific height is imposed on the information panel.
Product-detail information uses 16px vertical padding at every range. Its horizontal padding is 16px at Base and follows the global 32px gutter from Medium onward; the Medium padding change does not alter its single-column carousel composition. Product Size uses the shared chip variation without a visual label while retaining its accessible legend. Product Header to Color uses 16px `--space-5`; the Color label retains the shared 8px `--space-3` internal gap; Color controls to Size controls use 24px `--space-6`; Size controls to description use 32px `--space-7` when the action is fixed. At Large, the static action uses the same 32px separation before the action and description.

`--layout-canvas-width` is `90rem` (1440px) and caps designated visual-canvas modules such as the Teamwear hero and full-bleed material image. `--content-width` is `60rem` (960px) through Medium and changes to `80rem` (1280px) at Large. The 1280px value is the centered shared reference region rather than the final readable width. Base viewports remain naturally limited by their viewport and container gutters. `--content-narrow: 58rem` (928px) and `.container--narrow` are defined but currently unused. The exact 928px value is project-specific rather than a required industry convention.

`.container` is active throughout headers, footers, catalogs, product pages, and Teamwear. `.reference-page` is also active on all current public page templates; it deliberately lets selected catalog and product structures reach the viewport edges until the responsive 960px / 1280px maximum. Do not remove either as unused legacy. Shared header and footer content apply `--layout-shell-gutter-inline` inside the centered reference region, producing 1216px of inner content at Large. Teamwear main containers use the same nested model with their independent `--space-7` Base and `--space-9` Medium/Large gutters, producing 1152px of inner content once the reference region reaches 1280px.

Teamwear rails remain tied to the physical viewport rather than the 1440px visual canvas. Their initial and terminal scroll padding use `--teamwear-content-edge`, which combines the centered 1280px reference-region offset with the Teamwear inner gutter so the first card aligns with section content. The same edge aligns the Teamwear floating action. Rail cards are `50vw` at Base and one-third viewport width from Medium, capped at one-third of the 1440px canvas (480px). Teamwear motion uses the shared structural motion roles below; component dimensions such as 40px and 48px controls use size roles rather than spacing tokens. Radius roles describe shape only and must never be used as gaps or padding.

The unused generic `.split` recipe, `.spec-list`, `.spec-card`, and the old 1px grid gaps have been removed. Active catalog seams are true `--space-1` (2px) grid gaps exposing `Surface Mid`; they are not outlines. Active 1px borders reference Outline Low directly rather than using a border alias.

## Interaction and motion

Interaction targets must not change established layout geometry. Use an out-of-flow 48×48px `--control-size-large` hit region only when the surrounding space can contain it without covering another control; otherwise preserve the component's intrinsic box and crop the hit region at the neighboring control's boundary. The header keeps 24px glyph boxes separated by `--space-5` (16px). Their 48px hit regions are cropped by the tokenized 4px overlap on every edge facing another header control, so the logo, Search, and Menu targets meet without capturing one another's area. The 48px Search frame, intrinsic navigation and footer rows, and boxed buttons and choices retain their existing sizing contracts.

Hover and press are one shared visual contract. Do not gate hover styling behind `hover`, `any-hover`, `pointer`, or `any-pointer` capability media queries. Every hover treatment must also apply through `:active` so touch and pointer input receive the same feedback while the control is pressed. The press state is momentary and returns to rest on release; do not add JavaScript to persist a hover-equivalent state after a tap.

Keyboard focus remains independent and visible through `:focus-visible`. When the hover treatment also helps keyboard wayfinding, include `:focus-visible` in the same selector without replacing the component's focus ring.

Structural motion combines Apple-style spatial continuity with Material 3's explicit web transition values. Entering content uses `--motion-duration-enter` (400ms) with `--motion-ease-enter` (`cubic-bezier(.05, .7, .1, 1)`); exiting content uses `--motion-duration-exit` (200ms) with `--motion-ease-exit` (`cubic-bezier(.3, 0, .8, .15)`). Utility transitions use `--motion-duration-standard` (300ms) and `--motion-ease-emphasized` (`cubic-bezier(.2, 0, 0, 1)`), while compact surface entrances use 250ms with `cubic-bezier(0, 0, 0, 1)`. Sequential content uses the 40ms `--motion-stagger-short` role. Future gesture springs default to response 350ms and damping ratio 1; damping .8 is reserved for real momentum gestures and is not synthesized for native scrolling.

Cross-document page motion is progressive enhancement. Catalog routes form the hierarchy All (depth 0), subcollections and Search (depth 1), then product detail (depth 2). Teamwear forms Landing (depth 0) then Customize (depth 1). Moving deeper enters from inline-end while the previous page recedes 24% toward inline-start; moving upward reverses the same path. Same-depth, cross-family, and unknown routes fade through. `/` and `/collections/all` are equivalent and do not animate between each other. Navigation from an open Search or menu overlay fades through instead of inheriting the covered page's direction. Direct loads, reloads, external navigation, unsupported browsers, and native browser navigation gestures remain native.

Search and navigation share one overlay state contract: `closed`, `opening`, `open`, and `closing`. The background reveals downward from the top using clipping plus opacity; the Material close symbol follows after 40ms, then the Search field or first navigation group at 80ms, and later groups in 40ms steps. Closing reverses and compresses the sequence into no more than 280ms. The controller must remain interruptible, retain focus containment and restoration, and never delay destination navigation. Search results sequence only on the first completed render of each open cycle, not after each keystroke.

Teamwear hero and section entrances use the structural 400ms enter role. Rail cards appear once in DOM order with a 40ms stagger and 12px travel. During native rail scrolling, each card's photo content moves at most 16px toward the rail center while its copy moves at most 8px in the opposite direction; both are neutral at center. Photo tracks include 16px of non-scaled inline bleed so parallax cannot expose an empty edge. Geometry reads and CSS-variable writes are batched in `requestAnimationFrame`, and the native scroll, snap, touch zoom, keyboard, and rail-control behaviors remain authoritative.

The Large Teamwear `fixed-to-float` primary action uses one shared `entering → floating → exiting → inline` state path. When its inline mount passes above the viewport, the fixed action enters from 12px toward block-end with opacity over the 400ms enter role. Returning to the inline mount reverses that path over the 200ms exit role before fixed positioning is removed. A scroll-direction reversal retargets from the current rendered opacity and translation rather than waiting for completion. Base and Medium retain their existing fixed full-width action, and reduced motion settles either position immediately. The action never scales, bounces, docks into the footer, or delays activation.

`prefers-reduced-motion: reduce` disables page sliding, overlay sequencing, Teamwear entrances, card staggering, and rail parallax. Content must render immediately and remain operable; motion is never the only state indicator.

Automatic scaling and zooming are prohibited in production design. Do not use the CSS `scale()` transform or `scale` property for hover, active, entrance, exit, image, or decorative effects. Tokenized translation and opacity motion remain available when they clarify state or spatial continuity, and reduced-motion behavior must remain intact. If a scale-only effect is removed, do not invent a replacement unless the component needs feedback for an actual interaction.

Direct product-media inspection is the sole scaling exception. Opted-in catalog, related-product, Search-result product, product-gallery, and Teamwear card photos use the shared `data-media-zoom-touch` contract: a two-finger pinch creates a temporary fixed copy, hides the in-flow source for the life of the gesture, follows the live midpoint from the point that was grabbed, ranges from 1× through 4×, hands movement to the remaining finger, and disappears when the final finger lifts or the gesture is cancelled. One-finger taps, navigation, vertical scrolling, gallery swiping, and Teamwear rail swiping remain native. The temporary copy changes its measured width, height, and translated position through `requestAnimationFrame`; it never uses a CSS scale transform or scaling transition. Do not opt non-product editorial imagery, hero imagery, fabric macros, or page decoration into this contract.

Retail product-detail and Teamwear Customize galleries additionally use `data-media-zoom-gallery` at Large. Clicking, Enter, or Space opens the source-ordered gallery in an accessible full-viewport dialog: one gapless column at twice the measured gallery width, centered horizontally, and vertically aligned to the chosen image. A stationary click anywhere, Escape, or leaving the Large breakpoint closes it and restores focus and document scrolling. Large pointer hover does not create a magnifier or any other automatic zoom surface. Hero imagery, fabric macros, non-product Search results, and non-media decoration never inherit this exception.

## Typography

The website loads the Google Fonts Roboto variable family at the Semi Condensed width (`wdth 87.5`) across its complete Thin through Black range (`wght 100..900`). `renderDocument()` owns the preconnects and shared stylesheet request, uses `display=swap`, and places the font resource before local CSS. `--font-latin` and `--font-brand` resolve to Roboto, while every component continues to consume the composed `--font-sans` or `--font-brand` role rather than a page-local family.

Traditional Chinese remains on the local `--font-cjk` stack: PingFang TC, Noto Sans CJK TC, Noto Sans TC, Source Han Sans TC, Microsoft JhengHei, then the generic sans-serif fallback. The Android-oriented Noto families and Source Han Sans TC are checked before the Windows-specific Microsoft JhengHei face. 阿里巴巴普惠體TC is intentionally deferred and must not be requested or bundled. Do not set `font-stretch` globally: the Google stylesheet supplies Roboto's 87.5% face, while CJK fallback faces retain their native width. Type is defined by semantic roles rather than by page:

| Role | Size / line height | Default weight | Token prefix |
| --- | --- | --- | --- |
| Small | 10px / 13.333px | Regular | `--type-small-*` |
| Body | 12px / 16px | Regular | `--type-body-*` |
| h6 | 12px / 16px | Semi Bold | `--type-h6-*` |
| h5 | 14px / 18.667px | Semi Bold | `--type-h5-*` |
| h4 | 16px / 21.333px | Semi Bold | `--type-h4-*` |
| h3 | 20px / 26.667px | Semi Bold | `--type-h3-*` |
| h2 | 24px / 32px | Semi Bold | `--type-h2-*` |
| h1 | 32px / 42.667px | Semi Bold | `--type-h1-*` |

Each role has `size`, `line-height`, and `weight` tokens. `.type-h1` through `.type-h6` apply the complete visual roles independently from the semantic document outline. The previous h1–h5 roles shifted intact to h2–h6, making room for the new 32px h1. Existing semantic headings and explicit Teamwear role classes were remapped to those shifted roles so their rendered sizes do not change. `body` supplies the Body role, `.type-body` reapplies it explicitly, and `small` and `.type-small` consume the complete Small role. Brand and drawer navigation remain component-specific roles.

Legacy `--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`, and `--text-hero` tokens are removed. Components consume the semantic roles directly; every breadcrumb uses the complete Body role.
Catalog product names use the complete h6 role: 12px size, 16px line height, and Semi Bold weight.
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
| Strong | Adds 200 to the surrounding semantic base weight, capped at Black 900 | `<strong>` or `.text-strong` |

Examples: Regular becomes Semi Bold, Medium becomes Bold, Bold becomes Black, and Extra Bold is capped at Black.

Paragraph spacing is also a typography decision. Relative values are calculated from the consuming text role's own font size:

| Paragraph rhythm | Value | Token | Use |
| --- | ---: | --- | --- |
| Default | 0 | `--type-paragraph-spacing-default` | Reset and layouts where the parent owns vertical rhythm |
| Compact | 0 | `--type-paragraph-spacing-compact` | Dense text groups that still need a distinct semantic role |
| Standard | 1/3 × text-role size (`0.333333em`) | `--type-paragraph-spacing-standard` | Product-description lines and short component copy |
| Relaxed | 1 × text-role size (`1em`) | `--type-paragraph-spacing-relaxed` | Editorial or long-form copy when the composition calls for more air |

Use either a paragraph margin or a parent layout gap to create the same intended rhythm, never both. The shared rich-description renderer uses Body 12px with Standard spacing, so its effective value remains exactly 4px while preserving source blank lines. Product Detail and Teamwear Customize both receive this markup exclusively through `renderDescription()`; authored templates contain only renderer placeholders. Divider and hashtag tokens use On Surface Low while ordinary text remains On Surface High.

## Iconography

Interface icons use the outlined Google Material Symbols font. `renderIcon()` owns the semantic icon-name map, and each generated page requests only that mapped subset from Google Fonts with the `wght` axis limited to the active 400–700 range. The global CSS configuration uses `FILL 0`, inherited semantic `wght`, `GRAD 0`, and `opsz 24`; component rules adjust rendered size for their roles. A symbol following text inherits that text context's semantic weight: external arrows match their labels, while the Add-On symbol moves from Regular `add` to Bold `check` with the selected label. Ligature names must retain `text-transform: none`.

When a Material Symbol should appear visually equal in prominence to adjacent Body text, use the established `20px / 12px` ratio: `--icon-size-small` over `--type-body-size`, or `5:3` (`1.666667×`). This is an optical relationship rather than a universal geometric rule. Directional indicators such as the external-link arrow instead match the label's font size at `1em`, remain separated by `--space-1` (2px), and are vertically centered without entering the label's layout width.

## Consistency status

The system is partially consistent, not yet project-wide:

- All active pages load the same foundation stack in the same order: tokens, reset, base, layout, components, then pages. Teamwear adds its two scoped stylesheets after that stack.
- The shared storefront shell uses the Figma-derived semantic color roles directly, the default sans-serif family, common layout variables, full-viewport navigation, and reusable component classes.
- Shared storefront color usage is strict: literal colors and undeclared color aliases fail `scripts/validate-color-system.mjs`. Teamwear garment colorways remain scoped merchandising data rather than interface roles.
- Typography weights and relative paragraph roles are enforced by `scripts/validate-typography-system.mjs`; component CSS may not introduce raw numeric font weights.
- The generic `--text-*` scale overlaps with the semantic Markdown-style `--type-*` roles. New component work should use Small, Body, or h1 through h6; the generic scale should be migrated and then deprecated.
- Teamwear uses `.type-h1` for the 32px hero title and `.type-h2` with the Brand Title gradient for 24px section titles. Child and card titles remain semantic h3 elements but use the 14px `.type-h5` visual role. Eyebrows remain semantic h5 elements and use the default shifted h6 visual role at 12px. Its text stacks retain Standard paragraph spacing and default tracking.
- Interface icons use the outlined Google Material Symbols font through `renderIcon()`. The renderer owns the semantic-to-Material name map, and the generated document loads only the mapped symbols. Do not add hand-drawn SVG icon assets or inline SVG icon markup.
- Draft imagery and copy must read naturally in the composition. Do not render labels, captions, notes, or badges that announce placeholder status.

### Improvement order

1. Keep Figma Variables > Paradigm > Color Styles as the base source for global semantic color tokens; document deliberate extensions such as Brand Low, and keep product swatches outside the interface state palette.
2. Adjust shared typography, paragraph rhythm, spacing, radii, motion, and responsive layout through their semantic roles before changing individual components.
3. Keep Teamwear mapped to the shared foundation roles as its editorial composition evolves; extend the system only when a genuinely reusable role is missing.
4. Add component tokens only for repeated intentional decisions, such as control height or card radius; avoid aliases for one-off coordinates.
5. Keep `scripts/validate-color-system.mjs`, `scripts/validate-typography-system.mjs`, and `scripts/validate-layout-system.mjs` in the validation workflow so new literals, undeclared roles, or responsive-layout drift cannot silently expand the shared system.

## Figma-to-code map

| Figma component | Website contract |
| --- | --- |
| Header | `.site-header`, `.site-header__inner`, `.site-logo`, `.site-actions`, `.icon-button` |
| Side menu | `.nav-drawer`, `.nav-drawer__panel`, `.drawer-nav` |
| Collection / Item Headline | `renderPageHeadline()` with one 48px Surface Mid row, a hierarchy/back `renderBreadcrumb()`, and an optional intrinsic icon/text trailing action; interactive text underlines on hover, press, and keyboard focus |
| Product Card | `.product-card`, `.product-card__media`, `.product-card__body` |
| Product / Teamwear Color | `.choice-group--swatch` and `.choice-option--swatch`, with `data-color-id` and `data-availability` |
| Size / Pattern / Batch / Quantity / Pocket | `.choice-group--chip` and `.choice-option--chip`, with equal flexible widths |
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
