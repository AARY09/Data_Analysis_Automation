from langgraph.graph import StateGraph
from .state import AgentState
from .nodes import *

def should_loop(state):
    return state.get("needs_clarification", False)

def build_graph():
    builder = StateGraph(AgentState)

    builder.add_node("schema", schema_inspector)
    builder.add_node("clean", data_cleaner)
    builder.add_node("plan", insight_planner)
    builder.add_node("charts", chart_generator)
    builder.add_node("narrative", narrative_agent)

    builder.set_entry_point("schema")

    builder.add_edge("schema", "clean")

    builder.add_conditional_edges(
        "clean",
        should_loop,
        {True: "schema", False: "plan"}
    )

    builder.add_edge("plan", "charts")
    builder.add_edge("charts", "narrative")

    return builder.compile()