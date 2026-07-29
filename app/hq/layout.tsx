import { redirect } from "next/navigation";
import { HqAccessError, requireHqActor } from "@/lib/auth/hq-access";

export const dynamic = "force-dynamic";

export default async function HeadquartersLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  try {
    await requireHqActor();
  } catch (error) {
    if (error instanceof HqAccessError && error.status === 403) {
      redirect("/auth/hq?status=access_unavailable");
    }
    if (error instanceof HqAccessError && error.status === 503) {
      redirect("/auth/hq?status=service_unavailable");
    }
    redirect("/auth/hq?next=%2Fhq");
  }

  return (
    <div>
      <form
        action="/auth/hq/sign-out"
        method="post"
        className="fixed right-4 top-4 z-[100]"
      >
        <button
          type="submit"
          className="rounded-full border border-border/70 bg-background/80 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-muted shadow-lg backdrop-blur-xl transition-colors hover:text-foreground"
        >
          Sign out
        </button>
      </form>
      {children}
    </div>
  );
}
