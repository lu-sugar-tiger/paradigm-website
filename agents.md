# Project overview

Paradigm is a responsive fashion brand website.

The website will initially operate as:

- a brand-owned content hub
- a product showcase
- a lookbook and collection archive
- a Teamwear inquiry channel
- a traffic bridge to Shopee for product purchases

The site is expected to remain a non-transactional brand website for approximately one to two years. It may later be migrated to Shopify.

The current goal is to build a low-cost, maintainable, Shopify-ready frontend without prematurely implementing ecommerce infrastructure.

# Current business flows

## Product sales

- Products are displayed on the Paradigm website.
- Purchase actions redirect users to the corresponding Shopee product page.
- Do not implement cart, checkout, payment, inventory, account, or order systems.

## Teamwear

- Teamwear pages should explain the service and guide users toward an inquiry.
- Inquiry actions may use a form, email, Instagram, Shopee chat, or another external channel.
- Do not build a CRM or custom backend unless explicitly requested.

## Brand content

The website should support:

- collection-led editorial content
- collections
- products
- product detail pages
- lookbooks
- collection archives
- Teamwear
- brand information
- external social and sales links

# Technology

- Semantic HTML5
- CSS
- Vanilla JavaScript
- No frontend framework
- No build tool unless explicitly approved
- No backend unless explicitly approved
- No external UI library unless explicitly approved
- Support current desktop and mobile browsers

# Future Shopify migration

The current site should be structured so that its visual system and frontend components can later be adapted into a Shopify theme.

Use component boundaries that map naturally to Shopify concepts:

- Header → section
- Footer → section
- Collection headline → section
- Editorial content block → section
- Product grid → section
- Product card → snippet
- Image with text → section
- Teamwear CTA → section

Do not write Shopify Liquid or Shopify-specific integration yet.

Do not introduce complexity only for a possible future migration. Prioritize clean HTML, reusable CSS, structured data, and stable URLs.

# Information architecture

Use these stable public URL structures so they can later map cleanly to Shopify:

- `/` redirects to `/collections/all`
- `/collections/{collection-name}`
- `/products/{product-number}`
- `/lookbook/`
- `/lookbook/{collection-slug}/`
- `/teamwear`

Do not include `index.html` in public links, canonical URLs, or navigation. The static files may still use directory-level `index.html` files internally.

Avoid unnecessary URL changes once pages are published.

# Content and data

- Keep product and collection data separate from page markup where practical.
- Use structured JSON or JavaScript data during the static-site phase.
- Do not duplicate the same product data across multiple HTML files.
- Each product should support:
  - slug
  - product number
  - title
  - category
  - price
  - description
  - images
  - available colors
  - available sizes
  - Shopee URL
- Use realistic placeholder content when final content is unavailable.
- Clearly identify placeholder content.

# Design direction

- Minimal editorial fashion aesthetic
- Mostly monochrome palette
- Compact typography
- Generous whitespace
- Strong photography
- Mobile-first responsive layout
- Product presentation should feel visual and editorial rather than marketplace-like
- Match supplied Paradigm designs and assets closely
- Do not invent major visual directions without approval

# Reusable interface components

Prefer reusable structures and consistent class names for:

- announcement bar
- header
- desktop navigation
- mobile navigation drawer
- collection headline
- product grid
- product card
- product detail gallery
- product information
- editorial section
- image-with-text section
- lookbook section
- Teamwear CTA
- external purchase button
- inquiry button
- footer

# CSS architecture

- Store design values in CSS custom properties.
- Define tokens for colors, typography, spacing, layout widths, borders, and transitions.
- Use mobile-first responsive rules.
- Avoid inline styles.
- Avoid excessive selector nesting.
- Avoid page-specific duplication when a reusable component is appropriate.
- Keep component styles independent where practical.

Suggested organization:

```text
assets/css/
  tokens.css
  reset.css
  base.css
  layout.css
  components.css
  pages.css
```

# JavaScript rules

- Keep JavaScript minimal and progressively enhanced.
- The website's primary content must remain accessible without JavaScript.
- Use JavaScript only for interactions such as:
  - mobile navigation
  - image galleries
  - carousels
  - accordions
  - filters
- Avoid storing core page content only in JavaScript unless it is generated from structured local data.
- Avoid large global scripts.
- Do not add dependencies without approval.

# Accessibility

- Use semantic landmarks and heading hierarchy.
- All meaningful images must have useful alt text.
- Interactive elements must be keyboard accessible.
- Navigation drawers and dialogs must manage focus correctly.
- Do not use clickable `div` elements where a link or button is appropriate.
- Respect reduced-motion preferences.
- Maintain sufficient text contrast.

# Performance

- Optimize images and use appropriate responsive image sizes.
- Lazy-load below-the-fold images.
- Avoid layout shifts caused by missing image dimensions.
- Avoid unnecessary scripts and dependencies.
- Keep the initial page lightweight.

# SEO

- Use one clear `h1` per page.
- Add descriptive page titles and metadata.
- Use semantic content rather than image-only text.
- Use stable slugs.
- Add canonical URLs when the production domain is known.
- Preserve URLs or define redirects during a future Shopify migration.

# Working rules

- Inspect the existing repository before editing.
- Follow existing patterns when they are reasonable.
- Before major structural changes, explain the proposed approach.
- When design references are supplied, keep each reference in its own folder under `references/` and store any companion Figma-exported CSS beside the image it belongs to.
- When both a reference image and Figma-exported CSS are available, use the image as the visual source of truth and use the CSS primarily for dimensions, spacing, and typography values.
- Do not add frameworks, dependencies, ecommerce functionality, or backend services without approval.
- Do not replace supplied assets without a reason.
- Do not delete existing work unless necessary.
- Keep changes small and reviewable.
- Clearly state assumptions when requirements are incomplete.

# Current development phase

The current phase is focused on building the reusable website shell.

Prioritize:

1. design tokens
2. responsive layout system
3. header and navigation
4. footer
5. reusable editorial sections
6. product grid and product cards
7. collection page shell
8. product detail page shell
9. Teamwear page shell

Use placeholder images and content where final material is unavailable.

Do not implement:

- cart
- checkout
- payment
- inventory synchronization
- customer accounts
- order management
- Shopify APIs
- Shopee APIs
- CMS
- custom backend

# Validation

Before considering a task complete:

- Check desktop and mobile layouts.
- Check common viewport widths.
- Confirm there is no unintended horizontal overflow.
- Confirm navigation works with keyboard controls.
- Confirm there are no browser console errors.
- Confirm links and buttons use the correct semantic elements.
- Confirm external purchase links clearly indicate that users are leaving the site.
- Summarize changed files and remaining placeholder content.
