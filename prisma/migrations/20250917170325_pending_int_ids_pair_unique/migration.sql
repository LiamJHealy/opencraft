/*
  Warnings:

  - You are about to alter the column `leftId` on the `PendingCombine` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `rightId` on the `PendingCombine` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PendingCombine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leftId" INTEGER NOT NULL,
    "rightId" INTEGER NOT NULL,
    "candidates" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME
);
INSERT INTO "new_PendingCombine" ("candidates", "createdAt", "expiresAt", "id", "leftId", "rightId") SELECT "candidates", "createdAt", "expiresAt", "id", "leftId", "rightId" FROM "PendingCombine";
DROP TABLE "PendingCombine";
ALTER TABLE "new_PendingCombine" RENAME TO "PendingCombine";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
