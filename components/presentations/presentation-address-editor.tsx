"use client";

import { useState } from "react";
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

  const update = (patch: Partial<AddressParts>) => {
    const next = { ...parts, ...patch };
    setParts(next);
    onChange(formatAddress(next));
  };

  const zipInvalid = parts.zip.length > 0 && !isValidUsPostalCode(parts.zip);

  return (
    <div>
      <p className="mb-1.5 text-[11px] text-[#888]">Service address</p>
      <div className="grid gap-2 sm:grid-cols-6">
        <div className="sm:col-span-6">
          <EditorTextInput
            value={parts.street}
            name="address-line1"
            autoComplete="address-line1"
            placeholder="123 Main St"
            onChange={(street) => update({ street })}
          />
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
      <p className={`mt-1.5 text-[10px] ${zipInvalid ? "text-red-300" : "text-[#444]"}`}>
        {zipInvalid
          ? "Enter a 5-digit ZIP or complete ZIP+4."
          : "Browser autofill is enabled. ZIP and ZIP+4 are accepted."}
      </p>
    </div>
  );
}
