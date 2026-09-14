-- CreateTable
CREATE TABLE "HouseRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "type" TEXT NOT NULL DEFAULT 'normal',
    "proposedById" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HouseRule_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HouseRule_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuleVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RuleVote_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "HouseRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RuleVote_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "HouseRule_householdId_idx" ON "HouseRule"("householdId");

-- CreateIndex
CREATE INDEX "HouseRule_status_idx" ON "HouseRule"("status");

-- CreateIndex
CREATE INDEX "RuleVote_ruleId_idx" ON "RuleVote"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "RuleVote_ruleId_profileId_key" ON "RuleVote"("ruleId", "profileId");
