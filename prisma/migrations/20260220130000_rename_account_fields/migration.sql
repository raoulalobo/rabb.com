-- Renommage des champs du modèle Account pour aligner avec better-auth v1
-- better-auth v1 utilise `accountId` (ID chez le provider) et `providerId` (nom du provider)
-- au lieu des anciens noms `providerAccountId` et `provider`

-- Supprimer l'ancienne contrainte unique
DROP INDEX IF EXISTS "accounts_provider_providerAccountId_key";

-- Renommer les colonnes
ALTER TABLE "accounts" RENAME COLUMN "provider" TO "providerId";
ALTER TABLE "accounts" RENAME COLUMN "providerAccountId" TO "accountId";

-- Recréer la contrainte unique avec les nouveaux noms
CREATE UNIQUE INDEX "accounts_providerId_accountId_key" ON "accounts"("providerId", "accountId");
