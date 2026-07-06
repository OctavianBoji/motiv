'use strict';

/* ============================================================
   Motiv — your saved videos as a motivation playlist
   Vanilla JS PWA. Tracks + playlists live in IndexedDB.
   Playback: <audio> element (background-capable on iOS) and a
   <video> element sharing the same blob for the Video mode.
   ============================================================ */

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now());
const fmtDur = s => {
  s = Math.round(s || 0);
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
};
const fmtWhen = ts => {
  const d = new Date(ts), n = new Date();
  const sd = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const sn = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const diff = Math.round((sn - sd) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const hashStr = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const cleanName = n => (n || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled audio';

/* ---------- icons ---------- */
const I = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.3v13.4l10.5-6.7L8 5.3Z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h3.4v14H7V5Zm6.6 0H17v14h-3.4V5Z" fill="currentColor"/></svg>',
  playO: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9.2" stroke="currentColor" stroke-width="1.6"/><path d="M10 8.7v6.6l5.2-3.3L10 8.7Z" fill="currentColor"/></svg>',
  pauseO: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9.2" stroke="currentColor" stroke-width="1.6"/><path d="M9.7 8.6h1.9v6.8H9.7V8.6Zm2.7 0h1.9v6.8h-1.9V8.6Z" fill="currentColor"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7m-7.5 0 .8 11.2A1.8 1.8 0 0 0 9.1 20h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none"><path d="m14.5 5.5 4 4L8 20H4v-4L14.5 5.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m12.5 7.5 4 4" stroke="currentColor" stroke-width="1.7"/></svg>',
  addPl: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 6.5h11M4 11.5h11M4 16.5h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M17.5 13v7M14 16.5h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  minusPl: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 6.5h11M4 11.5h11M4 16.5h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M14 16.5h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  chevL: '<svg viewBox="0 0 24 24" fill="none"><path d="M14.5 6 8.5 12l6 6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" fill="none"><path d="m9.5 6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  shuffleSm: '<svg viewBox="0 0 24 24" fill="none"><path d="M3.5 7h2.6c1.5 0 2.9.7 3.8 1.9l4.2 6.2c.9 1.2 2.3 1.9 3.8 1.9h2.6M3.5 17h2.6c1.5 0 2.9-.7 3.8-1.9l.7-1M14.1 8.9l.7-1c.9-1.2 2.3-1.9 3.8-1.9h1.9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M18 4l2.5 2-2.5 2M18 15l2.5 2-2.5 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none"><path d="M9.5 17.5V6.2l9-2v11.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="17.5" r="2.5" stroke="currentColor" stroke-width="1.7"/><circle cx="16" cy="15.5" r="2.5" stroke="currentColor" stroke-width="1.7"/></svg>',
};

/* ---------- IndexedDB ---------- */
let _db;
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('motiv-db', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('tracks')) d.createObjectStore('tracks', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('playlists')) d.createObjectStore('playlists', { keyPath: 'id' });
    };
    r.onsuccess = () => res(_db = r.result);
    r.onerror = () => rej(r.error);
  });
}
const store = (name, mode = 'readonly') => _db.transaction(name, mode).objectStore(name);
const dbAll = name => new Promise((res, rej) => { const r = store(name).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const dbPut = (name, val) => new Promise((res, rej) => { const r = store(name, 'readwrite').put(val); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
const dbDel = (name, key) => new Promise((res, rej) => { const r = store(name, 'readwrite').delete(key); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });

/* ---------- state ---------- */
let tracks = [];      // {id,title,addedAt,duration,thumb,kind,blob}
let playlists = [];   // {id,name,createdAt,trackIds:[]}
let currentView = 'home';
let currentPlaylistId = null;
let lastSearchIds = [];

let queue = [], baseQueue = [], qi = -1;
let ctxName = '';
let mode = 'audio';           // 'audio' | 'video'
let shuffle = false;
let repeat = 'off';           // 'off' | 'all' | 'one'
let curUrl = null;
let sheetCtx = null;
let toastTimer = null;

/* ---------- elements ---------- */
const audioEl = $('#audioEl');
const videoEl = $('#videoEl');
const playerEl = $('#player');
const miniEl = $('#mini');
const seekEl = $('#seek');

const activeEl = () => (mode === 'video' ? videoEl : audioEl);
const inactiveEl = () => (mode === 'video' ? audioEl : videoEl);
const nowId = () => (qi >= 0 && qi < queue.length ? queue[qi] : null);
const curTrack = () => tracks.find(t => t.id === nowId()) || null;
const trackById = id => tracks.find(t => t.id === id);
const plById = id => playlists.find(p => p.id === id);
const isPlaying = () => { const el = activeEl(); return !!(el && el.src && !el.paused && !el.ended); };

/* ---------- generated cover art ---------- */
const PALETTES = [
  ['#0e7c3f', '#2eb868'], ['#123b2a', '#0e7c3f'], ['#1b5e20', '#66bb6a'],
  ['#0a5e30', '#35a06a'], ['#14532d', '#16a34a'], ['#052e16', '#15803d'],
];
function gradThumb(seed) {
  const c = document.createElement('canvas');
  c.width = c.height = 400;
  const g = c.getContext('2d');
  const [a, b] = PALETTES[hashStr(seed) % PALETTES.length];
  const gr = g.createLinearGradient(0, 0, 400, 400);
  gr.addColorStop(0, a); gr.addColorStop(1, b);
  g.fillStyle = gr; g.fillRect(0, 0, 400, 400);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath(); g.moveTo(160, 130); g.lineTo(160, 270); g.lineTo(280, 200); g.closePath(); g.fill();
  return c.toDataURL('image/jpeg', 0.8);
}

/* ---------- data ---------- */
function sortData() {
  tracks.sort((a, b) => b.addedAt - a.addedAt);
  playlists.sort((a, b) => a.createdAt - b.createdAt);
}
function playlistTracks(pl) {
  return pl.trackIds.map(trackById).filter(Boolean);
}
function ctxList(ctx) {
  if (ctx === 'recent' || ctx === 'all') return tracks.map(t => t.id);
  if (ctx === 'search') return [...lastSearchIds];
  if (ctx.startsWith('pl:')) {
    const pl = plById(ctx.slice(3));
    return pl ? pl.trackIds.filter(trackById) : [];
  }
  return tracks.map(t => t.id);
}
function ctxLabel(ctx) {
  if (ctx === 'recent') return 'Recently added';
  if (ctx === 'all') return 'All audios';
  if (ctx === 'search') return 'Search results';
  if (ctx.startsWith('pl:')) { const pl = plById(ctx.slice(3)); return pl ? pl.name : 'Playlist'; }
  return 'Library';
}

/* ============================================================
   RENDERING
   ============================================================ */
function trackRow(t, ctx) {
  const playing = t.id === nowId();
  const btn = playing && isPlaying() ? I.pauseO : I.playO;
  return `<div class="row${playing ? ' playing' : ''}" data-action="play" data-id="${t.id}" data-ctx="${ctx}">
    <img class="row-thumb" src="${t.thumb}" alt="">
    <div class="row-body">
      <div class="row-title">${esc(t.title)}</div>
      <div class="row-meta">${fmtWhen(t.addedAt)} &middot; ${fmtDur(t.duration)}</div>
    </div>
    <button class="icon-btn row-menu" data-action="menu" data-id="${t.id}" data-ctx="${ctx}" aria-label="Options">${I.dots}</button>
    <button class="icon-btn row-play" data-action="play" data-id="${t.id}" data-ctx="${ctx}" aria-label="Play">${btn}</button>
  </div>`;
}

function plCoverHtml(pl, small) {
  const list = playlistTracks(pl);
  const cls = `pl-cover${small ? ' small' : ''}`;
  if (list.length && list[0].thumb) return `<div class="${cls}"><img src="${list[0].thumb}" alt=""></div>`;
  return `<div class="${cls} g${hashStr(pl.id) % 6}"><span class="initial">${esc((pl.name || 'P')[0].toUpperCase())}</span></div>`;
}

function plCard(pl) {
  const n = pl.trackIds.filter(trackById).length;
  return `<div class="pl-card" data-action="open-pl" data-id="${pl.id}">
    ${plCoverHtml(pl)}
    <div class="pl-name">${esc(pl.name)}</div>
    <div class="pl-count">${n} audio${n === 1 ? '' : 's'}</div>
  </div>`;
}

function renderHome() {
  const v = $('#view-home');
  if (!tracks.length) {
    v.innerHTML = `<div class="hero">
      <h1>Your saved videos,<br>now a playlist.</h1>
      <p>Import motivational videos from your gallery and listen with the screen off &mdash; like Spotify, but it&rsquo;s your own collection.</p>
      <button class="pill" data-action="import">${I.plus} Import videos</button>
    </div>`;
    return;
  }
  let h = '';
  if (playlists.length) {
    h += `<h2 class="section-t">Playlists</h2>
    <div class="pl-scroll">${playlists.map(plCard).join('')}</div>`;
  }
  h += `<h2 class="section-t">Recently added</h2>
  <div class="list">${tracks.slice(0, 25).map(t => trackRow(t, 'recent')).join('')}</div>`;
  v.innerHTML = h;
}

function renderSearch() {
  const q = ($('#searchInput').value || '').trim().toLowerCase();
  const out = $('#searchResults');
  if (!q) {
    lastSearchIds = [];
    out.innerHTML = `<p class="hint">Find that one speech fast.<br>Search everything you&rsquo;ve imported.</p>`;
    return;
  }
  const ts = tracks.filter(t => t.title.toLowerCase().includes(q));
  const ps = playlists.filter(p => p.name.toLowerCase().includes(q));
  lastSearchIds = ts.map(t => t.id);
  let h = '';
  if (ts.length) h += `<h2 class="section-t">Audios</h2><div class="list">${ts.map(t => trackRow(t, 'search')).join('')}</div>`;
  if (ps.length) {
    h += `<h2 class="section-t">Playlists</h2><div class="list">${ps.map(pl => {
      const n = pl.trackIds.filter(trackById).length;
      return `<div class="row" data-action="open-pl" data-id="${pl.id}">
        ${plCoverHtml(pl, true)}
        <div class="row-body"><div class="row-title">${esc(pl.name)}</div><div class="row-meta">Playlist &middot; ${n} audio${n === 1 ? '' : 's'}</div></div>
        <span class="icon-btn row-chev">${I.chevR}</span>
      </div>`;
    }).join('')}</div>`;
  }
  out.innerHTML = h || `<p class="hint">Nothing matches &ldquo;${esc(q)}&rdquo;.</p>`;
}

function renderLibrary() {
  const v = $('#view-library');
  let h = `<div class="lib-head">
    <h2 class="section-t">Your library</h2>
    <button class="pill ghost sm" data-action="new-pl">${I.plus} New playlist</button>
  </div>
  <div class="list">
    <div class="row" data-action="open-pl" data-id="__all">
      <div class="pl-cover small g0"><span class="icon-btn" style="color:#fff">${I.note}</span></div>
      <div class="row-body">
        <div class="row-title">All audios</div>
        <div class="row-meta">${tracks.length} audio${tracks.length === 1 ? '' : 's'}</div>
      </div>
      <span class="icon-btn row-chev">${I.chevR}</span>
    </div>
    ${playlists.map(pl => {
      const list = playlistTracks(pl);
      const mins = Math.round(list.reduce((s, t) => s + (t.duration || 0), 0) / 60);
      return `<div class="row" data-action="open-pl" data-id="${pl.id}">
        ${plCoverHtml(pl, true)}
        <div class="row-body">
          <div class="row-title">${esc(pl.name)}</div>
          <div class="row-meta">${list.length} audio${list.length === 1 ? '' : 's'} &middot; ${mins} min</div>
        </div>
        <span class="icon-btn row-chev">${I.chevR}</span>
      </div>`;
    }).join('')}
  </div>`;
  if (!playlists.length) h += `<p class="hint">Playlists you create will live here &mdash;<br>Morning Run, Gym, Deep Work&hellip;</p>`;
  v.innerHTML = h;
}

function renderPlaylist() {
  const v = $('#view-playlist');
  const isAll = currentPlaylistId === '__all';
  const pl = isAll ? null : plById(currentPlaylistId);
  if (!isAll && !pl) { showTab('library'); return; }
  const list = isAll ? tracks : playlistTracks(pl);
  const ctx = isAll ? 'all' : `pl:${pl.id}`;
  const name = isAll ? 'All audios' : pl.name;
  const mins = Math.round(list.reduce((s, t) => s + (t.duration || 0), 0) / 60);
  v.innerHTML = `
    <div class="back-row"><button class="icon-btn" data-action="back-lib" aria-label="Back">${I.chevL}</button></div>
    <h1 class="pl-title">${esc(name)}</h1>
    <div class="pl-meta">${list.length} audio${list.length === 1 ? '' : 's'} &middot; ${mins} min</div>
    <div class="pl-actions">
      <button class="pill" data-action="play-all" data-ctx="${ctx}" ${list.length ? '' : 'disabled'}>${I.play} Play</button>
      <button class="icon-btn ring44 ${shuffle ? 'on' : ''}" data-action="shuffle-all" data-ctx="${ctx}" aria-label="Shuffle">${I.shuffleSm}</button>
      ${isAll ? '' : `<button class="icon-btn ring44" data-action="add-tracks" data-id="${pl.id}" aria-label="Add audios">${I.plus}</button>
      <button class="icon-btn ring44" data-action="pl-menu" data-id="${pl.id}" aria-label="Playlist options">${I.dots}</button>`}
    </div>
    ${list.length
      ? `<div class="list">${list.map(t => trackRow(t, ctx)).join('')}</div>`
      : `<p class="hint">${isAll ? 'Import videos with the + button up top.' : 'No audios yet. Tap + above to add<br>from your imported audios.'}</p>`}
  `;
}

function rerenderCurrent() {
  if (currentView === 'home') renderHome();
  else if (currentView === 'search') renderSearch();
  else if (currentView === 'library') renderLibrary();
  else if (currentView === 'playlist') renderPlaylist();
}

function showTab(tab) {
  currentView = tab;
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`#view-${tab}`).classList.add('active');
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  rerenderCurrent();
  window.scrollTo(0, 0);
}
function openPlaylist(id) {
  currentPlaylistId = id;
  currentView = 'playlist';
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#view-playlist').classList.add('active');
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'library'));
  renderPlaylist();
  window.scrollTo(0, 0);
}

/* ============================================================
   PLAYER
   ============================================================ */
function startQueue(ids, startId, name) {
  if (!ids.length) return;
  baseQueue = [...ids];
  queue = [...ids];
  if (shuffle) shuffleQueue(startId);
  qi = Math.max(0, queue.indexOf(startId));
  ctxName = name;
  loadCurrent(true);
}
function shuffleQueue(keepId) {
  const rest = queue.filter(x => x !== keepId);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  queue = keepId != null && queue.includes(keepId) ? [keepId, ...rest] : rest;
}
function toggleShuffle() {
  shuffle = !shuffle;
  const cur = nowId();
  if (queue.length) {
    if (shuffle) { shuffleQueue(cur); qi = 0; }
    else { queue = [...baseQueue]; qi = Math.max(0, queue.indexOf(cur)); }
  }
  $('#shuffleBtn').classList.toggle('on', shuffle);
  if (currentView === 'playlist') renderPlaylist();
}
function cycleRepeat() {
  repeat = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off';
  const b = $('#repeatBtn');
  b.classList.toggle('on', repeat !== 'off');
  b.classList.toggle('one', repeat === 'one');
}

function loadCurrent(autoplay) {
  const t = curTrack();
  if (!t) return;
  if (curUrl) { try { URL.revokeObjectURL(curUrl); } catch (e) {} }
  curUrl = URL.createObjectURL(t.blob);
  const hasVideo = t.kind !== 'audio';
  if (!hasVideo && mode === 'video') mode = 'audio';
  audioEl.src = curUrl;
  videoEl.src = curUrl;
  playerEl.classList.toggle('no-video', !hasVideo);
  syncModeUI();
  document.body.classList.add('has-mini');
  miniEl.hidden = false;
  refreshPlayerUI(t);
  setMediaSession(t);
  if (autoplay) playActive();
  refreshRowButtons();
}
function playActive() {
  inactiveEl().pause();
  const p = activeEl().play();
  if (p && p.catch) p.catch(() => {});
}
function pauseActive() { activeEl().pause(); }
function togglePlay() {
  if (!curTrack()) return;
  if (isPlaying()) pauseActive(); else playActive();
}
function next(auto) {
  if (!queue.length) return;
  if (qi < queue.length - 1) qi++;
  else if (repeat === 'all') qi = 0;
  else {
    if (auto) { pauseActive(); activeEl().currentTime = 0; updateProgress(); updatePlayState(); }
    return;
  }
  loadCurrent(true);
}
function prev() {
  if (!queue.length) return;
  if (activeEl().currentTime > 3 || qi === 0) { activeEl().currentTime = 0; return; }
  qi--;
  loadCurrent(true);
}
function onEnded() {
  if (repeat === 'one') { activeEl().currentTime = 0; playActive(); return; }
  next(true);
}
function setMode(m) {
  const t = curTrack();
  if (!t || m === mode) return;
  if (m === 'video' && t.kind === 'audio') return;
  const from = activeEl();
  const time = from.currentTime;
  const wasPlaying = isPlaying();
  mode = m;
  const to = activeEl();
  try { to.currentTime = time || 0; } catch (e) {}
  from.pause();
  if (wasPlaying) playActive();
  syncModeUI();
}
function syncModeUI() {
  playerEl.classList.toggle('mode-video', mode === 'video');
  playerEl.classList.toggle('mode-audio', mode === 'audio');
  $$('#modeSeg button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
}
function stopAll() {
  audioEl.pause(); videoEl.pause();
  audioEl.removeAttribute('src'); videoEl.removeAttribute('src');
  audioEl.load(); videoEl.load();
  queue = []; baseQueue = []; qi = -1;
  miniEl.hidden = true;
  document.body.classList.remove('has-mini');
  collapsePlayer();
  document.title = 'Motiv';
}

function refreshPlayerUI(t) {
  $('#playerTitle').textContent = t.title;
  $('#playerMeta').textContent = `${fmtWhen(t.addedAt)} · ${fmtDur(t.duration)}`;
  $('#playerCtx').textContent = ctxName || 'Library';
  $('#stageArt').src = t.thumb;
  $('#miniArt').src = t.thumb;
  $('#miniTitle').textContent = t.title;
  $('#miniMeta').textContent = ctxName || fmtDur(t.duration);
  document.title = `${t.title} — Motiv`;
  updatePlayState();
  updateProgress();
}
function updatePlayState() {
  const p = isPlaying();
  $('#bigPlay').innerHTML = p ? I.pause : I.play;
  $('#miniPlay').innerHTML = p ? I.pause : I.play;
  try { navigator.mediaSession.playbackState = p ? 'playing' : 'paused'; } catch (e) {}
  refreshRowButtons();
}
function refreshRowButtons() {
  const id = nowId(), p = isPlaying();
  $$('.row-play').forEach(b => { b.innerHTML = b.dataset.id === id && p ? I.pauseO : I.playO; });
  $$('.row[data-id]').forEach(r => r.classList.toggle('playing', r.dataset.id === id && r.classList.contains('row')));
}
function updateProgress() {
  const el = activeEl();
  const t = curTrack();
  const dur = (isFinite(el.duration) && el.duration) || (t && t.duration) || 0;
  const cur = el.currentTime || 0;
  const pct = dur ? Math.min(100, cur / dur * 100) : 0;
  seekEl.value = dur ? Math.round(cur / dur * 1000) : 0;
  seekEl.style.setProperty('--p', pct + '%');
  $('#tCur').textContent = fmtDur(cur);
  $('#tDur').textContent = fmtDur(dur);
  $('#miniBar').style.width = pct + '%';
  try {
    if (dur) navigator.mediaSession.setPositionState({ duration: dur, playbackRate: 1, position: Math.min(cur, dur) });
  } catch (e) {}
}
function setMediaSession(t) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: ctxName || 'Motiv',
      album: 'Motiv',
      artwork: [{ src: t.thumb, sizes: '400x400', type: 'image/jpeg' }],
    });
    navigator.mediaSession.setActionHandler('play', () => playActive());
    navigator.mediaSession.setActionHandler('pause', () => pauseActive());
    navigator.mediaSession.setActionHandler('previoustrack', () => prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
    navigator.mediaSession.setActionHandler('seekto', d => { if (d.seekTime != null) { activeEl().currentTime = d.seekTime; updateProgress(); } });
    navigator.mediaSession.setActionHandler('seekbackward', () => { activeEl().currentTime = Math.max(0, activeEl().currentTime - 15); });
    navigator.mediaSession.setActionHandler('seekforward', () => { activeEl().currentTime = activeEl().currentTime + 15; });
  } catch (e) {}
}
function expandPlayer() { if (curTrack()) playerEl.classList.add('open'); }
function collapsePlayer() { playerEl.classList.remove('open'); }

