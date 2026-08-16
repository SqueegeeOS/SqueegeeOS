import "server-only";

import { createPrivilegedServerSupabaseClient } from "@/lib/persistence/supabase/client";
import { isEnrollmentPacketStatus } from "@/lib/enrollment/packet-progress";
import type { EnrollmentPacketStatus } from "@/lib/enrollment/types";
import {
  buildSalesLeadCloseJourney,
  type SalesLeadCloseJourney,
  type SalesLeadClosePacketSource,
  type SalesLeadClosePresentationSource,
} from "./lead-close-journey";

interface SalesLeadCloseJourneyRef {
  id: string;
  leadIntakeId: string | null;
}

interface PresentationRow {
  id: string;
  sales_rep_lead_id: string | null;
  lead_intake_id: string | null;
  status: "draft" | "presented" | "signed";
  updated_at: string;
}

interface PacketRow {
  presentation_id: string;
  status: EnrollmentPacketStatus;
  updated_at: string;
}

const QUERY_CHUNK_SIZE = 100;

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export async function loadSalesLeadCloseJourneys(
  repId: string,
  leads: SalesLeadCloseJourneyRef[],
): Promise<Map<string, SalesLeadCloseJourney>> {
  const journeys = new Map<string, SalesLeadCloseJourney>();
  if (leads.length === 0) return journeys;

  const supabase = createPrivilegedServerSupabaseClient();
  const presentationRows: PresentationRow[] = [];
  const loadPresentations = async (
    column: "sales_rep_lead_id" | "lead_intake_id",
    values: string[],
  ) => {
    for (const valueChunk of chunks([...new Set(values)], QUERY_CHUNK_SIZE)) {
      if (valueChunk.length === 0) continue;
      const result = await supabase
        .from("presentations")
        .select("id, sales_rep_lead_id, lead_intake_id, status, updated_at")
        .eq("sales_rep_id", repId)
        .in(column, valueChunk);
      if (result.error) {
        throw new Error("HomeAtlas could not verify field-close presentation progress.");
      }
      presentationRows.push(...((result.data ?? []) as PresentationRow[]));
    }
  };

  await Promise.all([
    loadPresentations(
      "sales_rep_lead_id",
      leads.map((lead) => lead.id),
    ),
    loadPresentations(
      "lead_intake_id",
      leads.flatMap((lead) => (lead.leadIntakeId ? [lead.leadIntakeId] : [])),
    ),
  ]);

  const uniquePresentations = [
    ...new Map(presentationRows.map((row) => [row.id, row])).values(),
  ];
  const packetRows: PacketRow[] = [];
  for (const presentationIdChunk of chunks(
    uniquePresentations.map((presentation) => presentation.id),
    QUERY_CHUNK_SIZE,
  )) {
    const result = await supabase
      .from("enrollment_packets")
      .select("presentation_id, status, updated_at")
      .in("presentation_id", presentationIdChunk);
    if (result.error) {
      throw new Error("HomeAtlas could not verify secure field-close handoffs.");
    }
    for (const row of (result.data ?? []) as PacketRow[]) {
      if (!isEnrollmentPacketStatus(row.status)) {
        throw new Error("HomeAtlas received an unknown secure handoff status.");
      }
      packetRows.push(row);
    }
  }

  const packetsByPresentationId = new Map<string, SalesLeadClosePacketSource[]>();
  for (const packet of packetRows) {
    const existing = packetsByPresentationId.get(packet.presentation_id) ?? [];
    existing.push({
      presentationId: packet.presentation_id,
      status: packet.status,
      updatedAt: packet.updated_at,
    });
    packetsByPresentationId.set(packet.presentation_id, existing);
  }

  const presentationsByLeadId = new Map<string, PresentationRow[]>();
  const presentationsByLeadIntakeId = new Map<string, PresentationRow[]>();
  for (const presentation of uniquePresentations) {
    if (presentation.sales_rep_lead_id) {
      const existing =
        presentationsByLeadId.get(presentation.sales_rep_lead_id) ?? [];
      existing.push(presentation);
      presentationsByLeadId.set(presentation.sales_rep_lead_id, existing);
    }
    if (presentation.lead_intake_id) {
      const existing =
        presentationsByLeadIntakeId.get(presentation.lead_intake_id) ?? [];
      existing.push(presentation);
      presentationsByLeadIntakeId.set(presentation.lead_intake_id, existing);
    }
  }

  for (const lead of leads) {
    const presentations = [
      ...(presentationsByLeadId.get(lead.id) ?? []),
      ...(lead.leadIntakeId
        ? (presentationsByLeadIntakeId.get(lead.leadIntakeId) ?? [])
        : []),
    ].filter(
      (presentation, index, records) =>
        records.findIndex((candidate) => candidate.id === presentation.id) ===
        index,
    );
    const presentationSources: SalesLeadClosePresentationSource[] =
      presentations.map((presentation) => ({
        id: presentation.id,
        status: presentation.status,
        updatedAt: presentation.updated_at,
      }));
    const packetSources = presentations.flatMap(
      (presentation) => packetsByPresentationId.get(presentation.id) ?? [],
    );
    journeys.set(
      lead.id,
      buildSalesLeadCloseJourney({
        presentations: presentationSources,
        packets: packetSources,
      }),
    );
  }

  return journeys;
}
