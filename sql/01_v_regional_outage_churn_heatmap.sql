-- Regional Outage & Churn Heatmap View (100K Predicted Production Base)
-- Churn Categories: High Risk (50%+), Medium Risk (30-50%), Low Risk (0-30%).
CREATE OR REPLACE VIEW `telco-demos.telco_churn_data.v_regional_outage_churn_heatmap` AS
WITH scored_subs AS (
  SELECT CUSTOMER_IDENTIFER, CHURN_PROBABILITY
  FROM `telco-demos.telco_churn_data.customer_churn_predictions`
  UNION ALL
  SELECT CUSTOMER_IDENTIFER, CHURN_PROBABILITY
  FROM `telco-demos.telco_churn_data.bulk_batch_predictions`
)
SELECT
  m.INSTALL_CITY,
  m.Site_Type,
  COUNT(*) AS total_subscribers,
  COUNTIF(s.CHURN_PROBABILITY >= 0.50) AS high_risk_subscribers,
  COUNTIF(s.CHURN_PROBABILITY >= 0.30 AND s.CHURN_PROBABILITY < 0.50) AS medium_risk_subscribers,
  COUNTIF(s.CHURN_PROBABILITY < 0.30) AS low_risk_subscribers,
  COUNTIF(s.CHURN_PROBABILITY >= 0.30) AS at_risk_subscribers,
  COUNTIF(m.DEL_STATUS = 'Barred') AS barred_subscribers,
  ROUND(AVG(m.UNPLANNED_OUTAGES), 2) AS avg_unplanned_outages,
  SUM(m.UNPLANNED_OUTAGES) AS sum_unplanned_outages,
  ROUND(AVG(m.UNPLANNED_OUTAGESS_HRS), 2) AS avg_outage_hours,
  ROUND(SUM(m.UNPLANNED_OUTAGESS_HRS), 4) AS sum_outage_hours,
  ROUND(AVG(m.CUSTREPEATS), 2) AS avg_repeat_complaints,
  SUM(m.CUSTREPEATS) AS sum_repeat_complaints,
  ROUND(AVG(s.CHURN_PROBABILITY) * 100, 1) AS historical_churn_rate_pct,
  ROUND(SUM(s.CHURN_PROBABILITY) * 100, 4) AS sum_churn_prob_pct,
  SUM(m.RENTAL * 12) AS total_annual_arr_inr,
  SUM(ROUND(m.RENTAL * 12 * s.CHURN_PROBABILITY, 0)) AS annual_revenue_at_risk_inr,
  SUM(IF(s.CHURN_PROBABILITY >= 0.30, ROUND(m.RENTAL * 12 * s.CHURN_PROBABILITY, 0), 0)) AS at_risk_arr_inr,
  APPROX_TOP_COUNT(
    IF(m.CPE_NAME IS NOT NULL, CONCAT(m.CPE_NAME, ' ', IFNULL(m.MODELNAME, '')), 'Standard ONT'),
    1
  )[OFFSET(0)].value AS dominant_cpe_model
FROM scored_subs s
INNER JOIN `telco-demos.telco_churn_data.telco_churn_500k_synthetic` m
  ON s.CUSTOMER_IDENTIFER = m.CUSTOMER_IDENTIFER
GROUP BY m.INSTALL_CITY, m.Site_Type;
