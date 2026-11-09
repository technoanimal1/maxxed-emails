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
  const RACE_SECTIONS = [
    { name: "Tiers", left: 18, width: 70, numbers: [27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33] },
    { name: "Orphelins", left: 99, width: 58, numbers: [1, 20, 14, 31, 9, 17, 34, 6] },
    { name: "Voisins", left: 164, width: 58, numbers: [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25] },
    { name: "Zero", left: 224, width: 60, numbers: [12, 35, 3, 26, 0, 32, 15] },
  ];

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
    sound: true,
  };

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

  function covered(key) {
    const [type, arg] = key.split(":");
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
  const payoutOf = (key) => (key.startsWith("n:") ? 35 : key.startsWith("col:") || key.startsWith("doz:") ? 2 : 1);

  /* ----------------------------------------------------------------- sound */
  let audio;
  function blip(freq = 900, dur = 0.06, type = "triangle", gain = 0.05) {
    if (!state.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
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
    if (!silent) blip(1200, 0.04);
  }

  function buildNumbers() {
    const rows = [3, 2, 1].map((offset) => {
      const cells = Array.from({ length: 12 }, (_, c) => {
        const n = c * 3 + offset;
        return `<button class="cell cell--${colorOf(n)}" type="button" data-bet="n:${n}" aria-label="Straight up ${n}"><span class="cell__num">${n}</span><span class="stake"></span></button>`;
      }).join("");
      return `<div class="numbers__row">${cells}</div>`;
    });
    $("#numbers").innerHTML = rows.join("");
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
    $("#mboard").innerHTML = `<div class="mb-grid">${html.join("")}</div>`;
  }

  function buildRacetrack() {
    const hits = RACE_NUMBERS.map(
      ([n, x, y]) => `<button class="race-hit" type="button" data-race="${n}" aria-label="Racetrack ${n}" style="left:${x - 1}px;top:${y - 6}px;width:17px;height:18px"></button>`
    );
    const secs = RACE_SECTIONS.map(
      (s, i) => `<button class="race-sec" type="button" data-section="${i}" aria-label="${s.name} (one chip on each of ${s.numbers.length} numbers)" title="${s.name}" style="left:${s.left}px;width:${s.width}px"></button>`
    );
    $("#raceHits").innerHTML = secs.join("") + hits.join("");
  }

  function renderHistory(fresh = false) {
    $("#historyTrack").innerHTML = state.results
      .slice(0, 16)
      .map((n, i) => `<span class="num num--${colorOf(n)}${fresh && i === 0 ? " is-new" : ""}">${n}</span>`)
      .join("");
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
    blip(180, 0.15, "sawtooth", 0.04);
  }

  function place(entries) {
    if (state.phase !== "open") return false;
    const cost = entries.reduce((a, [, amt]) => a + amt, 0);
    if (totalBet() + cost > state.wallet) { flashShort(); return false; }
    state.undo.push(snapshot());
    entries.forEach(([key, amt]) => state.bets.set(key, (state.bets.get(key) || 0) + amt));
    renderStakes();
    blip(760 + Math.random() * 200, 0.05);
    return true;
  }

  const chipValue = () => CHIPS[state.chipIndex].value;

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
      if (hit) place([[`n:${hit.dataset.race}`, chipValue()]]);
      if (sec) place(RACE_SECTIONS[+sec.dataset.section].numbers.map((n) => [`n:${n}`, chipValue()]));
    });
    race.addEventListener("mouseover", (e) => {
      const sec = e.target.closest(".race-sec");
      const hit = e.target.closest(".race-hit");
      if (sec) highlight(RACE_SECTIONS[+sec.dataset.section].numbers, true);
      if (hit) highlight([+hit.dataset.race], true);
    });
    race.addEventListener("mouseout", (e) => {
      const sec = e.target.closest(".race-sec");
      const hit = e.target.closest(".race-hit");
      if (sec) highlight(RACE_SECTIONS[+sec.dataset.section].numbers, false);
      if (hit) highlight([+hit.dataset.race], false);
    });

    $("#btnUndo").addEventListener("click", () => {
      if (state.phase !== "open" || !state.undo.length) return;
      state.bets = state.undo.pop();
      renderStakes();
      blip(520, 0.05);
    });
    $("#btnClear").addEventListener("click", () => {
      if (state.phase !== "open" || !state.bets.size) return;
      state.undo.push(snapshot());
      state.bets.clear();
      renderStakes();
      blip(340, 0.08);
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
  function setStatus(phase, html) {
    const el = $("#status");
    el.dataset.phase = phase;
    $("#statusLabel").innerHTML = html;
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
  }

  function closeBetting() {
    state.phase = "closed";
    state.phaseEnds = performance.now() + CLOSED_MS;
    setStatus("closed", "NO MORE BETS");
    lock(true);
    renderStakes();
    blip(440, 0.18, "sine", 0.06);
  }

  function settle() {
    const n = randInt(37);
    const color = colorOf(n);
    const staked = totalBet();
    let won = 0;
    for (const [key, amt] of state.bets) {
      if (covered(key).includes(n)) won += amt * (payoutOf(key) + 1);
    }
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
    $$("[data-bet]").forEach((el) => el.classList.toggle("is-win", covered(el.dataset.bet).includes(n)));
    $$(".race-hit").forEach((el) => el.classList.toggle("is-win", +el.dataset.race === n));

    renderStakes();
    if (won > 0) {
      winPop(`+${fmt(won)}`);
      blip(660, 0.12, "sine", 0.07);
      setTimeout(() => blip(990, 0.2, "sine", 0.07), 120);
    }
    hostLine(n, color, won);
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
      if ($("#statusLabel").textContent !== label) $("#statusLabel").textContent = label;
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
    let x = opts.x ?? 1010 + Math.random() * 90;
    let y = opts.y ?? 560;
    if (isMobile()) {
      x = fx.clientWidth - 76 - Math.random() * 40;
      y = fx.clientHeight - 64;
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
    // older bubbles slide off the top under a fade (desktop) or scroll (mobile sheet)
    while (box.children.length > 40) box.firstElementChild.remove();
    box.classList.toggle("is-overflow", box.scrollHeight > box.clientHeight + 1);
    box.scrollTop = box.scrollHeight;
    if (kind !== "me" && isMobile() && !chatOpen()) {
      toast(el);
      unread += 1;
      const badge = $("#chatBadge");
      badge.textContent = unread > 9 ? "9+" : unread;
      badge.hidden = false;
    }
  }

  /* mobile: chat lives in a bottom sheet; new messages pop over the video */
  let unread = 0;
  const chatOpen = () => $("#app").classList.contains("is-chat");

  function toast(msgEl) {
    const t = msgEl.cloneNode(true);
    t.classList.add("toast");
    const box = $("#toasts");
    box.appendChild(t);
    while (box.children.length > 2) box.firstElementChild.remove();
    t.addEventListener("animationend", (e) => { if (e.animationName === "toast") t.remove(); });
  }

  function setChat(open) {
    $("#app").classList.toggle("is-chat", open);
    $("#sheetBackdrop").hidden = !open;
    $("#chatFab").setAttribute("aria-expanded", open);
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
          <tr><td>Straight up (single number)</td><td>35 : 1</td></tr>
          <tr><td>Column (2:1) · Dozen (1st/2nd/3rd)</td><td>2 : 1</td></tr>
          <tr><td>Red / Black · Even / Odd · 1–18 / 19–36</td><td>1 : 1</td></tr>
          <tr><td>Racetrack section</td><td>1 chip per number</td></tr>
        </table>`,
    }),
    settings: () => ({
      title: "Settings",
      body: `<label>Sound effects <input type="checkbox" data-setting="sound" ${state.sound ? "checked" : ""}></label>
        <label>Show racetrack <input type="checkbox" data-setting="racetrack" ${$("#racetrack").classList.contains("is-hidden") ? "" : "checked"}></label>`,
    }),
  };

  function wireTopbar() {
    const pop = $("#popover");
    let openKey = null;
    const close = () => { pop.hidden = true; openKey = null; };

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
      })
    );
    $("#popoverClose").addEventListener("click", close);
    document.addEventListener("click", (e) => { if (!pop.hidden && !pop.contains(e.target)) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    pop.addEventListener("change", (e) => {
      const s = e.target.dataset.setting;
      if (s === "sound") setSound(e.target.checked);
      if (s === "racetrack") toggleRacetrack(e.target.checked);
    });

    $("#btnSound").addEventListener("click", () => setSound(!state.sound));
    $("#btnFullscreen").addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => {});
    });
    $("#btnRacetrack").addEventListener("click", () => (isMobile() ? toggleRaceView() : toggleRacetrack()));
  }

  function setSound(on) {
    state.sound = on;
    $("#btnSound").setAttribute("aria-pressed", on);
  }

  function toggleRaceView(force) {
    const app = $("#app");
    const show = force ?? !app.classList.contains("is-race");
    app.classList.toggle("is-race", show);
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
    track.classList.toggle("is-hidden", !show);
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
      setChat(false);
      toggleRacetrack(!$("#racetrack").classList.contains("is-hidden"));
    }
    fit();
  }

  // the party card introduces itself, then tucks away to its avatars (tap to reopen)
  function wireParty() {
    const card = $(".party");
    const collapse = () => card.classList.add("is-collapsed");
    // on short screens the card would hide the dealer, so it starts tucked away
    const roomy = !isMobile() || $(".body__bg").clientHeight >= 170;
    if (!roomy) collapse();
    let timer = roomy ? setTimeout(collapse, 6000) : 0;
    card.addEventListener("click", () => {
      if (!isMobile()) return;
      clearTimeout(timer);
      card.classList.toggle("is-collapsed");
      if (!card.classList.contains("is-collapsed")) timer = setTimeout(collapse, 6000);
    });
  }

  /* -------------------------------------------- ambient table reactions */
  function ambient() {
    const pool = ["🥲", "👎", "🔥", "🤡", "🎉"];
    setTimeout(() => {
      if (!document.hidden) floatEmoji(pool[randInt(pool.length)]);
      ambient();
    }, 5000 + Math.random() * 6000);
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
  openBetting();
  requestAnimationFrame(tick);
  ambient();
})();
