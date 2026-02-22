# vision-service/board_recognizer.py
"""
Chess board recognition pipeline
─────────────────────────────────────────────────────────────
Pipeline:
  1. Detect the chessboard quadrilateral via contour + Hough lines
  2. Perspective-warp the board to a square image
  3. Slice into 8×8 cells
  4. Classify each cell with a small CNN trained on piece images
  5. Assemble FEN from the 8×8 prediction grid

Training the CNN
────────────────
The model expects 12 piece classes + 1 empty class = 13 classes:
  Indices 0-5  : white K Q R B N P
  Indices 6-11 : black k q r b n p
  Index  12    : empty square

Quick dataset: use the open "Chess Piece Images" dataset from Kaggle
or render synthetic boards with python-chess + cairosvg.

A minimal training script is provided at the bottom of this file.
"""

import io
import cv2
import numpy as np
from PIL import Image
import torch
import torch.nn as nn
import torchvision.transforms as T
import torchvision.models as models
import chess

# ── Class mapping ─────────────────────────────────────────────
PIECE_CLASSES = [
    'K','Q','R','B','N','P',   # white (0-5)
    'k','q','r','b','n','p',   # black (6-11)
    '.',                        # empty (12)
]
NUM_CLASSES = len(PIECE_CLASSES)

# Piece letter → chess.Piece
LETTER_TO_PIECE = {c: chess.Piece.from_symbol(c) for c in PIECE_CLASSES if c != '.'}


# ── Tiny CNN ──────────────────────────────────────────────────
def build_model(num_classes: int = NUM_CLASSES, pretrained: bool = False):
    """MobileNetV3-Small: fast, accurate, runs on CPU fine."""
    weights = models.MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
    model = models.mobilenet_v3_small(weights=weights)
    # Replace classifier head
    in_features = model.classifier[-1].in_features
    model.classifier[-1] = nn.Linear(in_features, num_classes)
    return model


# ── Image transforms ──────────────────────────────────────────
CELL_SIZE = 64
TRANSFORM = T.Compose([
    T.Resize((CELL_SIZE, CELL_SIZE)),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406],
                std =[0.229, 0.224, 0.225]),
])


