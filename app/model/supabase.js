/* 
   model/supabase.js — owns the Supabase client connection.
   Loads supabase-js from the CDN, creates the client, and validates that
   the driving_school schema is reachable. Returns the client or throws a
   friendly error. No DOM here.
 */

export async function connectSupabase(url, key) {
  const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb = mod.createClient(url, key, { db: { schema: 'driving_school' } });

  // Probe the schema so we fail fast with a clear message if it isn't exposed.
  const test = await sb.schema('driving_school').from('vw_customer_full_address').select('customer_id').limit(1);
  
  if (test.error) {
    const msg = test.error.message || 'could not query the Supabase schema';
    if (/406|Not Acceptable/i.test(msg)) {
      throw new Error('The driving_school schema/view is not exposed to the API yet. Add driving_school under '
        + 'Settings -> API -> Exposed schemas, then grant access with the Supabase setup SQL.');
    }
    throw new Error(msg);
  }
  return sb;
}