# Business & Product Requirements Document (BRD / PRD)
## Telco Churn Intelligence, Network Remediation & Retention Platform

| Metadata | Details |
| :--- | :--- |
| **Project Name** | Telco Churn Intelligence, Network Remediation & Retention Platform |
| **Platform Stack** | Google Cloud BigQuery ML, Vertex AI (Gemini 2.5 Flash), Cloud Functions (Gen 2), Leaflet.js |
| **Dataset Scope** | 200,000 Synthetic Broadband/Fiber Subscribers (100,000 Scored Production Base across 15 Cities in Gujarat Circle) |
| **Status** | Active / Production Demo |

---

## 1. Executive Summary & Business Problem

Telecom broadband and fiber (FTTH / 5G AirFiber) operators face two compounding challenges when managing subscriber churn:

1. **Siloed Commercial vs. Network Operations:**
   * **Customer Care & Marketing teams** react to churn risk by issuing commercial bill credits, rental rebates, or speed upgrades—often subsidizing low-risk customers unnecessarily while failing to fix the underlying physical fault causing high-risk customers to leave.
   * **Network Engineering & Field Operations (NOC) teams** track network element alarms, CPE/ONT routers, and fiber cuts, but lack visibility into **Annual Revenue at Risk (ARR)** and **subscriber churn propensity** tied to specific router models or last-mile plant segments.
2. **Inefficient Frontline Care Resolution:**
   * Call centre agents spend minutes navigating disconnected billing, ticketing, and network tools when an angry subscriber calls, resulting in generic apologies, unguarded discounts that erode ARPU margin, or repeat unresolved complaints.

### Solution Vision
Provide a unified, AI-driven **Churn Intelligence, Network Remediation & Retention Platform** powered by **BigQuery ML** and **Gemini Enterprise** that bridges **Regional Operations (Geospatial)**, **Network Engineering (CTO)**, **Commercial Finance (CFO)**, and **Frontline Customer Care** in a single 4-tab executive workbench and conversational agent API.

---

## 2. Target Personas & User Journeys

| Tab / Module | Target Persona | Primary Objective | Key Decisions Enabled |
| :--- | :--- | :--- | :--- |
| **Tab 1: Regional Outage & Churn Heatmap** | Circle Operations Head / Regional GM | Visualize geographic churn hotspots and localized outage patterns across the telecom circle. | Identify which of the 15 cities and last-mile site types (`Shared Sites`, `ODC-SMART SPLIT`, `3rd Party`) have the highest churn and ARR at risk. |
| **Tab 2: CTO / Network View** | CTO / VP of Network Engineering & Field Ops | Eliminate physical root causes of churn (faulty ONT routers, aerial fiber cuts, LCO splice loss) and reduce repeat truck rolls. | Simulate the Engineering ROI of proactive **ONT Swaps**, **OTA Firmware Patches**, **Fiber Overbuilds**, **OH Hardening**, and **LCO Audits**. |
| **Tab 3: Commercial CFO View (ROI Calculator)** | CFO / VP of Marketing & Customer Value Management (CVM) | Maximize net annual margin protected from retention campaigns while enforcing strict subsidy guardrails. | Simulate campaign save rates and subsidy caps across risk tiers while strictly excluding `LOW_RISK` subscribers from financial offers. |
| **Tab 4: Frontline Care Agent View & Gemini Copilot** | Call Centre Representative / Retention Specialist | Diagnose individual subscriber churn risk in real time and deliver a margin-safe offer with an empathetic talk track. | Instantly view subscriber telemetry, SHAP risk drivers, a margin-guarded offer (`HIGH_RISK`/`MEDIUM_RISK` only), and a ready-to-read script. |

---

## 3. Functional Requirements

