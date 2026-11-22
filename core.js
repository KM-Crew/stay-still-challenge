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
      const r = fn(root, params);
      if (typeof r === 'function') this.cleanup = r;
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

async function saveImage(el, filename, scale = 2) {
  if (!window.html2canvas) { toast('이미지 저장 도구를 불러오지 못했어요'); return; }
  const canvas = await html2canvas(el, { backgroundColor: null, scale, useCORS: true });
  canvas.toBlob(b => download(b, filename), 'image/png');
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
