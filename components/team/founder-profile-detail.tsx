"use client";

import Image from "next/image";
import { useState } from "react";
import { getFounderSignaturePath } from "@/lib/team/portraits";
import type { FounderProfile } from "@/lib/team/types";
import { FounderPortrait } from "./founder-portrait";

interface FounderProfileDetailProps {
  founder: FounderProfile;
  layout?: "card" | "hero";
  priority?: boolean;
  showSignature?: boolean;
}

/** Full founder block — portrait, bio, quote, optional signature */
export function FounderProfileDetail({
  founder,
  layout = "card",
  priority = false,
  showSignature = false,
}: FounderProfileDetailProps) {
  const [signatureFailed, setSignatureFailed] = useState(false);
  const signatureSrc =
    founder.signaturePath ?? getFounderSignaturePath(founder.slug);

  return (
    <div className="space-y-6">
      <FounderPortrait
        founder={founder}
        layout={layout === "hero" ? "hero" : "card"}
        priority={priority}
      />
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-accent">
          {founder.role}
        </p>
        <h3 className="mt-2 font-serif text-3xl font-light tracking-tight text-foreground sm:text-4xl">
          {founder.name}
        </h3>
        <p className="mt-4 max-w-prose text-base leading-relaxed text-muted">
          {founder.bio}
        </p>
        {founder.quote && (
          <blockquote className="mt-6 border-l border-accent/30 pl-5">
            <p className="font-serif text-xl font-light italic leading-relaxed text-foreground/85">
              &ldquo;{founder.quote}&rdquo;
            </p>
          </blockquote>
        )}
        {showSignature && !signatureFailed && (
          <div className="mt-8">
            <Image
              src={signatureSrc}
              alt={`Signature of ${founder.name}`}
              width={200}
              height={64}
              className="h-12 w-auto opacity-80"
              onError={() => setSignatureFailed(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
