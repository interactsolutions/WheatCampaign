/* =========================================================
   Wheat Campaign – Map Renderer (PATCHED)
   ========================================================= */

let map;
let mapLayerGroup;

/* ---------- SAFE COORDINATE RESOLVER ---------- */
function resolveLatLng(session) {
  if (!session || typeof session !== "object") return null;

  const candidates = [
    { lat: session.lat, lng: session.lng },
    { lat: session.latitude, lng: session.longitude },
    { lat: session.lat, lng: session.lon },
    { lat: session.coords?.lat, lng: session.coords?.lng },
    { lat: session.location?.lat, lng: session.location?.lng }
  ];

  for (const c of candidates) {
    const lat = Number(c.lat);
    const lng = Number(c.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return [lat, lng];
    }
  }
  return null;
}

/* ---------- INIT MAP ---------- */
function initMap() {
  map = L.map("map", {
    zoomControl: true,
    attributionControl: false
  }).setView([30.3753, 69.3451], 6); // Pakistan default

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18
  }).addTo(map);

  mapLayerGroup = L.layerGroup().addTo(map);
}

/* ---------- RENDER MARKERS ---------- */
function renderMap(sessions) {
  if (!map) initMap();

  mapLayerGroup.clearLayers();

  let count = 0;
  const bounds = [];

  sessions.forEach((s) => {
    const ll = resolveLatLng(s);
    if (!ll) return;

    count++;

    bounds.push(ll);

    L.circleMarker(ll, {
      radius: 7,
      color: "#22c55e",
      weight: 1,
      fillColor: "#22c55e",
      fillOpacity: 0.85
    })
      .bindTooltip(
        `
        <strong>Session ${s.sn ?? ""}</strong><br/>
        City: ${s.city ?? "-"}<br/>
        Spot: ${s.spot ?? "-"}<br/>
        Acres: ${s.acres ?? "-"}
        `,
        { sticky: true }
      )
      .addTo(mapLayerGroup);
  });

  console.log("🗺️ Map points rendered:", count);

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [40, 40] });
  }
}

/* ---------- LOAD DATA ---------- */
fetch("sessions.json")
  .then((r) => r.json())
  .then((sessions) => {
    window.__sessions = sessions; // debug
    renderMap(sessions);
  })
  .catch((err) => {
    console.error("Failed to load sessions.json", err);
  });
