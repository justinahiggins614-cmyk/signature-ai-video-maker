/* =====================================================================
   SigArt — The Signature AI Image And Video Maker engine
   Deterministic, client-side, offline-capable. No external API needed.
   Same prompt + same settings => same artwork, forever.
   (c) Signature System — original generative art, trademark-safe.
   ===================================================================== */
var SigArt = (function () {
  "use strict";

  /* ---------------- seeded RNG ---------------- */
  function xfnv1a(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }
  function range(r, a, b) { return a + r() * (b - a); }
  function rangei(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }

  /* ---------------- palettes ---------------- */
  var PALETTES = [
    { name: "Neon Night",    bg: ["#0b0620", "#2b0a54"], mid: ["#3b1d7a", "#1d2b6b"], accent: "#00f0ff", fg: "#ff2fb3", deep: "#12082e" },
    { name: "Sunset Ember",  bg: ["#2b0f2e", "#a83232"], mid: ["#7a2a3a", "#4a1e3f"], accent: "#ffb347", fg: "#ffe29a", deep: "#1d0a20" },
    { name: "Ocean Deep",    bg: ["#02141f", "#0a3b54"], mid: ["#0e5a7a", "#134e5e"], accent: "#7ff0d4", fg: "#d8fbff", deep: "#010d14" },
    { name: "Forest Dawn",   bg: ["#0c1f16", "#1e4d2b"], mid: ["#2e6b3a", "#1a3d24"], accent: "#d4f79a", fg: "#f4ffe0", deep: "#07130c" },
    { name: "Cosmic Violet", bg: ["#12041f", "#3d1663"], mid: ["#5b2a86", "#2c1a4d"], accent: "#c99aff", fg: "#f3e8ff", deep: "#0b0213" },
    { name: "Desert Gold",   bg: ["#241304", "#7a4a12"], mid: ["#a8711f", "#5c3a0e"], accent: "#ffe08a", fg: "#fff6d8", deep: "#170c02" },
    { name: "Arctic Mint",   bg: ["#0a1c22", "#1e5a66"], mid: ["#2e7f8f", "#17424c"], accent: "#b8fff1", fg: "#f0ffff", deep: "#061216" },
    { name: "Crimson Pulse", bg: ["#1f060a", "#5c0f1c"], mid: ["#8f1f2e", "#47101b"], accent: "#ff8a7a", fg: "#ffe8e0", deep: "#120307" },
    { name: "Royal Indigo",  bg: ["#080b24", "#1d2a6e"], mid: ["#2c3f8f", "#141c4d"], accent: "#9ab8ff", fg: "#eef2ff", deep: "#04061a" },
    { name: "Meadow Pastel", bg: ["#f7e8f0", "#cfe8d8"], mid: ["#a8d5ba", "#e8c8d8"], accent: "#5b8f6b", fg: "#2e4a38", deep: "#e8d8e0" },
    { name: "Mono Ink",      bg: ["#0d0d0f", "#2a2a30"], mid: ["#3d3d46", "#1a1a1e"], accent: "#ffffff", fg: "#e8e8e8", deep: "#060607" },
    { name: "Candy Pop",     bg: ["#2b0a2e", "#6e1e5e"], mid: ["#93387f", "#4a1545"], accent: "#7dffea", fg: "#ffe3f7", deep: "#1c061d" }
  ];

  /* ---------------- scene classification ---------------- */
  var SCENES = {
    space:     ["star", "planet", "galaxy", "moon", "cosmos", "rocket", "alien", "nebula", "astronaut", "satellite", "ufo", "comet", "orbit"],
    ocean:     ["ocean", "sea", "wave", "beach", "surf", "fish", "boat", "underwater", "coral", "whale", "shark", "sail", "tide", "diver"],
    landscape: ["mountain", "forest", "tree", "desert", "valley", "hill", "meadow", "jungle", "canyon", "waterfall", "lake", "river", "field", "garden"],
    city:      ["city", "town", "building", "street", "tower", "skyline", "bridge", "village", "castle", "skyscraper", "downtown"],
    creature:  ["dragon", "robot", "cat", "dog", "bird", "lion", "monster", "hero", "face", "knight", "wolf", "bear", "owl", "fox", "tiger", "beast", "pet"],
    object:    ["car", "house", "ship", "guitar", "flower", "crown", "sword", "phone", "lamp", "book", "key", "clock", "chair", "cup", "hat"],
    abstract:  []
  };
  function classify(prompt) {
    var p = " " + prompt.toLowerCase() + " ";
    var best = "abstract", bestN = 0;
    for (var s in SCENES) {
      var n = 0;
      SCENES[s].forEach(function (w) { if (p.indexOf(w) >= 0) n++; });
      if (n > bestN) { bestN = n; best = s; }
    }
    return best;
  }

  /* ---------------- trademark guard ---------------- */
  var TM_BLOCK = [
    "mickey", "disney", "marvel", "spider-man", "spiderman", "batman", "superman",
    "pokemon", "pikachu", "nintendo", "mario", "zelda", "sonic", "hello kitty",
    "coca-cola", "coke", "pepsi", "nike", "adidas", "apple logo", "mcdonald",
    "star wars", "darth vader", "jedi", "harry potter", "hogwarts", "minion",
    "shrek", "toy story", "frozen", "elsa", "barbie", "lego", "transformer",
    "x-men", "wolverine", "avenger", "iron man", "thor", "hulk", "deadpool",
    "jurassic", "godzilla", "king kong", "tetris", "minecraft", "fortnite",
    "playstation", "xbox", "iphone", "samsung", "tesla", "ferrari", "porsche",
    "gucci", "louis vuitton", "supreme", "starbucks", "kfc", "donald duck",
    "goofy", "snoopy", "garfield", "smurf", "peppa", "paw patrol", "bluey"
  ];
  function guard(prompt) {
    var p = prompt.toLowerCase(), hits = [];
    TM_BLOCK.forEach(function (t) {
      var re = new RegExp("\\b" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+") + "s?\\b");
      if (re.test(p)) hits.push(t);
    });
    if (!hits.length) return { clean: true, hits: [], cleanPrompt: prompt };
    var cp = prompt;
    hits.forEach(function (t) { cp = cp.replace(new RegExp(t, "ig"), "hero"); });
    return {
      clean: false, hits: hits, cleanPrompt: cp,
      note: "Trademark-safe abstraction: this artwork renders an original Signature-style archetype instead of " +
        hits.join(", ") + " — all characters, marks and designs here are original and not affiliated with any brand."
    };
  }

  /* ---------------- helpers for SVG ---------------- */
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function grad(id, c1, c2, x2) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 ? "1" : "0") + '" y2="1">' +
      '<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient>';
  }
  function stars(r, pal, n, w, h, prefix) {
    var s = "";
    for (var i = 0; i < n; i++) {
      var x = range(r, 0, w).toFixed(1), y = range(r, 0, h * 0.7).toFixed(1),
          sz = range(r, 0.6, 2.6).toFixed(1), o = range(r, 0.25, 0.95).toFixed(2);
      s += '<circle cx="' + x + '" cy="' + y + '" r="' + sz + '" fill="' + pal.fg + '" opacity="' + o + '"/>';
    }
    return s;
  }
  function celestial(r, pal, w, h) {
    var x = range(r, w * 0.15, w * 0.85).toFixed(0), y = range(r, h * 0.12, h * 0.4).toFixed(0),
        rad = range(r, 40, 95).toFixed(0);
    return '<circle cx="' + x + '" cy="' + y + '" r="' + (rad * 1.7).toFixed(0) + '" fill="' + pal.accent + '" opacity="0.18"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + rad + '" fill="' + pal.accent + '" opacity="0.92"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (rad * 0.72).toFixed(0) + '" fill="' + pal.fg + '" opacity="0.55"/>';
  }
  function mountains(r, pal, w, h, base) {
    var s = "", layers = 3;
    for (var L = 0; L < layers; L++) {
      var y0 = base - L * h * 0.09, pts = "0," + h;
      for (var x = 0; x <= w; x += w / 7) pts += " " + x.toFixed(0) + "," + (y0 - range(r, h * 0.04, h * 0.2)).toFixed(0);
      pts += " " + w + "," + h;
      s += '<polygon points="' + pts + '" fill="' + pal.mid[L % pal.mid.length] + '" opacity="' + (0.55 + L * 0.18).toFixed(2) + '"/>';
    }
    return s;
  }
  function buildings(r, pal, w, h, base) {
    var s = "", x = 0;
    while (x < w) {
      var bw = range(r, 50, 130), bh = range(r, h * 0.15, h * 0.5);
      s += '<rect x="' + x.toFixed(0) + '" y="' + (base - bh).toFixed(0) + '" width="' + bw.toFixed(0) + '" height="' + bh.toFixed(0) + '" fill="' + pal.deep + '" opacity="0.9"/>';
      for (var wy = base - bh + 12; wy < base - 8; wy += 22)
        for (var wx = x + 8; wx < x + bw - 10; wx += 20)
          if (r() < 0.55) s += '<rect x="' + wx.toFixed(0) + '" y="' + wy.toFixed(0) + '" width="10" height="12" fill="' + pal.accent + '" opacity="0.75"/>';
      x += bw + range(r, 4, 26);
    }
    return s;
  }
  function waves(r, pal, w, h, base) {
    var s = "";
    for (var L = 0; L < 4; L++) {
      var y = base + L * 34, d = "M0," + y.toFixed(0);
      for (var x = 0; x <= w; x += 60) d += " q30," + (range(r, -26, 26)).toFixed(0) + " 60,0";
      d += " L" + w + "," + h + " L0," + h + " Z";
      s += '<path d="' + d + '" fill="' + (L % 2 ? pal.mid[0] : pal.mid[1 % pal.mid.length]) + '" opacity="' + (0.5 + L * 0.14).toFixed(2) + '"/>';
    }
    return s;
  }
  function dunes(r, pal, w, h, base) {
    var s = "";
    for (var L = 0; L < 3; L++) {
      var d = "M0," + (base + L * 40).toFixed(0);
      for (var x = 0; x <= w; x += 120) d += " q60," + range(r, -50, -14).toFixed(0) + " 120,0";
      d += " L" + w + "," + h + " L0," + h + " Z";
      s += '<path d="' + d + '" fill="' + pal.mid[L % pal.mid.length] + '" opacity="' + (0.6 + L * 0.16).toFixed(2) + '"/>';
    }
    return s;
  }

  /* subject builders — original geometric constructs */
  function subject(r, pal, w, h, kind) {
    var cx = w / 2 + range(r, -w * 0.12, w * 0.12), cy = h * 0.58, s = "";
    var A = pal.accent, F = pal.fg, D = pal.deep;
    if (kind === "beast") {           /* geometric beast: body, head, horns, legs, tail */
      var bw = range(r, 150, 230), bh = bw * 0.62;
      s += '<ellipse cx="' + cx.toFixed(0) + '" cy="' + cy.toFixed(0) + '" rx="' + (bw / 2).toFixed(0) + '" ry="' + (bh / 2).toFixed(0) + '" fill="' + F + '" opacity="0.95"/>';
      s += '<ellipse cx="' + cx.toFixed(0) + '" cy="' + (cy - 8).toFixed(0) + '" rx="' + (bw / 3).toFixed(0) + '" ry="' + (bh / 3.4).toFixed(0) + '" fill="' + A + '" opacity="0.5"/>';
      var hx = cx + bw / 2 - 10, hy = cy - bh / 2 - 26;
      s += '<circle cx="' + hx.toFixed(0) + '" cy="' + hy.toFixed(0) + '" r="' + (bw * 0.2).toFixed(0) + '" fill="' + F + '"/>';
      s += '<polygon points="' + (hx - 26).toFixed(0) + ',' + (hy - 14).toFixed(0) + ' ' + (hx - 44).toFixed(0) + ',' + (hy - 52).toFixed(0) + ' ' + (hx - 8).toFixed(0) + ',' + (hy - 24).toFixed(0) + '" fill="' + A + '"/>';
      s += '<polygon points="' + (hx + 26).toFixed(0) + ',' + (hy - 14).toFixed(0) + ' ' + (hx + 44).toFixed(0) + ',' + (hy - 52).toFixed(0) + ' ' + (hx + 8).toFixed(0) + ',' + (hy - 24).toFixed(0) + '" fill="' + A + '"/>';
      s += '<circle cx="' + (hx - 12).toFixed(0) + '" cy="' + (hy - 4).toFixed(0) + '" r="7" fill="' + D + '"/><circle cx="' + (hx + 12).toFixed(0) + '" cy="' + (hy - 4).toFixed(0) + '" r="7" fill="' + D + '"/>';
      for (var li = 0; li < 4; li++) {
        var lx = cx - bw / 2 + 24 + li * (bw - 48) / 3;
        s += '<rect x="' + lx.toFixed(0) + '" y="' + (cy + bh / 2 - 14).toFixed(0) + '" width="22" height="' + (h - cy - bh / 2 + 6).toFixed(0) + '" rx="10" fill="' + F + '" opacity="0.9"/>';
      }
      var tx = cx - bw / 2;
      s += '<path d="M' + tx.toFixed(0) + ',' + cy.toFixed(0) + ' q-90,-30 -130,' + range(r, -90, -30).toFixed(0) + '" stroke="' + F + '" stroke-width="18" fill="none" stroke-linecap="round"/>';
      for (var sp = 0; sp < 5; sp++) {
        var sx = cx - bw / 2 + sp * bw / 4;
        s += '<polygon points="' + sx.toFixed(0) + ',' + (cy - bh / 2).toFixed(0) + ' ' + (sx + 14).toFixed(0) + ',' + (cy - bh / 2 - 34).toFixed(0) + ' ' + (sx + 28).toFixed(0) + ',' + (cy - bh / 2).toFixed(0) + '" fill="' + A + '" opacity="0.85"/>';
      }
    } else if (kind === "robot") {
      var rw = range(r, 130, 190), rh = rw * 1.15;
      s += '<rect x="' + (cx - rw / 2).toFixed(0) + '" y="' + (cy - rh / 2).toFixed(0) + '" width="' + rw.toFixed(0) + '" height="' + rh.toFixed(0) + '" rx="26" fill="' + F + '" opacity="0.95"/>';
      s += '<rect x="' + (cx - rw / 2 + 18).toFixed(0) + '" y="' + (cy - rh / 2 + 18).toFixed(0) + '" width="' + (rw - 36).toFixed(0) + '" height="' + (rh * 0.3).toFixed(0) + '" rx="12" fill="' + D + '" opacity="0.85"/>';
      s += '<circle cx="' + (cx - rw / 5).toFixed(0) + '" cy="' + (cy - rh / 2 + 18 + rh * 0.15).toFixed(0) + '" r="14" fill="' + A + '"><animate attributeName="opacity" values="1;0.25;1" dur="2.4s" repeatCount="indefinite"/></circle>';
      s += '<circle cx="' + (cx + rw / 5).toFixed(0) + '" cy="' + (cy - rh / 2 + 18 + rh * 0.15).toFixed(0) + '" r="14" fill="' + A + '"><animate attributeName="opacity" values="1;0.25;1" dur="2.4s" repeatCount="indefinite"/></circle>';
      s += '<rect x="' + (cx - rw / 2 + 30).toFixed(0) + '" y="' + (cy + 8).toFixed(0) + '" width="' + (rw - 60).toFixed(0) + '" height="10" rx="5" fill="' + A + '" opacity="0.8"/>';
      s += '<rect x="' + (cx - rw / 2 + 30).toFixed(0) + '" y="' + (cy + 30).toFixed(0) + '" width="' + (rw - 60).toFixed(0) + '" height="10" rx="5" fill="' + A + '" opacity="0.5"/>';
      s += '<line x1="' + cx.toFixed(0) + '" y1="' + (cy - rh / 2).toFixed(0) + '" x2="' + cx.toFixed(0) + '" y2="' + (cy - rh / 2 - 44).toFixed(0) + '" stroke="' + F + '" stroke-width="8"/>';
      s += '<circle cx="' + cx.toFixed(0) + '" cy="' + (cy - rh / 2 - 52).toFixed(0) + '" r="12" fill="' + A + '"/>';
      s += '<rect x="' + (cx - rw / 2 - 34).toFixed(0) + '" y="' + (cy - rh / 4).toFixed(0) + '" width="26" height="' + (rh * 0.6).toFixed(0) + '" rx="12" fill="' + F + '" opacity="0.85"/>';
      s += '<rect x="' + (cx + rw / 2 + 8).toFixed(0) + '" y="' + (cy - rh / 4).toFixed(0) + '" width="26" height="' + (rh * 0.6).toFixed(0) + '" rx="12" fill="' + F + '" opacity="0.85"/>';
    } else if (kind === "bird") {
      var bs = range(r, 90, 150);
      s += '<ellipse cx="' + cx.toFixed(0) + '" cy="' + cy.toFixed(0) + '" rx="' + (bs * 0.62).toFixed(0) + '" ry="' + (bs * 0.45).toFixed(0) + '" fill="' + F + '"/>';
      s += '<circle cx="' + (cx + bs * 0.55).toFixed(0) + '" cy="' + (cy - bs * 0.32).toFixed(0) + '" r="' + (bs * 0.28).toFixed(0) + '" fill="' + F + '"/>';
      s += '<polygon points="' + (cx + bs * 0.78).toFixed(0) + ',' + (cy - bs * 0.36).toFixed(0) + ' ' + (cx + bs * 1.05).toFixed(0) + ',' + (cy - bs * 0.26).toFixed(0) + ' ' + (cx + bs * 0.78).toFixed(0) + ',' + (cy - bs * 0.18).toFixed(0) + '" fill="' + A + '"/>';
      s += '<circle cx="' + (cx + bs * 0.62).toFixed(0) + '" cy="' + (cy - bs * 0.38).toFixed(0) + '" r="7" fill="' + D + '"/>';
      var wspan = bs * 1.5;
      s += '<path d="M' + (cx - bs * 0.3).toFixed(0) + ',' + (cy - bs * 0.2).toFixed(0) + ' Q' + (cx - wspan).toFixed(0) + ',' + (cy - bs * 1.1).toFixed(0) + ' ' + (cx - wspan * 1.25).toFixed(0) + ',' + (cy - bs * 0.35).toFixed(0) + ' Q' + (cx - wspan * 0.7).toFixed(0) + ',' + (cy - bs * 0.25).toFixed(0) + ' ' + (cx - bs * 0.3).toFixed(0) + ',' + (cy - bs * 0.1).toFixed(0) + ' Z" fill="' + A + '" opacity="0.85"/>';
      for (var fi = 0; fi < 3; fi++)
        s += '<rect x="' + (cx - bs * 0.5 + fi * 26).toFixed(0) + '" y="' + (cy + bs * 0.32).toFixed(0) + '" width="60" height="14" rx="7" fill="' + A + '" opacity="0.7" transform="rotate(' + rangei(r, -24, 24) + ' ' + (cx - bs * 0.5 + fi * 26 + 30).toFixed(0) + ' ' + (cy + bs * 0.32 + 7).toFixed(0) + ')"/>';
    } else if (kind === "tower") {   /* castle / tower */
      var tw = range(r, 120, 200), th = range(r, 260, 420), bx = cx - tw / 2, by = cy + 60 - th;
      s += '<rect x="' + bx.toFixed(0) + '" y="' + by.toFixed(0) + '" width="' + tw.toFixed(0) + '" height="' + th.toFixed(0) + '" fill="' + F + '" opacity="0.95"/>';
      for (var mi = 0; mi < 5; mi++) s += '<rect x="' + (bx + mi * tw / 5).toFixed(0) + '" y="' + (by - 26).toFixed(0) + '" width="' + (tw / 5 - 6).toFixed(0) + '" height="30" fill="' + F + '"/>';
      s += '<rect x="' + (bx + tw * 0.3).toFixed(0) + '" y="' + (by - 120).toFixed(0) + '" width="' + (tw * 0.4).toFixed(0) + '" height="110" fill="' + F + '"/>';
      s += '<polygon points="' + (bx + tw * 0.28).toFixed(0) + ',' + (by - 118).toFixed(0) + ' ' + (bx + tw * 0.5).toFixed(0) + ',' + (by - 190).toFixed(0) + ' ' + (bx + tw * 0.72).toFixed(0) + ',' + (by - 118).toFixed(0) + '" fill="' + A + '"/>';
      for (var wi2 = 0; wi2 < 3; wi2++) for (var wj = 0; wj < 2; wj++)
        s += '<rect x="' + (bx + 24 + wj * (tw - 60)).toFixed(0) + '" y="' + (by + 40 + wi2 * 80).toFixed(0) + '" width="26" height="40" rx="13" fill="' + A + '" opacity="0.9"/>';
      s += '<rect x="' + (cx - 26).toFixed(0) + '" y="' + (by + th - 110).toFixed(0) + '" width="52" height="110" rx="26" fill="' + D + '" opacity="0.9"/>';
    } else if (kind === "ship") {
      var sw = range(r, 260, 420);
      s += '<path d="M' + (cx - sw / 2).toFixed(0) + ',' + cy.toFixed(0) + ' L' + (cx + sw / 2).toFixed(0) + ',' + cy.toFixed(0) + ' L' + (cx + sw * 0.32).toFixed(0) + ',' + (cy + 90).toFixed(0) + ' L' + (cx - sw * 0.32).toFixed(0) + ',' + (cy + 90).toFixed(0) + ' Z" fill="' + F + '"/>';
      s += '<line x1="' + cx.toFixed(0) + '" y1="' + cy.toFixed(0) + '" x2="' + cx.toFixed(0) + '" y2="' + (cy - 220).toFixed(0) + '" stroke="' + D + '" stroke-width="10"/>';
      s += '<polygon points="' + cx.toFixed(0) + ',' + (cy - 218).toFixed(0) + ' ' + (cx + 150).toFixed(0) + ',' + (cy - 140).toFixed(0) + ' ' + cx.toFixed(0) + ',' + (cy - 60).toFixed(0) + '" fill="' + A + '" opacity="0.92"/>';
      s += '<polygon points="' + cx.toFixed(0) + ',' + (cy - 218).toFixed(0) + ' ' + (cx - 110).toFixed(0) + ',' + (cy - 150).toFixed(0) + ' ' + cx.toFixed(0) + ',' + (cy - 80).toFixed(0) + '" fill="' + F + '" opacity="0.85"/>';
      s += '<circle cx="' + (cx + 40).toFixed(0) + '" cy="' + (cy + 34).toFixed(0) + '" r="12" fill="' + A + '"/><circle cx="' + (cx - 40).toFixed(0) + '" cy="' + (cy + 34).toFixed(0) + '" r="12" fill="' + A + '"/>';
    } else {                          /* bloom: flower / abstract bloom */
      var pr = range(r, 70, 120), petals = rangei(r, 6, 10);
      for (var pi = 0; pi < petals; pi++) {
        var ang = (pi / petals) * Math.PI * 2;
        var px = cx + Math.cos(ang) * pr * 1.5, py = cy + Math.sin(ang) * pr * 1.5;
        s += '<ellipse cx="' + px.toFixed(0) + '" cy="' + py.toFixed(0) + '" rx="' + (pr * 0.85).toFixed(0) + '" ry="' + (pr * 0.5).toFixed(0) + '" fill="' + F + '" opacity="0.9" transform="rotate(' + (ang * 180 / Math.PI).toFixed(0) + ' ' + px.toFixed(0) + ' ' + py.toFixed(0) + ')"/>';
      }
      s += '<circle cx="' + cx.toFixed(0) + '" cy="' + cy.toFixed(0) + '" r="' + (pr * 0.62).toFixed(0) + '" fill="' + A + '"/>';
      s += '<circle cx="' + cx.toFixed(0) + '" cy="' + cy.toFixed(0) + '" r="' + (pr * 0.34).toFixed(0) + '" fill="' + D + '" opacity="0.8"/>';
      s += '<path d="M' + cx.toFixed(0) + ',' + (cy + pr * 0.6).toFixed(0) + ' q10,120 -30,220" stroke="#2e7d4f" stroke-width="14" fill="none"/>';
    }
    return s;
  }
  function foreground(r, pal, w, h, kind) {
    var s = "";
    if (kind === "dots") {
      for (var i = 0; i < 40; i++) s += '<circle cx="' + range(r, 0, w).toFixed(0) + '" cy="' + range(r, h * 0.7, h).toFixed(0) + '" r="' + range(r, 2, 7).toFixed(1) + '" fill="' + pal.accent + '" opacity="0.5"/>';
    } else if (kind === "blades") {
      for (var j = 0; j < 46; j++) {
        var x = range(r, 0, w), hh = range(r, 26, 90);
        s += '<path d="M' + x.toFixed(0) + ',' + h + ' q' + range(r, -24, 24).toFixed(0) + ',' + (-hh * 0.7).toFixed(0) + ' ' + range(r, -14, 14).toFixed(0) + ',' + (-hh).toFixed(0) + '" stroke="' + pal.mid[0] + '" stroke-width="7" fill="none" stroke-linecap="round"/>';
      }
    } else { /* sparkles */
      for (var k = 0; k < 26; k++) {
        var x2 = range(r, 0, w), y2 = range(r, 0, h), sz = range(r, 6, 18);
        s += '<path d="M' + x2.toFixed(0) + ',' + (y2 - sz).toFixed(0) + ' L' + (x2 + sz * 0.28).toFixed(0) + ',' + (y2 - sz * 0.28).toFixed(0) + ' L' + (x2 + sz).toFixed(0) + ',' + y2.toFixed(0) + ' L' + (x2 + sz * 0.28).toFixed(0) + ',' + (y2 + sz * 0.28).toFixed(0) + ' L' + x2.toFixed(0) + ',' + (y2 + sz).toFixed(0) + ' L' + (x2 - sz * 0.28).toFixed(0) + ',' + (y2 + sz * 0.28).toFixed(0) + ' L' + (x2 - sz).toFixed(0) + ',' + y2.toFixed(0) + ' L' + (x2 - sz * 0.28).toFixed(0) + ',' + (y2 - sz * 0.28).toFixed(0) + ' Z" fill="' + pal.fg + '" opacity="0.55"/>';
      }
    }
    return s;
  }

  /* ---------------- image composer ---------------- */
  function composeImage(prompt, opts) {
    opts = opts || {};
    var g = guard(prompt);
    var seedStr = prompt + "|" + (opts.style || "auto") + "|" + (opts.scene || "");
    var seed = xfnv1a(seedStr);
    var r = mulberry32(seed);
    var pal = opts.style && opts.style !== "auto"
      ? PALETTES.find(function (p) { return p.name === opts.style; }) || PALETTES[seed % PALETTES.length]
      : PALETTES[seed % PALETTES.length];
    var scene = opts.scene || classify(g.cleanPrompt);
    var W = 1200, H = 800, s = "";
    s += '<defs>' + grad("bg", pal.bg[0], pal.bg[1]) +
      '<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="' + pal.accent + '" stop-opacity="0.5"/><stop offset="1" stop-color="' + pal.accent + '" stop-opacity="0"/></radialGradient></defs>';
    s += '<rect width="' + W + '" height="' + H + '" fill="url(#bg)"/>';
    var base = H * 0.78;
    if (scene === "space") {
      s += stars(r, pal, 150, W, H);
      s += celestial(r, pal, w0(W), H);
      var px = range(r, W * 0.55, W * 0.9), py = range(r, H * 0.45, H * 0.7), prad = range(r, 60, 130);
      s += '<circle cx="' + px.toFixed(0) + '" cy="' + py.toFixed(0) + '" r="' + (prad * 1.35).toFixed(0) + '" fill="none" stroke="' + pal.accent + '" stroke-width="5" opacity="0.6" transform="rotate(-18 ' + px.toFixed(0) + ' ' + py.toFixed(0) + ')"/>';
      s += '<circle cx="' + px.toFixed(0) + '" cy="' + py.toFixed(0) + '" r="' + prad.toFixed(0) + '" fill="' + pal.mid[0] + '"/>';
      s += '<circle cx="' + (px - prad * 0.3).toFixed(0) + '" cy="' + (py - prad * 0.25).toFixed(0) + '" r="' + (prad * 0.5).toFixed(0) + '" fill="' + pal.mid[1 % pal.mid.length] + '" opacity="0.7"/>';
      if (r() < 0.7) { /* rocket */
        var rx = range(r, W * 0.1, W * 0.4), ry = range(r, H * 0.3, H * 0.55);
        s += '<g transform="rotate(24 ' + rx.toFixed(0) + ' ' + ry.toFixed(0) + ')"><rect x="' + (rx - 22).toFixed(0) + '" y="' + (ry - 70).toFixed(0) + '" width="44" height="130" rx="22" fill="' + pal.fg + '"/>' +
          '<circle cx="' + rx.toFixed(0) + '" cy="' + (ry - 30).toFixed(0) + '" r="14" fill="' + pal.accent + '"/>' +
          '<polygon points="' + (rx - 22).toFixed(0) + ',' + (ry + 40).toFixed(0) + ' ' + (rx - 52).toFixed(0) + ',' + (ry + 90).toFixed(0) + ' ' + (rx - 22).toFixed(0) + ',' + (ry + 78).toFixed(0) + '" fill="' + pal.accent + '"/>' +
          '<polygon points="' + (rx + 22).toFixed(0) + ',' + (ry + 40).toFixed(0) + ' ' + (rx + 52).toFixed(0) + ',' + (ry + 90).toFixed(0) + ' ' + (rx + 22).toFixed(0) + ',' + (ry + 78).toFixed(0) + '" fill="' + pal.accent + '"/></g>';
      }
      s += foreground(r, pal, W, H, "sparkles");
    } else if (scene === "ocean") {
      s += celestial(r, pal, w0(W), H);
      s += '<rect y="' + (H * 0.42).toFixed(0) + '" width="' + W + '" height="' + (H * 0.58).toFixed(0) + '" fill="' + pal.mid[0] + '" opacity="0.55"/>';
      s += waves(r, pal, W, H, H * 0.5);
      if (r() < 0.6) s += subject(r, pal, W, H, "ship");
      s += foreground(r, pal, W, H, "dots");
    } else if (scene === "landscape") {
      s += celestial(r, pal, w0(W), H);
      for (var ci = 0; ci < 5; ci++) {
        var cx2 = range(r, 0, W), cy2 = range(r, H * 0.08, H * 0.3), cw = range(r, 90, 220);
        s += '<ellipse cx="' + cx2.toFixed(0) + '" cy="' + cy2.toFixed(0) + '" rx="' + cw.toFixed(0) + '" ry="' + (cw * 0.32).toFixed(0) + '" fill="' + pal.fg + '" opacity="0.28"/>';
      }
      s += mountains(r, pal, W, H, base);
      if (r() < 0.5) s += subject(r, pal, W, H, "beast"); else s += subject(r, pal, W, H, "bloom");
      s += foreground(r, pal, W, H, "blades");
    } else if (scene === "city") {
      s += stars(r, pal, 40, W, H);
      s += celestial(r, pal, w0(W), H);
      s += buildings(r, pal, W, H, base);
      s += '<rect y="' + base.toFixed(0) + '" width="' + W + '" height="' + (H - base).toFixed(0) + '" fill="' + pal.deep + '" opacity="0.9"/>';
      for (var li = 0; li < 7; li++) s += '<rect x="' + (li * W / 7 + 10).toFixed(0) + '" y="' + (base + 26).toFixed(0) + '" width="' + (W / 7 - 20).toFixed(0) + '" height="8" fill="' + pal.accent + '" opacity="0.5"/>';
      s += foreground(r, pal, W, H, "sparkles");
    } else if (scene === "creature") {
      s += '<rect width="' + W + '" height="' + H + '" fill="url(#glow)" opacity="0.5"/>';
      s += stars(r, pal, 60, W, H);
      var k2 = pick(r, ["beast", "robot", "bird"]);
      s += subject(r, pal, W, H, k2);
      s += '<ellipse cx="' + (W / 2).toFixed(0) + '" cy="' + (H * 0.88).toFixed(0) + '" rx="220" ry="34" fill="' + pal.deep + '" opacity="0.65"/>';
      s += foreground(r, pal, W, H, "sparkles");
    } else if (scene === "object") {
      s += stars(r, pal, 50, W, H);
      s += '<circle cx="' + (W / 2).toFixed(0) + '" cy="' + (H * 0.55).toFixed(0) + '" r="300" fill="url(#glow)"/>';
      s += subject(r, pal, W, H, pick(r, ["tower", "ship", "bloom", "robot"]));
      s += foreground(r, pal, W, H, "dots");
    } else { /* abstract */
      s += stars(r, pal, 70, W, H);
      for (var ai = 0; ai < 7; ai++) {
        var ax = range(r, 0, W), ay = range(r, 0, H), ar = range(r, 60, 260);
        s += '<circle cx="' + ax.toFixed(0) + '" cy="' + ay.toFixed(0) + '" r="' + ar.toFixed(0) + '" fill="' + (ai % 2 ? pal.accent : pal.mid[ai % pal.mid.length]) + '" opacity="0.22"/>';
      }
      for (var ri = 0; ri < 5; ri++) {
        var rx2 = range(r, 0, W), ry2 = range(r, 0, H), rw2 = range(r, 40, 200), rh2 = range(r, 40, 200);
        s += '<rect x="' + rx2.toFixed(0) + '" y="' + ry2.toFixed(0) + '" width="' + rw2.toFixed(0) + '" height="' + rh2.toFixed(0) + '" rx="24" fill="none" stroke="' + pal.fg + '" stroke-width="4" opacity="0.5" transform="rotate(' + rangei(r, 0, 60) + ' ' + rx2.toFixed(0) + ' ' + ry2.toFixed(0) + ')"/>';
      }
      var d = "M-20," + (H * 0.6).toFixed(0);
      for (var wx = 0; wx <= W; wx += 100) d += " C" + (wx + 30) + "," + range(r, H * 0.2, H * 0.9).toFixed(0) + " " + (wx + 70) + "," + range(r, H * 0.2, H * 0.9).toFixed(0) + " " + (wx + 100) + "," + range(r, H * 0.3, H * 0.8).toFixed(0);
      s += '<path d="' + d + '" stroke="' + pal.accent + '" stroke-width="10" fill="none" opacity="0.7"/>';
      s += foreground(r, pal, W, H, "sparkles");
    }
    /* poster caption */
    var capWords = prompt.trim().split(/\s+/).slice(0, 6).join(" ");
    if (opts.caption || /poster|ad\b|sale|party|event|show|grand opening/i.test(prompt)) {
      var cap = (opts.caption || capWords).toUpperCase();
      s += '<rect x="60" y="' + (H - 150) + '" width="' + (W - 120) + '" height="96" rx="14" fill="' + pal.deep + '" opacity="0.82"/>';
      s += '<text x="' + (W / 2) + '" y="' + (H - 86) + '" text-anchor="middle" font-family="Verdana,sans-serif" font-weight="bold" font-size="52" fill="' + pal.accent + '" stroke="' + pal.deep + '" stroke-width="1">' + esc(cap.slice(0, 42)) + '</text>';
    }
    /* signature mark */
    s += '<text x="' + (W - 24) + '" y="' + (H - 22) + '" text-anchor="end" font-family="monospace" font-size="20" fill="' + pal.fg + '" opacity="0.6">SIG-ART · ' + seed.toString(16).toUpperCase() + '</text>';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + s + "</svg>";
    return {
      svg: svg, seed: seed, seedHex: seed.toString(16).toUpperCase(),
      palette: pal.name, scene: scene, prompt: prompt,
      guarded: !g.clean, guardNote: g.note || "",
      description: "A " + pal.name.toLowerCase() + " " + scene + " scene — " + prompt.trim().slice(0, 120)
    };
  }
  function w0(W) { return W; }

  /* ---------------- video planner + frame renderer ---------------- */
  function planVideo(prompt, opts) {
    opts = opts || {};
    var g = guard(prompt);
    var seed = xfnv1a(prompt + "|video|" + (opts.seconds || 6));
    var r = mulberry32(seed);
    var pal = PALETTES[seed % PALETTES.length];
    var scene = classify(g.cleanPrompt);
    if (scene === "creature" || scene === "object") scene = "landscape";
    return {
      seed: seed, seedHex: seed.toString(16).toUpperCase(), palette: pal.name,
      scene: scene, prompt: prompt, seconds: opts.seconds || 6, fps: 15,
      drift: range(r, 0.4, 1.4), pulse: range(r, 0.5, 1.5),
      px: range(r, 0, 1200), py: range(r, 100, 500),
      caption: (opts.caption || prompt.trim().split(/\s+/).slice(0, 7).join(" ")).slice(0, 60),
      guarded: !g.clean, guardNote: g.note || ""
    };
  }
  /* ctx: 2d context OR a mock recorder with the same method names */
  function drawVideoFrame(ctx, plan, t) {
    var W = 1280, H = 720;
    var r = mulberry32(plan.seed + Math.floor(t * 1000));
    var pal = PALETTES.find(function (p) { return p.name === plan.palette; }) || PALETTES[0];
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pal.bg[0]); g.addColorStop(1, pal.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    /* drifting stars */
    ctx.fillStyle = pal.fg;
    for (var i = 0; i < 70; i++) {
      var sx = (r() * W + t * 40 * plan.drift) % W, sy = r() * H * 0.7;
      ctx.globalAlpha = 0.25 + 0.55 * Math.abs(Math.sin(t * 2 + i));
      ctx.fillRect(sx, sy, 2.4, 2.4);
    }
    ctx.globalAlpha = 1;
    /* pulsing sun */
    var sunX = W * 0.72, sunY = H * 0.3 + Math.sin(t * plan.pulse) * 26;
    var rad = 90 + Math.sin(t * 2 * plan.pulse) * 10;
    ctx.globalAlpha = 0.25; ctx.fillStyle = pal.accent;
    ctx.beginPath(); ctx.arc(sunX, sunY, rad * 1.8, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.arc(sunX, sunY, rad, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    /* rolling hills */
    for (var L = 0; L < 3; L++) {
      ctx.fillStyle = pal.mid[L % pal.mid.length]; ctx.globalAlpha = 0.55 + L * 0.16;
      ctx.beginPath(); ctx.moveTo(0, H);
      for (var x = 0; x <= W; x += 80) {
        var y = H * 0.62 + L * 60 + Math.sin(x / 220 + t * plan.drift + L * 2) * 44;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    /* bouncing subject */
    var bx = W * 0.3 + Math.sin(t * 0.9) * 60, by = H * 0.52 + Math.abs(Math.sin(t * 2.2)) * -70;
    ctx.fillStyle = pal.fg;
    ctx.beginPath(); ctx.arc(bx, by, 54, 0, 7); ctx.fill();
    ctx.fillStyle = pal.accent;
    ctx.beginPath(); ctx.arc(bx - 18, by - 12, 12, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 18, by - 12, 12, 0, 7); ctx.fill();
    ctx.fillStyle = pal.deep;
    ctx.beginPath(); ctx.arc(bx - 18, by - 12, 5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 18, by - 12, 5, 0, 7); ctx.fill();
    /* caption card */
    var capA = Math.min(1, t / 1.2);
    ctx.globalAlpha = 0.85 * capA; ctx.fillStyle = pal.deep;
    var cw = 900, ch2 = 92;
    ctx.fillRect((W - cw) / 2, H - 150, cw, ch2);
    ctx.globalAlpha = capA; ctx.fillStyle = pal.accent;
    ctx.font = "bold 44px Verdana,sans-serif"; ctx.textAlign = "center";
    ctx.fillText(plan.caption.toUpperCase().slice(0, 44), W / 2, H - 150 + 60);
    ctx.globalAlpha = 1;
    /* mark */
    ctx.fillStyle = pal.fg; ctx.font = "20px monospace"; ctx.textAlign = "right";
    ctx.globalAlpha = 0.6;
    ctx.fillText("SIG-ART · " + plan.seedHex, W - 24, H - 20);
    ctx.globalAlpha = 1;
  }

  /* ---------------- prompt expansion (Llama or local) ---------------- */
  var LLAMA_BASE = "https://justinahiggins614-cmyk.github.io/signature-backend/sigllama/";
  var llamaState = { loading: null, ready: false };
  function llamaEnsure() {
    if (llamaState.ready) return Promise.resolve(true);
    if (llamaState.loading) return llamaState.loading;
    llamaState.loading = new Promise(function (resolve) {
      function fin(ok) { llamaState.ready = !!ok; resolve(llamaState.ready); }
      var timer = setTimeout(function () { fin(false); }, 25000);
      function boot() {
        try {
          if (typeof SigLlama === "undefined") { clearTimeout(timer); fin(false); return; }
          SigLlama.load(LLAMA_BASE).then(function () { clearTimeout(timer); fin(true); }, function () { clearTimeout(timer); fin(false); });
        } catch (e) { clearTimeout(timer); fin(false); }
      }
      if (typeof SigLlama !== "undefined") { boot(); return; }
      var s = document.createElement("script");
      s.src = LLAMA_BASE + "sigllama.js"; s.async = true;
      s.onload = boot; s.onerror = function () { clearTimeout(timer); fin(false); };
      document.head.appendChild(s);
    });
    return llamaState.loading;
  }
  var STYLE_WORDS = ["vivid", "cinematic", "dreamlike", "bold", "luminous", "epic", "serene", "electric", "majestic", "playful"];
  function localExpand(prompt) {
    var r = mulberry32(xfnv1a(prompt + "|expand"));
    var scene = classify(prompt);
    var bits = [prompt.trim()];
    bits.push(pick(r, STYLE_WORDS) + " " + scene + " composition");
    bits.push(pick(r, ["rich detail", "layered depth", "striking contrast", "harmonious color"]));
    return { text: bits.join(", "), source: "Signature Engine (on-device deterministic)" };
  }
  function expandPrompt(prompt) {
    return llamaEnsure().then(function (ok) {
      if (!ok) return localExpand(prompt);
      try {
        return SigLlama.generate(
          "Expand this image idea into one vivid art-direction sentence. Idea: " + prompt.slice(0, 200),
          { maxTokens: 60, temperature: 0.7, topK: 40 }
        ).then(function (t) {
          t = String(t || "").trim().replace(/\s+/g, " ");
          if (!t || t.length < 8) return localExpand(prompt);
          return { text: prompt.trim() + " — " + t.slice(0, 220), source: "Signature Llama (live)" };
        }, function () { return localExpand(prompt); });
      } catch (e) { return localExpand(prompt); }
    });
  }

  /* ---------------- exports ---------------- */
  function download(url, filename) {
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); }, 800);
  }
  function svgToPng(svgStr, w, h) {
    return new Promise(function (resolve, reject) {
      var blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        try {
          var c = document.createElement("canvas"); c.width = w || 1200; c.height = h || 800;
          var x = c.getContext("2d"); x.drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          c.toBlob(function (b) { b ? resolve(b) : reject(new Error("toBlob failed")); }, "image/png");
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("SVG raster failed")); };
      img.src = url;
    });
  }
  function exportWebm(canvas, plan, onDone) {
    try {
      if (!canvas.captureStream || typeof MediaRecorder === "undefined") {
        onDone(null, "This browser cannot record video — try Chrome or Edge on desktop.");
        return;
      }
      var stream = canvas.captureStream(plan.fps);
      var mime = "video/webm";
      if (typeof MediaRecorder.isTypeSupported === "function" && !MediaRecorder.isTypeSupported(mime)) mime = "";
      var rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      var chunks = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = function () { onDone(new Blob(chunks, { type: "video/webm" }), null); };
      rec.start(250);
      var t0 = performance.now(), dur = plan.seconds * 1000;
      var ctx = canvas.getContext("2d");
      (function tick() {
        var el = performance.now() - t0, t = Math.min(el / 1000, plan.seconds);
        drawVideoFrame(ctx, plan, t);
        if (el < dur) requestAnimationFrame(tick); else rec.stop();
      })();
    } catch (e) { onDone(null, String(e && e.message || e)); }
  }

  /* ---------------- goods mockups ---------------- */
  var GOOD_CATS = [
    "room poster", "sticker", "t-shirt", "number sticker", "surfboard", "mug",
    "phone case", "hat", "banner", "tote bag", "hoodie", "mousepad",
    "notebook", "flag", "wall decal", "keychain", "water bottle", "backpack",
    "calendar", "puzzle", "lunchbox", "beach towel", "socks", "playing cards"
  ];
  function mockupSVG(cat, art, seed) {
    var r = mulberry32(seed ^ 0x9e37);
    var pal = PALETTES[seed % PALETTES.length];
    var inner = art.svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    var shape = "", W = 600, H = 600;
    function clipWrap(innerSVG, clipId, clipShape) {
      return '<defs><clipPath id="' + clipId + '">' + clipShape + '</clipPath></defs>' +
        '<g clip-path="url(#' + clipId + ')"><g transform="translate(-300,-100) scale(1)">' + innerSVG + "</g>" + clipShape.replace(/ fill="[^"]*"/g, ' fill="none"') + "</g>";
    }
    if (cat === "t-shirt" || cat === "hoodie") {
      var shirt = '<path d="M200,120 L120,170 L80,260 L150,285 L170,240 L170,520 L430,520 L430,240 L450,285 L520,260 L480,170 L400,120 Q360,160 300,160 Q240,160 200,120 Z"/>';
      shape = '<rect width="600" height="600" fill="' + pal.deep + '"/>' + clipWrap(inner, "m1", shirt) +
        shirt.replace("<path", '<path fill="none" stroke="' + pal.fg + '" stroke-width="6"');
    } else if (cat === "mug" || cat === "water bottle") {
      var mug = '<rect x="200" y="150" width="200" height="320" rx="26"/>';
      shape = '<rect width="600" height="600" fill="' + pal.deep + '"/>' + clipWrap(inner, "m1", mug) +
        mug.replace("<rect", '<rect fill="none" stroke="' + pal.fg + '" stroke-width="6"') +
        '<path d="M400,200 q90,20 60,130 q-24,90 -70,80" fill="none" stroke="' + pal.fg + '" stroke-width="22"/>';
    } else if (cat === "phone case") {
      var pc = '<rect x="210" y="80" width="180" height="440" rx="42"/>';
      shape = '<rect width="600" height="600" fill="' + pal.deep + '"/>' + clipWrap(inner, "m1", pc) +
        pc.replace("<rect", '<rect fill="none" stroke="' + pal.fg + '" stroke-width="6"') +
        '<circle cx="300" cy="140" r="26" fill="' + pal.deep + '" stroke="' + pal.fg + '" stroke-width="5"/>';
    } else if (cat === "hat") {
      var hat = '<path d="M120,360 Q300,180 480,360 L440,380 Q300,260 160,380 Z"/><rect x="110" y="360" width="380" height="46" rx="20"/>';
      shape = '<rect width="600" height="600" fill="' + pal.deep + '"/>' + clipWrap(inner, "m1", hat) +
        hat.replace("<path", '<path fill="none" stroke="' + pal.fg + '" stroke-width="6"').replace("<rect", '<rect fill="none" stroke="' + pal.fg + '" stroke-width="6"');
    } else if (cat === "surfboard") {
      var sb = '<ellipse cx="300" cy="300" rx="95" ry="250"/>';
      shape = '<rect width="600" height="600" fill="' + pal.deep + '"/>' + clipWrap(inner, "m1", sb) +
        sb.replace("<ellipse", '<ellipse fill="none" stroke="' + pal.fg + '" stroke-width="6"');
    } else if (cat === "banner" || cat === "flag") {
      var bn = '<rect x="40" y="200" width="520" height="200"/>';
      shape = '<rect width="600" height="600" fill="' + pal.deep + '"/>' + clipWrap(inner, "m1", bn) +
        bn.replace("<rect", '<rect fill="none" stroke="' + pal.fg + '" stroke-width="6"') +
        '<rect x="30" y="120" width="14" height="360" fill="' + pal.fg + '"/>';
    } else if (cat === "sticker" || cat === "number sticker" || cat === "wall decal" || cat === "keychain") {
      var st = '<rect x="120" y="140" width="360" height="320" rx="90"/>';
      shape = '<rect width="600" height="600" fill="' + pal.deep + '"/>' + clipWrap(inner, "m1", st) +
        st.replace("<rect", '<rect fill="' + pal.fg + '" opacity="0.25"').replace(/$/, "") +
        st.replace("<rect", '<rect fill="none" stroke="' + pal.fg + '" stroke-width="10" stroke-dasharray="22,12"');
    } else { /* poster, notebook, calendar, puzzle, lunchbox, beach towel, socks, playing cards, tote bag, backpack, mousepad */
      var pr2 = '<rect x="90" y="60" width="420" height="480" rx="10"/>';
      shape = '<rect width="600" height="600" fill="' + pal.deep + '"/>' + clipWrap(inner, "m1", pr2) +
        pr2.replace("<rect", '<rect fill="none" stroke="' + pal.fg + '" stroke-width="6"');
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">' + shape +
      '<text x="300" y="580" text-anchor="middle" font-family="Verdana" font-size="22" fill="' + pal.fg + '" opacity="0.85">' + esc(cat.toUpperCase()) + " · SIG-GOODS</text></svg>";
  }

  /* ---------------- ad creative ---------------- */
  var AD_HEADLINES = ["YOURS TODAY", "BUILT FOR YOU", "THE SIGNATURE CHOICE", "GRAB IT NOW", "MADE TO AMAZE", "DON'T MISS IT", "PURE SIGNATURE", "ONE OF A KIND"];
  function adCreative(ad) {
    var r = mulberry32(ad.seed);
    var pal = PALETTES[ad.seed % PALETTES.length];
    var W = 1200, H = 800, s = "";
    s += '<defs>' + grad("abg", pal.bg[0], pal.bg[1]) + "</defs>";
    s += '<rect width="' + W + '" height="' + H + '" fill="url(#abg)"/>' + stars(r, pal, 80, W, H);
    s += '<circle cx="' + (W / 2) + '" cy="' + (H * 0.42) + '" r="210" fill="' + pal.accent + '" opacity="0.16"/>';
    s += '<rect x="90" y="60" width="' + (W - 180) + '" height="120" rx="16" fill="' + pal.deep + '" opacity="0.85"/>';
    s += '<text x="' + (W / 2) + '" y="140" text-anchor="middle" font-family="Verdana" font-weight="bold" font-size="64" fill="' + pal.accent + '">' + esc(ad.headline) + "</text>";
    var nm = ad.product.name.length > 44 ? ad.product.name.slice(0, 44) + "…" : ad.product.name;
    s += '<text x="' + (W / 2) + '" y="' + (H * 0.44) + '" text-anchor="middle" font-family="Verdana" font-weight="bold" font-size="54" fill="' + pal.fg + '">' + esc(nm) + "</text>";
    s += '<text x="' + (W / 2) + '" y="' + (H * 0.44 + 64) + '" text-anchor="middle" font-family="Verdana" font-size="34" fill="' + pal.fg + '" opacity="0.85">' + esc(ad.tagline) + "</text>";
    s += '<rect x="' + (W / 2 - 260) + '" y="' + (H - 190) + '" width="520" height="92" rx="46" fill="' + pal.accent + '"/>';
    s += '<text x="' + (W / 2) + '" y="' + (H - 130) + '" text-anchor="middle" font-family="Verdana" font-weight="bold" font-size="40" fill="' + pal.deep + '">GET IT AT THE SIGNATURE MEGA-MALL</text>';
    s += '<text x="' + (W - 24) + '" y="' + (H - 22) + '" text-anchor="end" font-family="monospace" font-size="20" fill="' + pal.fg + '" opacity="0.6">SIG-AD · ' + ad.seed.toString(16).toUpperCase() + "</text>";
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '">' + s + "</svg>";
  }

  return {
    hash: xfnv1a, rng: mulberry32, PALETTES: PALETTES, GOOD_CATS: GOOD_CATS,
    classify: classify, guard: guard, expandPrompt: expandPrompt,
    composeImage: composeImage, planVideo: planVideo, drawVideoFrame: drawVideoFrame,
    svgToPng: svgToPng, exportWebm: exportWebm, download: download,
    mockupSVG: mockupSVG, adCreative: adCreative, AD_HEADLINES: AD_HEADLINES, esc: esc
  };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SigArt;
