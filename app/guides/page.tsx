import type { Metadata } from "next";
import Link from "next/link";
import { HOMEOWNER_GUIDES } from "@/lib/marketing/homeowner-guides";

export const metadata: Metadata = {
  title: "Chico Home Care Guides",
  description: "Practical answers about window cleaning quotes, gutter care, solar panels, and recurring home maintenance from SqueegeeKing in Chico.",
  alternates: { canonical: "/guides" },
  openGraph: { title: "Chico Home Care Guides | SqueegeeKing", description: "Know what to ask before booking exterior care for your home.", url: "/guides", type: "website" },
};

export default function GuidesPage() {
  return (
    <main className="min-h-screen bg-[#f5f0e6] px-5 pb-24 pt-32 text-[#173f32] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm uppercase tracking-widest text-[#8f5f37]">SqueegeeKing · Chico, California</p>
        <h1 className="mt-5 font-serif text-5xl font-light sm:text-7xl">A clearer plan for your home.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#526b60]">Straightforward answers about the work, the quote, and the care schedule before you book.</p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {HOMEOWNER_GUIDES.map((guide) => (
            <Link key={guide.slug} href={`/guides/${guide.slug}`} className="rounded-3xl border border-[#173f32]/15 bg-[#fffdf8] p-7 focus-visible:outline-2 focus-visible:outline-offset-4">
              <h2 className="font-serif text-3xl">{guide.title}</h2>
              <p className="mt-4 leading-relaxed text-[#526b60]">{guide.description}</p>
              <span className="mt-6 block font-medium">Read the guide →</span>
            </Link>
          ))}
        </div>
        <Link href="/request" className="mt-12 inline-flex min-h-14 items-center rounded-full bg-[#173f32] px-8 font-medium text-[#fffaf0]">Get a free quote</Link>
      </div>
    </main>
  );
}