### FR-01: Regional Outage & Churn Geospatial Heatmap (Tab 1)
* **FR-01.1 (Interactive Map):** Render an interactive map of India with state boundaries (highlighting the Gujarat Telecom Circle) using Leaflet.js and `Leaflet.heat`.
* **FR-01.2 (City-Level Aggregation):** Consolidate multiple entries per city into one row per `INSTALL_CITY` (15 cities total: `Surat`, `Ahmedabad`, `Vadodara`, `Rajkot`, `Junagadh`, `Bhuj`, `Jamnagar`, `Nadiad`, `Anand`, `Vapi`, `Bopal`, `Godhra`, `Kadi`, `Kalol`, `Billimora`), computing subscriber-weighted city averages for `Avg Outages`, `Avg Outage Hours`, `Avg Repeat Complaints`, and `City Churn Rate`, alongside total subscribers and Annual Revenue at Risk.
* **FR-01.3 (Interactive City & Category Breakdown):** Clicking a consolidated City row or map bubble zooms the map and expands an in-tab **Category Breakdown** displaying interactive cards for each last-mile `Site_Type` segment in that city (e.g., `3rd Party`, `Shared Sites`, `ODC-SMART SPLIT`, `Outdoor Sites`, `Indoor Sites`, `Standard / Direct (-)`).
* **FR-01.4 (Subscriber-Level Details, Toggle Close & Care Hand-Off):** Selecting any Category card (or *All Categories in City*) queries `?mode=category_subscribers&limit=10` and renders the **Top 10 High-Churn Subscribers** for that segment, with one-click navigation (`Analyze & Retain →`) to Tab 4 (Frontline Care Agent View) and Tab 2 (CTO Remediation View). Clicking an active Category card (e.g., `ODC-SMART SPLIT` for `Ahmedabad`) a second time toggles and closes the Top 10 High-Churn Subscribers detail panel.

### FR-02: CTO / Network Operations & Remediation Simulator (Tab 2)
* **FR-02.1 (Dual-Layer Network Diagnostics):** Analyze the 100K scored subscriber base across two distinct engineering layers via `v_network_ops_remediation`:
  1. **CPE / ONT Router Hardware Matrix (`CPE_HARDWARE`):** Evaluate all 14 deployed vendor/model combinations across subscriber count, unplanned outages, Mean Time To Restore (**MTTR** in hours), repeat complaints, First-Time Resolution (**FTR %**), churn probability, and ARR at risk.
  2. **Last-Mile Fiber Plant & Rollout Matrix (`PLANT_ROLLOUT`):** Evaluate physical plant combinations (`Telco OWN`, `LCO Shared`, `Copper+FTTH`) crossed with fiber rollout topology (`OH` Overhead, `UG` Underground, `Mix`) and cabinet types (`Shared Sites`, `ODC-SMART SPLIT`, `3rd Party`, `Outdoor Sites`, `Indoor Sites`).
* **FR-02.2 (1-to-1 Work Order & Unit Benchmark Alignment):** Every segment must be assigned a standardized engineering work order that matches its table's **Unit Benchmarks** header 1-to-1:
  * **CPE / ONT Hardware Work Orders:**
    * `ONT Swap` (`₹850/sub`) — High unplanned outage rate ($\ge 0.50$) or critical churn ($\ge 55\%$).
    * `OTA Firmware Patch` (`₹120/sub`) — High repeat Wi-Fi complaint rate ($\ge 0.60$) or elevated churn ($\ge 46\%$).
    * `Field CPE Audit` (`₹350/sub`) — Low First-Time Fix rate ($\text{FTR} < 35\%$).
    * `Standard Monitoring` (`₹0`) — Healthy benchmark ONT models.
  * **Last-Mile Fiber Plant Work Orders:**
    * `Fiber Overbuild` (`₹650/sub`) — Hybrid `Copper+FTTH` nodes requiring full-fiber migration.
    * `Cabinet Rebalance` (`₹400/sub`) — `3rd Party`, `ODC-SMART SPLIT`, or high-loss MDU RSU splitters.
    * `OH Hardening` (`₹380/sub`) — Aerial (`OH` / `Mix`) fiber routes with high unplanned outages ($\ge 0.40$).
    * `LCO Audit` (`₹320/sub`) — `LCO Shared` partner nodes with high repeat faults.
    * `Standard Monitoring` (`₹0`) — Healthy benchmark plant segments.
