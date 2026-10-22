"use client";

import { useEffect, useRef } from "react";

/**
 * Photographic Earth for the login backdrop, rendered on a 2D canvas.
 *
 * Every pixel of the globe's disc gets its latitude/longitude and sun angle
 * precomputed once, so spinning the planet is just a longitude offset per
 * frame. Day colour comes from NASA's Blue Marble, night side from NASA's
 * Black Marble city lights (public domain, fetched after first paint). Until
 * they arrive, or when offline, a procedural Earth is shown instead. Clouds
 * are generated procedurally and drift slightly faster than the surface.
 */

const DAY_URL = "https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg";
const NIGHT_URL = "https://unpkg.com/three-globe@2.31.0/example/img/earth-night.jpg";

const TW = 1024; // texture width (power of two for cheap wrap)
const TH = 512;
const CW = 512; // cloud map width
const CH = 256;
const AXIAL_TILT = 0.41;

/** Shared with the login card so its glass sheen follows the same sun. */
export const SUN_SCREEN_DIR = { x: -0.62, y: -0.5 };
const SUN = normalize([-0.82, -0.38, 0.32]);

function normalize(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

// --- Seamless 3D value noise (sampled on the unit sphere, so no seam at the dateline)
function hash(x: number, y: number, z: number) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w
  );
}
function fbm(x: number, y: number, z: number, oct: number) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x * f, y * f, z * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s;
}
function sphereAt(col: number, row: number, w: number, h: number) {
  const lon = (col / w) * Math.PI * 2 - Math.PI;
  const lat = Math.PI / 2 - (row / h) * Math.PI;
  return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
}

function proceduralEarth() {
  const day = new Uint8ClampedArray(TW * TH * 4);
  const night = new Uint8ClampedArray(TW * TH * 4);
  for (let r = 0; r < TH; r++) {
    for (let c = 0; c < TW; c++) {
      const [x, y, z] = sphereAt(c, r, TW, TH);
      const n = fbm(x * 1.6 + 7, y * 1.6, z * 1.6, 5);
      const i = (r * TW + c) * 4;
      const ice = Math.abs(y) > 0.9;
      if (ice) {
        day[i] = 225; day[i + 1] = 232; day[i + 2] = 240;
      } else if (n > 0.52) {
        const d = fbm(x * 6, y * 6, z * 6, 3);
        const dry = Math.abs(y) < 0.45 && d > 0.5;
        day[i] = dry ? 170 : 62 + d * 50;
        day[i + 1] = dry ? 140 : 92 + d * 40;
        day[i + 2] = dry ? 95 : 48;
        if (hash(c, r, 3) > 0.985 && !dry) {
          night[i] = 255; night[i + 1] = 200; night[i + 2] = 120;
        }
      } else {
        const depth = Math.min(1, (0.52 - n) * 4);
        day[i] = 10; day[i + 1] = 40 - depth * 18; day[i + 2] = 92 - depth * 30;
      }
    }
  }
  return { day, night };
}

function proceduralClouds() {
  const out = new Float32Array(CW * CH);
  for (let r = 0; r < CH; r++) {
    for (let c = 0; c < CW; c++) {
      const [x, y, z] = sphereAt(c, r, CW, CH);
      const n = fbm(x * 2.2 + 31, y * 3.2, z * 2.2, 5);
      // Banded like real weather: busier at mid-latitudes, clearer in the subtropics.
      const band = 0.75 + 0.25 * Math.cos(y * 7);
      out[r * CW + c] = Math.max(0, Math.min(1, (n * band - 0.42) * 3.2));
    }
  }
  return out;
}

function loadTexture(url: string): Promise<Uint8ClampedArray> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = TW;
      c.height = TH;
      const x = c.getContext("2d", { willReadFrequently: true });
      if (!x) return reject(new Error("no 2d context"));
      x.drawImage(img, 0, 0, TW, TH);
      resolve(x.getImageData(0, 0, TW, TH).data);
    };
    img.onerror = reject;
    img.src = url;
  });
}

type Disc = {
  size: number;
  idx: Int32Array; // disc pixel index into output
  row: Int32Array; // texture row offset (row * TW)
  crow: Int32Array; // cloud row offset (row * CW)
  lon: Float32Array; // 0..1
  light: Float32Array; // cos(angle to sun)
  rim: Float32Array; // 0 at centre → 1 at limb
};

