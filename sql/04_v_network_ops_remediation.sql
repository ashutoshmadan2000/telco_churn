-- CTO / Network Operations & Remediation Simulator View (100K Predicted Production Base)
-- Churn Categories: High Risk (50%+), Medium Risk (30-50%), Low Risk (0-30%).
-- Surfaces CPE/ONT hardware anomalies, last-mile fiber rollout vulnerabilities (OH vs UG, LCO vs Own, Copper+FTTH),
-- Mean Time To Restore (MTTR), First-Time Resolution (FTR %), and Engineering Remediation ROI.
CREATE OR REPLACE VIEW `telco-demos.telco_churn_data.v_network_ops_remediation` AS
WITH scored_subs AS (
  SELECT
    CUSTOMER_IDENTIFER,
    CHURN_PROBABILITY,
    CASE
      WHEN CHURN_PROBABILITY >= 0.50 THEN 'HIGH_RISK'
      WHEN CHURN_PROBABILITY >= 0.30 THEN 'MEDIUM_RISK'
      ELSE 'LOW_RISK'
    END AS RISK_TIER
  FROM `telco-demos.telco_churn_data.customer_churn_predictions`
  UNION ALL
  SELECT
    CUSTOMER_IDENTIFER,
    CHURN_PROBABILITY,
    CASE
      WHEN CHURN_PROBABILITY >= 0.50 THEN 'HIGH_RISK'
      WHEN CHURN_PROBABILITY >= 0.30 THEN 'MEDIUM_RISK'
      ELSE 'LOW_RISK'
    END AS RISK_TIER
  FROM `telco-demos.telco_churn_data.bulk_batch_predictions`
),
enriched AS (
  SELECT
    s.CUSTOMER_IDENTIFER,
    s.CHURN_PROBABILITY,
    s.RISK_TIER,
    m.RENTAL,
    m.INSTALL_CITY,
    m.PINCODE,
    IF(m.CPE_NAME IS NOT NULL, TRIM(CONCAT(m.CPE_NAME, ' ', IFNULL(m.MODELNAME, ''))), 'Standard ONT') AS cpe_model,
    IFNULL(NULLIF(m.FTTH_Site_Type, '-'), 'Standard FTTH') AS ftth_site_type,
    IFNULL(NULLIF(m.Rollout_Type, '-'), 'Standard') AS rollout_type,
    IFNULL(NULLIF(m.Site_Type, '-'), 'Shared Sites') AS site_type,
    IFNULL(NULLIF(m.RSU_Type, '-'), 'Standard') AS rsu_type,
    m.UNPLANNED_OUTAGES,
    m.UNPLANNED_OUTAGESS_HRS,
    m.PLANNED_OUTAGES,
    m.CUSTSRS,
    m.CUSTREPEATS,
    m.FTRS,
    m.SMARTSRS
  FROM scored_subs s
  INNER JOIN `telco-demos.telco_churn_data.telco_churn_200k_synthetic` m
    ON s.CUSTOMER_IDENTIFER = m.CUSTOMER_IDENTIFER
),
cpe_agg AS (
  SELECT
    'CPE_HARDWARE' AS category,
    cpe_model AS segment_name,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT INSTALL_CITY ORDER BY INSTALL_CITY LIMIT 3), ', ') AS top_cities,
    COUNT(*) AS total_subscribers,
    COUNTIF(RISK_TIER = 'HIGH_RISK') AS high_risk_subscribers,
    COUNTIF(RISK_TIER = 'MEDIUM_RISK') AS medium_risk_subscribers,
    COUNTIF(RISK_TIER = 'LOW_RISK') AS low_risk_subscribers,
    COUNTIF(RISK_TIER IN ('HIGH_RISK', 'MEDIUM_RISK')) AS at_risk_subscribers,
    COUNT(DISTINCT PINCODE) AS impacted_pincodes,
    ROUND(AVG(UNPLANNED_OUTAGES), 2) AS avg_unplanned_outages,
    ROUND(AVG(PLANNED_OUTAGES), 2) AS avg_planned_outages,
    ROUND(SAFE_DIVIDE(SUM(UNPLANNED_OUTAGESS_HRS), NULLIF(SUM(UNPLANNED_OUTAGES), 0)), 2) AS mttr_hours,
    ROUND(AVG(CUSTREPEATS), 2) AS avg_repeat_complaints,
    ROUND(LEAST(100.0, SAFE_DIVIDE(SUM(FTRS), NULLIF(SUM(CUSTSRS), 0)) * 100), 1) AS ftr_rate_pct,
    ROUND(AVG(CHURN_PROBABILITY) * 100, 1) AS avg_churn_prob_pct,
    ROUND(SUM(CHURN_PROBABILITY) * 100, 4) AS sum_churn_prob_pct,
    SUM(ROUND(RENTAL * 12 * CHURN_PROBABILITY, 0)) AS annual_revenue_at_risk_inr,
    SUM(IF(RISK_TIER IN ('HIGH_RISK', 'MEDIUM_RISK'), ROUND(RENTAL * 12 * CHURN_PROBABILITY, 0), 0)) AS at_risk_arr_inr,
    ROUND(SUM(IF(RISK_TIER IN ('HIGH_RISK', 'MEDIUM_RISK'), CUSTREPEATS * 350, 0)), 0) AS avoided_truck_roll_savings_inr
  FROM enriched
  WHERE cpe_model != ''
  GROUP BY cpe_model
),
plant_agg AS (
  SELECT
    'PLANT_ROLLOUT' AS category,
    CONCAT(ftth_site_type, ' • ', rollout_type, ' (', site_type, ')') AS segment_name,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT INSTALL_CITY ORDER BY INSTALL_CITY LIMIT 3), ', ') AS top_cities,
    COUNT(*) AS total_subscribers,
    COUNTIF(RISK_TIER = 'HIGH_RISK') AS high_risk_subscribers,
    COUNTIF(RISK_TIER = 'MEDIUM_RISK') AS medium_risk_subscribers,
    COUNTIF(RISK_TIER = 'LOW_RISK') AS low_risk_subscribers,
    COUNTIF(RISK_TIER IN ('HIGH_RISK', 'MEDIUM_RISK')) AS at_risk_subscribers,
    COUNT(DISTINCT PINCODE) AS impacted_pincodes,
    ROUND(AVG(UNPLANNED_OUTAGES), 2) AS avg_unplanned_outages,
    ROUND(AVG(PLANNED_OUTAGES), 2) AS avg_planned_outages,
    ROUND(SAFE_DIVIDE(SUM(UNPLANNED_OUTAGESS_HRS), NULLIF(SUM(UNPLANNED_OUTAGES), 0)), 2) AS mttr_hours,
    ROUND(AVG(CUSTREPEATS), 2) AS avg_repeat_complaints,
    ROUND(LEAST(100.0, SAFE_DIVIDE(SUM(FTRS), NULLIF(SUM(CUSTSRS), 0)) * 100), 1) AS ftr_rate_pct,
    ROUND(AVG(CHURN_PROBABILITY) * 100, 1) AS avg_churn_prob_pct,
    ROUND(SUM(CHURN_PROBABILITY) * 100, 4) AS sum_churn_prob_pct,
    SUM(ROUND(RENTAL * 12 * CHURN_PROBABILITY, 0)) AS annual_revenue_at_risk_inr,
    SUM(IF(RISK_TIER IN ('HIGH_RISK', 'MEDIUM_RISK'), ROUND(RENTAL * 12 * CHURN_PROBABILITY, 0), 0)) AS at_risk_arr_inr,
    ROUND(SUM(IF(RISK_TIER IN ('HIGH_RISK', 'MEDIUM_RISK'), CUSTREPEATS * 350, 0)), 0) AS avoided_truck_roll_savings_inr
  FROM enriched
  GROUP BY ftth_site_type, rollout_type, site_type
  HAVING COUNT(*) >= 1000
),
combined AS (
  SELECT * FROM cpe_agg
  UNION ALL
  SELECT * FROM plant_agg
)
SELECT
  category,
  segment_name,
  top_cities,
  total_subscribers,
  high_risk_subscribers,
  medium_risk_subscribers,
  low_risk_subscribers,
  at_risk_subscribers,
  impacted_pincodes,
  avg_unplanned_outages,
  avg_planned_outages,
  mttr_hours,
  avg_repeat_complaints,
  ftr_rate_pct,
  avg_churn_prob_pct,
  sum_churn_prob_pct,
  annual_revenue_at_risk_inr,
  at_risk_arr_inr,
  avoided_truck_roll_savings_inr,
  CASE
    WHEN avg_churn_prob_pct < 30.0 THEN 'Standard Monitoring'
    WHEN category = 'CPE_HARDWARE' AND (avg_unplanned_outages >= 0.50 OR avg_churn_prob_pct >= 50.0) THEN 'ONT Swap'
    WHEN category = 'CPE_HARDWARE' AND (avg_repeat_complaints >= 0.60 OR avg_churn_prob_pct >= 46.0) THEN 'OTA Firmware Patch'
    WHEN category = 'CPE_HARDWARE' AND ftr_rate_pct < 35.0 THEN 'Field CPE Audit'
    WHEN category = 'CPE_HARDWARE' THEN 'Standard Monitoring'
    WHEN category = 'PLANT_ROLLOUT' AND segment_name LIKE '%Copper+FTTH%' THEN 'Fiber Overbuild'
    WHEN category = 'PLANT_ROLLOUT' AND segment_name LIKE '%LCO Shared%' THEN 'LCO Audit'
    WHEN category = 'PLANT_ROLLOUT' AND (segment_name LIKE '%3rd Party%' OR segment_name LIKE '%ODC-SMART SPLIT%' OR avg_churn_prob_pct >= 46.0) THEN 'Cabinet Rebalance'
    WHEN category = 'PLANT_ROLLOUT' AND (avg_unplanned_outages >= 0.40 OR segment_name LIKE '%OH (%') THEN 'OH Hardening'
    ELSE 'Standard Monitoring'
  END AS remediation_type,
  CASE
    WHEN avg_churn_prob_pct < 30.0 AND category = 'CPE_HARDWARE' THEN
      'Standard Monitoring (₹0): Low-risk ONT benchmark (<30% churn) — routine NOC polling'
    WHEN avg_churn_prob_pct < 30.0 THEN
      'Standard Monitoring (₹0): Low-risk plant segment (<30% churn) — routine maintenance'
    WHEN category = 'CPE_HARDWARE' AND (avg_unplanned_outages >= 0.50 OR avg_churn_prob_pct >= 50.0) THEN
      'ONT Swap (₹850/sub): Replace high-outage / legacy ONT hardware'
    WHEN category = 'CPE_HARDWARE' AND (avg_repeat_complaints >= 0.60 OR avg_churn_prob_pct >= 46.0) THEN
      'OTA Firmware Patch (₹120/sub): Push remote TR-069 Wi-Fi stability fix'
    WHEN category = 'CPE_HARDWARE' AND ftr_rate_pct < 35.0 THEN
      'Field CPE Audit (₹350/sub): On-site optical power & drop-cable check'
    WHEN category = 'CPE_HARDWARE' THEN
      'Standard Monitoring (₹0): Healthy benchmark ONT — routine NOC polling'
    WHEN category = 'PLANT_ROLLOUT' AND segment_name LIKE '%Copper+FTTH%' THEN
      'Fiber Overbuild (₹650/sub): Migrate hybrid Copper+FTTH to FTTH Own'
    WHEN category = 'PLANT_ROLLOUT' AND segment_name LIKE '%LCO Shared%' THEN
      'LCO Audit (₹320/sub): Re-splice high-loss partner distribution nodes'
    WHEN category = 'PLANT_ROLLOUT' AND (segment_name LIKE '%3rd Party%' OR segment_name LIKE '%ODC-SMART SPLIT%' OR avg_churn_prob_pct >= 46.0) THEN
      'Cabinet Rebalance (₹400/sub): Re-balance ODC/RSU optical splitter budget'
    WHEN category = 'PLANT_ROLLOUT' AND (avg_unplanned_outages >= 0.40 OR segment_name LIKE '%OH (%') THEN
      'OH Hardening (₹380/sub): Aerial feeder weatherproofing & pole clearance'
    ELSE
      'Standard Monitoring (₹0): Healthy plant segment — routine maintenance'
  END AS recommended_action,
  CASE
    WHEN avg_churn_prob_pct < 30.0 THEN 0
    WHEN category = 'CPE_HARDWARE' AND (avg_unplanned_outages >= 0.50 OR avg_churn_prob_pct >= 50.0) THEN ROUND(at_risk_subscribers * 850, 0)
    WHEN category = 'CPE_HARDWARE' AND (avg_repeat_complaints >= 0.60 OR avg_churn_prob_pct >= 46.0) THEN ROUND(at_risk_subscribers * 120, 0)
    WHEN category = 'CPE_HARDWARE' AND ftr_rate_pct < 35.0 THEN ROUND(at_risk_subscribers * 350, 0)
    WHEN category = 'CPE_HARDWARE' THEN 0
    WHEN category = 'PLANT_ROLLOUT' AND segment_name LIKE '%Copper+FTTH%' THEN ROUND(at_risk_subscribers * 650, 0)
    WHEN category = 'PLANT_ROLLOUT' AND segment_name LIKE '%LCO Shared%' THEN ROUND(at_risk_subscribers * 320, 0)
    WHEN category = 'PLANT_ROLLOUT' AND (segment_name LIKE '%3rd Party%' OR segment_name LIKE '%ODC-SMART SPLIT%' OR avg_churn_prob_pct >= 46.0) THEN ROUND(at_risk_subscribers * 400, 0)
    WHEN category = 'PLANT_ROLLOUT' AND (avg_unplanned_outages >= 0.40 OR segment_name LIKE '%OH (%') THEN ROUND(at_risk_subscribers * 380, 0)
    ELSE 0
  END AS estimated_remediation_cost_inr
FROM combined
ORDER BY category, avg_churn_prob_pct DESC;
