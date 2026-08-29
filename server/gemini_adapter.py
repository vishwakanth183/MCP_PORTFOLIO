import os
import uuid

from google import genai
from google.genai import types

from model_adapter import Message, ModelAdapter, ModelResponse, ToolCall, ToolSpec

DEFAULT_MODEL = "gemini-2.5-flash"


class GeminiAdapter(ModelAdapter):
    def __init__(self, api_key: str | None = None, model: str | None = None):
        api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Put it in a .env file (see .env.example) "
                "or export it before starting the chat server."
            )
        self._client = genai.Client(api_key=api_key)
        self._model = model or os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)

    def generate(
        self,
        history: list[Message],
        tools: list[ToolSpec],
        system_instruction: str,
    ) -> ModelResponse:
        contents = _history_to_contents(history)
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=[_tools_to_gemini_tool(tools)] if tools else None,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(
                disable=True
            ),
        )

        response = self._client.models.generate_content(
            model=self._model, contents=contents, config=config
        )

        candidate = response.candidates[0] if response.candidates else None
        if candidate is None or candidate.content is None:
            return ModelResponse(text=None, tool_calls=[])

        text_parts: list[str] = []
        tool_calls: list[ToolCall] = []
        for part in candidate.content.parts or []:
            if part.function_call is not None:
                fc = part.function_call
                tool_calls.append(
                    ToolCall(
                        id=fc.id or f"{fc.name}-{uuid.uuid4().hex[:8]}",
                        name=fc.name,
                        arguments=dict(fc.args or {}),
                    )
                )
            elif part.text:
                text_parts.append(part.text)

        return ModelResponse(
            text="\n".join(text_parts) if text_parts else None,
            tool_calls=tool_calls,
        )


def _tools_to_gemini_tool(tools: list[ToolSpec]) -> types.Tool:
    declarations = [
        types.FunctionDeclaration(
            name=tool.name,
            description=tool.description,
            parameters_json_schema=_simplify_schema(tool.input_schema),
        )
        for tool in tools
    ]
    return types.Tool(function_declarations=declarations)


def _simplify_schema(schema: dict) -> dict:
    """FastMCP/pydantic emit JSON Schema 2020-12 (anyOf[X, null] for optional
    fields, title/default noise). Gemini's function-calling schema is a
    stricter OpenAPI-style subset, so collapse Optional[X] -> X and drop the
    fields it doesn't understand before handing the schema over."""
    if not isinstance(schema, dict):
        return schema

    schema = dict(schema)
    schema.pop("title", None)
    schema.pop("default", None)

    if "anyOf" in schema:
        variants = [v for v in schema["anyOf"] if v.get("type") != "null"]
        if len(variants) == 1:
            merged = _simplify_schema(variants[0])
            schema = {**merged, **{k: v for k, v in schema.items() if k != "anyOf"}}
            schema.pop("anyOf", None)
        else:
            schema.pop("anyOf", None)
            schema.setdefault("type", "string")

    if schema.get("type") == "object" and "properties" in schema:
        schema["properties"] = {
            key: _simplify_schema(value) for key, value in schema["properties"].items()
        }

    return schema


def _history_to_contents(history: list[Message]) -> list[types.Content]:
    contents: list[types.Content] = []
    pending_tool_parts: list[types.Part] = []

    def flush_tool_parts():
        if pending_tool_parts:
            contents.append(types.Content(role="user", parts=list(pending_tool_parts)))
            pending_tool_parts.clear()

    for message in history:
        if message.role == "tool":
            # Gemini expects all function_response parts for a given round
            # bundled into a single Content, not one Content per tool call.
            pending_tool_parts.append(
                types.Part.from_function_response(
                    name=message.name or "",
                    response={"result": message.content},
                )
            )
            continue

        flush_tool_parts()

        if message.role == "user":
            contents.append(
                types.Content(role="user", parts=[types.Part(text=message.content)])
            )
        elif message.role == "assistant":
            parts = []
            if message.content:
                parts.append(types.Part(text=message.content))
            for call in message.tool_calls:
                parts.append(
                    types.Part(
                        function_call=types.FunctionCall(
                            id=call.id, name=call.name, args=call.arguments
                        )
                    )
                )
            contents.append(types.Content(role="model", parts=parts))

    flush_tool_parts()
    return contents
