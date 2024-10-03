# hbfontcompare
A HarfBuzz JS shaping and font comparison web-based tool.

It was based on code from the harfbuzzjs demo - https://github.com/harfbuzz/harfbuzzjs.

# Live

https://mattmatic.github.io/hbfontcompare/

# Usage

- Drag and drop a font file onto the Font table cell (it will turn yellow)
    - The "Swap" button helps to toggle between fonts
    - Note: font name and version is shown
- You can drag and drop a .txt file with lines of words to quickly check a set of hundreds of words:
	- Drag and drop over the `Text:` table cell (it will turn yellow)
	- Then use First/Prev/Next/Last to quickly scroll through all the test words for the font.
		- Alt-1 / 2/ 3/ 4 are keyboard shortcuts
- The Script/Language/Direction will auto guess if Script is blank.
- The Features text box allows OpenType features
	- e.g. `+jalt` to enable justification alternatives
	- e.g. `-liga` to disable ligatures
- Scale should normally be 1000
	- Double click to reset to 1000
- Stretch / Offset
	- Stretch pulls the glyphs apart
	- Offset pulls font #2 to the right.
- Color decides how the glyph output is rendered.
	- Font 1 is blue on top
	- Font 2 is orange underneath
	- You can change the solid colours
- Opacity can be adjusted for fill and stroke for both fonts
- Options
	- GIDs shows the glyph IDs underneath the glyphs
	- Baseline shows the baseline and x-origin
- The "Result" at the bottom is the JSON output from HarfBuzz
	- g = glyphID
	- cl = cluster
	- ax & ay = advance x&y
	- dx & dy = delta x&y
	- flags
- The "Download SVG" button saves the SVG file so you can share!


# Other useful tools
To go deeper, Simon Cozen's excellent Crowbar gives more insight into the HarfBuzz shaping operations.
https://www.corvelsoftware.co.uk/crowbar/

And, of course, HarfBuzz - https://harfbuzz.github.io/

# Library Links
- https://github.com/danbovey/fontname
- https://github.com/photopea/Typr.js/
- https://minify-js.com/

