import { respond } from '@/lib/errors';
export const dynamic='force-dynamic';
export async function GET(){return respond({error:'The parent portal has been removed.'},410)}
export const POST=GET;
