import { pgTable, serial, text, integer, timestamp, jsonb, primaryKey } from "drizzle-orm/pg-core";

export const scores = pgTable("scores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  score: integer("score").notNull(),
  mode: text("mode").notNull(),
  map: text("map").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rooms = pgTable("rooms", {
  code: text("code").primaryKey(),
  map: text("map").notNull(),
  host: text("host").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const roomPlayers = pgTable(
  "room_players",
  {
    code: text("code").notNull(),
    pid: text("pid").notNull(),
    name: text("name").notNull(),
    state: jsonb("state").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.code, t.pid] })]
);
