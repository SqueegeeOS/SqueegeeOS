import { AtlasMark } from "@/components/theme/atlas-mark";
import { CUSTOMER_BRAND } from "@/lib/brand/customer";

/** Shared homeowner identity, kept compact enough for the mobile header. */
export function CustomerBrandLockup({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-current [&_svg]:text-current ${className}`}>
      <AtlasMark size={34} />
      <span className="grid gap-0.5">
        <span className="font-serif text-xl font-medium leading-none tracking-normal">
          {CUSTOMER_BRAND.name}
        </span>
        <span className="text-[10px] font-medium uppercase leading-none tracking-[0.16em]">
          with HomeAtlas
        </span>
      </span>
    </span>
  );
}
