const rawProjectId = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID;
const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (typeof window !== 'undefined') {
  console.log('[Supabase Info] Client-side env resolution:', {
    projectId: rawProjectId ? 'present' : 'missing',
    url: rawSupabaseUrl ? 'present' : 'missing',
    anonKey: rawAnonKey ? 'present' : 'missing',
    anonKeyLength: rawAnonKey?.length
  });
}

const resolvedProjectId =
  rawProjectId ||
  (rawSupabaseUrl ? rawSupabaseUrl.replace('https://', '').replace('.supabase.co', '') : '');

const isPlaceholderUrl = (url?: string) => {
  return !url || url.includes('your-project.supabase.co');
};
const isPlaceholderKey = (key?: string) => {
  return !key || key === 'your-anon-key' || key === 'your_anon_key';
};

export const projectId = resolvedProjectId || 'your-project-id';
export const publicAnonKey = isPlaceholderKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'your-anon-key'
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || rawAnonKey || 'your-anon-key';
export const supabaseUrl =
  (isPlaceholderUrl(rawSupabaseUrl) ? '' : rawSupabaseUrl) ||
  (resolvedProjectId ? `https://${resolvedProjectId}.supabase.co` : '');
