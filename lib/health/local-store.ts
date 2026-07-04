import { promises as fs } from "fs";
import path from "path";
import type { PropertyHealthCheck } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "health-checks.json");

const memoryFallback = new Map<string, PropertyHealthCheck[]>();

async function readFileStore(): Promise<Map<string, PropertyHealthCheck[]>> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as PropertyHealthCheck[];
    if (!Array.isArray(parsed)) return new Map();
    const byProperty = new Map<string, PropertyHealthCheck[]>();
    for (const check of parsed) {
      const list = byProperty.get(check.propertyId) ?? [];
      list.push(check);
      byProperty.set(check.propertyId, list);
    }
    return byProperty;
  } catch {
    return new Map(memoryFallback);
  }
}

async function writeFileStore(
  store: Map<string, PropertyHealthCheck[]>,
): Promise<void> {
  const records = Array.from(store.values())
    .flat()
    .sort((a, b) => b.visitDate.localeCompare(a.visitDate));

  memoryFallback.clear();
  for (const [propertyId, checks] of store.entries()) {
    memoryFallback.set(propertyId, checks);
  }

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2), "utf8");
  } catch (error) {
    console.warn(
      "[health-checks] Could not write local file store — using in-memory fallback:",
      error,
    );
  }
}

export async function listLocalHealthChecks(
  propertyId: string,
): Promise<PropertyHealthCheck[]> {
  const store = await readFileStore();
  return (store.get(propertyId) ?? []).sort((a, b) =>
    b.visitDate.localeCompare(a.visitDate),
  );
}

export async function saveLocalHealthCheck(
  check: PropertyHealthCheck,
): Promise<PropertyHealthCheck> {
  const store = await readFileStore();
  const list = store.get(check.propertyId) ?? [];
  list.unshift(check);
  store.set(check.propertyId, list);
  await writeFileStore(store);
  return check;
}

export async function listLocalTechnicianPropertyIds(): Promise<string[]> {
  const store = await readFileStore();
  return Array.from(store.keys());
}
