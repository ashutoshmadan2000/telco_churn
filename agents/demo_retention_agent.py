#!/usr/bin/env python3
"""
Telco Churn Prediction & Gemini Retention Copilot Demo
Demonstrates the synergy of BigQuery ML and Generative AI for Customer Retention.
"""

import json
import subprocess
import sys


def get_customer_retention_profile(customer_id: str = "9999116823"):
    """Query the v_gemini_retention_copilot BigQuery view for a given subscriber ID."""
    query = f"""
    SELECT 
      CUSTOMER_IDENTIFER,
      INSTALL_CITY,
      BILL_PLAN_NAME,
      MONTHLY_RENTAL,
      CHURN_RISK_SCORE,
      RISK_TIER,
      TOP_RISK_DRIVERS,
      ANNUAL_REVENUE_AT_RISK_INR,
      ESTIMATED_OFFER_COST_INR,
      RECOMMENDED_RETENTION_BUNDLE,
      AGENT_TALK_TRACK
    FROM `telco-demos.telco_churn_data.v_gemini_retention_copilot`
    WHERE CUSTOMER_IDENTIFER = '{customer_id}'
    LIMIT 1;
    """

    cmd = [
        "bq",
        "query",
        "--use_legacy_sql=false",
        "--label=datacloud:antigravity",
        "--format=prettyjson",
        query,
    ]

    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("Query failed:", res.stderr)
        return None

    try:
        data = json.loads(res.stdout)
        if data:
            return data[0]
    except Exception as e:
        print("Parsing error:", e)
    return None


def main():
    target_cust = sys.argv[1] if len(sys.argv) > 1 else "9999116823"

    print("\n" + "=" * 80)
    print("      GOOGLE CLOUD TELCO RETENTION COPILOT (BQML + GEMINI AGENT)      ")
    print("=" * 80)
    print(f"\n[+] Querying Real-Time Customer Telemetry & Churn Model for: {target_cust}...")

    profile = get_customer_retention_profile(target_cust)
    if not profile:
        print(f"[-] Customer {target_cust} not found or query error.")
        return

    is_low_risk = (
        profile.get("RISK_TIER") == "LOW_RISK"
        or not profile.get("RECOMMENDED_RETENTION_BUNDLE")
    )
    offer_cost_str = (
        "₹0 (No Offer for Low Risk)"
        if is_low_risk
        else f"₹{profile.get('ESTIMATED_OFFER_COST_INR')}"
    )

    print("\n" + "-" * 80)
    print("1. SUBSCRIBER & PREDICTIVE ML PROFILE")
    print("-" * 80)
    print(f"  • Customer ID      : {profile.get('CUSTOMER_IDENTIFER')}")
    print(f"  • Location         : {profile.get('INSTALL_CITY')}")
    print(f"  • Current Plan     : {profile.get('BILL_PLAN_NAME')} ({profile.get('MONTHLY_RENTAL')})")
    print(f"  • ML Churn Risk    : \033[91m\033[1m{profile.get('CHURN_RISK_SCORE')} [{profile.get('RISK_TIER')}]\033[0m")
    print(f"  • Detected Drivers : {profile.get('TOP_RISK_DRIVERS')}")
    print(f"  • Revenue at Risk  : ₹{profile.get('ANNUAL_REVENUE_AT_RISK_INR')}/yr (Offer Cost: {offer_cost_str})")

    if not is_low_risk:
        print("\n" + "-" * 80)
        print("2. GEMINI ENTERPRISE RETENTION STRATEGY (AUTONOMOUS COPILOT)")
        print("-" * 80)
        print("  \033[92m\033[1m[Tailored Commercial Bundle]\033[0m")
        print(f"  {profile.get('RECOMMENDED_RETENTION_BUNDLE')}")

    print("\n" + "-" * 80)
    print("3. LIVE AGENT CALL-CENTER SCRIPT")
    print("-" * 80)
    print("  \033[94m\033[1m[Empathetic Talk Track for Customer Service Rep]\033[0m")
    print(f"  \"{profile.get('AGENT_TALK_TRACK')}\"")
    print("\n" + "=" * 80 + "\n")


if __name__ == "__main__":
    main()