function buildDisc(size: number): Disc {
  const idx: number[] = [], row: number[] = [], crow: number[] = [];
  const lon: number[] = [], light: number[] = [], rim: number[] = [];
  const ct = Math.cos(AXIAL_TILT), st = Math.sin(AXIAL_TILT);
  const rad = size / 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const nx = (px + 0.5 - rad) / rad;
      const ny = (py + 0.5 - rad) / rad;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      // Undo axial tilt (rotate about the view z axis) to get planet coordinates.
      const x = nx * ct + ny * st;
      const y = -nx * st + ny * ct;
      const lat = Math.asin(-y);
      const lo = Math.atan2(x, nz) / (Math.PI * 2) + 0.5;
      const tr = Math.min(TH - 1, Math.max(0, Math.floor((0.5 - lat / Math.PI) * TH)));
      const cr = Math.min(CH - 1, Math.max(0, Math.floor((0.5 - lat / Math.PI) * CH)));
      idx.push(py * size + px);
      row.push(tr * TW);
      crow.push(cr * CW);
      lon.push(lo);
      light.push(nx * SUN[0] + ny * SUN[1] + nz * SUN[2]);
      rim.push(Math.sqrt(d2));
    }
  }
  return {
    size,
    idx: Int32Array.from(idx),
    row: Int32Array.from(row),
    crow: Int32Array.from(crow),
    lon: Float32Array.from(lon),
    light: Float32Array.from(light),
    rim: Float32Array.from(rim),
  };
}

