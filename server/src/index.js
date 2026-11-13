// 눈코입 게임 — 같이 하기 방 서버
// 출제자(host)가 보는 화면 상태를 참가자(player)에게 그대로 전해 주고, 출제자가 준 점수를 모아요.
// 사진은 출제자가 공개한 부위만 오가고, 방이 6시간 동안 쓰이지 않으면 모두 지워요.

const PARTS = ['eyeL', 'eyeR', 'nose', 'mouth'];
const PHASES = ['lobby', 'question', 'reveal', 'end'];
const TTL = 6 * 60 * 60 * 1000;          // 마지막 사용 뒤 6시간이면 방 정리
const MAX_PLAYERS = 60;
const MAX_MSG = 1_000_000;                // 한 번에 받는 메시지 최대 크기
const MAX_PART = 350_000;                 // 부위 사진 하나 최대 크기(data URL 글자 수)
const MAX_PHOTO = 600_000;                // 정답 사진 최대 크기
const IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const rid = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join(''); };
const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (url.pathname === '/api/rooms' && req.method === 'POST') {
      const hostKey = rid(24);
      for (let i = 0; i < 8; i++) {
        const a = new Uint32Array(1); crypto.getRandomValues(a);
        const code = String(10000 + (a[0] % 90000));
        const stub = env.ROOM.get(env.ROOM.idFromName(code));
        const r = await stub.fetch('https://room/init', { method: 'POST', body: JSON.stringify({ hostKey, code }) });
        if ((await r.json()).ok) return json({ code, hostKey });
      }
      return json({ error: 'busy' }, 503);
    }

    let m = url.pathname.match(/^\/api\/rooms\/(\d{5})$/);
    if (m) {
      const stub = env.ROOM.get(env.ROOM.idFromName(m[1]));
      return json(await (await stub.fetch('https://room/info')).json());
    }

    m = url.pathname.match(/^\/ws\/(\d{5})$/);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'websocket only' }, 426);
      const stub = env.ROOM.get(env.ROOM.idFromName(m[1]));
      return stub.fetch(new Request('https://room/ws' + url.search, req));
    }

    // ---- 문제 공유 링크 ----
    if (url.pathname === '/api/packs' && req.method === 'POST') {
      const len = +(req.headers.get('Content-Length') || 0);
      if (len > PACK_MAX_BODY) return json({ error: 'too_large' }, 413);
      const text = await req.text();
      if (text.length > PACK_MAX_BODY) return json({ error: 'too_large' }, 413);
      let d; try { d = JSON.parse(text); } catch (e) { return json({ error: 'bad_json' }, 400); }
      const pack = cleanPack(d);
      if (!pack) return json({ error: 'bad_pack' }, 400);
      const id = rid(10), delKey = rid(20);
      const stub = env.PACK.get(env.PACK.idFromName(id));
      const r = await stub.fetch('https://pack/put', { method: 'POST', body: JSON.stringify({ ...pack, delKey }) });
      if (!r.ok) return json({ error: 'save_failed' }, 500);
      const meta = await r.json();
      return json({ id, delKey, expires: meta.expires, count: pack.people.length });
    }
    m = url.pathname.match(/^\/api\/packs\/([a-z0-9]{10})$/);
    if (m) {
      const stub = env.PACK.get(env.PACK.idFromName(m[1]));
      if (req.method === 'GET') return stub.fetch('https://pack/get');
      if (req.method === 'DELETE') return stub.fetch('https://pack/del?key=' + encodeURIComponent(url.searchParams.get('key') || ''), { method: 'POST' });
    }

    if (url.pathname === '/' || url.pathname === '/api/health') return json({ ok: true, app: 'nunkoip-room' });
    return json({ error: 'not found' }, 404);
  },
};

