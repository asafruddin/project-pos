import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const catalogProducts = sqliteTable("catalog_products", {
  productId: text("product_id").primaryKey(),
  name: text("name").notNull(),
  priceMinor: integer("price_minor").notNull(),
  stockQty: integer("stock_qty").notNull().default(0),
  status: text("status", { enum: ["active", "inactive"] }).notNull(),
  parentId: text("parent_id"),
  sku: text("sku"),
  categoryName: text("category_name"),
  unitName: text("unit_name"),
  /** JSON: pack → pcs conversion (see `UnitConversion`). */
  unitConversionJson: text("unit_conversion_json"),
  trackStock: integer("track_stock", { mode: "boolean" }).notNull().default(true),
  pulledAt: text("pulled_at").notNull(),
});

/** Product photos cached on disk so the menu works offline. */
export const catalogImages = sqliteTable("catalog_images", {
  productId: text("product_id").primaryKey(),
  imageId: text("image_id").notNull(),
  /** file:// URI inside the app's cache directory. */
  fileUri: text("file_uri").notNull(),
  cachedAt: text("cached_at").notNull(),
});
