-- CreateEnum
CREATE TYPE "PostPlatformStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "post_platform_contents" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PostPlatformStatus" NOT NULL DEFAULT 'PENDING',
    "latePostId" TEXT,
    "failureReason" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_platform_contents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_platform_contents_postId_idx" ON "post_platform_contents"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "post_platform_contents_postId_platform_key" ON "post_platform_contents"("postId", "platform");

-- AddForeignKey
ALTER TABLE "post_platform_contents" ADD CONSTRAINT "post_platform_contents_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
