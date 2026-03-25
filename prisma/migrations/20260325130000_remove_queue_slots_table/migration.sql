-- Migration : Supprimer la table queue_slots
-- Les créneaux de file d'attente sont désormais stockés chez Zernio.

DROP INDEX IF EXISTS "queue_slots_userId_idx";
DROP INDEX IF EXISTS "queue_slots_userId_dayOfWeek_idx";
DROP TABLE IF EXISTS "queue_slots";
