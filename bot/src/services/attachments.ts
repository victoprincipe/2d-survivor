import fs from 'node:fs';
import path from 'node:path';
import { Attachment } from 'discord.js';
import { imageConfig, paths } from '../config';
import { JobAttachment } from '../db';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Detecta o formato real pelos magic bytes; o contentType do Discord pode mentir. */
export function detectImage(
  buffer: Buffer,
): { contentType: string; extension: string } | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { contentType: 'image/png', extension: '.png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { contentType: 'image/jpeg', extension: '.jpg' };
  }
  const header6 = buffer.subarray(0, 6).toString('ascii');
  if (header6 === 'GIF87a' || header6 === 'GIF89a') {
    return { contentType: 'image/gif', extension: '.gif' };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { contentType: 'image/webp', extension: '.webp' };
  }
  return null;
}

export function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Valida quantidade e tamanho declarado antes de baixar. */
export function validateImageMetadata(images: Attachment[]): string | null {
  if (images.length > imageConfig.maxCount) {
    return `Envie no máximo ${imageConfig.maxCount} imagens por prompt.`;
  }

  const oversized = images.find((image) => image.size > imageConfig.maxBytes);
  if (oversized) {
    return `A imagem "${oversized.name}" tem ${formatMb(oversized.size)}; o limite é ${formatMb(imageConfig.maxBytes)} por imagem.`;
  }

  return null;
}

/**
 * Baixa os anexos para bot/data/assets/message-<id>/.
 * O nome local é gerado pelo tipo (nunca pelo nome enviado) para evitar
 * path traversal; o nome original fica só como metadado.
 */
export async function downloadImages(
  submissionId: string,
  images: Attachment[],
): Promise<JobAttachment[]> {
  const dir = path.join(paths.assets, `message-${submissionId}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const saved: JobAttachment[] = [];

  try {
    for (const [index, image] of images.entries()) {
      const response = await fetch(image.url, {
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        throw new Error(`Download de "${image.name}" falhou (HTTP ${response.status}).`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const detected = detectImage(buffer);
      if (!detected) {
        throw new Error(
          `"${image.name}" não é uma imagem PNG, JPEG, GIF ou WebP válida.`,
        );
      }
      if (buffer.byteLength > imageConfig.maxBytes) {
        throw new Error(
          `"${image.name}" tem ${formatMb(buffer.byteLength)}; o limite é ${formatMb(imageConfig.maxBytes)}.`,
        );
      }

      const file = path.join(dir, `image-${index + 1}${detected.extension}`);
      fs.writeFileSync(file, buffer);

      saved.push({
        name: image.name,
        file,
        contentType: detected.contentType,
        size: buffer.byteLength,
        url: image.url,
      });
    }
  } catch (error) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  }

  return saved;
}
