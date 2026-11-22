/* core.js — 공용 도우미: 라우터, DOM, 저장, 공유 (KM-Crew 프로토타입 공통) */
'use strict';
/* 허브(km-crew.github.io) 안에 iframe으로 들어가 있으면 표시 */
if (window.top !== window.self) document.documentElement.classList.add('embedded');
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const Router = {
  routes: {},
  cleanup: null,
  on(path, fn) { this.routes[path] = fn; return this; },
  go(path) { location.hash = '#' + path; },
  parse() {
    const raw = location.hash.slice(1) || '/';
    const i = raw.indexOf('?');
    const path = i < 0 ? raw : raw.slice(0, i);
    const qs = i < 0 ? '' : raw.slice(i + 1);
    return { path, params: new URLSearchParams(qs) };
  },
  start(root) {
    const run = () => {
      if (this.cleanup) { try { this.cleanup(); } catch (e) { /* 무시 */ } this.cleanup = null; }
      const { path, params } = this.parse();
      const fn = this.routes[path] || this.routes['/'];
      root.innerHTML = '';
      window.scrollTo(0, 0);
      document.body.dataset.page = path.replace(/\//g, '') || 'home';
      let r;
      try { r = fn(root, params); }
      catch (e) { console.error(e); showCrash(root, e); }
      if (typeof r === 'function') this.cleanup = r;
      A11y.label(root);
    };
    addEventListener('hashchange', run);
    run();
  }
};

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ } },
  sget(k, d) { try { const v = sessionStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  sset(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ } }
};

function toast(msg) {
  let t = $('#toast');
  if (!t) { t = h('<div id="toast" role="status"></div>'); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 1800);
}

function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* 외부 스크립트를 필요할 때만 불러오기(한 번만) */
const _scripts = {};
function loadScript(src) {
  if (!_scripts[src]) {
    _scripts[src] = new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => ok();
      s.onerror = () => { delete _scripts[src]; no(new Error('load ' + src)); };
      document.head.appendChild(s);
    });
  }
  return _scripts[src];
}
const H2C_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';

/* 화면 일부를 PNG로 저장. 도구를 못 불러오거나 그리기에 실패해도 안내만 하고 멈추지 않음 */
async function saveImage(el, filename, scale = 2) {
  if (!el) { toast('저장할 화면을 찾지 못했어요'); return false; }
  try {
    let canvas = el.tagName === 'CANVAS' ? el : null;
    if (!canvas) {
      if (!window.html2canvas) {
        toast('이미지를 만드는 중…');
        try { await loadScript(H2C_URL); } catch (e) { /* 아래에서 안내 */ }
      }
      if (!window.html2canvas) { toast('이미지 저장 도구를 불러오지 못했어요. 인터넷 연결을 확인하거나 화면을 캡처해 주세요'); Sfx.play('bad'); return false; }
      canvas = await html2canvas(el, { backgroundColor: null, scale, useCORS: true, logging: false });
    }
    const blob = await new Promise(r => { try { canvas.toBlob(r, 'image/png'); } catch (e) { r(null); } });
    if (!blob) throw new Error('빈 이미지');
    download(blob, filename);
    toast('이미지를 저장했어요');
    Sfx.play('ok');
    return true;
  } catch (e) {
    console.error(e);
    toast('이미지를 만들지 못했어요. 화면 캡처로 저장해 주세요');
    Sfx.play('bad');
    return false;
  }
}

async function shareText(title, text, url = location.href) {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(text + '\n' + url); toast('링크를 복사했어요'); }
  catch (e) { prompt('아래 내용을 복사하세요', text + '\n' + url); }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('복사했어요'); }
  catch (e) { prompt('아래 내용을 복사하세요', text); }
}

