import { promises as fs } from "fs";
import path from "path";
import type { PresentationData } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "presentations.json");

/** In-memory fallback when the filesystem is not writable (e.g. some serverless runtimes). */
const memoryFallback = new Map<string, PresentationData>();

async function readFileStore(): Promise<Map<string, PresentationData>> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as PresentationData[];
    if (!Array.isArray(parsed)) return new Map();
    return new Map(parsed.map((record) => [record.id, record]));
  } catch {
    return new Map(memoryFallback);
  }
}

async function writeFileStore(store: Map<string, PresentationData>): Promise<void> {
  const records = Array.from(store.values()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );

  for (const record of records) {
    memoryFallback.set(record.id, record);
  }

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2), "utf8");
  } catch (error) {
    console.warn(
      "[presentations] Could not write local file store — using in-memory fallback:",
      error,
    );
  }
}

export async function listLocalPresentations(): Promise<PresentationData[]> {
  const store = await readFileStore();
  return Array.from(store.values()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export async function getLocalPresentation(
  id: string,
): Promise<PresentationData | null> {
  const store = await readFileStore();
  return store.get(id) ?? memoryFallback.get(id) ?? null;
}

export async function saveLocalPresentation(
  data: PresentationData,
): Promise<PresentationData> {
  const store = await readFileStore();
  store.set(data.id, data);
  await writeFileStore(store);
  return data;
}
