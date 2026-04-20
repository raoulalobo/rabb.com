-- Restauration du module Bio Link (template public /u/[slug])
--
-- DISCOVERY (2026-04-20) : les tables bio_pages + bio_links + bio_contacts
-- existent déjà en production (inspection via scripts/inspect-biolink.mjs).
-- La migration 20260319120000_remove_biolink_module enregistrée comme "applied"
-- n'a PAS réellement droppé les tables (peut-être appliquée manuellement, ou
-- DB divergente du journal Prisma).
--
-- Cette migration se réduit donc à l'ajout des 2 nouveaux champs nécessaires au
-- template Mimi Sara :
--   - bio_pages.handle  — @handle visible en haut de la page (fallback @{slug})
--   - bio_pages.tagline — phrase d'intro panneau desktop
--
-- Les anciens champs (title, bio, avatarUrl, theme, accentColor, titleColor,
-- bioColor, linkColor, fontFamily, buttonShape, buttonVariant, avatarShape,
-- backgroundImageUrl, gradientFrom, gradientTo, linkSpacing, hoverAnimation,
-- headerStyle, bannerUrl, hideBranding, faviconUrl, showContactForm,
-- templateId, customDomain, seoTitle, seoDescription, socialLinks, totalClicks,
-- isPublished, createdAt, updatedAt, id, userId, slug) sont déjà présents.

-- ── Ajouts au schéma bio_pages ───────────────────────────────────────────────

-- Handle @utilisateur affiché en haut à gauche (fallback @{slug} en runtime)
ALTER TABLE "bio_pages" ADD COLUMN IF NOT EXISTS "handle" TEXT;

-- Phrase d'intro du panneau frosted desktop (masquée si NULL)
ALTER TABLE "bio_pages" ADD COLUMN IF NOT EXISTS "tagline" TEXT;
