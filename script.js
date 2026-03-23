/* ==========================================================
   Web Revival HQ — Shared JavaScript (preselected assets mode)
   - Updates footer year
   - Global motion toggle (adds/removes body.motion-off)
   - Home "Web Viewer" (index.html):
     * Displays a curated pool of images from assets/ (no uploads)
     * Optional rotation / shuffle
   - GIF Library (gifs.html):
     * Displays curated GIFs from assets/ (no uploads)
     * Filter/sort + modal preview with play/stop
   ========================================================== */

(function () {
  "use strict";

  // ---------- Small utilities ----------
  function $(id) {
    return document.getElementById(id);
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function prefersReducedMotion() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  // Read JSON from:
  // <script type="application/json" id="someId">...</script>
  function readJSONScriptTag(id) {
    const el = $(id);
    if (!el) return null;

    try {
      const text = (el.textContent || "").trim();
      if (!text) return null;
      return JSON.parse(text);
    } catch (_err) {
      return null;
    }
  }

  // Basic basename helper for URLs (e.g. "assets/gifs/foo.gif" -> "foo.gif")
  function basename(url) {
    const s = String(url || "");
    const parts = s.split("/");
    return parts.length ? parts[parts.length - 1] : s;
  }

  // ---------- Footer year ----------
  function initYear() {
    const yearEl = $("year");
    if (!yearEl) return;
    yearEl.textContent = String(new Date().getFullYear());
  }

  // ---------- Motion toggle ----------
  function initMotionToggle() {
    const toggle = $("disableMotionToggle");
    if (!toggle) return;

    toggle.addEventListener("change", () => {
      document.body.classList.toggle("motion-off", toggle.checked);
    });
  }

  // ---------- Home "Web Viewer" (preselected images) ----------
  function initImageWall() {
    const grid = $("imageGrid");
    if (!grid) return; // Only on index.html

    const tiles = Array.from(grid.querySelectorAll(".image-tile"));
    const status = $("wallStatus");

    const intervalInput = $("intervalSeconds");
    const startBtn = $("startWallBtn");
    const stopBtn = $("stopWallBtn");
    const shuffleBtn = $("shuffleWallBtn");

    // Optional: tie rotation to the existing motion toggle
    const motionToggle = $("disableMotionToggle");

    const manifest = readJSONScriptTag("imageWallManifest");
    const pool = Array.isArray(manifest) ? manifest : [];

    let timerId = null;

    function updateButtons() {
      const hasImages = pool.length > 0;
      if (startBtn) startBtn.disabled = !hasImages || timerId !== null;
      if (stopBtn) stopBtn.disabled = timerId === null;
      if (shuffleBtn) shuffleBtn.disabled = !hasImages;
    }

    function randomItem() {
      if (!pool.length) return null;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    function setTile(tile, item) {
      const img = tile.querySelector("img");
      const cap = tile.querySelector("figcaption");
      if (!img) return;

      if (!item || !item.src) {
        img.removeAttribute("src");
        img.alt = "";
        setText(cap, "—");
        return;
      }

      // Prefer a still thumbnail if supplied, but fall back to src.
      img.src = item.thumb || item.src;

      // Accessibility:
      // - If meaningful, provide alt in the manifest.
      // - If decorative, set alt="" in the manifest.
      img.alt = typeof item.alt === "string" ? item.alt : "";

      // Caption: allow explicit caption, else use filename.
      const caption =
        typeof item.caption === "string" && item.caption.trim()
          ? item.caption
          : basename(item.src);
      setText(cap, caption);
    }

    function fillAllTilesOnce() {
      for (const tile of tiles) setTile(tile, randomItem());
    }

    function stopRotation(message) {
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
      updateButtons();
      if (status) {
        const base = pool.length
          ? `Gallery loaded (${pool.length} image(s)).`
          : "No gallery images configured.";
        setText(status, message ? `${base} ${message}` : base);
      }
    }

    function startRotation() {
      if (!pool.length) {
        stopRotation("Add image entries to #imageWallManifest.");
        return;
      }

      const seconds = clamp(
        Number(intervalInput && intervalInput.value) || 8,
        2,
        60
      );

      fillAllTilesOnce();

      timerId = setInterval(() => {
        const which = Math.floor(Math.random() * tiles.length);
        setTile(tiles[which], randomItem());
      }, seconds * 1000);

      updateButtons();
      setText(
        status,
        `Gallery loaded (${pool.length} image(s)). Rotating every ${seconds}s.`
      );
    }

    // Wire up UI
    if (shuffleBtn) {
      shuffleBtn.addEventListener("click", () => {
        fillAllTilesOnce();
        stopRotation("Shuffled.");
      });
    }

    if (startBtn) startBtn.addEventListener("click", startRotation);
    if (stopBtn) stopBtn.addEventListener("click", () => stopRotation("Stopped."));

    if (intervalInput) {
      intervalInput.addEventListener("change", () => {
        // Restart rotation if already running
        if (timerId !== null) {
          stopRotation();
          startRotation();
        }
      });
    }

    if (motionToggle) {
      motionToggle.addEventListener("change", () => {
        // If the user disables animations, stop the rotating viewer too.
        if (motionToggle.checked) stopRotation("Animations disabled.");
      });
    }

    // Initial render
    if (!pool.length) {
      stopRotation("No images configured yet.");
      return;
    }

    fillAllTilesOnce();
    updateButtons();

    // Default: do not auto-start rotation (avoid surprise motion).
    if (prefersReducedMotion()) {
      stopRotation("Autoplay off (prefers reduced motion).");
    } else {
      stopRotation("Ready. Click Start to rotate, or Shuffle.");
    }
  }

  // ---------- GIF library (preselected GIFs) ----------
  function initGifLibrary() {
    const tbody = $("gifTbody");
    if (!tbody) return; // Only on gifs.html

    const status = $("gifStatus");

    const filterInput = $("gifFilter");
    const sortSelect = $("gifSort");
    const sortDirBtn = $("gifSortDirBtn");
    const autoplayToggle = $("gifAutoplayToggle");

    // Preview (modal preferred)
    const dialog = $("gifModal");
    const modalTitle = $("gifModalTitle");
    const modalMeta = $("gifModalMeta");
    const modalStill = $("gifModalStill"); // <img>
    const modalAnim = $("gifModalAnim");   // <img>
    const playBtn = $("gifPlayBtn");
    const stopBtn = $("gifStopBtn");

    // Inline fallback
    const inlinePanel = $("gifInlinePreview");
    const inlineStill = $("gifPreviewStill"); // <img>
    const inlineAnim = $("gifPreviewAnim");   // <img>
    const inlineMeta = $("gifPreviewMetaInline");
    const inlinePlay = $("gifPlayBtnInline");
    const inlineStop = $("gifStopBtnInline");
    const inlineClose = $("gifCloseInline");

    const manifest = readJSONScriptTag("gifManifest");
    const raw = Array.isArray(manifest) ? manifest : [];

    // Expected manifest fields (optional except src):
    // { src, thumb, name, alt, width, height, bytes, licence, attribution, tags }
    const items = raw
      .filter((x) => x && typeof x.src === "string" && x.src.trim())
      .map((x) => ({
        src: x.src,
        thumb: typeof x.thumb === "string" && x.thumb.trim() ? x.thumb : "",
        name: typeof x.name === "string" && x.name.trim() ? x.name : basename(x.src),
        alt: typeof x.alt === "string" ? x.alt : "",
        width: Number.isFinite(x.width) ? x.width : null,
        height: Number.isFinite(x.height) ? x.height : null,
        bytes: Number.isFinite(x.bytes) ? x.bytes : null,
        licence: typeof x.licence === "string" ? x.licence : "",
        attribution: typeof x.attribution === "string" ? x.attribution : "",
        tags: Array.isArray(x.tags) ? x.tags.map(String) : []
      }));

    // Prefer reduced-motion: default autoplay off unless HTML checked=true explicitly.
    if (autoplayToggle && autoplayToggle.checked === false) {
      autoplayToggle.checked = !prefersReducedMotion();
    }

    let current = null;
    let lastFocusEl = null;

    const PLACEHOLDER_THUMB =
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='120'>" +
          "<rect width='100%' height='100%' fill='#081024'/>" +
          "<rect x='6' y='6' width='148' height='108' fill='#0b1a33' stroke='#44ff88' stroke-width='2'/>" +
          "<text x='16' y='36' fill='#e7f2ff' font-family='monospace' font-size='18'>GIF</text>" +
          "<text x='16' y='62' fill='#b9c7dd' font-family='monospace' font-size='12'>no thumb</text>" +
        "</svg>"
      );

    function fmtBytes(bytes) {
      if (!Number.isFinite(bytes)) return "—";
      const units = ["B", "KiB", "MiB", "GiB"];
      let n = bytes;
      let u = 0;
      while (n >= 1024 && u < units.length - 1) {
        n /= 1024;
        u += 1;
      }
      return `${u === 0 ? n.toFixed(0) : n.toFixed(1)} ${units[u]}`;
    }

    function updateStatus(msg) {
      const base = items.length
        ? `Loaded ${items.length} GIF(s).`
        : "No GIFs configured yet.";
      setText(status, msg ? `${base} ${msg}` : base);
    }

    function getFilter() {
      return String(filterInput && filterInput.value ? filterInput.value : "")
        .trim()
        .toLowerCase();
    }

    function isAsc() {
      return !(sortDirBtn && sortDirBtn.getAttribute("aria-pressed") === "true");
    }

    function toggleSortDir() {
      if (!sortDirBtn) return;
      const pressed = sortDirBtn.getAttribute("aria-pressed") === "true";
      sortDirBtn.setAttribute("aria-pressed", String(!pressed));
      sortDirBtn.textContent = !pressed ? "Desc" : "Asc";
      render();
    }

    function compare(a, b) {
      const asc = isAsc() ? 1 : -1;
      const mode = sortSelect ? sortSelect.value : "name";

      if (mode === "dims") {
        const aa = (a.width || 0) * (a.height || 0);
        const bb = (b.width || 0) * (b.height || 0);
        if (aa !== bb) return asc * (aa - bb);
        return asc * a.name.localeCompare(b.name);
      }

      if (mode === "size") {
        return asc * ((a.bytes || 0) - (b.bytes || 0));
      }

      return asc * a.name.localeCompare(b.name);
    }

    function filteredSorted() {
      const f = getFilter();
      const list = items.filter((it) => {
        if (!f) return true;
        const hay = `${it.name} ${it.tags.join(" ")} ${it.licence} ${it.attribution}`.toLowerCase();
        return hay.includes(f);
      });
      list.sort(compare);
      return list;
    }

    function stopAnimating(imgEl) {
      if (!imgEl) return;
      imgEl.removeAttribute("src");
      imgEl.alt = "";
    }

    function closePreview() {
      stopAnimating(modalAnim);
      stopAnimating(inlineAnim);
      current = null;

      if (dialog && dialog.open) dialog.close();
      if (inlinePanel) inlinePanel.hidden = true;

      if (lastFocusEl && typeof lastFocusEl.focus === "function") {
        lastFocusEl.focus();
      }
      lastFocusEl = null;
    }

    function getAutoplay() {
      return Boolean(autoplayToggle && autoplayToggle.checked);
    }

    function setStillPreview(it) {
      const stillSrc = it.thumb || PLACEHOLDER_THUMB;

      if (modalStill) {
        modalStill.src = stillSrc;
        modalStill.alt = it.alt || `Still preview of ${it.name}`;
      }

      if (inlineStill) {
        inlineStill.src = stillSrc;
        inlineStill.alt = it.alt || `Still preview of ${it.name}`;
      }
    }

    function setMeta(it) {
      const dims =
        it.width && it.height ? `${it.width}×${it.height}` : "dims unknown";
      const size = fmtBytes(it.bytes);
      const meta =
        `${it.name} • ${dims} • ${size}` +
        (it.licence ? ` • licence: ${it.licence}` : "") +
        (it.attribution ? ` • credit: ${it.attribution}` : "");

      setText(modalMeta, meta);
      setText(inlineMeta, meta);
      setText(modalTitle, `Preview — ${it.name}`);
    }

    function startAnimating(it, imgEl) {
      if (!it || !imgEl) return;
      imgEl.src = it.src;
      imgEl.alt = it.alt || `Animated preview of ${it.name}`;
    }

    function openPreview(it, openerEl) {
      current = it;
      lastFocusEl = openerEl || document.activeElement;

      setMeta(it);
      setStillPreview(it);

      stopAnimating(modalAnim);
      stopAnimating(inlineAnim);

      const autoplay = getAutoplay();

      if (dialog && typeof dialog.showModal === "function") {
        dialog.showModal();
        if (autoplay) startAnimating(it, modalAnim);
        return;
      }

      if (inlinePanel) inlinePanel.hidden = false;
      if (autoplay) startAnimating(it, inlineAnim);
      if (inlinePlay) inlinePlay.focus();
    }

    async function buildRow(it) {
      const tr = document.createElement("tr");

      const tdThumb = document.createElement("td");
      const thumbImg = document.createElement("img");
      thumbImg.className = "gif-thumb";
      thumbImg.loading = "lazy";
      thumbImg.src = it.thumb || PLACEHOLDER_THUMB;
      thumbImg.alt = it.alt ? `Thumbnail: ${it.alt}` : `Thumbnail: ${it.name}`;
      tdThumb.appendChild(thumbImg);
      tr.appendChild(tdThumb);

      const tdName = document.createElement("td");
      tdName.className = "gif-cell-name";
      const code = document.createElement("code");
      code.textContent = it.name;
      tdName.appendChild(code);
      tr.appendChild(tdName);

      const tdDims = document.createElement("td");
      tdDims.textContent = it.width && it.height ? `${it.width}×${it.height}` : "—";
      tr.appendChild(tdDims);

      const tdSize = document.createElement("td");
      tdSize.textContent = fmtBytes(it.bytes);
      tr.appendChild(tdSize);

      const tdLic = document.createElement("td");
      tdLic.textContent = it.licence || "—";
      tr.appendChild(tdLic);

      const tdAttr = document.createElement("td");
      tdAttr.textContent = it.attribution || "—";
      tr.appendChild(tdAttr);

      const tdAct = document.createElement("td");
      const actions = document.createElement("div");
      actions.className = "gif-actions";

      const previewBtn = document.createElement("button");
      previewBtn.type = "button";
      previewBtn.textContent = "Preview";
      previewBtn.addEventListener("click", () => openPreview(it, previewBtn));
      actions.appendChild(previewBtn);

      tdAct.appendChild(actions);
      tr.appendChild(tdAct);

      return tr;
    }

    async function render() {
      tbody.innerHTML = "";
      for (const it of filteredSorted()) {
        const tr = await buildRow(it);
        tbody.appendChild(tr);
      }
    }

    if (sortDirBtn) sortDirBtn.addEventListener("click", toggleSortDir);
    if (sortSelect) sortSelect.addEventListener("change", render);
    if (filterInput) filterInput.addEventListener("input", render);

    if (playBtn) playBtn.addEventListener("click", () => current && startAnimating(current, modalAnim));
    if (stopBtn) stopBtn.addEventListener("click", () => stopAnimating(modalAnim));

    if (inlinePlay) inlinePlay.addEventListener("click", () => current && startAnimating(current, inlineAnim));
    if (inlineStop) inlineStop.addEventListener("click", () => stopAnimating(inlineAnim));
    if (inlineClose) inlineClose.addEventListener("click", () => closePreview());

    if (dialog) {
      dialog.addEventListener("close", () => closePreview());
    }

    updateStatus(items.length ? "" : "Add entries to #gifManifest.");
    render();
  }

  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", () => {
    initYear();
    initMotionToggle();
    initImageWall();
    initGifLibrary();
  });
})();