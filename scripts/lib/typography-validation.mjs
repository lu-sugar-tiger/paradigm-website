// Exclude only the approved static heading treatment from the no-scale-motion checks.
// A hover selector, animation keyframe, different value, or another file still fails.
export function withoutStaticHeadingScale(source, file) {
  const approved = file === "base.css"
    ? new Map([
      [":where(h1)", "var(--type-heading-width-scale) 1"],
      [".type-h1", "var(--type-heading-width-scale) 1"],
      [".type-h2", "var(--type-heading-width-scale) 1"],
      [".type-h3", "var(--type-heading-width-scale) 1"],
      [".type-small, .type-body, .type-h4, .type-h5, .type-h6", "none"]
    ])
    : file === "components.css"
      ? new Map([
        [".hero__title", "var(--type-heading-width-scale) 1"],
        [".breadcrumb :where(a, h1, h2, h3, h4, h5, h6, .breadcrumb__current)", "none"],
        [".product-detail__header h1", "none"]
      ])
      : new Map();
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/([^{}]+)\{([^{}]*)\}/g, (rule, selector, body) => {
    const expected = approved.get(selector.trim().replace(/\s+/g, " "));
    if (!expected) return rule;
    return `${selector}{${body.replace(/(^|;)\s*scale\s*:\s*([^;]+);/g, (declaration, separator, value) => value.trim() === expected ? separator : declaration)}}`;
  });
}
