# Archived features

Archived on 2026-09-23. These files are retained for future development and are not inputs to the public site generator.

| Feature | Archive | Public behavior |
| --- | --- | --- |
| Catalog Refine | `catalog-refine/` | All collection products appear latest first; no sort/filter controls or runtime |
| Teamwear fabric section | `teamwear-fabric/` | Entire section omitted; Colorways leads directly to Athletes |

The current host is GitHub Pages, publishing `main:/` through its branch-based Jekyll build. `_config.yml` explicitly excludes `_archive`; underscore-prefixed directories are also excluded by Jekyll by default. The archive is intentionally not in `.gitignore`, so it can be committed with the rest of the progress. This excludes it from the website, not from access to the Git repository.

Do not add `.nojekyll`, configure `include: [_archive]`, or copy this archive into a custom deployment artifact. If hosting changes, preserve this exclusion in the new publishing process.

Before pushing, run:

```text
node scripts/build-site.mjs --check
node scripts/validate-catalog-refine.mjs
node scripts/validate-feature-archive.mjs
git diff --check
```

Archive/restoration is separate from publishing. Re-enabling either feature requires an explicit source change, regeneration, and desktop/mobile validation. A normal rebuild or push does not restore them. No automated development-preview mode is introduced.

Reference: https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll
