# Telco Churn Intelligence & Retention Platform

An end-to-end **BigQuery ML + Gemini Enterprise** churn intelligence, geospatial outage heatmap, financial ROI simulator, and call-centre retention platform.

---

## Project Architecture & Folder Structure

```text
telco_churn/
├── README.md                          # Architecture, setup, and deployment documentation
├── .gitignore                         # Standard Python & Google Cloud gitignore
├── requirements.txt                   # Project-wide Python dependencies
├── deploy.sh                          # Automated Cloud Functions (Gen 2) deployment script
├── agent_platform_tool/               # Web Dashboard & Gemini Enterprise OpenAPI Tool
│   ├── .gcloudignore
│   ├── main.py                        # HTTP Cloud Function entrypoint (get_churn_intelligence)
│   ├── openapi.yaml                   # OpenAPI 3.0 specification for Gemini Enterprise Agent
│   ├── requirements.txt               # Cloud Function runtime dependencies
│   ├── services/                      # Modular backend service layer
│   │   ├── __init__.py
│   │   ├── bigquery_service.py        # BigQuery queries (pre-scored, batch, live ML.PREDICT)
│   │   └── retention_engine.py        # SHAP driver attribution & margin-guarded offer engine
│   ├── templates/
│   │   └── index.html                 # 4-tab web dashboard HTML template
│   └── static/
│       ├── css/
│       │   └── styles.css             # Dashboard stylesheet
│       └── js/
│           └── app.js                 # Geospatial map, CTO Network Ops, CFO ROI & Care lookup logic
├── agents/                            # CLI & Vertex AI Gemini Retention Agents
│   ├── __init__.py
│   ├── demo_retention_agent.py        # CLI retention copilot backed by BigQuery ML views
│   └── gemini_enterprise_retention_agent.py  # Gemini 2.5 Flash agent with native tool calling
├── docs/                              # Project documentation (BRD, SDD, test plans)
│   ├── requirements_document.md       # Business & Product Requirements Document (BRD/PRD)
│   ├── design_document.md             # Software Design Document (SDD) & Architecture
│   └── test_document.md               # End-to-End Test Plan & Functional Verification Cases
├── sql/                               # Version-controlled BigQuery View DDLs
│   ├── 01_v_regional_outage_churn_heatmap.sql
│   ├── 02_v_financial_roi_calculator.sql
│   ├── 03_v_gemini_retention_copilot.sql
│   └── 04_v_network_ops_remediation.sql
└── tests/                             # Unit test suite
    └── test_retention_engine.py       # Tests for SHAP attributions, LOW_RISK rules & HTML UI
```

---

## Key Capabilities

1. **1. Regional Outage & Churn Heatmap**:
   - Interactive India / Gujarat Telecom Circle geospatial visualization built with Leaflet.js, `Leaflet.heat`, and India State GeoJSON boundaries.
   - Displays subscriber volume, unplanned outages, repeat complaints, dominant CPE models, and Annual Revenue at Risk across all 15 cities in the **100K predicted subscriber base**.
2. **2. CTO / Network View (Engineering Remediation Simulator)**:
   - Surfaces CPE/ONT hardware failure signatures (`VENDOR_01 MODEL_01` high outages, `VENDOR_04 MODEL_01` repeat Wi-Fi drops, `VENDOR_03 MODEL_04` low FTR %) and last-mile fiber plant vulnerabilities (`LCO Shared`, `Copper+FTTH`, `OH` aerial vs. `UG` underground, `ODC-SMART SPLIT`).
   - Interactive simulator with **Target Fault & Outage Mitigation Rate (%)** and **Engineering CapEx/OpEx Cost Scale (%)** sliders to calculate net protected ARR, avoided repeat truck rolls, and engineering ROI across hardware swaps, OTA firmware patches, and plant overbuilds.
3. **3. Commercial CFO View (Financial ROI & Margin Protection Calculator)**:
   - Interactive simulator over the 100K scored production base with adjustable **Target Campaign Save Rate (%)** and **Subsidy Guardrail Scale (% of Standard Offer)**.
   - Targets `HIGH_RISK` and `MEDIUM_RISK` tiers while excluding `LOW_RISK` subscribers from campaign offer costs.
4. **4. Frontline Care Agent View (Call Centre & Customer Retention)**:
   - Real-time subscriber lookup (`pre_scored` $\rightarrow$ `bulk_scored` $\rightarrow$ on-the-fly `ML.PREDICT`) with SHAP attribution drivers.
   - Generates margin-safe retention offers for `HIGH_RISK` / `MEDIUM_RISK` subscribers and empathetic **Frontline Call Centre Agent Scripts** for all tiers (including `LOW_RISK` customers, where financial offers are omitted).

---

## Running Tests & Deploying

### Run Unit Tests
```bash
python3 -m unittest discover -s tests -v
```

### Deploy Web Dashboard & OpenAPI Endpoint
```bash
./deploy.sh
```

### Run CLI Retention Agents
```bash
python3 agents/demo_retention_agent.py 9999116823
python3 agents/gemini_enterprise_retention_agent.py
```
