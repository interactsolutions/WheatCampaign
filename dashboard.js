(function(){
  if (!Object.getOwnPropertyDescriptors) {
    Object.getOwnPropertyDescriptors = function(obj) {
      var descs = {};
      Object.getOwnPropertyNames(obj).forEach(function(k){ descs[k] = Object.getOwnPropertyDescriptor(obj,k); });
      return descs;
    };
  }
})();

(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  (() => {
    "use strict";
    const WHEATCAMPAIGN_BUILD = "2026-01-06.1";
    console.info("[WheatCampaign] dashboard.js loaded", WHEATCAMPAIGN_BUILD);
    window.addEventListener("error", (e) => {
      try {
        const box = document.getElementById("statusBox");
        if (box) box.textContent = `Runtime error: ${e.message || e.error || "Unknown error"}`;
      } catch (_) {
      }
    });
    window.addEventListener("unhandledrejection", (e) => {
      try {
        const box = document.getElementById("statusBox");
        const reason = e && e.reason ? e.reason.message || String(e.reason) : "Unknown rejection";
        if (box) box.textContent = `Promise rejection: ${reason}`;
      } catch (_) {
      }
    });
    const $$ = (sel, root = document) => root.querySelector(sel);
    const $$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const esc = (s) => {
      const d = document.createElement("div");
      d.textContent = String(s != null ? s : "");
      return d.innerHTML;
    };
    const BASE = new URL(".", window.location.href);
    const url = (p) => new URL(p, BASE).toString();
    function qs() {
      return new URLSearchParams(window.location.search);
    }
    function activeTabFromHash() {
      const h = (window.location.hash || "#summary").replace("#", "").trim();
      if (!h) return "summary";
      if (h.startsWith("session-")) return "sessions";
      if (["summary", "map", "sessions", "media", "feedback"].includes(h)) return h;
      return "summary";
    }
    const state = {
      campaigns: [],
      campaignId: null,
      campaign: null,
      sessions: [],
      sessionsById: /* @__PURE__ */ new Map(),
      sheetsIndex: null,
      filteredSessions: [],
      dateMin: null,
      dateMax: null,
      dateFrom: null,
      dateTo: null,
      map: null,
      markerLayer: null,
      markersBySessionId: /* @__PURE__ */ new Map(),
      // Filters for host (farmer) name and city
      nameFilter: "",
      cityFilter: "",
      // Region filter (REG). This corresponds to the RGN codes (e.g. SKR, RYK)
      // derived from the Initial sheet mapping of territories/districts to regions.
      regionFilter: "",
      // Additional filters for district and score range. These are optional
      // inputs that refine the sessions list based on geography or
      // performance. When null/empty they do not constrain results.
      districtFilter: "",
      scoreMin: null,
      scoreMax: null,
      // Media tab controls
      mediaType: "all",
      mediaSearch: "",
      mediaSort: "newest",
      mediaLimit: 24,
      _mediaBound: false
    };
    function parseDateSafe(v) {
      if (!v) return null;
      if (v instanceof Date) return v;
      const s = String(v).trim();
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      const t = Date.parse(s);
      if (Number.isFinite(t)) return new Date(t);
      return null;
    }
    function formatDateInput(d) {
      const dt = parseDateSafe(d);
      if (!dt || Number.isNaN(dt.getTime())) return "";
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
    function fmtInt(n) {
      const x = Number(n);
      if (!Number.isFinite(x)) return "—";
      return x.toLocaleString();
    }
    function fmt1(n) {
      const x = Number(n);
      if (!Number.isFinite(x)) return "—";
      return x.toFixed(1);
    }
    function num(v) {
      return typeof v === "number" && Number.isFinite(v) ? v : NaN;
    }
    const existsCache = /* @__PURE__ */ new Map();
    function normalizeMediaPath(p) {
      const raw = String(p != null ? p : "").trim();
      if (!raw) return "";
      if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
      let x = raw.replace(/^\.?\//, "").replace(/^\//, "");
      if (x.startsWith("assets/")) return x;
      if (x.startsWith("gallery/")) return "assets/" + x;
      if (!x.includes("/")) return "assets/gallery/" + x;
      return x;
    }
    function candidatePaths(p) {
      const norm = normalizeMediaPath(p);
      if (!norm) return [];
      if (/^(https?:|data:|blob:)/i.test(norm)) return [norm];
      const candidates = [];
      const add = (v) => {
        if (v && !candidates.includes(v)) candidates.push(v);
      };
      add(norm);
      if (!norm.startsWith("assets/gallery/") && !norm.includes("/gallery/")) {
        const fname = norm.split("/").pop();
        add("assets/gallery/" + fname);
      }
      const imgExts = [".jpeg", ".jpg", ".png", ".webp"];
      const isImg = /\.(jpeg|jpg|png|webp)$/i.test(norm);
      const isVid = /\.(mp4|webm)$/i.test(norm);
      function addVariantBases(base) {
        const m1 = base.match(/^(.*?)([a-z])$/i);
        const m2 = base.match(/^(.*?)[_-]([a-z])$/i);
        if (m1) {
          const root = m1[1];
          const suf = m1[2];
          add(base);
          add(root + "_" + suf);
          add(root + "-" + suf);
          add(root);
          return;
        }
        if (m2) {
          const root = m2[1];
          const suf = m2[2];
          add(base);
          add(root + suf);
          add(root);
          return;
        }
        add(base);
        add(base + "a");
        add(base + "_a");
        add(base + "-a");
      }
      if (isImg) {
        const base = norm.replace(/\.(jpeg|jpg|png|webp)$/i, "");
        const bases = [];
        const addBase = (b) => {
          if (b && !bases.includes(b)) bases.push(b);
        };
        const before = candidates.length;
        addVariantBases(base);
        for (let i = before; i < candidates.length; i++) {
          const c = candidates[i];
          if (!/\.(jpeg|jpg|png|webp|mp4|webm)$/i.test(c)) addBase(c);
        }
        addBase(base);
        for (const b of bases) {
          for (const e of imgExts) add(b + e);
        }
      }
      if (isVid) {
        const base = norm.replace(/\.(mp4|webm)$/i, "");
        const bases = [];
        const addBase = (b) => {
          if (b && !bases.includes(b)) bases.push(b);
        };
        const before = candidates.length;
        addVariantBases(base);
        for (let i = before; i < candidates.length; i++) {
          const c = candidates[i];
          if (!/\.(jpeg|jpg|png|webp|mp4|webm)$/i.test(c)) addBase(c);
        }
        addBase(base);
        for (const b of bases) {
          add(b + ".mp4");
          add(b + ".webm");
        }
      }
      return candidates.filter(
        (c) => /^(https?:|data:|blob:)/i.test(c) || /\.(?:jpeg|jpg|png|webp|mp4|webm)$/i.test(c)
      );
    }
    async function assetExists(relOrAbs) {
      const u = /^(https?:|data:|blob:)/i.test(relOrAbs) ? relOrAbs : url(relOrAbs);
      if (existsCache.has(u)) return existsCache.get(u);
      try {
        const r = await fetch(u, { method: "HEAD", cache: "no-store" });
        const ok = r.ok;
        existsCache.set(u, ok);
        return ok;
      } catch (_e) {
        try {
          const r = await fetch(u, {
            method: "GET",
            headers: { Range: "bytes=0-0" },
            cache: "no-store"
          });
          const ok = r.ok;
          existsCache.set(u, ok);
          return ok;
        } catch (_e2) {
          existsCache.set(u, false);
          return false;
        }
      }
    }
    async function resolveFirstExisting(p) {
      const cands = candidatePaths(p);
      for (const c of cands) {
        if (await assetExists(c)) return c;
      }
      return "";
    }
    function attachSmartImage(imgEl, path) {
      let cancelled = false;
      const placeholder = "assets/placeholder.svg";
      (async () => {
        const chosen = await resolveFirstExisting(path);
        if (cancelled) return;
        imgEl.src = chosen ? url(chosen) : url(placeholder);
      })();
      imgEl.onerror = () => {
        imgEl.onerror = null;
        imgEl.src = url(placeholder);
      };
      return () => {
        cancelled = true;
      };
    }
    function attachSmartVideo(videoEl, path) {
      const placeholder = "assets/placeholder-video.mp4";
      let tried = false;
      videoEl.preload = "metadata";
      videoEl.controls = true;
      videoEl.addEventListener("click", async () => {
        if (tried) return;
        tried = true;
        const chosen = await resolveFirstExisting(path);
        videoEl.src = chosen ? url(chosen) : url(placeholder);
        videoEl.play().catch(() => {
        });
      });
      videoEl.onerror = () => {
        videoEl.onerror = null;
        videoEl.src = url(placeholder);
      };
    }
    function setActiveTab(tab) {
      const tabs = $$$(".tabBtn[data-tab]");
      const panels = $$$(".tabPanel[data-tab]");
      tabs.forEach((a) => {
        const is = a.dataset.tab === tab;
        a.classList.toggle("tabBtn--active", is);
        a.setAttribute("aria-selected", is ? "true" : "false");
      });
      panels.forEach((p) => {
        const is = p.getAttribute("data-tab") === tab;
        p.classList.toggle("hidden", !is);
      });
      document.dispatchEvent(new CustomEvent("tabchange", { detail: { tab } }));
    }
    function syncTabFromHash() {
      setActiveTab(activeTabFromHash());
    }
    async function fetchJson(path, why = path, retries = 3, timeout = 8e3) {
      for (let attempt = 1; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
          const u = url(path);
          const r = await fetch(u, { cache: "no-store", signal: controller.signal });
          clearTimeout(timer);
          if (!r.ok) {
            throw new Error(`${why} failed (${r.status})`);
          }
          return await r.json();
        } catch (e) {
          clearTimeout(timer);
          if (attempt === retries) {
            console.error(e);
            setStatus(`Error loading ${why}: ${e.message}`, "bad");
            throw e;
          }
          await new Promise((res) => setTimeout(res, 500 * attempt));
        }
      }
      throw new Error(`Failed to fetch ${why}`);
    }
    async function loadCampaignRegistry() {
      try {
        const reg = await fetchJson("data/campaigns.json", "campaign registry");
        state.campaigns = Array.isArray(reg.campaigns) ? reg.campaigns : [];
        return;
      } catch (e) {
        try {
          const reg = await fetchJson("campaigns.json", "campaign registry (root)");
          state.campaigns = Array.isArray(reg.campaigns) ? reg.campaigns : [];
          return;
        } catch (e2) {
          throw e;
        }
      }
    }
    function setStatus(msg, kind = "") {
      const el = $$("#statusBox");
      if (!el) return;
      el.textContent = msg;
      el.className = "status" + (kind ? " status--" + kind : "");
    }
    function setMapStatus(msg, ok = false) {
      const el = $$("#mapStatus");
      if (!el) return;
      el.textContent = msg;
      el.className = "badge" + (ok ? " badge--ok" : "");
    }
    let leafletPromise = null;
    function ensureLeafletCss() {
      if (document.querySelector('link[data-leaflet-css="1"], link#leafletCss')) return;
      const hrefs = [
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
        "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css",
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css"
      ];
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.dataset.leafletCss = "1";
      link.href = hrefs[0];
      document.head.appendChild(link);
      let i = 0;
      link.onerror = () => {
        i += 1;
        if (i < hrefs.length) link.href = hrefs[i];
      };
    }
    function loadScriptOnce(src) {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-leaflet-src="${src}"]`);
        if (existing) {
          if (existing.dataset.loaded === "1") return resolve(true);
          existing.addEventListener("load", () => resolve(true), { once: true });
          existing.addEventListener("error", () => reject(new Error("Leaflet script failed: " + src)), { once: true });
          return;
        }
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.dataset.leafletSrc = src;
        s.addEventListener("load", () => {
          s.dataset.loaded = "1";
          resolve(true);
        }, { once: true });
        s.addEventListener("error", () => reject(new Error("Leaflet script failed: " + src)), { once: true });
        document.head.appendChild(s);
      });
    }
    async function ensureLeafletReady({ timeoutMs = 8e3 } = {}) {
      if (window.L && window.L.map) return true;
      if (leafletPromise) return leafletPromise;
      leafletPromise = (async () => {
        ensureLeafletCss();
        const srcs = [
          "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
          "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"
        ];
        const start = Date.now();
        for (const src of srcs) {
          try {
            await loadScriptOnce(src);
            await new Promise((r) => setTimeout(r, 0));
            if (window.L && window.L.map) return true;
          } catch (_e) {
          }
          if (Date.now() - start > timeoutMs) break;
        }
        return !!(window.L && window.L.map);
      })();
      return leafletPromise;
    }
    function setRangeHint() {
      const el = $$("#rangeHint");
      if (!el || !state.dateMin || !state.dateMax) return;
      el.textContent = `Campaign duration: ${formatDateInput(state.dateMin)} to ${formatDateInput(state.dateMax)}`;
    }
    function applyDateInputs() {
      const fromEl = $$("#dateFrom");
      const toEl = $$("#dateTo");
      const from = parseDateSafe(fromEl == null ? void 0 : fromEl.value);
      const to = parseDateSafe(toEl == null ? void 0 : toEl.value);
      if (!from || !to) {
        state.dateFrom = state.dateMin;
        state.dateTo = state.dateMax;
      } else {
        state.dateFrom = from;
        state.dateTo = to;
        if (state.dateFrom > state.dateTo) {
          const tmp = state.dateFrom;
          state.dateFrom = state.dateTo;
          state.dateTo = tmp;
        }
      }
      const nameEl = $$("#nameFilter");
      const cityEl = $$("#cityFilter");
      state.nameFilter = nameEl ? String(nameEl.value || "").trim() : "";
      state.cityFilter = cityEl ? String(cityEl.value || "").trim() : "";
      const districtEl = $$("#districtFilter");
      state.districtFilter = districtEl ? String(districtEl.value || "").trim() : "";
      const regionEl = $$("#regionFilter");
      state.regionFilter = regionEl ? String(regionEl.value || "").trim() : "";
      const minEl = $$("#scoreMin");
      const maxEl = $$("#scoreMax");
      const minVal = minEl && minEl.value !== "" ? parseFloat(minEl.value) : null;
      const maxVal = maxEl && maxEl.value !== "" ? parseFloat(maxEl.value) : null;
      state.scoreMin = Number.isFinite(minVal) ? minVal : null;
      state.scoreMax = Number.isFinite(maxVal) ? maxVal : null;
      filterSessions();
      renderAll();
    }
    function resetDateInputs() {
      const fromEl = $$("#dateFrom");
      const toEl = $$("#dateTo");
      if (fromEl && state.dateMin) fromEl.value = formatDateInput(state.dateMin);
      if (toEl && state.dateMax) toEl.value = formatDateInput(state.dateMax);
      const nameEl = $$("#nameFilter");
      const cityEl = $$("#cityFilter");
      if (nameEl) nameEl.value = "";
      if (cityEl) cityEl.value = "";
      state.nameFilter = "";
      state.cityFilter = "";
      const districtEl = $$("#districtFilter");
      const minEl = $$("#scoreMin");
      const maxEl = $$("#scoreMax");
      if (districtEl) districtEl.value = "";
      if (minEl) minEl.value = "";
      if (maxEl) maxEl.value = "";
      state.districtFilter = "";
      state.scoreMin = null;
      state.scoreMax = null;
      const regionEl = $$("#regionFilter");
      if (regionEl) regionEl.value = "";
      state.regionFilter = "";
      applyDateInputs();
    }
    function filterSessions() {
      const a = state.dateFrom;
      const b = state.dateTo;
      state.filteredSessions = state.sessions.filter((s) => {
        var _a;
        const d = parseDateSafe(s.date);
        if (d) {
          if (d < a || d > b) return false;
        }
        if (state.nameFilter) {
          const name = String(((_a = s.host) == null ? void 0 : _a.name) || "").toLowerCase();
          if (!name.includes(state.nameFilter.toLowerCase())) return false;
        }
        if (state.cityFilter) {
          const city = String(s.city || "").toLowerCase();
          if (!city.includes(state.cityFilter.toLowerCase())) return false;
        }
        if (state.regionFilter) {
          const reg = String(s.region || "").toLowerCase();
          if (!reg.includes(state.regionFilter.toLowerCase())) return false;
        }
        if (state.districtFilter) {
          const district = String(s.district || "").toLowerCase();
          if (!district.includes(state.districtFilter.toLowerCase())) return false;
        }
        if (Number.isFinite(state.scoreMin) || Number.isFinite(state.scoreMax)) {
          const sc = Number(s.score);
          if (!Number.isFinite(sc)) return false;
          if (Number.isFinite(state.scoreMin) && sc < state.scoreMin) return false;
          if (Number.isFinite(state.scoreMax) && sc > state.scoreMax) return false;
        }
        return true;
      });
    }
    function renderSummary() {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r;
      const fs = Array.isArray(state.filteredSessions) ? state.filteredSessions : [];
      (function updateLastUpdated() {
        const lastEl = $$("#lastUpdated");
        if (!lastEl) return;
        let latest = null;
        for (const s of fs) {
          const d = parseDateSafe(s.date);
          if (d && (!latest || d > latest)) latest = d;
        }
        if (latest) {
          const iso = formatDateInput(latest);
          lastEl.textContent = `Data as of ${iso}`;
        } else {
          lastEl.textContent = "";
        }
      })();
      const idx = ((_a = state.sheetsIndex) == null ? void 0 : _a.sheets) ? new Map(state.sheetsIndex.sheets.map((x) => [x.sheet, x])) : null;
      let totalFarmers = 0;
      let totalAcres = 0;
      let totalEstAcres = 0;
      let sumAw = 0, denAw = 0;
      let sumUl = 0, denUl = 0;
      let sumDe = 0, denDe = 0;
      let sumMb = 0, denMb = 0;
      let sumNi = 0, denNi = 0;
      let sumUn = 0, denUn = 0;
      let sumScore = 0, denScore = 0;
      const drivers = /* @__PURE__ */ new Map();
      const barriers = /* @__PURE__ */ new Map();
      let imgRefs = 0;
      let vidRefs = 0;
      for (const s of fs) {
        const si = idx == null ? void 0 : idx.get(s.sheetRef);
        const farmers = Number((_d = (_c = si == null ? void 0 : si.farmers_present) != null ? _c : (_b = s == null ? void 0 : s.metrics) == null ? void 0 : _b.farmers) != null ? _d : 0);
        const acres = Number((_g = (_f = si == null ? void 0 : si.acres) != null ? _f : (_e = s == null ? void 0 : s.metrics) == null ? void 0 : _e.wheatAcres) != null ? _g : 0);
        if (Number.isFinite(farmers) && farmers > 0) totalFarmers += farmers;
        if (Number.isFinite(acres) && acres > 0) totalAcres += acres;
        const wt = Number.isFinite(farmers) && farmers > 0 ? farmers : 1;
        const m = s.metrics || {};
        const aw = num(m.awarenessPct);
        const ul = num(m.usedLastYearPct);
        const de = num(m.definitePct);
        const mb = num(m.maybePct);
        const ni = num(m.notInterestedPct);
        const un = num(m.avgUnderstanding);
        if (Number.isFinite(aw)) {
          sumAw += aw * wt;
          denAw += wt;
        }
        if (Number.isFinite(ul)) {
          sumUl += ul * wt;
          denUl += wt;
        }
        if (Number.isFinite(de)) {
          sumDe += de * wt;
          denDe += wt;
        }
        if (Number.isFinite(mb)) {
          sumMb += mb * wt;
          denMb += wt;
        }
        if (Number.isFinite(ni)) {
          sumNi += ni * wt;
          denNi += wt;
        }
        if (Number.isFinite(un)) {
          sumUn += un * wt;
          denUn += wt;
        }
        const sc = num(s.score);
        if (Number.isFinite(sc)) {
          sumScore += sc * wt;
          denScore += wt;
        }
        const est = num(m.estimatedBuctrilAcres);
        if (Number.isFinite(est) && est > 0) totalEstAcres += est;
        const ru = s.reasonsUse && typeof s.reasonsUse === "object" ? s.reasonsUse : null;
        if (ru) {
          for (const [k, v] of Object.entries(ru)) {
            const n = num(v);
            if (!Number.isFinite(n) || n <= 0) continue;
            drivers.set(k, (drivers.get(k) || 0) + n);
          }
        }
        const rn = s.reasonsNotUse && typeof s.reasonsNotUse === "object" ? s.reasonsNotUse : null;
        if (rn) {
          for (const [k, v] of Object.entries(rn)) {
            const n = num(v);
            if (!Number.isFinite(n) || n <= 0) continue;
            barriers.set(k, (barriers.get(k) || 0) + n);
          }
        }
        const imgs = s.media && Array.isArray(s.media.images) ? s.media.images : [];
        const vids = s.media && Array.isArray(s.media.videos) ? s.media.videos : [];
        imgRefs += imgs.length;
        vidRefs += vids.length;
      }
      const avg = (sum, den) => den > 0 ? sum / den : NaN;
      const pct = (v) => Number.isFinite(v) ? fmt1(v) + "%" : "—";
      const awarenessAvg = avg(sumAw, denAw);
      const usedLastYearAvg = avg(sumUl, denUl);
      const definiteAvg = avg(sumDe, denDe);
      const maybeAvg = avg(sumMb, denMb);
      const notInterestedAvg = avg(sumNi, denNi);
      const understandingAvg = avg(sumUn, denUn);
      const scoreAvg = avg(sumScore, denScore);
      const elKpiSessions = $$("#kpiSessions");
      if (elKpiSessions) elKpiSessions.textContent = fmtInt(fs.length);
      const elKpiFarmers = $$("#kpiFarmers");
      if (elKpiFarmers) elKpiFarmers.textContent = totalFarmers ? fmtInt(totalFarmers) : "—";
      const elKpiAcres = $$("#kpiAcres");
      if (elKpiAcres) elKpiAcres.textContent = totalAcres ? fmt1(totalAcres) : "—";
      const elKpiEst = $$("#kpiEstAcres");
      if (elKpiEst) elKpiEst.textContent = totalEstAcres ? fmt1(totalEstAcres) : "—";
      const elKpiAw = $$("#kpiAwareness");
      if (elKpiAw) elKpiAw.textContent = pct(awarenessAvg);
      const elKpiDef = $$("#kpiDefinite");
      if (elKpiDef) elKpiDef.textContent = pct(definiteAvg);
      const elKpiUsed = $$("#kpiUsedLastYear");
      if (elKpiUsed) elKpiUsed.textContent = pct(usedLastYearAvg);
      const elKpiScore = $$("#kpiScore");
      if (elKpiScore) elKpiScore.textContent = Number.isFinite(scoreAvg) ? fmt1(scoreAvg) : "—";
      const funnelEl = $$("#funnel");
      if (funnelEl) {
        const items = [
          { label: "Awareness", pct: awarenessAvg },
          { label: "Used last year", pct: usedLastYearAvg },
          { label: "Definite intent", pct: definiteAvg },
          { label: "Maybe", pct: maybeAvg },
          { label: "Not interested", pct: notInterestedAvg },
          { label: "Understanding", pct: Number.isFinite(understandingAvg) ? understandingAvg / 3 * 100 : NaN }
        ];
        const colors = {
          "Awareness": "var(--brand)",
          "Used last year": "var(--brand2)",
          "Definite intent": "#8e44ad",
          "Maybe": "#f59e0b",
          "Not interested": "var(--danger)",
          "Understanding": "#eab308"
        };
        let html = '<div class="donutGrid">';
        for (const it of items) {
          const raw = Number(it.pct);
          const pctVal = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
          const color = colors[it.label] || "var(--brand)";
          let display;
          if (it.label === "Understanding") {
            display = Number.isFinite(understandingAvg) ? fmt1(understandingAvg) + " / 3" : "—";
          } else {
            display = Number.isFinite(raw) ? fmt1(pctVal) + "%" : "—";
          }
          html += `<div class="donutCard">
          <div class="donutTitle">${esc(it.label)}</div>
          <div class="donutWrap">
            <div class="donut" style="--percent:${pctVal}; --color:${color};">
              <span class="donutValue">${esc(display)}</span>
            </div>
          </div>
          <div class="donutMeta"></div>
        </div>`;
        }
        html += "</div>";
        funnelEl.innerHTML = html;
      }
      const attCanvas = $$("#attendanceDonut");
      if (attCanvas && typeof Chart !== "undefined" && Array.isArray(fs)) {
        if (window.attendanceChart && typeof window.attendanceChart.destroy === "function") {
          window.attendanceChart.destroy();
        }
        const sessionsByFarmers = fs.map((s) => {
          var _a2;
          const count = Number(((_a2 = s.metrics) == null ? void 0 : _a2.farmers) || 0);
          let loc = (s.district || "").trim();
          if (!loc) loc = (s.village || s.spot || "").trim();
          if (!loc) loc = "Session";
          const label = `${loc} (S${s.id})`;
          return { id: s.id, label, farmers: count };
        }).filter((x) => x.farmers > 0).sort((a, b) => b.farmers - a.farmers);
        const maxSlices = 8;
        const labels = [];
        const data = [];
        const colors = [
          "#4c6fff",
          "#22c55e",
          "#f59e0b",
          "#8e44ad",
          "#f97316",
          "#3b82f6",
          "#eab308",
          "#10b981",
          "#a855f7",
          "#ef4444"
        ];
        let otherTotal = 0;
        sessionsByFarmers.forEach((item, idx2) => {
          if (idx2 < maxSlices) {
            labels.push(item.label);
            data.push(item.farmers);
          } else {
            otherTotal += item.farmers;
          }
        });
        if (otherTotal > 0) {
          labels.push("Other");
          data.push(otherTotal);
        }
        const bgColors = data.map((_, i) => colors[i % colors.length]);
        const ctx = attCanvas.getContext("2d");
        window.attendanceChart = new Chart(ctx, {
          type: "doughnut",
          data: {
            labels,
            datasets: [{ data, backgroundColor: bgColors, borderColor: "#ffffff10", borderWidth: 1 }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "right",
                labels: {
                  usePointStyle: true,
                  padding: 12,
                  boxWidth: 10
                }
              },
              tooltip: {
                callbacks: {
                  label: function(ctx2) {
                    const lab = ctx2.label || "";
                    const val = ctx2.dataset.data[ctx2.dataIndex];
                    const total = ctx2.dataset.data.reduce((acc, v) => acc + v, 0);
                    const pct2 = total ? (val / total * 100).toFixed(1) : 0;
                    return `${lab}: ${val} farmers (${pct2}%)`;
                  }
                }
              }
            },
            cutout: "50%"
          }
        });
      }
      const decisionCanvas = $$("#decisionPie");
      if (decisionCanvas && typeof Chart !== "undefined" && Array.isArray(fs)) {
        if (window.decisionChart && typeof window.decisionChart.destroy === "function") {
          window.decisionChart.destroy();
        }
        let sumDef = 0, sumMaybe = 0, sumNot = 0;
        for (const s of fs) {
          const si = idx == null ? void 0 : idx.get(s.sheetRef);
          const farmers = Number((_j = (_i = si == null ? void 0 : si.farmers_present) != null ? _i : (_h = s == null ? void 0 : s.metrics) == null ? void 0 : _h.farmers) != null ? _j : 0);
          const m = s.metrics || {};
          const def = num(m.definitePct);
          const mb = num(m.maybePct);
          const ni = num(m.notInterestedPct);
          if (Number.isFinite(farmers) && farmers > 0) {
            if (Number.isFinite(def)) sumDef += farmers * def / 100;
            if (Number.isFinite(mb)) sumMaybe += farmers * mb / 100;
            if (Number.isFinite(ni)) sumNot += farmers * ni / 100;
          }
        }
        const labels = ["Definite", "Maybe", "Not interested"];
        const data = [sumDef, sumMaybe, sumNot];
        const bgColors = ["#89d329", "#d9a420", "#dc2626"];
        const ctxPie = decisionCanvas.getContext("2d");
        window.decisionChart = new Chart(ctxPie, {
          type: "pie",
          data: { labels, datasets: [{ data, backgroundColor: bgColors }] },
          options: {
            responsive: true,
            plugins: {
              legend: {
                position: "right",
                labels: { usePointStyle: true, padding: 12, boxWidth: 10 }
              },
              tooltip: {
                callbacks: {
                  label: function(ctx) {
                    const lab = ctx.label || "";
                    const val = ctx.dataset.data[ctx.dataIndex];
                    const total = ctx.dataset.data.reduce((acc, v) => acc + v, 0);
                    const pct2 = total ? (val / total * 100).toFixed(1) : 0;
                    return `${lab}: ${Math.round(val)} farmers (${pct2}%)`;
                  }
                }
              }
            }
          }
        });
      }
      const topBody = $$("#topSessionsTable tbody");
      if (topBody) {
        const top = [...fs].sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 8);
        topBody.innerHTML = top.map((s) => {
          var _a2, _b2;
          const sid = esc(s.id);
          const date = esc(s.date || "");
          const sheet = esc(s.sheetRef || "");
          const district = esc(s.district || "");
          const village = esc(s.village || s.spot || "");
          const score = Number.isFinite(Number(s.score)) ? fmt1(s.score) : "—";
          const si = idx == null ? void 0 : idx.get(s.sheetRef);
          const f = si ? fmtInt(si.farmers_present) : Number.isFinite(Number((_a2 = s == null ? void 0 : s.metrics) == null ? void 0 : _a2.farmers)) ? fmtInt(s.metrics.farmers) : "—";
          const a = si ? fmt1(si.acres) : Number.isFinite(Number((_b2 = s == null ? void 0 : s.metrics) == null ? void 0 : _b2.wheatAcres)) ? fmt1(s.metrics.wheatAcres) : "—";
          const href = `details.html?campaign=${encodeURIComponent(state.campaignId)}&session=${encodeURIComponent(String(s.id))}`;
          return `<tr data-session-id="${sid}">
          <td>${date}</td>
          <td><span class="badge">${sheet}</span></td>
          <td>${district}</td>
          <td>${village}</td>
          <td>${f}</td>
          <td>${a}</td>
          <td>${score}</td>
          <td><a class="btn btnSmall" href="${href}">Open</a></td>
        </tr>`;
        }).join("");
      }
      const pdBody = $$("#priorityDistrictsTable tbody");
      if (pdBody) {
        const byD = /* @__PURE__ */ new Map();
        for (const s of fs) {
          const d = (s.district || "—").trim() || "—";
          const si = idx == null ? void 0 : idx.get(s.sheetRef);
          const farmers = Number((_m = (_l = si == null ? void 0 : si.farmers_present) != null ? _l : (_k = s == null ? void 0 : s.metrics) == null ? void 0 : _k.farmers) != null ? _m : 0);
          const acres = Number((_p = (_o = si == null ? void 0 : si.acres) != null ? _o : (_n = s == null ? void 0 : s.metrics) == null ? void 0 : _n.wheatAcres) != null ? _p : 0);
          const wt = Number.isFinite(farmers) && farmers > 0 ? farmers : 1;
          const m = s.metrics || {};
          const aw = num(m.awarenessPct);
          const de = num(m.definitePct);
          const sc = num(s.score);
          const o = byD.get(d) || { district: d, sessions: 0, farmers: 0, acres: 0, awSum: 0, awDen: 0, deSum: 0, deDen: 0, scSum: 0, scDen: 0 };
          o.sessions += 1;
          if (Number.isFinite(farmers) && farmers > 0) o.farmers += farmers;
          if (Number.isFinite(acres) && acres > 0) o.acres += acres;
          if (Number.isFinite(aw)) {
            o.awSum += aw * wt;
            o.awDen += wt;
          }
          if (Number.isFinite(de)) {
            o.deSum += de * wt;
            o.deDen += wt;
          }
          if (Number.isFinite(sc)) {
            o.scSum += sc * wt;
            o.scDen += wt;
          }
          byD.set(d, o);
        }
        let agg = [...byD.values()].map((o) => {
          const aw = avg(o.awSum, o.awDen);
          const de = avg(o.deSum, o.deDen);
          const sc = avg(o.scSum, o.scDen);
          return __spreadProps(__spreadValues({}, o), { aw, de, sc });
        });
        agg.sort((a, b) => {
          const ad = Number.isFinite(a.de) ? a.de : 1e9;
          const bd = Number.isFinite(b.de) ? b.de : 1e9;
          if (ad !== bd) return ad - bd;
          const as = Number.isFinite(a.sc) ? a.sc : 1e9;
          const bs = Number.isFinite(b.sc) ? b.sc : 1e9;
          return as - bs;
        });
        const rows = agg.slice(0, 8);
        const takeawayEl = $$("#summaryTakeaways");
        if (takeawayEl) {
          if (rows.length) {
            const topNames = rows.slice(0, 2).map((r) => r.district).filter(Boolean);
            takeawayEl.textContent = topNames.length ? `Focus next on ${topNames.join(" and ")}` : "";
          } else {
            takeawayEl.textContent = "";
          }
        }
        pdBody.innerHTML = rows.map((r) => {
          let action = "—";
          let cls = "";
          const deVal = Number(r.de);
          const scVal = Number(r.sc);
          if (Number.isFinite(deVal)) {
            if (deVal < 80) {
              action = "Arrange field demo";
              cls = "priority-high";
            } else if (deVal < 90) {
              action = "Dealer visit";
              cls = "priority-medium";
            } else {
              action = "Follow‑up call";
              cls = "priority-low";
            }
          }
          return `<tr${cls ? ` class="${cls}"` : ""}>
          <td>${esc(r.district)}</td>
          <td>${fmtInt(r.sessions)}</td>
          <td>${r.farmers ? fmtInt(r.farmers) : "—"}</td>
          <td>${r.acres ? fmt1(r.acres) : "—"}</td>
          <td>${pct(r.aw)}</td>
          <td>${pct(r.de)}</td>
          <td>${Number.isFinite(r.sc) ? fmt1(r.sc) : "—"}</td>
          <td>${esc(action)}</td>
        </tr>`;
        }).join("");
      }
      const listHtml = (mp) => {
        const total = totalFarmers || 0;
        const arr = [...mp.entries()].sort((a, b) => (b[1] || 0) - (a[1] || 0)).slice(0, 6);
        if (!arr.length) return '<li class="muted">No entries captured.</li>';
        return arr.map(([k, v]) => {
          const n = Number(v) || 0;
          const share = total > 0 ? ` • ${fmt1(n / total * 100)}%` : "";
          return `<li><b>${esc(k)}</b>: ${fmtInt(n)}${esc(share)}</li>`;
        }).join("");
      };
      const renderBarChart = (mp, containerId) => {
        const container = document.querySelector(containerId);
        if (!container) return;
        const total = totalFarmers || 0;
        const arr = [...mp.entries()].sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0)).slice(0, 6);
        if (!arr.length) {
          container.innerHTML = '<div class="muted">No entries captured.</div>';
          return;
        }
        container.innerHTML = arr.map(([k, v]) => {
          const n = Number(v) || 0;
          const pct2 = total > 0 ? Math.min(Math.max(n / total * 100, 0), 100) : 0;
          const colorVar = containerId === "#driversChart" ? "var(--brand)" : "var(--danger)";
          return `<div class="barRow">
          <div class="barLabel">${esc(k)}</div>
          <div class="barTrack"><div class="barFill" style="width:${pct2.toFixed(1)}%; background:${colorVar};"></div></div>
          <div class="barVal">${fmtInt(n)}${total > 0 ? ` (${fmt1(pct2)}%)` : ""}</div>
        </div>`;
        }).join("");
      };
      renderBarChart(drivers, "#driversChart");
      renderBarChart(barriers, "#barriersChart");
      setStatus(
        `Loaded ${fmtInt(fs.length)} sessions and ${fmtInt(((_r = (_q = state.sheetsIndex) == null ? void 0 : _q.sheets) == null ? void 0 : _r.length) || 0)} sheet summaries.
Reach: ${totalFarmers ? fmtInt(totalFarmers) : "—"} farmers • ${totalAcres ? fmt1(totalAcres) : "—"} acres • Est. Buctril acres: ${totalEstAcres ? fmt1(totalEstAcres) : "—"}.
Referenced media: ${fmtInt(imgRefs)} images • ${fmtInt(vidRefs)} videos.
Conversion coverage: ${denAw ? fmtInt(denAw) : "—"} farmer-weighted records (of ${totalFarmers ? fmtInt(totalFarmers) : "—"} farmers).`,
        "ok"
      );
    }
    function renderSessionsTable() {
      var _a;
      const tbody = $$("#sessionsTable tbody");
      if (!tbody) return;
      const idx = ((_a = state.sheetsIndex) == null ? void 0 : _a.sheets) ? new Map(state.sheetsIndex.sheets.map((x) => [x.sheet, x])) : null;
      const rows = state.filteredSessions.map((s) => {
        const sid = esc(s.id);
        const date = esc(s.date || "");
        const sheet = esc(s.sheetRef || "");
        const district = esc(s.district || "");
        const village = esc(s.village || s.spot || "");
        const score = Number.isFinite(Number(s.score)) ? fmt1(s.score) : "—";
        const si = idx == null ? void 0 : idx.get(s.sheetRef);
        const f = si ? fmtInt(si.farmers_present) : "—";
        const a = si ? fmt1(si.acres) : "—";
        const hrefSheet = `sheets.html?campaign=${encodeURIComponent(state.campaignId)}&sheet=${encodeURIComponent(s.sheetRef)}`;
        const hrefDetails = `details.html?campaign=${encodeURIComponent(state.campaignId)}&session=${encodeURIComponent(String(s.id))}`;
        return `<tr data-session-id="${sid}">
        <td>${date}</td>
        <td><span class="badge">${sheet}</span></td>
        <td>${district}</td>
        <td>${village}</td>
        <td>${f}</td>
        <td>${a}</td>
        <td>${score}</td>
        <td style="white-space:nowrap">
          <a class="btn btnSmall" href="${hrefSheet}">Sheet</a>
          <a class="btn btnSmall btnGhost" href="${hrefDetails}">Details</a>
          <button class="btn btnSmall btnGhost" data-action="preview">Preview</button>
        </td>
      </tr>`;
      });
      tbody.innerHTML = rows.join("");
      tbody.onclick = (ev) => {
        const tr = ev.target.closest("tr[data-session-id]");
        if (!tr) return;
        if (ev.target.closest("a")) return;
        const sid = Number(tr.dataset.sessionId);
        openDrawer(sid);
      };
      tbody.addEventListener("click", (ev) => {
        const btn = ev.target.closest('button[data-action="preview"]');
        if (!btn) return;
        const tr = ev.target.closest("tr[data-session-id]");
        if (!tr) return;
        ev.preventDefault();
        ev.stopPropagation();
        openDrawer(Number(tr.dataset.sessionId));
      });
    }
    function firstMediaImage(s) {
      const imgs = s.media && Array.isArray(s.media.images) ? s.media.images : [];
      if (imgs.length) return imgs[0];
      return "";
    }
    function firstMediaVideo(s) {
      const vids = s.media && Array.isArray(s.media.videos) ? s.media.videos : [];
      if (vids.length) return vids[0];
      return "";
    }
    function allMediaItems(s) {
      const imgs = s.media && Array.isArray(s.media.images) ? s.media.images : [];
      const vids = s.media && Array.isArray(s.media.videos) ? s.media.videos : [];
      return [
        ...imgs.map((p) => ({ type: "image", path: p })),
        ...vids.map((p) => ({ type: "video", path: p }))
      ];
    }
    function renderMedia() {
      const grid = $$("#mediaGrid");
      if (!grid) return;
      if (!state._mediaBound) {
        state._mediaBound = true;
        const seg = $$(".mediaSeg");
        seg == null ? void 0 : seg.addEventListener("click", (e) => {
          const btn = e.target.closest("button[data-media-type]");
          if (!btn) return;
          const t = btn.getAttribute("data-media-type") || "all";
          state.mediaType = t;
          $$$("button[data-media-type]", seg).forEach((b) => b.classList.toggle("segBtn--active", b === btn));
          state.mediaLimit = 24;
          renderMedia();
        });
        const search = $$("#mediaSearch");
        if (search) {
          search.addEventListener("input", () => {
            state.mediaSearch = String(search.value || "").trim().toLowerCase();
            state.mediaLimit = 24;
            renderMedia();
          });
        }
        const sort = $$("#mediaSort");
        if (sort) {
          sort.addEventListener("change", () => {
            state.mediaSort = String(sort.value || "newest");
            renderMedia();
          });
        }
        const more = $$("#mediaLoadMore");
        if (more) {
          more.addEventListener("click", () => {
            state.mediaLimit = Number(state.mediaLimit || 24) + 24;
            renderMedia();
          });
        }
      }
      const playIcon = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 7v10l9-5-9-5Z" fill="currentColor"/></svg>';
      const photoIcon = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z" stroke="currentColor" stroke-width="2"/><path d="M8 11l2.5 3 2-2 3.5 5H6l2-6Z" fill="currentColor" opacity=".35"/></svg>';
      const q = String(state.mediaSearch || "").trim().toLowerCase();
      const type = String(state.mediaType || "all");
      const sortMode = String(state.mediaSort || "newest");
      let list = Array.isArray(state.filteredSessions) ? [...state.filteredSessions] : [];
      list = list.filter((s) => !!firstMediaVideo(s) || !!firstMediaImage(s));
      if (type === "videos") list = list.filter((s) => !!firstMediaVideo(s));
      if (type === "images") list = list.filter((s) => !!firstMediaImage(s));
      if (q) {
        list = list.filter((s) => {
          const sheet = String(s.sheetRef || "");
          const district = String(s.district || "");
          const village = String(s.village || s.spot || "");
          return `${sheet} ${district} ${village}`.toLowerCase().includes(q);
        });
      }
      list.sort((a, b) => {
        var _a, _b;
        const da = ((_a = parseDateSafe(a.date)) == null ? void 0 : _a.getTime()) || 0;
        const db = ((_b = parseDateSafe(b.date)) == null ? void 0 : _b.getTime()) || 0;
        return sortMode === "oldest" ? da - db : db - da;
      });
      const total = list.length;
      const limit = Math.max(0, Number(state.mediaLimit || 24));
      const shown = list.slice(0, limit);
      const cards = shown.map((s) => {
        const sid = esc(s.id);
        const sheet = esc(s.sheetRef || "");
        const district = esc(s.district || "");
        const village = esc(s.village || s.spot || "");
        const vidPath = firstMediaVideo(s);
        const videoSrc = vidPath ? normalizeMediaPath(vidPath) : "";
        const img = firstMediaImage(s);
        const title = `${sheet} • ${district} • ${village}`;
        const hrefDetails = `details.html?campaign=${encodeURIComponent(state.campaignId)}&session=${encodeURIComponent(String(s.id))}`;
        let thumb;
        let badge;
        if (vidPath) {
          thumb = `<video autoplay loop muted playsinline src="${esc(videoSrc)}"></video>`;
          badge = `<div class="mediaBadge" title="Video">${playIcon}<span>Video</span></div>`;
        } else {
          thumb = `<img data-media-thumb="1" alt="${esc(title)}" />`;
          badge = `<div class="mediaBadge" title="Image">${photoIcon}<span>Image</span></div>`;
        }
        return `<div class="mediaCard" data-session-id="${sid}">
        <div class="mediaThumb">
          ${badge}
          ${thumb}
        </div>
        <div class="mediaMeta">
          <div class="mediaTitle">${esc(title)}</div>
          <div class="mediaActions">
            <a class="btn btnSmall" href="sheets.html?campaign=${encodeURIComponent(state.campaignId)}&sheet=${encodeURIComponent(s.sheetRef)}">Sheet</a>
            <a class="btn btnSmall btnGhost" href="${hrefDetails}">Details</a>
            <button class="btn btnSmall btnGhost" data-action="open">Open</button>
          </div>
        </div>
        <div class="hidden" data-thumb-path="${esc(img)}"></div>
      </div>`;
      });
      grid.innerHTML = cards.join("");
      const countEl = $$("#mediaCount");
      if (countEl) countEl.textContent = total ? `Showing ${Math.min(limit, total)} of ${total}` : "No media for current filters";
      const moreBtn = $$("#mediaLoadMore");
      if (moreBtn) moreBtn.style.display = limit < total ? "" : "none";
      $$$('[data-media-thumb="1"]', grid).forEach((img) => {
        var _a;
        const card = img.closest(".mediaCard");
        const p = ((_a = card == null ? void 0 : card.querySelector("[data-thumb-path]")) == null ? void 0 : _a.getAttribute("data-thumb-path")) || "";
        attachSmartImage(img, p || "assets/placeholder.svg");
      });
      grid.onclick = (ev) => {
        const card = ev.target.closest(".mediaCard[data-session-id]");
        if (!card) return;
        const sid = Number(card.dataset.sessionId);
        if (ev.target.closest("a")) return;
        openLightbox(sid);
      };
    }
    function renderAll() {
      renderSummary();
      renderSessionsTable();
      renderMedia();
      updateMapData();
    }
    function closeDrawer() {
      const ov = $$("#drawerOverlay");
      const dr = $$("#sessionDrawer");
      if (ov) ov.classList.add("hidden");
      if (dr) dr.classList.add("hidden");
      if (ov) ov.setAttribute("aria-hidden", "true");
      if (dr) dr.setAttribute("aria-hidden", "true");
      try {
        const base = location.pathname + location.search;
        if (location.hash) {
          location.href = base;
        }
      } catch (_e) {
      }
    }
    async function openDrawer(sessionId) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
      const s = state.sessionsById.get(Number(sessionId));
      if (!s) return;
      const ov = $$("#drawerOverlay");
      const dr = $$("#sessionDrawer");
      if (ov) ov.classList.remove("hidden");
      if (dr) dr.classList.remove("hidden");
      if (ov) ov.setAttribute("aria-hidden", "false");
      if (dr) dr.setAttribute("aria-hidden", "false");
      $$("#drawerTitle").textContent = `Session ${s.id} • ${s.sheetRef || ""}`;
      $$("#drawerSub").textContent = `${s.date || ""} • ${s.district || ""} • ${s.village || s.spot || ""}`;
      const si = (_b = (_a = state.sheetsIndex) == null ? void 0 : _a.sheets) == null ? void 0 : _b.find((x) => x.sheet === s.sheetRef);
      $$("#dFarmers").textContent = si ? fmtInt(si.farmers_present) : "—";
      $$("#dAcres").textContent = si ? fmt1(si.acres) : "—";
      $$("#dScore").textContent = Number.isFinite(Number(s.score)) ? fmt1(s.score) : "—";
      const meta = [
        s.city ? `City: ${esc(s.city)}` : "",
        s.district ? `District: ${esc(s.district)}` : "",
        s.spot ? `Spot: ${esc(s.spot)}` : "",
        ((_c = s.dealer) == null ? void 0 : _c.name) ? `Dealer: ${esc(s.dealer.name)}` : "",
        ((_d = s.salesRep) == null ? void 0 : _d.name) ? `Sales: ${esc(s.salesRep.name)}` : "",
        ((_e = s.host) == null ? void 0 : _e.name) ? `Host: ${esc(s.host.name)}` : ""
      ].filter(Boolean).join(" • ");
      $$("#dMeta").innerHTML = meta || '<span class="muted">—</span>';
      const outEl = $$("#dOutcomes");
      const actEl = $$("#dActions");
      const m = s.metrics || {};
      const aw = num(m.awarenessPct);
      const ul = num(m.usedLastYearPct);
      const de = num(m.definitePct);
      const mb = num(m.maybePct);
      const ni = num(m.notInterestedPct);
      const un = num(m.avgUnderstanding);
      const fmtPct = (v) => Number.isFinite(v) ? fmt1(v) + "%" : "—";
      const fmtUnd = (v) => Number.isFinite(v) ? fmt1(v) + " / 3" : "—";
      if (outEl) {
        const topUse = (s.topReasonUse || "").trim();
        const topNot = (s.topReasonNotUse || "").trim();
        outEl.innerHTML = `
        <div class="muted">Awareness: <b>${esc(fmtPct(aw))}</b> • Definite: <b>${esc(fmtPct(de))}</b> • Used last year: <b>${esc(fmtPct(ul))}</b></div>
        <div class="muted">Maybe: <b>${esc(fmtPct(mb))}</b> • Not interested: <b>${esc(fmtPct(ni))}</b> • Understanding: <b>${esc(fmtUnd(un))}</b></div>
        <div class="smallMuted">${topUse ? "Top driver: " + esc(topUse) : ""}${topUse && topNot ? " • " : ""}${topNot ? "Top barrier: " + esc(topNot) : ""}</div>
      `.trim();
      }
      const acts = [];
      const farmersNow = Number((_g = (_f = si == null ? void 0 : si.farmers_present) != null ? _f : m.farmers) != null ? _g : 0);
      const uPct = Number.isFinite(un) ? un / 3 * 100 : NaN;
      if (Number.isFinite(aw) && aw < 60) acts.push("Increase awareness: start with weed-pressure framing + product positioning; add a pre-activation dealer touchpoint and 1–2 local influencer farmers.");
      if (Number.isFinite(de) && de < 70) acts.push("Improve conversion: strengthen objection-handling talk track; include cost-per-acre ROI and a demo-plot story (before/after weeds).");
      if (Number.isFinite(uPct) && uPct < 75) acts.push("Improve message clarity: simplify the 4 key messages, use visuals, repeat key points, and do a quick comprehension check mid-session.");
      if (Number.isFinite(farmersNow) && farmersNow > 0 && farmersNow < 20) acts.push("Improve turnout: revise venue/time, confirm mobilization plan, and coordinate with nearest dealer for invites and reminders.");
      const rn = s.reasonsNotUse && typeof s.reasonsNotUse === "object" ? s.reasonsNotUse : {};
      const price = Number(rn["Price Too High"] || 0);
      const avail = Number(rn["Not Available"] || 0);
      const burn = Number(rn["Fear of Burn"] || 0);
      if (Number.isFinite(price) && price > 0) acts.push("Address price objections: lead with value narrative (weed control reliability, yield protection), and convert price to per-acre cost.");
      if (Number.isFinite(avail) && avail > 0) acts.push("Fix availability risk: confirm stock at nearest dealer and share a clear purchase path at the end of the session.");
      if (Number.isFinite(burn) && burn > 0) acts.push("Reduce burn concerns: emphasize correct dose + timing and show safe-use guidance with examples.");
      if (actEl) {
        actEl.innerHTML = acts.length ? acts.map((x) => `<li>${esc(x)}</li>`).join("") : '<li class="muted">No critical flags for this session based on thresholds.</li>';
      }
      const sheetUrl = `sheets.html?campaign=${encodeURIComponent(state.campaignId)}&sheet=${encodeURIComponent(s.sheetRef)}`;
      const detailsUrl = `details.html?campaign=${encodeURIComponent(state.campaignId)}&session=${encodeURIComponent(String(s.id))}`;
      $$("#dOpenSheet").setAttribute("href", sheetUrl);
      $$("#dOpenDetails").setAttribute("href", detailsUrl);
      const lat = Number((_h = s.geo) == null ? void 0 : _h.lat);
      const lng = Number((_i = s.geo) == null ? void 0 : _i.lng);
      const g = Number.isFinite(lat) && Number.isFinite(lng) ? `https://www.google.com/maps?q=${lat},${lng}` : "#";
      $$("#dOpenMaps").setAttribute("href", g);
      const sumEl = $$("#dSheetSummary");
      if (sumEl) sumEl.textContent = "Loading…";
      try {
        const sheet = await fetchJson(`data/${state.campaignId}/sheets/${s.sheetRef}.json`, "sheet");
        const fb = sheet.feedback || {};
        const farmers = Array.isArray(sheet.farmers) ? sheet.farmers : [];
        const top = [...farmers].sort((a, b) => Number(b.acres || 0) - Number(a.acres || 0)).slice(0, 5);
        const topHtml = top.length ? `<ul>${top.map((x) => {
          var _a2;
          return `<li>${esc(x.name || "")} — ${esc(String((_a2 = x.acres) != null ? _a2 : ""))} acres</li>`;
        }).join("")}</ul>` : '<div class="muted">No farmer rows found in sheet.</div>';
        const hostComment = fb.host_comment ? `<div><b>Host comment:</b> ${esc(fb.host_comment)}</div>` : "";
        const mgr = fb.manager_note ? `<div><b>Manager note:</b> ${esc(fb.manager_note)}</div>` : "";
        const sales = fb.sales_feedback ? `<div><b>Sales feedback:</b> ${esc(fb.sales_feedback)}</div>` : "";
        sumEl.innerHTML = `
        <div class="muted">Sheet: <b>${esc(((_j = sheet.meta) == null ? void 0 : _j.sheet) || s.sheetRef)}</b> • Date: <b>${esc(((_k = sheet.meta) == null ? void 0 : _k.date) || s.date || "")}</b></div>
        ${hostComment}
        ${mgr}
        ${sales}
        <div class="divider"></div>
        <div><b>Top farmers (by acres)</b></div>
        ${topHtml}
      `;
      } catch (e) {
        if (sumEl) sumEl.innerHTML = `<div class="muted">Could not load sheet summary.</div><div class="smallMuted">${esc(e.message)}</div>`;
      }
      const mediaEl = $$("#dMedia");
      if (mediaEl) {
        mediaEl.innerHTML = "";
        const items = allMediaItems(s).slice(0, 8);
        for (const it of items) {
          if (it.type === "image") {
            const img = document.createElement("img");
            img.className = "thumb";
            img.alt = s.sheetRef || "image";
            img.loading = "lazy";
            mediaEl.appendChild(img);
            attachSmartImage(img, it.path);
            img.onclick = () => openLightbox(Number(s.id));
          } else {
            const wrap = document.createElement("div");
            wrap.className = "thumbVideo";
            const v = document.createElement("video");
            v.className = "thumb";
            v.muted = true;
            v.playsInline = true;
            v.setAttribute("playsinline", "");
            wrap.appendChild(v);
            mediaEl.appendChild(wrap);
            attachSmartVideo(v, it.path);
            wrap.onclick = () => openLightbox(Number(s.id));
          }
        }
        if (!items.length) {
          mediaEl.innerHTML = '<div class="muted">No media listed for this session.</div>';
        }
      }
    }
    function bindDrawer() {
      const closeBtn = $$("#drawerClose");
      const ov = $$("#drawerOverlay");
      closeBtn == null ? void 0 : closeBtn.addEventListener("click", closeDrawer);
      ov == null ? void 0 : ov.addEventListener("click", closeDrawer);
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") {
          closeDrawer();
          closeLightbox();
        }
      });
    }
    function closeLightbox() {
      const lb = $$("#lightbox");
      if (lb) lb.classList.remove("open");
      const body = $$("#lbBody");
      if (body) body.innerHTML = "";
      try {
        const base = location.pathname + location.search;
        if (location.hash) {
          location.href = base;
        }
      } catch (_e) {
      }
    }
    function bindLightbox() {
      var _a, _b;
      (_a = $$("#lbClose")) == null ? void 0 : _a.addEventListener("click", closeLightbox);
      (_b = $$("#lightbox")) == null ? void 0 : _b.addEventListener("click", (ev) => {
        if (ev.target && ev.target.id === "lightbox") closeLightbox();
      });
    }
    async function openLightbox(sessionId) {
      const s = state.sessionsById.get(Number(sessionId));
      if (!s) return;
      const lb = $$("#lightbox");
      const body = $$("#lbBody");
      if (!lb || !body) return;
      $$("#lbTitle").textContent = `Session ${s.id} • ${s.sheetRef || ""}`;
      lb.classList.add("open");
      body.innerHTML = "";
      const items = allMediaItems(s);
      if (!items.length) {
        body.innerHTML = '<div class="muted">No media listed for this session.</div>';
        return;
      }
      const main = items[0];
      if (main.type === "image") {
        const img = document.createElement("img");
        img.className = "lightboxMedia";
        img.alt = "image";
        body.appendChild(img);
        attachSmartImage(img, main.path);
      } else {
        const v = document.createElement("video");
        v.className = "lightboxMedia";
        v.controls = true;
        v.playsInline = true;
        v.setAttribute("playsinline", "");
        body.appendChild(v);
        const chosen = await resolveFirstExisting(main.path);
        v.src = chosen ? url(chosen) : url("assets/placeholder-video.mp4");
      }
      if (items.length > 1) {
        const row = document.createElement("div");
        row.className = "mediaRow";
        for (const it of items.slice(1, 12)) {
          if (it.type === "image") {
            const t = document.createElement("img");
            t.className = "thumb";
            t.alt = "thumb";
            t.loading = "lazy";
            row.appendChild(t);
            attachSmartImage(t, it.path);
            t.onclick = () => {
              body.innerHTML = "";
              lb.classList.add("open");
              openLightbox(sessionId);
            };
          } else {
            const tv = document.createElement("video");
            tv.className = "thumb";
            tv.muted = true;
            tv.playsInline = true;
            tv.setAttribute("playsinline", "");
            row.appendChild(tv);
            attachSmartVideo(tv, it.path);
            tv.onclick = () => {
              body.innerHTML = "";
              lb.classList.add("open");
              openLightbox(sessionId);
            };
          }
        }
        body.appendChild(row);
      }
    }
    async function ensureMapReady() {
      var _a, _b;
      const el = $$("#leafletMap");
      if (!el) return;
      setMapStatus("Loading map…", false);
      const ok = await ensureLeafletReady({ timeoutMs: 9e3 });
      if (!ok) {
        setMapStatus("Map library blocked", false);
        (_a = $$("#mapFallback")) == null ? void 0 : _a.classList.remove("hidden");
        return;
      }
      if (state.map) {
        state.map.invalidateSize();
        updateMapData();
        return;
      }
      try {
        const map = window.L.map(el, { zoomControl: true });
        state.map = map;
        state.markerLayer = window.L.layerGroup().addTo(map);
        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: "&copy; OpenStreetMap"
        }).addTo(map);
        try {
          state.heatLayer = window.L.heatLayer([], { radius: 25, blur: 15, maxZoom: 18 });
        } catch (_e) {
          state.heatLayer = null;
        }
        updateMapData();
        setMapStatus("Ready", true);
        setTimeout(() => map.invalidateSize(), 250);
        map.on("click", () => {
          try {
            map.closePopup();
          } catch (_e) {
          }
        });
      } catch (e) {
        setMapStatus("Failed", false);
        (_b = $$("#mapFallback")) == null ? void 0 : _b.classList.remove("hidden");
      }
    }
    function updateMapData() {
      var _a, _b, _c, _d, _e, _f;
      if (!state.map || !state.markerLayer || !window.L) return;
      state.markerLayer.clearLayers();
      state.markersBySessionId.clear();
      const idx = ((_a = state.sheetsIndex) == null ? void 0 : _a.sheets) ? new Map(state.sheetsIndex.sheets.map((x) => [x.sheet, x])) : null;
      const pts = [];
      const heatPoints = [];
      for (const s of state.filteredSessions) {
        const lat = Number((_b = s.geo) == null ? void 0 : _b.lat);
        const lng = Number((_c = s.geo) == null ? void 0 : _c.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        pts.push([lat, lng]);
        let weight = 1;
        const si = idx == null ? void 0 : idx.get(s.sheetRef);
        const acres = Number((_f = (_e = si == null ? void 0 : si.acres) != null ? _e : (_d = s == null ? void 0 : s.metrics) == null ? void 0 : _d.wheatAcres) != null ? _f : 0);
        if (Number.isFinite(acres) && acres > 0) weight = acres;
        heatPoints.push([lat, lng, weight]);
        const sheetUrl = `sheets.html?campaign=${encodeURIComponent(state.campaignId)}&sheet=${encodeURIComponent(s.sheetRef)}`;
        const detailsUrl = `details.html?campaign=${encodeURIComponent(state.campaignId)}&session=${encodeURIComponent(String(s.id))}`;
        const g = `https://www.google.com/maps?q=${lat},${lng}`;
        const popup = `
        <div style="min-width:220px">
          <div><b>Session ${esc(s.id)}</b> • <span class="badge">${esc(s.sheetRef || "")}</span></div>
          <div class="smallMuted">${esc(s.date || "")} • ${esc(s.district || "")}</div>
          <div class="smallMuted">${esc(s.village || s.spot || "")}</div>
          <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap">
            <a class="btn btnSmall" href="${sheetUrl}">Open sheet</a>
            <a class="btn btnSmall btnGhost" href="${detailsUrl}">Details</a>
            <a class="btn btnSmall btnGhost" href="${g}" target="_blank" rel="noopener">Maps</a>
          </div>
          <div style="margin-top:8px">
            <button class="btn btnSmall btnGhost" data-preview="${esc(s.id)}">Preview</button>
          </div>
        </div>`;
        const marker = window.L.circleMarker([lat, lng], {
          radius: 7,
          weight: 2,
          color: "#4c6fff",
          fillColor: "#4c6fff",
          fillOpacity: 0.35
        });
        marker.bindPopup(popup);
        marker.addTo(state.markerLayer);
        state.markersBySessionId.set(Number(s.id), marker);
      }
      if (pts.length) {
        const bounds = window.L.latLngBounds(pts);
        state.map.fitBounds(bounds.pad(0.15));
      }
      if (state.heatLayer && Array.isArray(heatPoints)) {
        try {
          state.heatLayer.setLatLngs(heatPoints);
        } catch (_e2) {
        }
      }
      state.map.off("popupopen");
      state.map.on("popupopen", (e) => {
        const node = e.popup.getElement();
        if (!node) return;
        const btn = node.querySelector("button[data-preview]");
        if (!btn) return;
        btn.addEventListener("click", () => {
          const sid = Number(btn.getAttribute("data-preview"));
          openDrawer(sid);
        });
      });
    }
    function bindFeedback() {
      const phoneInput = $$("#fbPhone");
      const emailInput = $$("#fbEmail");
      const msgInput = $$("#fbMessage");
      const waBtn = $$("#fbSendWhatsApp");
      const mailBtn = $$("#fbSendEmail");
      const statusLabel = $$("#fbFeedbackMsg");
      function displayStatus(t, ok = true) {
        if (!statusLabel) return;
        statusLabel.textContent = t;
        statusLabel.style.color = ok ? "" : "var(--danger)";
      }
      waBtn == null ? void 0 : waBtn.addEventListener("click", () => {
        var _a, _b;
        const phoneRaw = ((_a = phoneInput == null ? void 0 : phoneInput.value) == null ? void 0 : _a.trim()) || "";
        const msg = ((_b = msgInput == null ? void 0 : msgInput.value) == null ? void 0 : _b.trim()) || "";
        const phone = phoneRaw.replace(/[^0-9]/g, "");
        if (!phone) {
          displayStatus("Please enter a valid phone number.", false);
          return;
        }
        const encoded = encodeURIComponent(msg);
        const waUrl = `https://wa.me/${phone}?text=${encoded}`;
        window.open(waUrl, "_blank");
        displayStatus("Opening WhatsApp…");
      });
      mailBtn == null ? void 0 : mailBtn.addEventListener("click", () => {
        var _a, _b;
        const email = ((_a = emailInput == null ? void 0 : emailInput.value) == null ? void 0 : _a.trim()) || "";
        const msg = ((_b = msgInput == null ? void 0 : msgInput.value) == null ? void 0 : _b.trim()) || "";
        if (!email) {
          displayStatus("Please enter a valid email address.", false);
          return;
        }
        const subject = encodeURIComponent("Feedback on Harvest Horizons Dashboard");
        const body = encodeURIComponent(msg);
        const mailto = `mailto:${email}?subject=${subject}&body=${body}`;
        window.location.href = mailto;
        displayStatus("Opening email draft…");
      });
    }
    function renderCampaignSelect() {
      var _a, _b;
      const sel = $$("#campaignSelect");
      if (!sel) return;
      sel.innerHTML = state.campaigns.map((c) => {
        const id = esc(c.id);
        const name = esc(c.name || c.id);
        return `<option value="${id}">${name}</option>`;
      }).join("");
      sel.value = state.campaignId || ((_b = (_a = state.campaigns[0]) == null ? void 0 : _a.id) != null ? _b : "");
      sel.onchange = () => {
        const id = sel.value;
        window.location.href = `index.html?campaign=${encodeURIComponent(id)}#summary`;
      };
    }
    async function loadCampaign(id) {
      state.campaignId = id;
      state.campaign = state.campaigns.find((c) => c.id === id) || state.campaigns[0] || null;
      if (!state.campaign) throw new Error("No campaigns configured.");
      setStatus("Loading sessions…");
      const sessionsPath = state.campaign.sessionsUrl || `data/${id}/sessions.json`;
      const mediaPath = state.campaign.mediaUrl || `data/${id}/media.json`;
      const sheetsIndexPath = state.campaign.sheetsIndexUrl || `data/${id}/sheets_index.json`;
      const sj = await fetchJson(sessionsPath, "sessions");
      const sessions = Array.isArray(sj.sessions) ? sj.sessions : Array.isArray(sj) ? sj : [];
      (function assignRegions() {
        const regionMap = {
          // Sukkur region (SKR)
          "dadu": "SKR",
          "daharki": "SKR",
          "dharki": "SKR",
          "ghotki": "SKR",
          "jafferabad": "SKR",
          "jaferabad": "SKR",
          "jafarabad": "SKR",
          "jaferabad": "SKR",
          "mehrabpur": "SKR",
          "ranipur": "SKR",
          "sukkur": "SKR",
          "ubaro": "SKR",
          "ubauro": "SKR",
          // Rahim Yar Khan region (RYK)
          "rahim yarkhan": "RYK",
          "rahim yar khan": "RYK",
          "rajan pur": "RYK",
          "rajanpur": "RYK",
          // Dera Ghazi Khan region (DGK)
          "bhakkar": "DGK",
          "karor lal esan": "DGK",
          "kot adu": "DGK",
          "mianwali": "DGK",
          "muzaffar garh": "DGK",
          "muzaffargarh": "DGK",
          // Faisalabad region (FSD)
          "chakwal": "FSD",
          "sargodha": "FSD",
          "toba tek singh": "FSD",
          // Gujranwala region (GUJ)
          "phalia": "GUJ"
        };
        for (const s of sessions) {
          const district = String(s.district || "").toLowerCase().replace(/\s+/g, "");
          let matchedRegion = "";
          for (const [key, reg] of Object.entries(regionMap)) {
            const normKey = key.toLowerCase().replace(/\s+/g, "");
            if (district === normKey) {
              matchedRegion = reg;
              break;
            }
          }
          s.region = matchedRegion;
        }
      })();
      state.sessions = sessions;
      state.sessionsById = new Map(sessions.map((s) => [Number(s.id), s]));
      try {
        state.sheetsIndex = await fetchJson(sheetsIndexPath, "sheets index");
      } catch (_e) {
        state.sheetsIndex = null;
      }
      try {
        state.mediaCfg = await fetchJson(mediaPath, "media config");
      } catch (_e) {
        state.mediaCfg = null;
      }
      const dates = sessions.map((s) => parseDateSafe(s.date)).filter(Boolean);
      if (!dates.length) throw new Error("No session dates found.");
      dates.sort((a, b) => a - b);
      const cfgStart = parseDateSafe(state.campaign.startDate);
      const cfgEnd = parseDateSafe(state.campaign.endDate);
      state.dateMin = cfgStart || dates[0];
      state.dateMax = cfgEnd || dates[dates.length - 1];
      if (state.dateMin < dates[0]) state.dateMin = dates[0];
      if (state.dateMax > dates[dates.length - 1]) state.dateMax = dates[dates.length - 1];
      state.dateFrom = state.dateMin;
      state.dateTo = state.dateMax;
      const fromEl = $$("#dateFrom");
      const toEl = $$("#dateTo");
      if (fromEl && toEl) {
        fromEl.min = formatDateInput(state.dateMin);
        fromEl.max = formatDateInput(state.dateMax);
        toEl.min = formatDateInput(state.dateMin);
        toEl.max = formatDateInput(state.dateMax);
        fromEl.value = formatDateInput(state.dateMin);
        toEl.value = formatDateInput(state.dateMax);
      }
      setRangeHint();
      filterSessions();
      renderAll();
      setStatus("Loaded.", "ok");
    }
    function bindTopControls() {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
      (_a = $$("#applyBtn")) == null ? void 0 : _a.addEventListener("click", applyDateInputs);
      (_b = $$("#resetBtn")) == null ? void 0 : _b.addEventListener("click", resetDateInputs);
      (_c = $$("#exportBtn")) == null ? void 0 : _c.addEventListener("click", exportCsv);
      (_d = $$("#dateFrom")) == null ? void 0 : _d.addEventListener("change", applyDateInputs);
      (_e = $$("#dateTo")) == null ? void 0 : _e.addEventListener("change", applyDateInputs);
      (_f = $$("#nameFilter")) == null ? void 0 : _f.addEventListener("input", applyDateInputs);
      (_g = $$("#cityFilter")) == null ? void 0 : _g.addEventListener("input", applyDateInputs);
      (_h = $$("#regionFilter")) == null ? void 0 : _h.addEventListener("input", applyDateInputs);
      (_i = $$("#districtFilter")) == null ? void 0 : _i.addEventListener("input", applyDateInputs);
      (_j = $$("#scoreMin")) == null ? void 0 : _j.addEventListener("input", applyDateInputs);
      (_k = $$("#scoreMax")) == null ? void 0 : _k.addEventListener("input", applyDateInputs);
      (_l = $$("#priorityExportBtn")) == null ? void 0 : _l.addEventListener("click", exportPriorityCsv);
    }
    function exportCsv() {
      var _a;
      const rows = [];
      rows.push(["id", "sheetRef", "date", "district", "village", "score"].join(","));
      for (const s of state.filteredSessions) {
        const row = [
          s.id,
          s.sheetRef,
          s.date,
          (s.district || "").replaceAll(",", " "),
          (s.village || s.spot || "").replaceAll(",", " "),
          (_a = s.score) != null ? _a : ""
        ];
        rows.push(row.map((x) => String(x != null ? x : "").replaceAll("\n", " ").replaceAll("\r", " ")).join(","));
      }
      const blob = new Blob([rows.join("\n")], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${state.campaignId || "campaign"}_sessions.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2e3);
    }
    function exportPriorityCsv() {
      const table = document.getElementById("priorityDistrictsTable");
      if (!table) return;
      const rows = Array.from(table.querySelectorAll("tbody tr"));
      const header = ["District", "Sessions", "Farmers", "Acres", "Awareness", "Definite", "Avg score", "Action"];
      const csvRows = [header.join(",")];
      rows.forEach((tr) => {
        const cells = Array.from(tr.children).map((td) => td.textContent.trim().replace(/\n/g, " ").replace(/,/g, " "));
        csvRows.push(cells.join(","));
      });
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${state.campaignId || "campaign"}_priority.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2e3);
    }
    function bindTabEvents() {
      window.addEventListener("hashchange", syncTabFromHash);
      document.addEventListener("tabchange", (e) => {
        var _a;
        const tab = (_a = e.detail) == null ? void 0 : _a.tab;
        if (tab === "map") {
          setTimeout(ensureMapReady, 50);
          setTimeout(() => {
            var _a2;
            return (_a2 = state.map) == null ? void 0 : _a2.invalidateSize();
          }, 200);
        }
      });
    }
    async function boot() {
      var _a, _b, _c, _d;
      try {
        bindDrawer();
        bindLightbox();
        bindFeedback();
        bindTopControls();
        bindTabEvents();
        await loadCampaignRegistry();
        const req = qs();
        const id = req.get("campaign") || ((_a = state.campaigns[0]) == null ? void 0 : _a.id);
        renderCampaignSelect();
        await loadCampaign(id);
        syncTabFromHash();
        if (activeTabFromHash() === "map") {
          setTimeout(ensureMapReady, 50);
        }
        closeDrawer();
        (_b = $$("#drawerOverlay")) == null ? void 0 : _b.classList.add("hidden");
        (_c = $$("#sessionDrawer")) == null ? void 0 : _c.classList.add("hidden");
        (_d = $$("#lbClose")) == null ? void 0 : _d.addEventListener("click", closeLightbox);
        const heatBtn = document.getElementById("toggleHeat");
        if (heatBtn) {
          heatBtn.addEventListener("click", () => {
            if (!state.map || !state.heatLayer) return;
            if (state.map.hasLayer(state.heatLayer)) {
              state.map.removeLayer(state.heatLayer);
              heatBtn.textContent = "Show Heatmap";
            } else {
              state.heatLayer.addTo(state.map);
              heatBtn.textContent = "Hide Heatmap";
            }
          });
        }
        setMapStatus("Ready when opened", true);
      } catch (e) {
        console.error(e);
        setStatus(e.message || "Failed to load.", "bad");
      }
    }
    boot();
  })();
})();
