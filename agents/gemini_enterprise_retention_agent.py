#!/usr/bin/env python3
"""
Gemini Enterprise Retention Agent
Integrates BigQuery ML Churn Predictions with Gemini 2.5 Flash on Vertex AI
using Native Tool Calling.
"""

import json
import subprocess
import sys
from google import genai
from google.cloud import bigquery
from google.genai import types
from google.oauth2.credentials import Credentials


def get_auth_credentials():
    token = (
        subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True)
        .strip()
        .splitlines()[-1]
    )
    return Credentials(token)


def get_customer_churn_and_telemetry(customer_id: str) -> str:
    """
    Look up customer churn prediction, ML risk tier, network outages, and support complaints from BigQuery.

    Args:
        customer_id: The unique customer identifier (e.g. '9999116823' or '9999100271').
    """
    creds = get_auth_credentials()
    client = bigquery.Client(project="telco-demos", credentials=creds)

    query = """
    WITH all_scored AS (
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
        p.AON
      FROM `telco-demos.telco_churn_data.customer_churn_predictions` p
      WHERE p.CUSTOMER_IDENTIFER = @cust_id
      UNION ALL
      SELECT 
        b.CUSTOMER_IDENTIFER,
        b.INSTALL_CITY,
        b.BILL_PLAN_NAME,
        b.RENTAL,
        b.PLAN_SPEED,
        b.TECHNOLOGY,
        b.DEL_STATUS,
        b.CHURN_PROBABILITY,
        CASE
          WHEN b.CHURN_PROBABILITY >= 0.50 THEN 'HIGH_RISK'
          WHEN b.CHURN_PROBABILITY >= 0.30 THEN 'MEDIUM_RISK'
          ELSE 'LOW_RISK'
        END AS RISK_TIER,
        b.KEY_RISK_DRIVERS AS TOP_RISK_DRIVERS,
        m.UNPLANNED_OUTAGES,
        m.UNPLANNED_OUTAGESS_HRS,
        m.CUSTSRS,
        m.CUSTREPEATS,
        b.USAGE,
        b.AON
      FROM `telco-demos.telco_churn_data.bulk_batch_predictions` b
      LEFT JOIN `telco-demos.telco_churn_data.telco_churn_200k_synthetic` m
        ON b.CUSTOMER_IDENTIFER = m.CUSTOMER_IDENTIFER
      WHERE b.CUSTOMER_IDENTIFER = @cust_id
    )
    SELECT
      *,
      IF(RISK_TIER = 'LOW_RISK', FALSE, TRUE) AS RETENTION_OFFER_ELIGIBLE
    FROM all_scored
    LIMIT 1;
    """

    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("cust_id", "STRING", customer_id)
        ]
    )

    try:
        results = list(client.query(query, job_config=job_config).result())
        if not results:
            return json.dumps({"error": f"Customer ID {customer_id} not found."})
        return json.dumps(dict(results[0].items()), default=str)
    except Exception as e:
        return json.dumps({"error": str(e)})


def run_agent_interaction(user_prompt: str):
    creds = get_auth_credentials()
    client = genai.Client(
        vertexai=True, project="telco-demos", location="us-central1", credentials=creds
    )

    system_instruction = """
    You are the Senior Telco Retention Copilot powered by Gemini Enterprise and BigQuery.
    You assist customer care directors and call center representatives in preventing customer churn.
    Standardized Churn Categories:
    - Low Risk: 0–30% (`LOW_RISK`, `RETENTION_OFFER_ELIGIBLE = false`)
    - Medium Risk: 30–50% (`MEDIUM_RISK`, `RETENTION_OFFER_ELIGIBLE = true`)
    - High Risk: 50%+ (`HIGH_RISK`, `RETENTION_OFFER_ELIGIBLE = true`)

    When given a customer inquiry or ID:
    1. Always call the `get_customer_churn_and_telemetry` tool to retrieve their predictive ML churn risk and network history.
    2. Analyze the root cause (e.g., network outages, unresolved complaints, collection hold, usage decline).
    3. Formulate your response strictly according to the subscriber's `RISK_TIER`:
       - [DIAGNOSIS]: Root cause analysis of the subscriber's churn risk or healthy tenure/usage standing.
       - [RETENTION OFFER] (ONLY for `HIGH_RISK` and `MEDIUM_RISK` subscribers): Tailored, margin-safe commercial bundle (compensation credit, speed upgrade, fee waiver). CRITICAL RULE: If the subscriber is `LOW_RISK` (0–30%), completely OMIT the `[RETENTION OFFER]` section and do NOT mention or offer any discount, bill credit, fee waiver, or promotional bundle anywhere in your response.
       - [CARE AGENT SCRIPT]: An empathetic, professional talk track ready for the representative to read on the call (for `LOW_RISK` subscribers, provide a warm service check-in greeting without any commercial offer).
    """

    chat = client.chats.create(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=[get_customer_churn_and_telemetry],
            temperature=0.2,
        ),
    )

    print(f"\n[USER INQUIRY]: {user_prompt}\n")
    print("[+] Gemini Enterprise Agent is evaluating customer churn telemetry via BigQuery Tool...")
    response = chat.send_message(user_prompt)
    print("\n" + "=" * 80)
    print("                GEMINI ENTERPRISE RETENTION AGENT RESPONSE                 ")
    print("=" * 80 + "\n")
    print(response.text)
    print("\n" + "=" * 80 + "\n")


if __name__ == "__main__":
    prompt = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "Customer 9999116823 called customer care threatening to disconnect their broadband service. Investigate their churn risk and advise on the best retention action."
    )
    run_agent_interaction(prompt)
