(function () {
  const catalog = document.querySelector("[data-catalog]");
  if (!catalog || !window.PARADIGM_CATALOG) return;
  const dropdown = catalog.querySelector("[data-dropdown-grouped]");
  const grid = catalog.querySelector(".product-grid");
  const itemsByCode = new Map(window.PARADIGM_CATALOG.items.map((item) => [item.code, item]));
  const entries = Array.from(grid.children, (card, catalogIndex) => ({
    card,
    catalogIndex,
    item: itemsByCode.get(card.getAttribute("href").split("/").filter(Boolean).at(-1))
  }));
  const price = (item) => item.salePrice ?? item.listPrice;
  function update(values = {}) {
    const sort = values.sort?.[0] || "newest";
    const colors = values.color || [];
    const lines = values.line || [];
    const types = values.type || [];
    const min = values["price-min"]?.[0] ? Number(values["price-min"][0]) : -Infinity;
    const max = values["price-max"]?.[0] ? Number(values["price-max"][0]) : Infinity;
    let count = 0;
    entries.sort((left, right) => {
      const newest = Number(right.item.sequence) - Number(left.item.sequence);
      const stable = left.catalogIndex - right.catalogIndex;
      if (sort === "oldest") return -newest || stable;
      if (sort === "price-asc") return price(left.item) - price(right.item) || newest || stable;
      if (sort === "price-desc") return price(right.item) - price(left.item) || newest || stable;
      return newest || stable;
    }).forEach(({ card, item }) => {
      const matches = (!colors.length || item.colors.some((color) => colors.includes(color.id)))
        && (!lines.length || lines.includes(item.lineCode))
        && (!types.length || types.includes(item.typeCode))
        && price(item) >= min && price(item) <= max;
      card.hidden = !matches;
      if (matches) count++;
      grid.append(card);
    });
    catalog.querySelector("[data-catalog-empty]").hidden = count > 0;
    const status = `${count} ${count === 1 ? "product" : "products"}`;
    dropdown.querySelector("[data-dropdown-status]").textContent = status;
    catalog.querySelector("[data-catalog-status]").textContent = status;
    const active = colors.length + lines.length + types.length + Number(Number.isFinite(min) || Number.isFinite(max));
    const label = active ? `Refine (${active})` : "Refine";
    dropdown.querySelector("[data-dropdown-value]").textContent = label;
    dropdown.querySelector(".dropdown__trigger").setAttribute("aria-label", label);
  }
  dropdown.addEventListener("paradigm:dropdown-change", (event) => update(event.detail.values));
  update();
})();
