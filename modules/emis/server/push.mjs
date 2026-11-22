// Sends a short push notification to the mobile devices a user has signed in on.
// Only when the server has push switched on (MOBILE_PUSH=expo). Messages carry no
// private details; the app shows the full item after the user signs in.
import { many } from '../../../lib/campus-data.mjs';
import { EXPO_PUSH_URL, chunks } from '../../../lib/mobile-push-rules.mjs';

export async function pushToUsers(store, userIds, title, body, data = {}) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (process.env.MOBILE_PUSH !== 'expo' || !ids.length) return 0;
  const tokens = (await many(store.db.connection(), `SELECT t.token FROM mobile_push_tokens t JOIN mobile_sessions m ON m.id=t.mobile_session_id WHERE m.refresh_expires_at>UTC_TIMESTAMP(3) AND t.user_id IN (${ids.map(() => '?').join(',')})`, ids)).map((r) => r.token);
  const messages = tokens.map((to) => ({ to, title: String(title).slice(0, 120), body: String(body).slice(0, 180), sound: 'default', data: { orgId: store.org, ...data } }));
  for (const batch of chunks(messages, 100)) {
    try { await fetch(EXPO_PUSH_URL, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: 'Bearer ' + process.env.EXPO_ACCESS_TOKEN } : {}) }, body: JSON.stringify(batch), redirect: 'error', signal: AbortSignal.timeout(15000) }); }
    catch { console.error('Tejasvi push: Expo could not be reached'); }
  }
  return messages.length;
}
