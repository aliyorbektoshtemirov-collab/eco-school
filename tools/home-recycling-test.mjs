import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, readdir } from 'node:fs/promises';
import { createHash, createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
const telegramMessages = [];
const telegramServer = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  telegramMessages.push(JSON.parse(body));
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, result: { message_id: 1 } }));
});
await new Promise(resolve => telegramServer.listen(0, '127.0.0.1', resolve));
const telegramBase = `http://127.0.0.1:${telegramServer.address().port}/bot`;

const { outputFiles } = await build({ entryPoints: ['src/index.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const secret = 'local-regression-test-secret-only';
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: outputFiles[0].text, compatibilityDate: '2026-09-01',
  d1Databases: ['DB'], bindings: { SESSION_SECRET: secret, POINTS_PER_KG: '25', APP_NAME: 'Test', TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_API_BASE: telegramBase },
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
  for (const [id, role, school] of [[100,'admin',1],[101,'student',1],[102,'admin',2],[103,'student',1]]) {
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
  await db.prepare("INSERT INTO challenge_submissions(id,challenge_id,student_id,proof_text) VALUES(200,1,101,'I did it, no image')").run();
  await db.prepare("UPDATE profiles SET telegram_chat_id = 'local-student-chat' WHERE id = 101").run();
  const reply = 'Rasmni qo‘shing. <b>Tekshirish</b>';
  assert.equal((await req('/feedback/challenge/200',{method:'POST',body:{message:reply}})).status,401);
  assert.equal((await req('/feedback/challenge/200',{user:101,method:'POST',body:{message:reply}})).status,403);
  assert.equal((await req('/feedback/challenge/200',{user:102,method:'POST',body:{message:reply}})).status,403);
  for (const message of ['', '   ', 'x'.repeat(2001)]) {
    assert.equal((await req('/feedback/challenge/200',{user:100,method:'POST',body:{message}})).status,422);
  }
  assert.equal((await req('/feedback/challenge/99999',{user:100,method:'POST',body:{message:reply}})).status,404);
  assert.equal((await req('/feedback/challenge/200',{user:100,method:'POST',body:{message:reply,sender_name:'Fake admin'}})).status,201);
  let inbox = (await req('/notifications',{user:101})).data;
  assert.equal(inbox.unread,1);
  assert.equal(inbox.items[0].message,reply);
  assert.equal(inbox.items[0].sender_name,'Test 100');
  assert.equal((await req('/notifications',{user:103})).data.items.length,0);
  assert.equal((await req('/feedback/challenge/200',{user:103})).status,403);
  assert.equal((await req('/feedback/challenge/200',{user:102})).status,403);
  assert.equal((await req('/feedback/challenge/200',{user:101})).data.items.length,1);
  const notificationId = inbox.items[0].id;
  assert.equal((await req(`/notifications/${notificationId}/read`,{user:103,method:'POST',body:{}})).status,404);
  assert.equal((await req(`/notifications/${notificationId}/read`,{user:101,method:'POST',body:{}})).data.unread,0);
  assert.equal((await req(`/notifications/${notificationId}/read`,{user:101,method:'POST',body:{}})).data.unread,0);
  assert.equal((await db.prepare('SELECT status FROM challenge_submissions WHERE id=200').first()).status,'pending');
  assert.equal((await req('/feedback/recycling/100',{user:100,method:'POST',body:{message:'Qog‘oz rasmi tekshirildi.'}})).status,201);
  inbox = (await req('/notifications',{user:101})).data;
  assert.equal(inbox.items.length,2);
  assert.equal(inbox.unread,1);
  assert.equal((await req('/feedback/recycling/100',{user:101})).data.items.length,1);
  for (let attempt = 0; attempt < 40 && telegramMessages.length < 2; attempt++) await new Promise(resolve => setTimeout(resolve,50));
  assert.equal(telegramMessages.length,2);
  assert.equal(telegramMessages[0].chat_id,'local-student-chat');
  assert.ok(telegramMessages[0].text.includes('Test 100'));
  assert.ok(telegramMessages[0].text.includes('&lt;b&gt;Tekshirish&lt;/b&gt;'));
  assert.equal(telegramMessages[0].reply_markup.inline_keyboard[0][0].web_app.url,'https://local.test/notifications');
  console.log('PASS: migrations, Home archiving, admin rates, point awards, feedback permissions, sender identity, unread/read state, threads and Telegram delivery.');

} finally {
  await mf.dispose();
  await new Promise(resolve => telegramServer.close(resolve));
}
