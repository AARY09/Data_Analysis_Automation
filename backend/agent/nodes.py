import pandas as pd
import numpy as np
from .state import AgentState
import json
from .llm import call_llm


# ---------- SCHEMA ----------
def schema_inspector(state: AgentState) -> AgentState:
    try:
        df = pd.read_csv(state["file_path"])

        schema = {
            "columns": list(df.columns),
            "dtypes": df.dtypes.astype(str).to_dict(),
            "missing_percent": {
                k: round(v, 2)
                for k, v in (df.isnull().mean() * 100).to_dict().items()
            },
            "unique_counts": df.nunique().to_dict(),
            "shape": {"rows": len(df), "cols": len(df.columns)}
        }

        state["schema"] = schema
        state["needs_clarification"] = False
        return state

    except Exception as e:
        state["error"] = f"Schema error: {str(e)}"
        state["schema"] = {}
        return state


# ---------- CLEANER ----------
def data_cleaner(state: AgentState) -> AgentState:
    try:
        df = pd.read_csv(state["file_path"])

        prompt = f"""
You are a data cleaning expert.

Schema:
{json.dumps(state["schema"], indent=2)}

Sample:
{json.dumps(state["df_sample"], indent=2)}

Rules:
- Drop columns if >50% missing
- Use median for skewed numeric
- Use mean for normal numeric
- Use mode for categorical

Return JSON:
{{
 "actions":[{{"column":"","action":"drop|fill_mean|fill_median|fill_mode","reason":""}}],
 "needs_clarification": false
}}
"""

        response = call_llm(prompt)

        try:
            decision = json.loads(response)
            if isinstance(decision, str):
                decision = json.loads(decision)
        except:
            print("❌ BAD CLEANER OUTPUT:", response)
            decision = {"actions": [], "needs_clarification": False}

        log = []

        for act in decision.get("actions", []):
            col = act.get("column")
            action = act.get("action")

            if col not in df.columns:
                continue

            if action == "drop":
                df.drop(columns=[col], inplace=True)

            elif action == "fill_mean":
                df[col].fillna(df[col].mean(), inplace=True)

            elif action == "fill_median":
                df[col].fillna(df[col].median(), inplace=True)

            elif action == "fill_mode":
                df[col].fillna(df[col].mode()[0], inplace=True)

            log.append(act)

        path = state["file_path"].replace(".csv", "_cleaned.csv")
        df.to_csv(path, index=False)

        state["file_path"] = path
        state["cleaning_log"] = log
        state["needs_clarification"] = decision.get("needs_clarification", False)

        return state

    except Exception as e:
        state["error"] = f"Cleaner error: {str(e)}"
        return state


# ---------- PLANNER ----------
def insight_planner(state: AgentState) -> AgentState:
    try:
        prompt = f"""
Schema:
{json.dumps(state["schema"], indent=2)}

Rules:
- histogram → numeric
- heatmap → numeric only (>=2 cols)
- bar → categorical

Return JSON:
[
  {{
    "type": "histogram | heatmap | bar",
    "columns": ["col1","col2"],
    "reason": ""
  }}
]
"""

        response = call_llm(prompt)

        try:
            parsed = json.loads(response)
            if isinstance(parsed, str):
                parsed = json.loads(parsed)

            if not isinstance(parsed, list):
                raise ValueError()

            state["plot_plan"] = parsed

        except:
            print("❌ BAD PLAN:", response)
            state["plot_plan"] = []

        return state

    except Exception as e:
        state["error"] = f"Planner error: {str(e)}"
        return state


# ---------- CHARTS ----------
def chart_generator(state: AgentState) -> AgentState:
    import base64
    from io import BytesIO

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import seaborn as sns
    except ImportError as e:
        state["error"] = f"Chart dependencies missing. Run: pip install matplotlib seaborn ({e})"
        state["charts"] = []
        return state

    try:
        df = pd.read_csv(state["file_path"])
        charts = []

        for plot in state.get("plot_plan", [])[:4]:
            if not isinstance(plot, dict):
                continue

            cols = plot.get("columns", [])
            plot_type = plot.get("type")

            valid_cols = [c for c in cols if c in df.columns]
            if not valid_cols:
                continue

            plt.figure()

            try:
                if plot_type == "histogram":
                    col = valid_cols[0]
                    if pd.api.types.is_numeric_dtype(df[col]):
                        df[col].dropna().hist()

                elif plot_type == "bar":
                    col = valid_cols[0]
                    df[col].value_counts().head(10).plot(kind="bar")

                elif plot_type == "heatmap":
                    numeric_df = df[valid_cols].select_dtypes(include=[np.number])
                    if numeric_df.shape[1] >= 2:
                        sns.heatmap(numeric_df.corr())

                buf = BytesIO()
                plt.savefig(buf, format="png")
                buf.seek(0)

                charts.append({
                    "type": plot_type,
                    "image": base64.b64encode(buf.read()).decode()
                })

                plt.close()

            except:
                plt.close()
                continue

        state["charts"] = charts
        return state

    except Exception as e:
        state["error"] = f"Chart error: {str(e)}"
        return state


