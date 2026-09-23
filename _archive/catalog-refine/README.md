# Catalog Refine archive

Preserved from the working tree on 2026-09-23:

| File | Former location / purpose |
| --- | --- |
| `catalog-refine.json` | `data/catalog-refine.json`: groups, labels, defaults |
| `catalog-refine.mjs` | `scripts/lib/catalog-refine.mjs`: collection-scoped options |
| `catalog-refine.js` | `assets/js/catalog-refine.js`: filtering/sorting runtime |
| `catalog-refine.css` | `.catalog-empty` rule from `assets/css/components.css` |
| `collection-renderer.mjs.txt` | Snapshot of the generator's previous collection renderer and its gated integration |
| `behavior.md` | Historical behavior documentation; its old paths/enable instructions are inactive |

Shared `renderDropdown()`, `dropdown.js`, and grouped-dropdown styles remain active shared components, not archive copies. `scripts/validate-catalog-refine.mjs` still tests the archived configuration/helper and independently verifies that every public catalog contains all products in descending numeric sequence with no Refine markup or script.

To resume development, work in an isolated checkout, restore the three dedicated source files to their former locations, restore the empty-state style, and adapt the saved renderer into the current generator. Restore the helper import and JSON read alongside its Promise.all binding. The saved config is disabled; enabling it is an explicit development change. Update asset versions, regenerate, and update release assertions only when public release is authorized. Do not replace the whole current generator with a historical snapshot.