/* ============================================================
   IMPORT
   ============================================================ */
function probe(file, kind) {
  return new Promise(resolve => {
    let done = false;
    const url = URL.createObjectURL(file);
    const el = document.createElement(kind === 'audio' ? 'audio' : 'video');
    const finish = (thumb, duration) => {
      if (done) return; done = true;
      try { URL.revokeObjectURL(url); } catch (e) {}
      resolve({ thumb, duration });
    };
    el.preload = 'metadata';
    el.muted = true;
    if (kind !== 'audio') { el.playsInline = true; el.setAttribute('webkit-playsinline', ''); }
    el.onerror = () => finish(null, 0);
    el.onloadedmetadata = () => {
      const d = isFinite(el.duration) && el.duration ? el.duration : 0;
      if (kind === 'audio') { finish(null, d); return; }
      el.onseeked = () => {
        try {
          const s = 400, c = document.createElement('canvas');
          c.width = s; c.height = s;
          const g = c.getContext('2d');
          const vw = el.videoWidth || s, vh = el.videoHeight || s;
          const scale = Math.max(s / vw, s / vh);
          g.drawImage(el, (s - vw * scale) / 2, (s - vh * scale) / 2, vw * scale, vh * scale);
          finish(c.toDataURL('image/jpeg', 0.72), d);
        } catch (e) { finish(null, d); }
      };
      try { el.currentTime = Math.min(1, (d || 2) * 0.25); } catch (e) { finish(null, d); }
      setTimeout(() => finish(null, d), 5000);
    };
    el.src = url;
    setTimeout(() => finish(null, 0), 10000);
  });
}

