-- CreateEnum
CREATE TYPE "AgentSessionStatus" AS ENUM ('DRAFT', 'VALIDATED');

-- CreateTable
CREATE TABLE "agent_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AgentSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "mediaPool" JSONB NOT NULL DEFAULT '[]',
    "currentPlan" JSONB,
    "conversationHistory" JSONB NOT NULL DEFAULT '[]',
    "postId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_sessions_postId_key" ON "agent_sessions"("postId");

-- CreateIndex
CREATE INDEX "agent_sessions_userId_status_idx" ON "agent_sessions"("userId", "status");

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
