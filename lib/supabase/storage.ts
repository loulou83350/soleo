import { createClient } from '@supabase/supabase-js';

const BUCKET = 'block-assets';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars manquants');
  return createClient(url, key);
}

/**
 * Uploads a file to the block-assets bucket.
 * Returns the public URL of the uploaded file.
 * Path is scoped by teamId + sessionId for isolation.
 */
export async function uploadBlockAsset(
  file: File,
  teamId: number,
  sessionId: number
): Promise<string> {
  const supabase = getSupabaseClient();

  const ext = file.name.split('.').pop() ?? 'bin';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `${teamId}/${sessionId}/${filename}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) throw new Error(`Upload échoué : ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
