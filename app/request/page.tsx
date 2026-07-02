import type { Metadata } from "next";
import { RequestForm } from "@/components/acquisition/request-form";

export const metadata: Metadata = {
  title: "Request Your Home Care Plan | Squeegeeking",
  description:
    "Begin your personalized Home Care Plan with Squeegeeking — premium home care in Chico, California.",
};

export default function RequestPage() {
  return <RequestForm />;
}
