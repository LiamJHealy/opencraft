/*
  Warnings:

  - You are about to drop the column `complexity` on the `Recipe` table. All the data in the column will be lost.
  - You are about to drop the column `reasoning` on the `Recipe` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Recipe" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leftId" INTEGER NOT NULL,
    "rightId" INTEGER NOT NULL,
    "resultId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    CONSTRAINT "Recipe_leftId_fkey" FOREIGN KEY ("leftId") REFERENCES "Element" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recipe_rightId_fkey" FOREIGN KEY ("rightId") REFERENCES "Element" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recipe_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Element" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Recipe" ("createdAt", "id", "leftId", "resultId", "rightId", "source") SELECT "createdAt", "id", "leftId", "resultId", "rightId", "source" FROM "Recipe";
DROP TABLE "Recipe";
ALTER TABLE "new_Recipe" RENAME TO "Recipe";
CREATE INDEX "Recipe_leftId_rightId_idx" ON "Recipe"("leftId", "rightId");
CREATE INDEX "Recipe_resultId_idx" ON "Recipe"("resultId");
CREATE UNIQUE INDEX "Recipe_leftId_rightId_resultId_key" ON "Recipe"("leftId", "rightId", "resultId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
