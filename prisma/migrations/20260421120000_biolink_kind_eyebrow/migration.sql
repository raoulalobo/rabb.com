-- Ajoute colonnes dédiées pour kind et eyebrow (retire les détournements icon/thumbnailUrl)
ALTER TABLE "bio_links" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'glass';
ALTER TABLE "bio_links" ADD COLUMN "eyebrow" TEXT;
