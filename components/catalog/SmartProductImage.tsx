'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

type SmartProductImageProps = {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
};

const scaleCache = new Map<string, number>();

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function calculateContentScale(image: HTMLImageElement) {
  try {
    const sampleSize = 180;
    const canvas = document.createElement('canvas');
    canvas.width = sampleSize;
    canvas.height = sampleSize;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return 1;

    context.drawImage(image, 0, 0, sampleSize, sampleSize);
    const { data } = context.getImageData(0, 0, sampleSize, sampleSize);

    const cornerIndexes = [
      0,
      (sampleSize - 1) * 4,
      ((sampleSize - 1) * sampleSize) * 4,
      (sampleSize * sampleSize - 1) * 4,
    ];

    const background = cornerIndexes.reduce(
      (acc, index) => ({
        r: acc.r + data[index] / cornerIndexes.length,
        g: acc.g + data[index + 1] / cornerIndexes.length,
        b: acc.b + data[index + 2] / cornerIndexes.length,
      }),
      { r: 0, g: 0, b: 0 },
    );

    let minX = sampleSize;
    let minY = sampleSize;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < sampleSize; y += 1) {
      for (let x = 0; x < sampleSize; x += 1) {
        const index = (y * sampleSize + x) * 4;
        const alpha = data[index + 3];
        const dr = data[index] - background.r;
        const dg = data[index + 1] - background.g;
        const db = data[index + 2] - background.b;
        const distance = Math.sqrt(dr * dr + dg * dg + db * db);

        if (alpha > 24 && distance > 30) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX < minX || maxY < minY) return 1;

    const contentWidth = (maxX - minX + 1) / sampleSize;
    const contentHeight = (maxY - minY + 1) / sampleSize;

    // Todas las botellas ocupan aproximadamente la misma caja visual.
    // La altura manda, pero también evitamos que una etiqueta muy ancha se recorte.
    const heightScale = 0.84 / Math.max(contentHeight, 0.01);
    const widthScale = 0.68 / Math.max(contentWidth, 0.01);

    return clamp(Math.min(heightScale, widthScale), 1, 2.35);
  } catch {
    return 1;
  }
}

export default function SmartProductImage({
  src,
  alt,
  priority = false,
  className,
}: SmartProductImageProps) {
  const [scale, setScale] = useState(() => scaleCache.get(src) || 1);

  useEffect(() => {
    setScale(scaleCache.get(src) || 1);
  }, [src]);

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="640px"
      priority={priority}
      className={className}
      onLoad={(event) => {
        const image = event.currentTarget;
        const nextScale = scaleCache.get(src) || calculateContentScale(image);
        scaleCache.set(src, nextScale);
        setScale(nextScale);
      }}
      style={{
        objectFit: 'contain',
        objectPosition: 'center center',
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        transition: 'transform .18s ease',
      }}
    />
  );
}
