-- Gemini Enterprise Retention Copilot View (100K Predicted Production Base)
-- Churn Categories: High Risk (50%+), Medium Risk (30-50%), Low Risk (0-30%).
-- Strictly omits Gemini AI Margin-Safe Retention Offers (NULL) for LOW_RISK (< 30%) subscribers.
CREATE OR REPLACE VIEW `telco-demos.telco_churn_data.v_gemini_retention_copilot` AS
WITH all_predictions AS (
  SELECT
    p.CUSTOMER_IDENTIFER,
    p.INSTALL_CITY,
    p.BILL_PLAN_NAME,
    p.RENTAL,
    p.PLAN_SPEED,
    p.DEL_STATUS,
    p.CHURN_PROBABILITY,
    p.TOP_RISK_DRIVERS,
    p.UNPLANNED_OUTAGES,
    p.UNPLANNED_OUTAGESS_HRS,
    p.CUSTREPEATS,
    p.USAGE
  FROM `telco-demos.telco_churn_data.customer_churn_predictions` p
  UNION ALL
  SELECT
    b.CUSTOMER_IDENTIFER,
    b.INSTALL_CITY,
    b.BILL_PLAN_NAME,
    b.RENTAL,
    b.PLAN_SPEED,
    b.DEL_STATUS,
    b.CHURN_PROBABILITY,
    b.KEY_RISK_DRIVERS AS TOP_RISK_DRIVERS,
    m.UNPLANNED_OUTAGES,
    m.UNPLANNED_OUTAGESS_HRS,
    m.CUSTREPEATS,
    b.USAGE
  FROM `telco-demos.telco_churn_data.bulk_batch_predictions` b
  LEFT JOIN `telco-demos.telco_churn_data.telco_churn_200k_synthetic` m
    ON b.CUSTOMER_IDENTIFER = m.CUSTOMER_IDENTIFER
),
scored AS (
  SELECT
    *,
    CASE
      WHEN CHURN_PROBABILITY >= 0.50 THEN 'HIGH_RISK'
      WHEN CHURN_PROBABILITY >= 0.30 THEN 'MEDIUM_RISK'
      ELSE 'LOW_RISK'
    END AS ALIGNED_RISK_TIER,
    CASE
      WHEN CHURN_PROBABILITY < 0.30 THEN LEAST(29.9, ROUND(CHURN_PROBABILITY * 100, 1))
      WHEN CHURN_PROBABILITY < 0.50 THEN LEAST(49.9, ROUND(CHURN_PROBABILITY * 100, 1))
      ELSE ROUND(CHURN_PROBABILITY * 100, 1)
    END AS DISPLAY_CHURN_PCT
  FROM all_predictions
)
SELECT 
  CUSTOMER_IDENTIFER,
  INSTALL_CITY,
  BILL_PLAN_NAME,
  CONCAT('₹', CAST(RENTAL AS STRING), '/mo') AS MONTHLY_RENTAL,
  RENTAL AS RENTAL_INR,
  PLAN_SPEED,
  CONCAT(CAST(DISPLAY_CHURN_PCT AS STRING), '%') AS CHURN_RISK_SCORE,
  CHURN_PROBABILITY,
  ALIGNED_RISK_TIER AS RISK_TIER,
  TOP_RISK_DRIVERS,
  ROUND(RENTAL * 12 * CHURN_PROBABILITY, 0) AS ANNUAL_REVENUE_AT_RISK_INR,
  CASE 
    WHEN ALIGNED_RISK_TIER = 'LOW_RISK' THEN 0
    WHEN DEL_STATUS = 'Barred' THEN ROUND(RENTAL * 0.25, 0)
    WHEN UNPLANNED_OUTAGES >= 3 THEN LEAST(200, ROUND(RENTAL * 0.25, 0))
    WHEN CUSTREPEATS >= 1 THEN ROUND(RENTAL * 0.20, 0)
    WHEN USAGE < 100 THEN ROUND(RENTAL * 0.10, 0)
    ELSE ROUND(RENTAL * 0.10, 0)
  END AS ESTIMATED_OFFER_COST_INR,
  CASE 
    WHEN ALIGNED_RISK_TIER = 'LOW_RISK' THEN NULL
    WHEN DEL_STATUS = 'Barred' THEN 
      'Commercial Settlement: Offer 50% waiver on overdue late fees + split remaining balance into 3 equal monthly installments to immediately restore line.'
    WHEN UNPLANNED_OUTAGES >= 3 THEN 
      CONCAT('Network Compensation: Apply ₹', CAST(LEAST(200, CAST(ROUND(RENTAL * 0.25, 0) AS INT64)) AS STRING), ' margin-guarded outage credit + complimentary 3-month speed upgrade to ', CAST(PLAN_SPEED * 2 AS STRING), ' Kbps.')
    WHEN CUSTREPEATS >= 1 THEN 
      'Quality of Service Escalation: Dispatch senior fiber technician for premises line & CPE check within 4 hours + 1 month 20% rental rebate.'
    WHEN USAGE < 100 THEN 
      'Engagement Bundle: Free 30-day trial of Premium OTT Streaming Pack (Disney+ / Netflix) to drive broadband utilization.'
    ELSE 
      'Loyalty Appreciation: 10% annual loyalty renewal discount on current plan.'
  END AS RECOMMENDED_RETENTION_BUNDLE,
  CASE 
    WHEN ALIGNED_RISK_TIER = 'LOW_RISK' THEN 
      'Hello, thank you for being a valued Airtel subscriber! I can see your fiber connection and account are in great standing. How may I assist you with your service today?'
    WHEN DEL_STATUS = 'Barred' THEN 
      'Hello, I noticed your account has a pending balance hold. We value your relationship and would love to keep you connected—I can immediately waive 50% of the late charges if we activate a convenient 3-month installment plan today.'
    WHEN UNPLANNED_OUTAGES >= 3 THEN 
      CONCAT('Hello, I can see you experienced ', CAST(UNPLANNED_OUTAGES AS STRING), ' network interruptions recently totaling ', CAST(ROUND(UNPLANNED_OUTAGESS_HRS, 1) AS STRING), ' hours. We sincerely apologize for this frustration. To make this right, I have already applied a ₹', CAST(LEAST(200, CAST(ROUND(RENTAL * 0.25, 0) AS INT64)) AS STRING), ' goodwill credit to your bill and doubled your plan speed at no extra charge.')
    WHEN CUSTREPEATS >= 1 THEN
      CONCAT('Hello, I noticed you had to contact us ', CAST(CUSTREPEATS AS STRING), ' times recently without a permanent resolution. I am taking personal ownership of your line—I have scheduled a senior field engineer visit within 4 hours and applied a 20% rebate on this month\'s rental.')
    WHEN USAGE < 100 THEN
      'Hello! As a valued subscriber, we noticed you have not been utilizing your full fiber bandwidth lately, so we would love to activate a complimentary 30-day Premium OTT Streaming bundle on your account today.'
    ELSE 
      'Hello, thank you for being a valued subscriber. We are conducting a proactive service check-in and can offer a 10% loyalty discount when you renew your current broadband plan.'
  END AS AGENT_TALK_TRACK
FROM scored;
