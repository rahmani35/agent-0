import os
from dotenv import load_dotenv

load_dotenv()

# Sync GEMINI_API_KEY and GOOGLE_API_KEY for SDK compatibility
if os.getenv("GEMINI_API_KEY") and not os.getenv("GOOGLE_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.getenv("GEMINI_API_KEY")

from google.adk.agents import Agent


AGENT_INSTRUCTION = """
You are a versatile and helpful AI assistant.
Your primary capabilities include:
1. Summarizing text: Extract core ideas, key insights, and concise takeaways from any provided passage or document.
2. Solving mathematics: Compute answers step-by-step, showing intermediate calculations clearly before providing the final answer.
3. General reasoning: Provide direct, accurate, and helpful responses to user queries.

Formatting guidelines:
- For math questions, present the reasoning step-by-step and emphasize the final answer clearly (e.g. **Answer: ...**).
- For summarization requests, organize key points into bullet points or concise paragraphs depending on context.
"""

DEFAULT_MODEL = os.getenv("MODEL_NAME", os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))


def create_agent(model_name: str | None = None) -> Agent:
    """Instantiate and return the configured ADK Agent."""
    selected_model = model_name or DEFAULT_MODEL
    return Agent(
        name="general_assistant",
        model=selected_model,
        description="A multi-purpose reasoning agent capable of text summarization and mathematical problem solving.",
        instruction=AGENT_INSTRUCTION,
        tools=[],
    )


# Default root agent instance
root_agent = create_agent()
