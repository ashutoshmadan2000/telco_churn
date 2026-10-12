-- Financial ROI & Margin Protection Calculator View (100K Predicted Production Base)
-- Churn Categories: High Risk (50%+), Medium Risk (30-50%), Low Risk (0-30%).
-- Excludes campaigns and offers for LOW_RISK subscribers.
CREATE OR REPLACE VIEW `telco-demos.telco_churn_data.v_financial_roi_calculator` AS
WITH all_scored AS (
  SELECT
    CUSTOMER_IDENTIFER,
    BATCH_ID,
    CHURN_PROBABILITY,
    CASE
      WHEN CHURN_PROBABILITY >= 0.50 THEN 'HIGH_RISK'
      WHEN CHURN_PROBABILITY >= 0.30 THEN 'MEDIUM_RISK'
      ELSE 'LOW_RISK'
    END AS RISK_TIER,
    RENTAL,
    DEL_STATUS,
    UNPLANNED_OUTAGES,
    CUSTREPEATS,
    USAGE
  FROM `telco-demos.telco_churn_data.customer_churn_predictions`
  UNION ALL
  SELECT
    p.CUSTOMER_IDENTIFER,
    p.BATCH_ID,
    p.CHURN_PROBABILITY,
    CASE
      WHEN p.CHURN_PROBABILITY >= 0.50 THEN 'HIGH_RISK'
      WHEN p.CHURN_PROBABILITY >= 0.30 THEN 'MEDIUM_RISK'
      ELSE 'LOW_RISK'
    END AS RISK_TIER,
    p.RENTAL,
    p.DEL_STATUS,
    m.UNPLANNED_OUTAGES,
    m.CUSTREPEATS,
    p.USAGE
  FROM `telco-demos.telco_churn_data.bulk_batch_predictions` p
  LEFT JOIN `telco-demos.telco_churn_data.telco_churn_500k_synthetic` m
    ON p.CUSTOMER_IDENTIFER = m.CUSTOMER_IDENTIFER
)
SELECT
  RISK_TIER,
  COUNT(*) AS subscriber_count,
  ROUND(AVG(RENTAL), 0) AS avg_monthly_arpu_inr,
  SUM(RENTAL) AS sum_monthly_arpu_inr,
  SUM(RENTAL * 12) AS total_annual_arr_inr,
  ROUND(AVG(CHURN_PROBABILITY) * 100, 1) AS avg_churn_probability_pct,
  ROUND(SUM(CHURN_PROBABILITY) * 100, 4) AS sum_churn_prob_pct,
  SUM(ROUND(RENTAL * 12 * CHURN_PROBABILITY, 0)) AS expected_annual_churn_loss_inr,
  IF(
    RISK_TIER = 'LOW_RISK',
    0,
    SUM(
      CASE
        WHEN DEL_STATUS = 'Barred' THEN ROUND(RENTAL * 0.25, 0)
        WHEN UNPLANNED_OUTAGES >= 3 THEN LEAST(200, ROUND(RENTAL * 0.25, 0))
        WHEN CUSTREPEATS >= 1 THEN ROUND(RENTAL * 0.20, 0)
        ELSE ROUND(RENTAL * 0.10, 0)
      END
    )
  ) AS total_retention_offer_cost_inr,
  IF(
    RISK_TIER = 'LOW_RISK',
    0,
    ROUND(SUM(ROUND(RENTAL * 12 * CHURN_PROBABILITY, 0)) * 0.45, 0)
  ) AS gross_revenue_saved_at_45pct_save_rate_inr,
  IF(
    RISK_TIER = 'LOW_RISK',
    0,
    ROUND(
      SUM(ROUND(RENTAL * 12 * CHURN_PROBABILITY, 0)) * 0.45 - SUM(
        CASE
          WHEN DEL_STATUS = 'Barred' THEN ROUND(RENTAL * 0.25, 0)
          WHEN UNPLANNED_OUTAGES >= 3 THEN LEAST(200, ROUND(RENTAL * 0.25, 0))
          WHEN CUSTREPEATS >= 1 THEN ROUND(RENTAL * 0.20, 0)
          ELSE ROUND(RENTAL * 0.10, 0)
        END
      ),
      0
    )
  ) AS net_margin_protected_inr
FROM all_scored
GROUP BY RISK_TIER
ORDER BY avg_churn_probability_pct DESC;
