-- CreateTable : Page "Link in Bio" publique (1-1 avec User)
CREATE TABLE "bio_pages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'default',
    "accentColor" TEXT NOT NULL DEFAULT '#6366f1',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "socialLinks" JSONB NOT NULL DEFAULT '[]',
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bio_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable : Lien individuel sur une BioPage
CREATE TABLE "bio_links" (
    "id" TEXT NOT NULL,
    "bioPageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "icon" TEXT,
    "thumbnailUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bio_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex : Un utilisateur = une seule BioPage
CREATE UNIQUE INDEX "bio_pages_userId_key" ON "bio_pages"("userId");

-- CreateIndex : Slug unique pour les URLs publiques /u/{slug}
CREATE UNIQUE INDEX "bio_pages_slug_key" ON "bio_pages"("slug");

-- CreateIndex : Recherche rapide par userId
CREATE INDEX "bio_pages_userId_idx" ON "bio_pages"("userId");

-- CreateIndex : Tri des liens par position dans une page
CREATE INDEX "bio_links_bioPageId_position_idx" ON "bio_links"("bioPageId", "position");

-- AddForeignKey : BioPage → User (cascade delete)
ALTER TABLE "bio_pages" ADD CONSTRAINT "bio_pages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey : BioLink → BioPage (cascade delete)
ALTER TABLE "bio_links" ADD CONSTRAINT "bio_links_bioPageId_fkey" FOREIGN KEY ("bioPageId") REFERENCES "bio_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
