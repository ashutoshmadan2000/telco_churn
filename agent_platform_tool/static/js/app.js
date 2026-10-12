let analyticsCache = null;
let indiaMap = null;
let heatLayer = null;
let markersLayer = null;
let cityMarkersMap = {};
let showHeat = true;
let selectedCityFilter = null;
let selectedNetFilter = 'ALL';
let expandedCity = null;
let selectedCategoryByCity = {};
let categorySubscribersCache = {};

const INDIA_CITY_COORDS = {
  'Surat': [21.1702, 72.8311],
  'Ahmedabad': [23.0225, 72.5714],
  'Nadiad': [22.6916, 72.8634],
  'Kadi': [23.2974, 72.3338],
  'Vadodara': [22.3072, 73.1812],
  'Bopal': [23.0338, 72.4633],
  'Godhra': [22.7788, 73.6143],
  'Vapi': [20.3893, 72.9106],
  'Junagadh': [21.5222, 70.4579],
  'Bhuj': [23.2420, 69.6669],
  'Anand': [22.5645, 72.9289],
  'Rajkot': [22.3039, 70.8022],
  'Kalol': [23.2464, 72.4959],
  'Billimora': [20.7696, 72.9613],
  'Jamnagar': [22.4707, 70.0577]
};

function formatSiteCategoryLabel(siteType) {
  if (!siteType || siteType === '-') return 'Standard / Direct (-)';
  return siteType;
}

function getCityAggregates() {
  if (!analyticsCache || !analyticsCache.heatmap) return [];
  const cityAgg = {};
  analyticsCache.heatmap.forEach(h => {
    const c = h.INSTALL_CITY;
    if (!cityAgg[c]) {
      cityAgg[c] = {
        city: c,
        subs: 0,
        highRisk: 0,
        medRisk: 0,
        lowRisk: 0,
        atRisk: 0,
        barred: 0,
        weightedChurn: 0,
        weightedOutages: 0,
        weightedHrs: 0,
        weightedRepeats: 0,
        arrRisk: 0,
        atRiskArr: 0,
        dominantCpe: h.dominant_cpe_model || 'Standard ONT',
        maxSiteSubs: 0,
        sites: []
      };
    }
    const subs = parseInt(h.total_subscribers || 0);
    const highRisk = parseInt(h.high_risk_subscribers || 0);
    const medRisk = parseInt(h.medium_risk_subscribers || 0);
    const lowRisk = parseInt(h.low_risk_subscribers || 0);
    const atRisk = parseInt(h.at_risk_subscribers || (highRisk + medRisk));
    const barred = parseInt(h.barred_subscribers || 0);
    const churn = parseFloat(h.historical_churn_rate_pct || 0);
    const out = parseFloat(h.avg_unplanned_outages || 0);
    const hrs = parseFloat(h.avg_outage_hours || 0);
    const rep = parseFloat(h.avg_repeat_complaints || 0);
    const sumChurnPct = h.sum_churn_prob_pct !== undefined ? parseFloat(h.sum_churn_prob_pct) : (subs * churn);
    const sumOut = h.sum_unplanned_outages !== undefined ? parseFloat(h.sum_unplanned_outages) : (subs * out);
    const sumHrs = h.sum_outage_hours !== undefined ? parseFloat(h.sum_outage_hours) : (subs * hrs);
    const sumRep = h.sum_repeat_complaints !== undefined ? parseFloat(h.sum_repeat_complaints) : (subs * rep);
    const arr = parseFloat(h.annual_revenue_at_risk_inr || 0);
    const atRiskArr = parseFloat(h.at_risk_arr_inr || 0);
    const cpe = h.dominant_cpe_model || 'Standard ONT';

    cityAgg[c].subs += subs;
    cityAgg[c].highRisk += highRisk;
    cityAgg[c].medRisk += medRisk;
    cityAgg[c].lowRisk += lowRisk;
    cityAgg[c].atRisk += atRisk;
    cityAgg[c].barred += barred;
    cityAgg[c].weightedChurn += sumChurnPct;
    cityAgg[c].weightedOutages += sumOut;
    cityAgg[c].weightedHrs += sumHrs;
    cityAgg[c].weightedRepeats += sumRep;
    cityAgg[c].arrRisk += arr;
    cityAgg[c].atRiskArr += atRiskArr;
    if (subs > cityAgg[c].maxSiteSubs) {
      cityAgg[c].maxSiteSubs = subs;
      cityAgg[c].dominantCpe = cpe;
    }
    cityAgg[c].sites.push({
      site: h.Site_Type || '-',
      siteLabel: formatSiteCategoryLabel(h.Site_Type),
      subs: subs,
      highRisk: highRisk,
      medRisk: medRisk,
      lowRisk: lowRisk,
      atRisk: atRisk,
      barred: barred,
      outages: out,
      hrs: hrs,
      repeats: rep,
      churn: churn,
      arrRisk: arr,
      atRiskArr: atRiskArr,
      cpe: cpe
    });
  });

  const result = Object.values(cityAgg).map(info => {
    const avgChurn = info.subs > 0 ? (info.weightedChurn / info.subs) : 0;
    const avgOutages = info.subs > 0 ? (info.weightedOutages / info.subs) : 0;
    const avgHrs = info.subs > 0 ? (info.weightedHrs / info.subs) : 0;
    const avgRepeats = info.subs > 0 ? (info.weightedRepeats / info.subs) : 0;
    info.sites.sort((a, b) => b.churn - a.churn);
    return {
      ...info,
      avgChurn,
      avgOutages,
      avgHrs,
      avgRepeats,
      worstSite: info.sites[0] || null
    };
  });

  result.sort((a, b) => b.avgChurn - a.avgChurn);
  return result;
}

function switchTab(tab) {
  document.getElementById('tabMap').style.display = tab === 'map' ? 'block' : 'none';
  document.getElementById('tabNet').style.display = tab === 'net' ? 'block' : 'none';
  document.getElementById('tabRoi').style.display = tab === 'roi' ? 'block' : 'none';
  document.getElementById('tabCall').style.display = tab === 'call' ? 'block' : 'none';
  document.getElementById('btnTabMap').className = 'tab-btn' + (tab === 'map' ? ' active' : '');
  document.getElementById('btnTabNet').className = 'tab-btn' + (tab === 'net' ? ' active' : '');
  document.getElementById('btnTabRoi').className = 'tab-btn' + (tab === 'roi' ? ' active' : '');
  document.getElementById('btnTabCall').className = 'tab-btn' + (tab === 'call' ? ' active' : '');
  if ((tab === 'roi' || tab === 'map' || tab === 'net') && !analyticsCache) {
    loadAnalytics();
  } else if (tab === 'map') {
    setTimeout(() => {
      initOrUpdateIndiaMap();
      if (indiaMap) indiaMap.invalidateSize();
    }, 100);
  }
}

async function loadAnalytics() {
  try {
    const res = await fetch('?mode=analytics&format=json');
    analyticsCache = await res.json();
    recalcRoiTable();
    recalcNetworkOps();
    renderHeatmapTable();
    initOrUpdateIndiaMap();
  } catch (e) {
    console.error('Failed to load analytics:', e);
  }
}

function setMapView(mode) {
  if (!indiaMap) return;
  document.getElementById('btnViewIndia').className = 'map-btn' + (mode === 'india' ? ' active' : '');
  document.getElementById('btnViewCircle').className = 'map-btn' + (mode === 'circle' ? ' active' : '');
  if (mode === 'india') {
    indiaMap.flyTo([22.5, 79.0], 5, { duration: 1.0 });
  } else {
    indiaMap.flyTo([21.9, 71.5], 7, { duration: 1.0 });
  }
}

