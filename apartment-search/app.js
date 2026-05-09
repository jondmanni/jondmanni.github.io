// Config
const API_BASE = "https://us-west1-gen-lang-client-0737991864.cloudfunctions.net/config-api";

function updateNextRun() {
  const el = document.getElementById('next-run');
  if (!el) return;
  const now = new Date();
  // Get current time components in PT
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(now).map(x => [x.type, x.value])
  );
  // Elapsed milliseconds since start of today (PT)
  const elapsedMs = (parseInt(p.hour) * 3600 + parseInt(p.minute) * 60 + parseInt(p.second)) * 1000;
  const startOfTodayPT = now.getTime() - elapsedMs;
  const todayRun = startOfTodayPT + 18 * 3600 * 1000;
  const targetMs = todayRun > now.getTime() ? todayRun : todayRun + 86400 * 1000;
  const diffMs = targetMs - now.getTime();
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  el.textContent = `next run: 6pm PT (in ${h > 0 ? `${h}h ${m}m` : `${m}m`})`;
}
updateNextRun();
setInterval(updateNextRun, 60000);
const ALLOWED_EMAILS = ["jondmanni@gmail.com"];

// LA-area zip codes to show on the map (superset covering the typical search area)
const LA_ZIPS_FOCUS = [
  90026, 90039, 90031, 90027, 90029, 90041, 90042, 90065,
  90012, 90013, 90014, 90015, 90017, 90019, 90020, 90028,
  90034, 90035, 90036, 90038, 90046, 90048, 90057, 90064,
  90066, 90068, 90071, 90089, 90090, 90094, 90095, 91201,
  91202, 91203, 91204, 91205, 91206, 91207, 91208
];

// State
let idToken = null;
let userEmail = null;
let map = null;
let zipLayers = {};      // zip -> L.GeoJSON layer
let selectedZips = new Set();
let excludeKeywords = [];
let requireKeywords = [];

// ─── Auth ─────────────────────────────────────────────────────────────────────

function onGoogleSignIn(response) {
  const payload = parseJwt(response.credential);
  const email = payload.email;

  if (!ALLOWED_EMAILS.includes(email)) {
    alert("This tool is only available to authorized users.");
    return;
  }

  idToken = response.credential;
  userEmail = email;

  document.getElementById("user-email").textContent = email;
  document.getElementById("user-info").classList.remove("hidden");
  document.querySelector(".g_id_signin").classList.add("hidden");
  document.getElementById("config-panel").classList.remove("hidden");

  loadConfig();
}

function signOut() {
  google.accounts.id.disableAutoSelect();
  idToken = null;
  userEmail = null;
  document.getElementById("user-info").classList.add("hidden");
  document.querySelector(".g_id_signin").classList.remove("hidden");
  document.getElementById("config-panel").classList.add("hidden");
}

function parseJwt(token) {
  const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(base64));
}

// ─── Config load / save ───────────────────────────────────────────────────────

async function loadConfig() {
  try {
    const resp = await fetch(`${API_BASE}/config?email=${encodeURIComponent(userEmail)}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    populateForm(data);
  } catch (e) {
    console.warn("Could not load config:", e);
    populateForm({});
  }
  initMap();
}

async function saveConfig() {
  const btn = document.getElementById("save-btn");
  const status = document.getElementById("save-status");
  btn.disabled = true;
  status.textContent = "Saving…";
  status.className = "";

  const config = readForm();
  try {
    const resp = await fetch(`${API_BASE}/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(config),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    status.textContent = "Saved!";
    status.className = "ok";
  } catch (e) {
    status.textContent = "Save failed: " + e.message;
    status.className = "err";
  } finally {
    btn.disabled = false;
    setTimeout(() => { status.textContent = ""; status.className = ""; }, 4000);
  }
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

function populateForm(data) {
  const c = data.criteria || {};
  setVal("min_rent", c.min_rent ?? 2400);
  setVal("max_rent", c.max_rent ?? 3000);
  setVal("min_sqft", c.min_sqft ?? "");
  setVal("min_highway_distance_ft", c.min_highway_distance_ft ?? 500);

  const bf = c.best_fit || {};
  setVal("best_fit_min_sqft", bf.min_sqft ?? "");
  document.getElementById("best_fit_require_mini_split").checked = bf.require_mini_split ?? false;

  selectedZips = new Set((c.allowed_zip_codes || []).map(String));
  renderZipTags();
  if (map) syncMapSelection();

  excludeKeywords.length = 0;
  excludeKeywords.push(...((c.title_keywords || {}).exclude || []));
  requireKeywords.length = 0;
  requireKeywords.push(...((c.title_keywords || {}).require_any || []));
  renderTags("exclude-tags", excludeKeywords, removeExclude);
  renderTags("require-tags", requireKeywords, removeRequire);
}

function readForm() {
  const minSqft = parseIntOrNull(getVal("min_sqft"));
  const bfMinSqft = parseIntOrNull(getVal("best_fit_min_sqft"));

  return {
    criteria: {
      min_rent: parseInt(getVal("min_rent")) || 0,
      max_rent: parseInt(getVal("max_rent")) || 0,
      min_sqft: minSqft,
      allowed_zip_codes: [...selectedZips].map(Number),
      min_highway_distance_ft: parseInt(getVal("min_highway_distance_ft")) || 500,
      best_fit: {
        min_sqft: bfMinSqft,
        require_mini_split: document.getElementById("best_fit_require_mini_split").checked,
      },
      title_keywords: {
        exclude: [...excludeKeywords],
        require_any: [...requireKeywords],
      },
    },
    email: { recipients: [userEmail] },
  };
}

function setVal(id, val) {
  document.getElementById(id).value = val ?? "";
}
function getVal(id) {
  return document.getElementById(id).value.trim();
}
function parseIntOrNull(s) {
  const n = parseInt(s);
  return isNaN(n) ? null : n;
}

// ─── Tag inputs ───────────────────────────────────────────────────────────────

function renderTags(containerId, list, removeFn) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  list.forEach((kw, i) => {
    const span = document.createElement("span");
    span.className = "tag";
    span.innerHTML = `${escHtml(kw)}<span class="remove" data-i="${i}" title="Remove">×</span>`;
    span.querySelector(".remove").addEventListener("click", () => removeFn(i));
    container.appendChild(span);
  });
}

function setupTagInput(inputId, tagsId, list, renderFn) {
  const input = document.getElementById(inputId);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = input.value.trim().replace(/,$/, "");
      if (val && !list.includes(val)) {
        list.push(val);
        renderFn();
      }
      input.value = "";
    } else if (e.key === "Backspace" && input.value === "" && list.length > 0) {
      list.pop();
      renderFn();
    }
  });
}

