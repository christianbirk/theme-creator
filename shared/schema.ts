import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// CSS Classes types for styles.xml
export interface CssClass {
  name: string;
  className: string;
  allow?: string;
  deny?: string;
}

export interface CssClassGroup {
  name: string;
  mode?: string;
  allowLinks?: string;
  classes: CssClass[];
}

export interface CssClassesData {
  groups: CssClassGroup[];
}

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
