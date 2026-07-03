import { Suspense } from "react";
import { GoogleReviewsSetupWizard } from "@/components/setup/google-reviews-setup-wizard";

export default function GoogleReviewsSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100svh] items-center justify-center bg-background text-muted">
          Loading setup wizard…
        </div>
      }
    >
      <GoogleReviewsSetupWizard />
    </Suspense>
  );
}
