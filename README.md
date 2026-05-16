# KV-Tube

KV-Tube la ung dung xem YouTube tu host rieng, gom backend Go, frontend Next.js, ung dung desktop Electron va wrapper mobile Capacitor.

## Thanh phan chinh

| Thanh phan | Cong nghe | Thu muc | Cong mac dinh |
| --- | --- | --- | --- |
| Backend API | Go, Gin, SQLite | `backend` | `8080` |
| Frontend web | Next.js | `frontend` | `3000` |
| Desktop app | Electron | `frontend/electron` | phu thuoc URL web |
| Android app | Capacitor Android | `frontend/android` | phu thuoc URL web |
| Docker app | Go + Next.js + supervisord | root repo | `5011`, `8981` |

## Tai ban build hien co

Luu y: cac file build ben duoi la artifact tao ra sau khi build trong workspace/release, khong nen commit truc tiep vao source Git vi dung luong lon. Khi phat hanh chinh thuc, upload cac file nay vao GitHub Releases roi cap nhat link release tuong ung.

| Nen tang | File tai | Ghi chu |
| --- | --- | --- |
| Android APK | [`frontend/android/app/build/outputs/apk/debug/app-debug.apk`](frontend/android/app/build/outputs/apk/debug/app-debug.apk) | Debug APK, load web tu `http://103.116.38.112:5011` |
| macOS Apple Silicon | [`frontend/dist-desktop/KV-Tube-0.1.0-arm64.dmg`](frontend/dist-desktop/KV-Tube-0.1.0-arm64.dmg) | Ban self-contained, chay backend va web local trong app |
| macOS Intel | [`frontend/dist-desktop/KV-Tube-0.1.0.dmg`](frontend/dist-desktop/KV-Tube-0.1.0.dmg) | Ban self-contained, chay backend va web local trong app |
| Windows | [`frontend/dist-desktop/KV-Tube Setup 0.1.0.exe`](frontend/dist-desktop/KV-Tube%20Setup%200.1.0.exe) | Neu co artifact sau khi build Windows |
| Linux | [`frontend/dist-desktop/KV-Tube-0.1.0.AppImage`](frontend/dist-desktop/KV-Tube-0.1.0.AppImage) | Neu co artifact sau khi build Linux |
| Docker | [`kechettreo/tubepre:latest`](https://hub.docker.com/r/kechettreo/tubepre) | Image Docker Hub dang dung cho VPS |

## Phan biet cach app load server

- Android APK load web tu VPS qua `KVTUBE_ANDROID_SERVER_URL`, mac dinh `http://103.116.38.112:5011`.
- Android web runtime goi API qua `NEXT_PUBLIC_API_BASE_URL`, mac dinh khi build Docker/APK la `http://103.116.38.112:8981`.
- macOS app la ban self-contained: Electron tu chay backend Go local, tu chay Next.js local va khong can `http://103.116.38.112:5011`.
- Docker/VPS chay frontend o `http://103.116.38.112:5011` va backend API o `http://103.116.38.112:8981`.

## Yeu cau chung

- Git
- Node.js 20 tro len va npm
- Go 1.25 tro len
- Docker Desktop hoac Docker Engine, neu chay bang Docker
- FFmpeg va yt-dlp, neu chay backend truc tiep tren may

Neu chi muon chay nhanh app web, dung Docker la cach don gian nhat vi image da cai san FFmpeg va yt-dlp.

## Cai dat theo he dieu hanh

### Windows

1. Cai Git: https://git-scm.com/download/win
2. Cai Node.js LTS 20+: https://nodejs.org
3. Cai Go 1.25+: https://go.dev/dl
4. Cai Docker Desktop neu muon chay bang Docker: https://www.docker.com/products/docker-desktop
5. Cai FFmpeg va yt-dlp neu chay backend truc tiep:

```powershell
winget install Gyan.FFmpeg
winget install yt-dlp.yt-dlp
```

Clone source:

```powershell
git clone https://github.com/aiautotool/tubepre.git
cd kv-tube
```

### macOS

1. Cai Xcode Command Line Tools:

```bash
xcode-select --install
```

2. Cai Homebrew neu chua co: https://brew.sh
3. Cai cac goi can thiet:

```bash
brew install node@20 go ffmpeg yt-dlp
```

4. Cai Docker Desktop neu muon chay bang Docker: https://www.docker.com/products/docker-desktop

Clone source:

```bash
git clone https://github.com/aiautotool/tubepre.git
cd kv-tube
```

### Linux Ubuntu/Debian

1. Cai cac goi he thong:

```bash
sudo apt update
sudo apt install -y git curl ffmpeg
```

2. Cai yt-dlp:

```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

3. Cai Node.js 20:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

4. Cai Go 1.25+ tu https://go.dev/dl hoac package manager cua distro.
5. Cai Docker Engine neu muon chay bang Docker: https://docs.docker.com/engine/install

Clone source:

```bash
git clone https://github.com/aiautotool/tubepre.git
cd kv-tube
```

## Chay nhanh bang Docker

Docker Hub:

- Repository: https://hub.docker.com/r/kechettreo/tubepre
- Image: `kechettreo/tubepre:latest`

File `docker-compose.yml` hien tai da cau hinh san image `kechettreo/tubepre:latest`.

Chay bang Docker Compose:

```bash
mkdir -p data
docker compose pull
docker compose up -d
```

Mo app:

- Frontend: http://localhost:5011
- Backend API: http://localhost:8981

Xem log:

```bash
docker compose logs -f
```

Dung app:

```bash
docker compose down
```

Chay nhanh bang `docker run` neu khong dung Compose:

```bash
mkdir -p data
docker pull kechettreo/tubepre:latest
docker run -d \
  --name kv-tube \
  --restart unless-stopped \
  -p 5011:3000 \
  -p 8981:8080 \
  -v "$PWD/data:/app/data" \
  -e KVTUBE_DATA_DIR=/app/data \
  -e GIN_MODE=release \
  -e NODE_ENV=production \
  -e CORS_ALLOWED_ORIGINS=http://localhost:5011,http://103.116.38.112:5011 \
  kechettreo/tubepre:latest
```

Cap nhat container len image moi nhat:

```bash
docker pull kechettreo/tubepre:latest
docker compose up -d --force-recreate
```

Neu muon build image local thay vi pull image co san, sua `docker-compose.yml`: comment dong `image: kechettreo/tubepre:latest`, bo comment khoi `build`, roi chay:

```bash
docker compose up -d --build
```

## Chay moi truong development

Can mo 2 terminal.

Terminal 1, chay backend:

```bash
cd backend
go mod download
go run main.go
```

Terminal 2, chay frontend:

```bash
cd frontend
npm install
npm run dev
```

Mo http://localhost:3000.

Frontend se proxy cac request `/api/*` sang backend qua bien `NEXT_PUBLIC_API_BASE_URL`. Mac dinh la `http://localhost:8080`.

Neu backend chay cong khac:

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:8981 npm run dev
```

Tren Windows PowerShell:

```powershell
cd frontend
$env:NEXT_PUBLIC_API_BASE_URL="http://localhost:8981"
npm run dev
```

## Build web va backend

### Build frontend Next.js

```bash
cd frontend
npm install
npm run build
npm run start
```

App Next.js production chay o http://localhost:3000.

### Build backend Go

macOS/Linux:

```bash
cd backend
go mod download
go build -o kv-tube .
./kv-tube
```

Windows PowerShell:

```powershell
cd backend
go mod download
go build -o kv-tube.exe .
.\kv-tube.exe
```

## Build desktop app theo OS

Desktop app la Electron app. Ban macOS hien tai dong goi self-contained: app tu chay backend Go local, Next.js local va cac tool can thiet trong app bundle. Neu dat `KVTUBE_DESKTOP_SERVER_URL`, Electron se load URL do thay vi server bundled, chi nen dung cho debug.

### macOS

Build tren may macOS.

```bash
cd frontend
npm install
npm run build
npm run desktop:mac
```

Build rieng Intel:

```bash
npm run desktop:mac:intel
```

Build rieng Apple Silicon:

```bash
npm run desktop:mac:apple
```

File `.dmg` se nam trong `frontend/dist-desktop`.

### Windows

Build tren Windows la cach on dinh nhat.

PowerShell:

```powershell
cd frontend
npm install
$env:KVTUBE_DESKTOP_SERVER_URL="https://your-kv-tube.example.com"
npm run desktop:win
```

File cai dat `.exe` se nam trong `frontend/dist-desktop`.

### Linux

Du an hien chua co script build Electron rieng cho Linux trong `frontend/package.json`. Tren Linux, nen chay ban web bang Docker hoac build web/backend truc tiep.

Neu muon them goi desktop Linux, co the bo sung target `AppImage`, `deb` hoac `rpm` vao cau hinh `build` cua `frontend/package.json`, sau do them script Electron Builder tuong ung.

## Build Android

Yeu cau:

- Android Studio
- JDK phu hop voi Android Gradle Plugin
- Android SDK da cai trong Android Studio

Android app la Capacitor wrapper va se load URL web duoc cau hinh bang `KVTUBE_ANDROID_SERVER_URL`. Mac dinh hien tai la `http://103.116.38.112:5011`.

Sync va mo Android Studio:

```bash
cd frontend
npm install
KVTUBE_ANDROID_SERVER_URL=https://your-kv-tube.example.com npm run android:sync
npm run android:open
```

Tren Windows PowerShell:

```powershell
cd frontend
npm install
$env:KVTUBE_ANDROID_SERVER_URL="https://your-kv-tube.example.com"
npm run android:sync
npm run android:open
```

Build APK hoac AAB trong Android Studio bang menu Build.

## Build iOS

Yeu cau:

- macOS
- Xcode
- Apple Developer account neu can ky va phat hanh app

Du an co thu muc `frontend/ios`, nhung `package.json` chua co script `ios:sync` va `ios:open`. Co the dung Capacitor CLI truc tiep:

```bash
cd frontend
npm install
KVTUBE_ANDROID_SERVER_URL=https://your-kv-tube.example.com npx cap sync ios
npx cap open ios
```

Sau khi Xcode mo project, chon team/signing va build tu Xcode.

Luu y: bien URL trong `capacitor.config.ts` dang ten `KVTUBE_ANDROID_SERVER_URL`, nen iOS cung se dung bien nay neu chay Capacitor CLI truc tiep.

## Bien moi truong quan trong

| Bien | Mac dinh | Mo ta |
| --- | --- | --- |
| `PORT` | `8080` | Cong backend Go |
| `KVTUBE_DATA_DIR` | `./data` hoac `/app/data` | Thu muc SQLite va du lieu |
| `GIN_MODE` | `release` | Che do Gin |
| `CORS_ALLOWED_ORIGINS` | tuy moi truong | Danh sach origin duoc phep goi API |
| `NEXT_PUBLIC_API_BASE_URL` | rong | API base public cho Android runtime; desktop/web mac dinh dung `/api` same-origin |
| `KVTUBE_DESKTOP_SERVER_URL` | rong | Tuy chon debug: URL web ma app desktop load thay cho server bundled |
| `KVTUBE_ANDROID_SERVER_URL` | `http://103.116.38.112:5011` | URL web ma app mobile load |
| `AIAUTOTOOL_BASE_URL` | `https://api9.aiautotool.com/v1` | Base URL AI API trong Docker Compose |
| `AIAUTOTOOL_MODEL` | `cx/gpt-5.5` | Model AI trong Docker Compose |
| `AIAUTOTOOL_API_KEY` | rong | API key neu dung tinh nang AI |

## Cau truc thu muc

```text
.
├── backend/              # Go API, SQLite models, services
├── frontend/             # Next.js, Electron, Capacitor
├── data/                 # Du lieu runtime local
├── docker-compose.yml    # Chay app bang Docker Compose
├── Dockerfile            # Build image Go + Next.js
└── supervisord.conf      # Quan ly process trong container
```

## Loi thuong gap

- `yt-dlp: command not found`: cai yt-dlp hoac chay bang Docker.
- `ffmpeg: command not found`: cai FFmpeg hoac chay bang Docker.
- Frontend goi API loi CORS: cap nhat `CORS_ALLOWED_ORIGINS` de them domain frontend.
- Desktop/mobile mo sai server: set lai `KVTUBE_DESKTOP_SERVER_URL` hoac `KVTUBE_ANDROID_SERVER_URL`, sau do build/sync lai.
- Port da duoc dung: doi mapping port trong `docker-compose.yml` hoac doi `PORT` khi chay backend.

## License

Du an su dung MIT License. Xem file `LICENSE`.
