#!/usr/bin/env python3
# vision-service/generate_dataset.py
"""
Generates a synthetic training dataset by rendering chess piece SVGs
to square images at multiple sizes and with augmentations.

Requirements: pip install cairosvg Pillow chess numpy

Usage:
  python generate_dataset.py --output ./dataset --samples 200

After running, train with:
  python board_recognizer.py --train --data ./dataset --epochs 30
"""

import os, io, random, argparse
import chess, chess.svg
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

try:
    import cairosvg
    HAS_CAIRO = True
except ImportError:
    HAS_CAIRO = False
    print('cairosvg not available. Install with: pip install cairosvg')
    print('Falling back to placeholder generation.')

PIECE_SYMBOLS = ['K','Q','R','B','N','P','k','q','r','b','n','p','.']
BOARD_COLORS_LIGHT = ['#f0d9b5', '#eeeed2', '#deb887', '#f5f5dc']
BOARD_COLORS_DARK  = ['#b58863', '#769656', '#8b4513', '#a0522d']
CELL_SIZE = 64


def render_piece_svg(piece_symbol: str, size: int = 64) -> Image.Image:
    """Render a piece SVG to a PIL Image."""
    if piece_symbol == '.':
        # Empty square — just a solid-ish square
        img = Image.new('RGB', (size, size), random.choice(BOARD_COLORS_LIGHT))
        return img

    piece = chess.Piece.from_symbol(piece_symbol)
    svg_str = chess.svg.piece(piece, size=size)
    png_bytes = cairosvg.svg2png(bytestring=svg_str.encode(), output_width=size, output_height=size)
    img = Image.open(io.BytesIO(png_bytes)).convert('RGBA')

    # Composite onto a board-coloured background
    bg_color = random.choice(BOARD_COLORS_LIGHT + BOARD_COLORS_DARK)
    bg = Image.new('RGBA', img.size, bg_color)
    bg.paste(img, mask=img.split()[3])
    return bg.convert('RGB')


def augment(img: Image.Image) -> Image.Image:
    """Apply random augmentations."""
    # Random brightness/contrast
    img = ImageEnhance.Brightness(img).enhance(random.uniform(0.6, 1.4))
    img = ImageEnhance.Contrast(img).enhance(random.uniform(0.7, 1.3))

    # Slight rotation
    img = img.rotate(random.uniform(-12, 12), expand=False,
                     fillcolor=tuple(np.array(img)[0,0].tolist()))

    # Occasional blur
    if random.random() < 0.2:
        img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.5, 1.5)))

    return img


def generate_dataset(output_dir: str, samples_per_class: int = 200):
    os.makedirs(output_dir, exist_ok=True)

    if not HAS_CAIRO:
        print('Generating placeholder dataset (random pixels).')
        for sym in PIECE_SYMBOLS:
            cls_dir = os.path.join(output_dir, sym if sym != '.' else 'empty')
            os.makedirs(cls_dir, exist_ok=True)
            for i in range(samples_per_class):
                arr = np.random.randint(0, 255, (CELL_SIZE, CELL_SIZE, 3), dtype=np.uint8)
                Image.fromarray(arr).save(os.path.join(cls_dir, f'{i:04d}.jpg'))
        print(f'Placeholder dataset saved to {output_dir}')
        return

    for sym in PIECE_SYMBOLS:
        folder_name = sym if sym != '.' else 'empty'
        cls_dir = os.path.join(output_dir, folder_name)
        os.makedirs(cls_dir, exist_ok=True)
        print(f'Generating {samples_per_class} images for class "{folder_name}"…')

        for i in range(samples_per_class):
            img = render_piece_svg(sym, size=CELL_SIZE + 8)
            img = augment(img)
            img = img.resize((CELL_SIZE, CELL_SIZE), Image.LANCZOS)
            img.save(os.path.join(cls_dir, f'{i:04d}.jpg'), quality=90)

    print(f'\nDataset saved to {output_dir}')
    print(f'Total images: {len(PIECE_SYMBOLS) * samples_per_class}')
    print('\nNext step:')
    print(f'  python board_recognizer.py --train --data {output_dir} --epochs 30')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output',  default='./dataset')
    parser.add_argument('--samples', type=int, default=200)
    args = parser.parse_args()
    generate_dataset(args.output, args.samples)
