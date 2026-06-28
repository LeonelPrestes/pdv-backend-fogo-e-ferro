UPDATE "restaurant_modules"
SET
  "enabled" = false,
  "enabledAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "moduleKey" IN ('CUSTOMERS', 'DELIVERY', 'WHATSAPP', 'REPORTS');

