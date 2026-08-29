"""
Minimal MCP client for PortfolioMCP.

Connects to the local portfolio_server over stdio, discovers its tools,
resources and prompts, then exercises a couple of each to prove the
end-to-end MCP loop works without any web UI involved.
"""

import asyncio
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

SERVER_SCRIPT = Path(__file__).resolve().parent.parent / "server" / "portfolio_server.py"


async def main() -> None:
    server_params = StdioServerParameters(
        command=sys.executable,
        args=[str(SERVER_SCRIPT)],
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await session.list_tools()
            print("Tools:", [t.name for t in tools.tools])

            resources = await session.list_resources()
            print("Resources:", [str(r.uri) for r in resources.resources])

            prompts = await session.list_prompts()
            print("Prompts:", [p.name for p in prompts.prompts])

            print("\n--- calling get_skills() ---")
            skills = await session.call_tool("get_skills", {})
            for block in skills.content:
                print(getattr(block, "text", block))

            print("\n--- calling get_projects() ---")
            projects = await session.call_tool("get_projects", {})
            for block in projects.content:
                print(getattr(block, "text", block))

            print("\n--- reading resource portfolio://profile ---")
            profile = await session.read_resource("portfolio://profile")
            for content in profile.contents:
                print(getattr(content, "text", content))

            print("\n--- fetching prompt recruiter_summary ---")
            prompt = await session.get_prompt("recruiter_summary")
            for message in prompt.messages:
                print(message.role, "->", message.content)


if __name__ == "__main__":
    asyncio.run(main())
