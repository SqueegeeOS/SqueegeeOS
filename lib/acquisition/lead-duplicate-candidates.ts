import type { LeadIntakeRecord } from "./lead-record";
import { normalizeEmailDestination } from "@/lib/communications/providers/contracts";
import { normalizeSalesDoorAddressKey } from "@/lib/sales/door-memory";
import { normalizeNorthAmericanPhone } from "@/lib/sales/workspace-validation";

export type LeadDuplicateSignal =
  | "same_external_lead"
  | "same_submission"
  | "same_email"
  | "same_phone"
  | "same_name_and_address";

export interface LeadDuplicateCandidateGroup {
  id: string;
  recordIds: string[];
  signals: LeadDuplicateSignal[];
}

interface LeadDuplicateIdentity {
  id: string;
  externalLeadId: string | null;
  clientSubmissionId: string | null;
  email: string | null;
  phone: string | null;
  nameAndAddress: string | null;
}

const SIGNAL_ORDER: LeadDuplicateSignal[] = [
  "same_external_lead",
  "same_submission",
  "same_email",
  "same_phone",
  "same_name_and_address",
];

function normalizedText(value: string | null | undefined): string | null {
  const normalized = value
    ?.normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return normalized ? normalized : null;
}

function duplicateIdentity(record: LeadIntakeRecord): LeadDuplicateIdentity {
  const name = normalizedText(record.name);
  const address = normalizeSalesDoorAddressKey(record.serviceAddress);
  return {
    id: record.id,
    externalLeadId: normalizedText(record.externalLeadId),
    clientSubmissionId: normalizedText(record.clientSubmissionId),
    email: normalizeEmailDestination(record.email),
    phone: normalizeNorthAmericanPhone(record.phone),
    nameAndAddress:
      name && address.length >= 5 ? `${name}\u0000${address}` : null,
  };
}

function candidateKeys(
  identity: LeadDuplicateIdentity,
): Array<{ key: string; signals: LeadDuplicateSignal[] }> {
  const keys: Array<{ key: string; signals: LeadDuplicateSignal[] }> = [];
  if (identity.externalLeadId) {
    keys.push({
      key: `external:${identity.externalLeadId}`,
      signals: ["same_external_lead"],
    });
  }
  if (identity.clientSubmissionId) {
    keys.push({
      key: `submission:${identity.clientSubmissionId}`,
      signals: ["same_submission"],
    });
  }
  if (identity.email && identity.phone) {
    keys.push({
      key: `email-phone:${identity.email}\u0000${identity.phone}`,
      signals: ["same_email", "same_phone"],
    });
  }
  if (identity.email && identity.nameAndAddress) {
    keys.push({
      key: `email-property:${identity.email}\u0000${identity.nameAndAddress}`,
      signals: ["same_email", "same_name_and_address"],
    });
  }
  if (identity.phone && identity.nameAndAddress) {
    keys.push({
      key: `phone-property:${identity.phone}\u0000${identity.nameAndAddress}`,
      signals: ["same_phone", "same_name_and_address"],
    });
  }
  return keys;
}

/**
 * Finds high-confidence duplicate candidates without merging or mutating lead
 * records. Two ordinary customer signals must agree; provider/submission IDs
 * are strong enough on their own. The result intentionally contains only row
 * IDs and signal labels so normalized customer data never reaches the client.
 */
export function findLeadDuplicateCandidateGroups(
  records: LeadIntakeRecord[],
): LeadDuplicateCandidateGroup[] {
  const identities = records.map(duplicateIdentity);
  const parent = new Map(identities.map((identity) => [identity.id, identity.id]));
  const groupSignals = new Map<string, Set<LeadDuplicateSignal>>();
  const firstRecordByCandidateKey = new Map<string, string>();

  const root = (id: string): string => {
    const current = parent.get(id) ?? id;
    if (current === id) return id;
    const resolved = root(current);
    parent.set(id, resolved);
    return resolved;
  };
  const unite = (
    leftId: string,
    rightId: string,
    signals: LeadDuplicateSignal[],
  ) => {
    const leftRoot = root(leftId);
    const rightRoot = root(rightId);
    const winner = leftRoot.localeCompare(rightRoot) <= 0 ? leftRoot : rightRoot;
    const loser = winner === leftRoot ? rightRoot : leftRoot;
    const combined = new Set([
      ...(groupSignals.get(leftRoot) ?? []),
      ...(groupSignals.get(rightRoot) ?? []),
      ...signals,
    ]);
    parent.set(loser, winner);
    parent.set(winner, winner);
    groupSignals.delete(loser);
    groupSignals.set(winner, combined);
  };

  for (const identity of identities) {
    for (const candidate of candidateKeys(identity)) {
      const firstRecordId = firstRecordByCandidateKey.get(candidate.key);
      if (firstRecordId) {
        unite(firstRecordId, identity.id, candidate.signals);
      } else {
        firstRecordByCandidateKey.set(candidate.key, identity.id);
      }
    }
  }

  const recordIdsByRoot = new Map<string, string[]>();
  for (const identity of identities) {
    const identityRoot = root(identity.id);
    const recordIds = recordIdsByRoot.get(identityRoot) ?? [];
    recordIds.push(identity.id);
    recordIdsByRoot.set(identityRoot, recordIds);
  }

  return [...recordIdsByRoot.entries()]
    .filter(([, recordIds]) => recordIds.length > 1)
    .map(([groupRoot, recordIds]) => ({
      id: groupRoot,
      recordIds: [...recordIds].sort(),
      signals: SIGNAL_ORDER.filter((signal) =>
        groupSignals.get(root(groupRoot))?.has(signal),
      ),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