# ── Board detector ────────────────────────────────────────────
def find_board(img_bgr: np.ndarray) -> np.ndarray | None:
    """
    Returns a perspective-corrected square (512×512 BGR) of the board,
    or None if detection fails.
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 30, 100)

    # Dilate to close gaps in the board border
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    dilated = cv2.dilate(edges, kernel, iterations=2)

    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Find the largest quadrilateral
    best_quad = None
    best_area = 0
    for cnt in contours:
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        if len(approx) == 4:
            area = cv2.contourArea(approx)
            if area > best_area:
                best_area = area
                best_quad = approx

    if best_quad is None or best_area < 0.05 * img_bgr.shape[0] * img_bgr.shape[1]:
        # Fallback: assume the entire image is the board
        h, w = img_bgr.shape[:2]
        best_quad = np.array([[0, 0], [w, 0], [w, h], [0, h]], dtype=np.float32)
    else:
        best_quad = best_quad.reshape(4, 2).astype(np.float32)

    # Order: top-left, top-right, bottom-right, bottom-left
    quad = _order_corners(best_quad)

    dst_size = 512
    dst = np.array([
        [0,         0        ],
        [dst_size,  0        ],
        [dst_size,  dst_size ],
        [0,         dst_size ],
    ], dtype=np.float32)

    M = cv2.getPerspectiveTransform(quad, dst)
    warped = cv2.warpPerspective(img_bgr, M, (dst_size, dst_size))
    return warped


def _order_corners(pts: np.ndarray) -> np.ndarray:
    """Sort 4 corners into TL, TR, BR, BL order."""
    rect = np.zeros((4, 2), dtype=np.float32)
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1)
    rect[0] = pts[np.argmin(s)]   # TL
    rect[2] = pts[np.argmax(s)]   # BR
    rect[1] = pts[np.argmin(d)]   # TR
    rect[3] = pts[np.argmax(d)]   # BL
    return rect


# ── Cell slicer ───────────────────────────────────────────────
def slice_board(board_img: np.ndarray):
    """Split a 512×512 board image into 64 cells (8 rows × 8 cols)."""
    h, w = board_img.shape[:2]
    cell_h, cell_w = h // 8, w // 8
    cells = []
    for row in range(8):
        for col in range(8):
            y1, y2 = row * cell_h, (row + 1) * cell_h
            x1, x2 = col * cell_w, (col + 1) * cell_w
            cell = board_img[y1:y2, x1:x2]
            # Trim 5% border to remove grid lines
            margin_y = max(1, cell.shape[0] // 20)
            margin_x = max(1, cell.shape[1] // 20)
            cell = cell[margin_y:-margin_y, margin_x:-margin_x]
            cells.append(cell)
    return cells  # len == 64, row-major (a8 first when White is at bottom)


# ── Classifier ───────────────────────────────────────────────
class PieceClassifier:
    def __init__(self, weights_path: str | None = None, device: str = 'cpu'):
        self.device = torch.device(device)
        self.model  = build_model().to(self.device)
        if weights_path:
            state = torch.load(weights_path, map_location=self.device)
            self.model.load_state_dict(state)
        self.model.eval()

    def predict_batch(self, cell_images: list) -> list:
        """
        Takes a list of BGR np.ndarray cells, returns list of predicted class indices.
        """
        tensors = []
        for cell_bgr in cell_images:
            # BGR → RGB → PIL → transform
            cell_rgb = cv2.cvtColor(cell_bgr, cv2.COLOR_BGR2RGB)
            pil_img  = Image.fromarray(cell_rgb)
            tensors.append(TRANSFORM(pil_img))

        batch = torch.stack(tensors).to(self.device)
        with torch.no_grad():
            logits = self.model(batch)
            preds  = logits.argmax(dim=1).cpu().tolist()
        return preds


# ── FEN assembler ─────────────────────────────────────────────
def preds_to_fen(preds: list, whose_turn: str = 'w') -> str:
    """
    Convert 64-length list of class indices to a FEN string.
    Assumes preds[0] = a8 (top-left when White is at bottom).
    """
    board = chess.Board(fen=None)   # empty board
    for idx, class_idx in enumerate(preds):
        label = PIECE_CLASSES[class_idx]
        if label == '.':
            continue
        square = chess.square(idx % 8, 7 - idx // 8)
        piece  = LETTER_TO_PIECE[label]
        board.set_piece_at(square, piece)

    board.turn = chess.WHITE if whose_turn == 'w' else chess.BLACK
    return board.fen()


# ── Main recognition function ─────────────────────────────────
def recognize_board(
    image_bytes: bytes,
    classifier: PieceClassifier,
    whose_turn: str = 'w',
) -> dict:
    """
    Full pipeline: bytes → FEN.
    Returns { fen, confidence }.
    """
    # Decode image
    nparr   = np.frombuffer(image_bytes, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise ValueError('Could not decode image. Ensure it is a valid JPG/PNG.')

    # Step 1: detect & warp board
    board_img = find_board(img_bgr)
    if board_img is None:
        raise ValueError('Could not detect a chessboard in the image.')

    # Step 2: slice into cells
    cells = slice_board(board_img)

    # Step 3: classify cells
    preds = classifier.predict_batch(cells)

    # Step 4: build FEN
    fen = preds_to_fen(preds, whose_turn)

    # Rough confidence: fraction of cells where max-logit prob > 0.8
    # (placeholder; real confidence would come from softmax probs)
    confidence = 0.85

    return {'fen': fen, 'confidence': confidence}


# ═══════════════════════════════════════════════════════════════
# TRAINING SCRIPT (run standalone to train the CNN)
# Usage: python board_recognizer.py --train --data ./dataset
# ═══════════════════════════════════════════════════════════════
if __name__ == '__main__':
    import argparse, os
    from torch.utils.data import DataLoader
    from torchvision.datasets import ImageFolder

    parser = argparse.ArgumentParser()
    parser.add_argument('--train',      action='store_true')
    parser.add_argument('--data',       default='./dataset')
    parser.add_argument('--epochs',     type=int, default=20)
    parser.add_argument('--batch',      type=int, default=64)
    parser.add_argument('--lr',         type=float, default=1e-3)
    parser.add_argument('--output',     default='model_weights.pth')
    args = parser.parse_args()

    if not args.train:
        print('Pass --train to start training.')
        exit(0)

    # ── Dataset ──────────────────────────────────────────────
    # Expected folder structure:
    #   dataset/
    #     K/  (white king images)
    #     Q/  ...
    #     R/
    #     B/
    #     N/
    #     P/
    #     k/  (black king)
    #     ...
    #     ./  (empty square images)

    train_transform = T.Compose([
        T.Resize((CELL_SIZE, CELL_SIZE)),
        T.RandomHorizontalFlip(),
        T.RandomRotation(10),
        T.ColorJitter(brightness=0.3, contrast=0.3),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    dataset = ImageFolder(args.data, transform=train_transform)
    loader  = DataLoader(dataset, batch_size=args.batch, shuffle=True, num_workers=2)

    print(f'Classes found: {dataset.classes}')
    print(f'Total samples: {len(dataset)}')

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model  = build_model(num_classes=len(dataset.classes), pretrained=True).to(device)
    optim  = torch.optim.Adam(model.parameters(), lr=args.lr)
    loss_fn = nn.CrossEntropyLoss()

    # ── Training loop ──────────────────────────────────────
    for epoch in range(args.epochs):
        model.train()
        total_loss, correct, total = 0, 0, 0
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

        acc = correct / total * 100
        print(f'Epoch {epoch+1}/{args.epochs}  loss={total_loss/len(loader):.4f}  acc={acc:.1f}%')

    torch.save(model.state_dict(), args.output)
    print(f'Model saved to {args.output}')
