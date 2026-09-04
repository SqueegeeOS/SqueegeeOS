export interface JobberInvoiceDisplay {
  label: string;
  detail: string;
  tone: "success" | "warning" | "neutral";
}

/** A provider observation, not an instruction to charge or proof of Stripe settlement. */
export function jobberInvoiceDisplay(value: string | null | undefined): JobberInvoiceDisplay {
  const status = value?.trim().toLowerCase();
  if (!status || status === "permission_hidden" || !/^[a-z_]{1,48}$/.test(status)) {
    return { label: "Unavailable", tone: "warning", detail: "Invoice status could not be verified. Review Billing or Jobber before collecting." };
  }
  if (status === "none") {
    return { label: "No invoice attached", tone: "neutral", detail: "No invoice was attached to this visit at the last Jobber sync. This does not confirm that nothing is owed." };
  }
  if (status === "paid") {
    return { label: "Paid in Jobber", tone: "success", detail: "Marked paid at the last Jobber sync. No payment action is triggered here." };
  }
  return {
    label: status.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase()),
    tone: "neutral",
    detail: "Status from the last Jobber sync. Review Billing or Jobber before collecting; completing work does not charge the customer.",
  };
}
