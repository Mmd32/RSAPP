/**
 * Integration test for authentication and authorisation.
 *
 *   npm run test:auth
 *
 * Boots the real Express app on a random port against a throwaway JSON data
 * directory, then drives it over HTTP the way the browser does (cookies).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsapp-auth-'));
process.env.DATA_DIR = dataDir;
// The indicator-edit routes validate against the catalog the server loads from its data directory.
fs.copyFileSync(path.resolve(process.cwd(), 'data/catalog.json'), path.join(dataDir, 'catalog.json'));
process.env.SERVE_CLIENT = 'false';
delete process.env.DATABASE_URL;
delete process.env.SETUP_TOKEN;

const { default: app } = await import('../src/app.js');
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

/** A tiny browser: keeps the session cookie between requests. */
class Client {
  cookie = '';
  async req(method: string, p: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(base + p, {
      method,
      headers: { 'content-type': 'application/json', ...(this.cookie ? { cookie: this.cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) {
      const [pair] = set.split(';');
      this.cookie = pair.endsWith('=') ? '' : pair;
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, json, setCookie: set };
  }
}

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

const visit = (over: Record<string, unknown> = {}) => ({
  id: 'visit_test_1',
  brandName: 'برند',
  branchName: 'شعبه',
  indicators: [{ id: 'i1', code: 'X1' }],
  responses: {},
  status: 'IN_PROGRESS',
  startedAt: new Date().toISOString(),
  ...over,
});

const admin = new Client();
const anon = new Client();
const evaluator = new Client();
const evaluator2 = new Client();
const supervisor = new Client();
const manager = new Client();
let evaluatorPassword = '';

try {
  console.log('auth');

  await test('API is closed without a session', async () => {
    for (const p of ['/visits', '/actions', '/stores', '/catalog', '/users']) {
      const r = await anon.req('GET', p);
      assert.equal(r.status, 401, p);
    }
  });

  await test('health and auth status stay public', async () => {
    assert.equal((await anon.req('GET', '/health')).status, 200);
    const r = await anon.req('GET', '/auth/status');
    assert.equal(r.json.setupRequired, true);
  });

  await test('setup rejects a weak password', async () => {
    const r = await admin.req('POST', '/auth/setup', { name: 'مدیر', email: 'admin@test.ir', password: 'short' });
    assert.equal(r.status, 400);
  });

  await test('first-run setup creates an admin and signs in', async () => {
    const r = await admin.req('POST', '/auth/setup', { name: 'مدیر سامانه', email: 'Admin@Test.ir', password: 'Str0ngPass!' });
    assert.equal(r.status, 201);
    assert.equal(r.json.user.role, 'Admin');
    assert.equal(r.json.user.email, 'admin@test.ir');
    assert.ok(!('passwordHash' in r.json.user));
    assert.match(r.setCookie!, /HttpOnly/);
    assert.match(r.setCookie!, /SameSite=Lax/);
    assert.equal((await admin.req('GET', '/auth/me')).json.user.name, 'مدیر سامانه');
  });

  await test('setup closes once a user exists', async () => {
    const r = await anon.req('POST', '/auth/setup', { name: 'نفوذی', email: 'x@y.ir', password: 'Str0ngPass!' });
    assert.equal(r.status, 409);
    assert.equal((await anon.req('GET', '/auth/status')).json.setupRequired, false);
  });

  await test('the password hash is not stored in clear', async () => {
    const raw = fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8');
    assert.ok(!raw.includes('Str0ngPass!'));
    assert.match(raw, /scrypt\$/);
  });

  await test('login: wrong password and unknown email give the same answer', async () => {
    const a = await anon.req('POST', '/auth/login', { email: 'admin@test.ir', password: 'nope1234' });
    const b = await anon.req('POST', '/auth/login', { email: 'ghost@test.ir', password: 'nope1234' });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.json.error, b.json.error);
  });

  await test('a forged or tampered cookie is rejected', async () => {
    const forged = new Client();
    forged.cookie = 'rsapp_session=eyJzdWIiOiJ4Iiwic3YiOjEsImV4cCI6OTk5OTk5OTk5OX0.AAAA';
    assert.equal((await forged.req('GET', '/auth/me')).status, 401);
    const tampered = new Client();
    // Change the signed payload (the last base64url character of a signature
    // can carry unused padding bits, so altering it is not a reliable test).
    const [name, value] = admin.cookie.split('=');
    const [payload, sig] = decodeURIComponent(value).split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    claims.sub = 'usr_someone_else';
    tampered.cookie = `${name}=${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${sig}`;
    assert.equal((await tampered.req('GET', '/auth/me')).status, 401);
  });

  await test('identity headers no longer grant anything', async () => {
    const r = await anon.req('GET', '/visits', undefined, { 'x-user-role': 'Admin', 'x-tenant-id': 'org_retail_holding' });
    assert.equal(r.status, 401);
  });

  console.log('user management');

  await test('admin creates users with one-time passwords', async () => {
    const make = async (name: string, email: string, role: string, code?: string) => {
      const r = await admin.req('POST', '/users', { name, email, role, ...(code ? { code } : {}) });
      assert.equal(r.status, 201, JSON.stringify(r.json));
      assert.equal(r.json.user.mustChangePassword, true);
      assert.ok(r.json.temporaryPassword.length >= 8);
      return r.json.temporaryPassword as string;
    };
    evaluatorPassword = await make('ارزیاب یک', 'e1@test.ir', 'Evaluator', 'ev-01');
    const p2 = await make('ارزیاب دو', 'e2@test.ir', 'Evaluator');
    const p3 = await make('سرپرست', 's1@test.ir', 'Supervisor');
    const p4 = await make('مدیر شعبه', 'm1@test.ir', 'Manager');
    for (const [c, email, pw] of [
      [evaluator, 'e1@test.ir', evaluatorPassword],
      [evaluator2, 'e2@test.ir', p2],
      [supervisor, 's1@test.ir', p3],
      [manager, 'm1@test.ir', p4],
    ] as const) {
      const r = await c.req('POST', '/auth/login', { email, password: pw });
      assert.equal(r.status, 200, email);
    }
  });

  await test('duplicate email and bad role are refused', async () => {
    assert.equal((await admin.req('POST', '/users', { name: 'تکراری', email: 'E1@test.ir', role: 'Evaluator' })).status, 409);
    assert.equal((await admin.req('POST', '/users', { name: 'نقش بد', email: 'z@test.ir', role: 'God' })).status, 400);
  });

  await test('evaluator codes are validated, unique and editable', async () => {
    const users = (await admin.req('GET', '/users')).json;
    const e1 = users.find((u: any) => u.email === 'e1@test.ir');
    assert.equal(e1.code, 'EV-01', 'stored upper-case');
    assert.equal((await admin.req('POST', '/users', { name: 'کد تکراری', email: 'c1@test.ir', role: 'Evaluator', code: 'EV-01' })).status, 409);
    assert.equal((await admin.req('POST', '/users', { name: 'کد بد', email: 'c2@test.ir', role: 'Evaluator', code: 'کد فارسی' })).status, 400);
    const e2 = users.find((u: any) => u.email === 'e2@test.ir');
    assert.equal((await admin.req('PATCH', `/users/${e2.id}`, { code: 'EV-01' })).status, 409);
    const r = await admin.req('PATCH', `/users/${e2.id}`, { code: 'EV-02' });
    assert.equal(r.status, 200);
    assert.equal(r.json.user.code, 'EV-02');
  });

  await test('non-admins cannot manage users', async () => {
    assert.equal((await supervisor.req('GET', '/users')).status, 403);
    assert.equal((await evaluator.req('POST', '/users', { name: 'x', email: 'q@test.ir', role: 'Admin' })).status, 403);
  });

  await test('changing password clears the must-change flag and old sessions', async () => {
    const other = new Client();
    await other.req('POST', '/auth/login', { email: 'e1@test.ir', password: evaluatorPassword });
    const r = await evaluator.req('POST', '/auth/change-password', { currentPassword: evaluatorPassword, newPassword: 'NewPass123' });
    assert.equal(r.status, 200);
    assert.equal(r.json.user.mustChangePassword, false);
    assert.equal((await evaluator.req('GET', '/auth/me')).status, 200, 'this device stays signed in');
    assert.equal((await other.req('GET', '/auth/me')).status, 401, 'other devices are signed out');
  });

  console.log('indicator edits');

  let target: any;
  await test('everyone signed in can read the edits; none exist yet', async () => {
    const list = await evaluator.req('GET', '/indicator-overrides');
    assert.equal(list.status, 200);
    assert.deepEqual(list.json, []);
    target = (await admin.req('GET', '/indicators?template=STORE')).json.indicators.find((i: any) => i.code === 'FS05');
    assert.ok(target?.id, 'FS05 is in the catalog');
  });

  await test('only people with catalog access can edit', async () => {
    const body = { statement: 'متن آزمایشی شاخص' };
    assert.equal((await evaluator.req('PUT', `/indicator-overrides/${target.id}`, body)).status, 403);
    assert.equal((await manager.req('PUT', `/indicator-overrides/${target.id}`, body)).status, 403);
    assert.equal((await anon.req('PUT', `/indicator-overrides/${target.id}`, body)).status, 401);
    assert.equal((await evaluator.req('DELETE', `/indicator-overrides/${target.id}`)).status, 403);
  });

  await test('an edit is validated, stored with who made it, and read back by everyone', async () => {
    const put = (body: any, id = target.id) => admin.req('PUT', `/indicator-overrides/${id}`, body);
    assert.equal((await put({ statement: 'ab' })).status, 400, 'too short');
    assert.equal((await put({ statement: 'x'.repeat(601) })).status, 400, 'too long');
    assert.equal((await put({ auditorNote: 'y'.repeat(1201) })).status, 400, 'note too long');
    assert.equal((await put({ statement: 'متن' }, 'IND_NOPE')).status, 404, 'unknown indicator');
    const ok = await put({ statement: '  تابلوی سر در   متناسب نیست  ', auditorNote: 'نکته برای ارزیاب' });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    assert.equal(ok.json.override.statement, 'تابلوی سر در متناسب نیست', 'whitespace is collapsed');
    assert.equal(ok.json.override.code, 'FS05');
    assert.ok(ok.json.override.updatedByName);
    const seen = (await evaluator.req('GET', '/indicator-overrides')).json;
    assert.equal(seen.length, 1);
    assert.equal(seen[0].auditorNote, 'نکته برای ارزیاب');
    assert.equal((await admin.req('DELETE', `/indicator-overrides/${target.id}`)).status, 200, 'reset');
    assert.deepEqual((await evaluator.req('GET', '/indicator-overrides')).json, []);
  });

  await test('a field equal to the checklist is not an edit; clearing everything removes the row', async () => {
    const plain = (await admin.req('GET', '/indicators?template=STORE')).json.indicators.find((i: any) => i.code === 'FS02');
    assert.ok(plain && !plain.auditorNote, 'FS02 has no note in the checklist');
    const put = (body: any) => admin.req('PUT', `/indicator-overrides/${plain.id}`, body);
    assert.equal((await put({ statement: 'روشنایی تابلو مناسب نیست', auditorNote: 'یک نکته' })).status, 200);
    const back = await put({ statement: plain.statement });
    assert.equal(back.status, 200);
    assert.equal(back.json.override.statement, undefined, 'statement is back to the checklist text');
    assert.equal(back.json.override.auditorNote, 'یک نکته', 'the note stays');
    const cleared = await put({ auditorNote: '' });
    assert.equal(cleared.json.override, null, 'nothing left to store: ' + JSON.stringify(cleared.json));
    assert.deepEqual((await admin.req('GET', '/indicator-overrides')).json, []);
  });

  await test('a note can hide the checklist\'s own note, and reset restores it', async () => {
    const fs01 = (await admin.req('GET', '/indicators?template=STORE')).json.indicators.find((i: any) => i.code === 'FS01');
    assert.ok(fs01.auditorNote, 'FS01 carries a note from the checklist');
    const hidden = await admin.req('PUT', `/indicator-overrides/${fs01.id}`, { auditorNote: null });
    assert.equal(hidden.json.override.auditorNote, '', 'an empty note is stored so it hides the original');
    assert.equal((await admin.req('DELETE', `/indicator-overrides/${fs01.id}`)).status, 200);
    assert.deepEqual((await admin.req('GET', '/indicator-overrides')).json, []);
  });

  console.log('indicators added by hand');

  const base = {
    template: 'STORE', group: 'FLOOR', subject: 'تابلوی سر در', statement: 'تابلو در شب قابل رویت نیست',
    applicableBusinessTypes: ['Fashion', 'Sports'],
  };
  let added: any;

  await test('only people with catalog access can add, change or remove indicators', async () => {
    assert.equal((await evaluator.req('POST', '/custom-indicators', base)).status, 403);
    assert.equal((await manager.req('POST', '/custom-indicators', base)).status, 403);
    assert.equal((await anon.req('POST', '/custom-indicators', base)).status, 401);
    assert.equal((await evaluator.req('GET', '/custom-indicators')).status, 200, 'everyone reads them');
    assert.deepEqual((await evaluator.req('GET', '/custom-indicators')).json, []);
  });

  await test('a new indicator is validated field by field', async () => {
    const post = (over: any) => admin.req('POST', '/custom-indicators', { ...base, ...over });
    assert.equal((await post({ template: 'X' })).status, 400, 'unknown assessment type');
    assert.equal((await post({ group: 'NOWHERE' })).status, 400, 'zone must be one of the five');
    assert.equal((await post({ group: '' })).status, 400);
    assert.equal((await post({ subject: 'ا' })).status, 400, 'topic too short');
    assert.equal((await post({ statement: 'ab' })).status, 400, 'wording too short');
    assert.equal((await post({ statement: 'x'.repeat(601) })).status, 400, 'wording too long');
    assert.equal((await post({ applicableBusinessTypes: [] })).status, 400, 'at least one sector');
    assert.equal((await post({ applicableBusinessTypes: ['Mars'] })).status, 400, 'unknown sector');
    assert.equal((await post({ code: 'فارسی' })).status, 400, 'code characters');
    assert.equal((await post({ code: 'FS01' })).status, 409, 'code already used by the checklist');
    assert.equal((await post({ weight: 9 })).status, 400, 'weight range');
    assert.equal((await post({ requiresPhoto: 'yes' })).status, 400, 'photo flag is a boolean');
    assert.equal((await post({ template: 'MALL', applicableMallTypes: [] })).status, 400, 'a mall row needs mall types');
  });

  await test('an indicator is created with an automatic code, stage and position beside its topic', async () => {
    const r = await admin.req('POST', '/custom-indicators', { ...base, auditorNote: '  در شب  بررسی شود ', requiresPhoto: true, requiresComment: true, weight: 2 });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    added = r.json;
    assert.match(added.id, /^IND_CU_/);
    assert.equal(added.code, 'U001', 'first automatic code');
    assert.equal(added.auditorNote, 'در شب بررسی شود', 'whitespace is collapsed');
    assert.equal(added.requiresPhoto, true);
    assert.equal(added.weight, 2);
    assert.deepEqual(added.applicableBusinessTypes, ['Fashion', 'Sports']);
    assert.deepEqual(added.applicableMallTypes, []);
    assert.equal(added.status, 'ACTIVE');
    assert.ok(added.createdByName);
    const sign = (await admin.req('GET', '/indicators?template=STORE')).json.indicators.filter((i: any) => i.subject === 'تابلوی سر در');
    assert.ok(added.displayOrder > Math.max(...sign.map((i: any) => i.displayOrder)), 'placed after the last row of its topic');
    assert.ok(added.displayOrder < Math.max(...sign.map((i: any) => i.displayOrder)) + 1, 'and before the next topic');
    assert.equal(added.journeyStage, sign[0].journeyStage, 'takes the stage of its topic');
    const second = await admin.req('POST', '/custom-indicators', { ...base, statement: 'تابلو کثیف است' });
    assert.equal(second.json.code, 'U002', 'automatic codes count up');
    assert.ok(second.json.displayOrder > added.displayOrder, 'a later one sits after the earlier');
    assert.equal((await admin.req('POST', '/custom-indicators', { ...base, code: 'u001' })).status, 409, 'codes are unique ignoring case');
    assert.equal((await evaluator.req('GET', '/custom-indicators')).json.length, 2, 'everyone sees them');
    await admin.req('DELETE', `/custom-indicators/${second.json.id}`);
  });

  await test('an indicator can be changed, moved to another topic and switched off', async () => {
    const put = (body: any) => admin.req('PUT', `/custom-indicators/${added.id}`, body);
    assert.equal((await put({ statement: 'x' })).status, 400);
    assert.equal((await put({ code: 'FS01' })).status, 409);
    assert.equal((await put({ group: 'WRONG' })).status, 400);
    const r = await put({ statement: 'تابلو در شب دیده نمی‌شود', auditorNote: null, status: 'ARCHIVED', requiresPhoto: false });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.statement, 'تابلو در شب دیده نمی‌شود');
    assert.equal(r.json.auditorNote, undefined, 'a note can be removed');
    assert.equal(r.json.status, 'ARCHIVED');
    assert.equal(r.json.template, 'STORE', 'the type never changes');
    const moved = await put({ group: 'CASH', subject: 'صف صندوق' });
    assert.equal(moved.json.group, 'CASH');
    assert.notEqual(moved.json.displayOrder, added.displayOrder, 'moving to another topic repositions it');
    assert.equal((await admin.req('PUT', '/custom-indicators/IND_CU_none', { statement: 'متن' })).status, 404);
  });

  await test('a mall indicator takes mall types, and removing deletes it', async () => {
    const mall = await admin.req('POST', '/custom-indicators', {
      template: 'MALL', group: 'پارکینگ', subject: 'تابلوها', statement: 'تابلوی طبقات خوانا نیست', applicableMallTypes: ['SM', 'Regional'],
    });
    assert.equal(mall.status, 201, JSON.stringify(mall.json));
    assert.deepEqual(mall.json.applicableMallTypes, ['SM', 'Regional']);
    assert.deepEqual(mall.json.applicableBusinessTypes, []);
    assert.equal((await evaluator.req('DELETE', `/custom-indicators/${mall.json.id}`)).status, 403);
    assert.equal((await admin.req('DELETE', `/custom-indicators/${mall.json.id}`)).status, 200);
    assert.equal((await admin.req('DELETE', `/custom-indicators/${mall.json.id}`)).status, 404, 'already gone');
    await admin.req('DELETE', `/custom-indicators/${added.id}`);
    assert.deepEqual((await admin.req('GET', '/custom-indicators')).json, []);
  });

  await test('a checklist indicator can be switched off and on', async () => {
    const fs03 = (await admin.req('GET', '/indicators?template=STORE')).json.indicators.find((i: any) => i.code === 'FS03');
    const off = await admin.req('PUT', `/indicator-overrides/${fs03.id}`, { disabled: true });
    assert.equal(off.json.override.disabled, true);
    assert.equal((await admin.req('PUT', `/indicator-overrides/${fs03.id}`, { disabled: 'x' })).status, 400);
    assert.equal((await evaluator.req('PUT', `/indicator-overrides/${fs03.id}`, { disabled: true })).status, 403);
    const on = await admin.req('PUT', `/indicator-overrides/${fs03.id}`, { disabled: false });
    assert.equal(on.json.override, null, 'back on, and nothing else edited: nothing is stored');
  });

  console.log('visits');

  await test('evaluator creates and edits their own visit; server stamps authorship', async () => {
    const r = await evaluator.req('POST', '/visits', visit({ auditorName: 'جعلی', evaluatorId: 'someone-else', tenantId: 'other' }));
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const saved = (await admin.req('GET', '/visits/visit_test_1')).json;
    assert.equal(saved.auditorName, 'ارزیاب یک'); // names and ownership come from the account
    assert.notEqual(saved.evaluatorId, 'someone-else');
    assert.equal(saved.tenantId, 'org_retail_holding');
    assert.equal(saved.evaluatorCode, 'EV-01', 'evaluator code comes from the account');
  });

  await test('other evaluators cannot see or overwrite it', async () => {
    assert.equal((await evaluator2.req('GET', '/visits/visit_test_1')).status, 404);
    assert.equal((await evaluator2.req('GET', '/visits')).json.length, 0);
    assert.equal((await evaluator2.req('POST', '/visits', visit())).status, 403);
  });

  await test('evaluator cannot approve', async () => {
    const r = await evaluator.req('POST', '/visits', visit({ status: 'APPROVED' }));
    assert.equal(r.status, 403);
  });

  await test('supervisor cannot approve before submission', async () => {
    const r = await supervisor.req('POST', '/visits', visit({ status: 'APPROVED' }));
    assert.equal(r.status, 409);
  });

  await test('evaluator submits, then the visit is locked for them', async () => {
    assert.equal((await evaluator.req('POST', '/visits', visit({ status: 'SUBMITTED' }))).status, 201);
    const late = await evaluator.req('POST', '/visits', visit({ status: 'IN_PROGRESS' }));
    assert.equal(late.status, 409);
    assert.equal(late.json.code, 'LOCKED');
  });

  await test('supervisor returns it; evaluator edits and resubmits', async () => {
    assert.equal((await supervisor.req('POST', '/visits', visit({ status: 'REVISION_REQUESTED' }))).status, 201);
    assert.equal((await evaluator.req('POST', '/visits', visit({ status: 'REVISION_REQUESTED' }))).status, 201);
    assert.equal((await evaluator.req('POST', '/visits', visit({ status: 'SUBMITTED' }))).status, 201);
  });

  await test('supervisor approves; the approver is recorded by the server', async () => {
    const r = await supervisor.req('POST', '/visits', visit({ status: 'APPROVED', supervisorName: 'جعلی' }));
    assert.equal(r.status, 201);
    const saved = (await supervisor.req('GET', '/visits/visit_test_1')).json;
    assert.equal(saved.supervisorName, 'سرپرست');
  });

  await test('read-only roles cannot write visits', async () => {
    assert.equal((await manager.req('POST', '/visits', visit({ id: 'v2' }))).status, 403);
    assert.equal((await manager.req('GET', '/visits')).json.length, 1, 'but can read them');
  });

  console.log('custom permissions');

  await test('users report their effective permissions', async () => {
    const me = (await supervisor.req('GET', '/auth/me')).json.user;
    assert.ok(me.permissions.includes('visits.review'));
    assert.equal(me.customPermissions, false);
  });

  await test('admin can grant a single permission to one person', async () => {
    const list = (await admin.req('GET', '/users')).json;
    const m1 = list.find((u: any) => u.email === 'm1@test.ir');
    const r = await admin.req('PATCH', `/users/${m1.id}`, { permissions: [...m1.permissions, 'visits.fill'] });
    assert.equal(r.status, 200);
    assert.equal(r.json.user.customPermissions, true);
    // The manager can now write visits without changing role or signing in again.
    assert.equal((await manager.req('POST', '/visits', visit({ id: 'v_mgr' }))).status, 201);
  });

  await test('removing a permission takes effect immediately', async () => {
    const list = (await admin.req('GET', '/users')).json;
    const m1 = list.find((u: any) => u.email === 'm1@test.ir');
    await admin.req('PATCH', `/users/${m1.id}`, { permissions: m1.permissions.filter((p: string) => p !== 'actions.view') });
    assert.equal((await manager.req('GET', '/actions')).status, 403);
  });

  await test('invalid permission names are refused', async () => {
    const list = (await admin.req('GET', '/users')).json;
    const m1 = list.find((u: any) => u.email === 'm1@test.ir');
    assert.equal((await admin.req('PATCH', `/users/${m1.id}`, { permissions: ['root'] })).status, 400);
  });

  await test('choosing a role template resets custom permissions', async () => {
    const list = (await admin.req('GET', '/users')).json;
    const m1 = list.find((u: any) => u.email === 'm1@test.ir');
    const r = await admin.req('PATCH', `/users/${m1.id}`, { role: 'Owner' });
    assert.equal(r.json.user.customPermissions, false);
    assert.ok(!r.json.user.permissions.includes('visits.fill'));
  });

  await test('a user created with custom permissions gets exactly those', async () => {
    const r = await admin.req('POST', '/users', {
      name: 'فقط گزارش',
      email: 'viewer@test.ir',
      role: 'Verifier',
      permissions: ['reports.view'],
    });
    assert.equal(r.status, 201);
    assert.deepEqual(r.json.user.permissions, ['reports.view']);
    const c = new Client();
    await c.req('POST', '/auth/login', { email: 'viewer@test.ir', password: r.json.temporaryPassword });
    assert.equal((await c.req('GET', '/actions')).status, 403);
    assert.equal((await c.req('POST', '/visits', visit({ id: 'v_view' }))).status, 403);
  });

  await test('an admin cannot take user management away from themselves', async () => {
    const me = (await admin.req('GET', '/auth/me')).json.user;
    const r = await admin.req('PATCH', `/users/${me.id}`, { permissions: ['reports.view'] });
    assert.equal(r.status, 400);
  });

  console.log('admin controls');

  await test('deactivating a user signs them out immediately', async () => {
    const list = (await admin.req('GET', '/users')).json;
    const e2 = list.find((u: any) => u.email === 'e2@test.ir');
    assert.equal((await admin.req('PATCH', `/users/${e2.id}`, { isActive: false })).status, 200);
    assert.equal((await evaluator2.req('GET', '/auth/me')).status, 401);
  });

  await test('the last active admin cannot be removed', async () => {
    const me = (await admin.req('GET', '/auth/me')).json.user;
    assert.equal((await admin.req('PATCH', `/users/${me.id}`, { role: 'Evaluator' })).status, 400);
    assert.equal((await admin.req('PATCH', `/users/${me.id}`, { isActive: false })).status, 400);
  });

  await test('reset password issues a new one-time password', async () => {
    const list = (await admin.req('GET', '/users')).json;
    const s1 = list.find((u: any) => u.email === 's1@test.ir');
    const r = await admin.req('POST', `/users/${s1.id}/reset-password`);
    assert.equal(r.status, 200);
    assert.equal((await supervisor.req('GET', '/auth/me')).status, 401, 'old session revoked');
    const again = new Client();
    assert.equal((await again.req('POST', '/auth/login', { email: 's1@test.ir', password: r.json.temporaryPassword })).status, 200);
  });

  await test('five wrong passwords lock the account', async () => {
    const c = new Client();
    for (let i = 0; i < 5; i++) await c.req('POST', '/auth/login', { email: 'm1@test.ir', password: `wrong${i}pass` });
    const r = await c.req('POST', '/auth/login', { email: 'm1@test.ir', password: 'whatever1' });
    assert.equal(r.status, 423);
  });

  await test('cross-origin writes are refused', async () => {
    const r = await admin.req('POST', '/stores', { brandName: 'x', branchName: 'y' }, { origin: 'https://evil.example' });
    assert.equal(r.status, 403);
  });

  await test('logout clears the session', async () => {
    await admin.req('POST', '/auth/logout');
    assert.equal((await admin.req('GET', '/auth/me')).status, 401);
  });

  console.log(`\n${passed} passed`);
} finally {
  server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
