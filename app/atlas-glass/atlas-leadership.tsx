import {
  SQUEEGEEKING_FOUNDERS,
  SQUEEGEEKING_TEAM_LEADS,
} from "@/lib/team/founders";
import type { FounderProfile } from "@/lib/team/types";
import styles from "./atlas-glass.module.css";
import teamStyles from "./atlas-team.module.css";

function LeadershipCard({
  member,
  index,
  compact = false,
}: {
  member: FounderProfile;
  index: number;
  compact?: boolean;
}) {
  const initials = member.name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article
      className={`${styles.founderCard} ${compact ? teamStyles.leadCard : teamStyles.executiveCard}`}
    >
      <div className={styles.founderCardTop}>
        <div
          className={`${styles.founderOrb} ${compact ? teamStyles.leadOrb : ""}`}
          aria-hidden="true"
        >
          <i /><span>{initials}</span><b />
        </div>
        <span className={styles.founderNumber}>
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className={styles.founderIdentity}>
        <small>{member.role}</small>
        <h3>{member.name}</h3>
      </div>
      <p>{member.bio}</p>
      {member.quote ? <blockquote>“{member.quote}”</blockquote> : null}
      {!compact && (
        <span className={styles.founderStatus}>
          <i aria-hidden="true" />Building your care system
        </span>
      )}
    </article>
  );
}

/** The live homepage shares people and titles with the Home Care Plan. */
export function AtlasLeadership() {
  return (
    <div className={teamStyles.hierarchy}>
      <div
        className={teamStyles.executiveGrid}
        role="group"
        aria-label="Company leadership"
      >
        {SQUEEGEEKING_FOUNDERS.map((member, index) => (
          <LeadershipCard key={member.id} member={member} index={index} />
        ))}
      </div>
      <div className={teamStyles.leadGroup} role="group" aria-label="Team leads">
        <p className={teamStyles.leadLabel}>Team leads</p>
        <p className={teamStyles.leadIntro}>
          From your first conversation to the finishing touches.
        </p>
        <div className={teamStyles.leadGrid}>
          {SQUEEGEEKING_TEAM_LEADS.map((member, index) => (
            <LeadershipCard
              key={member.id}
              member={member}
              index={SQUEEGEEKING_FOUNDERS.length + index}
              compact
            />
          ))}
        </div>
      </div>
    </div>
  );
}
