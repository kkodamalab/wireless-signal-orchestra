export class BridgeConnection {
  socket: WebSocket | null = null;
  timer: ReturnType<typeof setTimeout> | undefined;
  stopped = true;
  constructor(
    private receive: (
      id: string,
      rssi: number,
      name?: string,
      simulated?: boolean,
    ) => void,
    private status: (s: string) => void,
  ) {}
  connect(url: string) {
    this.stop();
    this.stopped = false;
    this.open(url);
  }
  private open(url: string) {
    if (this.stopped) return;
    this.status("接続中");
    try {
      const s = new WebSocket(url);
      this.socket = s;
      s.onopen = () => this.status("接続済み");
      s.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data);
          if (
            m.type === "advertisement" &&
            typeof m.id === "string" &&
            typeof m.rssi === "number"
          )
            this.receive(
              m.id,
              m.rssi,
              typeof m.name === "string" ? m.name : undefined,
              m.source === "simulation",
            );
          else if (m.type === "error")
            this.status("BLEエラー: " + String(m.message));
        } catch {
          this.status("不正なメッセージ");
        }
      };
      s.onerror = () => this.status("接続エラー");
      s.onclose = () => {
        if (!this.stopped) {
          this.status("切断・2秒後に再接続");
          this.timer = setTimeout(() => this.open(url), 2000);
        }
      };
    } catch {
      this.status("URLが不正です");
    }
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
    this.status("未接続");
  }
}
