"""Vertex AI Agent Engine Streaming Client.
"""

from typing import Optional
from .config import PROJECT_ID, LOCATION, REASONING_ENGINE_ID

remote_agent = None

try:
    import vertexai
    from vertexai import agent_engines

    vertexai.init(project=PROJECT_ID, location=LOCATION)
    if REASONING_ENGINE_ID:
        print(f"[*] Connecting to Vertex AI Agent Engine: {REASONING_ENGINE_ID}")
        remote_agent = agent_engines.get(REASONING_ENGINE_ID)
        print("[✓] Connected to Vertex AI Agent Engine successfully!")
except Exception as e:
    print(f"[!] Warning: Could not connect to remote Agent Engine ({e}). Local fallback enabled.")


async def execute_agent_query(prompt: str, user_id: str, session_id: Optional[str] = None) -> str:
    """Stream reasoning execution from the deployed Vertex AI Agent Engine."""
    if remote_agent:
        response_text = ""
        for event in remote_agent.stream_query(message=prompt, user_id=user_id):
            if isinstance(event, dict):
                if event.get("error_message"):
                    raise RuntimeError(event["error_message"])
                content = event.get("content")
                if content and isinstance(content, dict):
                    for part in content.get("parts", []):
                        if isinstance(part, dict) and "text" in part:
                            response_text += part["text"]
                elif event.get("output"):
                    response_text += str(event["output"])
        return response_text.strip() or "No response received from Agent Engine."

    # Fallback to local ADK agent runner if Agent Engine is not reachable
    from google.genai import types
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from agent.agent import root_agent

    session_service = InMemorySessionService()
    runner = Runner(
        agent=root_agent,
        app_name=root_agent.name,
        session_service=session_service,
        auto_create_session=True,
    )
    content = types.Content(role="user", parts=[types.Part.from_text(text=prompt)])
    
    response_text = ""
    async for event in runner.run_async(user_id=user_id, session_id=session_id or "default", new_message=content):
        if hasattr(event, "error_message") and event.error_message:
            raise RuntimeError(event.error_message)
        if hasattr(event, "content") and event.content:
            for part in event.content.parts:
                if hasattr(part, "text") and part.text:
                    response_text += part.text
        elif hasattr(event, "output") and event.output:
            response_text += str(event.output)
            
    return response_text.strip() or "No response generated."
