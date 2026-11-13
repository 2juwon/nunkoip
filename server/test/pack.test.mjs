// 문제 공유 링크 시험: wrangler dev 켠 뒤 node test/pack.test.mjs
import assert from 'node:assert/strict';
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const IMG = 'data:image/jpeg;base64,' + Buffer.from('fake-image').toString('base64');
const post = body => fetch(BASE + '/api/packs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const pack = {
  app: 'nunkoip', v: 2, title: '우리 팀 <b>문제</b>',
  people: [
    { name: '철수', src: IMG, w: 600, h: 800, checked: true, boxes: { eyeL: { x: .2, y: .3, w: .2, h: .1 }, eyeR: { x: .5, y: .3, w: .2, h: .1 }, nose: { x: .4, y: .4, w: .2, h: .2 }, mouth: { x: .3, y: .6, w: .4, h: .1 }, evil: 1 } },
    { name: '영희', src: IMG, w: 600, h: 800, boxes: {} },
  ],
  players: ['남의 이름'], settings: { order: 'all', gray: true, hack: 1 },
};
let r = await post(pack);
assert.equal(r.status, 200);
const made = await r.json();
assert.match(made.id, /^[a-z0-9]{10}$/); assert.ok(made.delKey); assert.equal(made.count, 2);
assert.ok(made.expires - Date.now() > 29 * 864e5);

r = await fetch(`${BASE}/api/packs/${made.id}`);
const got = await r.json();
assert.equal(got.title, '우리 팀 <b>문제</b>');
assert.equal(got.people.length, 2);
assert.equal(got.people[0].name, '철수');
assert.equal(got.people[0].boxes.evil, undefined);
assert.equal(got.players, undefined);                       // 참가자 이름은 안 올라감
assert.deepEqual(got.settings, { order: 'all', gray: true, choices: false });

// 잘못된 묶음은 거절
assert.equal((await post({ app: 'x', people: [] })).status, 400);
assert.equal((await post({ app: 'nunkoip', people: [{ name: 'a', src: 'javascript:alert(1)' }] })).status, 400);
assert.equal((await post({ app: 'nunkoip', people: [] })).status, 400);

// 없는 링크
assert.equal((await fetch(`${BASE}/api/packs/zzzzzzzzzz`)).status, 404);

// 열쇠가 틀리면 못 지움, 맞으면 지워짐
assert.equal((await fetch(`${BASE}/api/packs/${made.id}?key=wrong`, { method: 'DELETE' })).status, 403);
assert.equal((await fetch(`${BASE}/api/packs/${made.id}?key=${made.delKey}`, { method: 'DELETE' })).status, 200);
assert.equal((await fetch(`${BASE}/api/packs/${made.id}`)).status, 404);
console.log('pack tests ok');