async function importFiles(files) {
  if (!files.length) return;
  let done = 0, failed = 0;
  toast(`Importing… 0/${files.length}`, true);
  for (const f of files) {
    try {
      const kind = (f.type || '').startsWith('audio') ? 'audio' : 'video';
      const meta = await probe(f, kind);
      const title = cleanName(f.name);
      const t = {
        id: uid(),
        title,
        addedAt: Date.now(),
        duration: meta.duration || 0,
        thumb: meta.thumb || gradThumb(title),
        kind,
        blob: f,
      };
      await dbPut('tracks', t);
      tracks.push(t);
      done++;
    } catch (e) { console.warn('import failed', e); failed++; }
    toast(`Importing… ${done + failed}/${files.length}`, true);
  }
  sortData();
  rerenderCurrent();
  toast(done ? `Imported ${done} audio${done === 1 ? '' : 's'}` : 'Import failed');
  requestPersistentStorage();
}

/* ============================================================
   SHEETS + TOAST
   ============================================================ */
function openSheet(html, ctx) {
  sheetCtx = ctx || null;
  $('#sheet').innerHTML = `<div class="sheet-grab"></div>` + html;
  $('#sheet').classList.add('open');
  $('#backdrop').classList.add('open');
}
function closeSheet() {
  sheetCtx = null;
  $('#sheet').classList.remove('open');
  $('#backdrop').classList.remove('open');
}
function toast(msg, sticky) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function sheetTrackMenu(id, ctx) {
  const t = trackById(id);
  if (!t) return;
  const inPl = ctx && ctx.startsWith('pl:');
  openSheet(`
    <div class="sheet-head">
      <img src="${t.thumb}" alt="">
      <div><div class="t">${esc(t.title)}</div><div class="m">${fmtWhen(t.addedAt)} &middot; ${fmtDur(t.duration)}</div></div>
    </div>
    <button class="sheet-item" data-action="sheet-add-to-pl">${I.addPl}<span class="grow">Add to playlist</span></button>
    ${inPl ? `<button class="sheet-item" data-action="sheet-remove">${I.minusPl}<span class="grow">Remove from this playlist</span></button>` : ''}
    <button class="sheet-item" data-action="sheet-rename">${I.pencil}<span class="grow">Rename</span></button>
    <button class="sheet-item danger" data-action="sheet-delete">${I.trash}<span class="grow">Delete audio</span></button>
  `, { trackId: id, ctx });
}
function sheetPickPlaylist(trackId) {
  openSheet(`
    <div class="sheet-title">Add to playlist</div>
    <button class="sheet-item" data-action="new-pl-here">${I.plus}<span class="grow">New playlist</span></button>
    ${playlists.map(pl => {
      const has = pl.trackIds.includes(trackId);
      return `<button class="sheet-item" data-action="pick-pl" data-id="${pl.id}">
        ${plCoverHtml(pl, true)}
        <span class="grow">${esc(pl.name)}<br><span class="sub">${pl.trackIds.filter(trackById).length} audios</span></span>
        ${has ? I.check : ''}
      </button>`;
    }).join('')}
  `, { trackId });
}
function sheetNamePrompt(title, value, saveCtx) {
  openSheet(`
    <div class="sheet-title">${esc(title)}</div>
    <input class="sheet-input" id="sheetInput" type="text" value="${esc(value || '')}" placeholder="Name" autocomplete="off" maxlength="60">
    <div class="sheet-actions">
      <button class="pill ghost" data-action="close-sheet">Cancel</button>
      <button class="pill" data-action="name-save">Save</button>
    </div>
  `, saveCtx);
  setTimeout(() => { const i = $('#sheetInput'); if (i) { i.focus(); i.select(); } }, 120);
}
function sheetConfirm(msg, label, action, ctx) {
  openSheet(`
    <div class="sheet-title">${esc(msg)}</div>
    <div class="sheet-actions">
      <button class="pill ghost" data-action="close-sheet">Cancel</button>
      <button class="pill" style="background:var(--danger)" data-action="${action}">${esc(label)}</button>
    </div>
  `, ctx);
}
function sheetAddTracks(plId) {
  const pl = plById(plId);
  if (!pl) return;
  openSheet(`
    <div class="sheet-title">Add to ${esc(pl.name)}</div>
    ${tracks.length ? tracks.map(t => {
      const has = pl.trackIds.includes(t.id);
      return `<button class="sheet-item" data-action="add-here" data-id="${t.id}">
        <img src="${t.thumb}" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover">
        <span class="grow">${esc(t.title)}<br><span class="sub">${fmtDur(t.duration)}</span></span>
        ${has ? I.check : I.plus}
      </button>`;
    }).join('') : '<p class="hint">Nothing imported yet.</p>'}
  `, { plId });
}
function sheetPlMenu(plId) {
  const pl = plById(plId);
  if (!pl) return;
  openSheet(`
    <div class="sheet-title">${esc(pl.name)}</div>
    <button class="sheet-item" data-action="pl-rename">${I.pencil}<span class="grow">Rename playlist</span></button>
    <button class="sheet-item danger" data-action="pl-delete">${I.trash}<span class="grow">Delete playlist</span></button>
  `, { plId });
}

