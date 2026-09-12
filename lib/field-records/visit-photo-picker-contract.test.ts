import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("technician visit photo picker", () => {
  it("opens the phone photo library instead of forcing the rear camera", () => {
    const capture = read("components/visit/visit-field-capture.tsx");

    expect(capture).toContain("Choose from Photos");
    expect(capture).toContain("straight from the camera roll");
    expect(capture).toContain("multiple");
    expect(capture).not.toContain('capture="environment"');
  });

  it("offers Before, After, and General without changing the durable detail enum", () => {
    const capture = read("components/visit/visit-field-capture.tsx");

    expect(capture).toContain('{ type: "before", label: "Before"');
    expect(capture).toContain('{ type: "after", label: "After"');
    expect(capture).toContain('{ type: "detail", label: "General"');
    expect(capture).toContain("Photo type");
    expect(capture).toContain("completedUploads.current.delete(photo.clientId)");
  });
});
