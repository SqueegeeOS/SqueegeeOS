export type AgreementEmailStatus = "sent" | "skipped" | "failed";

export interface AgreementEmailResult {
  status: AgreementEmailStatus;
  reason?: string;
  recipient?: string | null;
  /** How the PDF was included when sent */
  deliveryMode?: "link" | "attachment";
  resendId?: string;
}
