// Runs once when the Tejasvi server starts. Starts the mobile push dispatcher
// only when MOBILE_PUSH=expo is set in .env (off by default).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.MOBILE_PUSH !== 'expo') return;
  const { startPushDispatcher } = await import('./lib/mobile-push');
  startPushDispatcher();
}
