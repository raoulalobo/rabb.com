-- Personnalisation avancée du module Bio Link
-- Migration non destructive : tous les champs ont des DEFAULT

-- ── Nouveaux champs sur bio_pages ──────────────────────────────────────────────

-- Personnalisation visuelle
ALTER TABLE "bio_pages" ADD COLUMN "fontFamily" TEXT NOT NULL DEFAULT 'inter';
ALTER TABLE "bio_pages" ADD COLUMN "buttonShape" TEXT NOT NULL DEFAULT 'rounded-lg';
ALTER TABLE "bio_pages" ADD COLUMN "buttonVariant" TEXT NOT NULL DEFAULT 'filled';
ALTER TABLE "bio_pages" ADD COLUMN "avatarShape" TEXT NOT NULL DEFAULT 'circle';

-- Fond personnalisé (image ou dégradé)
ALTER TABLE "bio_pages" ADD COLUMN "backgroundImageUrl" TEXT;
ALTER TABLE "bio_pages" ADD COLUMN "gradientFrom" TEXT;
ALTER TABLE "bio_pages" ADD COLUMN "gradientTo" TEXT;

-- Mise en page des liens
ALTER TABLE "bio_pages" ADD COLUMN "linkSpacing" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "bio_pages" ADD COLUMN "hoverAnimation" TEXT NOT NULL DEFAULT 'none';

-- Bannière et branding
ALTER TABLE "bio_pages" ADD COLUMN "bannerUrl" TEXT;
ALTER TABLE "bio_pages" ADD COLUMN "hideBranding" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bio_pages" ADD COLUMN "faviconUrl" TEXT;

-- Formulaire de contact
ALTER TABLE "bio_pages" ADD COLUMN "showContactForm" BOOLEAN NOT NULL DEFAULT false;

-- Domaine personnalisé (post-MVP)
ALTER TABLE "bio_pages" ADD COLUMN "customDomain" TEXT;

-- Index unique sur customDomain (nullable — les NULL ne violent pas l'unicité)
CREATE UNIQUE INDEX "bio_pages_customDomain_key" ON "bio_pages"("customDomain");

-- ── Nouveaux champs sur bio_links ──────────────────────────────────────────────

-- Type de lien (link, header, separator, video, music)
ALTER TABLE "bio_links" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'link';

-- Rendre l'URL optionnelle (NULL pour les types header/separator)
ALTER TABLE "bio_links" ALTER COLUMN "url" DROP NOT NULL;

-- Planification temporelle
ALTER TABLE "bio_links" ADD COLUMN "activeFrom" TIMESTAMP(3);
ALTER TABLE "bio_links" ADD COLUMN "activeUntil" TIMESTAMP(3);

-- ── Nouveau modèle BioContact ──────────────────────────────────────────────────

CREATE TABLE "bio_contacts" (
    "id" TEXT NOT NULL,
    "bioPageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bio_contacts_pkey" PRIMARY KEY ("id")
);

-- Index pour lister les contacts d'une page par date
CREATE INDEX "bio_contacts_bioPageId_createdAt_idx" ON "bio_contacts"("bioPageId", "createdAt");

-- FK vers bio_pages avec suppression en cascade
ALTER TABLE "bio_contacts" ADD CONSTRAINT "bio_contacts_bioPageId_fkey"
    FOREIGN KEY ("bioPageId") REFERENCES "bio_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
