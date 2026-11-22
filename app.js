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
const rankOf = s => RANKS.filter(r => s >= r.t).pop();
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

const cfg = store.sget('ss-cfg', { radius: 30, demo: false });
let lastResult = store.sget('ss-last', null);

/* ---------- 랜딩 ---------- */
Router.on('/', root => {
  const best = store.get('ss-records', []).reduce((m, r) => Math.max(m, r.sec), 0);
  const wrap = h('<div class="split center"></div>');
  root.append(wrap);
  wrap.append(h(`
    <section class="hero">
      <div class="stone">🗿</div>
      <h1>한 자리에서<br>얼마나 버틸 수 있나요?</h1>
      <p class="muted">GPS로 자리를 고정하고 타이머를 켜요. 정해진 반경을 벗어나는 순간 끝. 오래 버틸수록 돌이 됩니다.</p>
      <a class="btn primary big block" href="#/ready">챌린지 시작</a>
      ${best ? `<p class="muted small">내 최고 기록 ${fmtKo(best)} · ${rankOf(best).name}</p>` : ''}
    </section>`));
  const right = h('<div class="stack"></div>');
  wrap.append(right);
  right.append(h(`
    <section class="card">
      <b>칭호 단계</b>
      <div class="ranks">${RANKS.slice(1).map(r => `<div><span>${r.icon}</span><b>${r.name}</b><em>${fmtKo(r.t)}</em></div>`).join('')}</div>
    </section>`));
  right.append(h(`<ol class="rules small muted"><li>화면을 켜 둔 채로 버텨요 (다른 앱으로 가면 일시정지)</li><li>반경 밖으로 나가면 실격</li><li>실내에서는 GPS가 흔들릴 수 있어요</li></ol>`));
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
        <div class="row" id="rad">${[20, 30, 50].map(r => `<button class="chip ${cfg.radius === r ? 'on' : ''}" data-r="${r}">${r}m</button>`).join('')}</div></div>
      <label class="row small card"><input type="checkbox" id="demo" ${cfg.demo ? 'checked' : ''}> <span><b>체험 모드</b> — GPS 없이, 시간이 30배 빠르게 흘러요 (PC에서 미리 보기용, 기록에는 안 남음)</span></label>
      <div class="notice">📱 화면이 꺼지지 않게 해 둘게요. 다른 앱으로 가면 타이머가 멈추고, 돌아오면 이어서 할 수 있어요.</div>
      <button class="btn primary big block" id="go">여기서 버틴다</button>
    </section>`));
  let watch = null;
  if (navigator.geolocation) {
    watch = navigator.geolocation.watchPosition(p => {
      const a = Math.round(p.coords.accuracy);
      $('#acc').textContent = `오차 약 ${a}m ${a <= 20 ? '· 아주 좋음' : a <= 50 ? '· 쓸 만함' : '· 불안정(실외 권장)'}`;
      $('#accbar').style.width = clamp(100 - a, 5, 100) + '%';
    }, e => { $('#acc').textContent = e.code === 1 ? '위치 권한이 거부됐어요' : 'GPS를 못 잡고 있어요'; }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  } else $('#acc').textContent = '이 기기는 위치를 지원하지 않아요';
  $$('#rad .chip').forEach(b => b.onclick = () => { cfg.radius = Number(b.dataset.r); store.sset('ss-cfg', cfg); $$('#rad .chip').forEach(x => x.classList.toggle('on', x === b)); });
  $('#demo').onchange = e => { cfg.demo = e.target.checked; store.sset('ss-cfg', cfg); };
  $('#go').onclick = () => Router.go('/challenge');
  return () => { if (watch != null) navigator.geolocation.clearWatch(watch); };
});

/* ---------- 도전 ---------- */
Router.on('/challenge', root => {
  const R = cfg.radius, demo = cfg.demo, speed = demo ? 30 : 1;
  root.append(h(`
    <section class="stack ch">
      <div class="rankline"><span id="ricon">·</span> <b id="rname">모래알</b></div>
      <div class="split center"><div>
      <div class="timer" id="time">0:00</div>
      <div class="muted small center" id="nextr"></div>
      </div><div>
      <div class="radar"><svg viewBox="-110 -110 220 220">
        <circle r="100" class="zone"/><circle r="70" class="warnline"/><circle r="4" class="anchor"/>
        <circle id="me" r="8" class="me"/></svg>
        <div class="dist" id="dist">위치 잡는 중…</div></div></div></div>
      <div class="warn hidden" id="warn">⚠️ 경계선 근처예요! 움직이지 마세요</div>
      ${demo ? '<div class="row"><button class="btn grow" id="wiggle">살짝 움직이기</button><button class="btn grow" id="walk">걸어 나가기</button></div>' : ''}
      <button class="btn ghost block" id="quit">포기하기</button>
      <div class="pause hidden" id="pause"><div class="card center stack"><b>일시정지</b><p class="muted">화면을 벗어나서 타이머가 멈췄어요.</p><button class="btn primary block" id="resume">이어서 버티기</button></div></div>
    </section>`));
  let anchor = null, elapsed = 0, lastTick = performance.now(), running = true, paused = false;
  let outCount = 0, watch = null, wake = null, raf = 0, simPos = null;
  const reqWake = async () => { try { wake = await navigator.wakeLock?.request('screen'); } catch (e) { wake = null; } };
  reqWake();

  function end(reason) {
    if (!running) return;
    running = false;
    vibrate([200, 100, 200]); Sfx.play('bad');
    lastResult = { sec: elapsed, reason, demo, radius: R, at: Date.now() };
    store.sset('ss-last', lastResult);
    if (!demo && elapsed >= 5) {
      const recs = store.get('ss-records', []);
      recs.unshift({ sec: Math.floor(elapsed), at: Date.now(), radius: R });
      store.set('ss-records', recs.slice(0, 50));
    }
    Router.go('/result');
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
    const ang = Math.atan2(lat - anchor.lat, lon - anchor.lon);
    $('#me').setAttribute('cx', (Math.cos(ang) * k).toFixed(1));
    $('#me').setAttribute('cy', (-Math.sin(ang) * k).toFixed(1));
    $('#dist').textContent = `기준점에서 ${d.toFixed(1)}m / ${R}m`;
    $('#warn').classList.toggle('hidden', d < R * .7);
    if (d > R) { if (++outCount >= 3) end('반경을 벗어났어요'); }
    else outCount = 0;
  }
  if (demo) {
    simPos = { lat: 35.8468, lon: 127.1294, drift: 0 };
    onPos(simPos.lat, simPos.lon, 5);
    const step = m => { simPos.drift = m; };
    $('#wiggle').onclick = () => step(R * .8);
    $('#walk').onclick = () => step(R * 2);
    var simTimer = setInterval(() => {
      const d = simPos.drift + Math.random() * 3;
      const ang = Math.random() * Math.PI * 2;
      onPos(simPos.lat + d * Math.sin(ang) / 111320, simPos.lon + d * Math.cos(ang) / (111320 * Math.cos(simPos.lat * Math.PI / 180)), 5);
      if (simPos.drift && simPos.drift < R) simPos.drift = Math.max(0, simPos.drift - 4);
    }, 700);
  } else if (navigator.geolocation) {
    watch = navigator.geolocation.watchPosition(p => onPos(p.coords.latitude, p.coords.longitude, p.coords.accuracy),
      e => { if (e.code === 1) end('위치 권한이 없어요'); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  } else end('위치를 지원하지 않는 기기예요');

  function tick(now) {
    const dt = (now - lastTick) / 1000; lastTick = now;
    if (running && anchor && !paused) elapsed += dt * speed;
    $('#time').textContent = fmt(elapsed);
    const r = rankOf(elapsed), n = nextRank(elapsed);
    if ($('#rname').textContent !== r.name) { $('#rname').textContent = r.name; $('#ricon').textContent = r.icon; if (elapsed > 1) { vibrate(80); Sfx.play('win'); toast(`칭호 획득: ${r.name}`); } }
    $('#nextr').textContent = n ? `${n.name}까지 ${fmtKo(n.t - elapsed)}` : '최고 칭호 달성!';
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
    if (typeof simTimer !== 'undefined') clearInterval(simTimer);
    document.removeEventListener('visibilitychange', vis);
    try { wake && wake.release(); } catch (e) { /* 무시 */ }
  };
});

/* ---------- 결과 ---------- */
Router.on('/result', root => {
  if (!lastResult) { Router.go('/'); return; }
  const r = rankOf(lastResult.sec), n = nextRank(lastResult.sec);
  root.append(h(`
    <section class="stack">
      <div class="card resultcard" id="card">
        <div class="big-icon">${r.icon === '·' ? '🫥' : r.icon}</div>
        <div class="muted small">${lastResult.demo ? '체험 모드 기록' : '나의 망부석 기록'}</div>
        <div class="rtime">${fmtKo(lastResult.sec)}</div>
        <div class="rname">"${r.name}"</div>
        <p class="muted">${esc(lastResult.reason)} · 반경 ${lastResult.radius}m</p>
        ${n ? `<p>${n.name}까지 ${fmtKo(n.t - lastResult.sec)} 남았었어요</p>` : '<p>더 오를 곳이 없어요. 당신이 전설입니다.</p>'}
        <div class="stamp">본격 망부석 프로젝트</div>
      </div>
      <div class="row"><button class="btn primary grow" id="save">기록 카드 저장</button><button class="btn grow" id="share">자랑하기</button></div>
      <a class="btn big block" href="#/ready">다시 도전</a>
      <a class="btn ghost block" href="#/records">내 기록 보기</a>
    </section>`));
  $('#save').onclick = () => saveImage($('#card'), 'mangbuseok.png');
  $('#share').onclick = () => shareText('본격 망부석 프로젝트', `나 한 자리에서 ${fmtKo(lastResult.sec)} 버텨서 "${r.name}" 됨. 너는?`, location.href.split('#')[0]);
});

/* ---------- 내 기록 ---------- */
Router.on('/records', root => {
  const recs = store.get('ss-records', []);
  const best = recs.reduce((m, r) => Math.max(m, r.sec), 0);
  root.append(h(`
    <section class="stack">
      <h1>내 기록</h1>
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
