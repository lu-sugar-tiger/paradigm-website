import { mkdir, writeFile } from "node:fs/promises";
import { renderDocument, renderDropdown } from "./lib/site-renderers.mjs";

const options = [
  { value: 'all', label: 'All' },
  { value: 'everyday', label: 'Everyday' },
  { value: 'teamwear', label: 'Basketball Teamwear' },
  { value: 'limited', label: 'Limited Edition', availability: 'unavailable' },
  { value: 'custom', label: 'Custom Embroidery', availability: 'unavailable' }
];
const main = `<main class="page container dropdown-preview" id="main-content">
  <h1>Dropdown examples</h1>
  <p>Choose an option to compare its selected state. Unavailable options remain selectable, matching the existing chips.</p>
  <div class="dropdown-preview__examples">
    <section><h2>Underlined trigger</h2>${renderDropdown({ id: 'example-text', label: 'Underlined collection example', name: 'example-text', options, selectedValue: 'everyday', variant: 'text' })}</section>
    <section><h2>Underlined unavailable</h2>${renderDropdown({ id: 'example-text-unavailable', label: 'Underlined customization example', name: 'example-text-unavailable', options, selectedValue: 'limited', variant: 'text' })}</section>
    <section><h2>Available selected</h2>${renderDropdown({ id: 'example-available', label: 'Collection example', name: 'example-collection', options, selectedValue: 'everyday' })}</section>
    <section><h2>Unavailable selected</h2>${renderDropdown({ id: 'example-unavailable', label: 'Customization example', name: 'example-customization', options, selectedValue: 'limited' })}</section>
  </div>
</main>`;
const page = renderDocument({
  title: 'Dropdown examples | Paradigm', description: 'Local shared dropdown design preview.', canonical: 'http://127.0.0.1:4178/output/playwright/dropdown-preview/',
  root: '../../..', bodyClass: 'reference-page', main,
  head: `<meta name="robots" content="noindex,nofollow">
  <style>
    .dropdown-preview { padding: calc(var(--header-height) + var(--space-7)) var(--layout-shell-gutter-inline) var(--space-7); }
    .dropdown-preview h1 { font-size: var(--type-h5-size); margin-bottom: var(--space-5); }
    .dropdown-preview p { font-size: var(--type-body-size); line-height: var(--type-body-line-height); }
    .dropdown-preview__examples { display: flex; flex-wrap: wrap; gap: var(--space-7); margin-top: var(--space-7); }
    .dropdown-preview__examples section { min-height: calc(var(--choice-size) * 8); }
    .dropdown-preview h2 { font-size: var(--type-h6-size); margin-bottom: var(--space-5); }
  </style>`
});
const directory = new URL('../output/playwright/dropdown-preview/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('index.html', directory), page);
console.log('Dropdown preview: /output/playwright/dropdown-preview/');
