"""BigQuery data access service for subscriber churn telemetry and analytics views."""

import os
import subprocess
from typing import Any, Dict, Optional

SUBSCRIBER_LOOKUP_QUERY = """
WITH pre_scored AS (
  SELECT 
    p.CUSTOMER_IDENTIFER,
    p.INSTALL_CITY,
    p.BILL_PLAN_NAME,
    p.RENTAL,
    p.PLAN_SPEED,
    p.TECHNOLOGY,
    p.DEL_STATUS,
    p.CHURN_PROBABILITY,
    CASE
      WHEN p.CHURN_PROBABILITY >= 0.50 THEN 'HIGH_RISK'
      WHEN p.CHURN_PROBABILITY >= 0.30 THEN 'MEDIUM_RISK'
      ELSE 'LOW_RISK'
    END AS RISK_TIER,
    p.TOP_RISK_DRIVERS,
    p.UNPLANNED_OUTAGES,
    p.UNPLANNED_OUTAGESS_HRS,
    p.CUSTSRS,
    p.CUSTREPEATS,
    p.USAGE,
    p.AON,
    m.Site_Type,
    IF(m.CPE_NAME IS NOT NULL, CONCAT(m.CPE_NAME, ' ', IFNULL(m.MODELNAME, '')), NULL) AS CPE_MODEL
  FROM `telco-demos.telco_churn_data.customer_churn_predictions` p
  LEFT JOIN `telco-demos.telco_churn_data.telco_churn_500k_synthetic` m
    ON p.CUSTOMER_IDENTIFER = m.CUSTOMER_IDENTIFER
  WHERE p.CUSTOMER_IDENTIFER = @cust_id
),
bulk_scored AS (
  SELECT 
    p.CUSTOMER_IDENTIFER,
    p.INSTALL_CITY,
    p.BILL_PLAN_NAME,
    p.RENTAL,
    p.PLAN_SPEED,
    p.TECHNOLOGY,
    p.DEL_STATUS,
    p.CHURN_PROBABILITY,
    CASE
      WHEN p.CHURN_PROBABILITY >= 0.50 THEN 'HIGH_RISK'
      WHEN p.CHURN_PROBABILITY >= 0.30 THEN 'MEDIUM_RISK'
      ELSE 'LOW_RISK'
    END AS RISK_TIER,
    p.KEY_RISK_DRIVERS AS TOP_RISK_DRIVERS,
    m.UNPLANNED_OUTAGES,
    m.UNPLANNED_OUTAGESS_HRS,
    m.CUSTSRS,
    m.CUSTREPEATS,
    p.USAGE,
    p.AON,
    m.Site_Type,
    IF(m.CPE_NAME IS NOT NULL, CONCAT(m.CPE_NAME, ' ', IFNULL(m.MODELNAME, '')), NULL) AS CPE_MODEL
  FROM `telco-demos.telco_churn_data.bulk_batch_predictions` p
  LEFT JOIN `telco-demos.telco_churn_data.telco_churn_500k_synthetic` m
    ON p.CUSTOMER_IDENTIFER = m.CUSTOMER_IDENTIFER
  WHERE p.CUSTOMER_IDENTIFER = @cust_id
),
on_the_fly AS (
  SELECT 
    CUSTOMER_IDENTIFER,
    INSTALL_CITY,
    BILL_PLAN_NAME,
    RENTAL,
    PLAN_SPEED,
    TECHNOLOGY,
    DEL_STATUS,
    (SELECT prob FROM UNNEST(predicted_CHURN_probs) WHERE CAST(label AS STRING) = 'true') AS CHURN_PROBABILITY,
    CASE 
      WHEN (SELECT prob FROM UNNEST(predicted_CHURN_probs) WHERE CAST(label AS STRING) = 'true') >= 0.50 THEN 'HIGH_RISK'
      WHEN (SELECT prob FROM UNNEST(predicted_CHURN_probs) WHERE CAST(label AS STRING) = 'true') >= 0.30 THEN 'MEDIUM_RISK'
      ELSE 'LOW_RISK'
    END AS RISK_TIER,
    'Live Model Prediction' AS TOP_RISK_DRIVERS,
    UNPLANNED_OUTAGES,
    UNPLANNED_OUTAGESS_HRS,
    CUSTSRS,
    CUSTREPEATS,
    USAGE,
    AON,
    Site_Type,
    IF(CPE_NAME IS NOT NULL, CONCAT(CPE_NAME, ' ', IFNULL(MODELNAME, '')), NULL) AS CPE_MODEL
  FROM ML.PREDICT(
    MODEL `telco-demos.telco_churn_data.churn_logreg_model`,
    (SELECT *, FALSE AS is_eval FROM `telco-demos.telco_churn_data.telco_churn_500k_synthetic` WHERE CUSTOMER_IDENTIFER = @cust_id)
  )
)
SELECT * FROM pre_scored
UNION ALL
SELECT * FROM bulk_scored WHERE NOT EXISTS (SELECT 1 FROM pre_scored)
UNION ALL
SELECT * FROM on_the_fly WHERE NOT EXISTS (SELECT 1 FROM pre_scored) AND NOT EXISTS (SELECT 1 FROM bulk_scored)
LIMIT 1;
"""


def get_bq_client() -> Any:
    """Create an authenticated BigQuery client for Cloud Run or local execution."""
    from google.cloud import bigquery
    from google.oauth2.credentials import Credentials

    project_id = os.environ.get("GCP_PROJECT", "telco-demos")
    if os.environ.get("K_SERVICE") or os.environ.get("FUNCTION_NAME"):
        return bigquery.Client(project=project_id)
    try:
        token = (
            subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True)
            .strip()
            .splitlines()[-1]
        )
        creds = Credentials(token)
        return bigquery.Client(project=project_id, credentials=creds)
    except Exception:
        return bigquery.Client(project=project_id)


