import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const ALIASES: Record<string, string[]> = {
  'rutini-wines': ['rutini-wines', 'rutini'],
  'luigi-bosca': ['luigi-bosca'],
  'catena-zapata': ['catena-zapata', 'catena'],
  salentein: ['salentein'],
  trapiche: ['trapiche'],
};

async function findLogo(slug: string) {
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const candidates = ALIASES[safeSlug] ?? [safeSlug];
  const root = path.join(process.cwd(), 'salida', 'bodegas');

  for (const candidate of candidates) {
    const folder = path.join(root, candidate);

    try {
      const entries = await fs.readdir(folder, { withFileTypes: true });
      const logo = entries.find(
        (entry) =>
          entry.isFile() &&
          /^logo\.(png|jpe?g|webp|gif|svg)$/i.test(entry.name),
      );

      if (logo) return path.join(folder, logo.name);
    } catch {
      // Continúa con el siguiente alias.
    }
  }

  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const logoPath = await findLogo(params.slug);

  if (!logoPath) {
    return new NextResponse(null, { status: 404 });
  }

  const extension = path.extname(logoPath).toLowerCase();
  const file = await fs.readFile(logoPath);

  return new NextResponse(file, {
    headers: {
      'Content-Type': MIME_TYPES[extension] ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
