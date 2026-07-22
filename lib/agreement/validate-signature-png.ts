import "server-only";

import { PDFDocument } from "pdf-lib";
import { SIGNATURE_MAX_DECODED_BYTES } from "./sign-agreement-input";

const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const MAX_SIGNATURE_DIMENSION = 4096;
const MAX_SIGNATURE_PIXELS = 16_000_000;

export class InvalidSignaturePngError extends Error {
  constructor(message = "Signature PNG is invalid") {
    super(message);
    this.name = "InvalidSignaturePngError";
  }
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

function decodeBoundedBase64(dataUrl: string): Uint8Array {
  const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match?.[1] || match[1].length % 4 !== 0) {
    throw new InvalidSignaturePngError();
  }
  const bytes = Uint8Array.from(Buffer.from(match[1], "base64"));
  if (
    bytes.length === 0 ||
    bytes.length > SIGNATURE_MAX_DECODED_BYTES ||
    Buffer.from(bytes).toString("base64") !== match[1]
  ) {
    throw new InvalidSignaturePngError();
  }
  return bytes;
}

function validateChunkStructure(bytes: Uint8Array): void {
  if (bytes.length < 45 || !bytesEqual(bytes.subarray(0, 8), PNG_SIGNATURE)) {
    throw new InvalidSignaturePngError();
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let chunkIndex = 0;
  let sawIdat = false;
  let sawIend = false;

  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new InvalidSignaturePngError();
    const length = view.getUint32(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) throw new InvalidSignaturePngError();

    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = String.fromCharCode(...typeBytes);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = view.getUint32(offset + 8 + length);
    const crcInput = bytes.subarray(offset + 4, offset + 8 + length);
    if (crc32(crcInput) !== expectedCrc) throw new InvalidSignaturePngError();

    if (chunkIndex === 0) {
      if (type !== "IHDR" || length !== 13) throw new InvalidSignaturePngError();
      const width = view.getUint32(offset + 8);
      const height = view.getUint32(offset + 12);
      if (
        width === 0 ||
        height === 0 ||
        width > MAX_SIGNATURE_DIMENSION ||
        height > MAX_SIGNATURE_DIMENSION ||
        width * height > MAX_SIGNATURE_PIXELS ||
        data[10] !== 0 ||
        data[11] !== 0 ||
        (data[12] !== 0 && data[12] !== 1)
      ) {
        throw new InvalidSignaturePngError();
      }
    } else if (type === "IHDR") {
      throw new InvalidSignaturePngError();
    }

    if (type === "IDAT") sawIdat = true;
    if (type === "IEND") {
      if (length !== 0 || chunkEnd !== bytes.length) {
        throw new InvalidSignaturePngError();
      }
      sawIend = true;
    } else if (sawIend) {
      throw new InvalidSignaturePngError();
    }

    offset = chunkEnd;
    chunkIndex += 1;
  }

  if (!sawIdat || !sawIend) throw new InvalidSignaturePngError();
}

export async function decodeAndValidateSignaturePng(
  dataUrl: string,
): Promise<Uint8Array> {
  const bytes = decodeBoundedBase64(dataUrl);
  validateChunkStructure(bytes);
  try {
    const document = await PDFDocument.create();
    await document.embedPng(bytes);
  } catch {
    throw new InvalidSignaturePngError();
  }
  return bytes;
}
