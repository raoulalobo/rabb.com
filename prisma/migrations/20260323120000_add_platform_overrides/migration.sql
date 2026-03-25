-- AlterTable : ajouter le champ platformOverrides au modèle Post.
-- Ce champ JSON optionnel stocke les surcharges de contenu par plateforme.
-- Format attendu : { "instagram": { "text": "...", "mediaUrls": [...] }, ... }
-- null = pas de surcharges (toutes les plateformes utilisent le contenu de base).

ALTER TABLE "posts" ADD COLUMN "platformOverrides" JSONB;
