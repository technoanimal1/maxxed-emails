/* ==========================================================================
   Social Roulette — motion layer (GSAP 3 + Flip + MotionPath)
   Every function is a no-op when GSAP is unavailable or the user prefers
   reduced motion, so the game always works without it.
   ========================================================================== */
(() => {
  "use strict";

  const g = window.gsap;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const portrait = window.matchMedia("(max-aspect-ratio: 1/1)");
  const on = () => !!g && !reduced.matches;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  if (g) {
    g.registerPlugin(...[window.Flip, window.MotionPathPlugin].filter(Boolean));
    g.defaults({ overwrite: "auto" });
    document.documentElement.classList.add("has-motion");
  }

  /* ---------------------------------------------------------------- utils */
  // the desktop stage is CSS-scaled, so convert screen rects into stage pixels
  const stageScale = () => (portrait.matches ? 1 : parseFloat(getComputedStyle($("#app")).getPropertyValue("--s")) || 1);
  function local(el) {
    const r = el.getBoundingClientRect();
    const s = $(".screen").getBoundingClientRect();
    const k = stageScale();
    return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k, cx: (r.left - s.left + r.width / 2) / k, cy: (r.top - s.top + r.height / 2) / k };
  }

  let layer;
  function flyLayer() {
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "fly-layer";
      $(".screen").appendChild(layer);
    }
    return layer;
  }

  const boardRoot = () => (portrait.matches ? $("#mboard") : $("#board"));
  const boardSurface = () => (portrait.matches ? $("#mboard .mb-grid") : $("#board"));

  // a free-floating copy of a chip, centred on (cx, cy) at a given visual size
  function chipClone(chip, cx, cy, size) {
    const c = chip.cloneNode(true);
    c.classList.add("fly-chip");
    c.removeAttribute("aria-hidden");
    flyLayer().appendChild(c);
    g.set(c, { x: cx - 20, y: cy - 20, scale: size / 40, transformOrigin: "50% 50%" });
    return c;
  }

  /* ================================================================ INTRO
     Video eases out of a soft zoom, chrome slides in, the table rises out of
     the felt with a perspective tilt, numbers ripple in from the zero,
     chips deal in one by one. ~1.8s total. */
  function intro() {
    if (!on()) return null;
    const mobile = portrait.matches;
    const tl = g.timeline({ defaults: { ease: "power3.out" } });
    const ripple = mobile
      ? { cells: "#mboard .mb-num", grid: [12, 3], from: [0, 1] }
      : { cells: "#board .numbers .cell", grid: [3, 12], from: [1, 0] };

    tl.fromTo(".body__media", { scale: 1.14, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.6, ease: "power2.out" }, 0)
      .from(".topbar", { yPercent: -100, opacity: 0, duration: 0.6 }, 0.1)
      .from([".pill--round", ".history", ".party"], { x: -28, opacity: 0, stagger: 0.08, duration: 0.6 }, 0.35)
      .from(boardSurface(), { y: 70, rotationX: 38, opacity: 0, transformPerspective: 1100, transformOrigin: "50% 100%", duration: 1 }, 0.45)
      .from(ripple.cells, { opacity: 0, scale: 0.6, duration: 0.4, ease: "back.out(2)", stagger: { grid: ripple.grid, from: ripple.from, amount: 0.55 } }, 0.7)
      .from(".status", { y: 18, opacity: 0, duration: 0.5 }, 0.95)
      .from(".chip-slot", { y: 36, opacity: 0, rotation: -120, duration: 0.6, ease: "back.out(1.8)", stagger: 0.07 }, 0.9)
      .from(".round-btn", { scale: 0.5, opacity: 0, duration: 0.4, ease: "back.out(2)", stagger: 0.05 }, 1.0)
      .from([".balance", ".autoplay", ".switch", ".racetrack"], { y: 16, opacity: 0, duration: 0.5, stagger: 0.06 }, 1.05)
      .from(mobile ? ".chat-fab" : ".chat", mobile ? { scale: 0, duration: 0.5, ease: "back.out(2)" } : { x: 60, opacity: 0, duration: 0.7 }, 1.0)
      ;

    tl.eventCallback("onComplete", () =>
      g.set([".body__media", ".topbar", ".pill--round", ".history", ".party", boardSurface(), ripple.cells, ".status", ".chip-slot", ".round-btn", ".balance", ".autoplay", ".switch", ".racetrack", ".chat", ".chat-fab"], { clearProps: "transform,opacity" })
    );
    return tl;
  }

  /* ========================================================= CHIP SELECT
     The chosen chip flips on its edge and settles bigger (the size change
     itself is the CSS 40 → 56px from the design). */
  function chipSelect(slot) {
    if (!on() || !slot) return;
    g.timeline()
      .fromTo(slot, { rotationY: 0 }, { rotationY: 360, duration: 0.6, ease: "power2.out", transformPerspective: 400 }, 0)
      .fromTo(slot, { y: 0 }, { y: -7, duration: 0.15, ease: "power1.out", yoyo: true, repeat: 1 }, 0)
      .set(slot, { clearProps: "transform" });
  }

  /* ============================================================ CHIP FLY
     Placing a bet: a chip lifts off the rack and arcs onto the cell, shrinking
     to table size, then lands with a small bounce. Section bets (racetrack)
     deal a quick cascade. */
  // onLand(key) fires the moment each chip touches the table (used for the chip sound)
  function chipFly(keys, onLand) {
    const land = (key) => onLand && onLand(key);
    if (!on()) return keys.slice(0, 6).forEach(land);
    const src = $(".chip-slot.is-active .chip");
    if (!src) return keys.slice(0, 6).forEach(land);
    const from = local(src);
    const root = boardRoot();
    const list = keys.slice(0, 17);
    list.forEach((key, i) => {
      const chip = root.querySelector(`[data-bet="${key}"] .stake .chip`);
      if (!chip) return i < 6 && land(key);
      const to = local(chip);
      const clone = chipClone(src, from.cx, from.cy, from.w);
      const lift = Math.min(from.cy, to.cy) - (portrait.matches ? 60 : 110);
      g.set(chip, { opacity: 0 });
      g.timeline({ delay: i * 0.035, onComplete: () => clone.remove() })
        .to(clone, {
          duration: 0.5,
          ease: "power2.inOut",
          motionPath: { path: [{ x: (from.cx + to.cx) / 2 - 20, y: lift - 20 }, { x: to.cx - 20, y: to.cy - 20 }], curviness: 1.25 },
          scale: to.w / 40,
          rotation: g.utils.random(-140, 140),
        }, 0)
        .to(clone, { boxShadow: "0 18px 24px rgba(0,0,0,.45)", duration: 0.25, yoyo: true, repeat: 1 }, 0)
        .call(() => i < 8 && land(key))
        .set(chip, { opacity: 1 })
        .fromTo(chip, { y: -5 }, { y: 0, duration: 0.35, ease: "bounce.out", clearProps: "transform" });
    });
  }

  /* ========================================================= CLEAR / UNDO
     Removed chips slide off the felt and fade. Pass clones made *before* the
     state change (see collect()). */
  function sweep(clones, dir = 1) {
    if (!on() || !clones.length) return;
    g.to(clones, {
      y: `+=${26 * dir}`,
      x: () => `+=${g.utils.random(-14, 14)}`,
      opacity: 0,
      scale: (i, el) => g.getProperty(el, "scale") * 0.6,
      rotation: () => g.utils.random(-90, 90),
      duration: 0.4,
      ease: "power2.in",
      stagger: 0.025,
      onComplete: () => clones.forEach((c) => c.remove()),
    });
  }

  // copy the chips currently on the given bet keys into the fly layer
  function collect(keys) {
    if (!on()) return [];
    const root = boardRoot();
    return keys
      .map((key) => {
        const chip = root.querySelector(`[data-bet="${key}"] .stake .chip`);
        if (!chip) return null;
        const r = local(chip);
        const c = chipClone(chip, r.cx, r.cy, r.w);
        c.dataset.key = key;
        return c;
      })
      .filter(Boolean);
  }

  /* ===================================================== BETS CLOSE / OPEN
     No more bets: the table tilts back and dims like it's being pushed away,
     the camera creeps in on the wheel. Bets open: the table springs back. */
  // portrait: the table shrinks to a mini table while the video grows and zooms in on
  // the wheel, then expands back for the next round. --board-k drives the real layout
  // (rows, columns, type), so the video area genuinely gets taller as the table shrinks.
  const root = document.documentElement;
  function boardSize(from, to, ease) {
    g.fromTo(root, { "--board-k": from }, { "--board-k": to, duration: 0.85, ease, onComplete: () => root.style.removeProperty("--board-k") });
  }

  function betsClosed() {
    if (!on()) return;
    const mobile = portrait.matches;
    if (mobile) {
      boardSize(1, 0.58, "power3.inOut");
      // the table shrinks away from the wheel and the camera pushes in
      g.to(".body__media", { scale: 1.16, transformOrigin: "51% 40%", duration: 1.4, ease: "power2.inOut" });
      g.to([".controls", ".racetrack"], { opacity: 0.45, duration: 0.4 });
      return;
    }
    g.to(boardSurface(), { rotationX: mobile ? 12 : 18, y: mobile ? 10 : 16, scale: 0.965, filter: "brightness(0.55) saturate(0.7)", transformPerspective: 1000, transformOrigin: "50% 100%", duration: 0.75, ease: "power2.inOut" });
    g.to(".body__media", { scale: 1.08, transformOrigin: mobile ? "58% 55%" : "50% 62%", duration: 3, ease: "sine.inOut" });
    g.to([".controls", ".racetrack"], { opacity: 0.45, duration: 0.4 });
  }

  // result: lift the table halfway back so the winning highlights read clearly
  function resultFocus() {
    if (!on() || portrait.matches) return;
    g.to(boardSurface(), { rotationX: 6, y: 6, scale: 0.985, filter: "brightness(1) saturate(1)", duration: 0.5, ease: "power2.out" });
  }

  function betsOpen() {
    if (!on()) return;
    if (portrait.matches && root.classList.contains("was-spin")) {
      root.classList.remove("was-spin");
      boardSize(0.58, 1, "back.out(1.2)");
    }
    g.to(boardSurface(), { rotationX: 0, y: 0, scale: 1, filter: "brightness(1) saturate(1)", duration: 0.9, ease: "back.out(1.5)", clearProps: "transform,filter" });
    g.to(".body__media", { scale: 1, duration: 1.4, ease: "power2.inOut", clearProps: "transform" });
    g.to([".controls", ".racetrack"], { opacity: 1, duration: 0.4, clearProps: "opacity" });
  }

  /* ========================================================= STATUS TAB
     Label rolls like a slot reel; the last five seconds pulse. */
  function statusSwap(apply) {
    const label = $("#statusLabel");
    if (!on()) return apply();
    g.timeline()
      .to(label, { yPercent: -110, opacity: 0, duration: 0.16, ease: "power2.in" })
      .add(apply)
      .fromTo(label, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.34, ease: "back.out(2)" })
      .set(label, { clearProps: "transform,opacity" });
  }

  function countdown() {
    if (!on()) return;
    g.fromTo("#statusLabel", { scale: 1.22 }, { scale: 1, duration: 0.45, ease: "back.out(3)", clearProps: "transform" });
    g.fromTo("#statusTimer", { opacity: 0.4 }, { opacity: 1, duration: 0.45 });
  }

  /* ============================================================== RESULT
     Winning cell punches, a gold ring and sparks burst from it. Losing chips
     are swept up toward the wheel; winning chips pulse, multiply into the
     balance, and the balance counts up. */
  function winBurst(n) {
    if (!on()) return;
    const cell = boardRoot().querySelector(`[data-bet="n:${n}"]`);
    if (!cell) return;
    const r = local(cell);
    g.fromTo(cell, { scale: 1 }, { scale: 1.16, duration: 0.18, yoyo: true, repeat: 3, ease: "power1.inOut", clearProps: "transform" });
    const ring = document.createElement("span");
    ring.className = "burst-ring";
    flyLayer().appendChild(ring);
    g.set(ring, { x: r.cx - 30, y: r.cy - 30 });
    g.fromTo(ring, { scale: 0.3, opacity: 1 }, { scale: 3, opacity: 0, duration: 0.9, ease: "power2.out", onComplete: () => ring.remove() });
    for (let i = 0; i < 14; i++) {
      const s = document.createElement("span");
      s.className = "spark";
      flyLayer().appendChild(s);
      const a = (i / 14) * Math.PI * 2 + g.utils.random(-0.2, 0.2);
      const d = g.utils.random(40, 90);
      g.set(s, { x: r.cx - 3, y: r.cy - 3 });
      g.to(s, { x: r.cx - 3 + Math.cos(a) * d, y: r.cy - 3 + Math.sin(a) * d, opacity: 0, scale: g.utils.random(0.4, 1.2), duration: g.utils.random(0.6, 1), ease: "power3.out", onComplete: () => s.remove() });
    }
  }

  function settleChips(winClones, loseClones, balanceEl) {
    if (!on()) {
      [...winClones, ...loseClones].forEach((c) => c.remove());
      return;
    }
    const wheel = portrait.matches ? local($(".body__bg")) : { cx: 712, cy: 420 };
    const tx = portrait.matches ? wheel.cx : wheel.cx;
    const ty = portrait.matches ? wheel.y + wheel.h * 0.72 : wheel.cy;
    g.to(loseClones, {
      x: tx - 20,
      y: ty - 20,
      scale: 0.3,
      opacity: 0,
      rotation: () => g.utils.random(-200, 200),
      duration: 0.8,
      ease: "power2.in",
      delay: 0.5,
      stagger: 0.03,
      onComplete: () => loseClones.forEach((c) => c.remove()),
    });
    if (!winClones.length) return;
    const bal = local(balanceEl);
    const tl = g.timeline({ delay: 0.35, onComplete: () => winClones.forEach((c) => c.remove()) });
    tl.to(winClones, { scale: (i, el) => g.getProperty(el, "scale") * 1.35, duration: 0.2, yoyo: true, repeat: 1, ease: "power1.inOut" });
    winClones.forEach((c, i) => {
      tl.to(c, {
        duration: 0.7,
        ease: "power2.in",
        motionPath: { path: [{ x: (g.getProperty(c, "x") + bal.cx) / 2 - 20, y: Math.min(g.getProperty(c, "y"), bal.cy) - 90 }, { x: bal.cx - 20, y: bal.cy - 20 }], curviness: 1.2 },
        scale: 0.35,
        opacity: 0.2,
      }, 0.45 + i * 0.06);
    });
    tl.fromTo(balanceEl.closest(".glass"), { boxShadow: "0 0 0 0 rgba(224,202,58,0)" }, { boxShadow: "0 0 24px 2px rgba(224,202,58,.55)", duration: 0.3, yoyo: true, repeat: 1 }, 1.0);
  }

  function countUp(el, from, to, format, delay = 1.1) {
    if (!on() || from === to) { el.textContent = format(to); return; }
    const o = { v: from };
    el.textContent = format(from);
    g.to(o, { v: to, duration: 1, delay, ease: "power2.out", onUpdate: () => (el.textContent = format(Math.round(o.v))) });
  }

  /* ======================================================== RESULT CARD
     Portrait: the winning number pops in over the wheel and its two wheel
     neighbours fan out either side. */
  function resultArc(el, show) {
    if (!on()) { el.hidden = !show; return; }
    if (show) {
      el.hidden = false;
      const q = (s) => el.querySelector(s);
      // the slice rises, the neighbours swing out from behind the winner, the ball drops in
      g.timeline()
        .fromTo(el, { opacity: 0, y: 18, scale: 0.82, transformOrigin: "50% 100%" }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "back.out(1.8)" })
        .fromTo(q(".ra-l"), { rotation: 30, opacity: 0, svgOrigin: "150 215" }, { rotation: 0, opacity: 1, svgOrigin: "150 215", duration: 0.55, ease: "back.out(1.6)" }, 0.12)
        .fromTo(q(".ra-r"), { rotation: -30, opacity: 0, svgOrigin: "150 215" }, { rotation: 0, opacity: 1, svgOrigin: "150 215", duration: 0.55, ease: "back.out(1.6)" }, 0.12)
        .fromTo(q(".ra-ball"), { y: -46, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "bounce.out" }, 0.3);
    } else if (!el.hidden) {
      g.to(el, { opacity: 0, scale: 0.85, y: -10, duration: 0.3, ease: "power2.in", onComplete: () => { el.hidden = true; g.set(el, { clearProps: "all" }); } });
    }
  }

  /* ============================================================= HISTORY
     The new result drops into the bar, the rest slide along. */
  function historyIn(track) {
    if (!on() || !track.firstElementChild) return;
    const [first, ...rest] = track.children;
    g.from(first, { y: -18, scale: 0.2, opacity: 0, duration: 0.55, ease: "back.out(2.4)", clearProps: "transform,opacity" });
    g.from(rest, { x: -24, duration: 0.5, ease: "power3.out", stagger: 0.012, clearProps: "transform" });
  }

  /* ========================================================= CHAT DRAWER
     Mobile: the sheet springs up from the bottom over a fading backdrop and
     the latest messages lift in; closing drops it with gravity. The sheet can
     also be dragged down to close. */
  function sheetOpen(sheet, backdrop) {
    if (!on()) return;
    g.fromTo(sheet, { yPercent: 105, y: 0 }, { yPercent: 0, duration: 0.6, ease: "expo.out" });
    g.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    const msgs = [...$("#chatMessages").children].slice(-4);
    g.from(msgs, { y: 16, opacity: 0, duration: 0.4, stagger: 0.05, delay: 0.12, ease: "power2.out", clearProps: "transform,opacity" });
    g.from(".chat__panel > *", { y: 12, opacity: 0, duration: 0.35, stagger: 0.05, delay: 0.18, clearProps: "transform,opacity" });
  }

  function sheetClose(sheet, backdrop, done) {
    if (!on()) return done();
    g.to(sheet, { yPercent: 105, y: 0, duration: 0.34, ease: "power2.in" });
    g.to(backdrop, { opacity: 0, duration: 0.3, onComplete: done });
  }

  function sheetDrag(sheet, handle, close) {
    if (!g) return;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let v = 0;
    let dragging = false;
    handle.addEventListener("pointerdown", (e) => {
      dragging = true;
      startY = lastY = e.clientY;
      lastT = performance.now();
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dy = Math.max(0, e.clientY - startY);
      const now = performance.now();
      v = (e.clientY - lastY) / Math.max(1, now - lastT);
      lastY = e.clientY;
      lastT = now;
      g.set(sheet, { y: dy });
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      const dy = g.getProperty(sheet, "y");
      if (dy > 90 || v > 0.6) close();
      else g.to(sheet, { y: 0, duration: 0.45, ease: "back.out(2)" });
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  /* ============================================================ POPOVER
     Grows out of the icon that opened it; rows cascade in. */
  function popoverOpen(pop, anchor) {
    if (!on()) return;
    const p = pop.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    const k = stageScale();
    const ox = ((a.left + a.width / 2 - p.left) / k).toFixed(0);
    g.fromTo(pop, { opacity: 0, scale: 0.88, y: -8, transformOrigin: `${ox}px 0px` }, { opacity: 1, scale: 1, y: 0, duration: 0.38, ease: "back.out(1.8)", clearProps: "transform,opacity" });
    g.from($$(".popover__body > *, .popover__body tr, .popover__body .num", pop), { y: 8, opacity: 0, duration: 0.3, stagger: 0.025, delay: 0.08, clearProps: "transform,opacity" });
  }

  function popoverClose(pop, done) {
    if (!on()) return done();
    g.to(pop, { opacity: 0, scale: 0.94, y: -6, duration: 0.16, ease: "power2.in", onComplete: () => { done(); g.set(pop, { clearProps: "transform,opacity" }); } });
  }

  /* ========================================================== PARTY CARD
     Morphs between the full card and its avatar cluster (FLIP). */
  function partyMorph(card, change) {
    if (!on() || !window.Flip) return change();
    const parts = [card, $(".party__avatars", card)];
    const state = window.Flip.getState(parts);
    change();
    window.Flip.from(state, { duration: 0.55, ease: "power3.inOut", scale: true, nested: true });
    const copy = $(".party__copy", card);
    if (!card.classList.contains("is-collapsed")) g.fromTo(copy, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.35, delay: 0.25, clearProps: "transform,opacity" });
  }

  /* ========================================================== RACETRACK
     Desktop: fades/slides with a soft blur. Mobile: the table card-flips
     over to reveal the racetrack and back. */
  function racetrackToggle(track, show) {
    if (!on()) return;
    if (show) g.fromTo(track, { opacity: 0, y: 12, filter: "blur(6px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.45, ease: "power3.out", clearProps: "filter,transform" });
    else g.to(track, { opacity: 0, y: 10, filter: "blur(4px)", duration: 0.28, ease: "power2.in", clearProps: "filter,transform" });
  }

  function flipView(fromEl, toEl, change) {
    if (!on()) return change();
    g.timeline()
      .to(fromEl, { rotationY: 90, opacity: 0.2, duration: 0.24, ease: "power2.in", transformPerspective: 900 })
      .add(change)
      .set(fromEl, { clearProps: "transform,opacity" })
      .fromTo(toEl, { rotationY: -90, opacity: 0.2, transformPerspective: 900 }, { rotationY: 0, opacity: 1, duration: 0.45, ease: "back.out(1.6)", clearProps: "transform,opacity" });
  }

  /* ======================================================= SMALL THINGS */
  function toastIn(el) {
    if (!on()) return;
    g.fromTo(el, { x: -24, opacity: 0, filter: "blur(6px)" }, { x: 0, opacity: 1, filter: "blur(0px)", duration: 0.45, ease: "power3.out", clearProps: "filter" });
  }

  function badgePop(el) {
    if (!on()) return;
    g.fromTo(el, { scale: 0.2 }, { scale: 1, duration: 0.5, ease: "elastic.out(1.2, 0.45)", clearProps: "transform" });
  }

  function shake(el) {
    if (!on()) return;
    g.fromTo(el, { x: 0 }, { x: 6, duration: 0.06, repeat: 5, yoyo: true, ease: "sine.inOut", clearProps: "transform" });
  }

  window.Motion = {
    get enabled() { return on(); },
    intro, chipSelect, chipFly, collect, sweep, betsClosed, resultFocus, betsOpen, statusSwap, countdown,
    winBurst, settleChips, countUp, historyIn, resultArc, sheetOpen, sheetClose, sheetDrag, popoverOpen,
    popoverClose, partyMorph, racetrackToggle, flipView, toastIn, badgePop, shake,
  };
})();
