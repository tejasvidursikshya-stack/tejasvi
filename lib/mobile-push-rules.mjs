// Rules for mobile push notifications, kept free of I/O so they can be tested.
// Push messages travel through Expo's push service and Apple/Google, so they
// carry only a short title and a generic line: no marks, feedback or other
// record details. The app opens the full item after the user signs in.

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const tokenPattern = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/;
const RECENT_MS = 3 * 24 * 3600 * 1000;

const lines = {
  feedback: 'Open Tejasvi to see your feedback.',
  assignment: 'A new assignment is ready.',
  'due-soon': 'This is due within two days.',
  overdue: 'This is past its deadline.',
  learning: 'New learning is ready in your course.',
  live: 'A live class was scheduled or changed.',
  timetable: 'Your timetable changed.',
  announcement: 'New announcement from your institution.',
  submission: 'New work is waiting for your review.',
};

/** Inbox items worth a push: unread, not pushed before, and recent (deadlines always qualify). */
export function freshItems(items, sentKeys, now = Date.now()) {
  return items.filter(
    (i) => !i.read && !sentKeys.has(i.id) && (i.kind === 'due-soon' || i.kind === 'overdue' || now - Date.parse(i.at) <= RECENT_MS),
  );
}

/** One Expo push message per token for an inbox item. */
export function messagesFor(item, orgId, orgName, tokens) {
  const title = String(item.title || 'Tejasvi Campus').slice(0, 120);
  const body = `${orgName ? orgName + ' · ' : ''}${lines[item.kind] || 'Open Tejasvi for details.'}`.slice(0, 180);
  return tokens.map((to) => ({
    to,
    title,
    body,
    sound: 'default',
    priority: item.kind === 'due-soon' || item.kind === 'overdue' ? 'high' : 'default',
    data: { orgId, target: item.target, courseId: item.courseId || null, kind: item.kind },
  }));
}

/** Splits messages into Expo's maximum batch size. */
export function chunks(list, size = 100) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Tokens Expo reports as no longer registered (app removed or notifications revoked). */
export function deadTokens(messages, tickets) {
  return tickets
    .map((t, i) => (t && t.status === 'error' && t.details && t.details.error === 'DeviceNotRegistered' ? messages[i] && messages[i].to : null))
    .filter(Boolean);
}
