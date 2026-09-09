import { TYLER_GERMANY_TECHNICIAN_ID } from "@/lib/field-operations/technician-profile";

export function TechnicianOperatingStatusBanner({ technicianId }: { technicianId: string }) {
  if (technicianId !== TYLER_GERMANY_TECHNICIAN_ID) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6 sm:pt-7">
      <div className="rounded-2xl border border-success/25 bg-success/[0.07] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-success/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-success">
            Operating status · full-time independent
          </span>
          <span className="text-xs text-success/80">Tyler Germany · Lead Technician</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          The readiness/competency history below is retained as ongoing quality evidence. It is not a gate on Tyler&apos;s current authority to run normal production independently.
        </p>
      </div>
    </div>
  );
}
