import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, readdir } from 'node:fs/promises';
import { createHash, createHmac } from 'node:crypto';
import assert from 'node:assert/strict';

const { outputFiles } = await build({ entryPoints: ['src/index.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const secret = 'local-regression-test-secret-only';
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: outputFiles[0].text, compatibilityDate: '2026-09-01',
  d1Databases: ['DB'], bindings: { SESSION_SECRET: secret, POINTS_PER_KG: '25', APP_NAME: 'Test' },
  serviceBindings: { ASSETS: () => new Response('test assets') },
}));
try {
  const db = await mf.getD1Database('DB');
  for (const file of (await readdir('migrations')).filter(f => f.endsWith('.sql')).sort()) {
    const sql = (await readFile('migrations/' + file, 'utf8')).replace(/--[^\n]*/g, '');
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.prepare(statement).run();
  }
  await db.prepare("INSERT INTO schools(id,code,name) VALUES(2,'TEST2','Other school')").run();
  const tokens = {};
  for (const [id, role, school] of [[100,'admin',1],[101,'student',1],[102,'admin',2]]) {
    await db.prepare("INSERT INTO profiles(id,username,full_name,password_hash,password_salt,role,school_id) VALUES(?,?,?,'test','test',?,?)")
      .bind(id,'test'+id,'Test '+id,role,school).run();
    const raw = 'local-test-user-' + id;
    const token = raw + '.' + createHmac('sha256',secret).update(raw).digest('hex').slice(0,32);
    tokens[id] = token;
    await db.prepare('INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,?)')
      .bind(createHash('sha256').update(token).digest('hex'),id,'2099-01-01T00:00:00Z').run();
  }
  async function req(path, { user, method = 'GET', body } = {}) {
    const response = await mf.dispatchFetch('https://local.test/api'+path, {
      method, headers: { ...(user ? { Authorization: 'Bearer '+tokens[user] } : {}), 'X-Eco-Client': 'mobile', 'Content-Type': 'application/json' },
      ...(body ? {body:JSON.stringify(body)} : {}),
    });
    return { status: response.status, data: await response.json() };
  }
  assert.equal((await req('/tips')).status,200);
  assert.ok((await req('/tips')).data.tip.title);
  assert.equal((await req('/recycling/rates')).status,401);
  assert.deepEqual((await req('/recycling/rates',{user:101})).data.rates,{paper:25,plastic:25});
  assert.equal((await req('/recycling/admin/rates',{user:101,method:'PUT',body:{paper:300,plastic:50}})).status,403);
  for (const paper of [0,-1,1.5,10001]) {
    assert.equal((await req('/recycling/admin/rates',{user:100,method:'PUT',body:{paper,plastic:50}})).status,422);
  }
  assert.equal((await req('/recycling/admin/rates',{user:100,method:'PUT',body:{paper:300,plastic:50}})).status,200);
  assert.deepEqual((await req('/recycling',{user:101})).data.rates,{paper:300,plastic:50});
  assert.deepEqual((await req('/recycling/rates',{user:102})).data.rates,{paper:25,plastic:25});
  await db.prepare("INSERT INTO recycling_submissions(id,school_id,student_id,material,amount_kg,proof_image) VALUES(100,1,101,'paper',2,'test.jpg')").run();
  assert.equal((await req('/recycling/admin/100/review',{user:102,method:'POST',body:{status:'approved',verifiedAmountKg:2}})).status,404);
  assert.equal((await req('/recycling/admin/100/review',{user:100,method:'POST',body:{status:'approved',verifiedAmountKg:2}})).status,200);
  assert.equal((await db.prepare('SELECT points FROM profiles WHERE id=101').first()).points,600);
  assert.equal((await req('/recycling/admin/100/review',{user:100,method:'POST',body:{status:'approved',verifiedAmountKg:2}})).status,409);
  assert.equal((await db.prepare('SELECT points FROM profiles WHERE id=101').first()).points,600);
  await db.prepare("INSERT INTO challenges(id,title,school_id,points) VALUES(100,'Shared active',NULL,30),(101,'Shared archived',NULL,30),(102,'Other school',2,30)").run();
  await db.prepare("UPDATE challenges SET archived_at = datetime('now') WHERE id IN (3,101)").run();
  const home = (await req('/challenges',{user:101})).data.challenges;
  assert.ok(!home.some(c => c.id === 3 || c.id === 101 || c.id === 102));
  assert.ok(home.some(c => c.id === 100));
  const preview = (await req('/challenges/preview')).data.challenges;
  assert.ok(preview.some(c => c.id === 100));
  assert.ok(!preview.some(c => c.id === 101 || c.id === 102 || c.id === 3));
  console.log('PASS: migrations, tips, archived Home tasks, school isolation, admin rates, validation and exact point awards.');
} finally {
  await mf.dispose();
}
