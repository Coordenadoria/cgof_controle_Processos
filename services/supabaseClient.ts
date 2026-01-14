import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rmknwrdgtfhykhukqfnm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_TjyPK2n9KXZBboNofDcg6g_0lfvUzkb';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);