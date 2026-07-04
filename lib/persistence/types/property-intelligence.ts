export type PropertyPhotoSource =
  | "zillow"
  | "our_team"
  | "member_uploaded"
  | "internal";

/** Structured facts stored in `properties.property_details` JSONB */
export interface PropertyDetailsRecord {
  squareFootage?: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  lotSize?: number;
  roofType?: string;
  windowCount?: number;
  stories?: number;
  hasPool?: boolean;
  hasDeck?: boolean;
  exteriorMaterial?: string;
}

/** Intelligence fields on `properties` (extends PersistedProperty) */
export interface PropertyIntelligenceFields {
  zillowUrl: string | null;
  propertyDetails: PropertyDetailsRecord;
  accessInstructions: string | null;
  serviceNotes: string[];
  preferredProducts: string[];
}

/** Photo priority fields on `property_assets` */
export interface PropertyPhotoFields {
  photoSource: PropertyPhotoSource | null;
  isPrimary: boolean;
  /** External URL when not in Supabase Storage (e.g. Zillow OG image) */
  externalUrl: string | null;
}

export interface PropertyPhotoRecord {
  id: string;
  propertyId: string;
  source: PropertyPhotoSource;
  url: string;
  caption: string | null;
  isPrimary: boolean;
  uploadedAt: string;
}