/* ---------- mutations ---------- */
async function addTrackToPlaylist(trackId, plId) {
  const pl = plById(plId);
  if (!pl || pl.trackIds.includes(trackId)) return false;
  pl.trackIds.push(trackId);
  await dbPut('playlists', pl);
  return true;
}
async function removeTrackFromPlaylist(trackId, plId) {
  const pl = plById(plId);
  if (!pl) return;
  pl.trackIds = pl.trackIds.filter(x => x !== trackId);
  await dbPut('playlists', pl);
}
async function createPlaylist(name) {
  const pl = { id: uid(), name: name || 'New playlist', createdAt: Date.now(), trackIds: [] };
  playlists.push(pl);
  await dbPut('playlists', pl);
  return pl;
}
async function deleteTrack(id) {
  tracks = tracks.filter(t => t.id !== id);
  await dbDel('tracks', id);
  for (const pl of playlists) {
    if (pl.trackIds.includes(id)) {
      pl.trackIds = pl.trackIds.filter(x => x !== id);
      await dbPut('playlists', pl);
    }
  }
  const wasCurrent = nowId() === id;
  baseQueue = baseQueue.filter(x => x !== id);
  const oldQi = qi;
  queue = queue.filter((x, i) => { if (x === id && i < oldQi) qi--; return x !== id; });
  if (wasCurrent) {
    if (queue.length) { qi = Math.min(qi, queue.length - 1); loadCurrent(true); }
    else stopAll();
  }
}