* **FR-02.3 (Interactive Engineering ROI Sliders):**
  * **Target Fault & Outage Mitigation Rate (%):** Adjustable from `20%` to `85%` (default `55%`), scaling both prevented ARR loss and avoided repeat truck-roll OpEx savings (`₹350` per repeat ticket among high/medium-risk subscribers).
  * **Engineering CapEx/OpEx Cost Scale (%):** Adjustable from `50%` to `150%` (default `100%`), scaling unit remediation costs across all actionable work orders.
  * **Layer Filter Controls:** Toggle between *All Network Layers*, *CPE / ONT Hardware*, and *Last-Mile Plant & Rollout* without double-counting unique at-risk subscribers or ARR in the top-level KPI summary.

### FR-03: Commercial CFO Financial ROI & Margin Protection Calculator (Tab 3)
* **FR-03.1 (Risk Tier Segmentation):** Group the 100K scored production base into **High Risk: 50%+** (`HIGH_RISK`, $\ge 50\%$ churn probability), **Medium Risk: 30–50%** (`MEDIUM_RISK`, $30\%–49.9\%$), and **Low Risk: 0–30%** (`LOW_RISK`, $< 30\%$) across `v_regional_outage_churn_heatmap`, `v_financial_roi_calculator`, `v_gemini_retention_copilot`, `v_network_ops_remediation`, and the UI.
* **FR-03.2 (Strict Low-Risk Exclusion):** `LOW_RISK` subscribers must receive `₹0` retention campaign budget (`No Campaign (₹0)`) to prevent margin dilution and unnecessary subsidy spend.
* **FR-03.3 (Interactive Commercial Sliders):**
  * **Target Campaign Save Rate (%):** Adjustable from `15%` to `80%` (default `45%`).
  * **Subsidy Guardrail Scale (% of Standard Offer):** Adjustable from `50%` to `150%` (default `100%`).
  * Dynamically recalculate *High + Med Risk Subscribers*, *Expected Annual Churn Loss*, *Retention Campaign Cost*, *Net Margin Protected*, and *ROI Multiple* per tier.

### FR-04: Frontline Care Agent View & Real-Time Subscriber Lookup (Tab 4)
* **FR-04.1 (3-Tier Hybrid Prediction Lookup):** When querying a `customer_id`, the backend (`bigquery_service.py`) must resolve the subscriber using a seamless 3-stage fallback:
  1. `pre_scored`: `customer_churn_predictions` (20K pre-scored batch).
  2. `bulk_scored`: `bulk_batch_predictions` (80K bulk batch).
  3. `on_the_fly`: Real-time BigQuery ML inference (`ML.PREDICT` on `churn_logreg_model`) for unseen subscribers in the 200K base.
* **FR-04.2 (SHAP Feature Attribution Engine):** Compute and sort individual risk and retention factors (`compute_shap_factors` in `retention_engine.py`), categorizing each driver as `CRITICAL_RISK`, `HIGH_RISK`, `MODERATE_RISK`, or `RETENTION_SHIELD` with signed attribution weights.
* **FR-04.3 (Margin-Guarded Offer & Script Generation):**
  * For `HIGH_RISK` and `MEDIUM_RISK` subscribers, select a tailored retention offer based on the primary root cause (Barred Account $\rightarrow$ 50% late-fee waiver + 3-month installment; Outages $\ge 3$ $\rightarrow$ margin-guarded credit capped at `MIN(₹200, 25% of Rental)` + 2x speed upgrade; Repeat Complaints $\ge 1$ $\rightarrow$ 4-hour senior technician dispatch + 20% rental rebate; Low Usage $< 100\text{ GB}$ $\rightarrow$ 30-day OTT bundle; else 10% loyalty discount).
  * For `LOW_RISK` subscribers, omit all financial offers (`offer_cost = 0`, `recommended_offer = None`) while still providing a warm, appreciative **Frontline Call Centre Agent Script**.

