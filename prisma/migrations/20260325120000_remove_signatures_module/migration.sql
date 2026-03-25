-- DropTable: suppression du module signatures (table + index + RLS)
-- Les signatures réutilisables (hashtags, CTA) sont retirées du produit.

-- Désactiver la RLS avant suppression (évite les erreurs si des policies existent)
ALTER TABLE IF EXISTS public.signatures DISABLE ROW LEVEL SECURITY;

-- Supprimer les policies RLS éventuelles
DROP POLICY IF EXISTS "Users can manage own signatures" ON public.signatures;
DROP POLICY IF EXISTS "Users can view own signatures" ON public.signatures;

-- Supprimer la table (CASCADE supprime automatiquement les index et FK)
DROP TABLE IF EXISTS public.signatures CASCADE;
