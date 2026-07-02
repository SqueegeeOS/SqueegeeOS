"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import type { Property } from "@/lib/property/types";
import { easeLuxury } from "@/lib/property/motion";
import {
  AIIndicator,
  HealthBadge,
  MembershipBadge,
  StatCell,
} from "../ui/badges";

export function PropertyCard({ property }: { property: Property }) {
  const fullAddress = `${property.address}, ${property.city}, ${property.state}`;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.7, ease: easeLuxury },
        },
      }}
    >
      <Link href={`/properties/${property.slug}`} className="group block">
        <article className="overflow-hidden rounded-[1.75rem] border border-border bg-surface transition-colors duration-500 hover:border-accent/20">
          <div className="relative aspect-[16/10] overflow-hidden">
            <Image
              src={property.heroImage}
              alt={property.name}
              fill
              className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 560px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

            <div className="absolute left-6 right-6 top-6 flex items-start justify-between gap-4">
              <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-foreground/80 backdrop-blur-sm">
                {property.type}
              </span>
              <HealthBadge status={property.healthStatus} />
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
              <h2 className="font-serif text-3xl font-light tracking-tight text-foreground sm:text-4xl">
                {property.name}
              </h2>
              <p className="mt-2 text-sm tracking-wide text-foreground/65">
                {fullAddress}
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-5xl font-light tracking-tight text-accent">
                  {property.homeCareScore}
                </span>
                <span className="text-[11px] uppercase tracking-[0.28em] text-muted">
                  Care Score
                </span>
              </div>
              <MembershipBadge status={property.membershipStatus} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
              <StatCell label="Last Visit" value={property.lastVisit} />
              <StatCell
                label="Next Visit"
                value={property.nextScheduledVisit ?? "—"}
              />
              <StatCell label="Photos" value={property.photoCount.toLocaleString()} />
              <StatCell label="Timeline" value={`${property.timelineLength} entries`} />
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-border pt-6">
              <AIIndicator status={property.aiStatus} />
              <span className="text-[11px] uppercase tracking-[0.28em] text-muted transition-colors duration-300 group-hover:text-accent">
                Open Property →
              </span>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}
