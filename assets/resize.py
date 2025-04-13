import cv2
import os
import sys

# input image: first arg
input_path = sys.argv[1]

# Output sizes
sizes = [16, 32, 48, 128]

# Output folder (optional)
output_dir = 'icons'
os.makedirs(output_dir, exist_ok=True)

# Load original image
img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
if img is None:
    raise FileNotFoundError(f"Image not found: {input_path}")

# Resize and save each icon
for size in sizes:
    resized = cv2.resize(img, (size, size), interpolation=cv2.INTER_AREA)
    base_name = os.path.splitext(os.path.basename(input_path))[0]
    output_path = os.path.join(output_dir, f'{base_name}-{size}.png')
    cv2.imwrite(output_path, resized)
    print(f"Saved: {output_path}")