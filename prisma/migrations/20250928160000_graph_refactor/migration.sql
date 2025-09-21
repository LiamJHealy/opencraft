PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS "Recipe";
DROP TABLE IF EXISTS "Element";

CREATE TABLE "Word" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "category" TEXT,
    "tier" INTEGER,
    "isStarter" BOOLEAN NOT NULL DEFAULT false,
    "isGoal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "RecipeEdge" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leftId" INTEGER NOT NULL,
    "rightId" INTEGER NOT NULL,
    "resultId" INTEGER NOT NULL,
    "category" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecipeEdge_leftId_fkey" FOREIGN KEY ("leftId") REFERENCES "Word" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeEdge_rightId_fkey" FOREIGN KEY ("rightId") REFERENCES "Word" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeEdge_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Word" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DailyTargetHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "seed" TEXT NOT NULL,
    "targetId" INTEGER NOT NULL,
    "selectedOn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maxDepth" INTEGER,
    "starterWordIds" TEXT NOT NULL,
    CONSTRAINT "DailyTargetHistory_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Word" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Word_name_key" ON "Word"("name");
CREATE INDEX "Word_category_idx" ON "Word"("category");

CREATE INDEX "RecipeEdge_leftId_rightId_idx" ON "RecipeEdge"("leftId", "rightId");
CREATE INDEX "RecipeEdge_resultId_idx" ON "RecipeEdge"("resultId");
CREATE INDEX "RecipeEdge_category_idx" ON "RecipeEdge"("category");
CREATE UNIQUE INDEX "RecipeEdge_leftId_rightId_resultId_key" ON "RecipeEdge"("leftId", "rightId", "resultId");

CREATE UNIQUE INDEX "DailyTargetHistory_seed_key" ON "DailyTargetHistory"("seed");
CREATE INDEX "DailyTargetHistory_selectedOn_idx" ON "DailyTargetHistory"("selectedOn");
CREATE INDEX "DailyTargetHistory_targetId_idx" ON "DailyTargetHistory"("targetId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
