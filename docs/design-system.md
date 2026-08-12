# Paradigm design system

This document connects the Paradigm Figma file to the static website. The visual source of truth remains the supplied Figma frames and exported reference images. The implementation source of truth is `assets/css/tokens.css`.

## Foundations

The current Figma work uses a restrained editorial system. Semantic color values come from **Variables → Paradigm → Color Styles**—not from the separate `material-theme` collection:

| Semantic role | High | Mid | Low | Website use |
| --- | --- | --- | --- | --- |
| Brand | `#a6192e` | — | — | Brand emphasis and selection highlight |
| Background | `#ffffff` | `#f7f7f7` | `#efefef` | Document and full-width page-section layers |
| On Background | `#000000` | `#404040` | `#808080` | Content placed directly on a Background layer |
| Surface | `#ffffff` | `#f7f7f7` | `#efefef` | Cards, galleries, panels, and subdued controls |
| On Surface | `#000000` | `#404040` | `#808080` | Content placed on a Surface layer |
| Container | `#202020` | `#404040` | `#dfdfdf` | Filled actions, footer, and filled control states |
| On Container | `#ffffff` | `#ffffff` | `#808080` | Content placed on a Container layer |
| Outline | `#000000` | `#bfbfbf` | `#dfdfdf` | Focus, strong controls, hairlines, and grid seams |

- brand: `#a6192e`
- backgrounds and surfaces: high `#ffffff`, mid `#f7f7f7`, low `#efefef`
- content on backgrounds and surfaces: high `#000000`, mid `#404040`, low `#808080`
- outlines: high `#000000`, mid `#bfbfbf`, low `#dfdfdf`
- containers: high `#202020`, mid `#404040`, low `#dfdfdf`; their content colors are white, white, and `#808080`
- product colorways live in the complete `data/product-colorways.json` registry rather than in semantic interface tokens
- Figma's purple `#8a38f5` component-boundary color is a canvas/prototype aid and is never an interface token
- the visitor's browser/OS default `sans-serif` for all interface and brand text until a website font is licensed
- an 8px-centered spacing rhythm, with 4px used for compact details
- 12/16 body text, 14/17 titles and labels, 20/23 wordmark text, and 22/26 drawer navigation
- square product controls and actions; rounded corners are reserved for Teamwear editorial cards and accordions
- four control states where relevant: default, selected, sold/unavailable, and blank

The Figma variable names are mirrored one-to-one in `assets/css/tokens.css`. Shared components consume those role names directly: Brand, Background, On Background, Surface, On Surface, Container, On Container, and Outline, with High/Mid/Low levels where applicable. Convenience aliases such as `--color-text` or `--color-action` are intentionally prohibited. Product colorways stay separate so a garment swatch cannot accidentally become an interface role.

Background roles are layered by responsibility: the document and page use `Background Mid`, elevated cards and galleries use `Surface High`, subdued controls use `Surface Low`, and grid seams use `Outline Low`. Backgrounds belong to full-width page sections; `.container` constrains content without clipping the section color.

The navigation menu is a full-viewport overlay at every breakpoint. The header remains its top control layer, while the menu surface extends underneath it to every viewport edge.

## Typography

The website uses the visitor's browser/OS default `sans-serif` until a website font is licensed. Type is defined by semantic roles rather than by page:

| Role | Size / line height | Token pair |
| --- | --- | --- |
| Body | 12px / 16px | `--type-body-size`, `--type-body-line-height` |
| Title and label | 14px / 17px | `--type-title-size`, `--type-title-line-height` |
| Brand | 20px / 23px | `--type-brand-size`, `--type-brand-line-height` |
| Drawer navigation | 22px / 26px | `--type-nav-size`, `--type-nav-line-height` |

Paragraph spacing is also a typography decision, including an explicit zero value:

| Paragraph rhythm | Value | Token | Use |
| --- | ---: | --- | --- |
| Default | 0 | `--type-paragraph-spacing-default` | Reset and layouts where the parent owns vertical rhythm |
| Compact | 0 | `--type-paragraph-spacing-compact` | Dense text groups that still need a distinct semantic role |
| Standard | 4px | `--type-paragraph-spacing-standard` | Product-description lines and short component copy |
| Relaxed | 12px | `--type-paragraph-spacing-relaxed` | Editorial or long-form copy when the composition calls for more air |

Use either a paragraph margin or a parent layout gap to create the same intended rhythm, never both. The product-copy renderer deliberately uses the standard 4px role and preserves source blank lines; changing that role must be checked against the source-exact product-copy contract.

## Consistency status

The system is partially consistent, not yet project-wide:

- All active pages load the same foundation stack in the same order: tokens, reset, base, layout, components, then pages. Teamwear adds its two scoped stylesheets after that stack.
- The shared storefront shell uses the Figma-derived semantic color roles directly, the default sans-serif family, common layout variables, full-viewport navigation, and reusable component classes.
- Shared storefront color usage is strict: literal colors and undeclared color aliases fail `scripts/validate-color-system.mjs`. Remaining literal colors are scoped to the unfinished Teamwear implementation.
- The generic `--text-*` scale overlaps with the semantic `--type-*` roles. New component work should use semantic roles; the generic scale should be migrated and then deprecated.
- Teamwear is under construction, so its provisional implementation is excluded from the current consistency assessment. Once its design is stable, it must either reuse the global system or extend it with documented semantic roles; it should not remain a permanent exception.

### Improvement order

1. Keep Figma Variables > Paradigm > Color Styles as the only source for global semantic color tokens; keep product swatches and editorial art direction outside the interface state palette.
2. Finish migrating shared shell typography, paragraph rhythm, spacing, radii, and motion before normalizing one-off editorial compositions.
3. After Teamwear's direction is approved, map it into the existing system or deliberately extend the shared tokens and component contracts to cover it.
4. Add component tokens only for repeated intentional decisions, such as control height or card radius; avoid aliases for one-off coordinates.
5. Keep `scripts/validate-color-system.mjs` in the validation workflow so new literal colors or undeclared color roles cannot silently expand the shared system.

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
8. Run `node scripts/validate-color-system.mjs`; it enforces the 22 semantic role names, the complete product-colorway registry, and Teamwear-only scoping for exceptions.

Do not turn prototype hotspot outlines, selection borders, or Figma canvas effects into website styling.
