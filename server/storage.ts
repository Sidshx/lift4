import { setLogs, bodyweights } from "@shared/schema";
import type { SetLog, InsertSetLog, Bodyweight, InsertBodyweight } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { and, eq, asc } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");
sqlite.exec(`
CREATE TABLE IF NOT EXISTS set_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, day INTEGER NOT NULL, exercise_id TEXT NOT NULL, set_index INTEGER NOT NULL, weight REAL NOT NULL, reps INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS bodyweights (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, kg REAL NOT NULL);
`);

export const db = drizzle(sqlite);

export interface IStorage {
  listSets(): SetLog[];
  upsertSet(s: InsertSetLog): SetLog;
  deleteSet(id: number): void;
  listBodyweights(): Bodyweight[];
  upsertBodyweight(b: InsertBodyweight): Bodyweight;
  deleteBodyweight(id: number): void;
}

export class DatabaseStorage implements IStorage {
  listSets() {
    return db.select().from(setLogs).orderBy(asc(setLogs.date), asc(setLogs.setIndex)).all();
  }
  upsertSet(s: InsertSetLog) {
    const existing = db.select().from(setLogs).where(and(eq(setLogs.date, s.date), eq(setLogs.exerciseId, s.exerciseId), eq(setLogs.setIndex, s.setIndex))).get();
    if (existing) {
      return db.update(setLogs).set({ weight: s.weight, reps: s.reps, day: s.day }).where(eq(setLogs.id, existing.id)).returning().get();
    }
    return db.insert(setLogs).values(s).returning().get();
  }
  deleteSet(id: number) {
    db.delete(setLogs).where(eq(setLogs.id, id)).run();
  }
  listBodyweights() {
    return db.select().from(bodyweights).orderBy(asc(bodyweights.date)).all();
  }
  upsertBodyweight(b: InsertBodyweight) {
    const existing = db.select().from(bodyweights).where(eq(bodyweights.date, b.date)).get();
    if (existing) return db.update(bodyweights).set({ kg: b.kg }).where(eq(bodyweights.id, existing.id)).returning().get();
    return db.insert(bodyweights).values(b).returning().get();
  }
  deleteBodyweight(id: number) {
    db.delete(bodyweights).where(eq(bodyweights.id, id)).run();
  }
}

export const storage = new DatabaseStorage();
