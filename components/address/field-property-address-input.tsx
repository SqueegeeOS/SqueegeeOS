"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type {
  AddressSuggestion,
  ResolvedAddress,
} from "@/lib/address/google-places-address";
import {
  formatAddressSuggestionFallback,
  formatUsPropertyAddress,
} from "@/lib/address/us-property-address";

function newSessionToken(): string {
  return window.crypto.randomUUID();
}

export function FieldPropertyAddressInput({
  id,
  value,
  onChange,
  className,
  placeholder = "House number and street",
  autoFocus = false,
  required = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className: string;
  placeholder?: string;
  autoFocus?: boolean;
  required?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [lookupStatus, setLookupStatus] = useState("");
  const [lookupDisabled, setLookupDisabled] = useState(false);
  const debounceTimer = useRef<number | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const sessionToken = useRef<string | null>(null);
  const listboxId = `${id}-address-options`;

  useEffect(
    () => () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
      requestController.current?.abort();
    },
    [],
  );

  const currentSessionToken = () => {
    sessionToken.current ??= newSessionToken();
    return sessionToken.current;
  };

  const clearSuggestions = () => {
    requestId.current += 1;
    requestController.current?.abort();
    setSuggestions([]);
    setActiveIndex(-1);
  };

  const findSuggestions = async (input: string) => {
    if (lookupDisabled) return;
    if (!navigator.onLine) {
      clearSuggestions();
      setLookupStatus(
        "Offline—type the address manually and it will stay in this draft.",
      );
      return;
    }

    const currentRequest = ++requestId.current;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setLookupStatus("Finding this house…");

    try {
      const response = await fetch("/api/admin/address-autocomplete", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          action: "suggest",
          input,
          sessionToken: currentSessionToken(),
        }),
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as
        | { suggestions?: AddressSuggestion[]; error?: string }
        | null;
      if (!response.ok) {
        if (response.status === 503) setLookupDisabled(true);
        throw new Error(payload?.error ?? "Address suggestions unavailable.");
      }
      if (currentRequest !== requestId.current) return;

      const nextSuggestions = payload?.suggestions ?? [];
      setSuggestions(nextSuggestions);
      setActiveIndex(-1);
      setLookupStatus(
        nextSuggestions.length > 0
          ? `${nextSuggestions.length} nearby address options found.`
          : "No match yet—keep typing or enter it manually.",
      );
    } catch (error) {
      if (controller.signal.aborted || currentRequest !== requestId.current) {
        return;
      }
      setSuggestions([]);
      setLookupStatus(
        error instanceof Error && error.message.includes("not configured")
          ? "Address suggestions are not configured yet. Manual entry still works."
          : "Suggestions are unavailable. Manual entry still works and stays safe.",
      );
    }
  };

  const updateAddress = (nextValue: string) => {
    onChange(nextValue);
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    clearSuggestions();
    if (nextValue.trim().length < 4 || lookupDisabled) {
      if (nextValue.trim().length < 4) setLookupStatus("");
      return;
    }

    debounceTimer.current = window.setTimeout(() => {
      void findSuggestions(nextValue.trim());
    }, 300);
  };

  const chooseSuggestion = async (suggestion: AddressSuggestion) => {
    clearSuggestions();
    const fallback = formatAddressSuggestionFallback(suggestion.label);
    setLookupStatus("Confirming the full property address…");
    const controller = new AbortController();
    requestController.current = controller;

    try {
      const response = await fetch("/api/admin/address-autocomplete", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          action: "details",
          placeId: suggestion.placeId,
          sessionToken: currentSessionToken(),
        }),
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as
        | { address?: ResolvedAddress; error?: string }
        | null;
      if (!response.ok || !payload?.address) {
        throw new Error(payload?.error ?? "Address details unavailable.");
      }

      onChange(formatUsPropertyAddress(payload.address));
      setLookupStatus(
        "Full property address filled. Tap it to make any correction.",
      );
    } catch {
      if (controller.signal.aborted) return;
      onChange(fallback);
      setLookupStatus("Address selected. Confirm the city and ZIP before saving.");
    } finally {
      sessionToken.current = null;
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      void chooseSuggestion(suggestions[activeIndex]!);
    } else if (event.key === "Escape") {
      clearSuggestions();
      setLookupStatus("Address options closed. Manual entry remains available.");
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        autoFocus={autoFocus}
        required={required}
        maxLength={260}
        autoComplete="street-address"
        value={value}
        onChange={(event) => updateAddress(event.target.value)}
        onKeyDown={handleKeyDown}
        className={className}
        placeholder={placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={suggestions.length > 0}
        aria-controls={suggestions.length > 0 ? listboxId : undefined}
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
        }
      />
      {suggestions.length > 0 ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-2xl border border-white/15 bg-[#11100d] shadow-2xl shadow-black/70"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.placeId}
              id={`${listboxId}-${index}`}
              type="button"
              role="option"
              aria-selected={activeIndex === index}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void chooseSuggestion(suggestion)}
              className={`block min-h-14 w-full border-b border-white/[0.07] px-4 py-3 text-left last:border-0 ${
                activeIndex === index
                  ? "bg-accent/10"
                  : "hover:bg-white/[0.05]"
              }`}
            >
              <span className="block text-sm text-foreground">
                {suggestion.mainText}
              </span>
              <span className="mt-1 block text-[11px] text-muted">
                {suggestion.secondaryText}
              </span>
            </button>
          ))}
          <div className="px-4 py-2 text-right text-[9px] uppercase tracking-[0.12em] text-muted/60">
            Powered by Google
          </div>
        </div>
      ) : null}
      <p
        aria-live="polite"
        className="mt-2 min-h-4 text-[10px] leading-4 text-muted/70"
      >
        {lookupStatus ||
          "Start typing, then tap a nearby match—or keep typing it manually."}
      </p>
    </div>
  );
}