def fetch_analytics_summary(client: Optional[Any] = None) -> Dict[str, Any]:
    """Fetch ROI tier summary, regional outage/churn heatmap, and network ops remediation rows from BigQuery views."""
    bq = client or get_bq_client()
    roi_rows = [
        dict(r.items())
        for r in bq.query(
            "SELECT * FROM `telco-demos.telco_churn_data.v_financial_roi_calculator` "
            "ORDER BY avg_churn_probability_pct DESC"
        ).result()
    ]
    map_rows = [
        dict(r.items())
        for r in bq.query(
            "SELECT * FROM `telco-demos.telco_churn_data.v_regional_outage_churn_heatmap` "
            "WHERE total_subscribers >= 500 "
            "ORDER BY historical_churn_rate_pct DESC"
        ).result()
    ]
    net_rows = [
        dict(r.items())
        for r in bq.query(
            "SELECT * FROM `telco-demos.telco_churn_data.v_network_ops_remediation` "
            "ORDER BY category, avg_churn_prob_pct DESC"
        ).result()
    ]
    return {"roi_tiers": roi_rows, "heatmap": map_rows, "network_ops": net_rows}


CATEGORY_SUBSCRIBERS_QUERY = """
WITH scored_subs AS (
  SELECT CUSTOMER_IDENTIFER, CHURN_PROBABILITY, TOP_RISK_DRIVERS
  FROM `telco-demos.telco_churn_data.customer_churn_predictions`
  UNION ALL
  SELECT CUSTOMER_IDENTIFER, CHURN_PROBABILITY, KEY_RISK_DRIVERS AS TOP_RISK_DRIVERS
  FROM `telco-demos.telco_churn_data.bulk_batch_predictions`
)
SELECT
  s.CUSTOMER_IDENTIFER,
  m.INSTALL_CITY,
  m.Site_Type,
  m.BILL_PLAN_NAME,
  m.RENTAL,
  m.DEL_STATUS,
  m.UNPLANNED_OUTAGES,
  ROUND(m.UNPLANNED_OUTAGESS_HRS, 1) AS UNPLANNED_OUTAGESS_HRS,
  m.CUSTREPEATS,
  IF(m.CPE_NAME IS NOT NULL, CONCAT(m.CPE_NAME, ' ', IFNULL(m.MODELNAME, '')), 'Standard ONT') AS CPE_MODEL,
  CASE
    WHEN s.CHURN_PROBABILITY < 0.30 THEN LEAST(29.9, ROUND(s.CHURN_PROBABILITY * 100, 1))
    WHEN s.CHURN_PROBABILITY < 0.50 THEN LEAST(49.9, ROUND(s.CHURN_PROBABILITY * 100, 1))
    ELSE ROUND(s.CHURN_PROBABILITY * 100, 1)
  END AS churn_prob_pct,
  CASE
    WHEN s.CHURN_PROBABILITY >= 0.50 THEN 'HIGH_RISK'
    WHEN s.CHURN_PROBABILITY >= 0.30 THEN 'MEDIUM_RISK'
    ELSE 'LOW_RISK'
  END AS RISK_TIER,
  ROUND(m.RENTAL * 12 * s.CHURN_PROBABILITY, 0) AS annual_revenue_at_risk_inr,
  s.TOP_RISK_DRIVERS
FROM scored_subs s
INNER JOIN `telco-demos.telco_churn_data.telco_churn_500k_synthetic` m
  ON s.CUSTOMER_IDENTIFER = m.CUSTOMER_IDENTIFER
WHERE m.INSTALL_CITY = @city
  AND (@site_type = 'ALL' OR m.Site_Type = @site_type)
ORDER BY s.CHURN_PROBABILITY DESC, annual_revenue_at_risk_inr DESC
LIMIT @row_limit;
"""


def fetch_category_subscribers(
    city: str,
    site_type: Optional[str] = None,
    limit: int = 10,
    client: Optional[Any] = None,
) -> list:
    """Fetch top high-churn subscribers for a given city and last-mile site category."""
    bq = client or get_bq_client()
    safe_limit = max(1, min(int(limit or 10), 25))
    normalized_site = site_type if (site_type and site_type.strip()) else "ALL"
    try:
        from google.cloud import bigquery

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("city", "STRING", city),
                bigquery.ScalarQueryParameter("site_type", "STRING", normalized_site),
                bigquery.ScalarQueryParameter("row_limit", "INT64", safe_limit),
            ]
        )
    except ImportError:
        job_config = {
            "city": city,
            "site_type": normalized_site,
            "row_limit": safe_limit,
        }
    return [
        dict(r.items())
        for r in bq.query(CATEGORY_SUBSCRIBERS_QUERY, job_config=job_config).result()
    ]


def fetch_subscriber_record(
    customer_id: str, client: Optional[Any] = None
) -> Optional[Dict[str, Any]]:
    """Query subscriber prediction and telemetry by customer_id across pre-scored, bulk, and live ML.PREDICT."""
    from google.cloud import bigquery

    bq = client or get_bq_client()
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("cust_id", "STRING", customer_id)
        ]
    )
    rows = list(bq.query(SUBSCRIBER_LOOKUP_QUERY, job_config=job_config).result())
    if not rows:
        return None
    return dict(rows[0].items())

