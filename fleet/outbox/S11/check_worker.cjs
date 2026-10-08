const h = require('./offline_harness.cjs');
const { assert, load, engine, fixture, deferredBrain, tick, chat, complete, test } = h;
(async () => {
  await test('chat lifecycle with delayed response', async () => {
    const f = await fixture({ energy: 3600, lifetime_steps: 3600 }, { demo_replies: { start_ms: h.now(), count: 29 } });
    const calls = deferredBrain();
    const a = await chat(f, 'Hello.', 'high');
    h.setClock(h.now() + 61000);
    const b = await chat(f, 'Hello again.', 'high');
    assert.equal(calls.length, 2);
    complete(calls[0]);
    await a.text;
    const intermediate = f.object.load();
    complete(calls[1]);
    await b.text;
    await f.drain();
    const after = f.object.load();
    assert.equal(after.m.demo_replies.count, 30);
    assert.equal(after.s.energy, 3200);
    return { calls: calls.length, tiers: calls.map(c => c.req.tier), replies_including_fixture: 31, recorded_replies: after.m.demo_replies.count, lock_after_first_completion: intermediate.m.chat_lock_until };
  });
  await test('chat completion after demo reset', async () => {
    const f = await fixture({ energy: 3600, lifetime_steps: 3600 });
    const calls = deferredBrain();
    const a = await chat(f, 'A private old-life conversation.', 'high');
    await f.object.reset(f.credential);
    await f.object.setSteps(f.credential, 3000);
    complete(calls[0], 'Old-life reply.');
    await a.text;
    await f.drain();
    const after = f.object.load();
    const turns = f.db.prepare('SELECT count(*) AS n FROM turns').get().n;
    assert.equal(after.s.energy, 2800);
    assert.equal(turns, 2);
    return { new_life_energy_before_completion: 3000, new_life_energy_after_completion: after.s.energy, old_life_turns_restored: turns, generation: after.m.generation };
  });
  await test('requested tier and prompt field agree', async () => {
    const f = await fixture({ energy: 3600, lifetime_steps: 3600 });
    const calls = deferredBrain();
    const a = await chat(f, 'Hello.', 'low');
    const req = calls[0].req;
    assert.equal(req.tier, 'low');
    assert.match(req.system, /tier=high/);
    complete(calls[0]);
    await a.text;
    await f.drain();
    return { requested: req.tier, prompt_tier: 'high', thinking: req.thinking, max_tokens: req.maxTokens, energy_after: f.object.load().s.energy };
  });
  await test('whitespace followed by a provider error', async () => {
    const f = await fixture({ energy: 3000, lifetime_steps: 3000 });
    const brain = load('brain');
    let modelCalls = 0;
    const ai = { AI: { run: async () => {
      modelCalls++;
      if (modelCalls === 2) throw new Error('mock provider unavailable');
      const data = new TextEncoder().encode('data: ' + JSON.stringify({ choices: [{ delta: { content: '  ' } }] }) + '\n\ndata: [DONE]\n\n');
      return new ReadableStream({ start(c) { c.enqueue(data); c.close(); } });
    } } };
    h.setBrain((_env, req) => brain.askBrain(ai, req));
    const a = await chat(f, 'Hello.', 'medium');
    const sse = await a.text;
    await f.drain();
    assert.equal(modelCalls, 2);
    assert.equal(f.object.load().s.energy, 2940);
    assert.match(sse, /"partial":true/);
    return { model_calls: modelCalls, visible_characters: 0, charged_energy: 60, partial_done: true };
  });
  for (const [label, outputs, expectedCalls, expectedCost] of [
    ['visible first response', ['Hello.'], 1, 60],
    ['empty then visible', ['', 'Hello.'], 2, 60],
    ['both responses empty', ['', ''], 2, 0]
  ]) {
    await test('retry charge accounting: ' + label, async () => {
      const f = await fixture({ energy: 3000, lifetime_steps: 3000 });
      let modelCalls = 0;
      const ai = { AI: { run: async () => {
        const content = outputs[modelCalls++];
        const bytes = new TextEncoder().encode('data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\n\ndata: [DONE]\n\n');
        return new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } });
      } } };
      h.setBrain((_env, req) => load('brain').askBrain(ai, req));
      const a = await chat(f, 'Hello.', 'medium');
      await a.text;
      await f.drain();
      const cost = 3000 - f.object.load().s.energy;
      assert.equal(modelCalls, expectedCalls);
      assert.equal(cost, expectedCost);
      return { model_calls: modelCalls, charged_energy: cost };
    });
  }
  await require('./check_data.cjs')(h);
  h.finish();
})().catch(e => { console.error(e.message); process.exitCode = 1; });
