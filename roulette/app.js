/* Social Roulette — demo game logic (no real money, client-side RNG). */
(() => {
  "use strict";

  /* ------------------------------------------------------------------ data */
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const colorOf = (n) => (n === 0 ? "zero" : RED.has(n) ? "red" : "black");

  const CHIPS = [
    { value: 10, color: "#377a8d", ring: "ring-10", inset: "rgba(22,24,25,.5)" },
    { value: 25, color: "#9d2b2a", ring: "ring-25" },
    { value: 50, color: "#2c703f", ring: "ring-50", large: true },
    { value: 100, color: "#295793", ring: "ring-100" },
    { value: 250, color: "#6f3091", ring: "ring-250" },
  ];

  // racetrack: number hit-boxes taken from the Figma text layers (relative to the 302×76 art)
  const RACE_NUMBERS = [
    [24, 30, 7], [16, 46, 7], [33, 63, 7], [1, 79, 7], [20, 95, 7], [14, 111, 7], [31, 127, 7], [9, 144, 7],
    [22, 160, 7], [18, 176, 7], [29, 192, 7], [7, 208, 7], [28, 225, 7], [12, 241, 7], [35, 259, 7],
    [30, 30, 64], [11, 46, 64], [36, 63, 64], [13, 79, 64], [27, 95, 64], [6, 111, 64], [34, 127, 64], [17, 144, 64],
    [25, 160, 64], [2, 176, 64], [21, 192, 64], [4, 208, 64], [19, 225, 64], [15, 241, 64], [32, 259, 64],
    [3, 278, 14], [26, 287, 35], [0, 278, 56], [5, 13, 11], [10, 2, 25], [23, 2, 45], [8, 13, 59],
  ];
  // classic French "announced" bets: [bet key, chips on it]
  const RACE_SECTIONS = [
    { name: "Tiers du cylindre", left: 18, width: 70, bets: [["sp:5-8", 1], ["sp:10-11", 1], ["sp:13-16", 1], ["sp:23-24", 1], ["sp:27-30", 1], ["sp:33-36", 1]] },
    { name: "Orphelins", left: 99, width: 58, bets: [["n:1", 1], ["sp:6-9", 1], ["sp:14-17", 1], ["sp:17-20", 1], ["sp:31-34", 1]] },
    { name: "Voisins du zéro", left: 164, width: 58, bets: [["tr:0-2-3", 2], ["sp:4-7", 1], ["sp:12-15", 1], ["sp:18-21", 1], ["sp:19-22", 1], ["co:25-26-28-29", 2], ["sp:32-35", 1]] },
    { name: "Jeu zéro", left: 224, width: 60, bets: [["sp:0-3", 1], ["sp:12-15", 1], ["n:26", 1], ["sp:32-35", 1]] },
  ];
  // European wheel order, used for neighbour bets
  const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

  const BETTING_MS = 15000;
  const CLOSED_MS = 2500;
  const RESULT_MS = 4500;

  /* ----------------------------------------------------------------- state */
  const state = {
    wallet: 1000,
    chipIndex: 2, // 50, as selected in the design
    bets: new Map(),
    undo: [],
    lastBets: null,
    round: 10482,
    results: [12, 9, 27, 10, 0, 11, 22, 0, 35, 36, 1, 9, 9],
    phase: "open",
    phaseEnds: 0,
    sound: localStorage.getItem("sr.sfx") !== "off",
    music: localStorage.getItem("sr.music") !== "off",
    muted: localStorage.getItem("sr.muted") === "on",
    force: null, // next result, used by the motion demo panel
    neighbours: Math.min(9, Math.max(1, +localStorage.getItem("sr.neighbours") || 2)),
  };
  const M = window.Motion || null; // motion layer (motion.js); everything works without it
  const DEMO = new URLSearchParams(location.search).has("demo");

  /* portrait phones/tablets get the re-flowed layout (see styles.css) */
  const portrait = window.matchMedia("(max-aspect-ratio: 1/1)");
  const isMobile = () => portrait.matches;

  /* --------------------------------------------------------------- helpers */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const fmt = (n) => `${n.toLocaleString("en-US")} cr`;
  const short = (n) => (n >= 1000 ? `${+(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : String(n));
  const totalBet = () => [...state.bets.values()].reduce((a, b) => a + b, 0);
  const snapshot = () => new Map(state.bets);
  const randInt = (max) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  };

  // inside bets carry their numbers in the key, e.g. "sp:17-20", "co:16-17-19-20"
  const INSIDE = { sp: "Split", st: "Street", tr: "Trio", co: "Corner", ff: "First four", sl: "Six line" };
  const PAYOUT = { n: 35, sp: 17, st: 11, tr: 11, co: 8, ff: 8, sl: 5, col: 2, doz: 2 };
  const betKey = (type, nums) => `${type}:${[...nums].sort((a, b) => a - b).join("-")}`;
  function covered(key) {
    const [type, arg] = key.split(":");
    if (INSIDE[type]) return arg.split("-").map(Number);
    const all = Array.from({ length: 36 }, (_, i) => i + 1);
    switch (type) {
      case "n": return [+arg];
      case "col": return all.filter((n) => n % 3 === (+arg % 3));
      case "doz": return all.filter((n) => Math.ceil(n / 12) === +arg);
      case "low": return all.filter((n) => n <= 18);
      case "high": return all.filter((n) => n >= 19);
      case "even": return all.filter((n) => n % 2 === 0);
      case "odd": return all.filter((n) => n % 2 === 1);
      case "red": return all.filter((n) => RED.has(n));
      case "black": return all.filter((n) => !RED.has(n));
      default: return [];
    }
  }
  const payoutOf = (key) => PAYOUT[key.split(":")[0]] ?? 1;
  const sectionNumbers = (i) => [...new Set(RACE_SECTIONS[i].bets.flatMap(([k]) => covered(k)))];
  function neighbours(n, count = state.neighbours) {
    const i = WHEEL.indexOf(n);
    return Array.from({ length: count * 2 + 1 }, (_, k) => WHEEL[(i + k - count + WHEEL.length) % WHEEL.length]);
  }

  /* ----------------------------------------------------------------- sound */
  let audio;
  const ctx = () => (audio = audio || new (window.AudioContext || window.webkitAudioContext)());
  function blip(freq = 900, dur = 0.06, type = "triangle", gain = 0.05) {
    if (!state.sound || state.muted) return;
    try {
      ctx();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(gain, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + dur);
    } catch (_) { /* audio unavailable */ }
  }

  /* Casino chip sounds, synthesised: a clay chip "clack" is a very short burst
     of band-passed noise (the impact) plus a faint, fast-decaying ping (the
     chip ringing). Pitch, timing and level are randomised a little so no two
     chips sound identical, like real ones. */
  let noiseBuf;
  function noise() {
    if (noiseBuf) return noiseBuf;
    const c = ctx();
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.4), c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  const CHIP_VOL = 2; // sits clearly above the background music
  function clack(t, { freq, q, gain, decay, ping = 0.1 }) {
    const c = ctx();
    gain *= CHIP_VOL;
    const src = c.createBufferSource();
    src.buffer = noise();
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = q;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 700;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.0015);
    env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(bp).connect(hp).connect(env).connect(c.destination);
    src.start(t, Math.random() * 0.3);
    src.stop(t + decay + 0.02);
    if (ping) {
      const o = c.createOscillator();
      const og = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq * 0.92, t);
      o.frequency.exponentialRampToValueAtTime(freq * 0.86, t + 0.07);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(gain * ping, t + 0.002);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o.connect(og).connect(c.destination);
      o.start(t);
      o.stop(t + 0.1);
    }
  }
  // "felt": first chip on an empty spot (duller tap) · "stack": chip landing on chips (bright double click)
  function chipSound(kind = "stack", when = 0) {
    if (!state.sound || state.muted) return;
    try {
      const c = ctx();
      c.resume?.();
      const r = () => 0.92 + Math.random() * 0.16;
      const t = c.currentTime + 0.005 + when;
      if (kind === "felt") {
        clack(t, { freq: 1900 * r(), q: 2.5, gain: 0.32, decay: 0.05, ping: 0.05 });
        clack(t + 0.016 + Math.random() * 0.008, { freq: 2900 * r(), q: 5, gain: 0.12, decay: 0.03, ping: 0 });
      } else {
        clack(t, { freq: 3300 * r(), q: 7, gain: 0.42, decay: 0.05, ping: 0.12 });
        clack(t + 0.009 + Math.random() * 0.008, { freq: 4300 * r(), q: 9, gain: 0.22, decay: 0.04, ping: 0.08 });
        clack(t + 0.03 + Math.random() * 0.01, { freq: 3700 * r(), q: 8, gain: 0.08, decay: 0.03, ping: 0 });
      }
    } catch (_) { /* audio unavailable */ }
  }
  // a quick run of chip clicks: chips being swept away or collected
  function chipRiffle(count = 6, spacing = 0.04, delay = 0) {
    for (let i = 0; i < count; i++) {
      chipSound(i % 3 ? "stack" : "felt", delay + i * spacing + Math.random() * 0.012);
    }
  }

  /* ----------------------------------------------------------------- music
     Casino lounge jazz, cut into a seamless 78s loop (the end crossfades into
     the start). Starts on the first tap/click (browser autoplay rules), fades
     in and out, ducks under wins, pauses when the tab is hidden. Routed
     through Web Audio so fades also work on iOS, where <audio>.volume is
     read-only. */
  const Music = (() => {
    const TRACKS = [{ src: "./assets/audio/casino-jazz-loop.m4a", title: "Casino lounge jazz" }];
    const LEVEL = 0.32;
    let el;
    let gain;
    let idx = 0;
    let playing = false;
    let unlocked = false;

    function ensure() {
      if (el) return;
      el = new Audio();
      el.preload = "auto";
      el.src = TRACKS[idx].src;
      el.loop = TRACKS.length === 1;
      el.addEventListener("ended", next);
      try {
        const src = ctx().createMediaElementSource(el);
        gain = ctx().createGain();
        gain.gain.value = 0;
        src.connect(gain).connect(ctx().destination);
      } catch (_) {
        gain = null;
      }
    }
    function fade(to, secs) {
      if (!el) return;
      if (gain) {
        const t = ctx().currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(to, t + secs);
      } else {
        el.volume = Math.min(1, to);
      }
    }
    const wanted = () => unlocked && state.music && !state.muted && !document.hidden;
    function play() {
      if (!wanted()) return;
      ensure();
      ctx().resume?.();
      el.play().then(() => { playing = true; fade(LEVEL, 2.5); }).catch(() => {});
    }
    function pause() {
      if (!el || !playing) return;
      playing = false;
      fade(0, 0.8);
      setTimeout(() => { if (!playing) el.pause(); }, 850);
    }
    function next() {
      idx = (idx + 1) % TRACKS.length;
      el.src = TRACKS[idx].src;
      if (wanted()) el.play().then(() => fade(LEVEL, 2.5)).catch(() => {});
    }
    function duck() {
      if (!playing) return;
      fade(LEVEL * 0.35, 0.25);
      setTimeout(() => playing && fade(LEVEL, 1.6), 1800);
    }
    const sync = () => (wanted() ? play() : pause());
    const nowPlaying = () => TRACKS[idx].title;
    const unlock = () => { unlocked = true; sync(); };
    return { sync, duck, nowPlaying, unlock };
  })();

  /* ------------------------------------------------------------ chip markup */
  const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
  function chipHTML(chip, label = chip.value) {
    const dots = ANGLES.map(
      (a) => `<img class="chip__dot" style="--a:${a}deg" src="./assets/chips/dot-${chip.large ? "lg-" : ""}${a}.svg" alt="">`
    ).join("");
    const notches = [0, 90, 180, 270].map((r) => `<span class="chip__notch" style="--r:${r}deg"></span>`).join("");
    const inset = chip.inset ? `;--inset:${chip.inset}` : "";
    return `<span class="chip" style="--c:${chip.color}${inset}">${notches}<img class="chip__ring" src="./assets/chips/${chip.ring}.svg" alt="">${dots}<span class="chip__value">${label}</span></span>`;
  }
  const chipForAmount = (amt) => [...CHIPS].reverse().find((c) => amt >= c.value) || CHIPS[0];

  /* ---------------------------------------------------------- build the UI */
  function buildRack() {
    const rack = $("#chipRack");
    rack.innerHTML = CHIPS.map(
      (c, i) => `<button class="chip-slot" type="button" role="radio" data-chip="${i}" aria-label="${c.value} credits chip">${chipHTML(c)}</button>`
    ).join("");
    rack.addEventListener("click", (e) => {
      const slot = e.target.closest(".chip-slot");
      if (slot) selectChip(+slot.dataset.chip);
    });
  }

  function selectChip(i, silent = false) {
    state.chipIndex = (i + CHIPS.length) % CHIPS.length;
    $$(".chip-slot").forEach((el, idx) => {
      el.classList.toggle("is-active", idx === state.chipIndex);
      el.setAttribute("aria-checked", idx === state.chipIndex);
    });
    if (!silent) {
      blip(1200, 0.04);
      M?.chipSelect($$(".chip-slot")[state.chipIndex]);
    }
  }

  function buildNumbers() {
    const rows = [3, 2, 1].map((offset) => {
      const cells = Array.from({ length: 12 }, (_, c) => {
        const n = c * 3 + offset;
        return `<button class="cell cell--${colorOf(n)}" type="button" data-bet="n:${n}" aria-label="Straight up ${n}"><span class="cell__num">${n}</span><span class="stake"></span></button>`;
      }).join("");
      return `<div class="numbers__row">${cells}</div>`;
    });
    $("#numbers").innerHTML = rows.join("") + `<div class="inside">${desktopSpots()}</div>`;
  }

  const spot = (type, nums, style, cls = "hs") =>
    `<button class="${cls}" type="button" data-bet="${betKey(type, nums)}" aria-label="${INSIDE[type]} ${[...nums].sort((a, b) => a - b).join(", ")}" style="${style}"><span class="stake"></span></button>`;

  // inside bets on the landscape table: splits on every shared edge, corners where four
  // numbers meet, streets / six lines on the bottom edge, and the zero combinations
  function desktopSpots() {
    const P = 50.945; // cell pitch
    const S = 48.264; // cell size
    const G = 2.681; // gap
    const H = 150.154; // height of the 3 rows
    const off = [3, 2, 1];
    const num = (r, c) => c * 3 + off[r];
    const at = (cx, cy, w, h) => `left:${(cx - w / 2).toFixed(2)}px;top:${(cy - h / 2).toFixed(2)}px;width:${w}px;height:${h}px`;
    const out = [];
    for (let r = 0; r < 3; r++) {
      out.push(spot("sp", [0, num(r, 0)], at(-G / 2, r * P + S / 2, 14, 30)));
      for (let c = 0; c < 12; c++) {
        if (c < 11) out.push(spot("sp", [num(r, c), num(r, c + 1)], at((c + 1) * P - G / 2, r * P + S / 2, 14, 30)));
        if (r < 2) out.push(spot("sp", [num(r, c), num(r + 1, c)], at(c * P + S / 2, (r + 1) * P - G / 2, 30, 14)));
      }
    }
    for (let c = 0; c < 12; c++) {
      const base = c * 3 + 1;
      out.push(spot("st", [base, base + 1, base + 2], at(c * P + S / 2, H + G / 2, 30, 14)));
    }
    // corners and six lines last so they sit on top of the splits/streets they overlap
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 11; c++) out.push(spot("co", [num(r, c), num(r, c + 1), num(r + 1, c), num(r + 1, c + 1)], at((c + 1) * P - G / 2, (r + 1) * P - G / 2, 16, 16)));
    }
    for (let c = 0; c < 11; c++) {
      const base = c * 3 + 1;
      out.push(spot("sl", [base, base + 1, base + 2, base + 3, base + 4, base + 5], at((c + 1) * P - G / 2, H + G / 2, 16, 14)));
    }
    out.push(spot("tr", [0, 2, 3], at(-G / 2, P - G / 2, 16, 16)));
    out.push(spot("tr", [0, 1, 2], at(-G / 2, 2 * P - G / 2, 16, 16)));
    out.push(spot("ff", [0, 1, 2, 3], at(-G / 2, H + G / 2, 16, 14)));
    return out.join("");
  }

  // the same bets on the portrait table, placed as grid items on the cell they hang off
  function mobileSpots() {
    const cell = (n) => `grid-row:${1 + Math.ceil(n / 3)};grid-column:${3 + ((n - 1) % 3)}`;
    const m = (type, nums, anchor, dirs) => spot(type, nums, cell(anchor), `hs hs-m ${dirs}`);
    const out = [];
    for (let n = 1; n <= 36; n++) {
      const col = (n - 1) % 3; // 0 left · 1 middle · 2 right
      if (col < 2) out.push(m("sp", [n, n + 1], n, "hs-e hs-tall"));
      if (n <= 33) out.push(m("sp", [n, n + 3], n, "hs-b hs-wide"));
      if (col === 0) out.push(m("st", [n, n + 1, n + 2], n, "hs-s hs-tall"));
      if (n <= 3) out.push(m("sp", [0, n], n, "hs-t hs-wide"));
    }
    for (let n = 1; n <= 36; n++) {
      const col = (n - 1) % 3;
      if (col < 2 && n <= 32) out.push(m("co", [n, n + 1, n + 3, n + 4], n, "hs-e hs-b hs-dot"));
      if (col === 0 && n <= 31) out.push(m("sl", [n, n + 1, n + 2, n + 3, n + 4, n + 5], n, "hs-s hs-b hs-dot"));
    }
    out.push(m("tr", [0, 1, 2], 1, "hs-e hs-t hs-dot"));
    out.push(m("tr", [0, 2, 3], 2, "hs-e hs-t hs-dot"));
    out.push(m("ff", [0, 1, 2, 3], 1, "hs-s hs-t hs-dot"));
    return out.join("");
  }

  // portrait table: zero on top, 12 rows of 3 numbers, outside bets down the left, 2:1 at the bottom
  function buildMobileBoard() {
    const outs = [
      ["low", "1-18"], ["even", "EVEN"], ["red", null], ["black", null], ["odd", "ODD"], ["high", "19-36"],
    ];
    const label = (t) => `<span class="out__label mb-vlabel">${t}</span>`;
    const stake = '<span class="stake"></span>';
    const html = [
      `<button class="mb-zero" type="button" data-bet="n:0" aria-label="Straight up 0"><span class="cell__num">0</span>${stake}</button>`,
      `<span class="mb-corner" style="grid-row:1" aria-hidden="true"></span>`,
    ];
    [1, 2, 3].forEach((d) => {
      html.push(`<button class="mb-out" type="button" data-bet="doz:${d}" style="grid-column:2;grid-row:${2 + (d - 1) * 4} / span 4" aria-label="${["1st", "2nd", "3rd"][d - 1]} dozen">${label(["1st 12", "2nd 12", "3rd 12"][d - 1])}${stake}</button>`);
    });
    outs.forEach(([key, text], i) => {
      const inner = text ? label(text) : `<span class="mb-diamond"><img src="./assets/img/diamond-${key}.svg" alt=""></span>`;
      const cls = i === 0 ? " mb-tl" : i === 5 ? " mb-bl" : "";
      html.push(`<button class="mb-out${cls}" type="button" data-bet="${key}" style="grid-column:1;grid-row:${2 + i * 2} / span 2" aria-label="${key}">${inner}${stake}</button>`);
    });
    for (let n = 1; n <= 36; n++) {
      html.push(`<button class="cell cell--${colorOf(n)} mb-num" type="button" data-bet="n:${n}" style="grid-row:${1 + Math.ceil(n / 3)};grid-column:${3 + ((n - 1) % 3)}" aria-label="Straight up ${n}"><span class="cell__num">${n}</span>${stake}</button>`);
    }
    [1, 2, 3].forEach((c) => {
      const cls = c === 1 ? " mb-col--left" : c === 3 ? " mb-col--right" : "";
      html.push(`<button class="mb-col${cls}" type="button" data-bet="col:${c}" style="grid-row:14;grid-column:${2 + c}" aria-label="Column ${c}, pays 2 to 1"><span class="out__label">2:1</span>${stake}</button>`);
    });
    html.push(`<span class="mb-corner" style="grid-row:14" aria-hidden="true"></span>`);
    html.push(mobileSpots());
    $("#mboard").innerHTML = `<div class="mb-grid">${html.join("")}</div>`;
  }

  function buildRacetrack() {
    const hits = RACE_NUMBERS.map(
      ([n, x, y]) => `<button class="race-hit" type="button" data-race="${n}" aria-label="${n} and its neighbours" style="left:${x - 1}px;top:${y - 6}px;width:17px;height:18px"></button>`
    );
    const secs = RACE_SECTIONS.map(
      (s, i) => `<button class="race-sec" type="button" data-section="${i}" aria-label="${s.name}: ${s.bets.reduce((t, [, c]) => t + c, 0)} chips" title="${s.name}" style="left:${s.left}px;width:${s.width}px"></button>`
    );
    $("#raceHits").innerHTML = secs.join("") + hits.join("");
  }

  function renderHistory(fresh = false) {
    $("#historyTrack").innerHTML = state.results
      .slice(0, 16)
      .map((n, i) => `<span class="num num--${colorOf(n)}${fresh && i === 0 ? " is-new" : ""}">${n}</span>`)
      .join("");
    if (fresh) M?.historyIn($("#historyTrack"));
  }

  function renderStakes() {
    $$("[data-bet] .stake").forEach((el) => {
      const key = el.parentElement.dataset.bet;
      const amt = state.bets.get(key);
      const prev = el.dataset.amt;
      if (!amt) { el.innerHTML = ""; delete el.dataset.amt; return; }
      if (String(amt) !== prev) {
        el.innerHTML = chipHTML(chipForAmount(amt), short(amt));
        el.dataset.amt = amt;
      }
    });
    const staked = totalBet();
    $("#balance").textContent = fmt(state.wallet - staked);
    $("#totalBet").textContent = fmt(staked);
    const open = state.phase === "open";
    $("#btnUndo").disabled = !open || state.undo.length === 0;
    $("#btnClear").disabled = !open || staked === 0;
    $("#btnDouble").disabled = !open || staked === 0;
    $("#btnRebet").disabled = !open || !state.lastBets || staked > 0;
  }

  /* --------------------------------------------------------------- betting */
  function flashShort() {
    const bar = $("#balanceBar");
    bar.classList.remove("is-short");
    void bar.offsetWidth;
    bar.classList.add("is-short");
    bar.addEventListener("animationend", () => bar.classList.remove("is-short"), { once: true });
    M?.shake(bar);
    blip(180, 0.15, "sawtooth", 0.04);
  }

  function place(entries) {
    if (state.phase !== "open") return false;
    const cost = entries.reduce((a, [, amt]) => a + amt, 0);
    if (totalBet() + cost > state.wallet) { flashShort(); return false; }
    state.undo.push(snapshot());
    const kinds = new Map(entries.map(([key]) => [key, state.bets.has(key) ? "stack" : "felt"]));
    entries.forEach(([key, amt]) => state.bets.set(key, (state.bets.get(key) || 0) + amt));
    renderStakes();
    const land = (key) => chipSound(kinds.get(key));
    if (M?.enabled) M.chipFly(entries.map(([key]) => key), land);
    else entries.slice(0, 6).forEach(([key], i) => chipSound(kinds.get(key), i * 0.035));
    return true;
  }

  const chipValue = () => CHIPS[state.chipIndex].value;
  const placeSection = (i) => place(RACE_SECTIONS[i].bets.map(([key, chips]) => [key, chipValue() * chips]));

  function setNeighbours(count) {
    state.neighbours = Math.min(9, Math.max(1, count));
    localStorage.setItem("sr.neighbours", state.neighbours);
    $("#nbCount").textContent = state.neighbours;
    $('#neighbours [data-n="-1"]').disabled = state.neighbours === 1;
    $('#neighbours [data-n="1"]').disabled = state.neighbours === 9;
  }

  function onBoardClick(e) {
    const target = e.target.closest("[data-bet]");
    if (target) place([[target.dataset.bet, chipValue()]]);
  }

  function highlight(numbers, on) {
    const set = new Set(numbers);
    $$('[data-bet^="n:"]').forEach((el) => {
      if (set.has(+el.dataset.bet.slice(2))) el.classList.toggle("is-covered", on);
    });
    $$(".race-hit").forEach((el) => {
      if (set.has(+el.dataset.race)) el.classList.toggle("is-covered", on);
    });
  }

  function wireBoard() {
    const board = $("#board");
    board.addEventListener("click", onBoardClick);
    $("#mboard").addEventListener("click", onBoardClick);
    $("#mboard").addEventListener("mouseover", (e) => {
      const t = e.target.closest(".hs");
      if (t) highlight(covered(t.dataset.bet), true);
    });
    $("#mboard").addEventListener("mouseout", (e) => {
      const t = e.target.closest(".hs");
      if (t) highlight(covered(t.dataset.bet), false);
    });
    // hovering an outside bet previews which numbers it covers
    board.addEventListener("mouseover", (e) => {
      const t = e.target.closest("[data-bet]");
      if (t && !t.dataset.bet.startsWith("n:")) highlight(covered(t.dataset.bet), true);
    });
    board.addEventListener("mouseout", (e) => {
      const t = e.target.closest("[data-bet]");
      if (t && !t.dataset.bet.startsWith("n:")) highlight(covered(t.dataset.bet), false);
    });

    const race = $("#racetrack");
    race.addEventListener("click", (e) => {
      const hit = e.target.closest(".race-hit");
      const sec = e.target.closest(".race-sec");
      if (hit) place(neighbours(+hit.dataset.race).map((n) => [`n:${n}`, chipValue()]));
      if (sec) placeSection(+sec.dataset.section);
    });
    race.addEventListener("mouseover", (e) => {
      const sec = e.target.closest(".race-sec");
      const hit = e.target.closest(".race-hit");
      if (sec) highlight(sectionNumbers(+sec.dataset.section), true);
      if (hit) highlight(neighbours(+hit.dataset.race), true);
    });
    race.addEventListener("mouseout", (e) => {
      const sec = e.target.closest(".race-sec");
      const hit = e.target.closest(".race-hit");
      if (sec) highlight(sectionNumbers(+sec.dataset.section), false);
      if (hit) highlight(neighbours(+hit.dataset.race), false);
    });

    $("#btnUndo").addEventListener("click", () => {
      if (state.phase !== "open" || !state.undo.length) return;
      const prev = state.undo.pop();
      const changed = [...state.bets.keys()].filter((k) => prev.get(k) !== state.bets.get(k));
      const gone = M ? M.collect(changed) : [];
      state.bets = prev;
      renderStakes();
      M?.sweep(gone, -1);
      chipRiffle(Math.min(3, Math.max(1, gone.length)), 0.05);
    });
    $("#btnClear").addEventListener("click", () => {
      if (state.phase !== "open" || !state.bets.size) return;
      state.undo.push(snapshot());
      const gone = M ? M.collect([...state.bets.keys()]) : [];
      state.bets.clear();
      renderStakes();
      M?.sweep(gone);
      chipRiffle(Math.min(8, Math.max(3, gone.length + 2)), 0.035);
    });
    $("#btnDouble").addEventListener("click", () => {
      if (state.phase !== "open" || !state.bets.size) return;
      place([...state.bets.entries()]);
    });
    $("#btnRebet").addEventListener("click", () => {
      if (state.phase !== "open" || !state.lastBets || totalBet() > 0) return;
      place([...state.lastBets.entries()]);
    });

    $("#chipPrev").addEventListener("click", () => selectChip(state.chipIndex - 1));
    $("#chipNext").addEventListener("click", () => selectChip(state.chipIndex + 1));
  }

  /* ---------------------------------------------------------------- rounds */
  function setStatus(phase, html, animate = true) {
    const apply = () => {
      $("#status").dataset.phase = phase;
      $("#statusLabel").innerHTML = html;
    };
    animate && M ? M.statusSwap(apply) : apply();
  }

  function lock(locked) {
    $("#board").classList.toggle("is-locked", locked);
    $("#mboard").classList.toggle("is-locked", locked);
    $("#racetrack").classList.toggle("is-locked", locked);
  }

  function openBetting() {
    state.phase = "open";
    state.phaseEnds = performance.now() + BETTING_MS;
    $$(".is-win").forEach((el) => el.classList.remove("is-win"));
    setStatus("open", "BETS OPEN");
    lock(false);
    renderStakes();
    document.documentElement.classList.remove("is-spin");
    M?.betsOpen();
    document.documentElement.classList.remove("was-spin");
    M ? M.resultArc($("#resultArc"), false) : ($("#resultArc").hidden = true);
  }

  function closeBetting() {
    state.phase = "closed";
    state.phaseEnds = performance.now() + CLOSED_MS;
    setStatus("closed", "NO MORE BETS");
    lock(true);
    renderStakes();
    document.documentElement.classList.add("is-spin", "was-spin");
    M?.betsClosed();
    blip(440, 0.18, "sine", 0.06);
  }

  function settle() {
    const n = state.force ?? randInt(37);
    state.force = null;
    const color = colorOf(n);
    const staked = totalBet();
    let won = 0;
    for (const [key, amt] of state.bets) {
      if (covered(key).includes(n)) won += amt * (payoutOf(key) + 1);
    }
    const keys = [...state.bets.keys()];
    const winKeys = keys.filter((k) => covered(k).includes(n));
    const winClones = M ? M.collect(winKeys) : [];
    const loseClones = M ? M.collect(keys.filter((k) => !winKeys.includes(k))) : [];
    const shownBefore = state.wallet - staked;
    state.wallet = state.wallet - staked + won;
    if (staked) state.lastBets = snapshot();
    state.bets.clear();
    state.undo = [];

    state.results.unshift(n);
    renderHistory(true);

    state.phase = "result";
    state.phaseEnds = performance.now() + RESULT_MS;
    setStatus("result", `<span class="status__ball status__ball--${color}">${n}</span>${color === "zero" ? "ZERO" : color.toUpperCase()}`);

    // light up the winning number and every outside bet that pays
    $$("[data-bet]").forEach((el) => {
      const k = el.dataset.bet;
      const spotBet = el.classList.contains("hs");
      el.classList.toggle("is-win", covered(k).includes(n) && (!spotBet || keys.includes(k)));
    });
    $$(".race-hit").forEach((el) => el.classList.toggle("is-win", +el.dataset.race === n));

    renderStakes();
    showResultArc(n);
    M?.resultFocus();
    M?.winBurst(n);
    M?.settleChips(winClones, loseClones, $("#balance"));
    if (M && won > 0) M.countUp($("#balance"), shownBefore, state.wallet, fmt);
    if (won > 0) {
      Music.duck();
      winPop(`+${fmt(won)}`);
      blip(660, 0.12, "sine", 0.07);
      setTimeout(() => blip(990, 0.2, "sine", 0.07), 120);
      chipRiffle(Math.min(10, 3 + winClones.length * 2), 0.045, M?.enabled ? 1.15 : 0.3);
    }
    hostLine(n, color, won);
  }

  function showResultArc(n) {
    const i = WHEEL.indexOf(n);
    const tile = (x, cls) => `<span class="ra-tile ${cls} ra-tile--${colorOf(x)}">${x}</span>`;
    const el = $("#resultArc");
    el.innerHTML = tile(WHEEL[(i + WHEEL.length - 1) % WHEEL.length], "ra-side ra-left") + tile(n, "ra-main") + tile(WHEEL[(i + 1) % WHEEL.length], "ra-side ra-right");
    M ? M.resultArc(el, true) : (el.hidden = false);
  }

  function nextRound() {
    state.round += 1;
    $("#roundPill").textContent = `Round #${state.round}`;
    $$(".race-hit.is-win").forEach((el) => el.classList.remove("is-win"));
    openBetting();
  }

  function tick() {
    const now = performance.now();
    const left = Math.max(0, state.phaseEnds - now);
    const timer = $("#statusTimer");
    if (state.phase === "open") {
      timer.style.setProperty("--p", (left / BETTING_MS).toFixed(4));
      const secs = Math.ceil(left / 1000);
      const label = secs <= 5 ? `BETS OPEN · ${secs}` : "BETS OPEN";
      if ($("#statusLabel").textContent !== label) {
        $("#statusLabel").textContent = label;
        if (secs <= 5) { M?.countdown(); blip(1500, 0.03, "sine", 0.03); }
      }
      if (left === 0) closeBetting();
    } else {
      timer.style.setProperty("--p", 0);
      if (left === 0) state.phase === "closed" ? settle() : nextRound();
    }
    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------- effects */
  function winPop(text) {
    const el = document.createElement("div");
    el.className = "win-pop";
    el.textContent = text;
    $("#fxLayer").appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  function floatEmoji(emoji, opts = {}) {
    const el = document.createElement("span");
    const tone = { "👎": "red", "🤡": "red", "🔥": "red" }[emoji] || "grey";
    el.className = `react react--${tone} fly`;
    el.textContent = emoji;
    const fx = $("#fxLayer");
    let x = opts.x ?? 990 + Math.random() * 120;
    let y = opts.y ?? 520 + Math.random() * 80;
    if (isMobile()) {
      x = fx.clientWidth - 70 - Math.random() * 70;
      y = fx.clientHeight - 56 - Math.random() * 24;
    }
    el.style.cssText = `--x:${x}px;--y:${y}px;--box:50px;--rot:${(Math.random() * 60 - 30).toFixed(1)}deg;--dx:${(Math.random() * 40 - 20).toFixed(0)}px;--dur:${(2.8 + Math.random()).toFixed(2)}s`;
    $("#fxLayer").appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  /* ------------------------------------------------------------------ chat */
  const timeNow = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const escapeHTML = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function addMessage(kind, text, author) {
    const box = $("#chatMessages");
    const el = document.createElement("div");
    el.className = `msg msg--${kind}`;
    const meta = kind === "host" ? "" :
      `<div class="msg__meta"><span>${escapeHTML(author || "Me")}</span><img src="./assets/img/dot-sep.svg" width="3" height="3" alt=""><span>${timeNow()}</span></div>`;
    el.innerHTML = `${meta}<p class="msg__text">${escapeHTML(text)}</p>`;
    box.appendChild(el);
    fadeLater(el);
    // older bubbles slide off the top under a fade (desktop) or scroll (mobile sheet)
    while (box.children.length > 40) box.firstElementChild.remove();
    box.classList.toggle("is-overflow", box.scrollHeight > box.clientHeight + 1);
    box.scrollTop = box.scrollHeight;
    if (kind === "host" && isMobile() && !chatOpen()) {
      toast(el);
      unread += 1;
      const badge = $("#chatBadge");
      badge.textContent = unread > 9 ? "9+" : unread;
      badge.hidden = false;
      M?.badgePop(badge);
    }
  }

  // desktop live feed: a message stays ~4s, then fades and collapses away (CSS)
  const MSG_LIFE = 4000;
  function fadeLater(el, delay = MSG_LIFE) {
    setTimeout(() => {
      el.classList.add("is-faded");
      const box = $("#chatMessages");
      setTimeout(() => box.classList.toggle("is-overflow", box.scrollHeight > box.clientHeight + 1), 800);
    }, delay);
  }

  // other players chatting at the table
  const PLAYERS = ["Lucas", "Mariana", "Pedro", "Ana", "João", "Bia", "Gabriel", "Camila", "Thiago", "Larissa", "Rafa", "Diego"];
  const CHATTER = [
    "Red again, I can feel it 🔴", "17 has to come back 😅", "Going all in on black!", "Nice spin Rafaela 👏",
    "Who's on zero with me? 🟢", "Third dozen gang 🙌", "Voisins every round", "That was so close 😩",
    "Corner 25-29, trust me", "Let's gooo 🔥", "Splitting 17/20 this time", "Boa noite, mesa! 🇧🇷",
    "Odd numbers all night", "Took a break, I'm back 😎", "Neighbours of 32 🍀", "Can't stop won't stop",
    "Six line 1-6 hit last time!", "Good luck everyone 🍀", "Black is due…", "Haha the clown emoji 🤡",
  ];
  function chatter() {
    setTimeout(() => {
      if (!document.hidden) addMessage("other", CHATTER[randInt(CHATTER.length)], PLAYERS[randInt(PLAYERS.length)]);
      chatter();
    }, 800 + Math.random() * 700);
  }

  /* mobile: chat lives in a bottom sheet; new messages pop over the video */
  let unread = 0;
  const chatOpen = () => $("#app").classList.contains("is-chat");

  function toast(msgEl) {
    const t = msgEl.cloneNode(true);
    t.classList.add("toast");
    const box = $("#toasts");
    box.appendChild(t);
    M?.toastIn(t);
    while (box.children.length > 2) box.firstElementChild.remove();
    t.addEventListener("animationend", (e) => { if (e.animationName === "toast") t.remove(); });
  }

  function setChat(open) {
    const sheet = $("#chat");
    const backdrop = $("#sheetBackdrop");
    if (!open && chatOpen() && M?.enabled && isMobile()) {
      M.sheetClose(sheet, backdrop, () => {
        $("#app").classList.remove("is-chat");
        backdrop.hidden = true;
      });
      $("#chatFab").setAttribute("aria-expanded", false);
      if (document.activeElement === $("#chatInput")) $("#chatInput").blur();
      return;
    }
    const wasOpen = chatOpen();
    $("#app").classList.toggle("is-chat", open);
    backdrop.hidden = !open;
    $("#chatFab").setAttribute("aria-expanded", open);
    if (open && !wasOpen && isMobile()) M?.sheetOpen(sheet, backdrop);
    if (open) {
      unread = 0;
      $("#chatBadge").hidden = true;
      $("#toasts").innerHTML = "";
      const box = $("#chatMessages");
      box.scrollTop = box.scrollHeight;
    } else if (document.activeElement === $("#chatInput")) {
      $("#chatInput").blur();
    }
  }

  function hostLine(n, color, won) {
    const name = color === "zero" ? "Zero" : `${n} ${color === "red" ? "Red" : "Black"}`;
    const lines = won
      ? [`${name}! Nice one, enjoy those ${won.toLocaleString("en-US")} credits 🎉`, `${name} — you called it! 🔥`]
      : [`${name} this time. New round, new luck!`, `${name}! Place your chips, here we go again.`, `It's ${name}. Who's feeling lucky next?`];
    setTimeout(() => addMessage("host", lines[randInt(lines.length)]), 700);
  }

  function wireChat() {
    const form = $("#composer");
    const input = $("#chatInput");
    const field = $("#composerField");
    const stickers = $("#stickers");
    const mic = $("#micBtn");

    $("#chatFab").addEventListener("click", () => setChat(!chatOpen()));
    $("#chatClose").addEventListener("click", () => setChat(false));
    $("#sheetBackdrop").addEventListener("click", () => setChat(false));
    M?.sheetDrag($("#chat"), $("#chatClose"), () => setChat(false));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && chatOpen()) setChat(false); });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      addMessage("me", text);
      input.value = "";
      blip(1000, 0.04);
    });

    $$(".segmented__item").forEach((tab) =>
      tab.addEventListener("click", () => {
        $$(".segmented__item").forEach((t) => {
          t.classList.toggle("is-active", t === tab);
          t.setAttribute("aria-selected", t === tab);
        });
        const mode = tab.dataset.tab;
        stickers.hidden = mode !== "stickers";
        field.hidden = mode === "stickers";
        field.classList.toggle("is-voice", mode === "voice");
        input.disabled = mode === "voice";
        input.placeholder = mode === "voice" ? "Tap the mic to talk…" : "Write a message…";
        if (mode !== "voice") mic.setAttribute("aria-pressed", "false");
      })
    );

    stickers.addEventListener("click", (e) => {
      const b = e.target.closest("[data-emoji]");
      if (!b) return;
      floatEmoji(b.dataset.emoji, isMobile() ? {} : { x: 1050, y: 600 });
      blip(1300, 0.05);
    });

    mic.addEventListener("click", () => {
      const on = mic.getAttribute("aria-pressed") !== "true";
      if (on) $('[data-tab="voice"]').click();
      mic.setAttribute("aria-pressed", on);
    });
  }

  /* -------------------------------------------------------------- top bar */
  const POPOVERS = {
    history: () => ({
      title: "Last results",
      body: `<div class="history-grid">${state.results.slice(0, 40).map((n) => `<span class="num num--${colorOf(n)}">${n}</span>`).join("")}</div>`,
    }),
    help: () => ({
      title: "How to play",
      body: `<p style="margin:0 0 10px">Pick a chip, tap the table to place it, and wait for the dealer to spin. Bets close when the timer runs out.</p>
        <table>
          <tr><td>Straight up · tap a number</td><td>35 : 1</td></tr>
          <tr><td>Split · line between 2 numbers</td><td>17 : 1</td></tr>
          <tr><td>Street · outer edge of a row (3)</td><td>11 : 1</td></tr>
          <tr><td>Trio · 0-1-2 or 0-2-3</td><td>11 : 1</td></tr>
          <tr><td>Corner · where 4 numbers meet</td><td>8 : 1</td></tr>
          <tr><td>First four · 0-1-2-3</td><td>8 : 1</td></tr>
          <tr><td>Six line · two streets (6)</td><td>5 : 1</td></tr>
          <tr><td>Column (2:1) · Dozen</td><td>2 : 1</td></tr>
          <tr><td>Red/Black · Even/Odd · 1–18/19–36</td><td>1 : 1</td></tr>
          <tr><td>Racetrack number · neighbours</td><td>number ± N on the wheel</td></tr>
          <tr><td>Voisins · Tiers · Orphelins · Jeu zéro</td><td>classic chip layouts</td></tr>
        </table>`,
    }),
    settings: () => ({
      title: "Settings",
      body: `<label>Music <input type="checkbox" data-setting="music" ${state.music ? "checked" : ""}></label>
        <p class="now-playing">♪ ${Music.nowPlaying()} · looping</p>
        <label>Sound effects <input type="checkbox" data-setting="sound" ${state.sound ? "checked" : ""}></label>
        <label>Show racetrack <input type="checkbox" data-setting="racetrack" ${$("#racetrack").classList.contains("is-hidden") ? "" : "checked"}></label>`,
    }),
  };

  function wireTopbar() {
    const pop = $("#popover");
    let openKey = null;
    const close = () => {
      if (pop.hidden) return;
      openKey = null;
      M ? M.popoverClose(pop, () => (pop.hidden = true)) : (pop.hidden = true);
    };

    $$("[data-popover]").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const key = btn.dataset.popover;
        if (openKey === key) return close();
        const { title, body } = POPOVERS[key]();
        $("#popoverTitle").textContent = title;
        $("#popoverBody").innerHTML = body;
        pop.hidden = false;
        openKey = key;
        M?.popoverOpen(pop, btn);
      })
    );
    $("#popoverClose").addEventListener("click", close);
    document.addEventListener("click", (e) => { if (!pop.hidden && !pop.contains(e.target)) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    pop.addEventListener("change", (e) => {
      const s = e.target.dataset.setting;
      if (s === "sound") { state.sound = e.target.checked; localStorage.setItem("sr.sfx", state.sound ? "on" : "off"); }
      if (s === "music") { state.music = e.target.checked; localStorage.setItem("sr.music", state.music ? "on" : "off"); Music.sync(); }
      if (s === "racetrack") toggleRacetrack(e.target.checked);
    });

    $("#btnSound").addEventListener("click", () => setMuted(!state.muted));
    $("#btnFullscreen").addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => {});
    });
    $("#btnRacetrack").addEventListener("click", () => (isMobile() ? toggleRaceView() : toggleRacetrack()));
    $("#neighbours").addEventListener("click", (e) => {
      const b = e.target.closest("[data-n]");
      if (b) setNeighbours(state.neighbours + +b.dataset.n);
    });
    setNeighbours(state.neighbours);
  }

  // top-bar speaker = master mute for music + sound effects
  function setMuted(muted) {
    state.muted = muted;
    localStorage.setItem("sr.muted", muted ? "on" : "off");
    $("#btnSound").setAttribute("aria-pressed", !muted);
    Music.sync();
  }

  function toggleRaceView(force) {
    const app = $("#app");
    const show = force ?? !app.classList.contains("is-race");
    const change = () => app.classList.toggle("is-race", show);
    if (force === undefined && M) M.flipView(show ? $("#mboard") : $("#racetrack"), show ? $("#racetrack") : $("#mboard"), change);
    else change();
    $("#btnRacetrack").setAttribute("aria-pressed", show);
    $("#btnRacetrack .switch__label").textContent = show ? "Table" : "Racetrack";
    fitRacetrack();
  }

  // portrait: scale the racetrack to fill the space the table normally takes
  function fitRacetrack() {
    const track = $("#racetrack");
    if (!isMobile()) { track.style.zoom = ""; return; }
    const area = $("#mboard");
    const w = area.clientWidth - 24;
    const h = area.clientHeight - 16;
    track.style.zoom = Math.max(1, Math.min(w / 302, h / 76, 2.4)).toFixed(3);
  }

  function toggleRacetrack(force) {
    const track = $("#racetrack");
    const show = force ?? track.classList.contains("is-hidden");
    const was = !track.classList.contains("is-hidden");
    track.classList.toggle("is-hidden", !show);
    if (was !== show) M?.racetrackToggle(track, show);
    $("#btnRacetrack").setAttribute("aria-pressed", show);
    $("#btnRacetrack .switch__label").textContent = show ? "Switch to Racetrack" : "Show Racetrack";
  }

  /* ------------------------------------------------------------ keyboard */
  function wireKeys() {
    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input, textarea")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); $("#btnUndo").click(); }
      else if (e.key === "ArrowLeft") selectChip(state.chipIndex - 1);
      else if (e.key === "ArrowRight") selectChip(state.chipIndex + 1);
      else if (/^[1-5]$/.test(e.key)) selectChip(+e.key - 1);
    });
  }

  /* ---------------------------------------------------- scale to viewport */
  function fit() {
    const app = $("#app");
    const s = Math.min(window.innerWidth / 1456, window.innerHeight / 826);
    app.style.setProperty("--s", s.toFixed(4));
    fitRacetrack();
  }

  function onLayoutChange() {
    const mobile = isMobile();
    const label = $("#btnRacetrack .switch__label");
    if (mobile) {
      label.textContent = $("#app").classList.contains("is-race") ? "Table" : "Racetrack";
    } else {
      $("#app").classList.remove("is-race");
      $("#app").classList.remove("is-chat");
      $("#sheetBackdrop").hidden = true;
      $("#chat").style.transform = ""; // drop any drawer offset left by the portrait sheet
      toggleRacetrack(!$("#racetrack").classList.contains("is-hidden"));
    }
    fit();
  }

  // the party card introduces itself, then tucks away to its avatars (tap to reopen)
  function wireParty() {
    const card = $(".party");
    const collapse = () => {
      if (card.classList.contains("is-collapsed")) return;
      M && isMobile() ? M.partyMorph(card, () => card.classList.add("is-collapsed")) : card.classList.add("is-collapsed");
    };
    // on short screens the card would hide the dealer, so it starts tucked away
    const roomy = !isMobile() || $(".body__bg").clientHeight >= 170;
    if (!roomy) collapse();
    let timer = roomy ? setTimeout(collapse, 6000) : 0;
    card.addEventListener("click", () => {
      if (!isMobile()) return;
      clearTimeout(timer);
      M ? M.partyMorph(card, () => card.classList.toggle("is-collapsed")) : card.classList.toggle("is-collapsed");
      if (!card.classList.contains("is-collapsed")) timer = setTimeout(collapse, 6000);
    });
  }

  /* -------------------------------------------- ambient table reactions */
  function ambient() {
    // a lively stream of reactions from the table (about 5x the original rate)
    const pool = ["🥲", "👎", "🔥", "🤡", "🎉", "😍", "🍀", "👏"];
    setTimeout(() => {
      if (!document.hidden && document.querySelectorAll(".react.fly").length < 12) floatEmoji(pool[randInt(pool.length)]);
      ambient();
    }, 1000 + Math.random() * 1200);
  }

  /* ----------------------------------------------------------------- boot */
  window.addEventListener("resize", fit);
  portrait.addEventListener("change", onLayoutChange);
  buildRack();
  buildNumbers();
  buildMobileBoard();
  buildRacetrack();
  renderHistory();
  wireBoard();
  wireChat();
  wireTopbar();
  wireKeys();
  wireParty();
  onLayoutChange();
  selectChip(state.chipIndex, true);
  setMuted(state.muted);
  openBetting();
  requestAnimationFrame(tick);
  ambient();
  M?.intro();
  // the two opening messages from the design fade like the rest, then the table starts chatting
  $$("#chatMessages .msg").forEach((el, i) => fadeLater(el, 4500 + i * 700));
  setTimeout(chatter, 2500);

  // browsers only allow audio after a user gesture
  const startAudio = () => Music.unlock();
  ["pointerdown", "keydown"].forEach((t) => document.addEventListener(t, startAudio, { once: true }));
  document.addEventListener("visibilitychange", () => Music.sync());

  /* -------------------------------------------- motion demo panel (?demo) */
  if (DEMO) buildDemo();
  // test/recording hook: jump to the last seconds of the betting window
  if (DEMO || new URLSearchParams(location.search).has("reel")) {
    window.__skip = () => { if (state.phase === "open") state.phaseEnds = performance.now() + 4200; };
    window.__forceNext = (n) => { state.force = n; };
  }

  function buildDemo() {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const ensureOpen = () => { if (state.phase !== "open") nextRound(); };
    const ensureBets = () => {
      ensureOpen();
      if (!state.bets.size) place([["n:17", chipValue()], ["red", chipValue()], ["doz:2", chipValue()], ["col:2", chipValue()]]);
    };
    const runResult = async (win) => {
      ensureBets();
      await wait(650);
      const all = Array.from({ length: 37 }, (_, i) => i);
      const hits = (n) => [...state.bets.keys()].filter((k) => covered(k).includes(n)).length;
      const pool = all.filter((n) => (win ? hits(n) > 0 : hits(n) === 0));
      const n = win ? pool.sort((a, b) => hits(b) - hits(a))[0] : (pool.includes(0) ? 0 : pool[randInt(pool.length)]);
      state.force = n ?? randInt(37);
      closeBetting();
      state.phaseEnds = performance.now() + 1300;
    };
    const demos = [
      ["Intro: table builds in", () => M?.intro()],
      ["Place chips (fly from rack)", async () => {
        ensureOpen();
        const keys = isMobile() ? ["n:8", "n:23", "odd", "doz:3"] : ["n:8", "n:23", "odd", "doz:3", "col:1"];
        for (const k of keys) { place([[k, chipValue()]]); await wait(260); }
      }],
      ["Racetrack: Voisins du zéro", () => { ensureOpen(); placeSection(2); }],
      ["Racetrack: neighbours of 17", () => { ensureOpen(); place(neighbours(17).map((n) => [`n:${n}`, chipValue()])); }],
      ["Inside bets: split, street, corner, six line", async () => {
        ensureOpen();
        for (const k of ["sp:17-20", "st:13-14-15", "co:25-26-28-29", "sl:1-2-3-4-5-6", "tr:0-1-2"]) { place([[k, chipValue()]]); await wait(300); }
      }],
      ["Select chip (flip)", () => selectChip(state.chipIndex + 1)],
      ["Undo last chip", () => $("#btnUndo").click()],
      ["Clear table (chips slide off)", () => { ensureBets(); setTimeout(() => $("#btnClear").click(), 700); }],
      ["Bets close: table tilts away", () => M?.betsClosed()],
      ["Bets open: table springs back", () => M?.betsOpen()],
      ["Countdown pulse", () => M?.countdown()],
      ["Full round: WIN", () => runResult(true)],
      ["Full round: LOSE", () => runResult(false)],
      ["History: new number drops in", () => { state.results.unshift(randInt(37)); renderHistory(true); }],
      ["Chat drawer (portrait) / chat message", () => {
        if (isMobile()) setChat(!chatOpen());
        else addMessage("other", "Let's go, red!", "Lucas");
      }],
      ["Chat toast + unread badge", () => { if (isMobile() && chatOpen()) setChat(false); addMessage("host", "Welcome to the table! Place your bets 🍀"); }],
      ["Settings popover", () => $('[data-popover="settings"]').click()],
      ["Party card morph (portrait)", () => $(".party").click()],
      ["Table ↔ racetrack switch", () => $("#btnRacetrack").click()],
      ["Reaction bubble", () => floatEmoji(["🔥", "🎉", "🥲", "🤡"][randInt(4)])],
    ];
    const panel = document.createElement("aside");
    panel.className = "demo-panel";
    panel.innerHTML = `<button class="demo-panel__toggle" type="button" aria-expanded="true">Motion demo</button>
      <div class="demo-panel__list">${demos.map(([label], i) => `<button type="button" data-demo="${i}">${label}</button>`).join("")}</div>`;
    document.body.appendChild(panel);
    panel.addEventListener("click", (e) => {
      const b = e.target.closest("[data-demo]");
      if (b) { e.stopPropagation(); demos[+b.dataset.demo][1](); }
      if (e.target.closest(".demo-panel__toggle")) {
        const open = panel.classList.toggle("is-closed");
        e.target.setAttribute("aria-expanded", !open);
      }
    });
    if (isMobile()) panel.classList.add("is-closed");
  }
})();
