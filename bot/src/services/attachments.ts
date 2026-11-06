import fs from 'node:fs';
import path from 'node:path';
import { Attachment } from 'discord.js';
import { audioConfig, imageConfig, paths } from '../config';
import { JobAttachment } from '../db';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.ogg',
  '.opus',
  '.m4a',
  '.aac',
  '.flac',
  '.webm',
]);

const AUDIO_CONTENT_TYPES: Record<string, string> = {
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/wave': '.wav',
  'audio/ogg': '.ogg',
  'audio/opus': '.opus',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/flac': '.flac',
  'audio/x-flac': '.flac',
  'audio/webm': '.webm',
};

const AUDIO_CONTENT_BY_EXT: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.webm': 'audio/webm',
};

/** Detecta o formato real da imagem pelos magic bytes. */
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

/** Valida quantidade e tamanho declarado das imagens antes de baixar. */
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

function audioExtension(attachment: Attachment): string | null {
  const contentType = (attachment.contentType ?? '').toLowerCase();
  const byType = AUDIO_CONTENT_TYPES[contentType];
  if (byType) return byType;

  const extension = path.extname(attachment.name).toLowerCase();
  return AUDIO_EXTENSIONS.has(extension) ? extension : null;
}

/** Valida quantidade, tamanho e formato declarado dos áudios antes de baixar. */
export function validateAudioMetadata(audios: Attachment[]): string | null {
  if (audios.length > audioConfig.maxCount) {
    return `Envie no máximo ${audioConfig.maxCount} áudios por prompt.`;
  }

  const oversized = audios.find((audio) => audio.size > audioConfig.maxBytes);
  if (oversized) {
    return `O áudio "${oversized.name}" tem ${formatMb(oversized.size)}; o limite é ${formatMb(audioConfig.maxBytes)} por áudio.`;
  }

  for (const audio of audios) {
    if (!audioExtension(audio)) {
      return `"${audio.name}" não é um áudio suportado. Use MP3, WAV, OGG/OPUS, M4A/AAC, FLAC ou WebM.`;
    }
  }

  return null;
}

function detectAudio(
  buffer: Buffer,
  fallbackExtension: string | null,
): { contentType: string; extension: string } | null {
  const header4 = buffer.subarray(0, 4).toString('ascii');
  const header6 = buffer.subarray(0, 6).toString('ascii');

  if (header4 === 'OggS') {
    return { contentType: 'audio/ogg', extension: '.ogg' };
  }
  if (header4 === 'fLaC') {
    return { contentType: 'audio/flac', extension: '.flac' };
  }
  if (
    header4 === 'RIFF' &&
    buffer.length >= 12 &&
    buffer.subarray(8, 12).toString('ascii') === 'WAVE'
  ) {
    return { contentType: 'audio/wav', extension: '.wav' };
  }
  if (header6 === 'ID3' || (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) {
    const extension = fallbackExtension === '.aac' ? '.aac' : '.mp3';
    return {
      contentType: extension === '.aac' ? 'audio/aac' : 'audio/mpeg',
      extension,
    };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(4, 8).toString('ascii') === 'ftyp'
  ) {
    return { contentType: 'audio/mp4', extension: '.m4a' };
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { contentType: 'audio/webm', extension: '.webm' };
  }

  if (fallbackExtension) {
    return {
      contentType: AUDIO_CONTENT_BY_EXT[fallbackExtension] ?? 'application/octet-stream',
      extension: fallbackExtension,
    };
  }

  return null;
}

/**
 * Baixa imagens e áudios para bot/data/assets/message-<id>/.
 * O nome local é gerado pelo tipo (nunca pelo nome enviado) para evitar
 * path traversal; o nome original fica só como metadado.
 */
export async function downloadAttachments(
  submissionId: string,
  images: Attachment[],
  audios: Attachment[],
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
        kind: 'image',
      });
    }

    for (const [index, audio] of audios.entries()) {
      const declaredExtension = audioExtension(audio);
      if (!declaredExtension) {
        throw new Error(
          `"${audio.name}" não é um áudio suportado. Use MP3, WAV, OGG/OPUS, M4A/AAC, FLAC ou WebM.`,
        );
      }

      const response = await fetch(audio.url, {
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        throw new Error(`Download de "${audio.name}" falhou (HTTP ${response.status}).`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const detected = detectAudio(buffer, declaredExtension);
      if (!detected) {
        throw new Error(`"${audio.name}" não é um arquivo de áudio válido.`);
      }
      if (buffer.byteLength > audioConfig.maxBytes) {
        throw new Error(
          `"${audio.name}" tem ${formatMb(buffer.byteLength)}; o limite é ${formatMb(audioConfig.maxBytes)}.`,
        );
      }

      const file = path.join(dir, `audio-${index + 1}${detected.extension}`);
      fs.writeFileSync(file, buffer);

      saved.push({
        name: audio.name,
        file,
        contentType: detected.contentType,
        size: buffer.byteLength,
        url: audio.url,
        kind: 'audio',
      });
    }
  } catch (error) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  }

  return saved;
}