/* ============================================================
   EVENTS
   ============================================================ */
async function handleAction(btn) {
  const a = btn.dataset.action;
  const id = btn.dataset.id;
  const ctx = btn.dataset.ctx;

  switch (a) {
    case 'tab': showTab(btn.dataset.tab); break;
    case 'import': $('#fileInput').click(); break;

    case 'play': {
      if (id === nowId()) { togglePlay(); expandIfNewGesture(btn); break; }
      startQueue(ctxList(ctx), id, ctxLabel(ctx));
      break;
    }
    case 'play-all': {
      const list = ctxList(ctx);
      if (!list.length) break;
      startQueue(list, shuffle ? list[Math.floor(Math.random() * list.length)] : list[0], ctxLabel(ctx));
      expandPlayer();
      break;
    }
    case 'shuffle-all': {
      if (!shuffle) toggleShuffle(); else toggleShuffle();
      break;
    }
    case 'open-pl': openPlaylist(id); break;
    case 'back-lib': showTab('library'); break;

    case 'expand': expandPlayer(); break;
    case 'collapse': collapsePlayer(); break;
    case 'toggle': togglePlay(); break;
    case 'next': next(); break;
    case 'prev': prev(); break;
    case 'shuffle': toggleShuffle(); break;
    case 'repeat': cycleRepeat(); break;
    case 'mode': setMode(btn.dataset.mode); break;
    case 'cur-menu': { const t = curTrack(); if (t) sheetTrackMenu(t.id, 'now'); break; }

    case 'menu': sheetTrackMenu(id, ctx); break;
    case 'new-pl': sheetNamePrompt('New playlist', '', { type: 'new-pl' }); break;
    case 'add-tracks': sheetAddTracks(id); break;
    case 'pl-menu': sheetPlMenu(id); break;

    case 'close-sheet': closeSheet(); break;

    case 'sheet-add-to-pl': { const c = sheetCtx; closeSheet(); sheetPickPlaylist(c.trackId); break; }
    case 'sheet-remove': {
      const c = sheetCtx; closeSheet();
      await removeTrackFromPlaylist(c.trackId, c.ctx.slice(3));
      rerenderCurrent(); toast('Removed from playlist');
      break;
    }
    case 'sheet-rename': {
      const c = sheetCtx; const t = trackById(c.trackId);
      sheetNamePrompt('Rename audio', t ? t.title : '', { type: 'rename-track', trackId: c.trackId });
      break;
    }
    case 'sheet-delete': {
      const c = sheetCtx; const t = trackById(c.trackId);
      sheetConfirm(`Delete “${t ? t.title : ''}”?`, 'Delete', 'confirm-del-track', { trackId: c.trackId });
      break;
    }
    case 'confirm-del-track': {
      const c = sheetCtx; closeSheet();
      await deleteTrack(c.trackId);
      rerenderCurrent(); toast('Deleted');
      break;
    }
    case 'pick-pl': {
      const c = sheetCtx; closeSheet();
      const added = await addTrackToPlaylist(c.trackId, id);
      const pl = plById(id);
      toast(added ? `Added to ${pl.name}` : `Already in ${pl.name}`);
      rerenderCurrent();
      break;
    }
    case 'new-pl-here': {
      const c = sheetCtx;
      sheetNamePrompt('New playlist', '', { type: 'new-pl', pendingTrackId: c.trackId });
      break;
    }
    case 'name-save': {
      const c = sheetCtx;
      const val = ($('#sheetInput') && $('#sheetInput').value.trim()) || '';
      if (!val) break;
      closeSheet();
      if (c.type === 'new-pl') {
        const pl = await createPlaylist(val);
        if (c.pendingTrackId) { await addTrackToPlaylist(c.pendingTrackId, pl.id); toast(`Added to ${pl.name}`); }
        else toast('Playlist created');
      } else if (c.type === 'rename-track') {
        const t = trackById(c.trackId);
        if (t) { t.title = val; await dbPut('tracks', t); if (nowId() === t.id) refreshPlayerUI(t); toast('Renamed'); }
      } else if (c.type === 'rename-pl') {
        const pl = plById(c.plId);
        if (pl) { pl.name = val; await dbPut('playlists', pl); toast('Renamed'); }
      }
      rerenderCurrent();
      break;
    }
    case 'add-here': {
      const c = sheetCtx;
      const added = await addTrackToPlaylist(id, c.plId);
      if (!added) { await removeTrackFromPlaylist(id, c.plId); }
      sheetAddTracks(c.plId);
      renderPlaylist();
      break;
    }
    case 'pl-rename': {
      const c = sheetCtx; const pl = plById(c.plId);
      sheetNamePrompt('Rename playlist', pl ? pl.name : '', { type: 'rename-pl', plId: c.plId });
      break;
    }
    case 'pl-delete': {
      const c = sheetCtx; const pl = plById(c.plId);
      sheetConfirm(`Delete “${pl ? pl.name : ''}”? Audios stay in your library.`, 'Delete', 'confirm-del-pl', c);
      break;
    }
    case 'confirm-del-pl': {
      const c = sheetCtx; closeSheet();
      playlists = playlists.filter(p => p.id !== c.plId);
      await dbDel('playlists', c.plId);
      showTab('library'); toast('Playlist deleted');
      break;
    }
  }
}
function expandIfNewGesture() { /* row tap on current track only toggles; no expand */ }

