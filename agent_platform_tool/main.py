"""
HTTP Cloud Function (Gen 2) entrypoint for the Telco Churn Intelligence & Retention Platform.
Serves the interactive 3-tab web dashboard and the OpenAPI JSON endpoint for Gemini Enterprise.
"""

import json
from pathlib import Path
from services.bigquery_service import (
    fetch_analytics_summary,
    fetch_category_subscribers,
    fetch_subscriber_record,
    get_bq_client,
)
from services.retention_engine import build_subscriber_intelligence_payload

try:
    import functions_framework

    http_decorator = functions_framework.http
except ImportError:

    def http_decorator(func):
        return func


BASE_DIR = Path(__file__).resolve().parent


def render_dashboard_html() -> str:
    """Assemble the dashboard HTML template with modular CSS and JavaScript assets."""
    html_path = BASE_DIR / "templates" / "index.html"
    css_path = BASE_DIR / "static" / "css" / "styles.css"
    js_path = BASE_DIR / "static" / "js" / "app.js"

    html = html_path.read_text(encoding="utf-8")
    css = css_path.read_text(encoding="utf-8")
    js = js_path.read_text(encoding="utf-8")

    return html.replace("/* {{INLINE_CSS}} */", css).replace("// {{INLINE_JS}}", js)


@http_decorator
def get_churn_intelligence(request):
    """
    HTTP Cloud Function entrypoint for Gemini Enterprise Agent Platform & Web GUI.
    Accepts:
        customer_id: via query param or JSON body (e.g. 9999116823)
        mode: 'analytics' for Regional Heatmap & Financial ROI views, or
              'category_subscribers' for City/Category top high-churn subscriber drill-down
        format: 'json' or 'html' (defaults to HTML for browser requests)
    """
    if request.method == "OPTIONS":
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "3600",
        }
        return ("", 204, headers)

    accept_header = request.headers.get("Accept", "")
    req_format = request.args.get("format", "").lower()
    req_mode = request.args.get("mode", "").lower()
    customer_id = request.args.get("customer_id") or (
        request.get_json(silent=True) or {}
    ).get("customer_id")

    headers = {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
    }

    if req_mode == "analytics":
        client = get_bq_client()
        analytics_data = fetch_analytics_summary(client)
        return (json.dumps(analytics_data, default=str), 200, headers)

    if req_mode == "category_subscribers":
        city = (request.args.get("city") or "").strip()
        if not city:
            return (
                json.dumps({"error": "Missing required parameter 'city'"}),
                400,
                headers,
            )
        site_type = (request.args.get("site_type") or "ALL").strip()
        try:
            limit = int(request.args.get("limit", 10))
        except ValueError:
            limit = 10
        client = get_bq_client()
        subs = fetch_category_subscribers(
            city=city, site_type=site_type, limit=limit, client=client
        )
        return (
            json.dumps(
                {"city": city, "site_type": site_type, "subscribers": subs},
                default=str,
            ),
            200,
            headers,
        )

    if ("text/html" in accept_header or req_format == "html") and req_format != "json":
        return (render_dashboard_html(), 200, {"Content-Type": "text/html"})

    if not customer_id:
        if "text/html" in accept_header or not req_format:
            return (render_dashboard_html(), 200, {"Content-Type": "text/html"})
        return (
            json.dumps({"error": "Missing required parameter 'customer_id'"}),
            400,
            headers,
        )

    try:
        client = get_bq_client()
        row = fetch_subscriber_record(customer_id, client)
        if not row:
            return (
                json.dumps({
                    "status": "NOT_FOUND",
                    "message": f"Customer ID '{customer_id}' was not found in the subscriber database.",
                }),
                404,
                headers,
            )

        response_payload = build_subscriber_intelligence_payload(row)
        return (json.dumps(response_payload, indent=2), 200, headers)

    except Exception as e:
        return (
            json.dumps({"error": f"Internal database query error: {str(e)}"}),
            500,
            headers,
        )
