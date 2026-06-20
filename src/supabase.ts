import { createClient } from '@supabase/supabase-js';

const supabaseUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || '') as string;
const supabaseAnonKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '') as string;

// Clean spaces and trailing quotes if any
const cleanUrl = supabaseUrl.trim().replace(/^['"]|['"]$/g, '');
const cleanKey = supabaseAnonKey.trim().replace(/^['"]|['"]$/g, '');

export const supabase = (cleanUrl && cleanKey)
  ? createClient(cleanUrl, cleanKey)
  : null;

// Table name used for saving state
export const SUPABASE_TABLE = 'dink_finance_state';
export const SUPABASE_DOC_ID = 'global_v1';
