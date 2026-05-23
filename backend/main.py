from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import json
import os
import pandas as pd
from .agent.graph import build_graph

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
graph = build_graph()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
UPLOAD_DIR = PROJECT_ROOT / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/run-agent")
async def run_agent(file: UploadFile = File(...)):
    path = str(UPLOAD_DIR / file.filename)

    try:
        with open(path, "wb") as f:
            f.write(await file.read())

        df = pd.read_csv(path)

        state = {
            "file_path": path,
            "df_sample": df.head(5).to_dict(orient="records"),
            "schema": {},
            "cleaning_log": [],
            "plot_plan": [],
            "charts": [],
            "insights": "",
            "needs_clarification": False,
            "error": ""
        }

        result = graph.invoke(state)
        error = result.get("error") or ""
        insights_raw = result.get("insights", "")
        insights = insights_raw
        if isinstance(insights_raw, str) and insights_raw.strip():
            try:
                insights = json.loads(insights_raw)
            except json.JSONDecodeError:
                insights = {
                    "title": "Dataset Analysis Report",
                    "summary": insights_raw,
                    "key_insights": [],
                    "anomalies": [],
                    "recommendations": [],
                    "statistics": {
                        "missing_values": [],
                        "numerical_summary": [],
                        "categorical_summary": [],
                    },
                }

        return {
            "status": "success" if not error else "error",
            "schema": result.get("schema"),
            "cleaning_log": result.get("cleaning_log"),
            "charts": result.get("charts"),
            "insights": insights,
            "error": error,
        }
    except Exception as e:
        return {
            "status": "error",
            "schema": {},
            "cleaning_log": [],
            "charts": [],
            "insights": "",
            "error": str(e),
        }