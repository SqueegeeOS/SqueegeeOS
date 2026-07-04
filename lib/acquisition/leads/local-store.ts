import { promises as fs } from "fs";
import path from "path";
import type { LeadIntakeRecord } from "../lead-record";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "lead-intakes.json");

const memoryFallback = new Map<string, LeadIntakeRecord>();

async function readFileStore(): Promise<Map<string, LeadIntakeRecord>> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as LeadIntakeRecord[];
    if (!Array.isArray(parsed)) return new Map();
    return new Map(parsed.map((record) => [record.id, record]));
  } catch {
    return new Map(memoryFallback);
  }
}

async function writeFileStore(
  store: Map<string, LeadIntakeRecord>,
): Promise<void> {
  const records = Array.from(store.values()).sort((a, b) =>
    b.submittedAt.localeCompare(a.submittedAt),
  );

  for (const record of records) {
    memoryFallback.set(record.id, record);
  }

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2), "utf8");
  } catch (error) {
    console.warn(
      "[lead-intakes] Could not write local file store — using in-memory fallback:",
      error,
    );
  }
}

export async function listLocalLeadIntakes(): Promise<LeadIntakeRecord[]> {
  const store = await readFileStore();
  return Array.from(store.values()).sort((a, b) =>
    b.submittedAt.localeCompare(a.submittedAt),
  );
}

export async function saveLocalLeadIntake(
  record: LeadIntakeRecord,
): Promise<LeadIntakeRecord> {
  const store = await readFileStore();
  store.set(record.id, record);
  await writeFileStore(store);
  return record;
}
