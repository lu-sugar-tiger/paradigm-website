import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { renderDropdown } from "./lib/site-renderers.mjs";
import { storefronts } from "./lib/pricing-config.mjs";

const markup = renderDropdown({ id: 'fixture', label: 'A "label"', name: 'preference', selectedValue: 'b', options: [{ value: 'a', label: '<Taiwan>' }, { value: 'b', label: 'International' }] });
assert.match(markup, /<select[^>]+name="preference"/);
assert.match(markup, /value="b" selected/);
assert.match(markup, /class="dropdown__enhanced" hidden/);
assert.match(markup, /&lt;Taiwan&gt;/);
assert.match(markup, /A &quot;label&quot;/);
assert.match(markup, /aria-controls="fixture-list"/);
assert.match(markup, /id="fixture-list"[^>]+role="listbox"/);
assert.throws(() => renderDropdown({ options: [{ value: 'a' }, { value: 'a' }] }), /unique/);
const unavailableMarkup = renderDropdown({ id: 'availability', label: 'Choice', name: 'choice', selectedValue: 'a', options: [{ value: 'a', label: 'Selected', availability: 'unavailable' }, { value: 'b', label: 'Other', availability: 'unavailable' }] });
assert.match(unavailableMarkup, /data-selected="true" data-availability="unavailable"/);
assert.match(unavailableMarkup, /data-availability="unavailable" aria-selected="false" aria-describedby="availability-unavailable-1"/);
assert.doesNotMatch(unavailableMarkup, /aria-disabled|\sdisabled(?:\s|>)/, 'unavailable choices must remain selectable like existing chips');
const textMarkup = renderDropdown({ id: 'text-fixture', label: 'Collection', name: 'collection', options: [{ value: 'all', label: 'All' }], variant: 'text' });
assert.match(textMarkup, /class="dropdown dropdown--text"/);
assert.match(textMarkup, /dropdown__text-content/);
assert.match(textMarkup, /dropdown__text-indicator/);
assert.doesNotMatch(textMarkup, /class="choice-option__state-icon"/, 'text triggers must not reserve a chip icon cell');
assert.doesNotMatch(markup, /dropdown--text/, 'boxed remains the default');
assert.throws(() => renderDropdown({ options: [{ value: 'all', label: 'All' }], variant: 'unknown' }), /variant/);
const componentStyles = await readFile(new URL('../assets/css/components.css', import.meta.url), 'utf8');
assert.match(componentStyles, /\.dropdown--text \.dropdown__native\s*\{\s*border: 0;\s*background: transparent;/);
assert.match(componentStyles, /\.dropdown--text \.dropdown__native\s*\{\s*padding-inline: 0;/);
assert.match(componentStyles, /text-decoration-thickness: var\(--stroke-width-thin\);\s*text-underline-offset: var\(--space-1\);/);
assert.match(componentStyles, /\.dropdown__text-indicator\s*\{[^}]*inset-inline-start: calc\(100% \+ var\(--external-link-arrow-gap\)\);[^}]*font-size: var\(--external-link-arrow-size\);/);
assert.match(componentStyles, /\.dropdown__option\[data-availability="available"\]:is\(\[aria-selected="true"\], :hover, :active\)\s*\{[^}]*color: var\(--color-on-surface-high\);[^}]*z-index: 3;/);
assert.match(componentStyles, /\.dropdown__option\[data-availability="unavailable"\]:is\(\[aria-selected="true"\], :hover, :active\)\s*\{[^}]*border-color: var\(--color-outline-mid\);[^}]*z-index: 2;/);
assert.doesNotMatch(componentStyles, /\.dropdown__option:focus-visible\s*\{\s*z-index:/, 'focus must not promote a lighter row border above a darker neighbor');
assert.match(componentStyles, /\.dropdown--text \.dropdown__options\s*\{\s*top: 100%;\s*inset-inline-start: calc\(0px - var\(--space-3\) - var\(--stroke-width-thin\)\);/);

const splitMarkup = renderDropdown({ id: 'split-fixture', label: 'Language and currency', name: 'storefront', selectedValue: 'en-TWD', options: [{ value: 'zh-TWD', label: '中文', detail: 'TWD' }, { value: 'en-TWD', label: 'English', detail: 'TWD' }, { value: 'en-USD', label: 'English', detail: 'USD' }] });
assert.match(splitMarkup, /data-dropdown-split/);
assert.match(splitMarkup, /aria-label="Language and currency: English TWD"/);
assert.match(splitMarkup, /class="dropdown__value-pair"><span data-dropdown-value>English<\/span> <span class="dropdown__detail" data-dropdown-detail>TWD<\/span>/);
assert.match(splitMarkup, />中文 TWD<\/option>/);
assert.equal((splitMarkup.match(/role="option"/g) || []).length, 3);

const preferenceSource = await readFile(new URL('../assets/js/language-preference.js', import.meta.url), 'utf8');
for (const saved of ['zh-TWD', 'en-TWD', 'en-USD', 'invalid', null, 'blocked']) {
  const listeners = [];
  const writes = [];
  const native = { value: 'en-TWD', options: [{ value: 'zh-TWD' }, { value: 'en-TWD' }, { value: 'en-USD' }], dispatchEvent() {}, addEventListener(type, fn) { listeners.push(fn); } };
  const window = { PARADIGM_PRICING_CONFIG: { storefronts } };
  vm.runInNewContext(preferenceSource, {
    window, document: { querySelector: () => native, documentElement: { dataset: {} }, dispatchEvent() {} }, Event: class {}, CustomEvent: class {},
    localStorage: {
      getItem(key) { if (saved === 'blocked') throw new Error('blocked'); return key === 'paradigm.storefrontPreference' ? saved : null; },
      setItem(key, value) { if (saved === 'blocked') throw new Error('blocked'); writes.push([key, value]); }
    }
  });
  assert.equal(native.value, native.options.some((option) => option.value === saved) ? saved : 'en-TWD');
  native.value = 'en-USD';
  assert.doesNotThrow(() => listeners.forEach((fn) => fn()));
  if (saved !== 'blocked') assert.deepEqual(writes, [['paradigm.storefrontPreference', 'en-USD']]);
  assert.equal(window.PARADIGM_STOREFRONT.language, 'en');
  assert.equal(window.PARADIGM_STOREFRONT.currency, 'USD');
  assert.equal(window.PARADIGM_STOREFRONT.market, 'international');
}
console.log('DROPDOWN_OK escaping=true nativeFallback=true splitLabels=true preferences=true storageFailure=true');
