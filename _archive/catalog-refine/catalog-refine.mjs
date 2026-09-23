export function buildCatalogRefineGroups(config, products) {
  return config.groups.map((group) => {
    if (group.kind === "range") {
      const prices = products.map((product) => product.salePrice ?? product.listPrice);
      return { ...group, min: Math.min(...prices), max: Math.max(...prices) };
    }
    if (!group.field) return group;
    const options = group.field === "colors"
      ? products.flatMap((product) => product.colors.map((color) => ({ value: color.id, label: color.label })))
      : products.map((product) => {
        const value = product[group.field];
        if (!group.labels[value]) throw new Error(`Missing ${group.name} label for ${value}`);
        return { value, label: group.labels[value] };
      });
    return {
      ...group,
      options: [...new Map(options.map((option) => [option.value, option])).values()]
        .sort((left, right) => left.label.localeCompare(right.label, "en"))
    };
  });
}
