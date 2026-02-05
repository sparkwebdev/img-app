# CLAUDE.md

## Project Overview

Art Walk Weekends Image Prep Tool — a fully client-side web app for artists to prepare artwork images for Art Walk Porty submission. No server, no build step. All processing happens in the browser.

**Live:** https://art-walk-img-prep.netlify.app
**Repo:** https://github.com/sparkwebdev/img-app

## File Structure

```
img-app/
  index.html              Single-page app (Alpine.js markup, CDN links)
  css/styles.css          Design tokens, layout, slot states, responsive
  js/app.js               Alpine.js component: state, validation, downloads
  js/image-processor.js   Canvas resize + iterative JPEG compression
  images/logo.png         Art Walk Projects logo
```

No build tools, bundlers, or package.json. All dependencies via CDN.

## Tech Stack

- **Alpine.js 3.x** — reactivity (`x-data`, `x-show`, `x-model`, `x-for`)
- **Canvas API** — image resize and JPEG compression
- **heic-to 1.3.0** — HEIC/HEIF→JPEG conversion (lazy-loaded on first HEIC upload, not in HTML)
- **IBM Plex Mono** — Google Fonts (300/400/700)
- All output is JPEG regardless of input format

## User Flow (4 steps)

1. **Landing** — rules, requirements, "Get Started"
2. **Name** — artist name input, live filename preview, sanitization
3. **Upload** — drag-and-drop + click, 5 image slots, validation, processing with progress bar
4. **Results** — processed images listed with individual download buttons

## Image Processing Pipeline

1. Load file → `Image()` via object URL
2. Resize: cap longest edge at 2000px, maintain aspect ratio
3. Draw to canvas with `imageSmoothingQuality: 'high'`
4. Iterative JPEG compression: quality 0.92 → 0.30, step 0.05, target ≤ 1MB
5. Sequential processing (not parallel) to limit memory usage

## Validation Rules

- **Formats:** JPG, PNG, WebP, HEIC/HEIF
- **Max file size:** 10MB per image (checked before HEIC conversion)
- **Min dimensions:** 1500px on longest edge
- **Duplicates:** blocked by matching filename + file size
- **Slot count:** exactly 5 required

## Key Architecture Decisions

- **No `x-transition:leave`** on step panels — removed to prevent overlap/jump during transitions
- **HEIC library lazy-loaded** — avoids 2.7MB payload for users who don't need it
- **`beforeunload` warning** — active once user leaves the landing step
- **No "Download All" / ZIP** — removed because multiple downloads and zips are unreliable on iOS
- **Slot removal via click overlay** — click image → Remove/Cancel overlay (not hover X button)
- **`@click.outside`** on delete overlay dismisses it

## Branding

- Primary: `#0774B0` (deep blue)
- Secondary: `#6C8811` / `#92B233` (greens)
- Error: `#C0392B` (darkened for WCAG AA)
- Text: `#263D45` on `#FFFFFF`
- Font: IBM Plex Mono
- Logo: `images/logo.png`

## Deployment

Static files deployed directly to Netlify:

```bash
netlify deploy --prod --dir=.
```

No build command needed. Push to GitHub then deploy, or deploy directly.

## Accessibility

- `aria-labelledby` on each step panel
- `role="list"` / `role="listitem"` on slot grid and results
- `role="alert"` on error messages
- `role="progressbar"` with `aria-valuenow` on progress bar
- `aria-live="polite"` region for screen reader announcements
- Focus management: heading focused on each step transition
- Keyboard support: Enter/Space on dropzone, tab navigation
- `x-cloak` prevents flash of unstyled content

## Responsive Breakpoints

- **600px:** 2-column slot grid, stacked buttons (column-reverse), reduced padding
- **400px:** wrapped result rows
