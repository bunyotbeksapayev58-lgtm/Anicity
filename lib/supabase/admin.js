import { createClient } from '@supabase/supabase-js';

// FAQAT SERVERDA ishlatiladi. SUPABASE_SERVICE_ROLE_KEY hech qachon NEXT_PUBLIC_ bilan boshlanmasin.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// ILIKE da % va _ belgilarini escape qiladi (aks holda "_" har qanday belgiga mos keladi)
export const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');
