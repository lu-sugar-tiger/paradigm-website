# Catalog Refine

The home catalog and every subcollection use the shared underlined dropdown. `data/catalog-refine.json` controls the group order, labels, selection kinds, sort choices, and code labels. Options are limited to products in the current collection, using visible variants for colors. `scripts/lib/catalog-refine.mjs` resolves this configuration during generation.

- Sort is single select, defaulting to descending numeric `sequence` (imported `itemSequence`). Other choices are oldest first and price in either direction. Price ties use newest first; sequence ties preserve original catalog order.
- Color, Line, and Type allow multiple selections. Choices within one group match any selected value; different groups must all match. An empty group does not restrict results.
- Line and Type match canonical `lineCode` and `typeCode`. Labels are controlled in the config; shared codes such as PH and 14 list both product names/types rather than inventing another code.
- Price uses `salePrice` when supplied, otherwise `listPrice`. Both bounds are optional and inclusive. Invalid bounds show a message and preserve the last valid results.
- Changes apply immediately and leave the panel open. Clear all restores the default sort and removes all filters. Done or Escape closes the panel and returns focus to Refine. Outside clicks, focus leaving the component, and another overlay opening also close it.

`renderDropdown()` in `scripts/lib/site-renderers.mjs` owns both native-select dropdowns and grouped panels. Both use the same trigger renderer, option states, underline, indicator, and positioning in `assets/js/dropdown.js` and `assets/css/components.css`. Groups use native radios, checkboxes, and number inputs with fieldset legends. Mixed controls are a form, not a listbox.

Panels align to their configured start/end edge, shift inside the responsive shell gutters, and open upward when that offers more space. Width and height stay within the visual viewport, including resize, page scroll, and on-screen keyboard changes. Large screens use three group columns, medium screens two, and small screens one scrollable column. The action row stays visible while scrolling.

`assets/js/catalog-refine.js` only filters and reorders existing generated cards. All catalog content remains available without JavaScript; the enhanced Refine control is hidden in that case. This does not change product content or purchase destinations.

Validation: `scripts/validate-dropdown.mjs`, `scripts/validate-catalog-refine.mjs`, and the existing build, catalog, shared component, layout, typography, color, motion, and search checks. Browser verification covers combined groups, sorting, price validation, empty/reset states, native keyboard controls, viewport collisions, and the menu's language dropdown.
