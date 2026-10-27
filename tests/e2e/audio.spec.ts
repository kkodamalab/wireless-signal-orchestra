import { test, expect } from "@playwright/test";
test("all timbres render finite audible samples and stale devices become silent", async ({
  page,
}) => {
  await page.goto("./");
  const results = await page.evaluate(async () => {
    const audioPath = "/wireless-signal-orchestra/src/audio.ts",
      statePath = "/wireless-signal-orchestra/src/state.ts";
    const { AudioEngine } = await import(audioPath),
      { Store } = await import(statePath);
    const results = [];
    for (const timbre of ["synth", "drone", "percussion", "noise", "stale"]) {
      const context = new OfflineAudioContext(2, 44100, 44100),
        engine = new AudioEngine(),
        store = new Store();
      engine.ctx = context;
      engine.master = context.createGain();
      engine.master.gain.value = 0.45;
      engine.master.connect(context.destination);
      store.ingest("test", -50, "demo", Date.now());
      const d = store.devices.get("test");
      d.timbre = timbre === "stale" ? "synth" : timbre;
      if (timbre === "stale") d.lastSeen = 0;
      engine.update(store.devices, Date.now());
      const paused = context.suspend(0.1);
      const rendered = context.startRendering();
      await paused;
      engine.update(store.devices, Date.now());
      await context.resume();
      const buffer = await rendered;
      const samples = buffer.getChannelData(0);
      let peak = 0,
        finite = true;
      for (const value of samples) {
        peak = Math.max(peak, Math.abs(value));
        finite = finite && Number.isFinite(value);
      }
      results.push({ timbre, peak, finite });
    }
    return results;
  });
  for (const result of results) {
    expect(result.finite).toBe(true);
    expect(result.peak).toBeLessThan(1);
    if (result.timbre === "stale") expect(result.peak).toBe(0);
    else expect(result.peak).toBeGreaterThan(0.001);
  }
});
