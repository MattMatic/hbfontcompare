// See: https://minus-ze.ro/posts/flattening-bezier-curves-and-arcs/
//      https://minus-ze.ro/flattening-bezier-curves-and-arcs.js

//-------------------------------------------
// Quadratic Bezier Code...
//-------------------------------------------
let quadBezState = {
  currentHandle: null,
  tolerance: 0.4,
  numberOfSegments: 0
};

// The integral functions that compute how many segments are needed for flattening and all the t values at each subdivision point.
// They are explained here: https://raphlinus.github.io/graphics/curves/2019/12/23/flatten-quadbez.html
function approxIntegral(x) {
  const d = 0.67;
  return x / (1 - d + Math.pow(Math.pow(d, 4) + 0.25 * x * x, 0.25));
}

function approxInvIntegral(x) {
  const b = 0.39;
  return x * (1 - b + Math.sqrt(b * b + 0.25 * x * x));
}  

// Evaluating a quadratic curve q at the point t. Returns the (x, y) coordinate at that point.
function evalQuadBez(q, t) {
  const mt = 1 - t;
  const x = q.p0.x * mt * mt + 2 * q.p1.x * t * mt + q.p2.x * t * t;
  const y = q.p0.y * mt * mt + 2 * q.p1.y * t * mt + q.p2.y * t * t;
  return { x: x, y: y };
}

// Mapping the quadratic curve q to a segment of the x^2 parabola. Also explained in the blog post.
function quadBezMapToBasic(q) {
  const ddx = 2 * q.p1.x - q.p0.x - q.p2.x;
  const ddy = 2 * q.p1.y - q.p0.y - q.p2.y;
  const u0 = (q.p1.x - q.p0.x) * ddx + (q.p1.y - q.p0.y) * ddy;
  const u2 = (q.p2.x - q.p1.x) * ddx + (q.p2.y - q.p1.y) * ddy;
  const cross = (q.p2.x - q.p0.x) * ddy - (q.p2.y - q.p0.y) * ddx;
  const x0 = u0 / cross;
  const x2 = u2 / cross;
  const scale = Math.abs(cross) / (Math.hypot(ddx, ddy) * Math.abs(x2 - x0));
  return {
    x0: x0,
    x2: x2,
    scale: scale,
    cross: cross,
  };
}  

// This is the function that actually converts the curve to a sequence of lines. More precisely, it returns an array
// of t values, which you can then evaluate and get the actual line coordinates:
//
//     let q = { p0: { x: 10, y: 10 }, p1: { x: 50, y: 90 }, p2: { x: 90, y: 10 } };
//     let ts = quadBezFlatten(q);
//     for (let t of ts) {
//         const { x, y } = evalQuadBez(q, t);
//         // Now you can draw line between each of these points and you will render your curve.
//     }
function quadBezFlatten(q) {
  const params = quadBezMapToBasic(q);
  const a0 = approxIntegral(params.x0);
  const a2 = approxIntegral(params.x2);
  const count =
    0.5 * Math.abs(a2 - a0) * Math.sqrt(params.scale / quadBezState.tolerance);
  const n = Math.ceil(count);
  // Handle case where all the points are collinear and the end point is between the start point and the control point
  if (!Number.isFinite(n) || n === 0 || n === 1) {
    // Find t values where the derivative is 0
    const divx = q.p0.x + q.p2.x - 2 * q.p1.x;
    const divy = q.p0.y + q.p2.y - 2 * q.p1.y;
    const tx = (q.p0.x - q.p1.x) / divx;
    const ty = (q.p0.y - q.p1.y) / divy;
    let ts = [0.0];
    if (Number.isFinite(tx) && tx > 0 && tx < 1) {
      ts.push(tx);
    }
    if (Number.isFinite(ty) && ty > 0 && ty < 1) {
      if (ty > ts[ts.length - 1]) {
        ts.push(ty);
      }
    }
    ts.push(1.0);
    quadBezState.numberOfSegments = ts.length;
    return ts;
  }
  const u0 = approxInvIntegral(a0);
  const u2 = approxInvIntegral(a2);
  let result = [0];
  for (let i = 1; i < n; i++) {
    const u = approxInvIntegral(a0 + ((a2 - a0) * i) / n);
    const t = (u - u0) / (u2 - u0);
    result.push(t);
  }
  result.push(1);
  return result;
}

//-------------------------------------------
// Cubic Bezier Code...
//-------------------------------------------

