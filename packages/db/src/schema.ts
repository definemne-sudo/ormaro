import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const localeEnum = pgEnum("locale", ["me", "en", "tr", "ru"]);
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const regionEnum = pgEnum("region", ["coast", "central", "north"]);
export const conditionEnum = pgEnum("item_condition", [
  "new",
  "like_new",
  "lightly_used",
  "good",
]);
export const listingStatusEnum = pgEnum("listing_status", ["active", "sold", "removed"]);
export const messageKindEnum = pgEnum("message_kind", ["text", "offer"]);
export const reportTargetEnum = pgEnum("report_target", ["listing", "user"]);
export const reportReasonEnum = pgEnum("report_reason", [
  "scam",
  "misleading",
  "prohibited",
  "inappropriate",
  "wrong_category",
  "other",
]);
export const reportStatusEnum = pgEnum("report_status", ["open", "reviewing", "closed"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const cities = pgTable("cities", {
  key: text("key").primaryKey(),
  region: regionEnum("region").notNull(),
});

/** Kategori adları tabloda değil, dil dosyalarında tutulur. */
export const categories = pgTable("categories", {
  key: text("key").primaryKey(),
  parentKey: text("parent_key"),
  sort: smallint("sort").notNull().default(0),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  locale: localeEnum("locale").notNull().default("me"),
  cityKey: text("city_key").references(() => cities.key),
  role: userRoleEnum("role").notNull().default("user"),
  createdAt: createdAt(),
});

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryKey: text("category_key")
      .notNull()
      .references(() => categories.key),
    cityKey: text("city_key")
      .notNull()
      .references(() => cities.key),
    title: varchar("title", { length: 120 }).notNull(),
    description: text("description").notNull().default(""),
    /** Fiyat avro cinsinden, tam sayı. */
    priceEuro: integer("price_euro").notNull(),
    condition: conditionEnum("condition").notNull(),
    /** İlanın yazıldığı dil; ileride otomatik çeviri buna göre yapılacak. */
    language: localeEnum("language").notNull(),
    status: listingStatusEnum("status").notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("listings_feed_idx").on(t.status, t.createdAt),
    index("listings_category_idx").on(t.categoryKey, t.status),
    index("listings_city_idx").on(t.cityKey, t.status),
    index("listings_seller_idx").on(t.sellerId),
    index("listings_search_idx").using(
      "gin",
      sql`to_tsvector('simple', ${t.title} || ' ' || ${t.description})`,
    ),
    check("listings_price_check", sql`${t.priceEuro} >= 0`),
  ],
);

export const listingPhotos = pgTable(
  "listing_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    position: smallint("position").notNull(),
  },
  (t) => [
    uniqueIndex("listing_photos_position_idx").on(t.listingId, t.position),
    check("listing_photos_position_check", sql`${t.position} between 0 and 7`),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("conversations_listing_buyer_idx").on(t.listingId, t.buyerId),
    index("conversations_buyer_idx").on(t.buyerId, t.lastMessageAt),
    index("conversations_seller_idx").on(t.sellerId, t.lastMessageAt),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: messageKindEnum("kind").notNull().default("text"),
    body: text("body").notNull().default(""),
    /** Yalnızca teklif mesajlarında dolu: teklif edilen tutar, avro. */
    offerEuro: integer("offer_euro"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("messages_conversation_idx").on(t.conversationId, t.createdAt),
    check(
      "messages_offer_check",
      sql`(${t.kind} = 'offer') = (${t.offerEuro} is not null)`,
    ),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    rating: smallint("rating").notNull(),
    comment: text("comment").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("reviews_author_listing_idx").on(t.authorId, t.listingId),
    index("reviews_subject_idx").on(t.subjectId, t.createdAt),
    check("reviews_rating_check", sql`${t.rating} between 1 and 5`),
    check("reviews_not_self_check", sql`${t.authorId} <> ${t.subjectId}`),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: reportTargetEnum("target_type").notNull(),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    reason: reportReasonEnum("reason").notNull(),
    details: text("details").notNull().default(""),
    status: reportStatusEnum("status").notNull().default("open"),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("reports_queue_idx").on(t.status, t.createdAt),
    check(
      "reports_target_check",
      sql`(${t.targetType} = 'listing' and ${t.listingId} is not null and ${t.userId} is null)
        or (${t.targetType} = 'user' and ${t.userId} is not null and ${t.listingId} is null)`,
    ),
  ],
);
