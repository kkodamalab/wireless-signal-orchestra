import "./style.css";
import {
  Store,
  settings,
  online,
  strength,
  type Device,
  type Timbre,
} from "./state";
import { AudioEngine } from "./audio";
import { BridgeConnection } from "./connection";
const store = new Store(),
  audio = new AudioEngine();
let mode: "demo" | "ble" = "demo",
  tab = "STAGE",
  automatic = true,
  count = 3,
  audioOn = false;
const blocked = new Set<string>();
const targets = new Map<string, number>();
const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
let density = 40,
  motion = 1,
  lines = true,
  ripples = true;
let connectionStatus = "未接続";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<canvas id="stage" aria-label="RSSI visual stage"></canvas><div class="shell"><header><div><small>PARTICIPATORY SIGNAL ART / 01</small><h1>Wireless Signal<br><em>Orchestra</em></h1></div><div class="badge" id="badge">● DEMO / 仮想信号</div></header><nav>${["STAGE", "DEVICES", "SOUND", "VISUAL", "DEBUG", "DEMO"].map((t) => `<button data-tab="${t}">${t}</button>`).join("")}</nav><main><section class="intro"><small>LISTEN TO THE INVISIBLE</small><h2>見えない電波を、<br>みんなの音に。</h2><p>信号のゆらぎが、音と光になる。<br>距離ではなく、この空間の気配を奏でます。</p><button id="audio" class="primary">▶ 音声を開始</button><button id="full">⛶ 全画面</button><button id="hide">パネルを隠す</button><p id="audio-status" role="status">音声はユーザー操作で開始します</p></section><section id="panel" class="panel"></section></main><footer><span>RSSI → EMA → SOUND + LIGHT</span><span id="summary"></span></footer></div><button id="show" hidden>操作パネルを表示</button>`;
const panel = document.querySelector<HTMLElement>("#panel")!;
function range(
  label: string,
  id: string,
  value: number,
  min: number,
  max: number,
  step = 1,
) {
  return `<label>${label}<input type="range" id="${id}" value="${value}" min="${min}" max="${max}" step="${step}"><output id="${id}-out">${value}</output></label>`;
}
function demoReset() {
  store.clear();
  blocked.clear();
  targets.clear();
  for (let i = 0; i < count; i++)
    store.ingest(
      `demo-${i + 1}`,
      -50 - i * 12,
      "demo",
      Date.now(),
      `Signal ${String(i + 1).padStart(2, "0")}`,
    );
}
function title(s: string, sub: string) {
  return `<small>CONTROL ROOM</small><h2>${s}</h2><p>${sub}</p>`;
}
function render() {
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) =>
      b.classList.toggle("selected", (b as HTMLElement).dataset.tab === tab),
    );
  if (tab === "STAGE")
    panel.innerHTML =
      title(
        "Signal field",
        mode === "demo"
          ? "DEMOは仮想データです。音声開始後、DEMOで信号を動かしてください。"
          : "PCブリッジから受信した信号を表示します。SIMULATION表示時は非実測です。",
      ) +
      `<div id="cards"></div><p class="notice">実機モードにはWindows PC側のPythonブリッジとBLE広告端末が必要です。</p>`;
  if (tab === "DEVICES")
    panel.innerHTML =
      title("Devices", "最大5台。名前・色・有効状態を割り当てられます。") +
      `<label>入力モード<select id="mode"><option value="demo">DEMO / 仮想信号</option><option value="ble">BLE / 実測信号</option></select></label><div id="bridge-controls"><label>WebSocket URL<input id="ws" value="ws://127.0.0.1:8765"></label><button id="connect">接続</button><p id="connection" role="status"></p><p class="notice">実機はブリッジのHTTP画面を使用してください。PagesのHTTPSからws://接続は使用しません。WSSには信頼済み証明書が必要です。</p></div><div id="cards"></div><div id="device-edit"></div>`;
  if (tab === "SOUND")
    panel.innerHTML =
      title(
        "Sound laboratory",
        "端末ごとの音源と、信号の校正。音量はゆっくり上げてください。",
      ) +
      range("EMA係数", "alpha", settings.alpha, 0.01, 1, 0.01) +
      range("受信途絶 (ms)", "timeout", settings.timeout, 500, 10000, 100) +
      settings.thresholds
        .map((v, i) =>
          range(
            ["明瞭 (dBm)", "中程度 (dBm)", "弱い (dBm)", "非常に弱い (dBm)"][i],
            `threshold-${i}`,
            v,
            -110,
            -20,
          ),
        )
        .join("") +
      '<p id="threshold-error" role="status"></p><div id="sound-edit"></div>';
  if (tab === "VISUAL")
    panel.innerHTML =
      title(
        "Visual field",
        "背景黒のステージ。描画数は端末あたり最大80粒子に制限。",
      ) +
      range("粒子数", "density", density, 5, 80) +
      range("揺らぎ", "motion", motion, 0, 3, 0.1) +
      `<label><input id="lines" type="checkbox" ${lines ? "checked" : ""}>接続線</label><label><input id="ripples" type="checkbox" ${ripples ? "checked" : ""}>波紋</label>`;
  if (tab === "DEBUG")
    panel.innerHTML =
      title(
        "Signal diagnostics",
        "直近20,000サンプルを保持。CSVは入力モードを明記します。",
      ) +
      `<button id="csv">CSV保存</button><p id="diagnostics"></p><pre id="log"></pre>`;
  if (tab === "DEMO")
    panel.innerHTML =
      title(
        "Demo playground",
        "実機不要。同じ音響・映像エンジンで仮想信号を体験します。",
      ) +
      `<label>仮想端末数<select id="count">${[2, 3, 4, 5].map((n) => `<option ${n === count ? "selected" : ""}>${n}</option>`).join("")}</select></label><label><input id="auto" type="checkbox" ${automatic ? "checked" : ""}>移動シミュレーション</label><div id="demo-edit"></div>`;
  bind();
  renderDeviceEditors();
  refresh();
}
function on(id: string, event: string, cb: (e: Event) => void) {
  document.getElementById(id)?.addEventListener(event, cb);
}
function bind() {
  on("mode", "change", (e) => {
    mode = (e.target as HTMLSelectElement).value as typeof mode;
    bridge.stop();
    store.clear();
    if (mode === "demo") demoReset();
    document.querySelector("#badge")!.textContent =
      mode === "demo" ? "● DEMO / 仮想信号" : "● BLE / 実測信号";
    render();
  });
  const select = document.querySelector<HTMLSelectElement>("#mode");
  if (select) select.value = mode;
  on("connect", "click", () => {
    const url = (document.querySelector("#ws") as HTMLInputElement).value;
    if (mode !== "ble") {
      connectionStatus = "BLEモードを選んでください";
      refresh();
      return;
    }
    try {
      const parsed = new URL(url);
      if (!["ws:", "wss:"].includes(parsed.protocol)) throw Error();
      if (location.protocol === "https:" && parsed.protocol === "ws:") {
        connectionStatus =
          "HTTPSからWSは使用不可。localhostのHTTP画面を開いてください";
        refresh();
        return;
      }
      bridge.connect(url);
    } catch {
      connectionStatus = "有効なws:// またはwss:// URLを入力してください";
      refresh();
    }
  });
  on(
    "alpha",
    "input",
    (e) => (settings.alpha = +(e.target as HTMLInputElement).value),
  );
  on(
    "timeout",
    "input",
    (e) => (settings.timeout = +(e.target as HTMLInputElement).value),
  );
  settings.thresholds.forEach((_, i) =>
    on(`threshold-${i}`, "input", (e) => {
      const next = [...settings.thresholds];
      next[i] = +(e.target as HTMLInputElement).value;
      const valid = next.every((v, j) => j === 0 || next[j - 1] > v);
      document.querySelector("#threshold-error")!.textContent = valid
        ? ""
        : "閾値は 明瞭 > 中程度 > 弱い > 非常に弱い の順です（変更は未適用）";
      if (valid) settings.thresholds = next;
    }),
  );
  on(
    "density",
    "input",
    (e) => (density = +(e.target as HTMLInputElement).value),
  );
  on(
    "motion",
    "input",
    (e) => (motion = +(e.target as HTMLInputElement).value),
  );
  on(
    "lines",
    "change",
    (e) => (lines = (e.target as HTMLInputElement).checked),
  );
  on(
    "ripples",
    "change",
    (e) => (ripples = (e.target as HTMLInputElement).checked),
  );
  on("count", "change", (e) => {
    count = +(e.target as HTMLSelectElement).value;
    if (mode === "demo") demoReset();
    render();
  });
  on(
    "auto",
    "change",
    (e) => (automatic = (e.target as HTMLInputElement).checked),
  );
  on("csv", "click", () => {
    const url = URL.createObjectURL(
      new Blob([store.logs.join("\n")], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "signal-orchestra.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  panel.querySelectorAll("input[type=range]").forEach((el) =>
    el.addEventListener("input", () => {
      const input = el as HTMLInputElement;
      const out = document.getElementById(input.id + "-out");
      if (out) out.textContent = input.value;
    }),
  );
}
function renderDeviceEditors() {
  const devices = [...store.devices.values()];
  const edit = document.querySelector("#device-edit");
  if (edit) {
    edit.innerHTML =
      devices
        .map(
          (d) =>
            `<article><label>端末名<input data-name="${escape(d.id)}" value="${escape(d.name)}" maxlength="40"></label><label>色<input type="color" data-color="${escape(d.id)}" value="${d.color}"></label><label><input type="checkbox" data-enable="${escape(d.id)}" ${d.enabled ? "checked" : ""}>音源を有効化</label><small>${escape(d.id)}</small></article>`,
        )
        .join("") ||
      "<p>広告を待機しています。最初の5端末を自動登録します。</p>";
    edit.querySelectorAll("input").forEach((el) =>
      el.addEventListener("input", () => {
        const x = el as HTMLInputElement;
        const id = x.dataset.name ?? x.dataset.color ?? x.dataset.enable!;
        const d = store.devices.get(id)!;
        if (x.dataset.name) d.name = x.value;
        if (x.dataset.color) d.color = x.value;
        if (x.dataset.enable) d.enabled = x.checked;
      }),
    );
  }
  const sound = document.querySelector("#sound-edit");
  if (sound) {
    sound.innerHTML = devices
      .map(
        (d, i) =>
          `<article><h3>${escape(d.name)}</h3><label>音源<select data-timbre="${escape(d.id)}">${["synth", "drone", "percussion", "noise"].map((t) => `<option ${t === d.timbre ? "selected" : ""}>${t}</option>`).join("")}</select></label>${(
            [
              "volume",
              "pitch",
              "filter",
              "distortion",
              "glitch",
              "pan",
            ] as const
          )
            .map((k) => {
              const limits = {
                volume: [0, 1, 0.01],
                pitch: [55, 880, 1],
                filter: [100, 12000, 100],
                distortion: [0, 1, 0.01],
                glitch: [0, 1, 0.01],
                pan: [-1, 1, 0.01],
              }[k];
              return range(
                k,
                `sound-${i}-${k}`,
                d[k],
                ...(limits as [number, number, number]),
              );
            })
            .join("")}</article>`,
      )
      .join("");
    sound
      .querySelectorAll("select")
      .forEach((el) =>
        el.addEventListener(
          "change",
          () =>
            (store.devices.get(el.dataset.timbre!)!.timbre =
              el.value as Timbre),
        ),
      );
    devices.forEach((d, i) =>
      (
        ["volume", "pitch", "filter", "distortion", "glitch", "pan"] as const
      ).forEach((k) =>
        on(`sound-${i}-${k}`, "input", (e) => {
          d[k] = +(e.target as HTMLInputElement).value;
          document.getElementById(`sound-${i}-${k}-out`)!.textContent = String(
            d[k],
          );
        }),
      ),
    );
  }
  const demo = document.querySelector("#demo-edit");
  if (demo) {
    demo.innerHTML =
      mode !== "demo"
        ? "<p>DEVICESでDEMOモードに切り替えてください。</p>"
        : devices
            .map(
              (d, i) =>
                `<article><h3>${escape(d.name)}</h3>${range("RSSI (dBm)", `rssi-${i}`, d.raw, -110, -30)}<button id="occlude-${i}">人体遮蔽 −20dB / 2秒</button><button id="loss-${i}">${blocked.has(d.id) ? "受信再開" : "受信途絶"}</button></article>`,
            )
            .join("");
    devices.forEach((d, i) => {
      on(`rssi-${i}`, "input", (e) => {
        automatic = false;
        const a = document.querySelector<HTMLInputElement>("#auto");
        if (a) a.checked = false;
        const input = e.target as HTMLInputElement;
        targets.set(d.id, +input.value);
        document.getElementById(`rssi-${i}-out`)!.textContent = input.value;
      });
      on(`occlude-${i}`, "click", () => {
        occlusion.set(d.id, Date.now() + 2000);
      });
      on(`loss-${i}`, "click", () => {
        if (blocked.has(d.id)) blocked.delete(d.id);
        else blocked.add(d.id);
        document.getElementById(`loss-${i}`)!.textContent = blocked.has(d.id)
          ? "受信再開"
          : "受信途絶";
      });
    });
  }
}
function refresh() {
  const now = Date.now();
  document.querySelector("#summary")!.textContent =
    `${store.devices.size} SIGNALS / ${mode.toUpperCase()}`;
  const cards = document.querySelector("#cards");
  if (cards)
    cards.innerHTML = [...store.devices.values()]
      .map(
        (d) =>
          `<article class="signal"><span style="color:${d.color}">●</span> ${escape(d.name)}<strong>${d.smooth.toFixed(1)} <small>dBm</small></strong><small>${online(d, now, settings.timeout) ? "受信中" : "受信途絶"} · ${d.source.toUpperCase()} · RAW ${d.raw} · ${Math.max(0, (now - d.lastSeen) / 1000).toFixed(1)}秒前<br>LAST ${new Date(d.lastSeen).toLocaleTimeString()}</small><meter min="-110" max="-30" value="${d.smooth}"></meter></article>`,
      )
      .join("");
  const c = document.querySelector("#connection");
  if (c) c.textContent = connectionStatus;
  const diag = document.querySelector("#diagnostics");
  if (diag)
    diag.textContent = `${mode.toUpperCase()} | ${connectionStatus} | 音声: ${audio.ctx?.state ?? "未開始"} | EMA ${settings.alpha} | timeout ${settings.timeout}ms`;
  const log = document.querySelector("#log");
  if (log) log.textContent = store.logs.slice(-12).join("\n");
}
const bridge = new BridgeConnection(
  (id, rssi, name, simulated) => {
    const size = store.devices.size;
    store.ingest(id, rssi, simulated ? "simulation" : "ble", Date.now(), name);
    if (simulated)
      document.querySelector("#badge")!.textContent =
        "● SIMULATION / 輸送テスト・非実測";
    if (size !== store.devices.size) renderDeviceEditors();
  },
  (s) => {
    connectionStatus = s;
  },
);
const occlusion = new Map<string, number>();
demoReset();
render();
document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach(
  (b) =>
    (b.onclick = () => {
      tab = b.dataset.tab!;
      render();
    }),
);
on("audio", "click", async () => {
  try {
    if (audioOn) await audio.stop();
    else await audio.start();
    audioOn = !audioOn;
    document.querySelector("#audio")!.textContent = audioOn
      ? "■ 音声を停止"
      : "▶ 音声を開始";
    document.querySelector("#audio-status")!.textContent = audioOn
      ? "音声出力中"
      : "音声停止";
  } catch (e) {
    document.querySelector("#audio-status")!.textContent =
      `音声開始失敗: ${String(e)}`;
  }
});
on("full", "click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    document.querySelector("#audio-status")!.textContent =
      "このブラウザは全画面に対応していません";
  }
});
on("hide", "click", () => {
  document.querySelector<HTMLElement>(".shell")!.hidden = true;
  document.querySelector<HTMLButtonElement>("#show")!.hidden = false;
});
on("show", "click", () => {
  document.querySelector<HTMLElement>(".shell")!.hidden = false;
  document.querySelector<HTMLButtonElement>("#show")!.hidden = true;
});
setInterval(() => {
  const now = Date.now();
  if (mode === "demo")
    [...store.devices.values()].forEach((d, i) => {
      if (blocked.has(d.id)) return;
      const base = automatic
        ? -66 + 22 * Math.sin(now / 3500 + i * 1.7)
        : (targets.get(d.id) ?? -50 - i * 12);
      const raw = Math.round(
        base - ((occlusion.get(d.id) ?? 0) > now ? 20 : 0),
      );
      store.ingest(d.id, raw, "demo", now);
    });
  audio.update(store.devices, now);
  refresh();
}, 100);
const canvas = document.querySelector<HTMLCanvasElement>("#stage")!,
  ctx = canvas.getContext("2d")!;
let w = 0,
  h = 0;
function resize() {
  w = innerWidth;
  h = innerHeight;
  const ratio = Math.min(devicePixelRatio, 2);
  canvas.width = w * ratio;
  canvas.height = h * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
addEventListener("resize", resize);
resize();
function draw(t: number) {
  ctx.fillStyle = "#060a10";
  ctx.fillRect(0, 0, w, h);
  const devices = [...store.devices.values()],
    points: { x: number; y: number; d: Device; s: number }[] = [];
  devices.forEach((d, i) => {
    const s = online(d, Date.now(), settings.timeout)
      ? strength(d.smooth, settings.thresholds)
      : 0;
    const angle = (i / Math.max(devices.length, 1)) * Math.PI * 2 + t * 0.00005;
    const x = w * 0.66 + Math.cos(angle) * Math.min(w * 0.19, 220),
      y = h * 0.5 + Math.sin(angle) * Math.min(h * 0.23, 180);
    points.push({ x, y, d, s });
    ctx.strokeStyle = d.color;
    ctx.fillStyle = d.color;
    ctx.globalAlpha = 0.15 + s * 0.5;
    ctx.lineWidth = 1 + s * 3;
    ctx.beginPath();
    ctx.arc(x, y, 25 + s * 55, 0, Math.PI * 2);
    ctx.stroke();
    if (ripples)
      for (let r = 0; r < 3; r++) {
        ctx.globalAlpha = (1 - ((t * 0.0002 + r / 3) % 1)) * (0.03 + s * 0.15);
        ctx.beginPath();
        ctx.arc(x, y, 30 + ((t * 0.0002 + r / 3) % 1) * 150, 0, Math.PI * 2);
        ctx.stroke();
      }
    for (let p = 0; p < Math.floor(density * (0.2 + s * 0.8)); p++) {
      const a = p * 2.399 + t * 0.0002 * motion;
      const radius =
        Math.sqrt(p / density) * 160 +
        (1 - s) * Math.sin(p + t * 0.002) * 25 * motion;
      ctx.globalAlpha = 0.1 + s * 0.65;
      ctx.beginPath();
      ctx.arc(
        x + Math.cos(a) * radius,
        y + Math.sin(a) * radius,
        1 + s * 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  });
  if (lines)
    points.forEach((p, i) => {
      const q = points[(i + 1) % points.length];
      if (!q) return;
      ctx.strokeStyle = p.d.color;
      ctx.globalAlpha = 0.08 + p.s * 0.2;
      ctx.lineWidth = 0.5 + p.s * 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    });
  ctx.globalAlpha = 1;
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