function removeExclude(i) { excludeKeywords.splice(i, 1); renderTags("exclude-tags", excludeKeywords, removeExclude); }
function removeRequire(i) { requireKeywords.splice(i, 1); renderTags("require-tags", requireKeywords, removeRequire); }

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Zip map ──────────────────────────────────────────────────────────────────

const ZIP_GEOJSON_URL =
  "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/ca_california_zip_codes_geo.min.json";

function initMap() {
  if (map) return;
  map = L.map("zip-map").setView([34.05, -118.25], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  fetch(ZIP_GEOJSON_URL)
    .then((r) => r.json())
    .then((geojson) => {
      const features = geojson.features.filter((f) => {
        const zip = String(f.properties.ZCTA5CE10 || f.properties.ZIP || "");
        return LA_ZIPS_FOCUS.includes(parseInt(zip));
      });

      features.forEach((f) => {
        const zip = String(f.properties.ZCTA5CE10 || f.properties.ZIP || "");
        const layer = L.geoJSON(f, { style: styleForZip(zip) });
        layer.on("click", () => toggleZip(zip));
        layer.bindTooltip(zip, { permanent: false, sticky: true });
        layer.addTo(map);
        zipLayers[zip] = layer;
      });

      if (selectedZips.size > 0) {
        // Fit to selected zips
        const selectedLayers = [...selectedZips].map((z) => zipLayers[z]).filter(Boolean);
        if (selectedLayers.length > 0) {
          const group = L.featureGroup(selectedLayers);
          map.fitBounds(group.getBounds().pad(0.3));
        }
      }
    })
    .catch((e) => console.error("Failed to load ZIP GeoJSON:", e));
}

function styleForZip(zip) {
  const sel = selectedZips.has(String(zip));
  return {
    fillColor: sel ? "#4285f4" : "#e8e8e8",
    fillOpacity: sel ? 0.5 : 0.2,
    color: sel ? "#1a73e8" : "#aaa",
    weight: sel ? 2 : 1,
  };
}

function toggleZip(zip) {
  zip = String(zip);
  if (selectedZips.has(zip)) {
    selectedZips.delete(zip);
  } else {
    selectedZips.add(zip);
  }
  if (zipLayers[zip]) {
    zipLayers[zip].setStyle(styleForZip(zip));
  }
  renderZipTags();
}

function syncMapSelection() {
  Object.entries(zipLayers).forEach(([zip, layer]) => {
    layer.setStyle(styleForZip(zip));
  });
}

function renderZipTags() {
  const container = document.getElementById("selected-zips");
  container.innerHTML = "";
  if (selectedZips.size === 0) {
    container.innerHTML = '<span style="color:#aaa;font-size:0.8rem">No zip codes selected — all zips allowed</span>';
    return;
  }
  [...selectedZips].sort().forEach((zip) => {
    const span = document.createElement("span");
    span.className = "zip-tag";
    span.innerHTML = `${zip}<span class="remove" title="Remove">×</span>`;
    span.querySelector(".remove").addEventListener("click", () => {
      toggleZip(zip);
    });
    container.appendChild(span);
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  renderZipTags();

  setupTagInput("exclude-input", "exclude-tags", excludeKeywords, () =>
    renderTags("exclude-tags", excludeKeywords, removeExclude)
  );
  setupTagInput("require-input", "require-tags", requireKeywords, () =>
    renderTags("require-tags", requireKeywords, removeRequire)
  );
});
