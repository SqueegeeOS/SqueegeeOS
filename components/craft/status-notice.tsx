import type { ReactNode } from "react";

export type StatusNoticeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info";

export function StatusNotice({
  title,
  children,
  tone = "neutral",
  role,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  tone?: StatusNoticeTone;
  role?: "status" | "alert";
  className?: string;
}) {
  return (
    <div
      className={`atlas-status px-4 py-3 text-sm leading-relaxed ${className}`}
      data-tone={tone}
      role={role ?? (tone === "danger" ? "alert" : "status")}
    >
      {title ? <p className="font-medium text-current">{title}</p> : null}
      <div className={title ? "mt-1 opacity-75" : undefined}>{children}</div>
    </div>
  );
}