// ---- 문제 공유 링크: 링크를 아는 사람만, 30일 뒤 자동 삭제 ----
const PACK_TTL = 30 * 24 * 60 * 60 * 1000;
const PACK_MAX_BODY = 60_000_000;
const PACK_MAX_PEOPLE = 80;
const PACK_MAX_SRC = 1_900_000;          // Durable Object 값 하나 2MB 제한 안쪽
const PACK_IMG_RE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const BOX_KEYS = ['eyeL', 'eyeR', 'nose', 'mouth', 'eyes'];
function cleanBox(b) {
  const n = v => typeof v === 'number' && isFinite(v) && v >= -0.01 && v <= 1.01;
  if (!b || !n(b.x) || !n(b.y) || !n(b.w) || !n(b.h)) return null;
  return { x: +b.x, y: +b.y, w: +b.w, h: +b.h };
}
function cleanPack(d) {
  if (!d || d.app !== 'nunkoip' || !Array.isArray(d.people)) return null;
  if (d.people.length < 1 || d.people.length > PACK_MAX_PEOPLE) return null;
  const people = [];
  for (const q of d.people) {
    if (!q || typeof q.src !== 'string' || q.src.length > PACK_MAX_SRC || !PACK_IMG_RE.test(q.src)) return null;
    const boxes = {};
    if (q.boxes && typeof q.boxes === 'object') for (const k of BOX_KEYS) { const b = cleanBox(q.boxes[k]); if (b) boxes[k] = b; }
    people.push({
      name: str(q.name, 20), src: q.src, boxes, checked: !!q.checked,
      w: Number.isInteger(q.w) && q.w > 0 && q.w < 10000 ? q.w : 0,
      h: Number.isInteger(q.h) && q.h > 0 && q.h < 10000 ? q.h : 0,
    });
  }
  const st = d.settings && typeof d.settings === 'object' ? d.settings : {};
  const settings = { order: ['fixed', 'random', 'all'].includes(st.order) ? st.order : 'fixed', gray: !!st.gray, choices: !!st.choices };
  return { title: str(d.title, 40) || `눈코입 문제 ${people.length}장`, people, settings };
}

