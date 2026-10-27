# Wireless Signal Orchestra

BLEの受信信号強度（RSSI）を音と映像に変換する、参加型インタラクティブメディアアート作品です。参加者がBLE広告端末を持って動くと、信号の変化が複数の音源と光の変化として表れます。通信断や音声ストリームの劣化を起こす必要はありません。

## MVPの構成

- **DEMO**：ブラウザだけで2〜5台の仮想信号を生成。スライダー、移動、人体遮蔽（2秒）、受信途絶を再現します。起動時の標準モードです。
- **実機**：Windows PCのPython/Bleakが接続確立なしでBLE広告をスキャン → loopback WebSocket → 同一のTypeScript音響・Canvasエンジン。
- 最初の5端末を自動登録。DEVICESで名前・色・音源有効状態、SOUNDで端末ごとの音色と各パラメータを変更できます。対象を限定するにはブリッジの `--device` を使用します。設定はメモリ内のみで、リロード時に初期化します。
- RSSIは距離そのものではありません。メートル換算は行いません。向き、人体遮蔽、マルチパス、干渉も表現の入力です。

公開先（デプロイ完了はGitHub Actionsで確認）：https://kkodamalab.github.io/wireless-signal-orchestra/

## Web開発・DEMO

Node.js 22.12以上（検証環境: 24）、npmを使用します。

```sh
npm ci
npm run dev
# 表示された /wireless-signal-orchestra/ を開く
npm run lint
npm test
npm run build
npx playwright install chromium
# ブリッジE2E用: Python環境の作成・依存導入は次節を参照
# Pythonがpythonで実行でき、bleak/websocketsがインストール済みであること
# 別環境なら BRIDGE_PYTHON（Python実行ファイル）を指定
npm run test:e2e
```

STAGE / DEVICES / SOUND / VISUAL / DEBUG / DEMOで操作します。音声は「音声を開始」を押すまで出ません。ブラウザの音量を下げてから開始してください。DEMOの自動移動を切るとスライダーが固定値になります。途絶ボタン後、設定タイムアウトを過ぎるとフェードアウトします。

## Windows側セットアップ・実機モード

Windows 10/11、Python 3.11以上、動作するBluetooth LEアダプター、BLE広告を発信できる端末2〜5台を用意します。WindowsのBluetoothと必要なプライバシー設定を有効にしてください。

PowerShellでリポジトリのルートから：

```powershell
npm ci
npm run build
py -3 -m venv .venv
.venv\Scripts\python -m pip install -r bridge/requirements.txt
.venv\Scripts\python bridge/server.py
```

`http://127.0.0.1:8000/wireless-signal-orchestra/` を同じPCのブラウザで開き、DEVICES → BLE / 実測信号 → 接続。既定のURLは `ws://127.0.0.1:8765`。スマホからこのloopback URLは開けません。音と映像はPCが担当します。

まず周辺の広告を確認し、必要なら対象アドレスだけに絞って再起動します。

```powershell
.venv\Scripts\python bridge/server.py --device AA:BB:CC:DD:EE:FF --device 11:22:33:44:55:66
```

ブリッジはloopbackだけにバインドし、WebSocketはローカルHTTP画面のOriginのみ受け付けます。インターネットへ公開しないでください。端末IDはOSが通知するアドレスであり、端末のプライバシー機構で変わる場合があります。認証済みの恒久IDとは扱いません。

### PagesとローカルWSのセキュリティ

GitHub Pagesは静的HTTPS配信なので、BLEスキャンはできません。HTTPS → `ws://` は混在コンテンツやローカルネットワーク権限等の制約があるため、本アプリはこの組合せを拒否します。**実機モードの標準経路はブリッジによるlocalhost HTTP配信です。** 同じHTTP Originからloopback WSへ接続する経路を自動ブラウザ検証します。

Pagesからの実機接続が必要なら、信頼済み証明書付きWSSとHTTPS Originの許可を別途設計してください。本MVPには証明書配布・WSSサーバーは含みません。未検証のWSS方式を完成とはしていません。

### BLE機器の条件