/* 유니코드 객체 ↔ URL 안전 base64 */
function encodeData(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let s = '';
  bytes.forEach(x => { s += String.fromCharCode(x); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeData(str) {
  try {
    str = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const bin = atob(str);
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
  } catch (e) { return null; }
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* 미지원 */ } }

/* ---------- 화면 모드: PC / 모바일 ----------
   기본은 화면 폭(900px 기준)으로 자동. 머리글 버튼으로 직접 고르면 그 선택을 기억함.
   허브(km-crew.github.io) 안 iframe에서는 저장된 선택을 무시하고 틀의 폭으로만 정함. */
const View = {
  KEY: 'view-pref',
  embedded: window.top !== window.self,
  pref() { return this.embedded ? 'auto' : store.get(this.KEY, 'auto'); },
  set(p) { store.set(this.KEY, p); this.apply(); toast(p === 'pc' ? 'PC 화면으로 볼게요' : p === 'mobile' ? '모바일 화면으로 볼게요' : '화면 폭에 맞춰 자동으로 볼게요'); },
  apply() {
    const pref = this.pref();
    const meta = document.querySelector('meta[name=viewport]');
    const phone = Math.min(screen.width, screen.height) < 700;
    const want = pref === 'pc' && phone ? 'width=1280' : 'width=device-width, initial-scale=1, viewport-fit=cover';
    if (meta && meta.content !== want) meta.content = want;
    const pc = pref === 'pc' ? true : pref === 'mobile' ? false : innerWidth >= 900;
    const root = document.documentElement;
    root.classList.toggle('pc', pc);
    root.classList.toggle('mobile', !pc);
    root.classList.toggle('force-mobile', pref === 'mobile' && innerWidth >= 700);
    const auto = document.getElementById('view-auto');
    if (auto) auto.classList.toggle('hidden', pref === 'auto');
  }
};
View.apply();
addEventListener('resize', () => View.apply());
document.addEventListener('click', e => {
  const b = e.target.closest('[data-view]');
  if (b) { e.preventDefault(); View.set(b.dataset.view); }
});

/* ---------- 화면이 비지 않게: 페이지 그리기 실패 시 안내 ---------- */
function showCrash(root, e) {
  root.innerHTML = '';
  root.append(h(`<div class="card center crash" role="alert"><div style="font-size:42px" aria-hidden="true">😵</div><h2>화면을 그리다 문제가 생겼어요</h2>
    <p class="muted small">새로고침하거나 처음 화면으로 돌아가 주세요. 저장된 기록은 그대로예요.</p>
    <div class="row" style="justify-content:center"><a class="btn primary" href="#/">처음으로</a><button class="btn" type="button" data-reload>새로고침</button></div></div>`));
  const r = root.querySelector('[data-reload]');
  if (r) r.addEventListener('click', () => location.reload());
}

/* ---------- 전역 오류 안내 (같은 안내는 5초에 한 번) ---------- */
const ErrorGuard = {
  last: 0, count: 0,
  report(msg) {
    msg = String(msg || '');
    if (/ResizeObserver loop|Script error\.?$|AbortError|play\(\) request was interrupted|NotAllowedError/.test(msg)) return;
    this.count++;
    const now = Date.now();
    if (now - this.last < 5000) return;
    this.last = now;
    if (document.body && document.body.classList.contains('mode-on')) return;   // 위장 화면(열공 위장막)에서는 조용히
    toast('앗, 잠깐 문제가 생겼어요. 계속 안 되면 새로고침해 주세요');
  }
};
addEventListener('error', e => { if (e.target && e.target !== window) return; ErrorGuard.report(e.message); });
addEventListener('unhandledrejection', e => ErrorGuard.report(e.reason && (e.reason.message || e.reason)));

/* ---------- 동작 줄이기 ---------- */
const Motion = {
  mq: window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null,
  get reduced() { return !!(this.mq && this.mq.matches); }
};
document.documentElement.classList.toggle('reduce-motion', Motion.reduced);
if (Motion.mq && Motion.mq.addEventListener) Motion.mq.addEventListener('change', () => document.documentElement.classList.toggle('reduce-motion', Motion.reduced));

/* ---------- 효과음 (기본 끔, 머리글 🔇/🔊로 켬. 외부 파일 없이 합성) ---------- */
const Sfx = {
  KEY: 'sfx-on',
  ctx: null,
  get on() { return store.get(this.KEY, false) === true; },
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return this.ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { this.ctx = new AC(); } catch (e) { return null; }
    return this.ctx;
  },
  /* 소리 이름: tap(누름) pop(톡) tick(째깍) ok(성공) bad(실패) win(결과·당첨) whoosh(휙) */
  SOUNDS: {
    tap:    [[660, 0, .05, 'triangle', .12]],
    pop:    [[880, 0, .06, 'sine', .18], [1320, .03, .05, 'sine', .1]],
    tick:   [[1500, 0, .025, 'square', .05]],
    ok:     [[660, 0, .09, 'sine', .18], [990, .08, .14, 'sine', .18]],
    bad:    [[300, 0, .12, 'sawtooth', .08], [220, .1, .18, 'sawtooth', .08]],
    win:    [[523, 0, .12, 'triangle', .2], [659, .1, .12, 'triangle', .2], [784, .2, .12, 'triangle', .2], [1047, .3, .3, 'triangle', .22]],
    whoosh: [[200, 0, .25, 'sine', .12, 900]]
  },
  played: 0,
  play(name) {
    if (!this.on) return;
    const ctx = this.ensure();
    const seq = this.SOUNDS[name];
    if (!ctx || !seq) return;
    try {
      const t0 = ctx.currentTime + .01;
      for (const [f, at, dur, type, vol, f2] of seq) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t0 + at);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + at + dur);
        g.gain.setValueAtTime(0.0001, t0 + at);
        g.gain.exponentialRampToValueAtTime(vol, t0 + at + .01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
        o.connect(g).connect(ctx.destination);
        o.start(t0 + at); o.stop(t0 + at + dur + .02);
      }
      this.played++;
    } catch (e) { /* 소리 실패는 무시 */ }
  },
  set(v) {
    store.set(this.KEY, !!v);
    if (v) { this.ensure(); this.play('pop'); }
    this.sync();
    toast(v ? '효과음을 켰어요' : '효과음을 껐어요');
  },
  sync() {
    $$('[data-sfx]').forEach(b => {
      b.textContent = this.on ? '🔊' : '🔇';
      b.setAttribute('aria-pressed', String(this.on));
      b.setAttribute('aria-label', this.on ? '효과음 끄기' : '효과음 켜기');
      b.title = this.on ? '효과음 끄기' : '효과음 켜기';
    });
  }
};
document.addEventListener('click', e => {
  const s = e.target.closest('[data-sfx]');
  if (s) { e.preventDefault(); Sfx.set(!Sfx.on); return; }
  const b = e.target.closest('.btn, .chip');
  if (b && !b.disabled && !b.hasAttribute('data-nosfx')) Sfx.play('tap');
});

/* ---------- 버튼 이름: 그림 글자만 있는 버튼에 title을 이름으로 붙임 ---------- */
const A11y = {
  TEXTLESS: /^[\s\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u20e3\u200d\ufe0f×✕←→↑↓‹›«»+]*$/u,
  label(root = document) {
    $$('button, a[href], [role=button]', root).forEach(el => {
      if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return;
      const txt = el.textContent.trim();
      if (txt && !this.TEXTLESS.test(txt)) return;
      const name = el.getAttribute('title') || el.dataset.label;
      if (name) el.setAttribute('aria-label', name);
    });
  }
};
let _a11yQueued = false;
new MutationObserver(() => {
  if (_a11yQueued) return;
  _a11yQueued = true;
  requestAnimationFrame(() => { _a11yQueued = false; A11y.label(); });
}).observe(document.documentElement, { childList: true, subtree: true });
Sfx.sync();
A11y.label();
