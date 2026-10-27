export type Timbre = "synth" | "drone" | "percussion" | "noise";
export interface Device {
  id: string;
  name: string;
  color: string;
  timbre: Timbre;
  raw: number;
  smooth: number;
  lastSeen: number;
  source: "demo" | "ble" | "simulation";
  volume: number;
  pitch: number;
  filter: number;
  distortion: number;
  glitch: number;
  pan: number;
  enabled: boolean;
}
export interface Settings {
  alpha: number;
  timeout: number;
  thresholds: number[];
}
export const settings: Settings = {
  alpha: 0.2,
  timeout: 3000,
  thresholds: [-50, -65, -80, -90],
};
export function strength(rssi: number, thresholds: number[]): number {
  return Math.max(
    0,
    Math.min(1, (rssi - thresholds[3]) / (thresholds[0] - thresholds[3])),
  );
}
export function band(rssi: number, t: number[]): number {
  // Separate the transition region from weak/glitch and very weak/intermittent.
  return rssi >= t[0]
    ? 0
    : rssi >= t[1]
      ? 1
      : rssi > t[2]
        ? 2
        : rssi > t[3]
          ? 3
          : 4;
}
export function online(d: Device, now: number, timeout: number) {
  return now - d.lastSeen <= timeout;
}
export class Store {
  devices = new Map<string, Device>();
  logs: string[] = ["timestamp,source,id,raw_rssi,ema_rssi"];
  ingest(
    id: string,
    rssi: number,
    source: "demo" | "ble" | "simulation",
    now = Date.now(),
    name = id,
  ) {
    if (
      !id ||
      id.length > 128 ||
      !Number.isFinite(rssi) ||
      rssi > 0 ||
      rssi < -127
    )
      return;
    let d = this.devices.get(id);
    if (!d) {
      if (this.devices.size >= 5) return;
      d = {
        id,
        name: name.slice(0, 40),
        color: ["#67e8c5", "#a8a0ff", "#ffc775", "#ff80ad", "#82caff"][
          this.devices.size
        ],
        timbre: "synth",
        raw: rssi,
        smooth: rssi,
        lastSeen: now,
        source,
        volume: 0.3,
        pitch: 220 + this.devices.size * 55,
        filter: 5000,
        distortion: 0.15,
        glitch: 0.2,
        pan: 0,
        enabled: true,
      };
      this.devices.set(id, d);
    }
    d.raw = rssi;
    d.smooth = online(d, now, settings.timeout)
      ? settings.alpha * rssi + (1 - settings.alpha) * d.smooth
      : rssi;
    d.lastSeen = now;
    // Prevent spreadsheet formula interpretation of externally supplied identifiers.
    const csvId = (/^[=+\-@\t\r]/.test(id) ? "'" + id : id).replaceAll(
      '"',
      '""',
    );
    this.logs.push(
      `${new Date(now).toISOString()},${source},"${csvId}",${rssi},${d.smooth.toFixed(2)}`,
    );
    if (this.logs.length > 20001) this.logs.splice(1, 1);
  }
  clear() {
    this.devices.clear();
  }
}
