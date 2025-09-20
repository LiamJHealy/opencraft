-- CreateTable
CREATE TABLE "PendingCombine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leftId" TEXT NOT NULL,
    "rightId" TEXT NOT NULL,
    "candidates" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME
);
