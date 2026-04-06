import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const generatedModels = pgTable(
  "generated_models",
  {
    id: serial("id").primaryKey(),
    imageHash: varchar("image_hash", { length: 64 }).notNull().unique(),
    meshyTaskId: varchar("meshy_task_id", { length: 255 }),
    modelUrl: text("model_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_image_hash").on(table.imageHash)]
);
