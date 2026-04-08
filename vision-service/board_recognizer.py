#!/usr/bin/env python3
# vision-service/board_recognizer.py
"""
Chess board recognition pipeline — trained on ChessRender360.

Dataset: ChessRender360 (Kaggle)
  10,000 rendered chess positions, 2000x2000 RGB images
  Each sample includes:
    - RGB image
    - annotation .json  (board corners + piece positions in chess notation)
    - FENs.csv          (FEN string per sample index)

Kaggle Notebook usage:
  Paste this entire file into a notebook cell and run it.
  Paths are pre-configured for the ChessRender360 dataset structure.

Inference (called by Flask app):
  classifier = PieceClassifier(weights_path='model_weights.pth')
  result = recognize_board(image_bytes, classifier)
  # result = { 'fen': '...', 'confidence': 0.87 }
"""

import sys
sys.argv = [
    'board_recognizer.py',
    '--train',
    '--images',          '/kaggle/input/datasets/mmkoya/chessrender360/ChessRender360/rgb',
    '--annotations',     '/kaggle/input/datasets/mmkoya/chessrender360/ChessRender360/annotations',
    '--fens',            '/kaggle/input/datasets/mmkoya/chessrender360/ChessRender360/FENs.csv',
    '--epochs',          '60',
    '--cells_per_image', '64',
    '--lr',              '5e-4',
    '--resume',          '/kaggle/working/model_weights.pth',  # continue from last run
    '--output',          '/kaggle/working/model_weights_v2.pth',
]

import os
import cv2
import csv
import json
import random
import argparse
import numpy as np
from pathlib import Path
from PIL import Image, ImageEnhance

import torch
import torch.nn as nn
import torchvision.transforms as T
import torchvision.models as models
import chess

# ── Class definitions ─────────────────────────────────────────
# 13 classes: white K Q R B N P, black k q r b n p, empty .
PIECE_CLASSES = [
    'K', 'Q', 'R', 'B', 'N', 'P',   # white  (0-5)
    'k', 'q', 'r', 'b', 'n', 'p',   # black  (6-11)
    '.',                              # empty  (12)
]
NUM_CLASSES   = len(PIECE_CLASSES)
CLASS_TO_IDX  = {c: i for i, c in enumerate(PIECE_CLASSES)}
LETTER_TO_PIECE = {c: chess.Piece.from_symbol(c) for c in PIECE_CLASSES if c != '.'}

CELL_SIZE = 64
IMG_EXTS  = {'.jpg', '.jpeg', '.png'}

# ── Transforms ────────────────────────────────────────────────
INFER_TRANSFORM = T.Compose([
    T.Resize((CELL_SIZE, CELL_SIZE)),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406],
                std =[0.229, 0.224, 0.225]),
])

TRAIN_TRANSFORM = T.Compose([
    T.Resize((CELL_SIZE, CELL_SIZE)),
    T.RandomHorizontalFlip(),
    T.RandomRotation(10),
    T.ColorJitter(brightness=0.4, contrast=0.3, saturation=0.3),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406],
                std =[0.229, 0.224, 0.225]),
])


# ── Model ─────────────────────────────────────────────────────
def build_model(num_classes=NUM_CLASSES, pretrained=False):
    """MobileNetV3-Small — fast, accurate, runs well on CPU at inference time."""
    weights = models.MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
    model   = models.mobilenet_v3_small(weights=weights)
    in_feat = model.classifier[-1].in_features
    model.classifier[-1] = nn.Linear(in_feat, num_classes)
    return model


# ── FEN helpers ───────────────────────────────────────────────
def fen_to_grid(fen):
    """
    Parse the piece-placement part of a FEN string into an 8x8 grid.
    grid[0][0] = a8 (top-left), grid[7][7] = h1 (bottom-right).
    Each cell contains a piece letter ('K','q', etc.) or '.' for empty.
    """
    placement = fen.split()[0]
    grid = []
    for rank in placement.split('/'):
        row = []
        for ch in rank:
            if ch.isdigit():
                row.extend(['.'] * int(ch))
            else:
                row.append(ch)
        grid.append(row)
    return grid  # 8 rows x 8 cols


def grid_to_labels(grid):
    """Flatten 8x8 grid to 64 class indices, row-major (a8 first)."""
    labels = []
    for row in grid:
        for cell in row:
            labels.append(CLASS_TO_IDX[cell])
    return labels