def _parse_llm_json(response: str):
    text = (response or "").strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    parsed = json.loads(text)
    if isinstance(parsed, str):
        parsed = json.loads(parsed)
    return parsed


def _enrich_insights_report(report: dict, schema: dict) -> dict:
    stats = report.setdefault("statistics", {})
    if not stats.get("missing_values") and schema.get("missing_percent"):
        stats["missing_values"] = [
            {
                "column": col,
                "missing_percent": schema["missing_percent"].get(col, 0),
                "unique_values": schema.get("unique_counts", {}).get(col, 0),
            }
            for col in schema.get("columns", [])
            if schema["missing_percent"].get(col, 0) > 0
        ]
    return report


def _fallback_insights_report(schema: dict, cleaning_log: list, charts: list, raw: str = "") -> dict:
    return {
        "title": "Dataset Analysis Report",
        "summary": raw or "Analysis completed. Review structured sections below.",
        "key_insights": [],
        "anomalies": [],
        "recommendations": [],
        "statistics": {
            "missing_values": [
                {
                    "column": col,
                    "missing_percent": schema.get("missing_percent", {}).get(col, 0),
                    "unique_values": schema.get("unique_counts", {}).get(col, 0),
                }
                for col in schema.get("columns", [])
                if schema.get("missing_percent", {}).get(col, 0) > 0
            ],
            "numerical_summary": [],
            "categorical_summary": [],
        },
        "meta": {
            "cleaning_actions": len(cleaning_log),
            "charts_generated": len(charts),
        },
    }


# ---------- NARRATIVE ----------
def narrative_agent(state: AgentState) -> AgentState:
    schema = state.get("schema", {})
    cleaning_log = state.get("cleaning_log", [])
    charts = state.get("charts", [])

    system_prompt = (
        "You are a senior data analyst. Return ONLY valid JSON. "
        "No markdown, no code blocks, no extra commentary."
    )

    prompt = f"""
Analyze the uploaded dataset and generate a clean, structured, professional report in STRICT JSON format.

The response must NOT be plain paragraphs or raw markdown.

Dataset schema:
{json.dumps(schema, indent=2)}

Cleaning actions:
{json.dumps(cleaning_log, indent=2)}

Charts generated:
{json.dumps([c.get("type") for c in charts], indent=2)}

Return the output using this exact structure:

{{
  "title": "Dataset Analysis Report",
  "summary": "Short overall summary of dataset findings",
  "key_insights": [
    {{
      "title": "Insight title",
      "description": "Detailed explanation",
      "importance": "high/medium/low"
    }}
  ],
  "anomalies": [
    {{
      "title": "Anomaly title",
      "description": "Explanation of anomaly",
      "severity": "high/medium/low"
    }}
  ],
  "recommendations": [
    {{
      "title": "Recommendation title",
      "description": "Actionable recommendation",
      "priority": "high/medium/low"
    }}
  ],
  "statistics": {{
    "missing_values": [],
    "numerical_summary": [],
    "categorical_summary": []
  }}
}}

Rules:
- Keep explanations concise but informative.
- Use professional business-style language.
- Avoid repeating the same information.
- Make insights meaningful and data-driven.
- Highlight trends, anomalies, correlations, and risks.
- Populate statistics.missing_values from schema where relevant.
- For numerical_summary use objects like {{"column": "...", "metric": "mean/median/std", "value": "..."}}.
- For categorical_summary use objects like {{"column": "...", "top_category": "...", "count": 0}}.
- If data is insufficient for a section, return an empty array.
- Do NOT include markdown formatting.
- Do NOT include code blocks.
- Output ONLY valid JSON.
"""

    try:
        response = call_llm(prompt, system_prompt=system_prompt)
        report = _parse_llm_json(response)
        if not isinstance(report, dict):
            raise ValueError("Insights response is not a JSON object")
        report = _enrich_insights_report(report, schema)
        state["insights"] = json.dumps(report)
        return state

    except Exception as e:
        fallback = _fallback_insights_report(schema, cleaning_log, charts, raw=str(e))
        state["insights"] = json.dumps(fallback)
        return state