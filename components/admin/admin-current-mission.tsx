"use client";

import type { CurrentMission } from "@/lib/admin/current-mission";

interface AdminCurrentMissionProps {
  missions: CurrentMission[];
}

export function AdminCurrentMission({ missions }: AdminCurrentMissionProps) {
  return (
    <article className="rounded-[1.75rem] border border-accent/20 bg-gradient-to-br from-accent/[0.07] via-surface/70 to-background/30 p-6 sm:p-7">
      <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
        Current Mission
      </p>
      <ul className="mt-5 space-y-3.5">
        {missions.map((mission) => (
          <li
            key={mission.id}
            className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90"
          >
            <span
              className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent"
              aria-hidden
            />
            {mission.text}
          </li>
        ))}
      </ul>
      <p className="mt-5 border-t border-border/50 pt-4 text-[10px] uppercase tracking-[0.16em] text-muted/70">
        Auto-generated · AI coaching coming soon
      </p>
    </article>
  );
}
