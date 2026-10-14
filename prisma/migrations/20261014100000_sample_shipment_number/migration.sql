ALTER TABLE "SampleShipment" ADD COLUMN "sampleNo" TEXT;

WITH numbered AS (
    SELECT
        "id",
        to_char("createdAt" AT TIME ZONE 'UTC', 'YYYYMMDD') AS "datePrefix",
        ROW_NUMBER() OVER (
            PARTITION BY ("createdAt" AT TIME ZONE 'UTC')::date
            ORDER BY "createdAt", "id"
        ) AS "sequence"
    FROM "SampleShipment"
)
UPDATE "SampleShipment" AS sample
SET "sampleNo" = 'YP-' || numbered."datePrefix" || '-' ||
    lpad(numbered."sequence"::text, GREATEST(4, length(numbered."sequence"::text)), '0')
FROM numbered
WHERE sample."id" = numbered."id";

ALTER TABLE "SampleShipment" ALTER COLUMN "sampleNo" SET NOT NULL;
CREATE UNIQUE INDEX "SampleShipment_sampleNo_key" ON "SampleShipment"("sampleNo");
