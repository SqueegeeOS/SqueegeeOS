import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const DISPOSABLE_ACK = "I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_DATABASE";
const configured =
  process.env.PR1B_DISPOSABLE_DB_ACK === DISPOSABLE_ACK &&
  Boolean(process.env.PR1B_TEST_SUPABASE_URL) &&
  Boolean(process.env.PR1B_TEST_SUPABASE_ANON_KEY) &&
  Boolean(process.env.PR1B_TEST_SUPABASE_SERVICE_ROLE_KEY) &&
  Boolean(process.env.PR1B_TEST_APP_URL);

const integration = configured ? describe : describe.skip;

function client(key: string): SupabaseClient {
  return createClient(process.env.PR1B_TEST_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function expectDenied(operation: PromiseLike<{ error: unknown }>) {
  const result = await operation;
  expect(result.error).toBeTruthy();
}

const signature =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const conflictingSignature =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

integration("migration 036 disposable Supabase authority rehearsal", () => {
  it(
    "denies anon/authenticated table and RPC authority while signing converges coherently",
    async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.PR1B_TEST_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
        process.env.PR1B_TEST_SUPABASE_ANON_KEY;
      process.env.NEXT_PUBLIC_SUPABASE_ENABLED = "true";
      process.env.NEXT_PUBLIC_PERSISTENCE_BACKEND = "supabase";
      process.env.SUPABASE_SERVICE_ROLE_KEY =
        process.env.PR1B_TEST_SUPABASE_SERVICE_ROLE_KEY;

      const service = client(process.env.PR1B_TEST_SUPABASE_SERVICE_ROLE_KEY!);
      const anon = client(process.env.PR1B_TEST_SUPABASE_ANON_KEY!);
      const authenticated = client(process.env.PR1B_TEST_SUPABASE_ANON_KEY!);
      const suffix = crypto.randomUUID();
      const appUrl = process.env.PR1B_TEST_APP_URL!.replace(/\/$/, "");
      const createdIds: Record<string, string> = {};

      const { data: authUser, error: authUserError } =
        await service.auth.admin.createUser({
          email: `pr1b-${suffix}@example.invalid`,
          password: `Pr1b-${suffix}-Disposable!`,
          email_confirm: true,
        });
      expect(authUserError).toBeNull();
      expect(authUser.user?.id).toBeTruthy();
      const { error: signInError } = await authenticated.auth.signInWithPassword({
        email: `pr1b-${suffix}@example.invalid`,
        password: `Pr1b-${suffix}-Disposable!`,
      });
      expect(signInError).toBeNull();

      const { createAuthorizedPresentation, patchAuthorizedPresentation } =
        await import("@/lib/presentations/server-authoring");
      const { markPresentationPresentedByCapability } = await import(
        "@/lib/presentations/repository"
      );
      const actor = {
        id: authUser.user!.id,
        email: `pr1b-${suffix}@example.invalid`,
        role: "owner" as const,
      };
      const createPresentation = async (
        name: string,
        address = `${suffix.slice(0, 8)} Test Way, Chico, CA 95928`,
      ) => {
        const draft = await createAuthorizedPresentation(
          {
            authoringSource: "manual",
            clientName: name,
            pricing: {
              squareFeet: 2500,
              frequency: "quarterly",
              includeInterior: false,
              twoStory: false,
              includeScreens: false,
              exteriorAddOns: [],
            },
          },
          actor,
        );
        const authored = await patchAuthorizedPresentation(draft.id, {
          clientAddress: address,
        });
        expect(authored).toBeTruthy();
        const presented = await markPresentationPresentedByCapability(draft.id);
        expect(presented?.status).toBe("presented");
        return draft.id;
      };

      const presentationId = await createPresentation(
        `PR1B Rehearsal ${suffix}`,
      );
      createdIds.presentations = presentationId;

      const sign = (
        agreementTier: "quarterly" | "biannual" = "quarterly",
        signatureDataUrl = signature,
      ) =>
        fetch(`${appUrl}/api/sign-agreement`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            presentationId,
            agreementTier,
            signatureDataUrl,
          }),
        });

      const malformedResponse = await sign(
        "quarterly",
        "data:image/png;base64,iVBORw0KGgo=",
      );
      expect(malformedResponse.status).toBe(400);
      for (const [table, column] of [
        ["presentation_signing_attempts", "presentation_id"],
        ["homeowners", "source_presentation_id"],
        ["properties", "source_presentation_id"],
        ["memberships", "presentation_id"],
        ["signed_agreements", "presentation_id"],
      ] as const) {
        const { count, error } = await service
          .from(table)
          .select("*", { count: "exact", head: true })
          .eq(column, presentationId);
        expect(error).toBeNull();
        expect(count).toBe(0);
      }

      const [firstResponse, concurrentRetryResponse] = await Promise.all([
        sign(),
        sign(),
      ]);
      expect(firstResponse.status).toBe(200);
      expect(concurrentRetryResponse.status).toBe(200);
      const first = (await firstResponse.json()) as Record<string, string>;
      const concurrentRetry =
        (await concurrentRetryResponse.json()) as Record<string, string>;
      for (const field of [
        "homeownerId",
        "propertyId",
        "membershipId",
        "agreementId",
      ]) {
        expect(first[field]).toBeTruthy();
        expect(concurrentRetry[field]).toBe(first[field]);
      }
      expect((await sign()).status).toBe(200);
      expect((await sign("biannual")).status).toBe(409);
      expect((await sign("quarterly", conflictingSignature)).status).toBe(409);

      const collisionStreet = `Case ${suffix.slice(0, 8)} Spacing Way`;
      const { data: collisionHomeowner, error: collisionHomeownerError } =
        await service
          .from("homeowners")
          .insert({
            slug: `collision-${suffix}`,
            full_name: "Existing Collision Owner",
            first_name: "Existing",
          })
          .select("id")
          .single();
      expect(collisionHomeownerError).toBeNull();
      const { error: collisionPropertyError } = await service
        .from("properties")
        .insert({
          homeowner_id: collisionHomeowner!.id,
          slug: `collision-${suffix}`,
          name: "Existing Collision Property",
          address: `  ${collisionStreet.toUpperCase().replaceAll(" ", "   ")}  `,
          city: "  CHICO ",
          state: " ca ",
          zip: " 95928 ",
          type: "Residence",
        });
      expect(collisionPropertyError).toBeNull();

      const collisionPresentationId = await createPresentation(
        `PR1B Address Collision ${suffix}`,
        `${collisionStreet}, Chico, CA 95928`,
      );
      const collisionResponse = await fetch(`${appUrl}/api/sign-agreement`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          presentationId: collisionPresentationId,
          agreementTier: "quarterly",
          signatureDataUrl: signature,
        }),
      });
      expect(collisionResponse.status).toBe(409);
      const { data: collisionAttempt, error: collisionAttemptError } =
        await service
          .from("presentation_signing_attempts")
          .select("status, last_conflict_reason")
          .eq("presentation_id", collisionPresentationId)
          .single();
      expect(collisionAttemptError).toBeNull();
      expect(collisionAttempt?.status).toBe("held");
      expect(collisionAttempt?.last_conflict_reason).toContain(
        "property address already exists",
      );
      for (const table of ["homeowners", "properties"] as const) {
        const { count } = await service
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("source_presentation_id", collisionPresentationId);
        expect(count).toBe(0);
      }
      const { count: collisionMembershipCount } = await service
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("presentation_id", collisionPresentationId);
      const { count: collisionAgreementCount } = await service
        .from("signed_agreements")
        .select("id", { count: "exact", head: true })
        .eq("presentation_id", collisionPresentationId);
      expect(collisionMembershipCount).toBe(0);
      expect(collisionAgreementCount).toBe(0);

      Object.assign(createdIds, {
        homeowners: first.homeownerId,
        properties: first.propertyId,
        memberships: first.membershipId,
        signed_agreements: first.agreementId,
      });

      const { data: plan, error: planError } = await service
        .from("home_care_plans")
        .select("id")
        .eq("property_id", first.propertyId)
        .single();
      expect(planError).toBeNull();
      createdIds.home_care_plans = plan!.id as string;

      const { data: asset, error: assetError } = await service
        .from("property_assets")
        .insert({
          homeowner_id: first.homeownerId,
          property_id: first.propertyId,
          kind: "document",
          category: "other",
          title: "PR1B disposable authority fixture",
          storage_path: `rehearsal/${suffix}`,
        })
        .select("id")
        .single();
      expect(assetError).toBeNull();
      createdIds.property_assets = asset!.id as string;

      const insertAttempts = (roleClient: SupabaseClient) => [
        roleClient.from("homeowners").insert({
          slug: `denied-${suffix}`,
          full_name: "Denied",
          first_name: "Denied",
        }),
        roleClient.from("properties").insert({
          homeowner_id: first.homeownerId,
          slug: `denied-${suffix}`,
          name: "Denied",
          address: "Denied",
          city: "Denied",
          state: "CA",
        }),
        roleClient.from("home_care_plans").insert({
          homeowner_slug: `denied-${suffix}`,
          property_slug: `denied-${suffix}`,
          presentation: {},
        }),
        roleClient.from("memberships").insert({
          homeowner_id: first.homeownerId,
          property_id: first.propertyId,
          plan_id: "preferred",
          plan_name: "Denied",
          price_display: "$0",
          billing_period: "per_visit",
        }),
        roleClient.from("signed_agreements").insert({
          homeowner_slug: `denied-${suffix}`,
          property_slug: `denied-${suffix}`,
          homeowner_name: "Denied",
          plan_id: "preferred",
          plan_name: "Denied",
          signature_method: "drawn",
          signer_name: "Denied",
          signed_at: new Date().toISOString(),
        }),
        roleClient.from("property_assets").insert({
          homeowner_id: first.homeownerId,
          property_id: first.propertyId,
          kind: "document",
          title: "Denied",
          storage_path: `denied/${suffix}`,
        }),
        roleClient.from("presentations").insert({
          id: crypto.randomUUID(),
          created_by: "denied",
          client_name: "Denied",
          home_sqft: 2500,
          tier: "quarterly",
        }),
      ];
      for (const roleClient of [anon, authenticated]) {
        for (const attempt of insertAttempts(roleClient)) {
          await expectDenied(attempt);
        }
      }

      const updateFields: Record<string, Record<string, unknown>> = {
        homeowners: { full_name: "Denied update" },
        properties: { name: "Denied update" },
        home_care_plans: { status: "archived" },
        memberships: { status: "cancelled" },
        signed_agreements: { status: "voided" },
        property_assets: { title: "Denied update" },
        presentations: { status: "draft" },
      };
      for (const roleClient of [anon, authenticated]) {
        for (const [table, id] of Object.entries(createdIds)) {
          await expectDenied(
            roleClient.from(table).update(updateFields[table]).eq("id", id),
          );
          await expectDenied(roleClient.from(table).delete().eq("id", id));
        }
      }

      const rpcAttempts = (roleClient: SupabaseClient) => [
        roleClient.rpc("claim_presentation_signing_attempt", {
          p_presentation_id: presentationId,
          p_attempt_id: crypto.randomUUID(),
          p_agreement_tier: "quarterly",
          p_signature_sha256: "0".repeat(64),
          p_presentation_authority_sha256: "0".repeat(64),
        }),
        roleClient.rpc("finalize_presentation_signing_attempt", {
          p_presentation_id: presentationId,
          p_attempt_id: crypto.randomUUID(),
          p_homeowner_id: first.homeownerId,
          p_property_id: first.propertyId,
          p_membership_id: first.membershipId,
          p_homeowner_slug: "denied",
          p_property_slug: "denied",
          p_homeowner_name: "Denied",
          p_plan_id: "preferred",
          p_plan_name: "Denied",
          p_signature_image_url: "denied",
          p_signature_storage_path: "denied",
          p_pdf_storage_ref: "denied",
          p_ip_address: null,
          p_user_agent: null,
          p_visit_price: 1,
          p_annual_rate: 1,
          p_enrollment_savings: 1,
        }),
        roleClient.rpc("save_hq_home_care_plan", {
          p_homeowner_slug: "denied",
          p_homeowner_full_name: "Denied",
          p_homeowner_first_name: "Denied",
          p_homeowner_email: null,
          p_homeowner_phone: null,
          p_property_slug: "denied",
          p_property_name: "Denied",
          p_property_address: "Denied",
          p_property_city: "Denied",
          p_property_state: "CA",
          p_property_zip: "",
          p_property_type: "Residence",
          p_property_hero_image: null,
          p_property_home_care_score: null,
          p_property_year_built: null,
          p_property_narrative: null,
          p_presentation: {},
          p_draft: {},
        }),
      ];
      for (const roleClient of [anon, authenticated]) {
        for (const attempt of rpcAttempts(roleClient)) {
          await expectDenied(attempt);
        }
      }

      for (const [table, id] of Object.entries(createdIds)) {
        const { count, error } = await service
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("id", id);
        expect(error).toBeNull();
        expect(count).toBe(1);
      }
      const { count: agreementCount } = await service
        .from("signed_agreements")
        .select("id", { count: "exact", head: true })
        .eq("presentation_id", presentationId)
        .eq("status", "complete");
      expect(agreementCount).toBe(1);

      if (process.env.PR1B_TEST_SIGNING_FAULT_STAGE) {
        const faultPresentationId = await createPresentation(
          `PR1B Fault ${suffix}`,
        );
        const faultSign = () =>
          fetch(`${appUrl}/api/sign-agreement`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              presentationId: faultPresentationId,
              agreementTier: "quarterly",
              signatureDataUrl: signature,
            }),
          });
        expect((await faultSign()).status).toBe(500);
        expect((await faultSign()).status).toBe(200);
      }
      // Signed evidence is intentionally retained. Reset the disposable
      // project after rehearsal instead of deleting agreement history here.
    },
    120_000,
  );
});
