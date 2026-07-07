import { craftEyebrow } from "@/lib/craft/tokens";
import type { CustomerHealthNote } from "@/lib/health/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function PortalCareNotes({
  notes,
  themed = false,
}: {
  notes: CustomerHealthNote[];
  themed?: boolean;
}) {
  if (themed) {
    return (
      <section className="rounded-[1.35rem] border border-border/80 bg-surface/50 px-6 py-5">
        <p className={`mb-4 ${craftEyebrow}`}>
          Care Notes from Your Technician
        </p>
        <div className="space-y-5">
          {notes.map((note) => (
            <div
              key={`${note.visitDate}-${note.customerNote.slice(0, 24)}`}
              className="border-l-2 border-accent/25 pl-4"
            >
              <p className="mb-1 text-[10px] text-muted">
                {formatDate(note.visitDate)}
              </p>
              <p className="text-sm leading-relaxed text-foreground/85">
                {note.customerNote}
              </p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="rounded-2xl bg-[#111] px-6 py-5">
      <p className="mb-4 text-[10px] uppercase tracking-widest text-[#444]">
        Care Notes from Your Technician
      </p>
      <div className="space-y-5">
        {notes.map((note) => (
          <div
            key={`${note.visitDate}-${note.customerNote.slice(0, 24)}`}
            className="border-l-2 border-[#c9a96e22] pl-4"
          >
            <p className="mb-1 text-[10px] text-[#444]">
              {formatDate(note.visitDate)}
            </p>
            <p className="text-sm leading-relaxed text-[#999]">
              {note.customerNote}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