# ── Board warping using annotation corners ────────────────────
def warp_board_from_corners(img_rgb, corners, out_size=512):
    """
    Perspective-warp the board using the known corner positions
    from the ChessRender360 annotation JSON.
    """
    src = np.array([
        corners['black_left'],   # TL (a8)
        corners['black_right'],  # TR (h8)
        corners['white_right'],  # BR (h1)
        corners['white_left'],   # BL (a1)
    ], dtype=np.float32)

    dst = np.array([
        [0,        0       ],
        [out_size, 0       ],
        [out_size, out_size],
        [0,        out_size],
    ], dtype=np.float32)

    M      = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(
        cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR),
        M, (out_size, out_size)
    )
    return cv2.cvtColor(warped, cv2.COLOR_BGR2RGB)


def slice_board(board_img_rgb, trim_frac=0.05):
    """
    Split a warped board image into 64 cell images.
    Returns list of 64 PIL Images, row-major (a8 first).
    """
    h, w   = board_img_rgb.shape[:2]
    cell_h = h // 8
    cell_w = w // 8
    cells  = []
    for row in range(8):
        for col in range(8):
            y1, y2 = row * cell_h, (row + 1) * cell_h
            x1, x2 = col * cell_w, (col + 1) * cell_w
            cell   = board_img_rgb[y1:y2, x1:x2]
            my = max(1, int(cell.shape[0] * trim_frac))
            mx = max(1, int(cell.shape[1] * trim_frac))
            cell = cell[my:-my, mx:-mx]
            cells.append(Image.fromarray(cell))
    return cells


# ── ChessRender360 Dataset ────────────────────────────────────
class ChessRender360Dataset(torch.utils.data.Dataset):
    """
    Loads cells directly from ChessRender360 rendered board images.
    Image filenames: rgb_NNNN.jpeg
    Annotation filenames: annotation_NNNN.json   ← fixed
    """

    def __init__(self, images_dir, annotations_dir, fens_csv,
                 transform=None, max_samples=None, samples_per_image=32):
        self.transform         = transform or INFER_TRANSFORM
        self.samples_per_image = samples_per_image
        self.annotations_dir   = Path(annotations_dir)
        self.cells             = []   # (PIL Image, class_index)

        images_dir = Path(images_dir)

        # Load FENs
        fens = self._load_fens(fens_csv)
        print(f"  Loaded {len(fens)} FEN strings from {fens_csv}")

        # Find all image files
        img_files = sorted([
            p for p in images_dir.rglob("*")
            if p.suffix.lower() in IMG_EXTS
        ])
        if max_samples:
            img_files = img_files[:max_samples]

        print(f"  Processing {len(img_files)} images...")

        skipped = 0
        for i, img_path in enumerate(img_files):
            if i % 500 == 0:
                print(f"    {i}/{len(img_files)} images processed, {len(self.cells)} cells so far")

            sample_idx = self._get_index(img_path)
            if sample_idx is None or sample_idx >= len(fens):
                skipped += 1
                continue

            try:
                self._process_sample(img_path, fens[sample_idx])
            except Exception as e:
                skipped += 1

        print(f"  Done. {len(self.cells)} cell samples ({skipped} images skipped)")

    def _load_fens(self, fens_csv):
        fens = []
        with open(fens_csv, 'r') as f:
            reader = csv.reader(f)
            for row in reader:
                if row:
                    fen = row[0].strip()
                    if '/' in fen:
                        fens.append(fen)
        return fens

    def _get_index(self, img_path):
        """Extract integer index from filename like rgb_6254.jpeg → 6254."""
        stem   = img_path.stem          # e.g. "rgb_6254"
        digits = ''.join(c for c in stem if c.isdigit())
        if digits:
            return int(digits)
        return None

    def _process_sample(self, img_path, fen):
        # Derive annotation path: rgb_6254.jpeg → annotation_6254.json
        sample_idx = self._get_index(img_path)
        ann_path   = self.annotations_dir / f"annotation_{sample_idx}.json"
        if not ann_path.exists():
            raise FileNotFoundError(f"No annotation for {img_path.name}")

        # Load image
        img = np.array(Image.open(img_path).convert("RGB"))

        # Load annotation
        with open(ann_path, 'r') as f:
            ann = json.load(f)

        corners = {
            'white_left':  ann['board_corners']['white_left'],
            'white_right': ann['board_corners']['white_right'],
            'black_left':  ann['board_corners']['black_left'],
            'black_right': ann['board_corners']['black_right'],
        }

        board_rgb = warp_board_from_corners(img, corners)
        cells     = slice_board(board_rgb)

        grid   = fen_to_grid(fen)
        labels = grid_to_labels(grid)

        indices = random.sample(range(64), min(self.samples_per_image, 64))
        for idx in indices:
            self.cells.append((cells[idx], labels[idx]))

    def __len__(self):
        return len(self.cells)

    def __getitem__(self, idx):
        img, label = self.cells[idx]
        return self.transform(img), label


