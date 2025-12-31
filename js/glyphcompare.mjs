// Glyph Compare Tools for Font Compare Word List

"use strict";

import Clipper2ZFactory from "./clipper2z.js"
import {quadBezFlatten, cubicBezNumQuadratics, evalQuadBez} from "./flatbezier.js"
const promises = [
      Clipper2ZFactory(),
      createHarfBuzz()
    ];

let Clipper2Z;
let Clipper2ZUtils;

Promise.all(promises).then(([aClipper2Z]) => {
  Clipper2Z = aClipper2Z;

  // -v-v-v- DEBUG: make these available outside the module
  window.Clipper2Z = Clipper2Z;
  // -^-^-^-
  onResourcesLoaded();
});


function onResourcesLoaded() {
  //console.log('Resources loaded');
}

function isAssigned(obj) {
  if (typeof obj === 'undefined') return false;
  if (obj === null) return false;
  return true;
}

// Class to wrap up a Clipper2 Paths64 and Bounding Box
// and provide some basic optimisation calculations
export class CPaths64 {
  constructor(paths64, dontFindBoundingBox) {
    this.bbox = {x:{min:NaN, max:NaN},y:{min:NaN, max:NaN},width:0,height:0};
    if (paths64) {
      this.paths64 = paths64;
      if (!dontFindBoundingBox) this.findBoundingBox();
    }
    else {
      this.paths64 = new Clipper2Z.Paths64();
    }
  }
  destroy() {
    this.freePath();
  }
  freePath() {
    if (!this.paths64) return;
    this.paths64.clear();
    this.paths64.delete();
    delete this.paths64;
  }
  // Iterate through the paths and each path to find bounding box
  findBoundingBox() {
    this.bbox = {x:{}, y:{}}
    const size = this.paths64.size();
    for (let i=0; i<size; i++) {
      const path = this.paths64.get(i);
      const sizep = path.size();
      for (let ii=0; ii<sizep; ii++) {
        const point = path.get(ii);
        const x = Number(point.x);
        const y = Number(point.y);
        if (!isAssigned(this.bbox.x.min) || (x < this.bbox.x.min)) this.bbox.x.min = x;
        if (!isAssigned(this.bbox.x.max) || (x > this.bbox.x.max)) this.bbox.x.max = x;
        if (!isAssigned(this.bbox.y.min) || (y < this.bbox.y.min)) this.bbox.y.min = y;
        if (!isAssigned(this.bbox.y.max) || (y > this.bbox.y.max)) this.bbox.y.max = y;
        point.delete();
      }
      path.delete();
    }
    this.updateWidthHeight();
  }
  // Update just the bounding box width and height
  updateWidthHeight() {
    this.bbox.width  = (this.bbox.x.max - this.bbox.x.min);
    this.bbox.height = (this.bbox.y.max - this.bbox.y.min);
  }
  // Return the bound box
  getBoundingBox() {
    return this.bbox;
  }
  // Iterate through all paths and remove any that are smaller than `minArea`
  removeSmallAreas(minArea) {
    const { AreaPath64, Paths64 } = Clipper2Z;
    const count = this.paths64.size();
    var output = new Paths64();
    for (let i=0; i<count;i++) {
      const path = this.paths64.get(i);
      const area = Math.abs(AreaPath64(path));
      if (area >= minArea) {
        output.push_back(path);
      } else {
        path.delete();
      }
    }
    this.freePath();
    this.setPaths64(output);
    this.findBoundingBox(); // Might have changed if small areas were on the outside edges
  }
  getArea() {
    const { IsPositive64, AreaPath64, Paths64 } = Clipper2Z;
    const count = this.paths64.size();
    var sums = {fill:0, hole:0};
    for (let i=0; i<count; i++) {
      const path = this.paths64.get(i);
      const area = Math.abs(AreaPath64(path));
      if (IsPositive64(path)) {
        sums.fill += area;
      } else {
        sums.hole += area;
      }
      path.delete();
    }
    sums.fill -= sums.hole;
    return sums;
  }
  // Set this CPaths64 to a Clipper2Z Paths64 value, updating the bounding box
  setPaths64(ps64, dontFindBoundingBox) {
    if (ps64 !== this.paths64) {
      this.freePath();
    }
    this.paths64 = ps64;
    if (!dontFindBoundingBox) this.findBoundingBox();
  }
  // Translate this path by (oxi, oyi) and return a new CPaths64
  translateToNewCPaths64(oxi, oyi) {
    oxi = Math.round(Number(oxi));
    oyi = Math.round(Number(oyi));
    const { TranslatePaths64 } = Clipper2Z;
    var result = new CPaths64(TranslatePaths64(this.paths64, oxi, oyi), true);
    result.bbox.x.min = this.bbox.x.min + oxi;
    result.bbox.x.max = this.bbox.x.max + oxi;
    result.bbox.y.min = this.bbox.y.min + oyi;
    result.bbox.y.max = this.bbox.y.max + oyi;
    return result;
  }
  // Inflate this path by `idelta` and return a new CPaths64 object.
  // settings.jointype = JoinType.Miter
  // settings.mitreLimit = 25
  // settings.arcTolerance = 0.1
  // settings.simplifyFactor = 0.5
  inflateToNewCPaths64(idelta, settings) {
    const { MakePath64, Paths64, InflatePaths64, SimplifyPaths64, JoinType, EndType } = Clipper2Z;
    var result = new CPaths64();
    settings = settings || {};
    if (!isExists(settings.jointype)) settings.jointype = /*JoinType.Miter; */ JoinType.Round;
    if (!isExists(settings.mitreLimit)) settings.mitreLimit = 25; //idelta;// * idelta; //25
    if (!isExists(settings.arcTolerance)) settings.arcTolerance = 0.1;
    if (!isExists(settings.simplifyFactor)) settings.simplifyFactor = 0.1;
    var newpaths64 = InflatePaths64(this.paths64, idelta, settings.jointype, EndType.Polygon, settings.mitreLimit, settings.arcTolerance);
    if (settings.simplifyFactor > 0) {
      var oldpaths64 = newpaths64;
      newpaths64 = SimplifyPaths64(oldpaths64, settings.simplifyFactor);
      oldpaths64.clear();
      oldpaths64.delete();
    }
    result.setPaths64(newpaths64);
    //--//this.removeSmallAreas(idelta * idelta);
    return result;
  }
  // Check whether this and `cp` are far away (using the bounding boxes)
  isFarAway(cp) {
    // Comparing bounding boxes to optimise calculations
    if (cp.bbox.x.min > this.bbox.x.max) return true;
    if (cp.bbox.x.max < this.bbox.x.min) return true;
    if (cp.bbox.y.min > this.bbox.y.max) return true;
    if (cp.bbox.y.max < this.bbox.y.min) return true;
    return false; // _might_ collide. Need to do geometry
  }
  // Check for collisions between this and `cp`
  // Returns null if no collision.
  // Otherwise returns a new CPaths64 with the intersection
  collisionCPath(cp) {
    const { Intersect64, FillRule } = Clipper2Z;
    if (this.isFarAway(cp)) {
      return null;
    }
    var intersect = Intersect64(this.paths64, cp.paths64, FillRule.NonZero);
    if (intersect.size() == 0) {
      intersect.clear();
      intersect.delete();
      return null;
    }
    var result = new CPaths64(intersect);
    return result;
  }
  // Meld `cp` into this CPaths64
  unionWith(cp) {
    const { Union64, FillRule } = Clipper2Z;
    let res = Union64(this.paths64, cp.paths64, FillRule.NonZero);
    this.setPaths64(res, true);
    if (cp.bbox.x.min < this.bbox.x.min) this.bbox.x.min = cp.bbox.x.min;
    if (cp.bbox.x.max > this.bbox.x.max) this.bbox.x.max = cp.bbox.x.max;
    if (cp.bbox.y.min < this.bbox.y.min) this.bbox.y.min = cp.bbox.y.min;
    if (cp.bbox.y.max > this.bbox.y.max) this.bbox.y.max = cp.bbox.y.max;
    this.updateWidthHeight();
  }
  xorWith(cp) {
    const { Xor64, FillRule } = Clipper2Z;
    var res = Xor64(this.paths64, cp.paths64, FillRule.NonZero);
    this.freePath();
    this.setPaths64(res);
  }
  differenceToNewCPaths64(cp) {
    const { Difference64, FillRule } = Clipper2Z;
    return new CPaths64(Difference64(this.paths64, cp.paths64, FillRule.NonZero));
  }
  xorToNewCPaths64(cp) {
    const { Xor64, FillRule } = Clipper2Z;
    return new CPaths64(Xor64(this.paths64, cp.paths64, FillRule.NonZero));
  }
  // Count the positive paths in the set
  // (Used for finding 'far' glyphs)
  countIslands() {
    const { IsPositive64 } = Clipper2Z;
    const size = this.paths64.size();
    var count = 0;
    for (let i=0;i<size;i++) {
      const path = this.paths64.get(i);
      if (IsPositive64(path)) count++;
      path.delete();
    }
    return count;
  }
  // Methods for rendering the original glyph to create the paths
  // Add a single point to the set of points
  // NOTE: updates bounding box
  addPoint(ix, iy) {  // Integer values!
    this.points = this.points || [];
    this.points.push(ix, iy);
    this.last = {x:ix, y:iy};
    if (!(this.bbox.x.min) || (ix < this.bbox.x.min)) this.bbox.x.min = ix;
    if (!(this.bbox.x.max) || (ix > this.bbox.x.max)) this.bbox.x.max = ix;
    if (!(this.bbox.y.min) || (iy < this.bbox.y.min)) this.bbox.y.min = iy;
    if (!(this.bbox.y.max) || (iy > this.bbox.y.max)) this.bbox.y.max = iy;
  }
  // Close the path, back to the beginning, and add to the paths.
  // NOTE: bounding box already updated with `addPoint`
  closePath() {
    const { MakePath64, Paths64 } = Clipper2Z;
    if (this.points.length > 0) {
      if (!this.paths64) {
        this.paths64 = new Paths64();
      }
      this.points.push(this.points[0], this.points[1]); // Close the path back to the beginning
      this.paths64.push_back(MakePath64(this.points));
      delete this.points;
      this.last = {};
      this.updateWidthHeight();
    }
  }
}

