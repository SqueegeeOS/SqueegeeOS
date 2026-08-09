import type { Metadata } from "next";
import { ConceptB } from "./concept-b";

export const metadata: Metadata = {
  title: "Your Home's Atlas — HomeAtlas",
  description:
    "A SqueegeeKing homepage concept: your home's year of care as a turnable atlas — visits stamped, today lit, the next visit already on the map.",
  robots: { index: false, follow: false },
};

export default function ConceptBPage() {
  return <ConceptB />;
}
