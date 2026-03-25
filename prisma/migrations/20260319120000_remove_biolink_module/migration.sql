-- Suppression du module Bio Link (tables feuilles d'abord, puis parent)

-- 1. Supprimer la table des messages de contact (FK → bio_pages)
DROP TABLE IF EXISTS "bio_contacts";

-- 2. Supprimer la table des liens individuels (FK → bio_pages)
DROP TABLE IF EXISTS "bio_links";

-- 3. Supprimer la table principale des pages Bio Link (FK → users)
DROP TABLE IF EXISTS "bio_pages";
