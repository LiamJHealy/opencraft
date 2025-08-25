-- CreateTable
CREATE TABLE "Element" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leftId" INTEGER NOT NULL,
    "rightId" INTEGER NOT NULL,
    "resultId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Recipe_leftId_fkey" FOREIGN KEY ("leftId") REFERENCES "Element" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Recipe_rightId_fkey" FOREIGN KEY ("rightId") REFERENCES "Element" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Recipe_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Element" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Element_name_key" ON "Element"("name");

-- CreateIndex
CREATE INDEX "Recipe_leftId_rightId_idx" ON "Recipe"("leftId", "rightId");

-- CreateIndex
CREATE INDEX "Recipe_resultId_idx" ON "Recipe"("resultId");
