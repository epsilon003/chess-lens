# ♛ ChessLens — AI Chess Analysis Web App

A full-stack chess analysis application:
- 📷 **Image recognition**: upload a photo of any physical board → auto-detect position
- ⚡ **Stockfish 16 WASM**: instant in-browser engine analysis (no server round-trip)
- 💾 **Game library**: save, browse, and replay games
- 🔐 **Google Auth**: sign in with Google via Firebase
- 📱 **Responsive**: works on phone and desktop

All free services. No paid APIs.

---

## Architecture

```
browser (React + Stockfish WASM)
    ↕  REST
Express backend (Node.js)
    ↕  REST
Flask vision microservice (Python + OpenCV + PyTorch)
    ↕  SDK
Firebase (Auth + Firestore)
```

---

## Project Structure

```
chess-analyzer/
├── frontend/              # React + Vite SPA
│   └── src/
│       ├── components/    # Navbar, Board, AnalysisPanel, ImageUpload…
│       ├── hooks/         # useStockfish, useAuth
│       ├── pages/         # Landing, Analyze, Games, GameDetail
│       ├── services/      # Firestore CRUD
│       └── workers/       # Stockfish Web Worker
├── backend/               # Express API (proxies to vision service)
├── vision-service/        # Python Flask + OpenCV + PyTorch CNN
├── firestore.rules        # Security rules
└── firebase.json          # Firebase Hosting config
```

---

## Setup Instructions

### 1 · Firebase

1. Go to https://console.firebase.google.com
2. Create a project → "chess-analyzer"
3. **Authentication** → Sign-in method → Enable **Google**
4. **Firestore Database** → Create database → Start in **test mode** (switch to production rules before going live)
5. **Project Settings** → Add a Web App → copy the `firebaseConfig` object
6. Paste it into `frontend/src/firebase.js` replacing the placeholder values
7. Deploy security rules (once Firebase CLI is installed):
   ```bash
   firebase deploy --only firestore:rules
   ```

### 2 · Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

**Build for production:**
```bash
npm run build        # outputs to frontend/dist/
```

### 3 · Backend

```bash
cd backend
cp .env.example .env      # edit VISION_SERVICE_URL if needed
npm install
npm run dev          # http://localhost:5000
```

The backend is a thin proxy — it accepts the image upload from the browser
and forwards it to the Python vision service. It also handles CORS.

### 4 · Vision Service

**Install Python dependencies (Python 3.10+):**
```bash
cd vision-service
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
pip install cairosvg             # needed for synthetic dataset generation
```

**Generate a synthetic training dataset:**
```bash
python generate_dataset.py --output ./dataset --samples 300
```
This creates ~3 900 augmented piece images (300 per class × 13 classes).

> For a more accurate model, supplement with real photos.
> A good free dataset: search "Chess Piece Images" on Kaggle.

**Train the CNN:**
```bash
python board_recognizer.py --train --data ./dataset --epochs 30 --output model_weights.pth
```
Expected accuracy on synthetic data: ~95 %+.
On real board photos the first-time accuracy will be lower — add real images to `./dataset` and retrain.

**Start the service:**
```bash
python app.py        # http://localhost:8000
```

---

## Running Everything Together (Development)

Open 3 terminals:

```bash
# Terminal 1 — Vision service
cd vision-service && source venv/bin/activate && python app.py

# Terminal 2 — Backend
cd backend && npm run dev

# Terminal 3 — Frontend
cd frontend && npm run dev
```

Then open http://localhost:5173

---

## Deployment (Free Tier)

### Frontend → Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting      # point to frontend/dist
cd frontend && npm run build
firebase deploy --only hosting
```

### Backend → Render.com (free)

1. Push repo to GitHub
2. Create a new **Web Service** on render.com
3. Build command: `cd backend && npm install`
4. Start command: `node backend/server.js`
5. Add environment variables: `VISION_SERVICE_URL`, `ALLOWED_ORIGINS`

### Vision Service → Render.com (free)

1. Create another **Web Service**
2. Runtime: Python 3
3. Build command: `pip install -r vision-service/requirements.txt`
4. Start command: `python vision-service/app.py`
5. Upload `model_weights.pth` as a persistent disk or re-train on deploy

Update `VISION_SERVICE_URL` in your backend env vars to the Render URL.
Update `firebase.json` rewrite to point to your deployed backend URL.

---

## Improving Recognition Accuracy

The CNN in `board_recognizer.py` uses MobileNetV3-Small.
To improve accuracy on real board photos:

1. **Collect real data** — photograph boards from above, slice into cells, label them
2. **Use transfer learning** — the model is initialized with ImageNet weights (`pretrained=True`)
3. **Add more augmentation** — motion blur, perspective distortion, lighting gradients
4. **Use a larger model** — swap MobileNetV3-Small for ResNet-34 in `build_model()`

---

## Key Tech Decisions

| Choice | Reason |
|--------|--------|
| Stockfish WASM in browser | No server cost, no latency, full depth analysis |
| Firebase Auth | Free Google OAuth without building your own auth server |
| Firestore | Free tier (50k reads/day) is plenty for student project; no SQL setup |
| MobileNetV3-Small | Fast, accurate, runs on CPU — no GPU needed for inference |
| React + Vite | Fast dev server, great ecosystem, HMR |
| Render.com | Free hobby tier for always-on Node/Python services |

---

## Firestore Data Model

```
users/
  {uid}/
    games/
      {gameId}:
        title:     string
        notes:     string
        fen:       string        ← position FEN
        pgn:       string        ← full game PGN
        moves:     string[]      ← move history in SAN
        createdAt: Timestamp
        updatedAt: Timestamp
```

---

## License

MIT — free for personal and academic use.
