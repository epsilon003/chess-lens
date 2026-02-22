# vision-service/app.py
"""
Flask microservice for chess board recognition.
Exposes a single endpoint: POST /recognize
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from board_recognizer import PieceClassifier, recognize_board

app = Flask(__name__)
CORS(app)

# ── Load model once at startup ────────────────────────────────
WEIGHTS_PATH = os.environ.get('MODEL_WEIGHTS', 'model_weights.pth')

if os.path.exists(WEIGHTS_PATH):
    print(f'[vision] Loading model weights from {WEIGHTS_PATH}')
    classifier = PieceClassifier(weights_path=WEIGHTS_PATH)
else:
    print('[vision] WARNING: model_weights.pth not found.')
    print('[vision] Using untrained model — predictions will be random.')
    print('[vision] Train the model with:')
    print('[vision]   python board_recognizer.py --train --data ./dataset')
    classifier = PieceClassifier(weights_path=None)


# ── Endpoint ──────────────────────────────────────────────────
@app.route('/recognize', methods=['POST'])
def recognize():
    if 'image' not in request.files:
        return jsonify({'error': 'No image field in request'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400

    # Optional: caller can specify whose turn it is
    whose_turn = request.form.get('turn', 'w')  # 'w' or 'b'

    try:
        image_bytes = file.read()
        result = recognize_board(image_bytes, classifier, whose_turn)
        return jsonify(result)
    except ValueError as e:
        return jsonify({'error': str(e)}), 422
    except Exception as e:
        print(f'[vision] Unexpected error: {e}')
        return jsonify({'error': 'Internal recognition error'}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'ok': True,
        'model_loaded': os.path.exists(WEIGHTS_PATH),
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    print(f'[vision] Starting on http://localhost:{port}')
    app.run(host='0.0.0.0', port=port, debug=False)
