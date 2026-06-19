/**
 * Data layer — local SQLite persistence (no external/cloud database).
 *
 * Everything the app stores (accounts, the carbon activity ledger, and login
 * sessions) lives in a single embedded SQLite file via better-sqlite3. The store
 * is exposed through a `createStore(path)` factory so tests can run against an
 * in-memory database (`:memory:`) while the server uses a file on disk.
 *
 * This module is server-only — it must never be imported by client/browser code.
 */
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { UserProfile, EmissionsLog, LeaderboardEntry } from "../types";

/** A full user row as stored, including secret credential columns. */
export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  salt: string;
  avatar: string;
  points: number;
  total_saved_kg: number;
  streak_days: number;
  last_active_date: string;
  smart_meter_connected: number;
  transport_tracker_connected: number;
  created_at: string;
}

export interface LogRow {
  log_id: string;
  user_id: string;
  category: string;
  kg_saved: number;
  activity_name: string;
  timestamp: string;
  source: string;
}

/** Map a DB user row to the public profile shape (drops secret columns). */
export function toProfile(row: UserRow): UserProfile {
  return {
    userId: row.id,
    name: row.name,
    email: row.email,
    points: row.points,
    totalSavedKg: row.total_saved_kg,
    streakDays: row.streak_days,
    lastActiveDate: row.last_active_date,
    avatar: row.avatar,
    smartMeterConnected: Boolean(row.smart_meter_connected),
    transportTrackerConnected: Boolean(row.transport_tracker_connected),
    createdAt: row.created_at,
  };
}

/** Map a DB log row to the public log shape. */
export function toLog(row: LogRow): EmissionsLog {
  return {
    logId: row.log_id,
    userId: row.user_id,
    category: row.category as EmissionsLog["category"],
    kgSaved: row.kg_saved,
    activityName: row.activity_name,
    timestamp: row.timestamp,
    source: row.source as EmissionsLog["source"],
  };
}

export interface NewUser {
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  avatar: string;
  today: string;
}

export interface StatsUpdate {
  points: number;
  totalSavedKg: number;
  streakDays: number;
  lastActiveDate: string;
}

export interface ProfilePatch {
  name?: string;
  avatar?: string;
  smartMeterConnected?: boolean;
  transportTrackerConnected?: boolean;
}

export type Store = ReturnType<typeof createStore>;

/** Raised when an email is already registered. */
export class EmailTakenError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "EmailTakenError";
  }
}

