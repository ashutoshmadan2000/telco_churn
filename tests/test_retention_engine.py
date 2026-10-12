"""Unit tests for the Telco Churn Intelligence & Retention Engine and HTML renderer."""

import sys
import unittest
from pathlib import Path

TOOL_DIR = Path(__file__).resolve().parent.parent / "agent_platform_tool"
sys.path.insert(0, str(TOOL_DIR))

from main import render_dashboard_html  # noqa: E402
from services.retention_engine import (  # noqa: E402
    build_subscriber_intelligence_payload,
    classify_churn_risk_tier,
    compute_shap_factors,
    format_churn_percentage,
)


class TestRetentionEngine(unittest.TestCase):
    def test_classify_churn_risk_tier_boundaries(self):
        self.assertEqual(classify_churn_risk_tier(0.0), "LOW_RISK")
        self.assertEqual(classify_churn_risk_tier(0.299), "LOW_RISK")
        self.assertEqual(classify_churn_risk_tier(0.2998), "LOW_RISK")
        self.assertEqual(classify_churn_risk_tier(0.30), "MEDIUM_RISK")
        self.assertEqual(classify_churn_risk_tier(0.499), "MEDIUM_RISK")
        self.assertEqual(classify_churn_risk_tier(0.4998), "MEDIUM_RISK")
        self.assertEqual(classify_churn_risk_tier(0.50), "HIGH_RISK")
        self.assertEqual(classify_churn_risk_tier(0.85), "HIGH_RISK")

    def test_format_churn_percentage_prevents_boundary_contradiction(self):
        self.assertEqual(format_churn_percentage(0.2998, "LOW_RISK"), 29.9)
        self.assertEqual(format_churn_percentage(0.3001, "MEDIUM_RISK"), 30.0)
        self.assertEqual(format_churn_percentage(0.4998, "MEDIUM_RISK"), 49.9)
        self.assertEqual(format_churn_percentage(0.5001, "HIGH_RISK"), 50.0)

    def test_medium_risk_subscriber_boundary_classification(self):
        row = {
            "CUSTOMER_IDENTIFER": "9999116647",
            "INSTALL_CITY": "Surat",
            "BILL_PLAN_NAME": "499 WiFi 40Mbps",
            "RENTAL": 499,
            "PLAN_SPEED": 40960,
            "TECHNOLOGY": "FTTH Own",
            "DEL_STATUS": "Active",
            "CHURN_PROBABILITY": 0.422,
            "RISK_TIER": "HIGH_RISK",
            "TOP_RISK_DRIVERS": "1 Network Outages",
            "UNPLANNED_OUTAGES": 1,
            "UNPLANNED_OUTAGESS_HRS": 2.1,
            "CUSTSRS": 1,
            "CUSTREPEATS": 0,
            "USAGE": 120.4,
            "AON": 210,
            "Site_Type": "Shared Sites",
            "CPE_MODEL": "VENDOR_01 MODEL_01",
        }
        payload = build_subscriber_intelligence_payload(row)
        self.assertEqual(payload["churn_prediction"]["risk_tier"], "MEDIUM_RISK")
        self.assertEqual(payload["churn_prediction"]["churn_percentage"], "42.2%")
        self.assertEqual(payload["financial_roi"]["margin_guarded_offer_cost_inr"], 50)
        self.assertIsNotNone(payload["financial_roi"]["recommended_offer"])

    def test_high_risk_outage_subscriber_receives_offer_and_script(self):
        row = {
            "CUSTOMER_IDENTIFER": "9999116823",
            "INSTALL_CITY": "Junagadh",
            "BILL_PLAN_NAME": "799 WiFi 100Mbps",
            "RENTAL": 799,
            "PLAN_SPEED": 102400,
            "TECHNOLOGY": "FTTH Own",
            "DEL_STATUS": "Active",
            "CHURN_PROBABILITY": 0.938,
            "RISK_TIER": "HIGH_RISK",
            "TOP_RISK_DRIVERS": "4 Network Outages; 1 Repeat Complaints",
            "UNPLANNED_OUTAGES": 4,
            "UNPLANNED_OUTAGESS_HRS": 6.3,
            "CUSTSRS": 1,
            "CUSTREPEATS": 1,
            "USAGE": 153.8,
            "AON": 39,
            "Site_Type": "Shared Sites",
            "CPE_MODEL": "VENDOR_01 MODEL_01",
        }
        payload = build_subscriber_intelligence_payload(row)
        self.assertEqual(payload["churn_prediction"]["risk_tier"], "HIGH_RISK")
        self.assertEqual(payload["churn_prediction"]["churn_percentage"], "93.8%")
        self.assertGreater(payload["financial_roi"]["margin_guarded_offer_cost_inr"], 0)
        self.assertIsNotNone(payload["financial_roi"]["recommended_offer"])
        self.assertTrue(len(payload["financial_roi"]["agent_talk_track"]) > 20)

    def test_low_risk_subscriber_has_no_offer_but_retains_script(self):
        row = {
            "CUSTOMER_IDENTIFER": "9999108000",
            "INSTALL_CITY": "Surat",
            "BILL_PLAN_NAME": "999 WiFi+DTH",
            "RENTAL": 999,
            "PLAN_SPEED": 204800,
            "TECHNOLOGY": "FTTH Own",
            "DEL_STATUS": "Active",
            "CHURN_PROBABILITY": 0.231,
            "RISK_TIER": "LOW_RISK",
            "TOP_RISK_DRIVERS": "Healthy Usage",
            "UNPLANNED_OUTAGES": 0,
            "UNPLANNED_OUTAGESS_HRS": 0.0,
            "CUSTSRS": 0,
            "CUSTREPEATS": 0,
            "USAGE": 420.5,
            "AON": 720,
            "Site_Type": "Shared Sites",
            "CPE_MODEL": "VENDOR_02 MODEL_01",
        }
        payload = build_subscriber_intelligence_payload(row)
        self.assertEqual(payload["churn_prediction"]["risk_tier"], "LOW_RISK")
        self.assertEqual(payload["churn_prediction"]["churn_percentage"], "23.1%")
        self.assertEqual(payload["financial_roi"]["margin_guarded_offer_cost_inr"], 0)
        self.assertEqual(payload["financial_roi"]["net_annual_margin_protected_inr"], 0)
        self.assertEqual(payload["financial_roi"]["roi_multiple"], 0.0)
        self.assertIsNone(payload["financial_roi"]["recommended_offer"])
        self.assertIn("loyal Airtel subscriber", payload["financial_roi"]["agent_talk_track"])

    def test_low_risk_subscriber_never_receives_offer_even_with_outages_or_low_usage(self):
        row = {
            "CUSTOMER_IDENTIFER": "9999125001",
            "INSTALL_CITY": "Ahmedabad",
            "BILL_PLAN_NAME": "799 WiFi 100Mbps",
            "RENTAL": 799,
            "PLAN_SPEED": 102400,
            "TECHNOLOGY": "FTTH Own",
            "DEL_STATUS": "Active",
            "CHURN_PROBABILITY": 0.2998,
            "RISK_TIER": "MEDIUM_RISK",
            "TOP_RISK_DRIVERS": "Low Data Usage",
            "UNPLANNED_OUTAGES": 3,
            "UNPLANNED_OUTAGESS_HRS": 4.0,
            "CUSTSRS": 2,
            "CUSTREPEATS": 1,
            "USAGE": 45.0,
            "AON": 800,
            "Site_Type": "Shared Sites",
            "CPE_MODEL": "VENDOR_01 MODEL_01",
        }
        payload = build_subscriber_intelligence_payload(row)
        self.assertEqual(payload["churn_prediction"]["risk_tier"], "LOW_RISK")
        self.assertEqual(payload["churn_prediction"]["churn_percentage"], "29.9%")
        self.assertEqual(payload["financial_roi"]["margin_guarded_offer_cost_inr"], 0)
        self.assertEqual(payload["financial_roi"]["net_annual_margin_protected_inr"], 0)
        self.assertEqual(payload["financial_roi"]["roi_multiple"], 0.0)
        self.assertIsNone(payload["financial_roi"]["recommended_offer"])

    def test_dashboard_html_renders_resequenced_tabs_and_assets(self):
        html = render_dashboard_html()
        self.assertNotIn("/* {{INLINE_CSS}} */", html)
        self.assertNotIn("// {{INLINE_JS}}", html)
        self.assertNotIn("Cloud Run / Gen 2", html)
        self.assertNotIn("(9999abcdef Format)", html)
        pos_map = html.index("1. Regional Outage &amp; Churn Heatmap")
        pos_net = html.index("2. CTO / Network View")
        pos_roi = html.index("3. Commercial CFO View (ROI Calculator)")
        pos_call = html.index("4. Frontline Care Agent View")
        self.assertLess(pos_map, pos_net)
        self.assertLess(pos_net, pos_roi)
        self.assertLess(pos_roi, pos_call)
        self.assertIn("recalcNetworkOps()", html)
        self.assertIn("netCpeTableBody", html)
        self.assertIn("netPlantTableBody", html)
        self.assertIn(
            "Unit Benchmarks: ONT Swap ₹850 • OTA Firmware Patch ₹120 • Field CPE Audit ₹350 • Standard Monitoring ₹0",
            html,
        )
        self.assertIn(
            "Unit Benchmarks: Fiber Overbuild ₹650 • Cabinet Rebalance ₹400 • OH Hardening ₹380 • LCO Audit ₹320 • Standard Monitoring ₹0",
            html,
        )
        self.assertIn("getCityAggregates()", html)
        self.assertIn("toggleCityDrilldown", html)
        self.assertIn("selectCityCategory", html)
        self.assertIn("inspectSubscriberInCareTab", html)
        self.assertIn("mapDrilldownBar", html)
        self.assertIn("mapTotalSubs", html)
        self.assertIn("mapAtRiskSubs", html)
        self.assertIn("mapTotalArr", html)
        self.assertIn("mapAvgChurn", html)
        self.assertIn("Top 10 High-Churn Subscribers", html)
        self.assertNotIn("Top 15 High-Churn Subscribers", html)
        self.assertIn("High Risk:</strong> 50%+", html)
        self.assertIn("Medium Risk:</strong> 30–50%", html)
        self.assertIn("Low Risk:</strong> 0–30%", html)
        self.assertNotIn("High Risk:</strong> 40%+", html)
        self.assertNotIn("Medium Risk:</strong> 20–40%", html)
        self.assertNotIn("Low Risk:</strong> 0–20%", html)

    def test_fetch_analytics_summary_includes_network_ops(self):
        from services.bigquery_service import fetch_analytics_summary

        class DummyQueryJob:
            def __init__(self, rows):
                self._rows = rows

            def result(self):
                return self._rows

        class DummyBqClient:
            def query(self, sql):
                if "v_financial_roi_calculator" in sql:
                    return DummyQueryJob([{"RISK_TIER": "HIGH_RISK", "subscriber_count": 100}])
                if "v_regional_outage_churn_heatmap" in sql:
                    return DummyQueryJob([{"INSTALL_CITY": "Surat", "total_subscribers": 1000}])
                if "v_network_ops_remediation" in sql:
                    return DummyQueryJob([
                        {"category": "CPE_HARDWARE", "segment_name": "VENDOR_01 MODEL_01"},
                        {"category": "PLANT_ROLLOUT", "segment_name": "LCO Shared • OH (Shared Sites)"},
                    ])
                return DummyQueryJob([])

        summary = fetch_analytics_summary(DummyBqClient())
        self.assertIn("roi_tiers", summary)
        self.assertIn("heatmap", summary)
        self.assertIn("network_ops", summary)
        self.assertEqual(len(summary["network_ops"]), 2)

    def test_fetch_category_subscribers_returns_ranked_rows(self):
        from services.bigquery_service import fetch_category_subscribers

        class DummyQueryJob:
            def __init__(self, rows):
                self._rows = rows

            def result(self):
                return self._rows

        class DummyBqClient:
            def __init__(self):
                self.last_sql = None
                self.last_job_config = None

            def query(self, sql, job_config=None):
                self.last_sql = sql
                self.last_job_config = job_config
                return DummyQueryJob([
                    {
                        "CUSTOMER_IDENTIFER": "9999118929",
                        "INSTALL_CITY": "Surat",
                        "Site_Type": "3rd Party",
                        "churn_prob_pct": 99.3,
                        "RISK_TIER": "HIGH_RISK",
                        "annual_revenue_at_risk_inr": 5944,
                    }
                ])

        client = DummyBqClient()
        rows = fetch_category_subscribers(
            city="Surat", site_type="3rd Party", limit=10, client=client
        )
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["CUSTOMER_IDENTIFER"], "9999118929")
        self.assertEqual(rows[0]["INSTALL_CITY"], "Surat")
        self.assertEqual(rows[0]["Site_Type"], "3rd Party")


if __name__ == "__main__":
    unittest.main()

