# Teamwear fabric section archive

`section.html` and `section.css` preserve the last removed section from this task: the Construction eyebrow, Made for players title, LightWeight / QuickDry / SmoothPrint feature text, and full-viewport fabric photograph. `fabric-square.webp` is the original 1200 x 1200 image moved from `assets/images/teamwear/rail/`, unchanged.

The fragment retains its original `/teamwear/`-relative asset URL as a restoration reference. It is not a standalone preview page. Shared heading, container, typography, token, and reveal behavior are still owned by the active design system.

To restore after explicit approval:

1. Move the image back to `assets/images/teamwear/rail/fabric-square.webp`.
2. Insert `section.html` between `.teamwear-colorways` and `.teamwear-gallery` in `scripts/templates/teamwear-page.html`.
3. Merge `section.css` into `assets/css/teamwear-story.css`, then update its asset version.
4. Update the public omission assertions and design documentation for the approved release, regenerate, and verify desktop/mobile layouts.

Normal builds never read these files. No source images or other Teamwear sections are changed by this archive.