export function createStore(dbPath: string) {
  // Ensure the parent directory exists for file-backed databases.
  if (dbPath !== ":memory:") {
    try {
      mkdirSync(dirname(dbPath), { recursive: true });
    } catch {
      /* directory may already exist */
    }
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      avatar TEXT NOT NULL DEFAULT 'sprout',
      points INTEGER NOT NULL DEFAULT 0,
      total_saved_kg REAL NOT NULL DEFAULT 0,
      streak_days INTEGER NOT NULL DEFAULT 1,
      last_active_date TEXT NOT NULL,
      smart_meter_connected INTEGER NOT NULL DEFAULT 0,
      transport_tracker_connected INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS emissions_logs (
      log_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      kg_saved REAL NOT NULL,
      activity_name TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_logs_user ON emissions_logs(user_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_users_points ON users(points DESC);
  `);

  const stmts = {
    insertUser: db.prepare(
      `INSERT INTO users (id, name, email, password_hash, salt, avatar, last_active_date, created_at)
       VALUES (@id, @name, @email, @password_hash, @salt, @avatar, @last_active_date, @created_at)`
    ),
    userByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
    userById: db.prepare(`SELECT * FROM users WHERE id = ?`),
    updateStats: db.prepare(
      `UPDATE users SET points = @points, total_saved_kg = @total_saved_kg,
        streak_days = @streak_days, last_active_date = @last_active_date WHERE id = @id`
    ),
    updateStreak: db.prepare(
      `UPDATE users SET streak_days = @streak_days, last_active_date = @last_active_date WHERE id = @id`
    ),
    insertSession: db.prepare(
      `INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`
    ),
    userBySession: db.prepare(
      `SELECT u.* FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.token = ?`
    ),
    deleteSession: db.prepare(`DELETE FROM sessions WHERE token = ?`),
    insertLog: db.prepare(
      `INSERT INTO emissions_logs (log_id, user_id, category, kg_saved, activity_name, timestamp, source)
       VALUES (@log_id, @user_id, @category, @kg_saved, @activity_name, @timestamp, @source)`
    ),
    listLogs: db.prepare(
      `SELECT * FROM emissions_logs WHERE user_id = ? ORDER BY timestamp DESC`
    ),
    deleteLog: db.prepare(`DELETE FROM emissions_logs WHERE user_id = ? AND log_id = ?`),
    topUsers: db.prepare(
      `SELECT id, name, points, total_saved_kg, avatar FROM users ORDER BY points DESC, total_saved_kg DESC LIMIT ?`
    ),
  };

  return {
    raw: db,

    createUser(u: NewUser): UserRow {
      const id = randomUUID();
      const now = new Date().toISOString();
      try {
        stmts.insertUser.run({
          id,
          name: u.name,
          email: u.email,
          password_hash: u.passwordHash,
          salt: u.salt,
          avatar: u.avatar,
          last_active_date: u.today,
          created_at: now,
        });
      } catch (err) {
        if (err instanceof Error && /UNIQUE constraint failed/.test(err.message)) {
          throw new EmailTakenError();
        }
        throw err;
      }
      return stmts.userById.get(id) as UserRow;
    },

    getUserByEmail(email: string): UserRow | undefined {
      return stmts.userByEmail.get(email) as UserRow | undefined;
    },

    getUserById(id: string): UserRow | undefined {
      return stmts.userById.get(id) as UserRow | undefined;
    },

    updateStats(id: string, s: StatsUpdate): void {
      stmts.updateStats.run({
        id,
        points: s.points,
        total_saved_kg: s.totalSavedKg,
        streak_days: s.streakDays,
        last_active_date: s.lastActiveDate,
      });
    },

    updateStreak(id: string, streakDays: number, lastActiveDate: string): void {
      stmts.updateStreak.run({ id, streak_days: streakDays, last_active_date: lastActiveDate });
    },

    /** Apply a partial profile update; only provided fields are written. */
    updateProfile(id: string, patch: ProfilePatch): UserRow | undefined {
      const fields: string[] = [];
      const params: Record<string, unknown> = { id };
      if (typeof patch.name === "string") {
        fields.push("name = @name");
        params.name = patch.name;
      }
      if (typeof patch.avatar === "string") {
        fields.push("avatar = @avatar");
        params.avatar = patch.avatar;
      }
      if (typeof patch.smartMeterConnected === "boolean") {
        fields.push("smart_meter_connected = @smart");
        params.smart = patch.smartMeterConnected ? 1 : 0;
      }
      if (typeof patch.transportTrackerConnected === "boolean") {
        fields.push("transport_tracker_connected = @transport");
        params.transport = patch.transportTrackerConnected ? 1 : 0;
      }
      if (fields.length > 0) {
        db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = @id`).run(params);
      }
      return stmts.userById.get(id) as UserRow | undefined;
    },

    createSession(userId: string, token: string): void {
      stmts.insertSession.run(token, userId, new Date().toISOString());
    },

    getUserBySession(token: string): UserRow | undefined {
      if (!token) return undefined;
      return stmts.userBySession.get(token) as UserRow | undefined;
    },

    deleteSession(token: string): void {
      stmts.deleteSession.run(token);
    },

    insertLog(log: EmissionsLog): void {
      stmts.insertLog.run({
        log_id: log.logId,
        user_id: log.userId,
        category: log.category,
        kg_saved: log.kgSaved,
        activity_name: log.activityName,
        timestamp: log.timestamp,
        source: log.source,
      });
    },

    listLogs(userId: string): EmissionsLog[] {
      return (stmts.listLogs.all(userId) as LogRow[]).map(toLog);
    },

    deleteLog(userId: string, logId: string): boolean {
      return stmts.deleteLog.run(userId, logId).changes > 0;
    },

    topLeaderboard(limit: number): LeaderboardEntry[] {
      const rows = stmts.topUsers.all(limit) as Array<{
        id: string;
        name: string;
        points: number;
        total_saved_kg: number;
        avatar: string;
      }>;
      return rows.map((r) => ({
        userId: r.id,
        name: r.name,
        points: r.points,
        totalSavedKg: r.total_saved_kg,
        avatar: r.avatar,
      }));
    },
  };
}
