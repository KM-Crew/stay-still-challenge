/* 본격 망부석 프로젝트 — GPS 한 자리 오래 버티기
   위치 좌표는 이 기기 안에서 거리 계산에만 쓰고, 저장·전송하지 않습니다(기록은 시간만 저장). */
'use strict';

const RANKS = [
  { t: 0, name: '모래알', icon: '·' },
  { t: 60, name: '조약돌', icon: '🪨' },
  { t: 300, name: '돌멩이', icon: '🪨' },
  { t: 900, name: '바위', icon: '⛰️' },
  { t: 1800, name: '큰 바위', icon: '⛰️' },
  { t: 3600, name: '고인돌', icon: '🗿' },
  { t: 7200, name: '망부석', icon: '🗿' },
  { t: 14400, name: '전설의 망부석', icon: '👑' }
];
const rankOf = s => RANKS.filter(r => s >= r.t).pop() || RANKS[0];
const nextRank = s => RANKS.find(r => r.t > s);
function fmt(s) {
  s = Math.floor(s);
  const hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
  return (hh ? hh + ':' + String(mm).padStart(2, '0') : String(mm)) + ':' + String(ss).padStart(2, '0');
}
function fmtKo(s) {
  s = Math.floor(s);
  const hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
  return [hh && hh + '시간', mm && mm + '분', (ss || (!hh && !mm)) && ss + '초'].filter(Boolean).join(' ');
}
function dist(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const cfg = Object.assign({ radius: 30, demo: false, speed: 30, alarm: true, vib: true }, store.sget('ss-cfg', {}));
if (![30, 120, 600].includes(cfg.speed)) cfg.speed = 30;
let lastResult = store.sget('ss-last', null);
const saveCfg = () => store.sset('ss-cfg', cfg);

/* ---------- 돌이 되어 가는 정도 (0 = 사람, 1 = 전설의 망부석) ---------- */
function stoneLevel(sec) {
  const n = RANKS.length - 1;
  if (!(sec > 0)) return 0;
  if (sec >= RANKS[n].t) return 1;
  let i = 0;
  while (i < n && sec >= RANKS[i + 1].t) i++;
  const a = RANKS[i].t, b = RANKS[i + 1].t;
  return (i + (sec - a) / (b - a)) / n;
}
const rankIndex = s => RANKS.indexOf(rankOf(s));

function mix(c1, c2, k) {
  k = clamp(k, 0, 1);
  const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const a = p(c1), b = p(c2);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

/* 망부석 인물 그림(SVG 문자열). 단계가 오를수록 색이 빠지고 돌결·금·이끼·새가 생김 */
let _svgId = 0;
function stoneSVG(level, opt = {}) {
  const L = clamp(level, 0, 1), id = 'st' + (++_svgId);
  const k = clamp(L * 1.35, 0, 1);               // 색이 빠지는 정도(고인돌 전후에 완전히 돌)
  const skin = mix('#f2c9a0', '#a8a397', k), cloth = mix('#5b7bd5', '#8f8b80', k);
  const cloth2 = mix('#3f5fb8', '#7d796f', k), hair = mix('#3b2f2a', '#6d6a62', k);
  const closed = L >= 0.5, smile = L < 0.2;
  const tex = clamp((L - 0.1) * 1.6, 0, 0.9);
  const crack = clamp((L - 0.4) * 4, 0, 1);
  const moss = clamp((L - 0.64) * 5, 0, 1);
  const bird = L >= 0.82, crown = L >= 1;
  const xmlns = opt.xmlns ? ' xmlns="http://www.w3.org/2000/svg"' : '';
  const label = opt.label ? ` role="img" aria-label="${esc(opt.label)}"` : ' aria-hidden="true"';
  return `<svg${xmlns} viewBox="0 0 120 160" class="figure"${label} data-level="${L.toFixed(3)}">
  <defs>
    <pattern id="${id}p" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="4" r="1.2" fill="#4a4740"/><circle cx="10" cy="9" r=".9" fill="#4a4740"/><circle cx="6" cy="12" r=".7" fill="#fff"/><path d="M1 9 l4 -1" stroke="#5a574f" stroke-width=".6"/>
    </pattern>
    <clipPath id="${id}c"><path d="M38 150 L44 92 Q46 78 60 76 Q74 78 76 92 L82 150 Z"/><circle cx="60" cy="56" r="20"/></clipPath>
  </defs>
  <ellipse cx="60" cy="154" rx="46" ry="5" fill="#000" opacity=".12"/>
  <path d="M22 156 Q20 140 34 136 L86 134 Q102 138 98 156 Z" fill="#9b978c" stroke="#7a766c" stroke-width="1.5"/>
  <path d="M34 146 l10 -3 M74 145 l12 2" stroke="#7a766c" stroke-width="1.2"/>
  <g class="fbody">
    <path d="M38 150 L44 92 Q46 78 60 76 Q74 78 76 92 L82 150 Z" fill="${cloth}" stroke="${mix('#2f478f', '#6a665d', k)}" stroke-width="1.5"/>
    <path d="M47 100 Q60 112 73 100 L72 108 Q60 118 48 108 Z" fill="${cloth2}"/>
    <ellipse cx="60" cy="106" rx="9" ry="6" fill="${skin}"/>
    <circle cx="60" cy="56" r="20" fill="${skin}" stroke="${mix('#c99a6e', '#7d796f', k)}" stroke-width="1.5"/>
    <path d="M40 56 Q38 32 60 32 Q82 32 80 56 Q78 44 66 42 Q58 46 46 46 Q42 50 40 56 Z" fill="${hair}"/>
    <path d="M80 52 Q88 66 82 84 Q78 70 78 60 Z" fill="${hair}"/>
    ${closed ? `<path d="M48 58 q4 3 8 0 M64 58 q4 3 8 0" stroke="#3a3631" stroke-width="2" fill="none" stroke-linecap="round"/>`
             : `<circle cx="52" cy="57" r="2.6" fill="#2b2622"/><circle cx="68" cy="57" r="2.6" fill="#2b2622"/>`}
    ${smile ? `<path d="M53 66 q7 6 14 0" stroke="#7a3d2a" stroke-width="2" fill="none" stroke-linecap="round"/>`
            : `<path d="M54 67 h12" stroke="${mix('#7a3d2a', '#4a4740', k)}" stroke-width="2" stroke-linecap="round"/>`}
    ${L < 0.3 ? `<ellipse cx="46" cy="64" rx="4" ry="2.4" fill="#f59e9e" opacity="${(0.6 * (1 - L / 0.3)).toFixed(2)}"/><ellipse cx="74" cy="64" rx="4" ry="2.4" fill="#f59e9e" opacity="${(0.6 * (1 - L / 0.3)).toFixed(2)}"/>` : ''}
    <g clip-path="url(#${id}c)"><rect x="30" y="30" width="60" height="124" fill="url(#${id}p)" opacity="${tex.toFixed(2)}"/></g>
    <g class="cracks" stroke="#3f3c35" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="${crack.toFixed(2)}">
      <path d="M66 38 l-4 8 l5 5 l-3 7"/><path d="M50 120 l6 6 l-2 8 l5 6"/><path d="M73 96 l-5 4 l2 6"/>
    </g>
    <g class="moss" fill="#5f8a3a" opacity="${moss.toFixed(2)}">
      <path d="M44 92 q4 -6 10 -4 q-2 5 -10 4 Z"/><path d="M66 90 q6 -5 11 0 q-5 4 -11 0 Z"/><path d="M42 40 q6 -7 13 -6 q-4 6 -13 6 Z"/><circle cx="40" cy="146" r="4"/><circle cx="47" cy="148" r="3"/><circle cx="80" cy="147" r="3.5"/>
    </g>
  </g>
  ${bird && !crown ? `<g class="bird"><ellipse cx="66" cy="31" rx="7" ry="5" fill="#6b7280"/><circle cx="72" cy="27" r="3.6" fill="#6b7280"/><path d="M75 27 l4 1 l-4 1 Z" fill="#f59e0b"/><circle cx="73" cy="26" r=".9" fill="#fff"/><path d="M60 30 l-6 -3 l2 5 Z" fill="#4b5563"/></g>` : ''}
  ${crown ? `<path class="crown" d="M44 34 L48 18 L55 28 L60 14 L65 28 L72 18 L76 34 Z" fill="#f4c542" stroke="#b8860b" stroke-width="1.5"/>` : ''}
</svg>`;
}

/* 칭호별 카드 색 */
const THEMES = [
  ['#f4f1ea', '#e2ded2', '#6b5d3f'], ['#f3efe6', '#ddd6c6', '#7a6a48'], ['#eef0ee', '#cfd6cf', '#4f6150'],
  ['#ebeef2', '#c9d1dc', '#3f5168'], ['#ecebf2', '#cdcade', '#4b4570'], ['#efe9e2', '#d6c6b2', '#6e4f2c'],
  ['#e9ecea', '#b9c4bd', '#2f4a3b'], ['#2b2a33', '#4a4658', '#f4c542']
];

/* 칭호 카드(캔버스에 직접 그림 → html2canvas 없이 저장) */
async function drawCard(canvas, res) {
  const W = 900, H = 1200, ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  const sec = res.sec, ri = rankIndex(sec), r = RANKS[ri], th = THEMES[ri], dark = ri === RANKS.length - 1;
  const F = 'Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  try { await document.fonts.ready; } catch (e) { /* 무시 */ }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th[0]); g.addColorStop(1, th[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 테두리(이중선)
  ctx.strokeStyle = th[2]; ctx.lineWidth = 6; ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.lineWidth = 2; ctx.strokeRect(52, 52, W - 104, H - 104);
  ctx.textAlign = 'center'; ctx.fillStyle = th[2];
  ctx.font = `700 30px ${F}`; ctx.fillText(res.demo ? '체험 모드 칭호 카드' : '망부석 칭호 인증서', W / 2, 124);
  ctx.font = `500 22px ${F}`; ctx.globalAlpha = .7;
  ctx.fillText(`제 ${String(Math.floor((res.at || 0) / 1000) % 100000).padStart(5, '0')} 호`, W / 2, 162); ctx.globalAlpha = 1;
  // 인물 그림
  const svg = stoneSVG(stoneLevel(sec), { xmlns: true });
  const img = await new Promise(ok => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  ctx.save(); ctx.fillStyle = dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.arc(W / 2, 400, 190, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  if (img) ctx.drawImage(img, W / 2 - 165, 190, 330, 440);
  // 칭호·시간
  ctx.fillStyle = dark ? '#fff' : '#222';
  ctx.font = `900 92px ${F}`; ctx.fillText(r.name, W / 2, 730);
  ctx.fillStyle = th[2]; ctx.font = `800 54px ${F}`; ctx.fillText(fmtKo(sec), W / 2, 810);
  ctx.fillStyle = dark ? 'rgba(255,255,255,.75)' : 'rgba(0,0,0,.6)'; ctx.font = `500 28px ${F}`;
  const d = new Date(res.at || Date.now());
  ctx.fillText(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} · 반경 ${res.radius}m${res.demo ? ` · ${res.speed || 30}배속` : ''}`, W / 2, 866);
  ctx.fillText(String(res.reason || '').slice(0, 30), W / 2, 908);
  // 단계 막대
  const n = RANKS.length - 1, bx = 150, bw = W - 300, by = 960;
  for (let i = 1; i <= n; i++) {
    const x = bx + (i - 1) * (bw / n);
    ctx.fillStyle = i <= ri ? th[2] : (dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.12)');
    ctx.fillRect(x + 3, by, bw / n - 6, 14);
  }
  ctx.font = `500 22px ${F}`; ctx.fillStyle = dark ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.5)';
  const nx = nextRank(sec);
  ctx.fillText(nx ? `다음 칭호 "${nx.name}"까지 ${fmtKo(nx.t - sec)}` : '모든 칭호를 모았어요', W / 2, by + 56);
  // 도장
  if (ri > 0) {
    ctx.save(); ctx.translate(W - 170, 250); ctx.rotate(-0.22);
    ctx.strokeStyle = '#c0392b'; ctx.fillStyle = '#c0392b'; ctx.globalAlpha = .85; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, 74, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `900 34px ${F}`; ctx.fillText(res.demo ? '체험' : '인증', 0, -4);
    ctx.font = `700 18px ${F}`; ctx.fillText('망부석 협회', 0, 26);
    ctx.restore();
  }
  ctx.textAlign = 'center'; ctx.fillStyle = dark ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.45)'; ctx.font = `600 22px ${F}`;
  ctx.fillText('본격 망부석 프로젝트 · km-crew.github.io/stay-still-challenge', W / 2, H - 84);
  return canvas;
}

/* ---------- 이탈 경고: 소리·진동 ---------- */
const Alarm = {
  count: 0,
  beep(zone) {
    if (!cfg.alarm) return;
    const ctx = Sfx.ensure();
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime + .01;
      const seq = zone >= 2 ? [[1250, 0, .09], [1250, .14, .09], [1250, .28, .09]] : [[880, 0, .12]];
      for (const [f, at, dur] of seq) {
        const o = ctx.createOscillator(), gn = ctx.createGain();
        o.type = 'square'; o.frequency.setValueAtTime(f, t0 + at);
        gn.gain.setValueAtTime(0.0001, t0 + at);
        gn.gain.exponentialRampToValueAtTime(zone >= 2 ? .12 : .07, t0 + at + .01);
        gn.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
        o.connect(gn).connect(ctx.destination); o.start(t0 + at); o.stop(t0 + at + dur + .02);
      }
      this.count++;
    } catch (e) { /* 소리 실패는 무시 */ }
  },
  buzz(p) { if (cfg.vib) vibrate(p); }
};

/* ---------- 랜딩 ---------- */
Router.on('/', root => {
  const best = store.get('ss-records', []).reduce((m, r) => Math.max(m, r.sec), 0);
  const wrap = h('<div class="split center"></div>');
  root.append(wrap);
  wrap.append(h(`
    <section class="hero">
      <div class="stone-demo" id="morph">${stoneSVG(0)}</div>
      <h1>한 자리에서<br>얼마나 버틸 수 있나요?</h1>
      <p class="muted">GPS로 자리를 고정하고 타이머를 켜요. 정해진 반경을 벗어나는 순간 끝. 오래 버틸수록 진짜 돌이 됩니다.</p>
      <div class="badges small"><span>🗿 점점 돌이 되는 나</span><span>📳 이탈 경고음·진동</span><span>🏅 칭호 카드</span><span>⏩ 체험 모드 최대 600배속</span></div>
      <a class="btn primary big block" href="#/ready">챌린지 시작</a>
      ${best ? `<p class="muted small">내 최고 기록 ${fmtKo(best)} · ${rankOf(best).name}</p>` : ''}
    </section>`));
  const right = h('<div class="stack"></div>');
  wrap.append(right);
  right.append(h(`
    <section class="card">
      <b>칭호 단계</b>
      <div class="ranks">${RANKS.slice(1).map((r, i) => `<div><span class="mini">${stoneSVG((i + 1) / (RANKS.length - 1))}</span><b>${r.name}</b><em>${fmtKo(r.t)}</em></div>`).join('')}</div>
    </section>`));
  right.append(h(`<ol class="rules small muted"><li>화면을 켜 둔 채로 버텨요 (다른 앱으로 가면 일시정지)</li><li>경계선에 다가가면 삐― 경고, 반경 밖으로 나가면 실격</li><li>실내에서는 GPS가 흔들릴 수 있어요</li></ol>`));
  // 사람 → 돌 변신 미리보기(동작 줄이기면 멈춤)
  let t = 0, timer = 0;
  if (!Motion.reduced) timer = setInterval(() => { t = (t + 1) % 40; const lv = t < 30 ? t / 29 : 1; $('#morph').innerHTML = stoneSVG(t >= 36 ? 0 : lv); }, 160);
  return () => clearInterval(timer);
});

/* ---------- 준비 ---------- */
Router.on('/ready', root => {
  root.append(h(`
    <section class="stack">
      <h1>준비</h1>
      <div class="card">
        <div class="row"><b>GPS 상태</b><span class="grow"></span><span id="acc" class="muted">확인 중…</span></div>
        <div class="bar" style="margin-top:10px"><i id="accbar" style="width:0%"></i></div>
      </div>
      <div><label class="field">허용 반경 (GPS 오차를 생각해 넉넉하게)</label>
        <div class="row" id="rad">${[20, 30, 50].map(r => `<button class="chip ${cfg.radius === r ? 'on' : ''}" data-r="${r}" aria-pressed="${cfg.radius === r}">${r}m</button>`).join('')}</div></div>
      <div class="card stack opts">
        <b>이탈 경고</b>
        <label class="row small"><input type="checkbox" id="alarm" ${cfg.alarm ? 'checked' : ''}> <span>🔔 경고음 — 경계선에 다가가면 삐, 밖으로 나가면 삐삐삐</span></label>
        <label class="row small"><input type="checkbox" id="vib" ${cfg.vib ? 'checked' : ''}> <span>📳 진동 — 지원하는 휴대폰에서만</span></label>
        <button class="btn small" id="testalarm" type="button">경고 미리 듣기</button>
      </div>
      <div class="card stack">
        <label class="row small"><input type="checkbox" id="demo" ${cfg.demo ? 'checked' : ''}> <span><b>체험 모드</b> — GPS 없이 PC에서 미리 보기. 레이더의 점을 끌거나 방향키로 움직여 볼 수 있어요 (기록에는 안 남음)</span></label>
        <div class="row ${cfg.demo ? '' : 'hidden'}" id="speeds"><span class="small muted">빠르기</span>${[30, 120, 600].map(s => `<button class="chip ${cfg.speed === s ? 'on' : ''}" data-s="${s}" aria-pressed="${cfg.speed === s}">${s}배</button>`).join('')}</div>
      </div>
      <div class="notice">📱 화면이 꺼지지 않게 해 둘게요. 다른 앱으로 가면 타이머가 멈추고, 돌아오면 이어서 할 수 있어요.</div>
      <button class="btn primary big block" id="go">여기서 버틴다</button>
    </section>`));
  let watch = null;
  if (navigator.geolocation) {
    watch = navigator.geolocation.watchPosition(p => {
      const a = Math.round(p.coords.accuracy);
      $('#acc').textContent = `오차 약 ${a}m ${a <= 20 ? '· 아주 좋음' : a <= 50 ? '· 쓸 만함' : '· 불안정(실외 권장)'}`;
      $('#accbar').style.width = clamp(100 - a, 5, 100) + '%';
    }, e => { $('#acc').textContent = e.code === 1 ? '위치 권한이 거부됐어요 · 체험 모드로 미리 볼 수 있어요' : 'GPS를 못 잡고 있어요'; }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  } else $('#acc').textContent = '이 기기는 위치를 지원하지 않아요 · 체험 모드로 미리 볼 수 있어요';
  const chips = (sel, key, attr) => $$(sel).forEach(b => b.onclick = () => {
    cfg[key] = Number(b.dataset[attr]); saveCfg();
    $$(sel).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
  });
  chips('#rad .chip', 'radius', 'r');
  chips('#speeds .chip', 'speed', 's');
  $('#demo').onchange = e => { cfg.demo = e.target.checked; saveCfg(); $('#speeds').classList.toggle('hidden', !cfg.demo); };
  $('#alarm').onchange = e => { cfg.alarm = e.target.checked; saveCfg(); };
  $('#vib').onchange = e => { cfg.vib = e.target.checked; saveCfg(); };
  $('#testalarm').onclick = () => {
    if (!cfg.alarm && !cfg.vib) { toast('경고음과 진동이 모두 꺼져 있어요'); return; }
    Alarm.beep(1); Alarm.buzz(60);
    setTimeout(() => { Alarm.beep(2); Alarm.buzz([120, 60, 120]); }, 700);
  };
  $('#go').onclick = () => { Sfx.ensure(); Router.go('/challenge'); };   // 누르는 순간 소리 장치를 깨워 둠
  return () => { if (watch != null) navigator.geolocation.clearWatch(watch); };
});

/* ---------- 도전 ---------- */
Router.on('/challenge', root => {
  const R = cfg.radius, demo = cfg.demo, speed = demo ? cfg.speed : 1;
  root.append(h(`
    <section class="stack ch">
      <div class="rankline"><span id="ricon">·</span> <b id="rname">모래알</b>${demo ? ` <span class="demotag">체험 ${speed}배속</span>` : ''}</div>
      <div class="split center"><div>
      <div class="figwrap" id="fig">${stoneSVG(0, { label: '돌이 되어 가는 나: 0%' })}</div>
      <div class="timer" id="time">0:00</div>
      <div class="muted small center" id="nextr"></div>
      <div class="stonebar" aria-hidden="true"><i id="stonebar"></i></div>
      <div class="muted small" id="stonepct">돌이 된 정도 0%</div>
      </div><div>
      <div class="radar${demo ? ' draggable' : ''}"><svg viewBox="-110 -110 220 220" id="radar" ${demo ? 'aria-label="레이더: 점을 끌어 움직이기"' : 'aria-hidden="true"'}>
        <circle r="100" class="zone"/><circle r="70" class="warnline"/><circle r="4" class="anchor"/>
        <circle id="me" r="8" class="me"/></svg>
        <div class="dist" id="dist">위치 잡는 중…</div>
        <div class="outs" id="outs" aria-live="polite"></div></div>
      ${demo ? '<p class="small muted">점을 끌거나 방향키(←↑→↓)로 움직여 보세요 · 0 키는 제자리</p>' : ''}
      </div></div>
      <div class="warn hidden" id="warn" role="alert">⚠️ 경계선 근처예요! 움직이지 마세요</div>
      ${demo ? `<div class="row wrap demo-ctl"><button class="btn grow" id="wiggle">살짝 움직이기</button><button class="btn grow" id="walk">걸어 나가기</button><button class="btn grow" id="home">제자리로</button><button class="btn grow" id="skip">다음 칭호로 ⏩</button></div>` : ''}
      <button class="btn ghost block" id="quit">포기하기</button>
      <div class="pause hidden" id="pause"><div class="card center stack"><b>일시정지</b><p class="muted">화면을 벗어나서 타이머가 멈췄어요.</p><button class="btn primary block" id="resume">이어서 버티기</button></div></div>
    </section>`));
  let anchor = null, elapsed = 0, lastTick = performance.now(), running = true, paused = false;
  let outCount = 0, watch = null, wake = null, raf = 0, sim = null, simTimer = 0, zone = 0, lastAlarm = 0, lastLevel = -1;
  const reqWake = async () => { try { wake = await navigator.wakeLock?.request('screen'); } catch (e) { wake = null; } };
  reqWake();

  function end(reason) {
    if (!running) return;
    running = false;
    Alarm.buzz([200, 100, 200]); Sfx.play('bad');
    lastResult = { sec: elapsed, reason, demo, radius: R, at: Date.now(), speed };
    store.sset('ss-last', lastResult);
    if (!demo && elapsed >= 5) {
      const recs = store.get('ss-records', []);
      recs.unshift({ sec: Math.floor(elapsed), at: Date.now(), radius: R });
      store.set('ss-records', recs.slice(0, 50));
    }
    Router.go('/result');
  }
  function setZone(z) {
    const now = performance.now();
    if (z !== zone) lastAlarm = 0;
    zone = z;
    const w = $('#warn');
    w.classList.toggle('hidden', z === 0);
    w.classList.toggle('out', z === 2);
    w.textContent = z === 2 ? `🚨 반경 밖이에요! 바로 돌아오세요 (${outCount}/3)` : '⚠️ 경계선 근처예요! 움직이지 마세요';
    $('#fig').classList.toggle('shake', z > 0);
    $('#outs').textContent = z === 2 ? `이탈 ${outCount}/3 · 3번 연속이면 실격` : '';
    if (z && now - lastAlarm >= (z === 2 ? 600 : 1500)) {
      lastAlarm = now;
      Alarm.beep(z); Alarm.buzz(z === 2 ? [120, 60, 120] : 60);
    }
  }
  function onPos(lat, lon, acc) {
    if (!running) return;
    if (!anchor) {
      if (acc > Math.max(R * 2, 60)) { $('#dist').textContent = `정확도 기다리는 중… (오차 ${Math.round(acc)}m)`; return; }
      anchor = { lat, lon }; lastTick = performance.now(); vibrate(40); return;
    }
    if (acc > R * 2) return;                 // 흔들린 측정값은 무시
    const d = dist(anchor, { lat, lon });
    const k = Math.min(d / R, 1.1) * 100;
    const ang = Math.atan2(lat - anchor.lat, (lon - anchor.lon) * Math.cos(anchor.lat * Math.PI / 180));
    $('#me').setAttribute('cx', (Math.cos(ang) * k).toFixed(1));
    $('#me').setAttribute('cy', (-Math.sin(ang) * k).toFixed(1));
    $('#dist').textContent = `기준점에서 ${d.toFixed(1)}m / ${R}m`;
    if (d > R) { outCount++; setZone(2); if (outCount >= 3) end('반경을 벗어났어요'); }
    else { outCount = 0; setZone(d >= R * .7 ? 1 : 0); }
  }
  if (demo) {
    // 체험: 기준점에서 얼마나 떨어졌는지(미터)를 직접 조종
    sim = { lat: 35.8468, lon: 127.1294, x: 0, y: 0, decay: false };
    const send = () => {
      const j = () => (Math.random() - .5) * 2;          // GPS 흔들림 ±1m
      const mLat = 111320, mLon = 111320 * Math.cos(sim.lat * Math.PI / 180);
      onPos(sim.lat + (sim.y + j()) / mLat, sim.lon + (sim.x + j()) / mLon, 5);
    };
    const setOff = (x, y, decay = false) => {
      const m = Math.hypot(x, y), lim = R * 2.2;
      if (m > lim) { x *= lim / m; y *= lim / m; }
      sim.x = x; sim.y = y; sim.decay = decay; send();
    };
    onPos(sim.lat, sim.lon, 5);
    const rnd = () => Math.random() * Math.PI * 2;
    $('#wiggle').onclick = () => { const a = rnd(); setOff(Math.cos(a) * R * .8, Math.sin(a) * R * .8, true); };
    $('#walk').onclick = () => { const a = rnd(); setOff(Math.cos(a) * R * 2, Math.sin(a) * R * 2); };
    $('#home').onclick = () => setOff(0, 0);
    $('#skip').onclick = () => { const n = nextRank(elapsed); if (n) { elapsed = Math.max(elapsed, n.t - 2); toast(`${n.name} 직전으로 건너뛰었어요`); } };
    // 레이더 끌기
    const svg = $('#radar');
    let drag = false;
    const toOff = e => {
      const b = svg.getBoundingClientRect();
      const ux = ((e.clientX - b.left) / b.width) * 220 - 110, uy = ((e.clientY - b.top) / b.height) * 220 - 110;
      setOff(ux / 100 * R, -uy / 100 * R);
    };
    svg.addEventListener('pointerdown', e => { drag = true; try { svg.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ } toOff(e); e.preventDefault(); });
    svg.addEventListener('pointermove', e => { if (drag) toOff(e); });
    const up = () => { drag = false; };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    var onKey = e => {
      if (e.target.closest && e.target.closest('input,textarea,select')) return;
      const st = R * .1, mv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key];
      if (mv) { e.preventDefault(); setOff(sim.x + mv[0], sim.y + mv[1]); }
      else if (e.key === '0') setOff(0, 0);
    };
    document.addEventListener('keydown', onKey);
    simTimer = setInterval(() => {
      if (sim.decay) {
        const m = Math.hypot(sim.x, sim.y);
        if (m <= 4) { sim.x = sim.y = 0; sim.decay = false; } else { sim.x *= (m - 4) / m; sim.y *= (m - 4) / m; }
      }
      send();
    }, 700);
  } else if (navigator.geolocation) {
    watch = navigator.geolocation.watchPosition(p => onPos(p.coords.latitude, p.coords.longitude, p.coords.accuracy),
      e => { if (e.code === 1) end('위치 권한이 없어요'); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  } else end('위치를 지원하지 않는 기기예요');

  function tick(now) {
    const dt = Math.max(0, (now - lastTick) / 1000); lastTick = Math.max(now, lastTick);   // 프레임 시각이 기준보다 앞서면 음수 시간이 되던 문제 방지
    if (running && anchor && !paused) elapsed += dt * speed;
    $('#time').textContent = fmt(elapsed);
    const r = rankOf(elapsed), n = nextRank(elapsed);
    if ($('#rname').textContent !== r.name) {
      $('#rname').textContent = r.name; $('#ricon').textContent = r.icon;
      if (elapsed > 1) {
        Alarm.buzz(80); Sfx.play('win'); toast(`칭호 획득: ${r.name}`);
        const f = $('#fig'); f.classList.remove('rankup'); void f.offsetWidth; f.classList.add('rankup');
      }
    }
    $('#nextr').textContent = n ? `${n.name}까지 ${fmtKo(n.t - elapsed)}` : '최고 칭호 달성!';
    const lv = stoneLevel(elapsed), pct = Math.floor(lv * 100);
    if (pct !== lastLevel) {
      lastLevel = pct;
      $('#fig').innerHTML = stoneSVG(lv, { label: `돌이 되어 가는 나: ${pct}%` });
      $('#stonebar').style.width = pct + '%';
      $('#stonepct').textContent = `돌이 된 정도 ${pct}%`;
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  const vis = () => {
    if (document.hidden) { paused = true; $('#pause').classList.remove('hidden'); }
    else reqWake();
  };
  document.addEventListener('visibilitychange', vis);
  $('#resume').onclick = () => { paused = false; lastTick = performance.now(); $('#pause').classList.add('hidden'); };
  $('#quit').onclick = () => { if (confirm('정말 포기할까요?')) end('스스로 포기했어요'); };
  return () => {
    running = false; cancelAnimationFrame(raf);
    if (watch != null) navigator.geolocation.clearWatch(watch);
    clearInterval(simTimer);
    if (typeof onKey === 'function') document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', vis);
    try { wake && wake.release(); } catch (e) { /* 무시 */ }
  };
});

/* ---------- 결과 ---------- */
Router.on('/result', root => {
  if (!lastResult) { Router.go('/'); return; }
  const r = rankOf(lastResult.sec), n = nextRank(lastResult.sec);
  const alt = `${lastResult.demo ? '체험 모드 ' : ''}칭호 카드: ${r.name}, ${fmtKo(lastResult.sec)}, ${lastResult.reason}, 반경 ${lastResult.radius}m`;
  root.append(h(`
    <section class="split s37 center">
      <div class="cardbox"><canvas id="card" class="titlecard" width="900" height="1200" role="img" aria-label="${esc(alt)}"></canvas></div>
      <div class="stack">
        <h1 class="rtitle">"${r.name}" 칭호를 얻었어요</h1>
        <p class="muted">${esc(lastResult.reason)} · 버틴 시간 ${fmtKo(lastResult.sec)}</p>
        ${n ? `<p>${n.name}까지 ${fmtKo(n.t - lastResult.sec)} 남았었어요</p>` : '<p>더 오를 곳이 없어요. 당신이 전설입니다.</p>'}
        ${lastResult.demo ? '<p class="notice">체험 모드 기록이라 내 기록에는 남지 않아요.</p>' : ''}
        <div class="row"><button class="btn primary grow" id="save">칭호 카드 저장</button><button class="btn grow" id="share">자랑하기</button></div>
        <a class="btn big block" href="#/ready">다시 도전</a>
        <a class="btn ghost block" href="#/records">내 기록·칭호 도감</a>
      </div>
    </section>`));
  const cv = $('#card');
  const ready = drawCard(cv, lastResult).catch(e => { console.error(e); return null; });
  $('#save').onclick = async () => { await ready; saveImage(cv, `mangbuseok-${r.name}.png`); };
  $('#share').onclick = () => shareText('본격 망부석 프로젝트', `나 한 자리에서 ${fmtKo(lastResult.sec)} 버텨서 "${r.name}" 됨. 너는?`, location.href.split('#')[0]);
});

/* ---------- 내 기록 ---------- */
Router.on('/records', root => {
  const recs = store.get('ss-records', []);
  const best = recs.reduce((m, r) => Math.max(m, r.sec), 0), bi = rankIndex(best);
  root.append(h(`
    <section class="stack">
      <h1>내 기록</h1>
      <div class="card"><div class="row"><b>칭호 도감</b><span class="grow"></span><span class="small muted">${bi}/${RANKS.length - 1} 모음</span></div>
        <div class="dex">${RANKS.slice(1).map((r, i) => {
          const got = best >= r.t;
          return `<div class="${got ? 'got' : 'lock'}"><span class="mini">${stoneSVG((i + 1) / (RANKS.length - 1))}</span><b>${got ? r.name : '???'}</b><em>${got ? '획득' : `🔒 ${fmtKo(r.t)}`}</em></div>`;
        }).join('')}</div></div>
      ${recs.length ? `
        <div class="card center"><div class="muted small">최고 기록</div><div class="rtime">${fmtKo(best)}</div><div class="rname">${rankOf(best).name}</div></div>
        <div class="card"><ol class="hist">${recs.map(r => `<li><span>${new Date(r.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span><b>${fmtKo(r.sec)}</b><em>${rankOf(r.sec).name}</em></li>`).join('')}</ol></div>
        <button class="btn ghost block" id="clear">기록 지우기</button>` : '<p class="muted">아직 기록이 없어요. (체험 모드 기록은 남지 않아요)</p>'}
      <a class="btn primary block" href="#/ready">도전하기</a>
      <p class="muted small center">전국 랭킹은 다음 버전에서 추가할 예정이에요.</p>
    </section>`));
  const c = $('#clear');
  if (c) c.onclick = () => { if (confirm('기록을 모두 지울까요?')) { store.set('ss-records', []); Router.go('/'); } };
});

Router.start($('#app'));
