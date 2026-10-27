"""BLE advertisements -> loopback WebSocket; optional local frontend hosting."""
import argparse
import asyncio
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from bleak import BleakScanner
from websockets.asyncio.server import serve


async def run(args):
    clients = set()
    queue = asyncio.Queue(maxsize=1000)

    def advertisement(device, data):
        if args.device and device.address.lower() not in args.device:
            return
        message = {"type": "advertisement", "id": device.address,
                   "name": data.local_name or device.name or device.address,
                   "rssi": data.rssi}
        if not queue.full():
            queue.put_nowait(json.dumps(message))

    async def handler(socket):
        clients.add(socket)
        try:
            await socket.wait_closed()
        finally:
            clients.discard(socket)

    async def broadcast():
        while True:
            message = await queue.get()
            for client in tuple(clients):
                try:
                    await client.send(message)
                except Exception:
                    clients.discard(client)

    origins = [f"http://127.0.0.1:{args.http_port}", f"http://localhost:{args.http_port}"]
    async with serve(handler, "127.0.0.1", args.ws_port, origins=origins):
        print(f"WebSocket: ws://127.0.0.1:{args.ws_port}", flush=True)
        task = asyncio.create_task(broadcast())
        try:
            if args.simulate:
                import math
                import time
                while True:
                    for i in range(3):
                        await queue.put(json.dumps({"type": "advertisement", "id": f"SIMULATED-{i}",
                                                   "name": f"SIMULATED {i}", "source": "simulation", "rssi": round(-65 + 20 * math.sin(time.time() + i))}))
                    await asyncio.sleep(.2)
            else:
                async with BleakScanner(detection_callback=advertisement):
                    await asyncio.Future()
        finally:
            task.cancel()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ws-port", type=int, default=8765)
    parser.add_argument("--http-port", type=int, default=8000)
    parser.add_argument("--device", action="append", default=[], help="BLE address allowlist; repeat up to 5 times")
    parser.add_argument("--simulate", action="store_true", help="Transport test only; NOT real BLE")
    args = parser.parse_args()
    args.device = [d.lower() for d in args.device]
    dist = Path(__file__).resolve().parents[1] / "dist"
    if not (dist / "index.html").exists():
        parser.error("Frontend missing: run npm ci && npm run build first")

    class Handler(SimpleHTTPRequestHandler):
        def translate_path(self, path):
            # Vite's GitHub Pages base also works on this local origin.
            if path.startswith('/wireless-signal-orchestra/'):
                path = path[len('/wireless-signal-orchestra'):]
            return super().translate_path(path)

    http = ThreadingHTTPServer(("127.0.0.1", args.http_port), functools.partial(Handler, directory=str(dist)))
    threading.Thread(target=http.serve_forever, daemon=True).start()
    print(f"Open http://127.0.0.1:{args.http_port}/wireless-signal-orchestra/", flush=True)
    try:
        asyncio.run(run(args))
    except KeyboardInterrupt:
        pass
    except Exception as error:
        print(f"Bridge failed: {error}. Check Bluetooth adapter, permissions and advertising devices.", flush=True)
        raise SystemExit(1) from error
    finally:
        http.shutdown()


if __name__ == "__main__":
    main()
