export type PhotoDocumentKind = "photo" | "document";

export type PhotoDocumentCategory =
  | "visit"
  | "inspection"
  | "agreement"
  | "timeline"
  | "property_profile"
  | "other";

/**
 * Persisted photo or document — maps to `property_assets` table in Supabase.
 * Photos tie to visits/timeline; documents include signed agreements and PDFs.
 */
export interface PersistedPhotoDocument {
  id: string;
  propertyId: string;
  homeownerId: string;
  kind: PhotoDocumentKind;
  category: PhotoDocumentCategory;
  title: string;
  description: string | null;
  /** Public or signed URL — Supabase Storage path in production */
  storagePath: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  visitId: string | null;
  signedAgreementId: string | null;
  capturedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PersistedPhotoDocumentInput = Omit<
  PersistedPhotoDocument,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
};
