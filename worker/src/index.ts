// Placeholder entry so `wrangler dev` boots. Packet B02 replaces this file
// with the Hono app, routes and the TruffleDO.
import { DurableObject } from "cloudflare:workers";

export interface Env {
  TRUFFLE: DurableObjectNamespace;
  AI: Ai;
  BRAIN_TIMEOUT_MS: string;
  MODAL_URL?: string;
  MODAL_TOKEN?: string;
}

export class TruffleDO extends DurableObject<Env> {
  async fetch(_req: Request): Promise<Response> {
    return new Response("TruffleDO placeholder (B02)", { status: 501 });
  }
}

export default {
  async fetch(_req: Request, _env: Env): Promise<Response> {
    return new Response("truffle worker scaffold. routes land in B02.", {
      headers: { "content-type": "text/plain" }
    });
  }
} satisfies ExportedHandler<Env>;