function toggleHeatLayer() {
  if (!indiaMap || !heatLayer) return;
  showHeat = !showHeat;
  const btn = document.getElementById('btnToggleHeat');
  if (showHeat) {
    heatLayer.addTo(indiaMap);
    btn.className = 'map-btn active';
    btn.innerText = '🔥 Thermal Heat Layer: ON';
  } else {
    indiaMap.removeLayer(heatLayer);
    btn.className = 'map-btn';
    btn.innerText = '🔥 Thermal Heat Layer: OFF';
  }
}

function filterByCity(city) {
  selectedCityFilter = city;
  expandedCity = city || null;
  const badge = document.getElementById('cityFilterBadge');
  const resetBtn = document.getElementById('btnResetCity');
  if (city) {
    badge.innerText = `Filtered: ${city}`;
    badge.style.display = 'inline';
    resetBtn.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
    resetBtn.style.display = 'none';
  }
  renderHeatmapTable();
}

function focusCityOnMap(city) {
  const coords = INDIA_CITY_COORDS[city];
  if (!indiaMap || !coords) return;
  indiaMap.flyTo(coords, 9, { duration: 0.8 });
  if (cityMarkersMap[city]) {
    setTimeout(() => cityMarkersMap[city].openPopup(), 400);
  }
}

function initOrUpdateIndiaMap() {
  if (!analyticsCache || !analyticsCache.heatmap || typeof L === 'undefined') return;
  const mapEl = document.getElementById('indiaChurnMap');
  if (!mapEl || mapEl.offsetParent === null) return;

  if (!indiaMap) {
    indiaMap = L.map('indiaChurnMap').setView([22.2, 71.6], 7);

    const esriStreet = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri &mdash; National Geographic, Esri, DeLorme, NAVTEQ',
        maxZoom: 18
      }
    );
    const osmStandard = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }
    );

    esriStreet.addTo(indiaMap);
    L.control.layers({ 'India Street Map': esriStreet, 'OpenStreetMap': osmStandard }, null, { position: 'topright' }).addTo(indiaMap);

    // Overlay official India State Boundaries GeoJSON with Gujarat Telecom Circle highlighted
    fetch('https://gist.githubusercontent.com/jbrobst/56c13bbbf9d97d187fea01ca62ea5112/raw/e388c4cae20aa53cb5090210a42ebb9b765c0a36/india_states.geojson')
      .then(r => r.json())
      .then(geoData => {
        L.geoJSON(geoData, {
          style: feature => {
            const stName = (feature.properties && feature.properties.ST_NM) || '';
            const isGujarat = stName.toLowerCase().includes('gujarat');
            return {
              color: isGujarat ? '#E40000' : '#4A5568',
              weight: isGujarat ? 2.2 : 1.0,
              opacity: isGujarat ? 0.85 : 0.45,
              fillColor: isGujarat ? '#FCE8E6' : '#E2E8F0',
              fillOpacity: isGujarat ? 0.22 : 0.05
            };
          }
        }).addTo(indiaMap).bringToBack();
      })
      .catch(err => console.warn('India GeoJSON overlay error:', err));

    markersLayer = L.layerGroup().addTo(indiaMap);
  }

  markersLayer.clearLayers();
  cityMarkersMap = {};

  const cityList = getCityAggregates();
  const heatPoints = [];

  cityList.forEach(info => {
    const coords = INDIA_CITY_COORDS[info.city];
    if (!coords) return;

    const avgChurn = info.avgChurn;
    const avgOutages = info.avgOutages;
    const avgHrs = info.avgHrs;
    const avgRepeats = info.avgRepeats;

    const catMeta = getChurnCategoryMeta(avgChurn);
    const color = catMeta.color;
    const radius = Math.max(9, Math.min(28, 7 + Math.sqrt(info.subs / 400)));

    const intensity = Math.min(1.0, (avgChurn / 60.0) * (0.5 + Math.min(0.5, info.subs / 40000)));
    heatPoints.push([coords[0], coords[1], intensity]);

    const siteRowsHtml = info.sites.map(s => {
      const sMeta = getChurnCategoryMeta(s.churn);
      return `<div style="display:flex; justify-content:space-between; font-size:11px; padding:2px 0; border-bottom:1px dashed #eee;">
        <span>${s.siteLabel} (${s.subs.toLocaleString('en-IN')})</span>
        <strong style="color:${sMeta.color}">${s.churn.toFixed(1)}% (${sMeta.shortLabel})</strong>
      </div>`;
    }).join('');

    const popupHtml = `
      <div style="min-width: 230px; font-family: 'Roboto', sans-serif;">
        <div style="font-size: 15px; font-weight: 700; color: #202124; margin-bottom: 4px; display:flex; justify-content:space-between; align-items:center;">
          <span>📍 ${info.city}, India</span>
          <span style="background:${color}; color:#fff; padding:2px 7px; border-radius:10px; font-size:11px;">${avgChurn.toFixed(1)}% &bull; ${catMeta.shortLabel}</span>
        </div>
        <div style="font-size: 12px; color: #5F6368; margin-bottom: 8px;">
          Subscribers: <strong>${info.subs.toLocaleString('en-IN')}</strong> &bull; ARR at Risk: <strong style="color:#D93025;">${formatInr(info.arrRisk)}</strong>
        </div>
        <div style="background:#F8F9FA; padding:6px 8px; border-radius:6px; font-size:11px; margin-bottom:8px;">
          <div>⚡ Avg Outages: <strong>${avgOutages.toFixed(2)} (${avgHrs.toFixed(2)} hrs)</strong></div>
          <div>🔁 Avg Repeat Tickets: <strong>${avgRepeats.toFixed(2)}</strong></div>
          <div>📡 Dominant CPE: <strong style="font-family:monospace;">${info.dominantCpe}</strong></div>
        </div>
        <div style="font-size:11px; font-weight:600; color:#5F6368; margin-bottom:2px;">Last-Mile Categories (${info.sites.length}):</div>
        ${siteRowsHtml}
      </div>
    `;

    const marker = L.circleMarker(coords, {
      radius: radius,
      fillColor: color,
      color: '#FFFFFF',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.88
    });

    marker.bindPopup(popupHtml);
    marker.on('click', () => {
      filterByCity(info.city);
    });

    marker.addTo(markersLayer);
    cityMarkersMap[info.city] = marker;
  });

  if (heatLayer) {
    indiaMap.removeLayer(heatLayer);
  }
  if (typeof L.heatLayer === 'function') {
    heatLayer = L.heatLayer(heatPoints, {
      radius: 42,
      blur: 28,
      maxZoom: 9,
      gradient: { 0.3: '#38A169', 0.6: '#F9AB00', 0.85: '#E40000', 1.0: '#820000' }
    });
    if (showHeat) {
      heatLayer.addTo(indiaMap);
    }
  }
}

function getChurnCategoryMeta(churnPct) {
  const c = parseFloat(churnPct || 0);
  if (c >= 50.0) {
    return {
      tier: 'HIGH_RISK',
      label: 'High Risk (50%+)',
      shortLabel: 'High Risk',
      color: '#D93025',
      pillBg: 'var(--risk-high-bg)',
      pillColor: 'var(--risk-high)'
    };
  }
  if (c >= 30.0) {
    return {
      tier: 'MEDIUM_RISK',
      label: 'Medium Risk (30–50%)',
      shortLabel: 'Medium Risk',
      color: '#F9AB00',
      pillBg: 'var(--risk-med-bg)',
      pillColor: '#B06000'
    };
  }
  return {
    tier: 'LOW_RISK',
    label: 'Low Risk (0–30%)',
    shortLabel: 'Low Risk',
    color: '#188038',
    pillBg: 'var(--risk-low-bg)',
    pillColor: 'var(--risk-low)'
  };
}

function getRiskTierBandLabel(tier) {
  if (tier === 'HIGH_RISK') return 'High Risk (50%+)';
  if (tier === 'MEDIUM_RISK') return 'Medium Risk (30–50%)';
  return 'Low Risk (0–30%)';
}

