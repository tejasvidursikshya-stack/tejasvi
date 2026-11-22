import {migrate} from './migrate.mjs';
export const adapter={initialize:migrate,
async password(c,email,hash,temporary){const [[u]]=await c.execute('SELECT id FROM users WHERE email=? FOR UPDATE',[email]);if(!u)throw Error('No such user exists in this Tejasvi database.');const [[allowed]]=await c.execute("SELECT 1 FROM users u WHERE u.id=? AND (u.platform_admin=1 OR EXISTS(SELECT 1 FROM institution_memberships m WHERE m.user_id=u.id AND m.active=1))",[u.id]);if(!allowed)throw Error('This account has no active institution access. Review the membership first.');await c.execute('UPDATE users SET password_hash=?,must_change_password=? WHERE id=?',[hash,temporary?1:0,u.id]);await c.execute('DELETE FROM sessions WHERE user_id=?',[u.id]);}
};
