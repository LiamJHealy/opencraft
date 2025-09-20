-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Element" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "tier" INTEGER,
    "isStarter" BOOLEAN NOT NULL DEFAULT false,
    "isGoal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Element" ("createdAt", "emoji", "id", "name") SELECT "createdAt", "emoji", "id", "name" FROM "Element";
DROP TABLE "Element";
ALTER TABLE "new_Element" RENAME TO "Element";
CREATE UNIQUE INDEX "Element_name_key" ON "Element"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
