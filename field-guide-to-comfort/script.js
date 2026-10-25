/* A Field Guide to Comfort — interactions
   Views: home → lighting (lights switch on) → furniture
   ---------------------------------------------------- */
(() => {
  const stage = document.getElementById("stage");
  const room = document.getElementById("room");
  const toast = document.getElementById("toast");

  /* ---------- Fit the 1440×900 artboard to the window ---------- */
  let scale = 1;
  function fit() {
    scale = Math.min(window.innerWidth / 1440, window.innerHeight / 900);
    stage.style.transform = `scale(${scale})`;
  }
  window.addEventListener("resize", fit);
  fit();

  /* ---------- Views & routing (#home, #lighting, #furniture) ---------- */
  const VIEWS = ["home", "lighting", "furniture"];
  const SOON = { texture: "III Texture", ornament: "IV Ornament" };

  function setView(view, { push = true } = {}) {
    if (!VIEWS.includes(view)) view = "home";
    const prev = stage.dataset.view;
    if (prev === view) return;
    stage.dataset.view = view;

    // Figma note: going from 1 → 2 (opening Lighting), the lights switch on.
    if (view === "lighting") {
      snapTo(1);                        // start on warm lamp light
      room.classList.remove("is-powering");
      void room.offsetWidth;            // restart the animation
      room.classList.add("is-powering");
      setTimeout(() => room.classList.remove("is-powering"), 2400);
      revealLabels();
    }
    if (push) history.pushState({ view }, "", view === "home" ? "#" : `#${view}`);
  }

  window.addEventListener("popstate", () => setView(location.hash.slice(1), { push: false }));

  let toastTimer;
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-on"), 1800);
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-go]");
    if (!el) return;
    e.preventDefault();
    const go = el.dataset.go;
    if (el.hasAttribute("data-soon")) {
      el.classList.remove("is-nudged");
      void el.offsetWidth;
      el.classList.add("is-nudged");
      showToast(`${SOON[go]} — coming soon`);
      return;
    }
    setView(go);
  });

  /* ---------- Lighting: drag the dot along the strip ---------- */
  // Light gradient from Figma, top (0) → bottom (1) of the strip.
  // Names and place counts are placeholders except "Warm lamp light" (8 places).
  // lamp: true → the lamp-lit part of the strip, where the places get labelled on the room.
  const STOPS = [
    { t: 0.00, name: "Morning mist",    hex: "#E6EDE9", places: 2 },
    { t: 0.17, name: "Sage skylight",   hex: "#B2CDBF", places: 3 },
    { t: 0.31, name: "Overcast stone",  hex: "#A1A691", places: 4 },
    { t: 0.46, name: "Linen daylight",  hex: "#F3D5BA", places: 5 },
    { t: 0.63, name: "Late sun",        hex: "#FBD096", places: 6 },
    { t: 0.80, name: "Brass lamp",      hex: "#DEAC5E", places: 7, lamp: true },
    { t: 1.00, name: "Warm lamp light", hex: "#F1B962", places: 8, lamp: true },
  ];
  const STRIP_TOP = 210, STRIP_H = 564, PICK_MIN = 24, PICK_RANGE = 504; // px in artboard units
  // where the dot sits on the gradient (0–1), so the colour matches what is under it
  const stripPos = (t) => (PICK_MIN + t * PICK_RANGE) / STRIP_H;
  const isLamp = () => stripPos(lightT) >= 0.8;

  const strip = document.getElementById("lightStrip");
  const picker = document.getElementById("picker");
  const nameEl = document.getElementById("lightName");
  const metaEl = document.getElementById("lightMeta");
  const labels = [...document.querySelectorAll("#lightLabels .anno")];
  const thumbs = [...document.querySelectorAll(".thumb")];
  let lightT = 1, lastLamp = true;

  const hexToRgb = (h) => h.match(/\w\w/g).map((x) => parseInt(x, 16));
  const rgbToHex = (rgb) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

  function colorAt(t) {
    for (let i = 0; i < STOPS.length - 1; i++) {
      const a = STOPS[i], b = STOPS[i + 1];
      if (t <= b.t) {
        const k = (t - a.t) / (b.t - a.t);
        const ca = hexToRgb(a.hex), cb = hexToRgb(b.hex);
        return rgbToHex(ca.map((v, j) => v + (cb[j] - v) * k));
      }
    }
    return STOPS[STOPS.length - 1].hex;
  }
  const nearestStop = (t) => STOPS.reduce((best, s) => (Math.abs(s.t - t) < Math.abs(best.t - t) ? s : best));

  function setLight(t, { instant = false } = {}) {
    lightT = Math.min(1, Math.max(0, t));
    const pos = stripPos(lightT);
    const hex = colorAt(pos);
    const stop = nearestStop(pos);

    picker.style.transform = `translateY(${(lightT * PICK_RANGE).toFixed(2)}px)`;
    stage.style.setProperty("--lit", (0.25 + 0.75 * lightT).toFixed(3));
    stage.style.setProperty("--cool", (1 - lightT).toFixed(3));
    document.documentElement.style.setProperty("--light", hex); // on <html> so the page background can use it too

    nameEl.textContent = stop.name;
    metaEl.textContent = `Found in ${stop.places} places  ·  ${hex}`;
    strip.setAttribute("aria-valuenow", Math.round(lightT * 100));
    strip.setAttribute("aria-valuetext", `${stop.name}, ${hex}`);

    // Places are labelled on the room only while the warm lamp light is picked.
    const lamp = isLamp();
    if (!instant && lamp !== lastLamp) labels.forEach((l) => l.classList.toggle("is-on", lamp));
    lastLamp = lamp;
  }

  function revealLabels() {
    labels.forEach((l) => l.classList.remove("is-on", "is-dim", "is-focus"));
    thumbs.forEach((b) => b.classList.remove("is-active"));
    labels.forEach((l, i) => setTimeout(() => {
      if (stage.dataset.view === "lighting" && isLamp()) l.classList.add("is-on");
    }, 1900 + i * 140));
  }

  /* Smooth slider: the dot eases toward where you point (rAF), so it glides
     instead of jumping, and grabbing the dot itself never makes it snap. */
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let target = 1, raf = null, grabOffset = 0;

  function tick() {
    const d = target - lightT;
    if (Math.abs(d) < 0.0006 || reduceMotion) { setLight(target); raf = null; return; }
    setLight(lightT + d * 0.3);
    raf = requestAnimationFrame(tick);
  }
  function slideTo(t) {
    target = clamp01(t);
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function snapTo(t) {                       // used when entering the view
    cancelAnimationFrame(raf); raf = null;
    target = clamp01(t);
    setLight(target, { instant: true });
  }

  function tFromPointer(e) {
    const r = strip.getBoundingClientRect();
    return ((e.clientY - r.top) / scale - PICK_MIN) / PICK_RANGE;
  }
  strip.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    strip.setPointerCapture(e.pointerId);
    stage.classList.add("is-dragging");
    const t = tFromPointer(e);
    // pressed on the dot → keep the grab point; pressed elsewhere → glide there
    grabOffset = Math.abs(t - lightT) * PICK_RANGE < 18 ? lightT - t : 0;
    slideTo(t + grabOffset);
  });
  strip.addEventListener("pointermove", (e) => {
    if (strip.hasPointerCapture(e.pointerId)) slideTo(tFromPointer(e) + grabOffset);
  });
  const endDrag = () => stage.classList.remove("is-dragging");
  strip.addEventListener("pointerup", endDrag);
  strip.addEventListener("pointercancel", endDrag);
  strip.addEventListener("lostpointercapture", endDrag);
  // mouse wheel / trackpad over the strip
  strip.addEventListener("wheel", (e) => {
    e.preventDefault();
    slideTo(target + e.deltaY * 0.0012);
  }, { passive: false });
  strip.addEventListener("keydown", (e) => {
    const step = { ArrowUp: -0.04, ArrowDown: 0.04, PageUp: -0.2, PageDown: 0.2 }[e.key];
    if (step) { e.preventDefault(); slideTo(target + step); }
    if (e.key === "Home") { e.preventDefault(); slideTo(0); }
    if (e.key === "End") { e.preventDefault(); slideTo(1); }
  });

  /* Hover / pick a place → focus its label on the room */
  function focusPlace(n) {
    if (!isLamp()) return;
    labels.forEach((l) => {
      const hit = l.dataset.place === String(n);
      l.classList.toggle("is-focus", hit);
      l.classList.toggle("is-dim", n != null && !hit);
    });
  }
  let pinned = null;
  thumbs.forEach((b) => {
    b.addEventListener("mouseenter", () => focusPlace(b.dataset.place));
    b.addEventListener("mouseleave", () => focusPlace(pinned));
    b.addEventListener("click", () => {
      pinned = pinned === b.dataset.place ? null : b.dataset.place;
      thumbs.forEach((x) => x.classList.toggle("is-active", x.dataset.place === pinned));
      if (!isLamp()) slideTo(1); // jump back to the light these places share
      focusPlace(pinned);
    });
  });

  /* ---------- Furniture: link list rows ↔ photo markers ---------- */
  document.querySelectorAll(".traits li").forEach((row) => {
    const mark = document.querySelector(`.marker[data-mark="${row.dataset.mark}"]`);
    row.addEventListener("mouseenter", () => mark.classList.add("is-hot"));
    row.addEventListener("mouseleave", () => mark.classList.remove("is-hot"));
  });
  document.querySelectorAll(".marker").forEach((mark) => {
    const row = document.querySelector(`.traits li[data-mark="${mark.dataset.mark}"]`);
    mark.addEventListener("mouseenter", () => row.classList.add("is-hot"));
    mark.addEventListener("mouseleave", () => row.classList.remove("is-hot"));
  });
  document.querySelectorAll(".pager-btn").forEach((b) =>
    b.addEventListener("click", () => showToast("Only No. 014 is designed so far")));

  /* ---------- Start on the view in the URL ---------- */
  setLight(1, { instant: true });
  const start = location.hash.slice(1);
  if (VIEWS.includes(start) && start !== "home") setView(start, { push: false });
})();