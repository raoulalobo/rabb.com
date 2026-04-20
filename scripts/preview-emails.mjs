/**
 * @file scripts/preview-emails.mjs
 * @description Rend les templates React Email en HTML statique pour prévisualisation.
 *   Sortie : tmp/email-previews/<name>.html — ouvrir dans un navigateur.
 *
 *   Contourne les soucis du serveur react-email dev (workspace root mal inféré
 *   à cause d'un package-lock.json parasite).
 *
 * @example
 *   node scripts/preview-emails.mjs
 */

import { render } from '@react-email/render'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

// Dynamic imports : contourne les issues de module-resolution tsx
// avec les fichiers .tsx en mode ESM strict.
const { VerificationEmail } = await import('../emails/VerificationEmail.tsx')
const { ResetPasswordEmail } = await import('../emails/ResetPasswordEmail.tsx')

const OUTPUT_DIR = resolve(process.cwd(), 'tmp/email-previews')
await mkdir(OUTPUT_DIR, { recursive: true })

// Données factices pour le rendu (l'important est de voir le visuel)
const templates = [
  {
    name: 'VerificationEmail',
    component: VerificationEmail({
      url: 'https://socialtdl.net/api/auth/verify-email?token=preview123',
      name: 'Marie',
    }),
  },
  {
    name: 'ResetPasswordEmail',
    component: ResetPasswordEmail({
      url: 'https://socialtdl.net/reset-password?token=preview456',
      name: 'Marie',
    }),
  },
]

for (const { name, component } of templates) {
  const html = await render(component)
  const path = join(OUTPUT_DIR, `${name}.html`)
  await writeFile(path, html)
  console.log(`✓ ${name} → ${path}`)
}

console.log(`\nOuvrir : file://${OUTPUT_DIR}/`)