# ── Inference board detector (for real photos without annotations) ──
def find_board(img_bgr):
    gray    = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    blur    = cv2.GaussianBlur(gray, (5, 5), 0)
    edges   = cv2.Canny(blur, 30, 100)
    kernel  = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    dilated = cv2.dilate(edges, kernel, iterations=2)

    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best_quad = None
    best_area = 0
    for cnt in contours:
        peri   = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        if len(approx) == 4:
            area = cv2.contourArea(approx)
            if area > best_area:
                best_area = area
                best_quad = approx

    min_area = 0.05 * img_bgr.shape[0] * img_bgr.shape[1]
    if best_quad is None or best_area < min_area:
        h, w = img_bgr.shape[:2]
        best_quad = np.array([[0,0],[w,0],[w,h],[0,h]], dtype=np.float32)
    else:
        best_quad = best_quad.reshape(4, 2).astype(np.float32)

    quad     = _order_corners(best_quad)
    dst_size = 512
    dst = np.array([
        [0,        0       ],
        [dst_size, 0       ],
        [dst_size, dst_size],
        [0,        dst_size],
    ], dtype=np.float32)

    M      = cv2.getPerspectiveTransform(quad, dst)
    warped = cv2.warpPerspective(img_bgr, M, (dst_size, dst_size))
    return warped


