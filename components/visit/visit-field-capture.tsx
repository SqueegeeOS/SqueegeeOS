"use client";

import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { businessTodayIsoDate } from "@/lib/admin/company-business-timezone";
import {
  clearVisitFieldDraft,
  readVisitFieldDraft,
  writeVisitFieldDraft,
} from "@/lib/field-records/visit-field-draft";
import {
  MAX_VISIT_PHOTOS,
  MAX_VISIT_PHOTO_BYTES,
  buildCompletedScopeCustomerSummary,
  type VisitFieldRecordCommitInput,
  type VisitPhotoCaptureType,
  type VisitPhotoMimeType,
  type VisitPhotoUploadIntent,
  type VisitServiceScopeItemCompletion,
  type VisitServiceScopeReadState,
  VISIT_PHOTO_MIME_TYPES,
} from "@/lib/field-records/visit-field-record";

const TECHNICIAN_NAME_KEY = "squeegeeos-tech-name";

interface PhotoDraft {
  clientId: string;
  file: File;
  captureType: VisitPhotoCaptureType;
  customerVisible: boolean;
  previewUrl: string;
}

type UploadedVisitPhoto = VisitFieldRecordCommitInput["photos"][number];

interface UploadIntentResponse {
  bucket: string;
  uploads: VisitPhotoUploadIntent[];
  error?: string;
}

interface CommitResponse {
  fieldRecordId?: string;
  assessmentId?: string;
  photoCount?: number;
  routeEventRecorded?: boolean | null;
  routeEventWarning?: string | null;
  error?: string;
}

export interface VisitFieldSaveResult {
  fieldRecordId: string;
  routeEventRecorded: boolean | null;
  routeEventWarning: string | null;
}

const CAPTURE_OPTIONS: Array<{
  type: VisitPhotoCaptureType;
  label: string;
  detail: string;
}> = [
  { type: "before", label: "Before", detail: "Arrival condition" },
  { type: "after", label: "After", detail: "Finished result" },
  { type: "detail", label: "Detail", detail: "Something worth remembering" },
];