function bindEvents() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    handleAction(btn);
  });

  $('#fileInput').addEventListener('change', e => {
    importFiles([...e.target.files]);
    e.target.value = '';
  });

  $('#searchInput').addEventListener('input', renderSearch);

  seekEl.addEventListener('input', () => {
    const el = activeEl();
    const t = curTrack();
    const dur = (isFinite(el.duration) && el.duration) || (t && t.duration) || 0;
    if (dur) { el.currentTime = seekEl.value / 1000 * dur; }
    updateProgress();
  });

  [audioEl, videoEl].forEach(el => {
    el.addEventListener('timeupdate', () => { if (el === activeEl()) updateProgress(); });
    el.addEventListener('loadedmetadata', () => { if (el === activeEl()) updateProgress(); });
    el.addEventListener('play', () => { if (el === activeEl()) updatePlayState(); });
    el.addEventListener('pause', () => { if (el === activeEl()) updatePlayState(); });
    el.addEventListener('ended', () => { if (el === activeEl()) onEnded(); });
  });

  $('#sheet').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'sheetInput') {
      e.preventDefault();
      const btn = $('#sheet [data-action="name-save"]');
      if (btn) handleAction(btn);
    }
  });
}

/* ---------- service worker + durable storage ---------- */
function registerSW() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

