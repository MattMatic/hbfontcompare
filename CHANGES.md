# Change Notes

## 2026-11-03
- Every HarfBuzz version from 10.0.0 to 15.0.0 can be chosen in the HarfBuzz Version drop-down
	- Versions marked *(web)* are loaded from the jsDelivr CDN on first use; 11.0.1 to 12.3.0 are bundled
	- harfbuzzjs 1.x (HarfBuzz 14.2.0 and later) has no raw WASM access; `js/hb-engine.mjs` wraps it, traces through the buffer message callback, and glyph outlines for Compare Fonts are drawn by the bundled engine
	- The chosen version is kept in the address as `?hb=14.3.0` so a link can be shared
- Timeline: HarfBuzz 13.x and later put advances and offsets (as zeros) in the trace from the very first step, which piled every glyph on top of each other during GSUB. Positions are now only used once GPOS has started; before that the glyph bounds set the spacing, as with 12.3.0
- Timeline: the decompose / reorder / compose steps hold Unicode code points rather than glyph IDs; each is now shown as its nominal glyph (via the font's cmap)

## 2025-12-23
- Added console function `setBrowserMode(true)` to switch to non-traced HarfBuzz mode.
	- To cross-check issues like Noto Sans Bengali v3.000 with HarfBuzz < 12.2.0
	- `setBrowserMode(false)` switches back to normal mode

## 2025-12-18
- Add choice of HarfBuzz versions

## 2025-12-10
- Fix transfer issues from Font Compare Word List

## 2025-12-09
- Add Difference highlighting
	- Required Clipper2, Bezier flattening, and some other code
	- The main script block needed to be a module.
- Add Line number navigation
- Remove "Scale" option

…

## 2024-10-03
- New drag and drop sites
	- Font 1, Font 2, and Text word list handled separately
	- Rather than using radio buttons, drag over the TEXT or FONT table cells.
	- The cell will turn yellow as you drag
- Text lines are handled by drag and drop
 	- Showing thousands of lines took too long
	- NOTE: Text will only accept `.txt` files
- Use `fontname.js` (based on `Typr.js`) to extract font name and version.

## 2024-09-07
- Initial release

