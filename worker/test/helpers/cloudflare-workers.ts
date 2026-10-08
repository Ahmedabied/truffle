// Test stand-in for the "cloudflare:workers" module (vitest.config.ts aliases
// it here). Node has no workerd runtime, so the DO base class only keeps ctx
// and env, like the real one does for our purposes.
export class DurableObject<Env = unknown> {
  protected ctx: DurableObjectState;
  protected env: Env;
  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }
}
