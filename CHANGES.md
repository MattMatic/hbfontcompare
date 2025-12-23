# Change Notes

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

