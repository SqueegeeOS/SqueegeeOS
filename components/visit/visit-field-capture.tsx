"use client";

import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { businessTodayIsoDate } from "@/lib/admin/company-business-timezone";
import {
  MAX_VISIT_PHOTOS,
  MAX_VISIT_PHOTO_BYTES,
  type VisitFieldRecordCommitInput,
  type VisitPhotoCaptureType,
  type VisitPhotoMimeType,
  type VisitPhotoUploadIntent,
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

interface UploadIntentResponse {
  bucket: string;
  uploads: VisitPhotoUploadIntent[];
  error?: string;
}

interface CommitResponse {
  fieldRecordId?: string;
  assessmentId?: string;
  photoCount?: number;
  error?: string;
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
  onSaved,
}: {
  propertyId: string;
  appointmentId: string;
  clientName: string;
  serviceLabel: string;
  onSaved?: () => void;
}) {
  const [fieldRecordId, setFieldRecordId] = useState(newClientId);
  const [technicianName, setTechnicianName] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (window.localStorage.getItem(TECHNICIAN_NAME_KEY) ?? ""),
  );
  const [visitDate, setVisitDate] = useState(businessTodayIsoDate);
  const [customerSummary, setCustomerSummary] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{
    photoCount: number;
    customerVisibleCount: number;
  } | null>(null);
  const previewUrls = useRef(new Set<string>());
  const saveInFlight = useRef(false);

  useEffect(() => {
    const currentUrls = previewUrls.current;
    return () => {
      for (const url of currentUrls) URL.revokeObjectURL(url);
      currentUrls.clear();
    };
  }, []);

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
    if (accepted.length) setPhotos((current) => [...current, ...accepted]);
  }

  function removePhoto(clientId: string) {
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

  async function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveInFlight.current) return;
    if (!technicianName.trim()) {
      setError("Enter who is documenting this visit.");
      return;
    }
    if (!customerSummary.trim() && !internalNote.trim() && photos.length === 0) {
      setError("Add a customer update, an internal note, or at least one photo.");
      return;
    }

    saveInFlight.current = true;
    setSaving(true);
    setSaved(null);
    setError(null);
    setProgress(photos.length ? "Preparing private uploads…" : "Saving visit memory…");

    try {
      const uploadedPhotos: VisitFieldRecordCommitInput["photos"] = [];
      if (photos.length > 0) {
        const intentResponse = await fetch(
          "/api/admin/field-records/upload-intents",
          {
            method: "POST",
            headers: getAdminRequestHeaders(),
            body: JSON.stringify({
              fieldRecordId,
              propertyId,
              appointmentId,
              photos: photos.map((photo) => ({
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
          const draft = photos.find((photo) => photo.clientId === intent.clientId);
          if (!draft) throw new Error("A selected photo changed before upload.");
          setProgress(`Uploading photo ${index + 1} of ${photos.length}…`);
          const upload = await uploadClient.storage
            .from(intentBody.bucket)
            .uploadToSignedUrl(intent.storagePath, intent.token, draft.file, {
              contentType: draft.file.type,
              cacheControl: "3600",
              upsert: false,
            });
          if (upload.error) throw new Error(`Could not upload ${draft.file.name}.`);
          uploadedPhotos.push({
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

      setProgress("Committing one HomeAtlas visit record…");
      const commitResponse = await fetch("/api/admin/field-records", {
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
          followUpNeeded,
          photos: uploadedPhotos,
        } satisfies VisitFieldRecordCommitInput),
      });
      const commitBody = (await commitResponse.json().catch(() => null)) as
        | CommitResponse
        | null;
      if (!commitResponse.ok || !commitBody?.fieldRecordId) {
        throw new Error(commitBody?.error ?? "Could not save the visit record.");
      }

      window.localStorage.setItem(TECHNICIAN_NAME_KEY, technicianName.trim());
      setSaved({
        photoCount: commitBody.photoCount ?? photos.length,
        customerVisibleCount: photos.filter((photo) => photo.customerVisible).length,
      });
      setProgress(null);
      onSaved?.();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save the visit record.",
      );
      setProgress(null);
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  function startAnotherRecord() {
    for (const photo of photos) {
      URL.revokeObjectURL(photo.previewUrl);
      previewUrls.current.delete(photo.previewUrl);
    }
    setPhotos([]);
    setCustomerSummary("");
    setInternalNote("");
    setFollowUpNeeded(false);
    setFieldRecordId(newClientId());
    setSaved(null);
    setError(null);
  }

  if (saved) {
    return (
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.08] p-5">
        <p className="text-sm font-medium text-emerald-200">Visit record saved.</p>
        <p className="mt-2 text-xs leading-relaxed text-emerald-100/70">
          {saved.photoCount} photo{saved.photoCount === 1 ? "" : "s"} stored
          privately. {saved.customerVisibleCount} will appear in the customer&apos;s
          HomeAtlas portal with the customer update.
        </p>
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
          One save connects the visit, team memory, and customer portal.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted">
            Documented by
          </span>
          <input
            value={technicianName}
            onChange={(event) => setTechnicianName(event.target.value)}
            autoComplete="name"
            placeholder="Your name"
            className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background/80 px-4 text-base text-foreground outline-none focus:border-accent/60"
          />
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
          checked={followUpNeeded}
          onChange={(event) => setFollowUpNeeded(event.target.checked)}
          className="h-4 w-4 accent-amber-400"
        />
        <span className="text-sm text-foreground/80">Flag a follow-up for HQ</span>
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
        {saving ? "Saving one connected record…" : "Save visit record"}
      </button>
    </form>
  );
}
