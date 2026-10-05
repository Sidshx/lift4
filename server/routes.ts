import type { Express } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import { insertSetLogSchema, insertBodyweightSchema } from "@shared/schema";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.get("/api/sets", (_req, res) => res.json(storage.listSets()));
  app.post("/api/sets", (req, res) => {
    const parsed = insertSetLogSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid set" });
    res.json(storage.upsertSet(parsed.data));
  });
  app.delete("/api/sets/:id", (req, res) => {
    storage.deleteSet(Number(req.params.id));
    res.json({ ok: true });
  });
  app.get("/api/bodyweights", (_req, res) => res.json(storage.listBodyweights()));
  app.post("/api/bodyweights", (req, res) => {
    const parsed = insertBodyweightSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid weight" });
    res.json(storage.upsertBodyweight(parsed.data));
  });
  app.delete("/api/bodyweights/:id", (req, res) => {
    storage.deleteBodyweight(Number(req.params.id));
    res.json({ ok: true });
  });
  return httpServer;
}
