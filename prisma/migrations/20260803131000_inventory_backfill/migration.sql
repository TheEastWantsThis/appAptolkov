-- Move legacy aggregate balances into the main location without overwriting newer data.
INSERT INTO "inventory_locations" ("id", "code", "name", "isActive", "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000102', 'MAIN', 'Основной склад', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

UPDATE "inventory_items" AS item
SET "defaultLocationId" = location."id"
FROM "inventory_locations" AS location
WHERE location."code" = 'MAIN' AND item."defaultLocationId" IS NULL;

INSERT INTO "inventory_balances" ("id", "itemId", "locationId", "quantity", "reserved", "version", "updatedAt")
SELECT gen_random_uuid(), item."id", location."id", item."quantity", item."reserved", 1, CURRENT_TIMESTAMP
FROM "inventory_items" AS item
CROSS JOIN "inventory_locations" AS location
WHERE location."code" = 'MAIN'
ON CONFLICT ("itemId", "locationId") DO NOTHING;