// Evaluating the cubic curve c at parameter t. Returns the (x, y) coordinate at that point.
function evalCubicBez(c, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1.0 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;

  const x =
    c.p0.x * mt3 + c.p1.x * 3 * mt2 * t + c.p2.x * 3 * mt * t2 + c.p3.x * t3;
  const y =
    c.p0.y * mt3 + c.p1.y * 3 * mt2 * t + c.p2.y * 3 * mt * t2 + c.p3.y * t3;

  return { x: x, y: y };
}

// Effectively gives the same result as blossom(c).middle, but is easier to implement.
// Stole it from lyon2d_geom: https://github.com/nical/lyon/blob/2407b7f5e326b2a8f66bfae81fe02d850d8b0acc/crates/geom/src/cubic_bezier.rs#L153
function cubicBezSplitRange(c, t0, t1) {
  const from = evalCubicBez(c, t0);
  const to = evalCubicBez(c, t1);
  const dxFrom = c.p1.x - c.p0.x;
  const dyFrom = c.p1.y - c.p0.y;
  const dxCtrl = c.p2.x - c.p1.x;
  const dyCtrl = c.p2.y - c.p1.y;
  const dxTo = c.p3.x - c.p2.x;
  const dyTo = c.p3.y - c.p2.y;
  const d = {
    p0: { x: dxFrom, y: dyFrom },
    p1: { x: dxCtrl, y: dyCtrl },
    p2: { x: dxTo, y: dyTo },
  };
  const dt = t1 - t0;
  const xCtrl1 = from.x + evalQuadBez(d, t0).x * dt;
  const yCtrl1 = from.y + evalQuadBez(d, t0).y * dt;
  const xCtrl2 = to.x - evalQuadBez(d, t1).x * dt;
  const yCtrl2 = to.y - evalQuadBez(d, t1).y * dt;

  return {
    p0: from,
    p1: { x: xCtrl1, y: yCtrl1 },
    p2: { x: xCtrl2, y: yCtrl2 },
    p3: to,
  };
}

// Approximate a cubic to a single quadratic
// Works by getting the intersection between the lines [p0, p1] and [p3, p2], and using that as the control point for the
// resulting quadratic. Terrible as a general approximation, but great when the cubic is sufficiently close to a quadratic.
// We only call this in the subdivision steps so that is okay.
function cubicBezToQuadratic(c) {
  const c1x = (c.p1.x * 3 - c.p0.x) * 0.5;
  const c1y = (c.p1.y * 3 - c.p0.y) * 0.5;
  const c2x = (c.p2.x * 3 - c.p3.x) * 0.5;
  const c2y = (c.p2.y * 3 - c.p3.y) * 0.5;
  const cx = (c1x + c2x) * 0.5;
  const cy = (c1y + c2y) * 0.5;

  return {
    p0: c.p0,
    p1: { x: cx, y: cy },
    p2: c.p3,
  };
}

// Returns the number of quadratics needed to approximate the cubic c, given the specified tolerance.
function cubicBezNumQuadratics(c, tolerance) {
  const x = c.p0.x - 3 * c.p1.x + 3 * c.p2.x - c.p3.x;
  const y = c.p0.y - 3 * c.p1.y + 3 * c.p2.y - c.p3.y;
  const err = x * x + y * y;

  let result = err / (432.0 * tolerance * tolerance);
  return Math.max(Math.ceil(Math.pow(result, 1.0 / 6.0)), 1.0);
}

// Converting the cubic c to a sequence of quadratics, with the specified tolerance.
// Returns an array that contains these quadratics.
function cubicBezToQuadratics(c, tolerance) {
  const numQuads = cubicBezNumQuadratics(c, tolerance);
  const step = 1.0 / numQuads;
  const n = Math.trunc(numQuads);
  let t0 = 0.0;

  let result = [];
  for (let i = 0; i < n - 1; ++i) {
    const t1 = t0 + step;
    const quad = cubicBezSplitRange(c, t0, t1);
    result.push(cubicBezToQuadratic(quad));
    t0 = t1;
  }

  const quad = cubicBezSplitRange(c, t0, 1.0);
  result.push(cubicBezToQuadratic(quad));

  return result;
}

export {
  cubicBezToQuadratic,
  cubicBezToQuadratics,
  evalQuadBez,
  evalCubicBez,
  cubicBezNumQuadratics,
  quadBezFlatten,
}
