// Selectable HarfBuzz engine loader.
// github.com/MattMatic
// 2026-11
//
// Loads a harfbuzzjs build (and therefore a particular HarfBuzz version) and returns an object with
// the API the rest of this page uses (the hbjs.js API in ./hbjs.js):
//   createBlob / createFace / createFont / createBuffer
//   shape(font, buffer, featuresString, 0)
//   shapeWithTraceLimits(font, buffer, featuresString, stop_at, stop_phase, limits, stop_count)
//   version_string()
//   hooks  (raw WASM access; null on harfbuzzjs 1.x builds)
//   shapeTraced(font, buffer, featuresString, onMessage)   (only where `hooks` cannot be used)
//
// Sources, by HarfBuzz version:
//   bundled  ./hbjs-<hb>/hb.js + hb.wasm in this repository, with the local ./hbjs.js wrapper
//   cdn      harfbuzzjs 0.4.x / 0.10.x from jsDelivr (hb.js + hb.wasm), with the local ./hbjs.js wrapper
//   esm      harfbuzzjs 1.x from jsDelivr, a class API wrapped here into the same shape

// `pkg` is the harfbuzzjs version that carries that HarfBuzz; `bundled` means ./hbjs-<hb>/ exists.
export const HB_VERSIONS = [
  { hb: '15.0.0', pkg: '1.6.4' },
  { hb: '14.6.0', pkg: '1.6.3' },
  { hb: '14.5.0', pkg: '1.6.2' },
  { hb: '14.4.0', pkg: '1.6.1' },
  { hb: '14.3.0', pkg: '1.6.0' },
  { hb: '14.2.1', pkg: '1.4.0' },
  { hb: '14.2.0', pkg: '1.2.0' },
  { hb: '14.0.0', pkg: '0.10.3' },
  { hb: '13.2.1', pkg: '0.10.2' },
  { hb: '12.3.2', pkg: '0.10.0' },
  { hb: '12.3.0', pkg: '0.4.15', bundled: true },
  { hb: '12.2.0', pkg: '0.4.14', bundled: true },
  { hb: '12.0.0', pkg: '0.4.13', bundled: true },
  { hb: '11.5.0', pkg: '0.4.12', bundled: true },
  { hb: '11.4.5', pkg: '0.4.11', bundled: true },
  { hb: '11.4.4', pkg: '0.4.10', bundled: true },
  { hb: '11.4.1', pkg: '0.4.9',  bundled: true },
  { hb: '11.3.3',                bundled: true },
  { hb: '11.0.1', pkg: '0.4.7',  bundled: true },
  { hb: '11.0.0', pkg: '0.4.6' },
  { hb: '10.4.0', pkg: '0.4.5' },
  { hb: '10.2.0', pkg: '0.4.4' },
  { hb: '10.1.0', pkg: '0.4.3' },
  { hb: '10.0.0', pkg: '0.4.2' },
];

const CDN_BASE = 'https://cdn.jsdelivr.net/npm';
const pkgUrl = (pkg, file) => `${CDN_BASE}/harfbuzzjs@${pkg}/${file}`;
const localUrl = (hb, file) => new URL(`./hbjs-${hb}/${file}`, import.meta.url).href;
const wrapperUrl = () => new URL('./hbjs.js', import.meta.url).href;

