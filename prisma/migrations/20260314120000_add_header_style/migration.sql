-- Ajout du champ headerStyle à la table bio_pages
-- Valeurs possibles : classic, hero, banner, minimal, card
-- Les pages existantes récupèrent automatiquement le style "classic"
ALTER TABLE "bio_pages" ADD COLUMN "headerStyle" TEXT NOT NULL DEFAULT 'classic';
