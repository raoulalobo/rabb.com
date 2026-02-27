-- Migration : add-media
-- Ajoute la table `media` pour la Galerie de médias (feature /gallery).
-- Un média = 1 fichier image ou vidéo uploadé par l'utilisateur dans Supabase Storage.
-- Bucket : post-media, chemin : {userId}/gallery/{timestamp}-{filename}
-- Un média peut être réutilisé dans plusieurs posts via MediaPicker.

-- CreateTable
CREATE TABLE "media" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "url"       TEXT NOT NULL,
    "filename"  TEXT NOT NULL,
    "mimeType"  TEXT NOT NULL,
    "size"      INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex : tous les médias d'un user (filtre simple)
CREATE INDEX "media_userId_idx" ON "media"("userId");

-- CreateIndex : médias d'un user triés par date DESC (pagination galerie)
CREATE INDEX "media_userId_createdAt_idx" ON "media"("userId", "createdAt" DESC);

-- AddForeignKey : cascade → supprime les médias si l'user est supprimé
ALTER TABLE "media" ADD CONSTRAINT "media_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