- MVPの優先対象はBLEビーコンや、BLE peripheral advertisingをサポートするAndroid端末＋広告発信アプリです。通常のスマホWebブラウザだけで広告を発信できるとは仮定しません。
- Androidは機種のadvertising対応確認が必要です。Android 12以上は `BLUETOOTH_ADVERTISE` / `BLUETOOTH_CONNECT` / 必要に応じて `BLUETOOTH_SCAN` の実行時権限、旧OSは位置情報等の条件があります。バックグラウンド制限・省電力・メーカー差で広告が停止する場合があります。まず前景で検証してください。
- iOS CoreBluetoothの広告は任意ペイロードを自由に送れる仕組みではありません。バックグラウンドではローカル名が省略され、サービスUUIDの扱いや検出可能性も変わります。iBeacon送信にも前景等の制約があります。iPhoneにはネイティブ補助アプリが必要になる場合があり、Windowsからの安定検出は未検証です。
- BLEペアリングやGATT接続は必須ではありません。広告をPCが受信できることが条件です。

## 音と信号の校正

各端末について生RSSI、EMA、最終受信時刻を保持します。EMA係数（0.01〜1）と受信途絶時間（500〜10000ms）はSOUNDで調整可能。途絶からの復帰時は古いEMAをリセットします。

初期閾値は -50 / -65 / -80 / -90 dBm。明瞭、中程度のフィルタ・歪み、弱いノイズ・グリッチ、非常に弱い断続音へ変化し、途絶で無音へ向かいます。閾値は強い順に設定してください。-90以下が断続音となり、-80〜-90はノイズ・グリッチ、-65〜-80は遷移領域です。実際の音や設置環境を確認しながら校正してください。

シンセ、ドローン、パーカッション、ノイズを選択できます。volume / pitch / filter / distortion / glitch / pan は端末単位です。ゲインの時間変化とマスターコンプレッサーで急変を緩和します。ただし聴感・スピーカー出力は現場で確認してください。

VISUALで粒子数・揺らぎ・線・波紋を調整できます。粒子数上限、devicePixelRatio上限を設けています。全画面はブラウザ対応時のみ。パネル非表示で黒背景のステージになります。

DEBUGのCSVは直近20,000サンプルを保存します。UTC ISO時刻、データ種別、ID、生RSSI、EMAを含みます。モードを切り替えてもログを保持し、source列で区別します。位置や個人の行動に結び付ける場合は参加者の同意と保存範囲を確認してください。

## トラブルシューティング

- 音が出ない：音声開始、タブのミュート、OSの出力先、端末の有効化、受信タイムアウトを確認。
- 信号がない：Bluetooth、広告アプリの前景実行、電池、権限、対象アドレス、アダプターを確認。RSSIは広告イベントから取得し、device.rssiには依存しません。
- Windowsでスキャン開始失敗：他のBLEツールを閉じ、Pythonを通常のコンソールから実行。GUI/COM STAを初期化する別アプリに組み込まず、専用プロセスで実行。
- WebSocketエラー：ブリッジのログ、ポート8000/8765、ローカルHTTP画面かを確認。切断後は2秒ごとに再接続します。Origin違反は標準のローカルURLへ戻します。
- 5台より多い：最初の5台だけを登録。`--device` で限定し、入力モードを切り替えて登録をリセット。
- `Frontend missing`：先に `npm run build`。`--http-port` でHTTPポートを変えた場合は、そのポートのローカル画面を開きます。

## 検証と公開

単体テストはEMA・閾値・受信途絶/復帰・独立した複数端末・不正パケット・上限・WebSocket再接続を対象とします。PlaywrightはPC/スマホ幅、DEMO操作、音声開始、CSV、途絶、操作パネルを確認します。

ブリッジの `--simulate` はWebSocket輸送検証専用で、実機BLEの成功を示しません。画面にSIMULATIONと表示し、CSVのsource列にもsimulationと記録します。Windows/Bluetooth/実際の広告機器、音響出力の聴感、現場性能は実機検証が必要です。

`.github/workflows/ci.yml` がLint・テスト・ビルド・Playwrightを実行します。`pages.yml` はmain更新時にdistをPagesへデプロイします。リポジトリ Settings → Pages → Sourceで **GitHub Actions** を選択してください。公開成功はActionsと公開URLで確認してください。

## ライセンス

MIT License。詳細は[LICENSE](LICENSE)を参照してください。