### FR-05: Gemini Enterprise Agent & OpenAPI Tool Integration
* **FR-05.1 (OpenAPI 3.0 Specification):** Expose a production OpenAPI 3.0 schema (`agent_platform_tool/openapi.yaml`) compatible with Gemini Enterprise / Vertex AI Agent Builder.
* **FR-05.2 (Vertex AI Native Tool-Calling Agent):** Provide standalone CLI and Vertex AI (`gemini-2.5-flash`) retention agents (`agents/demo_retention_agent.py` and `agents/gemini_enterprise_retention_agent.py`) that invoke BigQuery telemetry tools and synthesize `[DIAGNOSIS]`, `[RETENTION OFFER]`, and `[CARE AGENT SCRIPT]`.

---

## 4. Data & Telemetry Requirements

The platform operates on the `telco-demos.telco_churn_data` BigQuery dataset:

| Table / View Name | Type | Volume / Grain | Purpose |
| :--- | :--- | :--- | :--- |
| `telco_churn_200k_synthetic` | Base Table | 200,000 rows (Subscriber) | Master synthetic telemetry: billing, plan speed, usage, `CPE_NAME`, `MODELNAME`, `Site_Type`, `FTTH_Site_Type`, `Rollout_Type`, `RSU_Type`, `PINCODE`, `UNPLANNED_OUTAGES`, `UNPLANNED_OUTAGESS_HRS`, `PLANNED_OUTAGES`, `CUSTSRS`, `CUSTREPEATS`, `FTRS`, `SMARTSRS`. |
| `customer_churn_predictions` | Scored Table | 20,000 rows (Subscriber) | Pre-scored production batch with `CHURN_PROBABILITY`, `RISK_TIER`, and `TOP_RISK_DRIVERS`. |
| `bulk_batch_predictions` | Scored Table | 80,000 rows (Subscriber) | Bulk-scored production batch (`Batch 01–04`), combining with `customer_churn_predictions` to form the **100K Scored Production Base**. |
| `churn_logreg_model` | BQML Model | Logistic Regression | Trained BigQuery ML churn classification model used for live `ML.PREDICT` inference on unseen subscribers. |
| `v_regional_outage_churn_heatmap` | View (`01`) | City $\times$ `Site_Type` | Powers Tab 1 geospatial map and regional telemetry table. |
| `v_financial_roi_calculator` | View (`02`) | `RISK_TIER` (3 rows) | Powers Tab 3 CFO ROI & Margin Protection simulator. |
| `v_gemini_retention_copilot` | View (`03`) | Subscriber | Powers CLI retention copilot with pre-formatted offers and talk tracks. |
| `v_network_ops_remediation` | View (`04`) | 24 Network Segments | Powers Tab 2 CTO / Network Ops simulator across 14 CPE models and 10 plant/rollout topologies. |

---

## 5. Non-Functional & Operational Requirements (NFRs)

* **NFR-01 (Serverless Single-Endpoint Packaging):** The web dashboard and JSON API must be served from a single Google Cloud Function (Gen 2) / Cloud Run entrypoint (`get_churn_intelligence` in `agent_platform_tool/main.py`), supporting HTML rendering for browsers and JSON payloads for API/OpenAPI consumers (`?format=json` and `?mode=analytics&format=json`).
* **NFR-02 (Query Performance & SQL Optimization):** Analytical views must use column pruning, early aggregation, and `UNION ALL` to return dashboard summary payloads in under 2 seconds.
* **NFR-03 (Automated Verification):** All business rules—including `LOW_RISK` offer exclusion, SHAP driver sorting, 4-tab ordering, and 1-to-1 Unit Benchmark alignment—must be validated via `unittest` (`tests/test_retention_engine.py`) prior to deployment in `deploy.sh`.
