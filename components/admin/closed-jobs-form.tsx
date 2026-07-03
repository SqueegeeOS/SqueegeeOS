"use client";

import { useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  appendLocalClosedJob,
  validateClosedJobInput,
} from "@/lib/admin/closed-jobs-store";
import type { ClosedJobInput, SaleType } from "@/lib/admin/closed-jobs-types";
import {
  RECURRING_FREQUENCIES,
  SALE_TYPES,
  SERVICE_CATEGORIES,
} from "@/lib/admin/closed-jobs-types";

const inputClassName =
  "w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-base text-foreground placeholder:text-muted/50 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20";

const labelClassName =
  "mb-2 block text-[10px] uppercase tracking-[0.24em] text-muted";

const emptyForm = (): ClosedJobInput => ({
  customerName: "",
  propertyAddress: "",
  saleAmount: 0,
  saleType: "one_time",
  recurringFrequency: null,
  serviceCategory: "Window Cleaning",
  closedDate: new Date().toISOString().slice(0, 10),
  notes: "",
  createdBy: null,
});

interface ClosedJobsFormProps {
  onLogged: () => void;
}

export function ClosedJobsForm({ onLogged }: ClosedJobsFormProps) {
  const [form, setForm] = useState<ClosedJobInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showFrequency = form.saleType === "recurring_membership";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const payload: ClosedJobInput = {
      ...form,
      saleAmount: Number(form.saleAmount),
      recurringFrequency: showFrequency ? form.recurringFrequency : null,
    };

    const validationError = validateClosedJobInput(payload);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/closed-jobs", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Unable to log closed job.");
        return;
      }

      if (data.storage === "local" && data.job) {
        appendLocalClosedJob(data.job);
      }

      setSuccess(data.message ?? "Closed job logged.");
      setForm(emptyForm());
      onLogged();
    } catch {
      setError("Unable to log closed job. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClassName} htmlFor="customer-name">
            Customer name
          </label>
          <input
            id="customer-name"
            required
            value={form.customerName}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, customerName: event.target.value }))
            }
            className={inputClassName}
            placeholder="Homeowner name"
          />
        </div>
        <div>
          <label className={labelClassName} htmlFor="property-address">
            Property address
          </label>
          <input
            id="property-address"
            required
            value={form.propertyAddress}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, propertyAddress: event.target.value }))
            }
            className={inputClassName}
            placeholder="Street, city"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClassName} htmlFor="sale-amount">
            Sale amount
          </label>
          <input
            id="sale-amount"
            required
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={form.saleAmount || ""}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                saleAmount: Number(event.target.value),
              }))
            }
            className={inputClassName}
            placeholder="0.00"
          />
        </div>
        <div>
          <label className={labelClassName} htmlFor="closed-date">
            Closed date
          </label>
          <input
            id="closed-date"
            required
            type="date"
            value={form.closedDate}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, closedDate: event.target.value }))
            }
            className={inputClassName}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClassName} htmlFor="sale-type">
            Sale type
          </label>
          <select
            id="sale-type"
            value={form.saleType}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                saleType: event.target.value as SaleType,
                recurringFrequency:
                  event.target.value === "recurring_membership"
                    ? prev.recurringFrequency ?? "monthly"
                    : null,
              }))
            }
            className={inputClassName}
          >
            {SALE_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {showFrequency ? (
          <div>
            <label className={labelClassName} htmlFor="recurring-frequency">
              Recurring frequency
            </label>
            <select
              id="recurring-frequency"
              required
              value={form.recurringFrequency ?? "monthly"}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  recurringFrequency: event.target.value as ClosedJobInput["recurringFrequency"],
                }))
              }
              className={inputClassName}
            >
              {RECURRING_FREQUENCIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className={labelClassName} htmlFor="service-category">
              Service category
            </label>
            <select
              id="service-category"
              value={form.serviceCategory}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, serviceCategory: event.target.value }))
              }
              className={inputClassName}
            >
              {SERVICE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {showFrequency && (
        <div>
          <label className={labelClassName} htmlFor="service-category-recurring">
            Service category
          </label>
          <select
            id="service-category-recurring"
            value={form.serviceCategory}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, serviceCategory: event.target.value }))
            }
            className={inputClassName}
          >
            {SERVICE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelClassName} htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          rows={3}
          value={form.notes}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, notes: event.target.value }))
          }
          className={inputClassName}
          placeholder="Optional context for Noah & Dasan"
        />
      </div>

      {error && (
        <p className="text-sm text-red-300/90" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-2xl border border-accent/25 bg-accent/[0.06] px-4 py-3 text-sm text-accent">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex min-h-[52px] w-full items-center justify-center rounded-full border border-accent/30 bg-accent px-6 text-sm font-medium tracking-[0.12em] text-background transition-opacity hover:opacity-95 disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
      >
        {submitting ? "Logging…" : "Log Closed Job"}
      </button>
    </form>
  );
}
