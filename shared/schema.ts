import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import type * as z from "zod/mini";

export const setLogs = sqliteTable("set_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // YYYY-MM-DD local
  day: integer("day").notNull(), // 1-4
  exerciseId: text("exercise_id").notNull(),
  setIndex: integer("set_index").notNull(),
  weight: real("weight").notNull(),
  reps: integer("reps").notNull(),
});

export const insertSetLogSchema = createInsertSchema(setLogs).omit({ id: true });
export type InsertSetLog = z.infer<typeof insertSetLogSchema>;
export type SetLog = typeof setLogs.$inferSelect;

export const bodyweights = sqliteTable("bodyweights", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  kg: real("kg").notNull(),
});

export const insertBodyweightSchema = createInsertSchema(bodyweights).omit({ id: true });
export type InsertBodyweight = z.infer<typeof insertBodyweightSchema>;
export type Bodyweight = typeof bodyweights.$inferSelect;
