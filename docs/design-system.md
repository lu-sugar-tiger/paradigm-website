# Paradigm design system

This document connects the Paradigm Figma file to the static website. The visual source of truth remains the supplied Figma frames and exported reference images. The implementation source of truth is `assets/css/tokens.css`.

## Foundations

The current Figma work uses a restrained editorial system. Semantic color values come from **Variables → Paradigm → Color Styles**—not from the separate `material-theme` collection:

- brand: `#a6192e`
- backgrounds and surfaces: high `#ffffff`, mid `#f7f7f7`, low `#efefef`
- content on backgrounds and surfaces: high `#000000`, mid `#404040`, low `#808080`
- outlines: high `#000000`, mid `#bfbfbf`, low `#dfdfdf`
- containers: high `#202020`, mid `#404040`, low `#dfdfdf`; their content colors are white, white, and `#808080`
- product-option colors such as navy `#000e57` remain content data rather than semantic interface colors
- Figma's purple `#8a38f5` component-boundary color is a canvas/prototype aid and is never an interface token
- the visitor's browser/OS default `sans-serif` for all interface and brand text until a website font is licensed
- an 8px-centered spacing rhythm, with 4px used for compact details
- 12/16 body text, 14/17 titles and labels, 20/23 wordmark text, and 22/26 drawer navigation
- square product controls and actions; rounded corners are reserved for Teamwear editorial cards and accordions
- four control states where relevant: default, selected, sold/unavailable, and blank

The Figma variable names are mirrored one-to-one in `assets/css/tokens.css` (`--color-background-*`, `--color-on-background-*`, `--color-surface-*`, `--color-on-surface-*`, `--color-outline-*`, and `--color-container-*`). Existing website components consume stable aliases such as `--color-text` and `--color-action`, which point to those mirrored variables. Product colors stay separate from semantic UI states so a garment swatch cannot accidentally become an error, success, or action color.

Background roles are layered by responsibility: the document and page use `Background Mid`, elevated cards and galleries use `Surface High`, subdued controls use `Surface Low`, and grid seams use `Outline Low`. Backgrounds belong to full-width page sections; `.container` constrains content without clipping the section color.

The navigation menu is a full-viewport overlay at every breakpoint. The header remains its top control layer, while the menu surface extends underneath it to every viewport edge.

## Figma-to-code map

| Figma component | Website contract |
| --- | --- |
| Header | `.site-header`, `.site-header__inner`, `.site-logo`, `.site-actions`, `.icon-button` |
| Side menu | `.nav-drawer`, `.nav-drawer__panel`, `.drawer-nav` |
| Collection / Item Headline | `.page-headline`, `.filter-bar`, `.breadcrumb` |
| Product Card | `.product-card`, `.product-card__media`, `.product-card__body` |
| Product Color | `.swatch` plus `.is-active`, `.is-muted`, and `.swatch--blank` |
| Product Size | `.size-chip` plus `.is-active`, `.is-muted`, and `.size-chip--blank` |
| Button | `.button` and `.button--secondary` |
| Footer | `.site-footer` and `.site-footer__grid` |
| Teamwear page | `.reference-page--teamwear` and its editorial sections |

## Adjustment workflow

1. Change a shared visual decision in `assets/css/tokens.css` first.
2. For color changes, verify **Variables → Paradigm → Color Styles**; do not copy values from `material-theme`.
3. Keep component selectors mapped to the Figma component names above.
4. Add a component-level token only when a value is intentional and reused; keep one-off editorial composition in `pages.css`.
5. Use the reference PNG as the visual source of truth and its companion exported CSS for dimensions, spacing, and typography.
6. Verify collection, product-detail, navigation, footer, and Teamwear surfaces at 320px, 390px, 402px, 768px, and 1440px.
7. Preserve a visible keyboard focus ring. Pointer taps and clicks intentionally suppress the browser's blue tap highlight, but `:focus-visible` remains enabled.

Do not turn prototype hotspot outlines, selection borders, or Figma canvas effects into website styling.
