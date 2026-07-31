import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { getSupabase } from '../_shared/supabase.ts';
import { refreshBookMovie } from '../_shared/jobs.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const sb = getSupabase();
    const inserted = await refreshBookMovie(sb);
    return json({ ok: true, inserted });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
