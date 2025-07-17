// Selected methods from opentype.js/src/layout.mjs
// 
// binary search in a list of ranges (coverage, class definition)
function searchRange(ranges, value) {
    // jshint bitwise: false
    let range;
    let imin = 0;
    let imax = ranges.length - 1;
    while (imin <= imax) {
        const imid = (imin + imax) >>> 1;
        range = ranges[imid];
        const start = range.start;
        if (start === value) {
            return range;
        } else if (start < value) {
            imin = imid + 1;
        } else { imax = imid - 1; }
    }
    if (imin > 0) {
        range = ranges[imin - 1];
        if (value > range.end) return 0;
        return range;
    }
}


function Layout(font, tableName) {
    this.font = font;
    this.tableName = tableName;
}

Layout.prototype = {
    /**
     * Find a glyph in a class definition table
     * https://docs.microsoft.com/en-us/typography/opentype/spec/chapter2#class-definition-table
     * @param {object} classDefTable - an OpenType Layout class definition table
     * @param {number} glyphIndex - the index of the glyph to find
     * @returns {number} -1 if not found
     */
     getGlyphClass: function(classDefTable, glyphIndex) {
        switch (classDefTable.format) {
            case 1: {
                if (classDefTable.startGlyph <= glyphIndex && glyphIndex < classDefTable.startGlyph + classDefTable.classes.length) {
                    return classDefTable.classes[glyphIndex - classDefTable.startGlyph];
                }
                return 0;
            }
            case 2: {
                const range = searchRange(classDefTable.ranges, glyphIndex);
                return range ? range.classId : 0;
            }
        }
    },
};

export default Layout;

