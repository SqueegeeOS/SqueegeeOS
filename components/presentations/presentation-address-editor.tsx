"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  isValidUsPostalCode,
  normalizeUsPostalCodeInput,
} from "@/lib/address/postal-code";
import { parseClientAddress } from "@/lib/presentations/parse-client-address";
import { EditorTextInput } from "./presentation-editor-kit";

interface AddressParts {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface AddressSuggestion {
  placeId: string;
  label: string;
  mainText: string;
  secondaryText: string;
}

function createSessionToken(): string {
  return crypto.randomUUID();
}

function initialAddressParts(value: string): AddressParts {
  const parsed = parseClientAddress(value);
  if (parsed.city || parsed.state || parsed.zip) {
    return {
      street: parsed.address,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
    };
  }

  const commaParts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return commaParts.length === 2
    ? { street: commaParts[0]!, city: commaParts[1]!, state: "", zip: "" }
    : { street: value.trim(), city: "", state: "", zip: "" };
}

function formatAddress(parts: AddressParts): string {
  const stateZip = [parts.state.trim().toUpperCase(), parts.zip.trim()]
    .filter(Boolean)
    .join(" ");
  return [parts.street.trim(), parts.city.trim(), stateZip]
    .filter(Boolean)
    .join(", ");
}

export function PresentationAddressEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [parts, setParts] = useState<AddressParts>(() => initialAddressParts(value));
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [lookupStatus, setLookupStatus] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);
  const sessionToken = useRef(createSessionToken());

  const update = (patch: Partial<AddressParts>) => {
    const next = { ...parts, ...patch };
    setParts(next);
    onChange(formatAddress(next));
  };

  const zipInvalid = parts.zip.length > 0 && !isValidUsPostalCode(parts.zip);

  const findSuggestions = async (input: string) => {
    const currentRequest = ++requestId.current;
    setLookupStatus("Searching addresses…");
    try {
      const response = await fetch("/api/admin/address-autocomplete", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          action: "suggest",
          input,
          sessionToken: sessionToken.current,
        }),
      });
      if (!response.ok) throw new Error("Address suggestions unavailable");
      const payload = (await response.json()) as {
        suggestions?: AddressSuggestion[];
      };
      if (currentRequest !== requestId.current) return;
      const nextSuggestions = payload.suggestions ?? [];
      setSuggestions(nextSuggestions);
      setActiveIndex(-1);
      setLookupStatus(
        nextSuggestions.length > 0
          ? `${nextSuggestions.length} address options found.`
          : "No matches yet. Keep typing or enter it manually.",
      );
    } catch {
      if (currentRequest !== requestId.current) return;
      setSuggestions([]);
      setLookupStatus("Suggestions unavailable. You can still type the address manually.");
    }
  };

  const updateStreet = (street: string) => {
    update({ street });
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (street.trim().length < 4) {
      requestId.current += 1;
      setSuggestions([]);
      setLookupStatus("");
      return;
    }
    debounceTimer.current = setTimeout(() => {
      void findSuggestions(street.trim());
    }, 300);
  };

  const chooseSuggestion = async (suggestion: AddressSuggestion) => {
    setSuggestions([]);
    setActiveIndex(-1);
    setLookupStatus("Filling address…");
    try {
      const response = await fetch("/api/admin/address-autocomplete", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({
          action: "details",
          placeId: suggestion.placeId,
          sessionToken: sessionToken.current,
        }),
      });
      if (!response.ok) throw new Error("Address details unavailable");
      const payload = (await response.json()) as { address: AddressParts };
      const next = payload.address;
      setParts(next);
      onChange(formatAddress(next));
      setLookupStatus("Address filled. You can edit any field.");
      sessionToken.current = createSessionToken();
    } catch {
      update({ street: suggestion.mainText });
      setLookupStatus("We filled the street. Please confirm the city, state, and ZIP.");
      sessionToken.current = createSessionToken();
    }
  };

  const handleStreetKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
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
      setSuggestions([]);
      setActiveIndex(-1);
    }
  };

  return (
    <div>
      <p className="mb-1.5 text-[11px] text-[#888]">Service address</p>
      <div className="grid gap-2 sm:grid-cols-6">
        <div className="relative sm:col-span-6">
          <input
            type="text"
            value={parts.street}
            name="address-line1"
            autoComplete="address-line1"
            placeholder="123 Main St"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestions.length > 0}
            aria-controls="presentation-address-options"
            aria-activedescendant={
              activeIndex >= 0 ? `presentation-address-option-${activeIndex}` : undefined
            }
            onChange={(event) => updateStreet(event.target.value)}
            onKeyDown={handleStreetKeyDown}
            className="w-full rounded-xl border border-[#222] bg-[#111] px-3.5 py-3 text-sm text-[#ddd] outline-none placeholder:text-[#333] focus:border-[#c9a96e]/50"
          />
          {suggestions.length > 0 ? (
            <div
              id="presentation-address-options"
              role="listbox"
              className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-[#29251d] bg-[#111] shadow-2xl shadow-black/60"
            >
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.placeId}
                  id={`presentation-address-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void chooseSuggestion(suggestion)}
                  className={`block w-full border-b border-[#1d1d1d] px-3.5 py-3 text-left last:border-0 ${
                    activeIndex === index ? "bg-[#1a1710]" : "hover:bg-[#171717]"
                  }`}
                >
                  <span className="block text-sm text-[#ddd]">
                    {suggestion.mainText}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#777]">
                    {suggestion.secondaryText}
                  </span>
                </button>
              ))}
              <div className="px-3.5 py-1.5 text-right text-[9px] tracking-wide text-[#555]">
                Powered by Google
              </div>
            </div>
          ) : null}
        </div>
        <div className="sm:col-span-3">
          <EditorTextInput
            value={parts.city}
            name="address-level2"
            autoComplete="address-level2"
            placeholder="Chico"
            onChange={(city) => update({ city })}
          />
        </div>
        <div className="sm:col-span-1">
          <EditorTextInput
            value={parts.state}
            name="address-level1"
            autoComplete="address-level1"
            placeholder="CA"
            onChange={(state) => update({ state: state.slice(0, 2).toUpperCase() })}
          />
        </div>
        <div className="sm:col-span-2">
          <EditorTextInput
            value={parts.zip}
            name="postal-code"
            autoComplete="postal-code"
            inputMode="text"
            placeholder="95928"
            onChange={(zip) => update({ zip: normalizeUsPostalCodeInput(zip) })}
          />
        </div>
      </div>
      <p aria-live="polite" className="mt-1.5 text-[10px] text-[#666]">
        {lookupStatus || "Start typing a street, then tap a match to fill the full address."}
      </p>
      <p className={`mt-1 text-[10px] ${zipInvalid ? "text-red-300" : "text-[#444]"}`}>
        {zipInvalid
          ? "Enter a 5-digit ZIP or complete ZIP+4."
          : "Manual entry and browser autofill still work. ZIP and ZIP+4 are accepted."}
      </p>
    </div>
  );
}