/* ============================================================
   DEMO SEEDER (dev only — call window.motivDemo() in console)
   ============================================================ */
function bufToWav(buf) {
  const n = buf.length, sr = buf.sampleRate;
  const data = buf.getChannelData(0);
  const bytes = 44 + n * 2;
  const ab = new ArrayBuffer(bytes), v = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, bytes - 8, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  ws(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 32767, true);
  return new Blob([ab], { type: 'audio/wav' });
}
async function toneWav(freq, dur) {
  const sr = 22050;
  const ctx = new OfflineAudioContext(1, sr * dur, sr);
  const o = ctx.createOscillator(); o.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = 0.15;
  o.connect(g); g.connect(ctx.destination);
  o.start(); o.stop(dur);
  return bufToWav(await ctx.startRendering());
}
window.motivDemo = async function () {
  const titles = [
    'Discipline over motivation', 'The 5AM rules — own your morning', 'David Goggins — stay hard',
    'Focus like a monk', 'No excuses — go run', 'You vs you — daily standard',
  ];
  for (let i = 0; i < titles.length; i++) {
    const blob = await toneWav(240 + i * 60, 3);
    const t = {
      id: uid(), title: titles[i],
      addedAt: Date.now() - i * 86400000 * (i > 2 ? 2 : 0),
      duration: 41 + i * 23, thumb: gradThumb(titles[i] + i), kind: 'audio', blob,
    };
    await dbPut('tracks', t);
    tracks.push(t);
  }
  sortData();
  const pl = await createPlaylist('Morning Run');
  for (const t of tracks.slice(0, 3)) await addTrackToPlaylist(t.id, pl.id);
  const pl2 = await createPlaylist('Gym');
  for (const t of tracks.slice(2, 6)) await addTrackToPlaylist(t.id, pl2.id);
  rerenderCurrent();
  toast('Demo library added');
};

/* ---------- init ---------- */
(async function init() {
  await openDB();
  tracks = await dbAll('tracks');
  playlists = await dbAll('playlists');
  sortData();
  bindEvents();
  $('#bigPlay').innerHTML = I.play;
  $('#miniPlay').innerHTML = I.play;
  showTab('home');
  registerSW();
  requestPersistentStorage();
})();
