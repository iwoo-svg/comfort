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
      setLight(1, { instant: true });   // start on warm lamp light
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
  // Stops along the strip, top (0) → bottom (1).
  // Only "Warm lamp light" is in the Figma design; the other three are placeholders.
  const STOPS = [
    { t: 0.00, name: "Cool skylight",   hex: "#C9D1D8", places: 3 },
    { t: 0.35, name: "Overcast window", hex: "#CDD3C2", places: 4 },
    { t: 0.70, name: "Late sun",        hex: "#DDC7A2", places: 5 },
    { t: 1.00, name: "Warm lamp light", hex: "#E9C98F", places: 8 },
  ];
  const STRIP_TOP = 210, PICK_MIN = 24, PICK_RANGE = 504; // px in artboard units

  const strip = document.getElementById("lightStrip");
  const picker = document.getElementById("picker");
  const nameEl = document.getElementById("lightName");
  const metaEl = document.getElementById("lightMeta");
  const labels = [...document.querySelectorAll("#lightLabels .anno")];
  const thumbs = [...document.querySelectorAll(".thumb")];
  let lightT = 1;

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
    const hex = colorAt(lightT);
    const stop = nearestStop(lightT);

    picker.style.top = `${STRIP_TOP + PICK_MIN + lightT * PICK_RANGE - 12}px`;
    stage.style.setProperty("--lit", (0.25 + 0.75 * lightT).toFixed(3));
    stage.style.setProperty("--cool", (1 - lightT).toFixed(3));
    stage.style.setProperty("--light", hex);

    nameEl.textContent = stop.name;
    metaEl.textContent = `Found in ${stop.places} places  ·  ${hex}`;
    strip.setAttribute("aria-valuenow", Math.round(lightT * 100));
    strip.setAttribute("aria-valuetext", `${stop.name}, ${hex}`);

    // Places are labelled on the room only while the warm lamp light is picked.
    if (!instant) labels.forEach((l) => l.classList.toggle("is-on", stop === STOPS[3]));
  }

  function revealLabels() {
    labels.forEach((l) => l.classList.remove("is-on", "is-dim", "is-focus"));
    thumbs.forEach((b) => b.classList.remove("is-active"));
    labels.forEach((l, i) => setTimeout(() => {
      if (stage.dataset.view === "lighting" && lightT > 0.85) l.classList.add("is-on");
    }, 1900 + i * 140));
  }

  function tFromPointer(e) {
    const r = strip.getBoundingClientRect();
    return ((e.clientY - r.top) / scale - PICK_MIN) / PICK_RANGE;
  }
  strip.addEventListener("pointerdown", (e) => {
    strip.setPointerCapture(e.pointerId);
    stage.classList.add("is-dragging");
    setLight(tFromPointer(e));
  });
  strip.addEventListener("pointermove", (e) => {
    if (strip.hasPointerCapture(e.pointerId)) setLight(tFromPointer(e));
  });
  const endDrag = () => stage.classList.remove("is-dragging");
  strip.addEventListener("pointerup", endDrag);
  strip.addEventListener("pointercancel", endDrag);
  strip.addEventListener("keydown", (e) => {
    const step = { ArrowUp: -0.05, ArrowDown: 0.05, PageUp: -0.2, PageDown: 0.2 }[e.key];
    if (step) { e.preventDefault(); setLight(lightT + step); }
    if (e.key === "Home") setLight(0);
    if (e.key === "End") setLight(1);
  });

  /* Hover / pick a place → focus its label on the room */
  function focusPlace(n) {
    if (lightT <= 0.85) return;
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
      if (lightT <= 0.85) setLight(1); // jump back to the light these places share
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
