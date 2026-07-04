import { notFound } from "next/navigation";

/** Property detail pages require live data — no demo properties. */
export async function generateStaticParams() {
  return [];
}

export default function PropertyPage() {
  notFound();
}
