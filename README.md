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
	- Bounding Box shows a shaded rectangle for the extents of each glyph
	- Origins places a small dot on the origin of each glyph
- The "Result" at the bottom is the JSON output from HarfBuzz
	- g = glyphID
	- cl = cluster
	- ax & ay = advance x&y
	- dx & dy = delta x&y
	- flags
- The "Download SVG" button saves the SVG file so you can share!


## Stepping through GSUB/GPOS
The "Timeline" 'scrubber' can let you walk through the GSUB and GPOS table rules to debug rules.
When the slider is fully at the left, the final output is shown (this is the default).

Each HarfBuzz debug output is displayed beneath the timeline - including the phase (GSUB/GPOS), the index, and the text.

During the GSUB phase, the glyphs are shown strictly side-by-side (since there is no HarfBuzz positioning information yet). If a glyph has a zero-width, the JS code will advance one-sixth of the em-width. This is also helpful for complex tables, such as for Noto Nastaliq Urdu, where surrogate glyphs are used in the initial stages.

Note: The "Results" output shows `ax`, `ay`, `dx`, and `dy` for the JavaScript logic defined dimensions (HarfBuzz outputs them all as zero in this phase).

Once the GPOS phase starts, the position and advance metrics are available and the glyphs are shown appropriately.

Using the "Copy Trace #1" button will put the complete HarfBuzz debug output on the clipboard.
The JS code indents each line to help identify the levels of each GSUB/GPOS call.


# Other useful tools
To go deeper, Simon Cozen's excellent Crowbar gives more insight into the HarfBuzz shaping operations.
https://www.corvelsoftware.co.uk/crowbar/

And, of course, HarfBuzz - https://harfbuzz.github.io/

# Library Links
- https://github.com/danbovey/fontname
- https://github.com/photopea/Typr.js/
- https://minify-js.com/

