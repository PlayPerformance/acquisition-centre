// Supabase-backed data layer that matches the app's store API.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const CFG = window.PP_CONFIG || {};
function load(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.body.appendChild(s)})}
if (!CFG.url || !CFG.key) {
  window.claude = { use: async () => null };
} else {
  const sb = createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  window.__sb = sb;
  window.claude = window.__makeStore(sb);
}
load('app-core.js?v=' + (CFG.v || '1'));
