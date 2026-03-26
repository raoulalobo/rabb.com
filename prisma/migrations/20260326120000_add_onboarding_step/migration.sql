-- AlterTable: ajout du champ onboardingStep au modèle User
-- 0 = connecter un réseau, 1 = créer un premier post, 2 = onboarding terminé
ALTER TABLE public.users ADD COLUMN "onboardingStep" INTEGER NOT NULL DEFAULT 0;

-- Les utilisateurs existants qui ont déjà des plateformes connectées
-- sont considérés comme ayant terminé l'onboarding
UPDATE public.users SET "onboardingStep" = 2
WHERE "lateWorkspaceId" IS NOT NULL;
