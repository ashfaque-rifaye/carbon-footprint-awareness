import { describe, it, expect, beforeEach } from "vitest";
import { createStore, EmailTakenError, toProfile, toLog, type Store } from "./db";
import { hashPassword, generateSessionToken } from "./auth";
import type { EmissionsLog } from "../types";

function makeUser(store: Store, email = "maya@example.com") {
  const { hash, salt } = hashPassword("greenpass123");
  return store.createUser({
    name: "Maya Green",
    email,
    passwordHash: hash,
    salt,
    avatar: "leaf",
    today: "2026-06-19",
  });
}

function makeLog(userId: string, overrides: Partial<EmissionsLog> = {}): EmissionsLog {
  return {
    logId: `log_${Math.random().toString(36).slice(2)}`,
    userId,
    category: "transport",
    kgSaved: 4.4,
    activityName: "Cycled commute",
    timestamp: new Date().toISOString(),
    source: "manual",
    ...overrides,
  };
}

describe("createStore (in-memory)", () => {
  let store: Store;
  beforeEach(() => {
    store = createStore(":memory:");
  });

  it("creates a user and exposes it via email and id lookups", () => {
    const row = makeUser(store);
    expect(row.id).toBeTruthy();
    expect(store.getUserByEmail("maya@example.com")?.id).toBe(row.id);
    expect(store.getUserById(row.id)?.email).toBe("maya@example.com");
  });

  it("rejects a duplicate email with EmailTakenError", () => {
    makeUser(store);
    expect(() => makeUser(store)).toThrow(EmailTakenError);
  });

  it("maps a row to a public profile without leaking secrets", () => {
    const profile = toProfile(makeUser(store));
    expect(profile).toMatchObject({
      name: "Maya Green",
      email: "maya@example.com",
      avatar: "leaf",
      points: 0,
      streakDays: 1,
      smartMeterConnected: false,
    });
    const leaky = profile as unknown as Record<string, unknown>;
    expect(leaky.password_hash).toBeUndefined();
    expect(leaky.salt).toBeUndefined();
  });

  it("manages sessions: create, resolve user, delete", () => {
    const user = makeUser(store);
    const token = generateSessionToken();
    store.createSession(user.id, token);
    expect(store.getUserBySession(token)?.id).toBe(user.id);
    store.deleteSession(token);
    expect(store.getUserBySession(token)).toBeUndefined();
    expect(store.getUserBySession("")).toBeUndefined();
  });

  it("inserts and lists logs newest-first, scoped to the user", () => {
    const user = makeUser(store);
    const other = makeUser(store, "other@example.com");
    store.insertLog(makeLog(user.id, { timestamp: "2026-06-17T10:00:00.000Z", activityName: "Old" }));
    store.insertLog(makeLog(user.id, { timestamp: "2026-06-19T10:00:00.000Z", activityName: "New" }));
    store.insertLog(makeLog(other.id, { activityName: "Not mine" }));

    const logs = store.listLogs(user.id);
    expect(logs).toHaveLength(2);
    expect(logs[0].activityName).toBe("New");
    expect(logs[1].activityName).toBe("Old");
  });

  it("deletes only the owner's log and reports success/failure", () => {
    const user = makeUser(store);
    const log = makeLog(user.id);
    store.insertLog(log);
    expect(store.deleteLog(user.id, log.logId)).toBe(true);
    expect(store.listLogs(user.id)).toHaveLength(0);
    expect(store.deleteLog(user.id, "missing")).toBe(false);
  });

  it("updates aggregate stats", () => {
    const user = makeUser(store);
    store.updateStats(user.id, { points: 120, totalSavedKg: 8.8, streakDays: 3, lastActiveDate: "2026-06-20" });
    const updated = store.getUserById(user.id)!;
    expect(updated.points).toBe(120);
    expect(updated.total_saved_kg).toBe(8.8);
    expect(updated.streak_days).toBe(3);
  });

  it("applies a partial profile patch (toggles + avatar)", () => {
    const user = makeUser(store);
    const updated = store.updateProfile(user.id, { smartMeterConnected: true, avatar: "globe" })!;
    expect(updated.smart_meter_connected).toBe(1);
    expect(updated.avatar).toBe("globe");
    // Unspecified fields stay unchanged.
    expect(updated.transport_tracker_connected).toBe(0);
    expect(updated.name).toBe("Maya Green");
  });

  it("ranks the leaderboard by points descending", () => {
    const a = makeUser(store, "a@example.com");
    const b = makeUser(store, "b@example.com");
    store.updateStats(a.id, { points: 50, totalSavedKg: 5, streakDays: 1, lastActiveDate: "2026-06-19" });
    store.updateStats(b.id, { points: 300, totalSavedKg: 20, streakDays: 1, lastActiveDate: "2026-06-19" });
    const board = store.topLeaderboard(10);
    expect(board[0].userId).toBe(b.id);
    expect(board[1].userId).toBe(a.id);
  });

  it("maps a log row to the public shape", () => {
    const user = makeUser(store);
    const log = makeLog(user.id, { category: "diet", source: "smart_meter" });
    store.insertLog(log);
    const [got] = store.listLogs(user.id);
    expect(got).toMatchObject({ category: "diet", source: "smart_meter", userId: user.id });
  });
});
