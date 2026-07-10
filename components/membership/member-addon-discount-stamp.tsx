/** Square discount stamp on the physical wallet card — always light-on-dark. */
export function MemberAddonDiscountStamp({
  discountPercent,
}: {
  discountPercent: number;
}) {
  return (
    <div
      className="member-addon-discount-stamp flex min-h-[3.75rem] w-[3.75rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[0.65rem] border border-white/22 bg-black/55 px-1.5 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
      aria-label={`${discountPercent}% off add-on services`}
    >
      <span className="text-[0.75rem] font-semibold leading-none tracking-tight text-white">
        {discountPercent}%
      </span>
      <span className="text-[0.5rem] font-semibold uppercase leading-none tracking-[0.08em] text-white">
        OFF
      </span>
      <span className="text-[0.4375rem] font-medium uppercase leading-none tracking-[0.06em] text-white/75">
        add-ons
      </span>
    </div>
  );
}