export class GlyphCompareClass {
  constructor(hb) {
    this.glyphs = {};
    this.hbFix = false;
    this.setHarfBuzz(hb);
  }
  setHarfBuzz(hb) {
    const fbOld = this.fontBlob;
    this.freeFont();
    this.hb = hb;
    this.setFontBlob(fbOld);
  }
  destroy() {
    this.freeFont();
    if (this.paths64) {
      this.paths64.destroy();
      delete this.paths64;
    }
  }
  freeFont() {
    if (this.font) { this.font.destroy(); delete(this.font); }
    if (this.face) { this.face.destroy(); delete(this.face); }
    if (this.blob) { this.blob.destroy(); delete(this.blob); }
    //this.glyphs = {};
    this.freeGlyphCache();
  }
  freeGlyphCache() {
    if (!this.glyphs) return;
    if (this.glyphs && (this.glyphs.length>0)) {
      Object.keys(this.glyphs).forEach(function(k) {
        const e = this.glyphs[k];
        e.cpaths.freePath();
        e.cpathsNear.freePath();
        if (e.cpaths.cpathsNearBase) c.cpathsNearBase.freePath();
        e.cpathsFar.freePath();
      });
    }
    this.glyphs = {};
  }
  setScriptLanguage(script, language) {
    this.script = script;
    this.language = language;
  }
  clearScriptLanguage() {
    this.script = null;
    this.language = null;
  }
  setFeatures(features) {
    this.features = features;
  }
  clearFeatures() {
    this.features = null;
  }
  setFontBlob(fb) {
    this.freeFont();
    this.fontBlob = fb;
    if (!fb) return;

    this.blob = this.hb.createBlob(this.fontBlob);
    this.face = this.hb.createFace(this.blob, 0);
    this.font = this.hb.createFont(this.face);
  }
  //----------------------------------------------------------------------
  // Converts the glyph drawing to an array of point arrays compatible with Clipper2
  // The array is [x0,y0, x1,y1, etc]
  // Also calculates the bound box in `bbox` with width and height
  // NOTE: Cubic Bezier curve flattening not tested yet!!
  glyphToPolyline(glyphId) {
    if (!this.glyphs[glyphId]) {
      var ptr = this.font.ptr;
      const exports = this.hb.hooks.exports;
      const addFunction = this.hb.hooks.addFunction;
      /*
      var lastXY = {};
      var firstXY = {};
      */
      var paths = [];
      var points = [];
      var bbox = {};
      const { MakePath64, Paths64, InflatePaths64, SimplifyPaths64, JoinType, EndType } = Clipper2Z;
      var cpaths = new Paths64();

      var cpaths64 = new CPaths64();
      var updatePoint = function(x, y) {
        x = Math.round(x);
        y = Math.round(y);
        cpaths64.addPoint(x, y);
      }
      if (!drawFuncsPtr) {
        var moveTo = function (dfuncs, draw_data, draw_state, to_x, to_y, user_data) {
          //pathBuffer += `M${to_x},${to_y}`;
          // Starting a new set
          updatePoint(to_x, to_y);
        }
        var lineTo = function (dfuncs, draw_data, draw_state, to_x, to_y, user_data) {
          //pathBuffer += `L${to_x},${to_y}`;
          updatePoint(to_x, to_y);
        }
        var cubicTo = function (dfuncs, draw_data, draw_state, c1_x, c1_y, c2_x, c2_y, to_x, to_y, user_data) {
          //pathBuffer += `C${c1_x},${c1_y} ${c2_x},${c2_y} ${to_x},${to_y}`;
          // Flatten Cubic Bezier to Lines...
          const last = cpaths64.last;
          let c = {p0: {x:last.x, y:last.y}, p1:{x:c1_x, y:c1_y}, p2:{x:c2_x, y:c2_y}, p3:{x:to_x, y:to_y}};
          let qs = cubicBezToQuadratics(c, quadBezState.tolerance); // Tolerance???
          for (let q of qs) {
            let ts = quadBezFlatten(q);
            for (let t of ts) {
              const {x,y} = evalQuadBez(q, t);
              updatePoint(x, y);
            }
          }
          updatePoint(to_x, to_y);
        }
        var quadTo = function (dfuncs, draw_data, draw_state, c_x, c_y, to_x, to_y, user_data) {
          //pathBuffer += `Q${c_x},${c_y} ${to_x},${to_y}`;
          // Flatten Quadratic Bezier to Lines...
          const last = cpaths64.last;
          let q = { p0: {x:last.x, y:last.y}, p1: {x:c_x, y:c_y}, p2: {x:to_x, y:to_y}};
          let ts = quadBezFlatten(q);
          for (let t of ts) {
            const {x, y} = evalQuadBez(q, t);
            updatePoint(x, y);
          }
        }
        var closePath = function (dfuncs, draw_data, draw_state, user_data) {
          cpaths64.closePath();
        }

        var moveToPtr = addFunction(moveTo, 'viiiffi');
        var lineToPtr = addFunction(lineTo, 'viiiffi');
        var cubicToPtr = addFunction(cubicTo, 'viiiffffffi');
        var quadToPtr = addFunction(quadTo, 'viiiffffi');
        var closePathPtr = addFunction(closePath, 'viiii');
        var drawFuncsPtr = exports.hb_draw_funcs_create();
        exports.hb_draw_funcs_set_move_to_func(drawFuncsPtr, moveToPtr, 0, 0);
        exports.hb_draw_funcs_set_line_to_func(drawFuncsPtr, lineToPtr, 0, 0);
        exports.hb_draw_funcs_set_cubic_to_func(drawFuncsPtr, cubicToPtr, 0, 0);
        exports.hb_draw_funcs_set_quadratic_to_func(drawFuncsPtr, quadToPtr, 0, 0);
        exports.hb_draw_funcs_set_close_path_func(drawFuncsPtr, closePathPtr, 0, 0);
      }

      var pathBuffer = "";
      exports.hb_font_draw_glyph(ptr, glyphId, drawFuncsPtr, 0);
      if (bbox.max && bbox.min) {
        bbox.width = bbox.max.x - bbox.min.x;
        bbox.height = bbox.max.y - bbox.min.y;
      } else {
        bbox.width = 0;
        bbox.height = 0;
      }
      paths.bbox = bbox;
      // Clipper2 Paths
      paths.cpaths = cpaths64;
      const mitreLimit = 25;
      const arcTolerance = 0;

      this.glyphs[glyphId] = paths; // Result cached in this object
    }
    return this.glyphs[glyphId];
  }
  shape(txt, features) {
    let buffer = this.hb.createBuffer();
    buffer.addText(txt);
    buffer.guessSegmentProperties();
    if ((typeof this.script === 'string') && (this.script.length > 0)) {
      buffer.setScript(this.script);
    }
    if ((typeof this.language === 'string') && (this.language.length > 0)) {
      buffer.setLanguage(this.language);
    }

/*--
    hb.shape(this.font, buffer, features, 0);
--*/
/*--Workaround for pre HarfBuzz 12.2.0 with Indic shaping--*/
    const exports = this.hb.hooks.exports;
    const addFunction = this.hb.hooks.addFunction;
    const removeFunction = this.hb.hooks.removeFunction;
    const utf8Decoder = this.hb.hooks.utf8Decoder;
    const Module = this.hb.hooks.Module;    
    var traceFunc = function(bufferPtr, fontPtr, messagePtr, user_data) {
      return 1;
    }
    var traceFuncPtr = addFunction(traceFunc, 'iiiii');
    exports.hb_buffer_set_message_func(buffer.ptr, traceFuncPtr, 0, 0);
    this.hb.shape(this.font, buffer, features, 0);
    removeFunction(traceFuncPtr);
/*--*/
    this.result = buffer.json(this.font);
    let totalAdv = 0;
    this.result.forEach(function(g) { totalAdv += g.ax; });
    this.result.totalAdv = totalAdv;
    buffer.destroy();
    return this.result;
  }
  toPath(json, options) {
    let cpaths64 = new CPaths64();
    if (!json) json = this.result;
    let pos = {x:0, y:0};
    for (let r of json) {
      const paths = this.glyphToPolyline(r.g);
      const px = pos.x + r.dx;
      const py = pos.y + r.dy;
      let glyph = paths.cpaths.translateToNewCPaths64(px, py);
      cpaths64.unionWith(glyph);
      glyph.destroy();
      pos.x += r.ax + (options.stretch || 0);
      pos.y += r.ay;
    }
    if (options) {
      const align = (options?.align || 'l').toLowerCase();
      const width = options?.width || 0;
      const margin = (options?.margin || 0);
      if (align.startsWith('r')) {
        let cp = cpaths64.translateToNewCPaths64(Math.round(width - margin - pos.x), 0);  // ADVANCE
        cpaths64.freePath();
        cpaths64 = cp;
      } else
      if (align.startsWith('c')) {
        cpaths64.findBoundingBox();
        const bounding = cpaths64.getBoundingBox();
        let cp = cpaths64.translateToNewCPaths64(Math.round((width - bounding.width) / 2), 0);
        cpaths64.freePath();
        cpaths64 = cp;

      }
    }
    if (this.cpaths64) {
      this.cpaths64.freePath();
    }
    this.cpaths64 = cpaths64;
    return this.cpaths64;
  }
  getArea() {
    return this.cpaths64.getArea().fill;
  }
  overlapToCPaths64(glyphCompareClassOther) {
    let diff = this.cpaths64.xorToNewCPaths64(glyphCompareClassOther.cpaths64);
    return diff;
  }
  overlapArea(glyphCompareClassOther) {
    let diff = this.overlapToCPaths64(glyphCompareClassOther);
    if (!diff) return undefined;
    let res = diff.getArea();
    let area = this.cpaths64.getArea();
    res.fillRatio = res.fill / area.fill;
    res.orig = area;
    diff.freePath();
    return res;
  }
};