function formatInr(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function recalcRoiTable() {
  if (!analyticsCache || !analyticsCache.roi_tiers) return;
  const saveRate = parseFloat(document.getElementById('rngSaveRate').value) / 100.0;
  const capScale = parseFloat(document.getElementById('rngCap').value) / 100.0;
  document.getElementById('lblSaveRate').innerText = Math.round(saveRate * 100) + '%';
  document.getElementById('lblCap').innerText = Math.round(capScale * 100) + '%';

  const tbody = document.getElementById('roiTableBody');
  tbody.innerHTML = '';
  let targetSubs = 0, targetLoss = 0, targetCost = 0, targetNet = 0;
  let allSubs = 0, allLoss = 0, weightedArpu = 0, weightedChurn = 0;
  let highSubs = 0, medSubs = 0, lowSubs = 0;

  analyticsCache.roi_tiers.forEach(r => {
    const subs = parseInt(r.subscriber_count || 0);
    const arpu = parseFloat(r.avg_monthly_arpu_inr || 0);
    const churnPct = parseFloat(r.avg_churn_probability_pct || 0);
    const sumArpu = r.sum_monthly_arpu_inr !== undefined ? parseFloat(r.sum_monthly_arpu_inr) : (subs * arpu);
    const sumChurnPct = r.sum_churn_prob_pct !== undefined ? parseFloat(r.sum_churn_prob_pct) : (subs * churnPct);
    const isLowRisk = r.RISK_TIER === 'LOW_RISK';
    const loss = parseFloat(r.expected_annual_churn_loss_inr || 0);
    const cost = isLowRisk ? 0 : parseFloat(r.total_retention_offer_cost_inr || 0) * capScale;
    const grossSaved = isLowRisk ? 0 : loss * saveRate;
    const net = isLowRisk ? 0 : grossSaved - cost;
    const mult = (!isLowRisk && cost > 0) ? (net / cost).toFixed(1) + 'x' : '—';

    allSubs += subs;
    allLoss += loss;
    weightedArpu += sumArpu;
    weightedChurn += sumChurnPct;

    if (r.RISK_TIER === 'HIGH_RISK') highSubs += subs;
    if (r.RISK_TIER === 'MEDIUM_RISK') medSubs += subs;
    if (r.RISK_TIER === 'LOW_RISK') lowSubs += subs;

    if (r.RISK_TIER === 'HIGH_RISK' || r.RISK_TIER === 'MEDIUM_RISK') {
      targetSubs += subs;
      targetLoss += loss;
      targetCost += cost;
      targetNet += net;
    }

    const bandLabel = getRiskTierBandLabel(r.RISK_TIER);
    const pillBg = r.RISK_TIER === 'HIGH_RISK' ? 'var(--risk-high-bg)' : (r.RISK_TIER === 'MEDIUM_RISK' ? 'var(--risk-med-bg)' : 'var(--risk-low-bg)');
    const pillColor = r.RISK_TIER === 'HIGH_RISK' ? 'var(--risk-high)' : (r.RISK_TIER === 'MEDIUM_RISK' ? '#B06000' : 'var(--risk-low)');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${r.RISK_TIER}</strong>
        <div style="margin-top:2px;"><span class="heat-pill" style="background:${pillBg}; color:${pillColor}; font-size:11px;">${bandLabel}</span></div>
      </td>
      <td><strong>${subs.toLocaleString('en-IN')}</strong></td>
      <td>₹${arpu}/mo</td>
      <td><span class="heat-pill" style="background:${pillBg}; color:${pillColor};">${churnPct}%</span></td>
      <td>${formatInr(loss)}</td>
      <td>${isLowRisk ? '<span style="color: var(--text-sub);">No Campaign (₹0)</span>' : formatInr(cost)}</td>
      <td style="color: ${isLowRisk ? 'var(--text-sub)' : 'var(--risk-low)'}; font-weight: ${isLowRisk ? '400' : '700'};">${isLowRisk ? '—' : formatInr(net)}</td>
      <td><strong>${mult}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  const combinedMult = targetCost > 0 ? (targetNet / targetCost).toFixed(1) + 'x' : '—';
  const totalAvgArpu = allSubs > 0 ? Math.round(weightedArpu / allSubs) : 0;
  const totalAvgChurn = allSubs > 0 ? (weightedChurn / allSubs).toFixed(1) : '0.0';
  const totalMeta = getChurnCategoryMeta(totalAvgChurn);

  const summaryTr = document.createElement('tr');
  summaryTr.style.background = '#F8FAFC';
  summaryTr.style.borderTop = '2px solid #CBD5E1';
  summaryTr.innerHTML = `
    <td>
      <strong>TOTAL (100K Scored Base)</strong>
      <div style="font-size:11px; color:var(--text-sub);">Targetable High + Med: ${targetSubs.toLocaleString('en-IN')}</div>
    </td>
    <td><strong>${allSubs.toLocaleString('en-IN')}</strong></td>
    <td><strong>₹${totalAvgArpu}/mo</strong></td>
    <td><span class="heat-pill" style="background:${totalMeta.pillBg}; color:${totalMeta.pillColor};">${totalAvgChurn}%</span></td>
    <td>
      <strong>${formatInr(allLoss)}</strong>
      <div style="font-size:11px; color:var(--text-sub);">High+Med: ${formatInr(targetLoss)}</div>
    </td>
    <td><strong>${formatInr(targetCost)}</strong></td>
    <td style="color:var(--risk-low); font-weight:700;">${formatInr(targetNet)}</td>
    <td><strong style="color:#1A73E8;">${combinedMult}</strong></td>
  `;
  tbody.appendChild(summaryTr);

  document.getElementById('roiTotalSubs').innerText = targetSubs.toLocaleString('en-IN');
  const roiSubsNoteEl = document.getElementById('roiSubsNote');
  if (roiSubsNoteEl) {
    roiSubsNoteEl.innerText = `${highSubs.toLocaleString('en-IN')} High • ${medSubs.toLocaleString('en-IN')} Med • ${lowSubs.toLocaleString('en-IN')} Low (${allSubs.toLocaleString('en-IN')} Total)`;
  }
  document.getElementById('roiExpectedLoss').innerText = formatInr(allLoss);
  const roiLossNoteEl = document.getElementById('roiLossNote');
  if (roiLossNoteEl) {
    roiLossNoteEl.innerText = `High + Med Risk ARR: ${formatInr(targetLoss)}`;
  }
  document.getElementById('roiOfferCost').innerText = formatInr(targetCost);
  document.getElementById('roiNetProtected').innerText = formatInr(targetNet);
  const roiMultNoteEl = document.getElementById('roiMultNote');
  if (roiMultNoteEl) {
    roiMultNoteEl.innerText = `Combined Campaign ROI: ${combinedMult}`;
  }
}

function setNetFilter(filter) {
  selectedNetFilter = filter;
  document.getElementById('btnNetFilterAll').className = 'map-btn' + (filter === 'ALL' ? ' active' : '');
  document.getElementById('btnNetFilterCpe').className = 'map-btn' + (filter === 'CPE_HARDWARE' ? ' active' : '');
  document.getElementById('btnNetFilterPlant').className = 'map-btn' + (filter === 'PLANT_ROLLOUT' ? ' active' : '');

  document.getElementById('netCpeSection').style.display = (filter === 'ALL' || filter === 'CPE_HARDWARE') ? 'block' : 'none';
  document.getElementById('netPlantSection').style.display = (filter === 'ALL' || filter === 'PLANT_ROLLOUT') ? 'block' : 'none';
  recalcNetworkOps();
}

function getRemediationBadge(remType) {
  if (remType === 'ONT Swap' || remType === 'Fiber Overbuild') {
    return `<span class="action-badge swap">${remType}</span>`;
  }
  if (remType === 'OTA Firmware Patch' || remType === 'Field CPE Audit') {
    return `<span class="action-badge ota">${remType}</span>`;
  }
  if (remType === 'Standard Monitoring' || remType === 'NONE') {
    return `<span class="action-badge ok">Standard Monitoring</span>`;
  }
  return `<span class="action-badge plant">${remType}</span>`;
}

function recalcNetworkOps() {
  if (!analyticsCache || !analyticsCache.network_ops) return;
  const mitigationEl = document.getElementById('rngNetMitigation');
  const costEl = document.getElementById('rngNetCost');
  if (!mitigationEl || !costEl) return;

  const mitigationRate = parseFloat(mitigationEl.value) / 100.0;
  const costScale = parseFloat(costEl.value) / 100.0;
  document.getElementById('lblNetMitigation').innerText = Math.round(mitigationRate * 100) + '%';
  document.getElementById('lblNetCost').innerText = Math.round(costScale * 100) + '%';

  const cpeBody = document.getElementById('netCpeTableBody');
  const plantBody = document.getElementById('netPlantTableBody');
  cpeBody.innerHTML = '';
  plantBody.innerHTML = '';

  let cpeSubs = 0, cpeArr = 0, cpeCost = 0, cpeTruck = 0;
  let cpeTotalSubs = 0, cpeTotalAtRisk = 0, cpeTotalHigh = 0, cpeTotalMed = 0, cpeTotalArr = 0, cpeTotalAtRiskArr = 0;
  let plantSubs = 0, plantArr = 0, plantCost = 0, plantTruck = 0;
  let plantTotalSubs = 0, plantTotalAtRisk = 0, plantTotalHigh = 0, plantTotalMed = 0, plantTotalArr = 0, plantTotalAtRiskArr = 0;

  analyticsCache.network_ops.forEach(r => {
    const churn = parseFloat(r.avg_churn_prob_pct || 0);
    const isActionable = r.remediation_type !== 'Standard Monitoring' && r.remediation_type !== 'NONE' && churn >= 30.0;
    const totalSubs = parseInt(r.total_subscribers || 0);
    const highSubs = parseInt(r.high_risk_subscribers || 0);
    const medSubs = parseInt(r.medium_risk_subscribers || 0);
    const atRiskSubs = parseInt(r.at_risk_subscribers || 0);
    const arrRisk = parseFloat(r.annual_revenue_at_risk_inr || 0);
    const atRiskArr = parseFloat(r.at_risk_arr_inr || arrRisk);
    const baseCost = parseFloat(r.estimated_remediation_cost_inr || 0);
    const cost = isActionable ? baseCost * costScale : 0;
    const truckSaved = isActionable ? parseFloat(r.avoided_truck_roll_savings_inr || 0) * mitigationRate : 0;
    const grossSaved = isActionable ? atRiskArr * mitigationRate : 0;
    const netBenefit = isActionable ? (grossSaved + truckSaved - cost) : 0;
    const roiMult = (isActionable && cost > 0) ? (netBenefit / cost).toFixed(1) + 'x' : '—';

    const catMeta = getChurnCategoryMeta(churn);
    const pillBg = catMeta.pillBg;
    const pillColor = catMeta.pillColor;
    const ftr = parseFloat(r.ftr_rate_pct || 0);
    const ftrColor = ftr < 35 ? 'var(--risk-high)' : (ftr < 60 ? '#B06000' : 'var(--risk-low)');

    if (r.category === 'CPE_HARDWARE') {
      cpeTotalSubs += totalSubs;
      cpeTotalAtRisk += atRiskSubs;
      cpeTotalHigh += highSubs;
      cpeTotalMed += medSubs;
      cpeTotalArr += arrRisk;
      cpeTotalAtRiskArr += atRiskArr;
      if (isActionable) {
        cpeSubs += atRiskSubs;
        cpeArr += atRiskArr;
        cpeCost += cost;
        cpeTruck += truckSaved;
      }
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family: monospace; font-weight: 700;">${r.segment_name}</td>
        <td style="font-size: 12px; color: var(--text-sub);">${r.top_cities || 'All Cities'}</td>
        <td>${totalSubs.toLocaleString('en-IN')} <span style="color:var(--text-sub); font-size:11px;">(${atRiskSubs.toLocaleString('en-IN')})</span></td>
        <td><strong>${r.avg_unplanned_outages}</strong> <span style="color:var(--text-sub); font-size:11px;">(${r.mttr_hours || 0}h MTTR)</span></td>
        <td><strong style="color:${parseFloat(r.avg_repeat_complaints) >= 0.6 ? 'var(--risk-high)' : 'inherit'};">${r.avg_repeat_complaints}</strong></td>
        <td><strong style="color:${ftrColor};">${ftr}%</strong></td>
        <td><span class="heat-pill" style="background:${pillBg}; color:${pillColor};" title="${catMeta.label}">${churn}%</span></td>
        <td><strong>${formatInr(arrRisk)}</strong><div style="font-size:10px; color:var(--text-sub);">High+Med: ${formatInr(atRiskArr)}</div></td>
        <td>${getRemediationBadge(r.remediation_type)}<div style="font-size:11px; color:var(--text);">${r.recommended_action}</div></td>
        <td>${isActionable ? formatInr(cost) : '<span style="color:var(--text-sub);">₹0</span>'}</td>
        <td style="color:${isActionable ? 'var(--risk-low)' : 'var(--text-sub)'}; font-weight:${isActionable ? '700' : '400'};">
          ${isActionable ? `${formatInr(netBenefit)} <span style="color:#1A73E8; font-size:11px;">(${roiMult})</span>` : '—'}
        </td>
      `;
      cpeBody.appendChild(tr);
    } else if (r.category === 'PLANT_ROLLOUT') {
      plantTotalSubs += totalSubs;
      plantTotalAtRisk += atRiskSubs;
      plantTotalHigh += highSubs;
      plantTotalMed += medSubs;
      plantTotalArr += arrRisk;
      plantTotalAtRiskArr += atRiskArr;
      if (isActionable) {
        plantSubs += atRiskSubs;
        plantArr += atRiskArr;
        plantCost += cost;
        plantTruck += truckSaved;
      }
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${r.segment_name}</strong></td>
        <td style="font-size: 12px; color: var(--text-sub);">${r.top_cities} <span style="font-size:11px;">(${r.impacted_pincodes} pins)</span></td>
        <td>${totalSubs.toLocaleString('en-IN')} <span style="color:var(--text-sub); font-size:11px;">(${atRiskSubs.toLocaleString('en-IN')})</span></td>
        <td><strong>${r.avg_unplanned_outages}</strong> unplan / ${r.avg_planned_outages} plan</td>
        <td>${r.mttr_hours || 0}h</td>
        <td>${r.avg_repeat_complaints} <span style="color:${ftrColor}; font-weight:600;">(${ftr}% FTR)</span></td>
        <td><span class="heat-pill" style="background:${pillBg}; color:${pillColor};" title="${catMeta.label}">${churn}%</span></td>
        <td><strong>${formatInr(arrRisk)}</strong><div style="font-size:10px; color:var(--text-sub);">High+Med: ${formatInr(atRiskArr)}</div></td>
        <td>${getRemediationBadge(r.remediation_type)}<div style="font-size:11px; color:var(--text);">${r.recommended_action}</div></td>
        <td>${isActionable ? formatInr(cost) : '<span style="color:var(--text-sub);">₹0</span>'}</td>
        <td style="color:${isActionable ? 'var(--risk-low)' : 'var(--text-sub)'}; font-weight:${isActionable ? '700' : '400'};">
          ${isActionable ? `${formatInr(netBenefit)} <span style="color:#1A73E8; font-size:11px;">(${roiMult})</span>` : '—'}
        </td>
      `;
      plantBody.appendChild(tr);
    }
  });

  const cpeNetTotal = (cpeArr * mitigationRate) + cpeTruck - cpeCost;
  const cpeRoiTotal = cpeCost > 0 ? (cpeNetTotal / cpeCost).toFixed(1) + 'x' : '—';
  const cpeSumTr = document.createElement('tr');
  cpeSumTr.style.background = '#F8FAFC';
  cpeSumTr.style.borderTop = '2px solid #CBD5E1';
  cpeSumTr.innerHTML = `
    <td colspan="2"><strong>TOTAL (All CPE / ONT Models)</strong></td>
    <td><strong>${cpeTotalSubs.toLocaleString('en-IN')}</strong> <span style="color:var(--text-sub); font-size:11px;">(${cpeTotalAtRisk.toLocaleString('en-IN')} High+Med)</span></td>
    <td colspan="4" style="font-size:11px; color:var(--text-sub);">Actionable ONT Faults: <strong>${cpeSubs.toLocaleString('en-IN')}</strong> High+Med Subs (${formatInr(cpeArr)} Fault ARR)</td>
    <td><strong>${formatInr(cpeTotalArr)}</strong></td>
    <td><span style="font-size:11px; color:var(--text-sub);">Active CPE Work Orders</span></td>
    <td><strong>${formatInr(cpeCost)}</strong></td>
    <td style="color:var(--risk-low); font-weight:700;">${formatInr(cpeNetTotal)} <span style="color:#1A73E8; font-size:11px;">(${cpeRoiTotal})</span></td>
  `;
  cpeBody.appendChild(cpeSumTr);

  const plantNetTotal = (plantArr * mitigationRate) + plantTruck - plantCost;
  const plantRoiTotal = plantCost > 0 ? (plantNetTotal / plantCost).toFixed(1) + 'x' : '—';
  const plantSumTr = document.createElement('tr');
  plantSumTr.style.background = '#F8FAFC';
  plantSumTr.style.borderTop = '2px solid #CBD5E1';
  plantSumTr.innerHTML = `
    <td colspan="2"><strong>TOTAL (All Last-Mile Plant Topologies)</strong></td>
    <td><strong>${plantTotalSubs.toLocaleString('en-IN')}</strong> <span style="color:var(--text-sub); font-size:11px;">(${plantTotalAtRisk.toLocaleString('en-IN')} High+Med)</span></td>
    <td colspan="4" style="font-size:11px; color:var(--text-sub);">Actionable Plant Faults: <strong>${plantSubs.toLocaleString('en-IN')}</strong> High+Med Subs (${formatInr(plantArr)} Fault ARR)</td>
    <td><strong>${formatInr(plantTotalArr)}</strong></td>
    <td><span style="font-size:11px; color:var(--text-sub);">Active Plant Work Orders</span></td>
    <td><strong>${formatInr(plantCost)}</strong></td>
    <td style="color:var(--risk-low); font-weight:700;">${formatInr(plantNetTotal)} <span style="color:#1A73E8; font-size:11px;">(${plantRoiTotal})</span></td>
  `;
  plantBody.appendChild(plantSumTr);

  const baseAtRiskSubs = plantTotalAtRisk || cpeTotalAtRisk;
  const baseTotalSubs = plantTotalSubs || cpeTotalSubs;
  const baseTotalArr = plantTotalArr || cpeTotalArr;
  const baseAtRiskArr = plantTotalAtRiskArr || cpeTotalAtRiskArr;

  let actionableArr = 0, kpiCost = 0, kpiTruck = 0, subNote = '', arrNote = '';
  if (selectedNetFilter === 'CPE_HARDWARE') {
    actionableArr = cpeArr;
    kpiCost = cpeCost;
    kpiTruck = cpeTruck;
    subNote = `${cpeSubs.toLocaleString('en-IN')} in Actionable CPE Work Orders (${baseTotalSubs.toLocaleString('en-IN')} Total Base)`;
    arrNote = `High+Med ARR: ${formatInr(baseAtRiskArr)} • Actionable CPE ARR: ${formatInr(cpeArr)}`;
  } else if (selectedNetFilter === 'PLANT_ROLLOUT') {
    actionableArr = plantArr;
    kpiCost = plantCost;
    kpiTruck = plantTruck;
    subNote = `${plantSubs.toLocaleString('en-IN')} in Actionable Plant Work Orders (${baseTotalSubs.toLocaleString('en-IN')} Total Base)`;
    arrNote = `High+Med ARR: ${formatInr(baseAtRiskArr)} • Actionable Plant ARR: ${formatInr(plantArr)}`;
  } else {
    actionableArr = plantArr;
    kpiCost = cpeCost + plantCost;
    kpiTruck = plantTruck;
    subNote = `${plantTotalHigh.toLocaleString('en-IN')} High • ${plantTotalMed.toLocaleString('en-IN')} Med (${plantSubs.toLocaleString('en-IN')} in Actionable Work Orders)`;
    arrNote = `High + Med Risk ARR: ${formatInr(baseAtRiskArr)} (Actionable: ${formatInr(plantArr)})`;
  }

  const kpiNet = (actionableArr * mitigationRate) + kpiTruck - kpiCost;
  const kpiRoi = kpiCost > 0 ? (kpiNet / kpiCost).toFixed(1) + 'x' : '—';

  document.getElementById('netAtRiskSubs').innerText = baseAtRiskSubs.toLocaleString('en-IN');
  document.getElementById('netSubNote').innerText = subNote;
  document.getElementById('netArrAtRisk').innerText = formatInr(baseTotalArr);
  const netArrNoteEl = document.getElementById('netArrNote');
  if (netArrNoteEl) netArrNoteEl.innerText = arrNote;
  document.getElementById('netRemediationCost').innerText = formatInr(kpiCost);
  document.getElementById('netTruckSavingsNote').innerText = `Avoided Repeat Truck Rolls: ${formatInr(kpiTruck)}`;
  document.getElementById('netNetProtected').innerText = formatInr(kpiNet);
  document.getElementById('netRoiMultNote').innerText = `Combined Engineering ROI: ${kpiRoi}`;
}

function updateDrilldownBreadcrumb() {
  const trailEl = document.getElementById('mapBreadcrumbText');
  const collapseBtn = document.getElementById('btnCollapseDrilldown');
  if (!trailEl) return;

  if (!expandedCity) {
    trailEl.innerHTML = `
      <span>🇮🇳 <strong>All 15 Cities (Consolidated View)</strong></span>
      <span class="breadcrumb-hint">— Click any City row below to expand its Last-Mile Category Breakdown &amp; Top 10 High-Churn Subscribers</span>
    `;
    if (collapseBtn) collapseBtn.style.display = 'none';
    return;
  }

  if (collapseBtn) collapseBtn.style.display = 'inline-block';
  const activeCat = selectedCategoryByCity[expandedCity];
  const catLabel = activeCat === 'ALL'
    ? `All Categories in ${expandedCity}`
    : (activeCat ? formatSiteCategoryLabel(activeCat) : null);

  if (!catLabel) {
    trailEl.innerHTML = `
      <a class="breadcrumb-link" onclick="collapseCityDrilldown()">🇮🇳 All 15 Cities</a>
      <span>▸</span>
      <span>📍 <strong>${expandedCity}</strong> (Category Breakdown)</span>
      <span class="breadcrumb-hint">— Select a category card below to view Top 10 High-Churn Subscribers</span>
    `;
  } else {
    trailEl.innerHTML = `
      <a class="breadcrumb-link" onclick="collapseCityDrilldown()">🇮🇳 All 15 Cities</a>
      <span>▸</span>
      <a class="breadcrumb-link" onclick="clearCityCategorySelection('${expandedCity}')">📍 ${expandedCity}</a>
      <span>▸</span>
      <span>🔌 <strong>${catLabel}</strong> (Top 10 High-Churn Subscribers)</span>
    `;
  }
}

function collapseCityDrilldown() {
  expandedCity = null;
  if (selectedCityFilter) {
    filterByCity(null);
  } else {
    renderHeatmapTable();
  }
}

function clearCityCategorySelection(city) {
  delete selectedCategoryByCity[city];
  renderHeatmapTable();
}

function toggleCityDrilldown(city) {
  if (expandedCity === city) {
    expandedCity = null;
  } else {
    expandedCity = city;
    focusCityOnMap(city);
  }
  renderHeatmapTable();
}

function selectCityCategory(city, siteType) {
  expandedCity = city;
  if (selectedCategoryByCity[city] === siteType) {
    delete selectedCategoryByCity[city];
    renderHeatmapTable();
    return;
  }
  selectedCategoryByCity[city] = siteType;
  renderHeatmapTable();
  loadCategorySubscribers(city, siteType);
}

function openCategoryInCtoTab(layerFilter) {
  switchTab('net');
  setNetFilter(layerFilter || 'ALL');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function inspectSubscriberInCareTab(customerId) {
  switchTab('call');
  setAndQuery(customerId);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadCategorySubscribers(city, siteType) {
  const safeId = city.replace(/[^a-zA-Z0-9]/g, '_');
  const panelEl = document.getElementById(`citySubPanel_${safeId}`);
  if (!panelEl) return;

  const cacheKey = `${city}::${siteType}`;
  if (categorySubscribersCache[cacheKey]) {
    renderCategorySubscribersTable(panelEl, city, siteType, categorySubscribersCache[cacheKey]);
    return;
  }

  const label = siteType === 'ALL' ? `All Categories in ${city}` : formatSiteCategoryLabel(siteType);
  panelEl.innerHTML = `
    <div class="subscriber-drilldown-panel" style="text-align:center; padding:24px;">
      <div class="spinner" style="width:24px; height:24px; margin-bottom:8px;"></div>
      <div style="font-size:13px; color:var(--text-sub);">Fetching Top 10 High-Churn Subscribers for <strong>${city} — ${label}</strong> from BigQuery...</div>
    </div>
  `;

  try {
    const url = `?mode=category_subscribers&city=${encodeURIComponent(city)}&site_type=${encodeURIComponent(siteType)}&limit=10&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    const subs = data.subscribers || [];
    categorySubscribersCache[cacheKey] = subs;
    renderCategorySubscribersTable(panelEl, city, siteType, subs);
  } catch (err) {
    panelEl.innerHTML = `
      <div class="subscriber-drilldown-panel" style="color:var(--risk-high); font-size:13px;">
        Failed to load subscriber details: ${err}
      </div>
    `;
  }
}

function renderCategorySubscribersTable(panelEl, city, siteType, subs) {
  const label = siteType === 'ALL' ? `All Categories in ${city}` : formatSiteCategoryLabel(siteType);
  if (!subs || subs.length === 0) {
    panelEl.innerHTML = `
      <div class="subscriber-drilldown-panel" style="font-size:13px; color:var(--text-sub);">
        No scored subscribers found for <strong>${city} (${label})</strong>.
      </div>
    `;
    return;
  }

  const rowsHtml = subs.map((s, idx) => {
    const churn = parseFloat(s.churn_prob_pct || 0);
    const catMeta = getChurnCategoryMeta(churn);
    const isLowSub = catMeta.tier === 'LOW_RISK' || s.RISK_TIER === 'LOW_RISK' || churn < 30.0;
    const isBarred = (s.DEL_STATUS || '').toLowerCase() === 'barred';
    const statusClass = isBarred ? 'barred' : 'active';
    const drivers = s.TOP_RISK_DRIVERS || 'Elevated Network / Usage Risk';
    const custId = s.CUSTOMER_IDENTIFER;

    return `
      <tr>
        <td style="font-weight:700; color:var(--text-sub);">#${idx + 1}</td>
        <td>
          <span class="sub-id-chip" onclick="inspectSubscriberInCareTab('${custId}')" title="Open in Tab 4 Frontline Care Agent View">
            🔍 ${custId}
          </span>
        </td>
        <td style="font-size:12px;">${formatSiteCategoryLabel(s.Site_Type)}</td>
        <td>
          <div style="font-weight:500; font-size:12px;">${s.BILL_PLAN_NAME || 'Standard Fiber'}</div>
          <div style="font-size:11px; color:var(--text-sub);">₹${s.RENTAL || 0}/mo</div>
        </td>
        <td><span class="status-pill ${statusClass}">${s.DEL_STATUS || 'Active'}</span></td>
        <td><strong>${s.UNPLANNED_OUTAGES || 0}</strong> <span style="font-size:11px; color:var(--text-sub);">(${s.UNPLANNED_OUTAGESS_HRS || 0}h)</span></td>
        <td><strong style="color:${parseInt(s.CUSTREPEATS || 0) > 0 ? 'var(--risk-high)' : 'inherit'};">${s.CUSTREPEATS || 0}</strong></td>
        <td style="font-family:monospace; font-size:11px;">${s.CPE_MODEL || 'Standard ONT'}</td>
        <td>
          <span class="heat-pill" style="background:${catMeta.pillBg}; color:${catMeta.pillColor};" title="${catMeta.label}">${churn.toFixed(1)}%</span>
          <div style="font-size:10px; color:var(--text-sub); margin-top:2px;">${catMeta.shortLabel}</div>
        </td>
        <td><strong>${formatInr(s.annual_revenue_at_risk_inr || 0)}</strong></td>
        <td style="font-size:11px; color:var(--text-sub); max-width:220px;">${drivers}</td>
        <td>
          <button class="btn-retain-action" onclick="inspectSubscriberInCareTab('${custId}')">
            ${isLowSub ? 'View Care Profile →' : 'Analyze &amp; Retain →'}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  panelEl.innerHTML = `
    <div class="subscriber-drilldown-panel">
      <div class="drilldown-header" style="margin-bottom:10px;">
        <div>
          <div class="drilldown-title">👥 Top ${subs.length} High-Churn Subscribers — ${city} (${label})</div>
          <div style="font-size:12px; color:var(--text-sub);">
            Ranked by BigQuery ML Churn Probability &amp; Annual Revenue at Risk. Click any Customer ID or <strong>Analyze &amp; Retain →</strong> to launch the Gemini Care Agent script in Tab 4.
          </div>
        </div>
        <button class="map-btn" onclick="clearCityCategorySelection('${city}')">✕ Close Subscriber List</button>
      </div>
      <div class="table-wrap">
        <table class="data-table" style="font-size:12px;">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Customer ID</th>
              <th>Category</th>
              <th>Plan &amp; ARPU</th>
              <th>Status</th>
              <th>Outages (Hrs)</th>
              <th>Repeats</th>
              <th>CPE / ONT</th>
              <th>Churn Prob</th>
              <th>ARR at Risk</th>
              <th>Primary Risk Drivers</th>
              <th>Frontline Action</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderHeatmapTable() {
  if (!analyticsCache || !analyticsCache.heatmap) return;
  const tbody = document.getElementById('mapTableBody');
  tbody.innerHTML = '';

  updateDrilldownBreadcrumb();

  const allCities = getCityAggregates();
  const cities = selectedCityFilter
    ? allCities.filter(c => c.city === selectedCityFilter)
    : allCities;

  let sumSubs = 0, sumHigh = 0, sumMed = 0, sumLow = 0, sumAtRisk = 0, sumBarred = 0;
  let sumArr = 0, sumAtRiskArr = 0, sumWeightedChurn = 0, sumWeightedOut = 0, sumWeightedHrs = 0, sumWeightedRep = 0;
  let sumCategories = 0;

  cities.forEach(cityInfo => {
    const churn = cityInfo.avgChurn;
    const catMeta = getChurnCategoryMeta(churn);
    const pillBg = catMeta.pillBg;
    const pillColor = catMeta.pillColor;
    const isExpanded = expandedCity === cityInfo.city;
    const catCount = cityInfo.sites.length;

    sumSubs += cityInfo.subs;
    sumHigh += cityInfo.highRisk;
    sumMed += cityInfo.medRisk;
    sumLow += cityInfo.lowRisk;
    sumAtRisk += cityInfo.atRisk;
    sumBarred += cityInfo.barred;
    sumArr += cityInfo.arrRisk;
    sumAtRiskArr += cityInfo.atRiskArr;
    sumWeightedChurn += cityInfo.weightedChurn;
    sumWeightedOut += cityInfo.weightedOutages;
    sumWeightedHrs += cityInfo.weightedHrs;
    sumWeightedRep += cityInfo.weightedRepeats;
    sumCategories += catCount;

    let categorySummaryHtml = `<span class="cat-count-badge">${catCount} ${catCount === 1 ? 'Category' : 'Categories'}</span>`;
    if (catCount > 1 && cityInfo.worstSite) {
      categorySummaryHtml += `<span style="font-size:11px; color:var(--text-sub);">Worst: <strong>${cityInfo.worstSite.siteLabel}</strong> (${cityInfo.worstSite.churn.toFixed(1)}%)</span>`;
    } else if (catCount === 1 && cityInfo.sites[0]) {
      categorySummaryHtml += `<span style="font-size:12px; color:var(--text);">${cityInfo.sites[0].siteLabel}</span>`;
    }

    const tr = document.createElement('tr');
    tr.className = 'city-master-row' + (isExpanded ? ' expanded' : '');
    tr.onclick = () => toggleCityDrilldown(cityInfo.city);
    tr.innerHTML = `
      <td>
        <span class="city-chevron">${isExpanded ? '▼' : '▶'}</span>
        <strong style="color: #1A73E8;">📍 ${cityInfo.city}</strong>
      </td>
      <td>${categorySummaryHtml}</td>
      <td>
        <strong>${cityInfo.subs.toLocaleString('en-IN')}</strong>
        <div style="font-size:11px; color:var(--text-sub);">${cityInfo.atRisk.toLocaleString('en-IN')} High+Med${cityInfo.barred > 0 ? ` • <span style="color:var(--risk-high);">${cityInfo.barred.toLocaleString('en-IN')} Barred</span>` : ''}</div>
      </td>
      <td>${cityInfo.avgOutages.toFixed(2)} (${cityInfo.avgHrs.toFixed(2)}h)</td>
      <td>${cityInfo.avgRepeats.toFixed(2)}</td>
      <td style="font-family: monospace; font-size: 12px;">${cityInfo.dominantCpe}</td>
      <td>
        <span class="heat-pill" style="background:${pillBg}; color:${pillColor};" title="${catMeta.label}">${churn.toFixed(1)}%</span>
        <div style="font-size:10px; color:var(--text-sub); margin-top:2px;">${catMeta.shortLabel}</div>
      </td>
      <td>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <strong>${formatInr(cityInfo.arrRisk)}</strong>
          <span style="font-size:11px; color:#1A73E8; font-weight:600;">${isExpanded ? 'Hide ▴' : 'Drill Down ▾'}</span>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    if (isExpanded) {
      const safeId = cityInfo.city.replace(/[^a-zA-Z0-9]/g, '_');
      const activeCat = selectedCategoryByCity[cityInfo.city] || null;

      const cardsHtml = cityInfo.sites.map(s => {
        const sMeta = getChurnCategoryMeta(s.churn);
        const sPillBg = sMeta.pillBg;
        const sPillColor = sMeta.pillColor;
        const sharePct = cityInfo.subs > 0 ? ((s.subs / cityInfo.subs) * 100).toFixed(1) : '0.0';
        const isCardActive = activeCat === s.site;
        const escapedSite = s.site.replace(/'/g, "\\'");

        return `
          <div class="category-card ${isCardActive ? 'active' : ''}" onclick="event.stopPropagation(); selectCityCategory('${cityInfo.city}', '${escapedSite}')">
            <div class="cat-card-top">
              <span class="cat-card-name">🔌 ${s.siteLabel}</span>
              <span class="heat-pill" style="background:${sPillBg}; color:${sPillColor};" title="${sMeta.label}">${s.churn.toFixed(1)}% (${sMeta.shortLabel})</span>
            </div>
            <div class="cat-card-metrics">
              <div>👥 <strong>${s.subs.toLocaleString('en-IN')}</strong> subs (${sharePct}% of city) • <strong>${s.atRisk.toLocaleString('en-IN')}</strong> High+Med</div>
              <div style="font-size:11px; color:var(--text-sub);">High (50%+): ${s.highRisk.toLocaleString('en-IN')} • Med (30–50%): ${s.medRisk.toLocaleString('en-IN')} • Low (0–30%): ${s.lowRisk.toLocaleString('en-IN')}</div>
              <div>💸 ARR at Risk: <strong style="color:var(--risk-high);">${formatInr(s.arrRisk)}</strong></div>
              <div>⚡ Avg Outages: <strong>${s.outages.toFixed(2)}</strong> (${s.hrs.toFixed(2)}h) • 🔁 Repeats: <strong>${s.repeats.toFixed(2)}</strong></div>
              <div>📡 Dominant CPE: <strong style="font-family:monospace;">${s.cpe}</strong></div>
            </div>
            <div class="cat-card-cta">
              <span>${isCardActive ? '▼ Viewing Top 10 Subscribers (Click to Close)' : '▶ View Top 10 High-Churn Subscribers'}</span>
              <span>10 Subs →</span>
            </div>
          </div>
        `;
      }).join('');

      const drillTr = document.createElement('tr');
      drillTr.className = 'city-drilldown-row';
      drillTr.innerHTML = `
        <td colspan="8">
          <div class="drilldown-header">
            <div>
              <div class="drilldown-title">📍 ${cityInfo.city} — Last-Mile Category Breakdown (${catCount} ${catCount === 1 ? 'Section' : 'Distinct Sections'})</div>
              <div style="font-size:12px; color:var(--text-sub);">
                Select any category card below to inspect the <strong>Top 10 High-Churn Subscribers</strong> in that segment (click the active card again to close), or jump to CTO Engineering Remediation.
              </div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="map-btn ${activeCat === 'ALL' ? 'active' : ''}" onclick="event.stopPropagation(); selectCityCategory('${cityInfo.city}', 'ALL')">
                👥 Top 10 Across All ${cityInfo.city}
              </button>
              <button class="map-btn" onclick="event.stopPropagation(); openCategoryInCtoTab('PLANT_ROLLOUT')">
                🔧 CTO Plant &amp; CPE Remediation →
              </button>
            </div>
          </div>
          <div class="category-cards-grid">
            ${cardsHtml}
          </div>
          <div id="citySubPanel_${safeId}">
            ${!activeCat ? `
              <div style="background:#FFFFFF; border:1px dashed #CBD5E1; border-radius:8px; padding:12px 16px; font-size:12px; color:var(--text-sub); text-align:center;">
                👆 Click any <strong>Category Section</strong> card above to load the <strong>Top 10 High-Churn Subscribers</strong> for that segment.
              </div>
            ` : ''}
          </div>
        </td>
      `;
      tbody.appendChild(drillTr);

      if (activeCat) {
        loadCategorySubscribers(cityInfo.city, activeCat);
      }
    }
  });

  const circleChurn = sumSubs > 0 ? (sumWeightedChurn / sumSubs) : 0;
  const circleOut = sumSubs > 0 ? (sumWeightedOut / sumSubs) : 0;
  const circleHrs = sumSubs > 0 ? (sumWeightedHrs / sumSubs) : 0;
  const circleRep = sumSubs > 0 ? (sumWeightedRep / sumSubs) : 0;
  const circleMeta = getChurnCategoryMeta(circleChurn);

  const summaryTr = document.createElement('tr');
  summaryTr.style.background = '#F8FAFC';
  summaryTr.style.borderTop = '2px solid #CBD5E1';
  summaryTr.innerHTML = `
    <td><strong>${selectedCityFilter ? `TOTAL (${selectedCityFilter})` : 'TOTAL (All 15 Cities • 100K Base)'}</strong></td>
    <td><span class="cat-count-badge">${sumCategories} Categories</span></td>
    <td>
      <strong>${sumSubs.toLocaleString('en-IN')}</strong>
      <div style="font-size:11px; color:var(--text-sub);">${sumAtRisk.toLocaleString('en-IN')} High+Med • ${sumBarred.toLocaleString('en-IN')} Barred</div>
    </td>
    <td><strong>${circleOut.toFixed(2)} (${circleHrs.toFixed(2)}h)</strong></td>
    <td><strong>${circleRep.toFixed(2)}</strong></td>
    <td style="font-family:monospace; font-size:12px;">All Deployed Models</td>
    <td>
      <span class="heat-pill" style="background:${circleMeta.pillBg}; color:${circleMeta.pillColor};">${circleChurn.toFixed(1)}%</span>
      <div style="font-size:10px; color:var(--text-sub); margin-top:2px;">${circleMeta.shortLabel}</div>
    </td>
    <td><strong>${formatInr(sumArr)}</strong></td>
  `;
  tbody.appendChild(summaryTr);

  const mapTotalSubsEl = document.getElementById('mapTotalSubs');
  if (mapTotalSubsEl) {
    mapTotalSubsEl.innerText = sumSubs.toLocaleString('en-IN');
    document.getElementById('mapSubsNote').innerText = selectedCityFilter
      ? `Filtered to ${selectedCityFilter} (${sumCategories} Categories)`
      : `Across ${cities.length} Cities • ${sumCategories} Categories`;
    document.getElementById('mapAtRiskSubs').innerText = sumAtRisk.toLocaleString('en-IN');
    document.getElementById('mapTierBreakdownNote').innerText = `${sumHigh.toLocaleString('en-IN')} High • ${sumMed.toLocaleString('en-IN')} Med • ${sumLow.toLocaleString('en-IN')} Low`;
    document.getElementById('mapTotalArr').innerText = formatInr(sumArr);
    document.getElementById('mapArrBreakdownNote').innerText = `High + Med Risk ARR: ${formatInr(sumAtRiskArr)}`;
    document.getElementById('mapAvgChurn').innerText = `${circleChurn.toFixed(1)}% (${circleMeta.shortLabel})`;
    document.getElementById('mapOutageNote').innerText = `${circleOut.toFixed(2)} Avg Outages (${circleHrs.toFixed(2)}h) • ${circleRep.toFixed(2)} Repeats`;
  }
}

function setAndQuery(id) {
  document.getElementById('custInput').value = id;
  lookupCustomer();
}

async function lookupCustomer() {
  const id = document.getElementById('custInput').value.trim();
  if (!id) return;

  document.getElementById('loading').style.display = 'block';
  document.getElementById('resultCard').style.display = 'none';

  try {
    const res = await fetch(`?customer_id=${id}&format=json`);
    const data = await res.json();
    renderResult(data);
  } catch (err) {
    alert('Error fetching customer data: ' + err);
  } finally {
    document.getElementById('loading').style.display = 'none';
  }
}

function renderResult(data) {
  if (data.error || data.status === 'NOT_FOUND') {
    alert(data.error || data.message);
    return;
  }

  const card = document.getElementById('resultCard');
  card.style.display = 'block';

  const prob = parseFloat(data.churn_prediction.churn_probability || 0);
  const pct = data.churn_prediction.churn_percentage || '0.0%';
  const pctVal = parseFloat(pct) || (prob * 100);
  const rawTier = data.churn_prediction.risk_tier || 'LOW_RISK';
  const isLowRisk = rawTier === 'LOW_RISK' || prob < 0.30 || pctVal < 30.0;
  const tier = isLowRisk ? 'LOW_RISK' : rawTier;
  const bandLabel = getRiskTierBandLabel(tier);

  const banner = document.getElementById('riskBanner');
  banner.className = 'risk-banner ' + (tier === 'HIGH_RISK' ? 'high' : (tier === 'MEDIUM_RISK' ? 'med' : 'low'));

  document.getElementById('riskScore').innerText = pct;
  document.getElementById('riskSummary').innerText = `Category: ${bandLabel} [${tier}] • ${data.churn_prediction.summary || ''}`;

  const roi = data.financial_roi || {};
  document.getElementById('valArrRisk').innerText = formatInr(roi.annual_revenue_at_risk_inr || 0);
  document.getElementById('valOfferCost').innerText = isLowRisk ? '₹0 (No Offer)' : formatInr(roi.margin_guarded_offer_cost_inr || 0);
  document.getElementById('valNetProtected').innerText = isLowRisk ? '—' : formatInr(roi.net_annual_margin_protected_inr || 0);
  document.getElementById('valRoiMult').innerText = isLowRisk ? '—' : (roi.roi_multiple || 0) + 'x';

  const p = data.customer_usage_profile;
  document.getElementById('valCustId').innerText = data.customer_id;
  document.getElementById('valCity').innerText = `${p.install_city || 'N/A'} (${p.site_type || 'Standard'})`;
  document.getElementById('valPlan').innerText = `${p.bill_plan_name} (${Math.round((p.plan_speed_mbps || 0)/1024)} Mbps)`;
  document.getElementById('valRental').innerText = `₹${p.monthly_rental_inr}/mo`;
  document.getElementById('valTech').innerText = `${p.technology} (${p.current_status})`;
  document.getElementById('valCpe').innerText = p.cpe_model || 'Standard ONT';
  document.getElementById('valAon').innerText = `${p.age_on_network_days} days`;
  document.getElementById('valUsage').innerText = `${p.current_usage_gb} GB`;
  document.getElementById('valOutages').innerText = `${p.unplanned_outages_count} outages (${p.outage_duration_hours} hrs)`;
  document.getElementById('valRepeats').innerText = `${p.repeat_tickets_count} repeat complaints`;

  const factorsDiv = document.getElementById('factorsList');
  factorsDiv.innerHTML = '';
  (data.key_contributing_factors || []).forEach(f => {
    const badgeClass = f.impact === 'CRITICAL_RISK' ? 'badge-critical' :
                       f.impact === 'HIGH_RISK' ? 'badge-high' :
                       f.impact === 'MODERATE_RISK' ? 'badge-moderate' : 'badge-shield';
    const item = document.createElement('div');
    item.className = 'factor-item';
    item.innerHTML = `
      <span class="factor-badge ${badgeClass}">${f.impact.replace('_', ' ')}</span>
      <div>
        <div style="font-weight: 500; font-size: 13px;">${f.feature} (weight: ${f.attribution_weight > 0 ? '+' : ''}${f.attribution_weight})</div>
        <div style="font-size: 13px; color: var(--text-sub);">${f.observation}</div>
      </div>
    `;
    factorsDiv.appendChild(item);
  });

  const offerSec = document.getElementById('recOfferSection');
  const recOfferEl = document.getElementById('recOffer');
  const talkBox = document.getElementById('talkTrackBox');
  if (isLowRisk || !roi.recommended_offer) {
    offerSec.style.display = 'none';
    if (recOfferEl) recOfferEl.innerText = '';
    talkBox.style.marginTop = '0px';
  } else {
    offerSec.style.display = 'block';
    talkBox.style.marginTop = '12px';
    if (recOfferEl) recOfferEl.innerText = roi.recommended_offer;
  }
  document.getElementById('talkTrack').innerText = `"${roi.agent_talk_track || ''}"`;
}

window.onload = () => {
  loadAnalytics();
  lookupCustomer();
};
