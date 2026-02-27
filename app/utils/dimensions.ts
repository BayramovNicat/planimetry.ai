export function calculateDimensions(pxWidth: number, pxHeight: number, totalArea: number) {
  // 1. Determine the aspect ratio
  const aspectRatio = pxWidth / pxHeight;

  // 2. Derive dimensions
  // Area = Width * Height
  // Since Width = Height * aspectRatio...
  // Area = (Height * aspectRatio) * Height  =>  Area = Height² * aspectRatio
  const height = Math.sqrt(totalArea / aspectRatio);
  const width = totalArea / height;

  return {
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
  };
}
