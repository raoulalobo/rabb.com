-- Migration : add-signatures
-- Ajoute la table `signatures` pour la feature Signatures du PostComposer.
-- 1 signature = 1 plateforme, plusieurs signatures par user+plateforme.
-- Une signature peut être marquée "par défaut" (isDefault = true).

-- CreateTable
CREATE TABLE "signatures" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "text"      TEXT NOT NULL,
    "platform"  TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex : toutes les signatures d'un user
CREATE INDEX "signatures_userId_idx" ON "signatures"("userId");

-- CreateIndex : signatures d'un user filtrées par plateforme (requête fréquente)
CREATE INDEX "signatures_userId_platform_idx" ON "signatures"("userId", "platform");

-- AddForeignKey : cascade → supprime les signatures si l'user est supprimé
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
