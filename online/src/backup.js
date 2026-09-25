// Backups of the world, for the parent page and for deploys. Admin-key only (world.js checks the key before calling in).
// GET  /api/admin/export    everything needed to rebuild the world: accounts (with their hashes, roles and mutes), every
//                           save version, the chat log, the settings, and the admins' tables: the moderation log, the
//                           pinned backups, the drop parties and their crackers (who lit each, the prize, claimed or
//                           not), and the logins (when each knight's sockets opened and closed). Sessions are left
//                           out on purpose: they are short-lived tokens.
// GET  /api/admin/bookmark  a Cloudflare point-in-time restore bookmark for this moment, also kept in settings with the
//                           time it was taken. Taken before every deploy that changes the schema.
// POST /api/admin/restore   {bookmark}: rewind the whole world's storage to that bookmark. The object restarts to do it,
//                           so every knight is disconnected and reconnects to the restored world.
// Kept in its own file so world.js only needs one line to reach it.
import { json, oops, readJson } from './http.js';

export async function backupCall(world, req, url, call, method) {
  if (call === 'export' && method === 'GET') {
    const rows = sql => [...world.sql.exec(sql)];
    return json({
      at: Date.now(),
      accounts: rows('SELECT * FROM accounts ORDER BY name_lc'),
      saves: rows('SELECT * FROM saves ORDER BY name_lc, ver'),
      chat: rows('SELECT * FROM chat ORDER BY id'),
      settings: rows('SELECT * FROM settings ORDER BY key'),
      mod_log: rows('SELECT * FROM mod_log ORDER BY id'),
      save_pins: rows('SELECT * FROM save_pins ORDER BY name_lc'),
      parties: rows('SELECT * FROM parties ORDER BY id'),
      crackers: rows('SELECT * FROM crackers ORDER BY party, k'),
      logins: rows('SELECT * FROM logins ORDER BY id'),
    });
  }
  if (call === 'bookmark' && method === 'GET') {
    const storage = world.ctx.storage;
    if (typeof storage.getCurrentBookmark !== 'function') throw oops(501, 'this runtime has no restore bookmarks', 'nope');
    const bookmark = await storage.getCurrentBookmark();
    const at = Date.now();
    world.sql.exec("INSERT INTO settings (key, value) VALUES ('last_bookmark', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", JSON.stringify({ bookmark, at }));
    return json({ bookmark, at });
  }
  if (call === 'restore' && method === 'POST') {
    const storage = world.ctx.storage;
    if (typeof storage.onNextSessionRestoreBookmark !== 'function') throw oops(501, 'this runtime has no restore bookmarks', 'nope');
    const b = await readJson(req);
    const bookmark = typeof b.bookmark === 'string' ? b.bookmark.trim() : '';
    if (!bookmark) throw oops(400, 'send the bookmark to restore', 'bad');
    await storage.onNextSessionRestoreBookmark(bookmark);
    // the restore happens when the object starts again; ending this instance makes that happen now
    setTimeout(() => { try { world.ctx.abort('restoring a bookmark'); } catch (e) { } }, 50);
    return json({ ok: true, restoring: bookmark });
  }
  return null;
}
