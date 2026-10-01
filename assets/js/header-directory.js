(function () {
  const directory = document.querySelector('[data-header-directory]');
  if (!directory) return;
  const large = matchMedia('(min-width: 64rem)');
  const hover = matchMedia('(any-hover: hover)');
  const drawer = document.querySelector('.drawer-nav');
  const region = drawer?.querySelector('[data-dropdown]');
  const regionSlot = document.querySelector('[data-storefront-slot]');
  const groups = Array.from(directory.querySelectorAll('[data-header-group]'));
  let active = null;
  let pinned = false;
  directory.dataset.enhanced = 'true';

  function close(restore = false) {
    if (!active) return;
    const parent = active.querySelector('[data-header-parent]');
    parent.setAttribute('aria-expanded', 'false');
    const panel = active.querySelector('ul');
    panel.hidden = true;
    delete panel.dataset.open;
    delete active.dataset.pinned;
    active = null;
    pinned = false;
    if (restore) parent.focus({ preventScroll: true });
  }
  function closeRegion() { region?.dispatchEvent(new Event('paradigm:dropdown-close')); }
  function open(group, pin = false) {
    if (!large.matches || document.body.dataset.overlayState) return;
    if (active !== group) close();
    closeRegion();
    active = group;
    pinned = pinned || pin;
    group.toggleAttribute('data-pinned', pinned);
    group.querySelector('[data-header-parent]').setAttribute('aria-expanded', 'true');
    const panel = group.querySelector('ul');
    panel.hidden = false;
    panel.dataset.open = 'true';
  }
  groups.forEach(group => {
    const parent = group.querySelector('[data-header-parent]');
    const panel = group.querySelector('ul');
    panel.hidden = true;
    group.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && hover.matches) open(group);
    });
    group.addEventListener('pointerleave', () => {
      if (active === group && !pinned && !panel.contains(document.activeElement)) close();
    });
    parent.addEventListener('click', event => {
      // Preserve native link operations, including opening in a new tab.
      if (!large.matches || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      if (active === group && pinned) return;
      event.preventDefault();
      open(group, true);
    });
    group.addEventListener('keydown', event => {
      if (event.key === 'Escape' && active === group) {
        event.preventDefault(); event.stopPropagation(); close(true);
      } else if (event.target === parent && event.key === ' ') {
        event.preventDefault(); parent.click();
      } else if (event.target === parent && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault(); open(group);
        const links = panel.querySelectorAll('a');
        links[event.key === 'ArrowDown' ? 0 : links.length - 1]?.focus();
      }
    });
    group.addEventListener('focusout', event => {
      if (event.relatedTarget && !group.contains(event.relatedTarget) && active === group) close();
    });
  });
  document.addEventListener('pointerdown', event => { if (active && !active.contains(event.target)) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && active) close(true); });
  document.addEventListener('paradigm:dropdown-open', () => close());
  document.addEventListener('paradigm:overlay-open', () => { close(); closeRegion(); });
  function responsive() {
    const directoryFocused = directory.contains(document.activeElement);
    close(); closeRegion();
    const restore = region?.contains(document.activeElement);
    if (region && regionSlot && drawer) (large.matches ? regionSlot : drawer).append(region);
    if (!large.matches && (restore || directoryFocused)) document.querySelector('[data-nav-toggle]')?.focus({ preventScroll: true });
    else if (restore) region.querySelector('.dropdown__trigger')?.focus({ preventScroll: true });
  }
  large.addEventListener('change', responsive);
  responsive();
})();
