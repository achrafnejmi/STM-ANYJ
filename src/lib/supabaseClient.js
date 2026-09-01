// Client Supabase — seul endroit du code qui lit les clés d'environnement.
// Jamais de clé en dur, jamais de log de leur valeur (CLAUDE.md).

import { createClient } from '@supabase/supabase-js'

// `process` n'existe pas dans le bundle navigateur (Vite ne le polyfill pas) :
// `typeof process !== 'undefined'` évite un ReferenceError quand on retombe
// sur import.meta.env non défini côté client.
const envNode = typeof process !== 'undefined' ? process.env : {}
const url = import.meta.env?.VITE_SUPABASE_URL ?? envNode.VITE_SUPABASE_URL
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY ?? envNode.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Variables Supabase manquantes : définissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env (voir .env.example).'
  )
}

export const supabase = createClient(url, anonKey)
