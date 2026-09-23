# Teamwear hero video

Source: `assets/temp/10.mp4` (unchanged). The single upscaled and loop-edited master is `assets/temp/teamwear-hero-master.mkv`, FFV1 lossless, 2160×3840. Source and master stay in the ignored staging folder and must not be deployed. Only the three web videos and posters under `assets/videos/teamwear/` are public.

## Reproduce

Run `node scripts/prepare-teamwear-video.mjs --ffmpeg <path-to-ffmpeg>` with an FFmpeg build supporting libzimg, FFV1, libx264, and libwebp. `ffprobe` is expected beside FFmpeg, or can be supplied with `--ffprobe`. `--reuse-master` skips master preparation when exporting unchanged master content. No browser runtime dependency is added.

`data/teamwear-video.json` is the asset recipe and build source of truth. Processing uses Spline36 once to upscale to the shared master, then Lanczos3 to downsample each branch before cropping. No sharpening, synthetic detail, or optical-flow frame interpolation is applied. Preserve 24000/1001 fps. The supplied source does not declare color primaries/transfer/matrix/range; preparation explicitly assumes standard HD BT.709 limited range and records output color metadata.

| View | Master | Downsampled frame (in memory only) | Final export |
| --- | --- | --- | --- |
| Base <768px | 2160×3840 | 1080×1920 | 1080×1920, 9:16 |
| Medium 768–1023px | 2160×3840 | 1440×2560 | 1440×1440, 1:1 |
| Large ≥1024px | 2160×3840 | 1920×3414 | 1920×1080, 16:9 |

Crop Y uses 60% of available vertical excess, rounded to an even pixel. Browser `object-fit: cover` with centered positioning handles remaining hero-aspect differences. Hero geometry and content gutters are unchanged. The asset is selected at initialization; resize does not reload playback.

## Loop and motion

The preparation script reads `--motion-duration-image` from shared tokens (1400ms), quantized to 34 source frames. The closing 34 frames dissolve into the opening 34 frames under a baked soft amber/cream edge glow. The sine-squared glow envelope is zero at both ends, peaks at 0.38, and is never a full-white flash. These are video-edit recipe parameters, not runtime UI animation tokens.

The file begins at source frame 34; its final frame is source frame 33, making the file seam consecutive footage. The normal middle sequence precedes the baked overlap. Every crop shares that same loop timeline. The master is losslessly encoded after compositing; web exports are silent fast-start H.264, yuv420p, CRF 22. Generated `manifest.json` records dimensions, frame counts, hashes, and file sizes.

## Runtime and fallback

`hero-video.js` loads only on the landing page. Video is muted, looping, inline, and initially source-less so reduced-motion, data-saving, and no-JavaScript visits do not automatically fetch the video. A responsive poster is immediately available and remains underneath until the first decoded video frame. Poster-to-video reveal uses shared entrance duration/easing. The hero control uses existing icon/control/color/focus tokens and shared Material play/pause symbols.

Autoplay rejection leaves a Play button and poster. Manual pause persists across scrolling and tab changes; offscreen and hidden-document pauses resume only when playback is still wanted. Reduced-motion/data-saving changes stop automatic playback; explicit Play opts in. A media error restores the poster and hides the unusable control. No timer-driven loop animation or `ended` seeking is used.