async function fetchChecked(url, as) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} loading ${url}`);
  return as === 'text' ? r.text() : r.arrayBuffer();
}

// Evaluate a UMD/CommonJS script in an isolated function scope so that several builds never
// fight over globals (hbjs, Module, createHarfBuzz).
function evalScript(code, fallbackName) {
  const module = { exports: {} };
  const fn = new Function('module', 'exports',
    `${code}\n;return (typeof module.exports === 'function' || Object.keys(module.exports).length)` +
    ` ? module.exports : (typeof ${fallbackName} !== 'undefined' ? ${fallbackName} : undefined);`);
  const out = fn(module, module.exports);
  if (!out) throw new Error('Script did not export a HarfBuzz factory');
  return out;
}

// ── Shared trace implementation ──────────────────────────────────────────────────────────────
// Same behaviour as shapeWithTraceLimits() in ./hbjs.js, built on a primitive that runs a shape
// and calls  onMessage(message, snapshot, ctx) -> boolean  for every HarfBuzz trace message
// (false aborts that step). snapshot() returns the glyphs as [{g,cl,ax,ay,dx,dy}];
// ctx = { length, isGlyphs }.
function makeShapeWithTraceLimits(shapeTraced) {
  return function shapeWithTraceLimits(font, buffer, features, stop_at, stop_phase, limits, stop_count) {
    const DONT_STOP = 0, GSUB_PHASE = 1, GPOS_PHASE = 2;
    const trace = [];
    trace.limits = { maxDepth: 0, maxGlyph: 0 };
    let currentPhase = DONT_STOP, stopping = false, depth = 0, trace_count = 0;
    let gsub_point = -1, gpos_point = -1;
    const depthStack = [];
    // glyph limit: maxGlyphRatio is relative to the text length, taken from the buffer at the first message
    let charCountOriginal = buffer.getLength ? buffer.getLength() : -1;
    let glyphCountMax = 0;
    const setGlyphLimit = () => {
      glyphCountMax = 0;
      if (limits && limits.maxGlyphRatio) glyphCountMax = charCountOriginal * limits.maxGlyphRatio;
      if (limits && limits.maxGlyph) glyphCountMax = limits.maxGlyph;
    };
    if (charCountOriginal >= 0) setGlyphLimit();

    shapeTraced(font, buffer, features, (message, snapshot, ctx) => {
      if (charCountOriginal < 0) { charCountOriginal = ctx.length; setGlyphLimit(); }
      if (trace.limits.maxGlyphAbort || trace.limits.maxDepthAbort) return false;
      trace_count++;
      if (stop_count && (trace_count > stop_count)) return false;

      const thisDepth = depth;
      if (message.startsWith('start ') || message.startsWith('recursing ')) {
        if (message.startsWith('start ')) depthStack.push(depth);
        depth++;
        if (depth > trace.limits.maxDepth) trace.limits.maxDepth = depth;
        if (limits && limits.depth && (depth >= limits.depth)) {
          trace.limits.maxDepthAbort = true;
          return false;
        }
      } else if (message.startsWith('end ')) {
        depth = depthStack.pop();
      } else if (message.startsWith('recursed ')) {
        depth--;
      }

      if (message.startsWith('start table GSUB')) { currentPhase = GSUB_PHASE; gsub_point = trace_count - 1; }
      else if (message.startsWith('start table GPOS')) { currentPhase = GPOS_PHASE; gpos_point = trace_count - 1; }

      if (currentPhase != stop_phase) stopping = false;
      if (stop_count && (trace_count > stop_count)) stopping = true;
      if (stop_phase && currentPhase == stop_phase && message.startsWith('end lookup ' + stop_at)) stopping = true;
      if (stopping) return false;

      const t = snapshot();
      if (ctx.length > trace.limits.maxGlyph) {
        trace.limits.maxGlyph = ctx.length;
        if ((glyphCountMax > 0) && (ctx.length >= glyphCountMax)) {
          trace.limits.maxGlyphAbort = true;
          return false;
        }
      }
      trace.push({ d: thisDepth, m: message, t, glyphs: ctx.isGlyphs });
      return true;
    });
    trace.count = trace_count;
    trace.gsub_point = gsub_point;
    trace.gpos_point = gpos_point;
    return trace;
  };
}

// ── emcc: hb.js (emscripten) + an hbjs.js wrapper ────────────────────────────────────────────
// The local ./hbjs.js (adds shapeWithTraceLimits) suits the bundled builds and harfbuzzjs 0.4.7 - 0.4.15.
// harfbuzzjs 0.4.2 - 0.4.6 (HarfBuzz 10.x, 11.0.0) lack the draw exports it needs to free a font, and 0.10.x changed
// the emscripten module, so those use their own package wrapper.
async function loadEmcc(hbVer, urlOf, wrapperFile) {
  const [hbSrc, hbjsSrc, wasm] = await Promise.all([
    fetchChecked(urlOf('hb.js'), 'text'),
    fetchChecked(wrapperFile, 'text'),
    fetchChecked(urlOf('hb.wasm')),
  ]);
  const createHarfBuzz = evalScript(hbSrc, 'createHarfBuzz');
  const hbjs           = evalScript(hbjsSrc, 'hbjs');
  const Module = await createHarfBuzz({ wasmBinary: wasm, locateFile: urlOf });
  const api = hbjs(Module);
  const ex = Module.wasmExports;
  if (!api.hooks) {
    api.hooks = {
      exports: ex, addFunction: Module.addFunction, removeFunction: Module.removeFunction,
      utf8Decoder: new TextDecoder('utf8'), Module,
    };
  }

  // Some builds lack what the wrapper's trace needs (shapeWithTraceLimits itself, the
  // hb_buffer_serialize_glyphs export, Module.removeFunction). Trace through our own snapshot instead.
  if (!api.shapeWithTraceLimits || !ex.hb_buffer_serialize_glyphs || !Module.removeFunction) {
    const dec = api.hooks.utf8Decoder;
    // hb_buffer_get_glyph_positions() allocates positions if there are none yet, which upsets a shape in
    // progress, so positions are only read once GPOS has started (before that they are all zero).
    const snapshot = (bufPtr, withPositions) => {
      const len = ex.hb_buffer_get_length(bufPtr);
      const infosPtr = ex.hb_buffer_get_glyph_infos(bufPtr, 0);
      const posPtr32 = withPositions ? ex.hb_buffer_get_glyph_positions(bufPtr, 0) / 4 : 0;
      const infos = Module.HEAPU32.subarray(infosPtr / 4, infosPtr / 4 + 5 * len);
      const pos = posPtr32 ? Module.HEAP32.subarray(posPtr32, posPtr32 + 5 * len) : null;
      const out = [];
      for (let i = 0; i < len; i++) {
        out.push({ g: infos[i * 5], cl: infos[i * 5 + 2],
                   ax: pos ? pos[i * 5] : 0, ay: pos ? pos[i * 5 + 1] : 0,
                   dx: pos ? pos[i * 5 + 2] : 0, dy: pos ? pos[i * 5 + 3] : 0 });
      }
      return out;
    };
    let inGpos = false;
    let current = null;
    let fp = 0;   // registered once: each addFunction takes a function-table slot and old builds cannot remove it
    api.shapeTraced = (font, buffer, features, onMessage) => {
      if (!fp) {
        fp = Module.addFunction((bufPtr, fontPtr, msgPtr) => {
          if (!current) return 1;
          const m = dec.decode(Module.HEAPU8.subarray(msgPtr, Module.HEAPU8.indexOf(0, msgPtr)));
          if (m.startsWith('start table GPOS')) inGpos = true;
          else if (m.startsWith('start table GSUB')) inGpos = false;
          const ctx = { length: ex.hb_buffer_get_length(bufPtr), isGlyphs: ex.hb_buffer_get_content_type(bufPtr) == 2 };
          return current(m, () => snapshot(bufPtr, inGpos), ctx) ? 1 : 0;
        }, 'iiiii');
      }
      current = onMessage;
      inGpos = false;
      ex.hb_buffer_set_message_func(buffer.ptr, fp, 0, 0);
      api.shape(font, buffer, features, 0);
      current = null;
    };
    api.shapeWithTraceLimits = makeShapeWithTraceLimits(api.shapeTraced);
  }
  // The page asks for createBuffer(traced); only the 1.x engines use that. Some emcc wrappers take an
  // existing buffer pointer as their first argument, so never pass it on.
  const createBuffer = api.createBuffer;
  api.createBuffer = () => createBuffer();
  // A missing table comes back as undefined from some wrappers and as an empty array from others
  const createFace = api.createFace;
  api.createFace = (...args) => {
    const face = createFace(...args);
    const refTable = face.reference_table;
    face.reference_table = (tag) => { const r = refTable.call(face, tag); return (r && r.length) ? r : undefined; };
    return face;
  };
  api.id = hbVer;
  api.kind = 'emcc';
  return api;
}

// ── esm (harfbuzzjs 1.x): wrap the class API into the hbjs.js-style API ─────────────────────
export function makeEsmEngine(m, hbVer) {
  const DIR = { ltr: m.Direction?.LTR ?? 4, rtl: m.Direction?.RTL ?? 5, ttb: m.Direction?.TTB ?? 6, btt: m.Direction?.BTT ?? 7 };
  // "kern,-liga,ss01=1" -> Feature[]  (the hbjs.js API takes a comma separated string)
  const featureCache = new Map();
  const toFeatures = (features) => {
    if (!features) return [];
    if (Array.isArray(features)) return features;
    if (!featureCache.has(features)) {
      featureCache.set(features, String(features).split(',').map(s => s.trim()).filter(Boolean)
        .map(s => m.Feature.fromString(s)).filter(Boolean));
    }
    return featureCache.get(features);
  };

  class WFace {
    constructor(face) { this.face = face; }
    get upem() { return this.face.upem; }
    reference_table(tag) { const r = this.face.referenceTable(tag); return (r && r.length) ? r : undefined; }
    destroy() { try { this.face.destroy?.(); } catch (_) {} }
  }
  class WFont {
    constructor(font) { this.font = font; }
    glyphToPath(gid) { return this.font.glyphToPath(gid); }
    glyphToJson(gid) { return this.font.glyphToJson(gid); }
    glyphName(gid) { return this.font.glyphName(gid); }
    setScale(x, y) { this.font.setScale(x, y); }
    destroy() { try { this.font.destroy?.(); } catch (_) {} }
  }
  class WBlob {
    constructor(blob) { this.blob = blob; }
    destroy() { try { this.blob.destroy?.(); } catch (_) {} }
  }
  function toJsonGlyph(e) {
    return { g: e.codepoint, cl: e.cluster, ax: e.xAdvance ?? 0, ay: e.yAdvance ?? 0,
             dx: e.xOffset ?? 0, dy: e.yOffset ?? 0, flags: e.flags ?? 0 };
  }
  // harfbuzzjs 1.x has no explicit destroy: buffers are freed only by a FinalizationRegistry (which cannot
  // run inside a tight shaping loop), and every Buffer.setMessageFunc() call leaks a WASM function-table slot.
  // So buffers are pooled and reused, and a traced buffer gets its message callback once.
  const pools = { plain: [], traced: [] };
  class WBuffer {
    constructor(traced) {
      this.buf = new m.Buffer();
      this.traced = traced;
      this.handler = null;
      this.inGpos = false;
      if (traced) {
        this.buf.setMessageFunc((b, _f, message) => {
          if (!this.handler) return true;
          if (message.startsWith('start table GPOS')) this.inGpos = true;
          else if (message.startsWith('start table GSUB')) this.inGpos = false;
          const ctx = { length: b.getLength(), isGlyphs: b.getContentType() == m.BufferContentType.GLYPHS };
          // positions are only read once GPOS has started (asking earlier allocates them mid-shape)
          const snap = () => (this.inGpos ? b.getGlyphInfosAndPositions() : b.getGlyphInfos()).map(toJsonGlyph);
          return this.handler(message, snap, ctx) !== false;
        });
      }
    }
    get ptr() { return this.buf.ptr; }
    addText(t) { this.buf.addText(t); }
    guessSegmentProperties() { this.buf.guessSegmentProperties(); }
    setDirection(d) { this.buf.setDirection(DIR[d] ?? 0); }
    setScript(s) { this.buf.setScript(s); }
    setLanguage(l) { this.buf.setLanguage(l); }
    getLength() { return this.buf.getLength(); }
    json() { return this.buf.getGlyphInfosAndPositions().map(toJsonGlyph); }
    destroy() {
      this.handler = null;
      this.buf.clearContents();
      pools[this.traced ? 'traced' : 'plain'].push(this);
    }
  }
  const shapeTraced = (font, buffer, features, onMessage) => {
    if (!buffer.traced) throw new Error('shapeTraced needs createBuffer(true)');
    buffer.handler = onMessage;
    buffer.inGpos = false;
    m.shape(font.font, buffer.buf, toFeatures(features));
    buffer.handler = null;
  };
  const shapeWithTraceLimits = makeShapeWithTraceLimits(shapeTraced);

  return {
    id: hbVer, kind: 'esm',
    createBlob:   bytes => new WBlob(new m.Blob(bytes)),
    createFace:   (blob, index) => new WFace(new m.Face(blob.blob, index || 0)),
    createFont:   face => new WFont(new m.Font(face.face)),
    // `traced` buffers carry the message callback; plain ones do not (it costs on every shape)
    createBuffer: (traced = false) => pools[traced ? 'traced' : 'plain'].pop() ?? new WBuffer(traced),
    shape: (font, buffer, features /*, unused */) => m.shape(font.font, buffer.buf, toFeatures(features)),
    shapeTraced,
    shapeWithTraceLimits,   // needs a buffer from createBuffer(true)
    version_string: () => m.versionString(),
    hooks: null,
  };
}

async function loadEsm(hbVer, pkg) {
  return makeEsmEngine(await import(/* webpackIgnore: true */ pkgUrl(pkg, 'dist/index.mjs')), hbVer);
}

const cache = new Map();   // HarfBuzz version -> Promise<engine>

/**
 * Load (or fetch from cache) the engine for a HarfBuzz version from HB_VERSIONS.
 * @param {string} hbVer  e.g. '14.3.0'
 */
export function loadHarfBuzz(hbVer) {
  if (!cache.has(hbVer)) {
    const e = HB_VERSIONS.find(v => v.hb === hbVer);
    if (!e) return Promise.reject(new Error(`Unknown HarfBuzz version "${hbVer}"`));
    let p;
    if (e.bundled) p = loadEmcc(hbVer, f => localUrl(hbVer, f), wrapperUrl());
    else if (/^0\.4\.([7-9]|1\d)$/.test(e.pkg)) p = loadEmcc(hbVer, f => pkgUrl(e.pkg, f), wrapperUrl());
    else if (/^0\./.test(e.pkg)) p = loadEmcc(hbVer, f => pkgUrl(e.pkg, f), pkgUrl(e.pkg, 'hbjs.js'));
    else p = loadEsm(hbVer, e.pkg);
    p.catch(() => cache.delete(hbVer));
    cache.set(hbVer, p);
  }
  return cache.get(hbVer);
}
