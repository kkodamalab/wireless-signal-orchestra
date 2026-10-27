import { describe, it, expect, vi, afterEach } from "vitest";
import { Store, settings, online, band, strength } from "../src/state";
import { BridgeConnection } from "../src/connection";
describe("RSSI state", () => {
  it("smooths independently and preserves raw values", () => {
    const s = new Store();
    s.ingest("a", -50, "demo", 1000);
    s.ingest("b", -80, "demo", 1000);
    s.ingest("a", -70, "demo", 1100);
    expect(s.devices.get("a")!.smooth).toBe(-54);
    expect(s.devices.get("a")!.raw).toBe(-70);
    expect(s.devices.get("b")!.smooth).toBe(-80);
  });
  it("expires, then resets stale EMA on recovery", () => {
    const s = new Store();
    s.ingest("a", -50, "ble", 1000);
    expect(online(s.devices.get("a")!, 4001, settings.timeout)).toBe(false);
    s.ingest("a", -90, "ble", 5000);
    expect(s.devices.get("a")!.smooth).toBe(-90);
  });
  it("handles thresholds and clamps mapping", () => {
    expect(
      [-50, -65, -80, -90].map((r) => band(r, settings.thresholds)),
    ).toEqual([0, 1, 3, 4]);
    expect(strength(-120, settings.thresholds)).toBe(0);
    expect(strength(-30, settings.thresholds)).toBe(1);
  });
  it("rejects invalid packets and limits devices to five", () => {
    const s = new Store();
    s.ingest("bad", NaN, "ble");
    for (let i = 0; i < 7; i++) s.ingest(String(i), -70, "ble");
    expect(s.devices.size).toBe(5);
    expect(s.logs[1]).toContain(",ble,");
  });
});
describe("bridge reconnect", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("receives valid messages, retries disconnect, cancels on stop", () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [];
    class FakeSocket {
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((e: { data: string }) => void) | null = null;
      constructor() {
        sockets.push(this);
      }
      close() {
        this.onclose?.();
      }
    }
    vi.stubGlobal("WebSocket", FakeSocket);
    const receive = vi.fn(),
      status = vi.fn();
    const c = new BridgeConnection(receive, status);
    c.connect("ws://localhost");
    sockets[0].onopen?.();
    sockets[0].onmessage?.({
      data: JSON.stringify({ type: "advertisement", id: "a", rssi: -60 }),
    });
    expect(receive).toHaveBeenCalledWith("a", -60, undefined, false);
    sockets[0].onmessage?.({ data: "broken" });
    expect(status).toHaveBeenCalledWith("不正なメッセージ");
    sockets[0].onclose?.();
    vi.advanceTimersByTime(2000);
    expect(sockets.length).toBe(2);
    sockets[1].onclose?.();
    c.stop();
    vi.advanceTimersByTime(5000);
    expect(sockets.length).toBe(2);
  });
});
