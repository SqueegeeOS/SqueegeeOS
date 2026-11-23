import { fieldCustomerPhoneLabel, normalizeFieldCustomerPhone, type FieldCustomerPhone } from "@/lib/field-operations/field-customer-phone";

/** A link hands off to the device dialer; viewing a job never starts a call. */
export function JobCustomerContact({ phones }: { phones: FieldCustomerPhone[] }) {
  const valid = phones.filter(({ number }) => normalizeFieldCustomerPhone(number) === number);
  return (
    <section aria-label="Customer phone" className="mt-3 rounded-xl border border-foreground/10 bg-foreground/[0.025] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted">Customer phone · Jobber</p>
      {valid.length ? (
        <ul className="mt-1">
          {valid.map(({ number, primary }) => {
            const label = fieldCustomerPhoneLabel(number);
            return (
              <li key={number} className="flex flex-wrap items-center gap-x-3">
                <a href={"tel:" + number} aria-label={"Call " + label} className="inline-flex min-h-11 items-center text-sm font-semibold text-accent underline underline-offset-4">
                  {label}
                </a>
                <span className="text-xs text-muted">{primary ? "Primary" : "Additional"}</span>
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-2 text-sm text-muted">No Jobber phone number available for this job.</p>}
    </section>
  );
}
