/**
 * @file scripts/setup-storage.ts
 * @description Script d'initialisation du bucket Supabase Storage "post-media".
 *   À exécuter une seule fois (ou après reset de la DB Supabase) pour créer
 *   le bucket avec les bonnes permissions et restrictions.
 *
 *   Utilise la SERVICE_ROLE_KEY pour les opérations administratives.
 *
 * @usage
 *   pnpm setup:storage
 *
 * @bucket post-media
 *   - Accès : public (les URLs publiques sont accessibles sans auth)
 *   - Taille max : 50 Mo par fichier
 *   - Types MIME autorisés : images et vidéos uniquement
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'node:path'

// Charger les variables d'environnement depuis .env.local
config({ path: resolve(process.cwd(), '.env.local') })

/** Nom du bucket à créer (doit correspondre à MEDIA_BUCKET dans upload-url/route.ts) */
const BUCKET_NAME = 'post-media'

/** Taille maximum par fichier : 50 Mo */
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

/** Types MIME autorisés : toutes les images et vidéos */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
]

async function main(): Promise<void> {
  // Vérifier que les variables d'environnement sont présentes
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    console.error('❌ Variables manquantes : NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  // Client avec service role pour les opérations administratives
  const supabase = createClient(url, serviceKey)

  console.log(`\n🗂️  Configuration du bucket "${BUCKET_NAME}"...`)

  // Vérifier si le bucket existe déjà
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()

  if (listError) {
    console.error('❌ Impossible de lister les buckets :', listError.message)
    process.exit(1)
  }

  const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME)

  if (bucketExists) {
    // Mettre à jour la configuration du bucket existant
    const { error: updateError } = await supabase.storage.updateBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    })

    if (updateError) {
      console.error('❌ Erreur lors de la mise à jour du bucket :', updateError.message)
      process.exit(1)
    }

    console.log(`✅ Bucket "${BUCKET_NAME}" déjà existant — configuration mise à jour.`)
  } else {
    // Créer le bucket
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      // Public = les URLs publiques sont accessibles sans authentification
      // Requis car on utilise getPublicUrl() dans upload-url/route.ts
      public: true,
      fileSizeLimit: MAX_FILE_SIZE_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    })

    if (createError) {
      console.error('❌ Erreur lors de la création du bucket :', createError.message)
      process.exit(1)
    }

    console.log(`✅ Bucket "${BUCKET_NAME}" créé avec succès.`)
  }

  // Afficher le résumé de la configuration
  console.log('\n📋 Configuration appliquée :')
  console.log(`   Nom         : ${BUCKET_NAME}`)
  console.log(`   Accès       : public`)
  console.log(`   Taille max  : ${MAX_FILE_SIZE_BYTES / 1024 / 1024} Mo`)
  console.log(`   MIME types  : ${ALLOWED_MIME_TYPES.join(', ')}`)
  console.log('\n🚀 Storage prêt. Tu peux uploader des médias depuis /compose.\n')
}

main().catch((err: unknown) => {
  console.error('❌ Erreur inattendue :', err)
  process.exit(1)
})
