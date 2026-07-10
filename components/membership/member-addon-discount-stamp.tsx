/** Square discount stamp on the physical wallet card — always light-on-dark. */
export function MemberAddonDiscountStamp({
  discountPercent,
}: {
  discountPercent: number;
}) {
  return (
    <div
      className="member-addon-discount-stamp flex h-[3.35rem] w-[3.35rem] shrink-0 flex-col items-center justify-center rounded-[0.65rem] border border-white/22 bg-black/55 px-1.5 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
      aria-label={`${discountPercent}% off add-on services`}
    >
      <span className="text-[0.8125rem] font-semibold leading-none tracking-tight text-white">
        {discountPercent}%
      </span>
      <span className="mt-1 text-[0.5625rem] font-semibold uppercase leading-none tracking-[0.1em] text-white">
        OFF
      </span>
    </div>
  );
}
