import { http, HttpResponse } from "msw";

export const handlers = [
  http.post("https://api.anthropic.com/v1/messages", () =>
    HttpResponse.json({
      id: "msg_test",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "stubbed" }],
      model: "claude-sonnet-4-5",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    }),
  ),
];
