import { promises as fs } from "fs";
import path from "path";
import type { PropertyAssessment } from "./assessment-types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "property-assessments.json");

const memoryFallback = new Map<string, PropertyAssessment[]>();

async function readFileStore(): Promise<Map<string, PropertyAssessment[]>> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as PropertyAssessment[];
    if (!Array.isArray(parsed)) return new Map();
    const byProperty = new Map<string, PropertyAssessment[]>();
    for (const record of parsed) {
      const list = byProperty.get(record.propertyId) ?? [];
      list.push(record);
      byProperty.set(record.propertyId, list);
    }
    return byProperty;
  } catch {
    return new Map(memoryFallback);
  }
}

async function writeFileStore(
  store: Map<string, PropertyAssessment[]>,
): Promise<void> {
  const records = Array.from(store.values())
    .flat()
    .sort((a, b) => b.visitDate.localeCompare(a.visitDate));

  memoryFallback.clear();
  for (const [propertyId, list] of store.entries()) {
    memoryFallback.set(propertyId, list);
  }

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2), "utf8");
  } catch (error) {
    console.warn(
      "[property-assessments] Could not write local file store:",
      error,
    );
  }
}

export async function listLocalAssessments(
  propertyId: string,
): Promise<PropertyAssessment[]> {
  const store = await readFileStore();
  return (store.get(propertyId) ?? []).sort((a, b) =>
    b.visitDate.localeCompare(a.visitDate),
  );
}

export async function saveLocalAssessment(
  record: PropertyAssessment,
): Promise<PropertyAssessment> {
  const store = await readFileStore();
  const list = store.get(record.propertyId) ?? [];
  list.unshift(record);
  store.set(record.propertyId, list);
  await writeFileStore(store);
  return record;
}

export async function getLocalAssessmentById(
  id: string,
): Promise<PropertyAssessment | null> {
  const store = await readFileStore();
  for (const list of store.values()) {
    const found = list.find((a) => a.id === id);
    if (found) return found;
  }
  return null;
}

export async function listLocalAssessmentPropertyIds(): Promise<string[]> {
  const store = await readFileStore();
  return Array.from(store.keys());
}
