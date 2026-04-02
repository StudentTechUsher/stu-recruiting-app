import { describe, expect, it } from "vitest";
import { normalizeShareSlug, resolveShareSlugFromProfileInput } from "@/lib/referrals/profile-url";

describe("profile URL parsing", () => {
  it("normalizes valid share slugs", () => {
    expect(normalizeShareSlug("ABC123xyz890")).toBe("abc123xyz890");
  });

  it("normalizes hyphenated professional handles", () => {
    expect(normalizeShareSlug("Vin-Jones-Profile")).toBe("vin-jones-profile");
  });

  it("resolves share slug from full profile URL", () => {
    expect(resolveShareSlugFromProfileInput("https://app.example.com/profile/abc123xyz890")).toBe("abc123xyz890");
  });

  it("resolves share slug from relative profile path", () => {
    expect(resolveShareSlugFromProfileInput("/profile/abc123xyz890")).toBe("abc123xyz890");
  });

  it("resolves share slug from canonical /u path", () => {
    expect(resolveShareSlugFromProfileInput("https://app.example.com/u/vin-jones")).toBe("vin-jones");
  });

  it("returns null for malformed input", () => {
    expect(resolveShareSlugFromProfileInput("hello world")).toBeNull();
  });
});
