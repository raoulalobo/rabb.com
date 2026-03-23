-- CreateTable : table queue_slots pour les créneaux horaires récurrents.
-- Chaque créneau définit un jour de la semaine (0-6) et une heure (0-23:0-59)
-- à laquelle un post en attente sera automatiquement programmé.
-- Le champ platform (nullable) permet de filtrer par plateforme.

CREATE TABLE "queue_slots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "hour" INTEGER NOT NULL,
    "minute" INTEGER NOT NULL,
    "platform" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_slots_pkey" PRIMARY KEY ("id")
);

-- Index sur userId (toutes les requêtes filtrent par user)
CREATE INDEX "queue_slots_userId_idx" ON "queue_slots"("userId");

-- Index composé userId + dayOfWeek (requête grille par jour)
CREATE INDEX "queue_slots_userId_dayOfWeek_idx" ON "queue_slots"("userId", "dayOfWeek");

-- Clé étrangère vers users avec suppression en cascade
ALTER TABLE "queue_slots" ADD CONSTRAINT "queue_slots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
