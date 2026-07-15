export const HQ_MAGIC_LINK_MAX_BODY_BYTES = 4096;

export async function readHqJsonBody(
  request: Request,
  maximumBytes = HQ_MAGIC_LINK_MAX_BODY_BYTES,
): Promise<Record<string, unknown> | null> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const normalizedLength = declaredLength.trim();
    if (!/^\d+$/.test(normalizedLength)) return null;
    const parsedLength = Number(normalizedLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength > maximumBytes) {
      return null;
    }
  }

  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel("Headquarters magic-link body exceeds limit");
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    ) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
