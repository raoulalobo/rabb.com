-- Migration: add_media_folders_and_tags
-- Ajoute les tables media_folders et media_tags,
-- ainsi que les colonnes folderId sur media et la table de jointure _MediaToTag.

-- ─── Table media_folders ──────────────────────────────────────────────────────

CREATE TABLE "media_folders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_folders_pkey" PRIMARY KEY ("id")
);

-- Index par userId
CREATE INDEX "media_folders_userId_idx" ON "media_folders"("userId");

-- Contrainte de clé étrangère vers users
ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Table media_tags ─────────────────────────────────────────────────────────

CREATE TABLE "media_tags" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',

    CONSTRAINT "media_tags_pkey" PRIMARY KEY ("id")
);

-- Index par userId
CREATE INDEX "media_tags_userId_idx" ON "media_tags"("userId");

-- Unicité : un user ne peut pas avoir deux tags du même nom
CREATE UNIQUE INDEX "media_tags_userId_name_key" ON "media_tags"("userId", "name");

-- Contrainte de clé étrangère vers users
ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Table de jointure _MediaToTag (many-to-many) ────────────────────────────

CREATE TABLE "_MediaToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- Index unique pour éviter les doublons dans la relation
CREATE UNIQUE INDEX "_MediaToTag_AB_unique" ON "_MediaToTag"("A", "B");

-- Index sur B pour les lookups inverses
CREATE INDEX "_MediaToTag_B_index" ON "_MediaToTag"("B");

-- Clés étrangères vers media et media_tags
ALTER TABLE "_MediaToTag" ADD CONSTRAINT "_MediaToTag_A_fkey"
    FOREIGN KEY ("A") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_MediaToTag" ADD CONSTRAINT "_MediaToTag_B_fkey"
    FOREIGN KEY ("B") REFERENCES "media_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Colonne folderId sur media ───────────────────────────────────────────────

ALTER TABLE "media" ADD COLUMN "folderId" TEXT;

-- Contrainte de clé étrangère vers media_folders (SetNull à la suppression du dossier)
ALTER TABLE "media" ADD CONSTRAINT "media_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "media_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