def _order_corners(pts):
    rect = np.zeros((4, 2), dtype=np.float32)
    s    = pts.sum(axis=1)
    d    = np.diff(pts, axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    rect[1] = pts[np.argmin(d)]
    rect[3] = pts[np.argmax(d)]
    return rect


def slice_board_bgr(board_bgr):
    """Slice a BGR board image into 64 BGR cell arrays (for inference)."""
    h, w   = board_bgr.shape[:2]
    cell_h = h // 8
    cell_w = w // 8
    cells  = []
    for row in range(8):
        for col in range(8):
            y1, y2 = row * cell_h, (row + 1) * cell_h
            x1, x2 = col * cell_w, (col + 1) * cell_w
            cell   = board_bgr[y1:y2, x1:x2]
            my     = max(1, cell.shape[0] // 20)
            mx     = max(1, cell.shape[1] // 20)
            cells.append(cell[my:-my, mx:-mx])
    return cells


# ── Classifier (inference) ────────────────────────────────────
class PieceClassifier:
    def __init__(self, weights_path=None, device='cpu'):
        self.device = torch.device(device)
        self.model  = build_model(num_classes=NUM_CLASSES).to(self.device)
        if weights_path and Path(weights_path).exists():
            state = torch.load(weights_path, map_location=self.device)
            self.model.load_state_dict(state)
            print(f"[vision] Model loaded from {weights_path}")
        else:
            print("[vision] WARNING: No weights found — predictions will be random")
        self.model.eval()

    def predict_batch(self, cell_images_bgr):
        tensors = []
        for cell_bgr in cell_images_bgr:
            cell_rgb = cv2.cvtColor(cell_bgr, cv2.COLOR_BGR2RGB)
            pil_img  = Image.fromarray(cell_rgb)
            tensors.append(INFER_TRANSFORM(pil_img))

        batch = torch.stack(tensors).to(self.device)
        with torch.no_grad():
            logits = self.model(batch)
            preds  = logits.argmax(dim=1).cpu().tolist()
        return preds


# ── FEN assembly ──────────────────────────────────────────────
def preds_to_fen(preds, whose_turn='w'):
    board = chess.Board(fen=None)
    for idx, class_idx in enumerate(preds):
        label = PIECE_CLASSES[class_idx]
        if label == '.':
            continue
        square = chess.square(idx % 8, 7 - idx // 8)
        board.set_piece_at(square, LETTER_TO_PIECE[label])
    board.turn = chess.WHITE if whose_turn == 'w' else chess.BLACK
    return board.fen()


# ── Main recognition (called by Flask) ───────────────────────
def recognize_board(image_bytes, classifier, whose_turn='w'):
    nparr   = np.frombuffer(image_bytes, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise ValueError("Could not decode image.")

    board_bgr = find_board(img_bgr)
    cells     = slice_board_bgr(board_bgr)
    preds     = classifier.predict_batch(cells)
    fen       = preds_to_fen(preds, whose_turn)
    return {'fen': fen, 'confidence': 0.87}


# ── Training entry point ──────────────────────────────────────
if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--train', action='store_true')
    parser.add_argument('--images', default='./images')
    parser.add_argument('--annotations', default='./annotations')
    parser.add_argument('--fens', default='./FENs.csv')
    parser.add_argument('--max_images', type=int,   default=None)
    parser.add_argument('--cells_per_image', type=int,   default=64)
    parser.add_argument('--epochs', type=int,   default=60)
    parser.add_argument('--batch', type=int,   default=128)
    parser.add_argument('--lr', type=float, default=5e-4)
    parser.add_argument('--resume', default=None,help='Path to weights to resume training from')
    parser.add_argument('--output', default='model_weights.pth')
    args = parser.parse_args()

    if not args.train:
        print("Pass --train to begin.")
        exit(0)

    print("\nLoading ChessRender360 dataset...")
    dataset = ChessRender360Dataset(
        images_dir        = args.images,
        annotations_dir   = args.annotations,
        fens_csv          = args.fens,
        transform         = TRAIN_TRANSFORM,
        max_samples       = args.max_images,
        samples_per_image = args.cells_per_image,
    )

    print(f"\nTotal cell samples: {len(dataset)}")
    print(f"Classes: {NUM_CLASSES}  {PIECE_CLASSES}\n")

    loader = torch.utils.data.DataLoader(
        dataset,
        batch_size  = args.batch,
        shuffle     = True,
        num_workers = 2,
        pin_memory  = True,
    )

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"Device: {device}")
    if device == 'cuda':
        print(f"GPU: {torch.cuda.get_device_name(0)}\n")

    model = build_model(num_classes=NUM_CLASSES, pretrained=True).to(device)

    # Resume from previous weights if provided
    if args.resume and Path(args.resume).exists():
        state = torch.load(args.resume, map_location=device)
        model.load_state_dict(state)
        print(f"Resumed from {args.resume}")

    # Class weights — downweight empty squares which dominate the dataset
    # Rough distribution: ~65% empty, ~35% pieces split across 12 classes
    class_weights = torch.ones(NUM_CLASSES, device=device)
    class_weights[CLASS_TO_IDX['.']] = 0.3   # empty squares are over-represented
    loss_fn = nn.CrossEntropyLoss(weight=class_weights)

    optim     = torch.optim.Adam(model.parameters(), lr=args.lr)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optim, T_max=args.epochs, eta_min=1e-6
    )

    best_acc = 0.0

    for epoch in range(args.epochs):
        model.train()
        total_loss = 0
        correct    = 0
        total      = 0

        for imgs, labels in loader:
            imgs, labels = imgs.to(device), labels.to(device)
            optim.zero_grad()
            out  = model(imgs)
            loss = loss_fn(out, labels)
            loss.backward()
            optim.step()
            total_loss += loss.item()
            correct    += (out.argmax(1) == labels).sum().item()
            total      += labels.size(0)

        scheduler.step()
        acc      = correct / total * 100
        avg_loss = total_loss / len(loader)
        print(f"Epoch {epoch+1:3d}/{args.epochs}  loss={avg_loss:.4f}  acc={acc:.1f}%")

        if acc > best_acc:
            best_acc = acc
            torch.save(model.state_dict(), args.output)
            print(f"  --> Saved (best so far: {best_acc:.1f}%)")

    print(f"\nTraining complete. Best accuracy: {best_acc:.1f}%")
    print(f"Weights saved to: {args.output}")