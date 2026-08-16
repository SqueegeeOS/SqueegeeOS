import "server-only";

import {
  createPrivilegedServerSupabaseClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import {
  buildStandardRepProfile,
  DAVID_REP_PROFILE,
  type SalesRepPlan,
} from "./rep-config";
import {
  buildOwnerSalesPipelineSnapshot,
  type OwnerSalesHandoffSource,
  type OwnerSalesLeadSource,
  type OwnerSalesPipelineSnapshot,
  type OwnerSalesPresentationSource,
  type OwnerSalesRepSource,
} from "./owner-pipeline";
import {
  loadSalesLeadAttentionSnapshot,
  loadSalesProductionHandoffAttentionForRoster,
  SalesWorkspaceUnavailableError,
} from "./workspace-server";

interface SalesRepRow {
  id: string;
  slug: string;
  display_name: string;
  role_title: string;
  compensation_plan: SalesRepPlan;
}

interface PresentationRow {
  id: string;
  sales_rep_id: string | null;
  sales_rep_lead_id: string | null;
  status: "draft" | "presented" | "signed";
  updated_at: string;
}

const REP_PAGE_SIZE = 200;
const PRESENTATION_PAGE_SIZE = 500;
const PRESENTATION_LEAD_CHUNK_SIZE = 100;

function ensureOwnerSalesStorage() {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    throw new SalesWorkspaceUnavailableError(
      "The private sales pipeline is not connected to durable storage.",
    );
  }
}

function repSource(row: SalesRepRow): OwnerSalesRepSource {
  const profile =
    row.slug === DAVID_REP_PROFILE.slug &&
    row.compensation_plan === "founding_david"
      ? DAVID_REP_PROFILE
      : buildStandardRepProfile({
          slug: row.slug,
          displayName: row.display_name,
          roleTitle: row.role_title,
        });

  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    roleTitle: row.role_title,
    plan: profile.plan,
    workspacePath: profile.workspacePath,
  };
}

async function loadAllActiveSalesReps(): Promise<OwnerSalesRepSource[]> {
  const supabase = createPrivilegedServerSupabaseClient();
  const rows: SalesRepRow[] = [];
  let offset = 0;

  while (true) {
    const result = await supabase
      .from("sales_reps")
      .select(
        "id, slug, display_name, role_title, compensation_plan",
        { count: "exact" },
      )
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + REP_PAGE_SIZE - 1);

    if (result.error) {
      throw new SalesWorkspaceUnavailableError(
        "HomeAtlas could not load the active sales roster.",
      );
    }
    if (result.count === null) {
      throw new SalesWorkspaceUnavailableError(
        "HomeAtlas could not prove that the active sales roster was complete.",
      );
    }

    const page = (result.data ?? []) as SalesRepRow[];
    rows.push(...page);
    offset += page.length;
    if (offset >= result.count) return rows.map(repSource);
    if (page.length === 0) {
      throw new SalesWorkspaceUnavailableError(
        "HomeAtlas could not finish loading the active sales roster.",
      );
    }
  }
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function loadPresentationsForLeadIds(
  leadIds: string[],
): Promise<OwnerSalesPresentationSource[]> {
  if (leadIds.length === 0) return [];
  const supabase = createPrivilegedServerSupabaseClient();
  const rows: PresentationRow[] = [];

  for (const leadIdChunk of chunks(leadIds, PRESENTATION_LEAD_CHUNK_SIZE)) {
    let offset = 0;
    while (true) {
      const result = await supabase
        .from("presentations")
        .select(
          "id, sales_rep_id, sales_rep_lead_id, status, updated_at",
          { count: "exact" },
        )
        .in("sales_rep_lead_id", leadIdChunk)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, offset + PRESENTATION_PAGE_SIZE - 1);

      if (result.error) {
        throw new SalesWorkspaceUnavailableError(
          "HomeAtlas could not verify presentation lineage for the sales pipeline.",
        );
      }
      if (result.count === null) {
        throw new SalesWorkspaceUnavailableError(
          "HomeAtlas could not prove that sales presentation lineage was complete.",
        );
      }

      const page = (result.data ?? []) as PresentationRow[];
      rows.push(...page);
      offset += page.length;
      if (offset >= result.count) break;
      if (page.length === 0) {
        throw new SalesWorkspaceUnavailableError(
          "HomeAtlas could not finish loading sales presentation lineage.",
        );
      }
    }
  }

  return rows.map(
    (row): OwnerSalesPresentationSource => ({
      id: row.id,
      salesRepId: row.sales_rep_id,
      salesRepLeadId: row.sales_rep_lead_id,
      status: row.status,
      updatedAt: row.updated_at,
    }),
  );
}

export async function loadOwnerSalesPipeline(
  reference = new Date(),
): Promise<OwnerSalesPipelineSnapshot> {
  ensureOwnerSalesStorage();
  const reps = await loadAllActiveSalesReps();
  const [snapshots, handoffs] = await Promise.all([
    Promise.all(
      reps.map((rep) => loadSalesLeadAttentionSnapshot(rep.slug, reference)),
    ),
    loadSalesProductionHandoffAttentionForRoster(reps, reference)
      .then((rosterHandoffs): OwnerSalesHandoffSource[] => {
        const repsById = new Map(reps.map((rep) => [rep.id, rep]));
        return rosterHandoffs.flatMap(({ repId, handoff }) => {
          const rep = repsById.get(repId);
          return rep
            ? [
                {
                  repId,
                  repSlug: rep.slug,
                  repDisplayName: rep.displayName,
                  repWorkspacePath: rep.workspacePath,
                  handoff,
                },
              ]
            : [];
        });
      })
      .catch((error: unknown) => {
        console.error(
          "[owner-sales-pipeline] nonfatal signed handoff load failed",
          error,
        );
        return null;
      }),
  ]);
  const leads: OwnerSalesLeadSource[] = snapshots.flatMap((snapshot, index) =>
    snapshot.leads.map((lead) => ({
      repId: reps[index].id,
      repSlug: reps[index].slug,
      lead,
    })),
  );
  const presentations = await loadPresentationsForLeadIds(
    leads.map((source) => source.lead.id),
  );

  return buildOwnerSalesPipelineSnapshot({
    reps,
    leads,
    presentations,
    handoffs,
    reference,
  });
}
