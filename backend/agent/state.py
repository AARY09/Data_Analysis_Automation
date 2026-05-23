from typing import TypedDict, List, Dict, Any

class AgentState(TypedDict):
    file_path: str
    df_sample: List[Dict[str, Any]]
    schema: Dict[str, Any]
    cleaning_log: List[Dict[str, Any]]
    plot_plan: List[Dict[str, Any]]
    charts: List[Dict[str, Any]]
    insights: str
    needs_clarification: bool
    error: str