// Builds the claude.use() shim on top of a Supabase client. Kept separate so it can be tested.
window.__makeStore = function (sb) {
  const listeners = new Set();
  let bt = null;
  const bump = () => { clearTimeout(bt); bt = setTimeout(() => listeners.forEach(fn => fn()), 60); };
  const listen = run => { listeners.add(run); run(); return () => listeners.delete(run); };
  const colOf = p => p.split('/').slice(0, -1).join('/');
  const snap = (path, data) => ({ id: path.split('/').pop(), exists: !!data, data: () => data || undefined, metadata: { fromCache: false, hasPendingWrites: false } });
  const err = e => {
    if (e && e.code === '23505') return { code: 'already_exists', message: e.message };
    if (e && (e.code === '42501' || /row-level security|permission/i.test(e.message || ''))) return { code: 'invalid_argument', message: e.message };
    return { code: 'unavailable', message: (e && e.message) || 'error' };
  };
  const now = () => new Date().toISOString();
  function doc(path) {
    return {
      path, id: path.split('/').pop(),
      async get() { const { data, error } = await sb.from('docs').select('data').eq('path', path).maybeSingle(); if (error) throw err(error); return snap(path, data && data.data); },
      async set(d) {
        const row = { path, col: colOf(path), data: d, updated_at: now() };
        const { error } = path.startsWith('claims/') ? await sb.from('docs').insert(row) : await sb.from('docs').upsert(row);
        if (error) throw err(error); bump();
      },
      async update(p) {
        const cur = await this.get(); if (!cur.exists) throw { code: 'invalid_argument', message: 'missing' };
        const m = { ...cur.data(), ...p }; Object.keys(p).forEach(k => { if (p[k] === null) delete m[k]; });
        const { error } = await sb.from('docs').update({ data: m, updated_at: now() }).eq('path', path); if (error) throw err(error); bump();
      },
      async delete() { const { error } = await sb.from('docs').delete().eq('path', path); if (error) throw err(error); bump(); },
      async acquire() { return { acquired: true }; },
      onSnapshot(next, onErr) { const run = async () => { try { next(await this.get()); } catch (e) { onErr && onErr(e); } }; return listen(run); },
      collection(c) { return collection(path + '/' + c); },
    };
  }
  function collection(col, order = null, lim = null) {
    return {
      path: col,
      doc: id => doc(col + '/' + (id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)))),
      orderBy: (f, d) => collection(col, [f, d || 'asc'], lim),
      limit: n => collection(col, order, n),
      where() { return this; },
      async get() {
        let q = sb.from('docs').select('path,data').eq('col', col).order('updated_at', { ascending: false });
        if (lim) q = q.limit(lim);
        const { data, error } = await q; if (error) throw err(error);
        let docs = (data || []).map(x => snap(x.path, x.data));
        if (order) { const [f, d] = order; docs.sort((a, b) => { const x = a.data()[f], y = b.data()[f]; return (x > y ? 1 : x < y ? -1 : 0) * (d === 'desc' ? -1 : 1); }); }
        return { docs, size: docs.length, empty: !docs.length, metadata: { fromCache: false }, docChanges: () => [] };
      },
      onSnapshot(next, onErr) { const run = async () => { try { next(await this.get()); } catch (e) { onErr && onErr(e); } }; return listen(run); },
      async add(d) { const r = this.doc(); await r.set(d); return r; },
    };
  }
  const DB = { doc, collection };
  // live updates: realtime + fallback polling
  try { sb.channel('docs-live').on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, bump).subscribe(); } catch (e) {}
  setInterval(bump, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) bump(); });

  let ready = (async () => {
    const { data } = await sb.auth.getSession(); const session = data.session; let prof = null;
    if (session) { const r = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle(); prof = r.data; }
    return { session, prof };
  })();
  const USER = {
    async canEdit() { const { prof } = await ready; return !!(prof && prof.is_admin); },
    async can() { const { session } = await ready; return !!session; },
    async id() { const { session } = await ready; return session ? session.user.id : null; },
    async me() { const { session, prof } = await ready; return { name: (prof && prof.name) || (session && session.user.email) || '', email: session ? session.user.email : '' }; },
    async profiles(ids) { const { data } = await sb.from('profiles').select('*').in('id', ids); return Object.fromEntries((data || []).map(p => [p.id, p])); },
  };
  const ASSETS = {
    async upload(blob) {
      const name = Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '.jpg';
      const { error } = await sb.storage.from('photos').upload(name, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (error) throw error;
      return { id: sb.storage.from('photos').getPublicUrl(name).data.publicUrl };
    },
  };
  return { use: async n => { if (n === 'db') return DB; if (n === 'user') return USER; if (n === 'assets') { const { prof } = await ready; return prof && prof.is_admin ? ASSETS : null; } return null; } };
};
