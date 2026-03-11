import { describe, expect, it } from "vitest";
import {
  findBestOptionMatch,
  normalizeOptionLabel,
  normalizeOptionSearchKey,
  resolveOptionSelections
} from "@/lib/text/fuzzy-option-match";

describe("fuzzy option match", () => {
  it("normalizes labels and search keys consistently", () => {
    expect(normalizeOptionLabel("  BILL   (Divvy)  ")).toBe("BILL (Divvy)");
    expect(normalizeOptionSearchKey("  BILL   (Divvy)  ")).toBe("bill divvy");
    expect(normalizeOptionSearchKey("AT&T")).toBe("at and t");
  });

  it("matches existing options regardless of capitalization", () => {
    const match = findBestOptionMatch("qualTRICS", ["Adobe", "Qualtrics", "Domo"]);
    expect(match?.option).toBe("Qualtrics");
  });

  it("finds close fuzzy matches for common typos", () => {
    const match = findBestOptionMatch("Data Enginer", ["Data Engineer", "Data Analyst"]);
    expect(match?.option).toBe("Data Engineer");
  });

  it("finds fuzzy matches when users include company suffixes", () => {
    const match = findBestOptionMatch("Qualtrics Inc.", ["Adobe", "Qualtrics", "Domo"]);
    expect(match?.option).toBe("Qualtrics");
  });

  it("resolves selections against existing options and only returns truly new entries", () => {
    const result = resolveOptionSelections(
      [" adobe ", "Adob", "New Startup", "new startup"],
      ["Adobe", "Qualtrics", "Domo"]
    );

    expect(result.resolvedSelections).toEqual(["Adobe", "New Startup"]);
    expect(result.newEntries).toEqual(["New Startup"]);
  });

  it("returns null when there is no acceptable fuzzy match", () => {
    const match = findBestOptionMatch("Aerospace Analyst", ["Data Engineer", "Product Manager", "Qualtrics"]);
    expect(match).toBeNull();
  });
});
