export type HomeCondition = "excellent" | "good" | "fair" | "rough";

export type HomeownerVibe = "proud" | "practical" | "busy" | "skeptical";

export type AIQuoteStatus =
  | "draft"
  | "generated"
  | "sent"
  | "accepted"
  | "declined";

/** Technician field input — stored in service_observations + ai_quotes.field_inputs */
export interface FieldObservationFlags {
  heavyPollen?: boolean;
  windowOxidation?: boolean;
  guttersFull?: boolean;
  roofAlgae?: boolean;
  drivewayStaining?: boolean;
  softMoss?: boolean;
}

export interface FieldInputs {
  address?: string;
  homeCondition: HomeCondition | null;
  observations: string[];
  observationFlags: FieldObservationFlags;
  homeownerVibe: HomeownerVibe | null;
  notes: string;
}

/** Maps to `service_observations` */
export interface PersistedServiceObservation {
  id: string;
  propertyId: string;
  memberProfileId: string | null;
  appointmentId: string | null;
  observedBy: string | null;
  homeCondition: HomeCondition | null;
  observationFlags: FieldObservationFlags;
  homeownerVibe: HomeownerVibe | null;
  notes: string;
  observedAt: string;
  createdAt: string;
}

export type PersistedServiceObservationInput = Omit<
  PersistedServiceObservation,
  "id" | "createdAt"
> & {
  id?: string;
};

/** Maps to `ai_quotes` */
export interface PersistedAIQuote {
  id: string;
  propertyId: string;
  memberProfileId: string | null;
  observationId: string | null;
  status: AIQuoteStatus;
  fieldInputs: FieldInputs;
  generatedText: string | null;
  model: string | null;
  promptVersion: string;
  generatedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PersistedAIQuoteInput = Omit<
  PersistedAIQuote,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

/** Generated quote returned to the field app */
export interface AIQuoteResult {
  text: string;
  generatedAt: string;
  propertyId: string;
  quoteId?: string;
  fieldInputs: FieldInputs;
}
