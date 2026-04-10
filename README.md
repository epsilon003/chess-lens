# ♛ ChessLens — AI Chess Analysis Web App

A full-stack chess analysis application:
- **Image recognition**: upload a photo of any physical board → auto-detect position
- **Stockfish 16 WASM**: instant in-browser engine analysis (no server round-trip)
- **Game library**: save, browse, and replay games
- **Google Auth**: sign in with Google via Firebase
- **Responsive**: works on phone and desktop

All free services. No paid APIs.

---

## Architecture

![Architecture](assets/Architecture.PNG)

---

## Project Structure

```
chess-analyzer/
├── assets/
├── frontend/            # React + Vite SPA
│   └── src/
│       ├── components/  # Navbar, Board, AnalysisPanel etc.
│       ├── hooks/       # useStockfish, useAuth
│       ├── pages/       # Landing, Analyze, Games, GameDetail
│       ├── services/    # Firestore CRUD
│       └── workers/     # Stockfish Web Worker
├── backend/             # Express API(proxies to vision-service)
├── vision-service/      # Python Flask + OpenCV + PyTorch CNN
├── firestore.rules      # Security rules
└── firebase.json        # Firebase Hosting config
```
---
## Key Tech Decisions

| Choice | Reason |
|--------|--------|
| Stockfish WASM in browser | No server cost, no latency, full depth analysis |
| Firebase Auth | Free Google OAuth without building your own auth server |
| Firestore | Free tier (50k reads/day); no SQL setup |
| MobileNetV3-Small | Fast, accurate, runs on CPU — no GPU needed for inference |
| React + Vite | Fast dev server, great ecosystem, HMR |
| Render.com | Free hobby tier for always-on Node/Python services |

---
## Recognition Model

Detects chess pieces from board images and outputs FEN strings.

### Model Characteristics

| Property | Value |
|----------|-------|
| Architecture | MobileNetV3-Small |
| Input | 64×64 RGB cell image |
| Output | 13-class prediction (K Q R B N P k q r b n p .) |
| Parameters | ~1.5M |
| Weights file | `model_weights.pth` |

### Dataset

| Property | Value |
|----------|-------|
| Dataset | [ChessRender360](https://www.kaggle.com/datasets/mmkoya/chessrender360) |
| Total images | 10,000 rendered chess positions |
| Image size | 2000×2000 RGB |
| Cell samples | 640,000 (64 per image) |
| Train / Val split | 80% / 20% |

### Training

| Property | Value |
|----------|-------|
| Epochs | 10 (fine-tuned from 30-epoch checkpoint) |
| Batch size | 128 |
| Learning rate | 3e-3 |
| Optimizer | Adam |
| Scheduler | StepLR (step=10, gamma=0.5) |
| Device | Tesla T4 GPU |

### Inference Pipeline

1. Photo is taken from phone browser and sent to Flask server
2. `find_board()` detects and perspective-warps the board to 512×512
3. Board is sliced into 64 cells (one per square)
4. MobileNetV3 classifies each cell into one of 13 classes
5. Predictions are assembled into a valid FEN string

### Output Format

```
recognize_board(image_bytes) → {{'fen': 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', 'confidence': 0.87}}
```
---
## Firestore Database Schema

```
Firestore
│
└── users/                          ← top-level collection
    └── {uid}/                      ← one document per Google user
        │    (uid = Firebase Auth user ID)
        │
        └── games/                  ← subcollection inside each user
            └── {gameId}/           ← auto-generated document ID
                  title:     string
                  notes:     string
                  fen:       string   ← board position at save time
                  pgn:       string   ← full game in PGN format
                  moves:     array    ← ["e4", "e5", "Nf3", ...]
                  createdAt: timestamp
                  updatedAt: timestamp
```

---
## How to Run on your Local Machine

1. Run
   ```
   git clone https://github.com/epsilon003/chess-lens.git
   ```
2. Open the folder in your IDE and navigate to the "frontend" sub-folder
   ```
   cd frontend
   ```
3. Finally run
   ```
   npm install
   npm run dev
   ```