function newClientId(): string {
  return crypto.randomUUID();
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function savedTechnicianName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(TECHNICIAN_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberTechnicianName(value: string): void {
  try {
    window.localStorage.setItem(TECHNICIAN_NAME_KEY, value);
  } catch {
    // A completed visit must not look failed because device storage is disabled.
  }
}

function createUploadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Photo storage is not configured yet.");
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function VisitFieldCapture({
  propertyId,
  appointmentId,
  clientName,
  serviceLabel,
  scopeItems,
  scopeReadState,
  apiRoutePrefix = "/api/admin",
  lockedTechnicianName,
  completionIntent = "visit_update",
  portalPath,
  billingReviewHref,
  aftercareHref,
  jobberComplete = false,
  onSaved,
  onDraftStateChange,
}: {
  propertyId: string;
  appointmentId: string;
  clientName: string;
  serviceLabel: string;
  scopeItems: Array<Omit<VisitServiceScopeItemCompletion, "completed">>;
  scopeReadState: VisitServiceScopeReadState;
  apiRoutePrefix?: "/api/admin" | "/api/field";
  lockedTechnicianName?: string;
  completionIntent?: "visit_update" | "finish_visit";
  portalPath?: string | null;
  billingReviewHref?: string | null;
  aftercareHref?: string | null;
  jobberComplete?: boolean;
  onSaved?: (result: VisitFieldSaveResult) => void;
  onDraftStateChange?: (hasDraft: boolean) => void;
}) {
  const [initialDraft] = useState(() =>
    typeof window === "undefined"
      ? null
      : readVisitFieldDraft(window.localStorage, { propertyId, appointmentId }),
  );
  const [fieldRecordId, setFieldRecordId] = useState(
    () => initialDraft?.fieldRecordId ?? newClientId(),
  );
  const [technicianName, setTechnicianName] = useState(() =>
    lockedTechnicianName ??
    initialDraft?.technicianName ??
    savedTechnicianName(),
  );
  const [visitDate, setVisitDate] = useState(
    () => initialDraft?.visitDate ?? businessTodayIsoDate(),
  );
  const [customerSummary, setCustomerSummary] = useState(
    () => initialDraft?.customerSummary ?? "",
  );
  const [internalNote, setInternalNote] = useState(
    () => initialDraft?.internalNote ?? "",
  );
  const [followUpNeeded, setFollowUpNeeded] = useState(
    () => initialDraft?.followUpNeeded ?? false,
  );
  const [completedScopeItemIds, setCompletedScopeItemIds] = useState<string[]>(
    () =>
      (initialDraft?.completedScopeItemIds ?? []).filter((id) =>
        scopeItems.some((item) => item.id === id),
      ),
  );
  const [scopeException, setScopeException] = useState(
    () => initialDraft?.scopeException ?? "",
  );
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [restoredPhotoCount, setRestoredPhotoCount] = useState(
    () => initialDraft?.selectedPhotoCount ?? 0,
  );
  const [draftNoticeDismissed, setDraftNoticeDismissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{
    photoCount: number;
    customerVisibleCount: number;
    completedScopeCount: number;
    scopeTotal: number;
    routeEventRecorded: boolean | null;
    routeEventWarning: string | null;
    customerSummaryVisible: boolean;
    followUpOpened: boolean;
  } | null>(null);
  const previewUrls = useRef(new Set<string>());
  const completedUploads = useRef(new Map<string, UploadedVisitPhoto>());
  const saveInFlight = useRef(false);
  const serviceScope = useMemo<VisitServiceScopeItemCompletion[]>(
    () =>
      scopeItems.map((item) => ({
        ...item,
        completed: completedScopeItemIds.includes(item.id),
      })),
    [completedScopeItemIds, scopeItems],
  );
  const incompleteScopeCount = serviceScope.filter(
    (item) => !item.completed,
  ).length;
  const completedScopeCount = serviceScope.length - incompleteScopeCount;
  const scopeVisibilityNeedsAttention =
    scopeReadState === "partial" ||
    scopeReadState === "permission_hidden" ||
    scopeReadState === "not_observed";
  const scopeRequiresException =
    incompleteScopeCount > 0 || scopeVisibilityNeedsAttention;
  const automatedScopeFollowUp =
    scopeException.trim().length > 0;

  useEffect(() => {
    const currentUrls = previewUrls.current;
    return () => {
      for (const url of currentUrls) URL.revokeObjectURL(url);
      currentUrls.clear();
    };
  }, []);

  useEffect(() => {
    if (saved) {
      clearVisitFieldDraft(window.localStorage, { propertyId, appointmentId });
      onDraftStateChange?.(false);
      return;
    }

    const hasMeaningfulDraft =
      customerSummary.trim().length > 0 ||
      internalNote.trim().length > 0 ||
      followUpNeeded ||
      completedScopeItemIds.length > 0 ||
      scopeException.trim().length > 0 ||
      restoredPhotoCount > 0 ||
      photos.length > 0;
    if (!hasMeaningfulDraft) {
      clearVisitFieldDraft(window.localStorage, { propertyId, appointmentId });
      onDraftStateChange?.(false);
      return;
    }

    const draftStored = writeVisitFieldDraft(window.localStorage, {
      version: 1,
      propertyId,
      appointmentId,
      fieldRecordId,
      technicianName,
      visitDate,
      customerSummary,
      internalNote,
      followUpNeeded,
      completedScopeItemIds,
      scopeException,
      selectedPhotoCount: Math.max(restoredPhotoCount, photos.length),
      savedAt: Date.now(),
    });
    onDraftStateChange?.(draftStored);
  }, [
    appointmentId,
    completedScopeItemIds,
    customerSummary,
    fieldRecordId,
    followUpNeeded,
    internalNote,
    onDraftStateChange,
    photos.length,
    propertyId,
    restoredPhotoCount,
    saved,
    scopeException,
    technicianName,
    visitDate,
  ]);

  function addPhotos(captureType: VisitPhotoCaptureType, files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const nextFiles = Array.from(files);
    if (photos.length + nextFiles.length > MAX_VISIT_PHOTOS) {
      setError(`Keep each visit record to ${MAX_VISIT_PHOTOS} photos or fewer.`);
      return;
    }

    const accepted: PhotoDraft[] = [];
    for (const file of nextFiles) {
      if (!VISIT_PHOTO_MIME_TYPES.includes(file.type as VisitPhotoMimeType)) {
        setError(`${file.name} is not a supported phone photo format.`);
        continue;
      }
      if (file.size < 1 || file.size > MAX_VISIT_PHOTO_BYTES) {
        setError(`${file.name} must be 15 MB or smaller.`);
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);
      accepted.push({
        clientId: newClientId(),
        file,
        captureType,
        customerVisible: true,
        previewUrl,
      });
    }
    if (accepted.length) {
      setRestoredPhotoCount(0);
      setPhotos((current) => [...current, ...accepted]);
    }
  }

  function removePhoto(clientId: string) {
    completedUploads.current.delete(clientId);
    setPhotos((current) => {
      const target = current.find((photo) => photo.clientId === clientId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        previewUrls.current.delete(target.previewUrl);
      }
      return current.filter((photo) => photo.clientId !== clientId);
    });
  }

  function togglePhotoVisibility(clientId: string) {
    setPhotos((current) =>
      current.map((photo) =>
        photo.clientId === clientId
          ? { ...photo, customerVisible: !photo.customerVisible }
          : photo,
      ),
    );
  }

  function toggleScopeItem(itemId: string) {
    setError(null);
    setCompletedScopeItemIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    );
  }

  function buildCustomerUpdateFromScope() {
    const summary = buildCompletedScopeCustomerSummary(serviceScope);
    if (summary) setCustomerSummary(summary);
  }

  async function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveInFlight.current) return;
    if (!technicianName.trim()) {
      setError("Enter who is documenting this visit.");
      return;
    }
    if (scopeRequiresException && !scopeException.trim()) {
      setError(
        incompleteScopeCount > 0
          ? "Mark every Jobber service item done, or explain what remains."
          : "Explain how you verified the service scope before closeout.",
      );
      return;
    }
    if (
      completionIntent === "finish_visit" &&
      !customerSummary.trim() &&
      !photos.some((photo) => photo.customerVisible)
    ) {
      setError(
        "Finish the visit with a customer update or at least one portal-visible photo.",
      );
      return;
    }
    if (
      !customerSummary.trim() &&
      !internalNote.trim() &&
      !serviceScope.some((item) => item.completed) &&
      photos.length === 0
    ) {
      setError("Add a customer update, an internal note, or at least one photo.");
      return;
    }

    saveInFlight.current = true;
    setSaving(true);
    setSaved(null);
    setError(null);
    setProgress(
      photos.length
        ? "Preparing private uploads…"
        : completionIntent === "finish_visit"
          ? "Finishing the connected visit…"
          : "Saving visit memory…",
    );

    try {
      const pendingPhotos = photos.filter(
        (photo) => !completedUploads.current.has(photo.clientId),
      );
      if (pendingPhotos.length > 0) {
        const intentResponse = await fetch(
          `${apiRoutePrefix}/field-records/upload-intents`,
          {
            method: "POST",
            headers: getAdminRequestHeaders(),
            body: JSON.stringify({
              fieldRecordId,
              propertyId,
              appointmentId,
              photos: pendingPhotos.map((photo) => ({
                clientId: photo.clientId,
                fileName: photo.file.name,
                mimeType: photo.file.type,
                sizeBytes: photo.file.size,
                captureType: photo.captureType,
                customerVisible: photo.customerVisible,
              })),
            }),
          },
        );
        const intentBody = (await intentResponse.json().catch(() => null)) as
          | UploadIntentResponse
          | null;
        if (!intentResponse.ok || !intentBody) {
          throw new Error(intentBody?.error ?? "Could not prepare photo uploads.");
        }

        const uploadClient = createUploadClient();
        for (const [index, intent] of intentBody.uploads.entries()) {
          const draft = pendingPhotos.find(
            (photo) => photo.clientId === intent.clientId,
          );
          if (!draft) throw new Error("A selected photo changed before upload.");
          setProgress(
            `Uploading unfinished photo ${index + 1} of ${pendingPhotos.length}…`,
          );
          const upload = await uploadClient.storage
            .from(intentBody.bucket)
            .uploadToSignedUrl(intent.storagePath, intent.token, draft.file, {
              contentType: draft.file.type,
              cacheControl: "3600",
              upsert: false,
            });
          if (upload.error) throw new Error(`Could not upload ${draft.file.name}.`);
          completedUploads.current.set(intent.clientId, {
            clientId: intent.clientId,
            fileName: intent.fileName,
            mimeType: intent.mimeType,
            sizeBytes: intent.sizeBytes,
            captureType: intent.captureType,
            customerVisible: intent.customerVisible,
            storagePath: intent.storagePath,
          });
        }
      }

      const uploadedPhotos = photos.map((photo): UploadedVisitPhoto => {
        const uploaded = completedUploads.current.get(photo.clientId);
        if (!uploaded) {
          throw new Error("A selected photo did not finish uploading.");
        }
        return {
          ...uploaded,
          captureType: photo.captureType,
          customerVisible: photo.customerVisible,
        };
      });

      setProgress("Committing one HomeAtlas visit record…");
      const commitResponse = await fetch(`${apiRoutePrefix}/field-records`, {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          fieldRecordId,
          propertyId,
          appointmentId,
          technicianName,
          visitDate,
          customerSummary,
          internalNote,
          followUpNeeded: followUpNeeded || automatedScopeFollowUp,
          scopeReadState,
          serviceScope,
          scopeException,
          photos: uploadedPhotos,
        } satisfies VisitFieldRecordCommitInput),
      });
      const commitBody = (await commitResponse.json().catch(() => null)) as
        | CommitResponse
        | null;
      if (!commitResponse.ok || !commitBody?.fieldRecordId) {
        throw new Error(commitBody?.error ?? "Could not save the visit record.");
      }

      rememberTechnicianName(technicianName.trim());
      clearVisitFieldDraft(window.localStorage, { propertyId, appointmentId });
      onDraftStateChange?.(false);
      setSaved({
        photoCount: commitBody.photoCount ?? photos.length,
        customerVisibleCount: photos.filter((photo) => photo.customerVisible).length,
        completedScopeCount: serviceScope.filter((item) => item.completed).length,
        scopeTotal: serviceScope.length,
        routeEventRecorded: commitBody.routeEventRecorded ?? null,
        routeEventWarning: commitBody.routeEventWarning ?? null,
        customerSummaryVisible: customerSummary.trim().length > 0,
        followUpOpened: followUpNeeded || automatedScopeFollowUp,
      });
      setProgress(null);
      onSaved?.({
        fieldRecordId: commitBody.fieldRecordId,
        routeEventRecorded: commitBody.routeEventRecorded ?? null,
        routeEventWarning: commitBody.routeEventWarning ?? null,
      });
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Could not save the visit record.";
      const retryNote = completedUploads.current.size
        ? " Completed private photo uploads are preserved—tap Save again to resume."
        : "";
      setError(`${message}${retryNote}`);
      setProgress(null);
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  function startAnotherRecord() {
    clearVisitFieldDraft(window.localStorage, { propertyId, appointmentId });
    onDraftStateChange?.(false);
    for (const photo of photos) {
      URL.revokeObjectURL(photo.previewUrl);
      previewUrls.current.delete(photo.previewUrl);
    }
    setPhotos([]);
    completedUploads.current.clear();
    setCustomerSummary("");
    setInternalNote("");
    setFollowUpNeeded(false);
    setCompletedScopeItemIds([]);
    setScopeException("");
    setRestoredPhotoCount(0);
    setDraftNoticeDismissed(true);
    setFieldRecordId(newClientId());
    setSaved(null);
    setError(null);
  }

  if (saved) {
    const visitFinished = completionIntent === "finish_visit";
    const portalPublished =
      saved.customerSummaryVisible || saved.customerVisibleCount > 0;
    const readyForBillingReview = Boolean(
      visitFinished &&
        portalPublished &&
        !saved.followUpOpened &&
        jobberComplete &&
        billingReviewHref,
    );
    const aftercareWillQueue = Boolean(
      visitFinished &&
        portalPublished &&
        !saved.followUpOpened &&
        jobberComplete,
    );
    return (
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.08] p-5">
        <p className="text-sm font-medium text-emerald-200">
          {visitFinished ? "Visit finished." : "Visit record saved."}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-emerald-100/70">
          {saved.photoCount} photo{saved.photoCount === 1 ? "" : "s"} stored
          privately. {saved.customerVisibleCount} portal-visible photo
          {saved.customerVisibleCount === 1 ? " is" : "s are"} attached to this
          exact visit.
        </p>
        {saved.scopeTotal > 0 ? (
          <p className="mt-2 text-xs leading-relaxed text-emerald-100/70">
            {saved.completedScopeCount}/{saved.scopeTotal} Jobber service item
            {saved.scopeTotal === 1 ? "" : "s"} recorded in the durable closeout.
          </p>
        ) : null}
        {saved.routeEventRecorded ? (
          <p className="mt-2 text-xs leading-relaxed text-emerald-100/70">
            Field Run advanced to Service complete automatically.
          </p>
        ) : saved.routeEventWarning ? (
          <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] p-3 text-xs leading-relaxed text-amber-100">
            {saved.routeEventWarning}
          </p>
        ) : null}
        {visitFinished ? (
          <div className="mt-4 space-y-2 border-t border-emerald-300/20 pt-4 text-xs leading-relaxed">
            <p className="text-emerald-100">✓ Property history updated</p>
            <p className={portalPublished ? "text-emerald-100" : "text-amber-100"}>
              {portalPublished
                ? "✓ Customer portal update published"
                : "Customer portal still needs a visible update"}
            </p>
            <p className={readyForBillingReview ? "text-emerald-100" : "text-amber-100"}>
              {readyForBillingReview
                ? "✓ Ready for owner payment review"
                : saved.followUpOpened
                  ? "Billing review waits for the service exception to be resolved"
                  : jobberComplete
                    ? "Payment review needs the final membership checks in Billing"
                    : "Complete the source visit in Jobber before payment review"}
            </p>
            <p className={aftercareWillQueue ? "text-emerald-100" : "text-emerald-100/65"}>
              {aftercareWillQueue
                ? "✓ Human review opportunity will queue in Aftercare after 24 hours"
                : "Aftercare stays paused until Jobber completion and open follow-ups are clear"}
            </p>
            <p className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-emerald-100/65">
              No email, invoice, text, or card charge was submitted.
            </p>
            <div className="grid gap-2 pt-1 sm:grid-cols-2">
              {portalPath ? (
                <Link
                  href={portalPath}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-300/30 px-4 text-center text-xs text-emerald-100"
                >
                  Verify customer portal
                </Link>
              ) : null}
              {readyForBillingReview && billingReviewHref ? (
                <Link
                  href={billingReviewHref}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-accent/40 bg-accent/10 px-4 text-center text-xs text-accent"
                >
                  Review payment readiness
                </Link>
              ) : aftercareHref && aftercareWillQueue ? (
                <Link
                  href={aftercareHref}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-300/25 px-4 text-center text-xs text-emerald-100"
                >
                  Open Aftercare
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={startAnotherRecord}
          className="mt-4 min-h-11 rounded-full border border-emerald-300/30 px-5 text-xs text-emerald-100"
        >
          Add another update
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={saveRecord} aria-busy={saving} className="space-y-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-accent">
          Field record · {clientName}
        </p>
        <p className="mt-2 text-sm text-foreground/75">{serviceLabel}</p>
        <p className="mt-1 text-xs text-muted">
          {completionIntent === "finish_visit"
            ? "One finish action connects proof, property memory, the customer portal, and the owner review queue."
            : "One save connects the visit, team memory, and customer portal."}
        </p>
      </div>

      {initialDraft && !draftNoticeDismissed ? (
        <div
          role="status"
          className="rounded-xl border border-sky-300/25 bg-sky-300/[0.07] p-4 text-sm text-sky-100"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">Draft restored from this device.</p>
              <p className="mt-1 text-xs leading-relaxed text-sky-100/70">
                Visit text and choices stay here for 72 hours without use, then
                clear automatically.
              </p>
              {restoredPhotoCount > 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-amber-100/85">
                  {restoredPhotoCount} phone photo
                  {restoredPhotoCount === 1 ? " was" : "s were"} selected before
                  this closed. Re-add the complete set you still want—browsers do
                  not retain access to phone files.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setDraftNoticeDismissed(true)}
              className="min-h-9 shrink-0 rounded-full border border-sky-200/25 px-3 text-xs text-sky-100"
              aria-label="Dismiss restored draft notice"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#9be2bd]/25 bg-[#9be2bd]/[0.055] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.17em] text-[#9be2bd]">
              Jobber worklist
            </p>
            <p className="mt-1 text-xs leading-relaxed text-foreground/65">
              Mark the purchased work as it is completed. This exact snapshot
              becomes part of the HomeAtlas visit record.
            </p>
          </div>
          {serviceScope.length > 0 ? (
            <span className="shrink-0 rounded-full border border-[#9be2bd]/25 px-3 py-1 text-xs tabular-nums text-[#bff1d5]">
              {completedScopeCount}/{serviceScope.length}
            </span>
          ) : null}
        </div>

        {scopeReadState === "partial" ? (
          <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] p-3 text-xs leading-relaxed text-amber-100">
            Jobber returned more than 50 line items. Open Jobber, verify the
            remaining scope, and record that verification below before closeout.
          </p>
        ) : scopeReadState === "permission_hidden" ||
          scopeReadState === "not_observed" ? (
          <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] p-3 text-xs leading-relaxed text-amber-100">
            HomeAtlas cannot verify this visit&apos;s line items yet. Check the Jobber
            job directly and explain how scope was verified before saving.
          </p>
        ) : serviceScope.length === 0 ? (
          <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-3 text-xs leading-relaxed text-amber-100/80">
            Jobber returned no service line items. Confirm the job details before
            beginning; HomeAtlas will not invent a checklist.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {serviceScope.map((item) => (
              <li key={item.id}>
                <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-3 active:scale-[0.995]">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => toggleScopeItem(item.id)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm font-medium ${
                        item.completed
                          ? "text-emerald-100"
                          : "text-foreground/85"
                      }`}
                    >
                      {item.name}
                      {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                    </span>
                    {item.description ? (
                      <span className="mt-1 block text-xs leading-relaxed text-muted">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`shrink-0 text-[10px] uppercase tracking-[0.13em] ${
                      item.completed ? "text-emerald-300" : "text-muted"
                    }`}
                  >
                    {item.completed ? "Done" : "Open"}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {completedScopeCount > 0 && !customerSummary.trim() ? (
          <button
            type="button"
            onClick={buildCustomerUpdateFromScope}
            className="mt-3 min-h-11 w-full rounded-xl border border-[#9be2bd]/25 bg-[#9be2bd]/[0.07] px-4 text-xs font-medium text-[#c9f3dc] active:scale-[0.995]"
          >
            Build customer update from completed work
          </button>
        ) : null}

        {scopeRequiresException || scopeException.trim() ? (
          <label className="mt-4 block">
            <span className="text-[10px] uppercase tracking-[0.15em] text-amber-200">
              Scope exception or manual verification
            </span>
            <textarea
              value={scopeException}
              onChange={(event) => setScopeException(event.target.value)}
              maxLength={1_200}
              rows={2}
              placeholder={
                incompleteScopeCount > 0
                  ? "What remains, why, and what should HQ do next?"
                  : "How did you verify the purchased work in Jobber?"
              }
              className="mt-2 w-full rounded-xl border border-amber-300/25 bg-background/80 px-4 py-3 text-base leading-relaxed text-foreground outline-none focus:border-amber-300/60"
            />
            <span className="mt-1 block text-[11px] text-amber-100/65">
              Saving with this note automatically opens an HQ follow-up.
            </span>
          </label>
        ) : serviceScope.length > 0 ? (
          <p className="mt-3 text-xs text-emerald-200/75">
            All Jobber service items are ready for durable closeout.
          </p>
        ) : null}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted">
            Documented by
          </span>
          <input
            value={technicianName}
            onChange={(event) => {
              if (!lockedTechnicianName) setTechnicianName(event.target.value);
            }}
            readOnly={Boolean(lockedTechnicianName)}
            autoComplete="name"
            placeholder="Your name"
            className={`mt-2 min-h-12 w-full rounded-xl border border-border px-4 text-base text-foreground outline-none focus:border-accent/60 ${
              lockedTechnicianName ? "bg-white/[0.045]" : "bg-background/80"
            }`}
          />
          {lockedTechnicianName ? (
            <span className="mt-1 block text-[11px] text-[#9be2bd]/70">
              Verified by this technician&apos;s active access
            </span>
          ) : null}
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted">
            Visit date
          </span>
          <input
            type="date"
            value={visitDate}
            onChange={(event) => setVisitDate(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background/80 px-4 text-base text-foreground outline-none focus:border-accent/60"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-[10px] uppercase tracking-[0.15em] text-muted">
          Customer update
        </span>
        <textarea
          value={customerSummary}
          onChange={(event) => setCustomerSummary(event.target.value)}
          maxLength={1_200}
          rows={3}
          placeholder="What was completed, what looked good, and anything the homeowner should know."
          className="mt-2 w-full rounded-xl border border-border bg-background/80 px-4 py-3 text-base leading-relaxed text-foreground outline-none focus:border-accent/60"
        />
        <span className="mt-1 block text-[11px] text-emerald-300/80">
          Shown in the customer portal
        </span>
      </label>

      <label className="block">
        <span className="text-[10px] uppercase tracking-[0.15em] text-muted">
          Internal memory
        </span>
        <textarea
          value={internalNote}
          onChange={(event) => setInternalNote(event.target.value)}
          maxLength={2_500}
          rows={2}
          placeholder="Gate, access, product, sales, or follow-up context for the team only."
          className="mt-2 w-full rounded-xl border border-border bg-background/80 px-4 py-3 text-base leading-relaxed text-foreground outline-none focus:border-accent/60"
        />
        <span className="mt-1 block text-[11px] text-muted">
          Private to HomeAtlas HQ
        </span>
      </label>

      <div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted">
              Visit photos
            </p>
            <p className="mt-1 text-xs text-muted">
              Stored privately; choose portal visibility per photo.
            </p>
          </div>
          <span className="text-xs text-muted">
            {photos.length}/{MAX_VISIT_PHOTOS}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {CAPTURE_OPTIONS.map((option) => (
            <label
              key={option.type}
              className="flex min-h-20 cursor-pointer flex-col justify-center rounded-xl border border-border bg-foreground/[0.035] px-3 py-3 text-center transition active:scale-[0.98] active:border-accent/50"
            >
              <span className="text-sm text-foreground">+ {option.label}</span>
              <span className="mt-1 text-[10px] leading-tight text-muted">
                {option.detail}
              </span>
              <input
                type="file"
                accept={VISIT_PHOTO_MIME_TYPES.join(",")}
                capture="environment"
                multiple
                className="sr-only"
                onChange={(event) => {
                  addPhotos(option.type, event.currentTarget.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          ))}
        </div>
      </div>

      {photos.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {photos.map((photo) => (
            <li
              key={photo.clientId}
              className="overflow-hidden rounded-xl border border-border bg-background/60"
            >
              <div className="relative aspect-[4/3] bg-black/30">
                <Image
                  src={photo.previewUrl}
                  alt={`${photo.captureType} visit preview`}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, 320px"
                  className="object-cover"
                />
                <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[10px] uppercase tracking-wide text-white">
                  {photo.captureType}
                </span>
              </div>
              <div className="space-y-3 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-foreground">{photo.file.name}</p>
                    <p className="mt-1 text-[10px] text-muted">{megabytes(photo.file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.clientId)}
                    className="text-xs text-red-300"
                  >
                    Remove
                  </button>
                </div>
                <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg border border-border px-3">
                  <span className="text-xs text-foreground/75">Show in portal</span>
                  <input
                    type="checkbox"
                    checked={photo.customerVisible}
                    onChange={() => togglePhotoVisibility(photo.clientId)}
                    className="h-4 w-4 accent-emerald-500"
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-foreground/[0.025] px-4">
        <input
          type="checkbox"
          checked={followUpNeeded || automatedScopeFollowUp}
          onChange={(event) => setFollowUpNeeded(event.target.checked)}
          disabled={automatedScopeFollowUp}
          className="h-4 w-4 accent-amber-400"
        />
        <span>
          <span className="block text-sm text-foreground/80">
            Flag a follow-up for HQ
          </span>
          <span className="mt-0.5 block text-[10px] text-muted">
            {automatedScopeFollowUp
              ? "Automatic because this closeout has a scope exception"
              : "Due next business day at 9:00 AM Pacific"}
          </span>
        </span>
      </label>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/[0.07] p-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {progress ? (
        <p aria-live="polite" className="text-center text-xs text-accent">
          {progress}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="min-h-14 w-full rounded-xl border border-accent/50 bg-accent px-5 text-sm font-medium text-black shadow-[0_14px_36px_rgba(197,164,99,0.16)] transition active:scale-[0.99] disabled:opacity-50"
      >
        {saving
          ? completionIntent === "finish_visit"
            ? "Finishing visit…"
            : "Saving one connected record…"
          : completionIntent === "finish_visit"
            ? "Finish Visit"
            : "Save visit record"}
      </button>
    </form>
  );
}
