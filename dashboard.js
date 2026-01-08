(() => {
  'use strict';
  const v = "2026-01-08.2";
  console.info("[WheatCampaign] legacy dashboard.js loaded; forwarding to dashboard.v9.js", v);
  const s = document.createElement('script');
  s.defer = true;
  s.src = `dashboard.v9.js?v=${encodeURIComponent(v)}`;
  document.head.appendChild(s);
})();