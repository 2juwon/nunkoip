// 로컬 서버(wrangler dev, 기본 http://127.0.0.1:8787)로 방 흐름을 시험해요: node test/room.test.mjs
import assert from 'node:assert/strict';
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const WS = BASE.replace(/^http/, 'ws');
const IMG = 'data:image/jpeg;base64,' + Buffer.from('fake').toString('base64');
function conn(path) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(WS + path); const inbox = [];
    ws.onmessage = e => inbox.push(JSON.parse(e.data));
    ws.onopen = () => res({ ws, inbox, send: o => ws.send(JSON.stringify(o)), last: t => [...inbox].reverse().find(m => m.t === t) });
    ws.onerror = rej;
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));

const { code, hostKey } = await (await fetch(BASE + '/api/rooms', { method: 'POST' })).json();
assert.match(code, /^\d{5}$/);
assert.equal((await (await fetch(`${BASE}/api/rooms/${code}`)).json()).exists, true);
assert.equal((await (await fetch(`${BASE}/api/rooms/00000`)).json()).exists, false);

// 잘못된 열쇠는 거절
const badOk = await conn(`/ws/${code}?role=host&key=nope`).then(c => { c.ws.close(); return true; }, () => false);
assert.equal(badOk, false);

const host = await conn(`/ws/${code}?role=host&key=${hostKey}`);
const a = await conn(`/ws/${code}?role=player&pid=aaaaaaaaaa&name=${encodeURIComponent('철수')}`);
await wait(200);
assert.equal(a.last('welcome').state.phase, 'lobby');
let pl = host.last('players').players;
assert.equal(pl.list.length, 1); assert.equal(pl.list[0].online, true); assert.equal(pl.host, true);

// 문제 상태 중계 (공개 안 된 부위·이상한 값은 걸러짐)
host.send({ t: 'state', state: { phase: 'question', q: 0, total: 3, order: ['eyeL','eyeR','nose','mouth'], shown: 1, pts: 4, parts: { eyeL: IMG, nose: 'javascript:alert(1)' }, choices: ['가','나'] } });
await wait(200);
const st = a.last('state').state;
assert.equal(st.phase, 'question'); assert.equal(st.parts.eyeL, IMG); assert.equal(st.parts.nose, undefined);

// 늦게 들어온 사람도 지금 화면을 받음
const b = await conn(`/ws/${code}?role=player&name=${encodeURIComponent('영희')}`);
await wait(200);
const bw = b.last('welcome'); assert.equal(bw.state.q, 0); assert.ok(bw.pid);

// 참가자는 상태를 바꿀 수 없음
b.send({ t: 'state', state: { phase: 'end' } }); b.send({ t: 'award', q: 0, pids: [bw.pid], pts: 4 });
await wait(200);
assert.equal(a.last('state').state.phase, 'question');

// 점수: 같은 문제는 다시 보내면 바뀜(합산 아님)
host.send({ t: 'award', q: 0, pids: ['aaaaaaaaaa', bw.pid], pts: 4 });
host.send({ t: 'award', q: 0, pids: ['aaaaaaaaaa'], pts: 3 });
host.send({ t: 'award', q: 1, pids: ['aaaaaaaaaa', bw.pid], pts: 2 });
await wait(800);
pl = b.last('players').players.list;
assert.deepEqual(pl.map(p => [p.name, p.score]), [['철수', 5], ['영희', 2]]);

// 이름 바꾸기, 나가면 오프라인 표시, 같은 pid로 돌아오면 점수 유지
a.send({ t: 'name', name: '철수왕' }); await wait(150);
a.ws.close(); await wait(300);
pl = host.last('players').players.list;
assert.equal(pl[0].name, '철수왕'); assert.equal(pl[0].online, false);
const a2 = await conn(`/ws/${code}?role=player&pid=aaaaaaaaaa&name=${encodeURIComponent('철수왕')}`);
await wait(200);
assert.equal(a2.last('welcome').players.list.find(p => p.pid === 'aaaaaaaaaa').score, 5);

// 정답 공개
host.send({ t: 'state', state: { phase: 'reveal', q: 0, total: 3, order: ['eyeL','eyeR','nose','mouth'], shown: 2, pts: 3, parts: { eyeL: IMG, eyeR: IMG }, answer: { name: '<b>민수</b>', photo: IMG } } });
await wait(200);
assert.equal(a2.last('state').state.answer.name, '<b>민수</b>');  // 글자 그대로 — 화면에서 이스케이프

// 내보내기
host.send({ t: 'kick', pid: bw.pid }); await wait(300);
assert.ok(b.last('kicked'));
assert.equal(host.last('players').players.list.length, 1);

// 출제자 재접속: 예전 연결은 닫힘
const host2 = await conn(`/ws/${code}?role=host&key=${hostKey}`);
await wait(300);
assert.equal(host.ws.readyState, 3);
assert.equal(host2.last('welcome').state.phase, 'reveal');
for (const c of [host2, a2]) c.ws.close();
console.log('room tests ok — room', code);
process.exit(0);
