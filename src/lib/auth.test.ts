import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  isValidEmail,
  validateRegistration,
  validateLogin,
  MIN_PASSWORD_LEN,
} from "./auth";

describe("password hashing", () => {
  it("verifies a correct password against its hash", () => {
    const { hash, salt } = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse battery", hash, salt)).toBe(true);
  });

  it("rejects an incorrect password", () => {
    const { hash, salt } = hashPassword("greenpass123");
    expect(verifyPassword("wrongpass", hash, salt)).toBe(false);
  });

  it("produces different hashes for the same password (random salt)", () => {
    const a = hashPassword("samepass");
    const b = hashPassword("samepass");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it("is deterministic for a fixed salt", () => {
    const fixed = hashPassword("pw", "fixedsalt");
    const again = hashPassword("pw", "fixedsalt");
    expect(again.hash).toBe(fixed.hash);
  });

  it("returns false for empty/garbage hash inputs without throwing", () => {
    expect(verifyPassword("pw", "", "")).toBe(false);
    expect(verifyPassword("pw", "zzzz", "salt")).toBe(false);
  });
});

describe("session tokens", () => {
  it("generates unique long tokens", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });
});

describe("email validation", () => {
  it("accepts well-formed emails", () => {
    expect(isValidEmail("maya@example.com")).toBe(true);
  });
  it("rejects malformed emails", () => {
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
  });
});

describe("validateRegistration", () => {
  it("accepts a valid payload and normalizes email to lowercase", () => {
    const r = validateRegistration({ name: " Maya ", email: "Maya@Example.com", password: "greenpass123" });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ name: "Maya", email: "maya@example.com", password: "greenpass123" });
  });

  it("requires a name", () => {
    expect(validateRegistration({ name: "", email: "a@b.com", password: "greenpass123" }).ok).toBe(false);
  });

  it("requires a valid email", () => {
    expect(validateRegistration({ name: "X", email: "bad", password: "greenpass123" }).ok).toBe(false);
  });

  it(`requires a password of at least ${MIN_PASSWORD_LEN} characters`, () => {
    const r = validateRegistration({ name: "X", email: "a@b.com", password: "short" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/at least/);
  });

  it("handles missing/invalid bodies gracefully", () => {
    expect(validateRegistration(undefined).ok).toBe(false);
    expect(validateRegistration(null).ok).toBe(false);
    expect(validateRegistration("nope").ok).toBe(false);
  });
});

describe("validateLogin", () => {
  it("accepts email + password", () => {
    const r = validateLogin({ email: "a@b.com", password: "anything" });
    expect(r.ok).toBe(true);
    expect(r.value?.email).toBe("a@b.com");
  });
  it("rejects missing fields", () => {
    expect(validateLogin({ email: "a@b.com" }).ok).toBe(false);
    expect(validateLogin({ password: "x" }).ok).toBe(false);
  });
});
