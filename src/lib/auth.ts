/**
 * Auth module — pure, server-side credential helpers.
 *
 * Passwords are hashed with Node's built-in scrypt (a memory-hard KDF), so the
 * project needs no third-party crypto dependency. Validation helpers bound and
 * sanitize untrusted registration/login input before it reaches the database.
 * Everything here is synchronous and side-effect free, so it is unit-testable
 * in isolation from Express and SQLite.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** A salted password hash. Both fields are hex strings safe to store at rest. */
export interface PasswordHash {
  hash: string;
  salt: string;
}

const SCRYPT_KEYLEN = 64;

/** Hash a plaintext password with a random (or supplied) salt. */
export function hashPassword(password: string, salt?: string): PasswordHash {
  const useSalt = salt ?? randomBytes(16).toString("hex");
  const derived = scryptSync(password, useSalt, SCRYPT_KEYLEN).toString("hex");
  return { hash: derived, salt: useSalt };
}

/** Constant-time verification of a plaintext password against a stored hash. */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  if (!hash || !salt) return false;
  const candidate = scryptSync(password, salt, SCRYPT_KEYLEN);
  let known: Buffer;
  try {
    known = Buffer.from(hash, "hex");
  } catch {
    return false;
  }
  // timingSafeEqual throws on length mismatch; guard first.
  if (candidate.length !== known.length) return false;
  return timingSafeEqual(candidate, known);
}

/** Generate an opaque, URL-safe session token. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export interface CredentialFields {
  name: string;
  email: string;
  password: string;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  value?: CredentialFields;
}

/** RFC-pragmatic email check: non-empty local part, an @, and a dotted domain. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const MAX_NAME_LEN = 60;
export const MAX_EMAIL_LEN = 120;
export const MIN_PASSWORD_LEN = 8;
export const MAX_PASSWORD_LEN = 200;

/**
 * Validate and normalize a registration payload. Returns a trimmed, lower-cased
 * email and a bounded display name, or a human-readable error.
 */
export function validateRegistration(body: unknown): ValidationResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";

  if (!name) return { ok: false, error: "Name is required." };
  if (name.length > MAX_NAME_LEN) return { ok: false, error: "Name is too long." };
  if (!email || !isValidEmail(email)) return { ok: false, error: "A valid email is required." };
  if (email.length > MAX_EMAIL_LEN) return { ok: false, error: "Email is too long." };
  if (password.length < MIN_PASSWORD_LEN)
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` };
  if (password.length > MAX_PASSWORD_LEN) return { ok: false, error: "Password is too long." };

  return { ok: true, value: { name, email, password } };
}

/** Validate a login payload (email + password presence/shape only). */
export function validateLogin(body: unknown): ValidationResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";

  if (!email || !isValidEmail(email)) return { ok: false, error: "A valid email is required." };
  if (!password || password.length > MAX_PASSWORD_LEN)
    return { ok: false, error: "Password is required." };

  return { ok: true, value: { name: "", email, password } };
}