export function SpaceScene({ warp = false }: { warp?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const warpRef = useRef(warp);

  useEffect(() => {
    warpRef.current = warp;
  }, [warp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let { day, night } = proceduralEarth();
    const clouds = proceduralClouds();
    let usingNasa = false;
    let cancelled = false;

    // Fetch real imagery once the page is interactive, so it never delays sign-in.
    const loadNasa = () =>
      Promise.all([loadTexture(DAY_URL), loadTexture(NIGHT_URL)])
        .then(([d, n]) => {
          if (cancelled) return;
          day = d as Uint8ClampedArray<ArrayBuffer>;
          night = n as Uint8ClampedArray<ArrayBuffer>;
          usingNasa = true;
        })
        .catch(() => {
          /* offline: keep procedural Earth */
        });
    const idle =
      "requestIdleCallback" in window
        ? requestIdleCallback(() => void loadNasa(), { timeout: 1500 })
        : setTimeout(() => void loadNasa(), 600);

    // Starfield: realistic magnitudes (mostly faint), no cartoon twinkle, plus a Milky Way band.
    const stars = Array.from({ length: 900 }, () => {
      const m = Math.pow(Math.random(), 6);
      const temp = Math.random();
      return {
        x: Math.random(),
        y: Math.random(),
        depth: 0.3 + Math.random() * 0.7,
        size: 0.35 + m * 1.6,
        alpha: 0.25 + m * 0.75,
        color: temp < 0.12 ? "#cfe3ff" : temp > 0.92 ? "#ffe2c4" : "#f4f6fb",
      };
    });

    let w = 0, h = 0, dpr = 1;
    let sky: HTMLCanvasElement | null = null;
    let disc: Disc | null = null;
    let globe: HTMLCanvasElement | null = null;
    let globeCtx: CanvasRenderingContext2D | null = null;
    let globeImg: ImageData | null = null;

    const paintSky = () => {
      const c = document.createElement("canvas");
      const pad = 60;
      c.width = Math.round(w + pad * 2);
      c.height = Math.round(h + pad * 2);
      const s = c.getContext("2d");
      if (!s) return;
      s.fillStyle = "#01030a";
      s.fillRect(0, 0, c.width, c.height);
      // Milky Way: a soft diagonal band of dust and dense faint stars.
      s.save();
      s.translate(c.width * 0.5, c.height * 0.5);
      s.rotate(-0.55);
      const band = s.createLinearGradient(0, -c.height * 0.35, 0, c.height * 0.35);
      band.addColorStop(0, "rgba(0,0,0,0)");
      band.addColorStop(0.45, "rgba(120,130,170,0.06)");
      band.addColorStop(0.5, "rgba(170,160,190,0.09)");
      band.addColorStop(0.55, "rgba(120,130,170,0.06)");
      band.addColorStop(1, "rgba(0,0,0,0)");
      s.fillStyle = band;
      s.fillRect(-c.width, -c.height * 0.35, c.width * 2, c.height * 0.7);
      for (let i = 0; i < 2600; i++) {
        const gx = (Math.random() - 0.5) * c.width * 2;
        const gy = (Math.random() + Math.random() + Math.random() - 1.5) * c.height * 0.12;
        s.fillStyle = `rgba(230,232,245,${0.08 + Math.random() * 0.25})`;
        s.fillRect(gx, gy, 0.7, 0.7);
      }
      s.restore();
      sky = c;
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintSky();
      const size = Math.min(560, Math.round(Math.max(w, h) * 0.7));
      if (!disc || disc.size !== size) {
        disc = buildDisc(size);
        globe = document.createElement("canvas");
        globe.width = size;
        globe.height = size;
        globeCtx = globe.getContext("2d");
        globeImg = globeCtx ? globeCtx.createImageData(size, size) : null;
      }
    };

    let yaw = 0.15, spin = 0.00028, dragging = false, lastX = 0;
    let px = 0, py = 0, tx = 0, ty = 0, warpAmt = 0, t = 0, raf = 0;

    const renderGlobe = () => {
      if (!disc || !globeImg || !globeCtx || !globe) return;
      const out = globeImg.data;
      const { idx, row, crow, lon, light, rim } = disc;
      const yawU = yaw / (Math.PI * 2);
      const cloudU = yawU * 1.12 + t * 0.000004;
      for (let k = 0; k < idx.length; k++) {
        const u = lon[k] + yawU + 1000;
        const ti = (row[k] + (((u * TW) | 0) & (TW - 1))) * 4;
        const cu = lon[k] + cloudU + 1000;
        const cl = clouds[crow[k] + (((cu * CW) | 0) % CW)];
        const L = light[k];
        const diffuse = L > 0 ? Math.pow(L, 0.75) : 0;
        const dayMix = Math.min(1, Math.max(0, (L + 0.08) * 5)); // terminator softness
        const e = rim[k];
        // Surface lit by the sun, then clouds on top, then city lights on the dark side.
        let r = day[ti] * (0.03 + 0.97 * diffuse);
        let g = day[ti + 1] * (0.03 + 0.97 * diffuse);
        let b = day[ti + 2] * (0.03 + 0.97 * diffuse);
        const cloudLit = 245 * (0.04 + 0.96 * diffuse);
        r += (cloudLit - r) * cl * 0.92;
        g += (cloudLit - g) * cl * 0.92;
        b += (cloudLit + 8 - b) * cl * 0.92;
        const lights = (1 - dayMix) * (1 - cl * 0.85) * (usingNasa ? 1.25 : 1);
        r += night[ti] * lights;
        g += night[ti + 1] * lights * 0.82;
        b += night[ti + 2] * lights * 0.55;
        // Atmospheric scattering: blue haze thickening toward the lit limb.
        const haze = Math.pow(e, 3) * (0.15 + 0.85 * Math.max(0, L + 0.2));
        r += (70 - r) * haze * 0.55;
        g += (150 - g) * haze * 0.55;
        b += (255 - b) * haze * 0.6;
        const o = idx[k] * 4;
        out[o] = r;
        out[o + 1] = g;
        out[o + 2] = b;
        out[o + 3] = 255;
      }
      globeCtx.putImageData(globeImg, 0, 0);
    };

    const frame = () => {
      t += 16;
      tx += (px - tx) * 0.04;
      ty += (py - ty) * 0.04;
      warpAmt += ((warpRef.current ? 1 : 0) - warpAmt) * 0.035;
      if (!dragging && !reduceMotion) yaw += spin * (1 + warpAmt * 10);

      // Sky with gentle parallax
      if (sky) ctx.drawImage(sky, -60 - tx * 14, -60 - ty * 14);
      else {
        ctx.fillStyle = "#01030a";
        ctx.fillRect(0, 0, w, h);
      }

      const cx0 = w / 2, cy0 = h / 2;
      for (const s of stars) {
        let sx = s.x * w - tx * 26 * s.depth;
        let sy = s.y * h - ty * 26 * s.depth;
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        if (warpAmt > 0.03) {
          const k = 1 + warpAmt * 0.6 * s.depth;
          const ex = cx0 + (sx - cx0) * k, ey = cy0 + (sy - cy0) * k;
          ctx.strokeStyle = s.color;
          ctx.lineWidth = s.size;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          sx = ex;
          sy = ey;
        } else {
          ctx.fillRect(sx, sy, s.size, s.size);
        }
      }
      ctx.globalAlpha = 1;

      // Earth fills the lower left like an orbital photo; warp pushes the camera in.
      const base = Math.max(w, h) * 0.46;
      const r = base * (1 + warpAmt * 0.25);
      const ex = w * 0.3 - tx * 10 - warpAmt * w * 0.05;
      const ey = h * 0.92 - ty * 10 + warpAmt * h * 0.05;

      // Outer atmosphere glow
      const glow = ctx.createRadialGradient(ex, ey, r * 0.98, ex, ey, r * 1.12);
      glow.addColorStop(0, "rgba(110,170,255,0.55)");
      glow.addColorStop(0.35, "rgba(60,120,255,0.18)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ex, ey, r * 1.12, 0, Math.PI * 2);
      ctx.fill();

      renderGlobe();
      if (globe) {
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(globe, ex - r, ey - r, r * 2, r * 2);
      }

      // Ocean glint where the sun reflects
      const gx = ex + SUN[0] * r * 0.55, gy = ey + SUN[1] * r * 0.55;
      ctx.globalCompositeOperation = "screen";
      const glint = ctx.createRadialGradient(gx, gy, 0, gx, gy, r * 0.35);
      glint.addColorStop(0, "rgba(255,245,225,0.16)");
      glint.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glint;
      ctx.beginPath();
      ctx.arc(ex, ey, r, 0, Math.PI * 2);
      ctx.fill();

      // Sun just past the limb: bloom, star-burst and a faint lens ghost.
      const sunX = w * 0.04 - tx * 4, sunY = h * 0.1 - ty * 4;
      const bloom = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(w, h) * 0.5);
      bloom.addColorStop(0, "rgba(255,250,235,0.95)");
      bloom.addColorStop(0.03, "rgba(255,240,210,0.55)");
      bloom.addColorStop(0.15, "rgba(255,210,160,0.10)");
      bloom.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(255,245,230,0.06)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI + 0.3;
        const len = Math.max(w, h) * 0.18;
        ctx.beginPath();
        ctx.moveTo(sunX - Math.cos(a) * len, sunY - Math.sin(a) * len);
        ctx.lineTo(sunX + Math.cos(a) * len, sunY + Math.sin(a) * len);
        ctx.stroke();
      }
      const ghostX = sunX + (cx0 - sunX) * 1.6, ghostY = sunY + (cy0 - sunY) * 1.6;
      const ghost = ctx.createRadialGradient(ghostX, ghostY, 0, ghostX, ghostY, 40);
      ghost.addColorStop(0, "rgba(120,180,255,0.05)");
      ghost.addColorStop(0.7, "rgba(160,120,255,0.04)");
      ghost.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ghost;
      ctx.fillRect(ghostX - 40, ghostY - 40, 80, 80);
      ctx.globalCompositeOperation = "source-over";

      // Moon, small and far, lit from the same sun
      const mx = w * 0.86 - tx * 18, my = h * 0.2 - ty * 18, mr = Math.min(w, h) * 0.022;
      const moon = ctx.createRadialGradient(
        mx + SUN[0] * mr * 0.6, my + SUN[1] * mr * 0.6, mr * 0.1, mx, my, mr
      );
      moon.addColorStop(0, "#e7e5e0");
      moon.addColorStop(0.55, "#a8a6a0");
      moon.addColorStop(1, "#1a1a1c");
      ctx.fillStyle = moon;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();

      // Warp flash
      if (warpAmt > 0.02) {
        ctx.fillStyle = `rgba(200,225,255,${warpAmt * 0.12})`;
        ctx.fillRect(0, 0, w, h);
      }

      raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      px = (e.clientX / w - 0.5) * 2;
      py = (e.clientY / h - 0.5) * 2;
      if (dragging) {
        yaw += (e.clientX - lastX) * 0.004;
        spin = Math.sign(e.clientX - lastX || 1) * 0.00028;
        lastX = e.clientX;
      }
    };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
    };
    const onUp = () => {
      dragging = false;
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };

    resize();
    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if ("cancelIdleCallback" in window) cancelIdleCallback(idle as number);
      clearTimeout(idle as number);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 block h-full w-full cursor-grab touch-none active:cursor-grabbing"
      aria-label="Earth from orbit at sunrise. Drag to rotate."
      role="img"
    />
  );
}
