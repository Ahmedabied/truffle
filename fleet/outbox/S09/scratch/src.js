const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const BUDGETS = { low: 120, medium: 400, high: 1200 };
const PERSONA = [
  "You are Truffle, a desert truffle (faqa) that lives as a small creature in a phone.",
  "You only have the energy your person's steps give you.",
];
const LANGUAGE = "Reply in the language given by lang. Keep to the effort your energy allows.";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, model: MODEL });
    }
    if (request.method !== "POST" || url.pathname !== "/run") {
      return new Response("Not found", { status: 404 });
    }

    const prompt = await request.json();
    if (
      !Object.hasOwn(BUDGETS, prompt.tier) ||
      !["en", "ar"].includes(prompt.lang) ||
      typeof prompt.user !== "string" ||
      typeof prompt.state_block !== "string" ||
      !prompt.state_block.startsWith("[truffle ") ||
      /[\r\n]/.test(prompt.state_block)
    ) {
      return new Response("Invalid baseline prompt", { status: 400 });
    }

    const system = [...PERSONA, prompt.state_block, LANGUAGE].join("\n");
    const input_options = {
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt.user },
      ],
      max_tokens: BUDGETS[prompt.tier],
      temperature: 1.0,
      top_p: 0.95,
      stream: false,
      chat_template_kwargs: { enable_thinking: false },
    };
    const started = Date.now();
    try {
      const raw_response = await env.AI.run(MODEL, input_options);
      return Response.json({
        id: prompt.id,
        model: MODEL,
        system,
        user: prompt.user,
        input_options,
        raw_response,
        latency_ms: Date.now() - started,
      });
    } catch (error) {
      return Response.json(
        { id: prompt.id, error: "Workers AI request failed", kind: error.name },
        { status: 502 },
      );
    }
  },
};