export class Pack {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }

  async fetch(req) {
    const url = new URL(req.url), st = this.ctx.storage;
    const meta = await st.get('meta');
    const live = meta && Date.now() < meta.expires;

    if (url.pathname === '/put') {
      if (meta) return json({ error: 'exists' }, 409);
      const d = await req.json();
      const now = Date.now();
      const m = { title: d.title, count: d.people.length, settings: d.settings, created: now, expires: now + PACK_TTL, delKey: d.delKey };
      const entries = { meta: m };
      d.people.forEach((p, i) => { entries['p' + i] = p; });
      await st.put(entries);
      await st.setAlarm(m.expires);
      return json({ ok: true, expires: m.expires });
    }

    if (url.pathname === '/get') {
      if (!live) return json({ error: 'not_found' }, 404);
      const keys = Array.from({ length: meta.count }, (_, i) => 'p' + i);
      const got = await st.get(keys);
      const people = keys.map(k => got.get(k)).filter(Boolean);
      return json({ app: 'nunkoip', v: 2, title: meta.title, people, settings: meta.settings, created: meta.created, expires: meta.expires });
    }

    if (url.pathname === '/del') {
      if (!meta) return json({ ok: true, gone: true });
      if (url.searchParams.get('key') !== meta.delKey) return json({ error: 'bad_key' }, 403);
      await st.deleteAlarm();
      await st.deleteAll();
      return json({ ok: true });
    }
    return json({ error: 'not_found' }, 404);
  }

  async alarm() { await this.ctx.storage.deleteAll(); }
}

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    ctx.blockConcurrencyWhile(async () => {
      this.meta = (await ctx.storage.get('meta')) || null;
      this.state = (await ctx.storage.get('state')) || { phase: 'lobby' };
      this.players = (await ctx.storage.get('players')) || {};
      this.awards = (await ctx.storage.get('awards')) || {};
    });
  }

  alive() { return !!this.meta && Date.now() - this.meta.touched < TTL; }

  async touch() {
    this.meta.touched = Date.now();
    await this.ctx.storage.put('meta', this.meta);
    await this.ctx.storage.setAlarm(Date.now() + TTL + 60_000);
  }

  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/init') {
      if (this.alive()) return json({ ok: false });
      const { hostKey, code } = await req.json();
      await this.ctx.storage.deleteAll();
      this.meta = { hostKey, code, created: Date.now(), touched: Date.now() };
      this.state = { phase: 'lobby' };
      this.players = {};
      this.awards = {};
      await this.ctx.storage.put({ meta: this.meta, state: this.state, players: this.players, awards: this.awards });
      await this.ctx.storage.setAlarm(Date.now() + TTL + 60_000);
      return json({ ok: true });
    }

    if (url.pathname === '/info') {
      if (!this.alive()) return json({ exists: false });
      return json({ exists: true, phase: this.state.phase, players: Object.keys(this.players).length });
    }

    if (url.pathname === '/ws') {
      if (!this.alive()) return json({ error: 'no room' }, 404);
      const role = url.searchParams.get('role');
      let att;
      if (role === 'host') {
        if (url.searchParams.get('key') !== this.meta.hostKey) return json({ error: 'bad key' }, 403);
        // 출제자 연결은 하나만: 예전 연결은 닫음
        for (const ws of this.ctx.getWebSockets('host')) { try { ws.close(4000, 'replaced'); } catch (e) {} }
        att = { role: 'host' };
      } else {
        let pid = url.searchParams.get('pid') || '';
        if (!/^[a-z0-9]{8,20}$/.test(pid)) pid = rid(12);
        const name = str(url.searchParams.get('name'), 12) || '참가자';
        if (!this.players[pid]) {
          if (Object.keys(this.players).length >= MAX_PLAYERS) return json({ error: 'full' }, 403);
          this.players[pid] = { name, joined: Date.now() };
        } else {
          this.players[pid].name = name;
        }
        await this.ctx.storage.put('players', this.players);
        // 같은 사람의 예전 연결은 닫음
        for (const ws of this.ctx.getWebSockets('p:' + pid)) { try { ws.close(4000, 'replaced'); } catch (e) {} }
        att = { role: 'player', pid };
      }
      const pair = new WebSocketPair();
      const tags = att.role === 'host' ? ['host'] : ['player', 'p:' + att.pid];
      this.ctx.acceptWebSocket(pair[1], tags);
      pair[1].serializeAttachment(att);
      await this.touch();
      pair[1].send(JSON.stringify({ t: 'welcome', role: att.role, pid: att.pid || null, code: this.meta.code, state: this.state, players: this.playerList() }));
      this.broadcastPlayers();
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    return json({ error: 'not found' }, 404);
  }

  onlinePids() {
    const s = new Set();
    for (const ws of this.ctx.getWebSockets('player')) {
      const a = ws.deserializeAttachment();
      if (a && a.pid && ws.readyState === 1) s.add(a.pid);
    }
    return s;
  }

  playerList() {
    const online = this.onlinePids();
    const score = {};
    for (const a of Object.values(this.awards)) for (const pid of a.pids) score[pid] = (score[pid] || 0) + a.pts;
    return {
      host: this.ctx.getWebSockets('host').some(ws => ws.readyState === 1),
      awards: this.awards,
      list: Object.entries(this.players)
        .map(([pid, p]) => ({ pid, name: p.name, score: score[pid] || 0, online: online.has(pid), joined: p.joined }))
        .sort((a, b) => a.joined - b.joined),
    };
  }

  send(ws, obj) { try { ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); } catch (e) {} }
  broadcast(obj, tag) { const s = JSON.stringify(obj); for (const ws of this.ctx.getWebSockets(tag)) this.send(ws, s); }
  broadcastPlayers() { this.broadcast({ t: 'players', players: this.playerList() }); }

  cleanState(s) {
    if (!s || typeof s !== 'object' || !PHASES.includes(s.phase)) return null;
    const out = { phase: s.phase };
    const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi ? v : null;
    out.total = int(s.total, 0, 500) ?? 0;
    if (s.phase === 'lobby' || s.phase === 'end') return out;
    out.q = int(s.q, 0, 499) ?? 0;
    out.collage = !!s.collage;
    out.gray = !!s.gray;
    out.order = Array.isArray(s.order) && s.order.length === 4 && PARTS.every(p => s.order.includes(p)) ? s.order.slice() : PARTS.slice();
    out.shown = int(s.shown, 0, 4) ?? 1;
    out.pts = int(s.pts, 0, 4) ?? 1;
    out.parts = {};
    if (s.parts && typeof s.parts === 'object') {
      for (const p of PARTS) {
        const v = s.parts[p];
        if (typeof v === 'string' && v.length <= MAX_PART && IMG_RE.test(v)) out.parts[p] = v;
      }
    }
    out.choices = Array.isArray(s.choices) ? s.choices.slice(0, 4).map(c => str(c, 20)) : null;
    if (s.phase === 'reveal' && s.answer && typeof s.answer === 'object') {
      out.answer = { name: str(s.answer.name, 20) };
      if (typeof s.answer.photo === 'string' && s.answer.photo.length <= MAX_PHOTO && IMG_RE.test(s.answer.photo)) out.answer.photo = s.answer.photo;
    }
    return out;
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_MSG) return;
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    const att = ws.deserializeAttachment() || {};

    if (msg.t === 'ping') { this.send(ws, { t: 'pong' }); return; }

    if (att.role === 'host') {
      if (msg.t === 'state') {
        const s = this.cleanState(msg.state);
        if (!s) return;
        this.state = s;
        await this.ctx.storage.put('state', s);
        this.broadcast({ t: 'state', state: s }, 'player');
        await this.touch();
      } else if (msg.t === 'award') {
        const q = Number.isInteger(msg.q) && msg.q >= 0 && msg.q < 500 ? msg.q : null;
        if (q == null) return;
        const pts = Number.isInteger(msg.pts) && msg.pts >= 0 && msg.pts <= 4 ? msg.pts : 1;
        const pids = Array.isArray(msg.pids) ? [...new Set(msg.pids)].filter(p => this.players[p]) : [];
        if (pids.length) this.awards[q] = { pids, pts }; else delete this.awards[q];
        await this.ctx.storage.put('awards', this.awards);
        this.broadcastPlayers();
      } else if (msg.t === 'resetScores') {
        this.awards = {};
        await this.ctx.storage.put('awards', this.awards);
        this.broadcastPlayers();
      } else if (msg.t === 'kick') {
        const pid = String(msg.pid || '');
        if (this.players[pid]) {
          delete this.players[pid];
          for (const a of Object.values(this.awards)) a.pids = a.pids.filter(p => p !== pid);
          await this.ctx.storage.put({ players: this.players, awards: this.awards });
          for (const w of this.ctx.getWebSockets('p:' + pid)) { this.send(w, { t: 'kicked' }); try { w.close(4001, 'kicked'); } catch (e) {} }
          this.broadcastPlayers();
        }
      }
    } else if (att.role === 'player') {
      if (msg.t === 'name' && this.players[att.pid]) {
        const name = str(msg.name, 12);
        if (name) { this.players[att.pid].name = name; await this.ctx.storage.put('players', this.players); this.broadcastPlayers(); }
      }
    }
  }

  async webSocketClose(ws) { try { ws.close(); } catch (e) {} this.broadcastPlayers(); }
  async webSocketError() { this.broadcastPlayers(); }

  async alarm() {
    if (this.meta && Date.now() - this.meta.touched < TTL) {
      await this.ctx.storage.setAlarm(this.meta.touched + TTL + 60_000);
      return;
    }
    for (const ws of this.ctx.getWebSockets()) { try { ws.close(4002, 'expired'); } catch (e) {} }
    await this.ctx.storage.deleteAll();
    this.meta = null; this.state = { phase: 'lobby' }; this.players = {}; this.awards = {};
  }
}
