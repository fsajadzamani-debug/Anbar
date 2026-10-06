/* ======================================================
   انباریار — چت سازمانی
   گروه عمومی + پیام خصوصی؛ خوانده‌نشده/منشن؛ آنلاین؛ ویرایش و حذف؛ سکوت توسط مدیر
   ====================================================== */
const CHAT = { users: [], summary: [], msgs: [], room: null, tab: 'all', q: '', editing: null, replyTo: null, online: new Set(), muted: new Set(), ready: false, err: '' };
const GENERAL = 'general';
const dmRoom = (a, b) => 'dm:' + [a, b].sort().join(':');
const roomPeer = room => room.startsWith('dm:') ? room.slice(3).split(':').find(x => x !== S.user.id) : null;
const chatUser = id => CHAT.users.find(u => u.id === id);
const uname = u => u ? (u.full_name || u.username) : 'کاربر حذف‌شده';
const seenKey = () => 'wh_chat_seen_' + (S.user?.id || '');
function seenMap() { try { return JSON.parse(localStorage.getItem(seenKey()) || '{}'); } catch (e) { return {}; } }
function setSeen(room, id) { const m = seenMap(); if ((m[room] || 0) < id) { m[room] = id; try { localStorage.setItem(seenKey(), JSON.stringify(m)); } catch (e) { /* ignore */ } } }
const AV_COLORS = ['#4f6bff', '#0e8f7e', '#c2410c', '#8a5cff', '#b45309', '#0369a1', '#be185d', '#15803d'];
const avColor = id => { let h = 0; for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; };
const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('');
const avatar = (id, name, online, big) => `<span class="av ${big ? 'big' : ''}" style="--c:${avColor(id)}">${esc(initials(name))}${online ? '<i class="on"></i>' : ''}</span>`;
const groupAvatar = () => `<span class="av grp">${I('<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.7-3 3.1-4.6 6-4.6s5.3 1.6 6 4.6"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14.2c2.2.2 3.8 1.5 4.4 3.8"/>')}</span>`;
const hhmm = iso => { const d = new Date(iso); return `${Jalali.pad(d.getHours())}:${Jalali.pad(d.getMinutes())}`; };
const dayOf = iso => Jalali.isoToJalali(iso).split(' ')[0];
const linkify = t => esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
  .replace(/(^|\s)@([a-z0-9._-]{3,})/gi, (m, sp, u) => `${sp}<b class="mention ${u.toLowerCase() === S.user.username ? 'me' : ''}">@${u}</b>`);
const mentionsMe = m => new RegExp('(^|\\s)@' + S.user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\b|$)', 'i').test(m.body || '');

/* ---------- شمارش خوانده‌نشده (برای منو) ---------- */
function chatUnread() {
  const seen = seenMap(); let n = 0;
  CHAT.summary.forEach(m => { if (m.user_id !== S.user.id && m.id > (seen[m.room] || 0)) n++; });
  return n;
}
async function initChat() {
  try {
    const [users, summary] = await Promise.all([S.store.listChatUsers(), S.store.chatSummary()]);
    CHAT.users = users; CHAT.summary = summary; CHAT.ready = true; CHAT.err = '';
    if (can.admin()) CHAT.muted = new Set(await S.store.mutedList());
    S.user.muted = await S.store.amMuted();
    S.store.presence(S.user.id, set => { CHAT.online = set; if (parseHash().view === 'chat') drawRooms(); });
  } catch (e) { CHAT.err = e.message; }
  refreshNav();
}
function onChatEvent(p) {
  const n = p.new, o = p.old;
  if (p.eventType === 'INSERT') {
    if (!CHAT.summary.some(x => x.id === n.id)) CHAT.summary.unshift(n);
    if (n.room === CHAT.room && parseHash().view === 'chat') {
      if (!CHAT.msgs.some(x => x.id === n.id)) CHAT.msgs.push(n);
      setSeen(n.room, n.id); drawMessages(true);
    } else if (n.user_id !== S.user.id) {
      const who = uname(chatUser(n.user_id)) || n.username;
      toast(`${n.room === GENERAL ? 'گروه عمومی' : 'پیام خصوصی'} · ${who}: ${String(n.body).slice(0, 60)}`);
    }
  } else if (p.eventType === 'UPDATE') {
    [CHAT.msgs, CHAT.summary].forEach(l => { const i = l.findIndex(x => x.id === n.id); if (i >= 0) l[i] = { ...l[i], ...n }; });
    if (n.room === CHAT.room) drawMessages();
  } else if (p.eventType === 'DELETE') {
    CHAT.msgs = CHAT.msgs.filter(x => x.id !== o.id); CHAT.summary = CHAT.summary.filter(x => x.id !== o.id);
    if (parseHash().view === 'chat') drawMessages();
  }
  if (parseHash().view === 'chat') drawRooms();
  refreshNav();
}

/* ---------- صفحه چت ---------- */
function roomList() {
  const seen = seenMap();
  const last = {}, unread = {}, ment = {};
  [...CHAT.summary].reverse().forEach(m => {
    last[m.room] = m;
    if (m.user_id !== S.user.id && m.id > (seen[m.room] || 0)) { unread[m.room] = (unread[m.room] || 0) + 1; if (mentionsMe(m)) ment[m.room] = (ment[m.room] || 0) + 1; }
  });
  const rooms = [{ room: GENERAL, name: 'گروه عمومی', sub: 'همه کاربران انبار', group: true }]
    .concat(CHAT.users.filter(u => u.id !== S.user.id).map(u => ({ room: dmRoom(S.user.id, u.id), name: uname(u), sub: u.username, user: u })));
  rooms.forEach(r => { r.last = last[r.room]; r.unread = unread[r.room] || 0; r.ment = ment[r.room] || 0; });
  return rooms.sort((a, b) => (a.group ? -1 : b.group ? 1 : 0) || (b.last?.id || 0) - (a.last?.id || 0) || a.name.localeCompare(b.name, 'fa'));
}
async function renderChat(room) {
  if (CHAT.err === 'CHAT_NOT_SETUP' || (!CHAT.ready && !CHAT.err)) await initChat();
  if (CHAT.err) {
    $('#view').innerHTML = `<div class="card empty"><b>چت سازمانی هنوز راه‌اندازی نشده</b>${CHAT.err === 'CHAT_NOT_SETUP' ? 'مدیر باید فایل supabase/patch-chat.sql را یک‌بار در Supabase اجرا کند.' : esc(CHAT.err)}</div>`; return;
  }
  const mobile = innerWidth <= 860;
  if (room) CHAT.room = room; else if (!mobile && !CHAT.room) CHAT.room = GENERAL;
  $('#view').innerHTML = `
    <div class="chat-app ${CHAT.room && mobile ? 'in-room' : ''}">
      <aside class="chat-side">
        <div class="chat-tabs">${[['all', 'همه'], ['unread', 'خوانده‌نشده'], ['ment', 'منشن']].map(([k, l]) => `<button data-tab="${k}" class="${CHAT.tab === k ? 'on' : ''}">${l}<span data-cnt="${k}"></span></button>`).join('')}</div>
        <div class="chat-search">${ICON.search}<input id="chatQ" placeholder="جستجوی نام…" value="${esc(CHAT.q)}"></div>
        <div class="rooms" id="rooms"></div>
      </aside>
      <section class="chat-main" id="chatMain"></section>
    </div>`;
  $$('[data-tab]').forEach(b => b.onclick = () => { CHAT.tab = b.dataset.tab; $$('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); drawRooms(); });
  $('#chatQ').oninput = ev => { CHAT.q = ev.target.value; drawRooms(); };
  drawRooms();
  if (CHAT.room) await openRoom(CHAT.room); else $('#chatMain').innerHTML = '';
}
function drawRooms() {
  const box = $('#rooms'); if (!box) return;
  let rooms = roomList();
  const cnt = { all: rooms.reduce((a, r) => a + r.unread, 0), unread: rooms.filter(r => r.unread).length, ment: rooms.reduce((a, r) => a + r.ment, 0) };
  $$('[data-cnt]').forEach(s => { const n = cnt[s.dataset.cnt]; s.textContent = n && s.dataset.cnt !== 'all' ? (n > 99 ? '99+' : n) : ''; s.className = n && s.dataset.cnt !== 'all' ? 'tb' : ''; });
  if (CHAT.tab === 'unread') rooms = rooms.filter(r => r.unread);
  if (CHAT.tab === 'ment') rooms = rooms.filter(r => r.ment);
  if (CHAT.q) rooms = rooms.filter(r => matchQ(normFa(r.name + ' ' + r.sub), CHAT.q));
  box.innerHTML = rooms.map(r => {
    const online = r.user && CHAT.online.has(r.user.id);
    const prev = r.last ? `${r.last.user_id === S.user.id ? 'شما: ' : r.group ? esc((uname(chatUser(r.last.user_id)) || r.last.username || '').split(' ')[0]) + ': ' : ''}${esc(String(r.last.body).slice(0, 40))}` : `<span class="muted">${esc(r.sub)}</span>`;
    return `<button class="room ${r.room === CHAT.room ? 'on' : ''}" data-room="${r.room}">
      ${r.group ? groupAvatar() : avatar(r.user.id, r.name, online)}
      <span class="rm-t"><b>${esc(r.name)}${r.user && CHAT.muted.has(r.user.id) ? ` <i class="mute-ic" title="ساکت">${ICON.mute}</i>` : ''}</b><small>${prev}</small></span>
      <span class="rm-m">${r.last ? `<small class="mono">${dayOf(r.last.created_at) === Jalali.today() ? hhmm(r.last.created_at) : dayOf(r.last.created_at).slice(5)}</small>` : ''}
        ${r.ment ? `<i class="badge-ment">@ ${r.ment}</i>` : r.unread ? `<i class="badge-un">${r.unread > 99 ? '99+' : r.unread}</i>` : ''}</span></button>`;
  }).join('') || '<div class="empty" style="padding:30px">گفتگویی نیست</div>';
  $$('[data-room]', box).forEach(b => b.onclick = () => { CHAT.editing = null; CHAT.replyTo = null; if (innerWidth <= 860) $('.chat-app').classList.add('in-room'); openRoom(b.dataset.room); });
}
async function openRoom(room) {
  CHAT.room = room; CHAT.editing = null; CHAT.replyTo = null;
  $$('.room').forEach(b => b.classList.toggle('on', b.dataset.room === room));
  const main = $('#chatMain'); if (!main) return;
  const peer = roomPeer(room), pu = chatUser(peer);
  const title = room === GENERAL ? 'گروه عمومی' : uname(pu);
  const sub = room === GENERAL ? `${CHAT.users.length} عضو · ${[...CHAT.online].length} آنلاین` : (CHAT.online.has(peer) ? '<span class="ok-t">آنلاین</span>' : esc(pu?.username || ''));
  main.innerHTML = `
    <div class="chat-head">
      <button class="icon-btn back-btn" id="chatBack">${ICON.back}</button>
      ${room === GENERAL ? groupAvatar() : avatar(peer, title, CHAT.online.has(peer), true)}
      <div class="ch-t"><b>${esc(title)}</b><small>${sub}</small></div>
      ${can.admin() && peer ? `<button class="btn sm ${CHAT.muted.has(peer) ? 'danger' : ''}" id="muteBtn">${ICON.mute}${CHAT.muted.has(peer) ? 'برداشتن سکوت' : 'سکوت کاربر'}</button>` : ''}
      ${can.admin() && room === GENERAL ? `<button class="btn sm" id="membersBtn">${ICON.users}اعضا و سکوت</button>` : ''}
    </div>
    <div class="msgs" id="msgs"><div class="muted" style="text-align:center;padding:30px">…</div></div>
    <div class="composer" id="composer"></div>`;
  $('#chatBack').onclick = () => { $('.chat-app').classList.remove('in-room'); CHAT.room = null; drawRooms(); };
  if ($('#muteBtn')) $('#muteBtn').onclick = () => toggleMute(peer);
  if ($('#membersBtn')) $('#membersBtn').onclick = membersModal;
  try { CHAT.msgs = await S.store.listChat(room); } catch (e) { $('#msgs').innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  if (CHAT.room !== room) return;
  if (CHAT.msgs.length) setSeen(room, CHAT.msgs.at(-1).id);
  drawMessages(true); drawComposer(); drawRooms(); refreshNav();
}
function drawMessages(toBottom) {
  const box = $('#msgs'); if (!box) return;
  const near = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  let lastDay = '', lastUser = '';
  box.innerHTML = CHAT.msgs.length ? CHAT.msgs.map(m => {
    const mine = m.user_id === S.user.id, d = dayOf(m.created_at);
    const sep = d !== lastDay ? `<div class="day-sep"><span>${d === Jalali.today() ? 'امروز' : d}</span></div>` : '';
    const showName = !mine && (m.user_id !== lastUser || sep);
    lastDay = d; lastUser = m.user_id;
    const rep = m.reply_to ? CHAT.msgs.find(x => x.id === m.reply_to) : null;
    const canEdit = (mine && !S.user.muted) || can.admin(), canDel = mine || can.admin();
    return `${sep}<div class="msg ${mine ? 'mine' : ''}" data-id="${m.id}">
      ${!mine && CHAT.room === GENERAL ? (showName ? avatar(m.user_id, uname(chatUser(m.user_id)) || m.username) : '<span class="av-sp"></span>') : ''}
      <div class="bwrap">
        ${showName && CHAT.room === GENERAL ? `<div class="who" style="color:${avColor(m.user_id)}">${esc(uname(chatUser(m.user_id)) || m.username)} <small class="mono">${hhmm(m.created_at)}</small></div>` : ''}
        <div class="bubble">${rep ? `<div class="rep">${esc((uname(chatUser(rep.user_id)) || rep.username || '').split(' ')[0])}: ${esc(String(rep.body).slice(0, 70))}</div>` : ''}${linkify(m.body).replace(/\n/g, '<br>')}
          <span class="meta">${m.edited_at ? 'ویرایش‌شده · ' : ''}${hhmm(m.created_at)}</span></div>
        <div class="msg-acts"><button data-act="reply" data-mid="${m.id}" title="پاسخ">${ICON.reply}</button>${canEdit ? `<button data-act="edit" data-mid="${m.id}" title="ویرایش">${ICON.edit}</button>` : ''}${canDel ? `<button data-act="del" data-mid="${m.id}" title="حذف">${ICON.trash}</button>` : ''}</div>
      </div></div>`;
  }).join('') : `<div class="chat-empty">${CHAT.room === GENERAL ? groupAvatar() : avatar(roomPeer(CHAT.room), uname(chatUser(roomPeer(CHAT.room))), false, true)}<b>هنوز پیامی نیست</b><small>اولین پیام را بفرستید</small></div>`;
  $$('[data-act]', box).forEach(b => b.onclick = () => chatAction(b.dataset.act, +b.dataset.mid));
  if (toBottom || near) box.scrollTop = box.scrollHeight;
}
function drawComposer() {
  const c = $('#composer'); if (!c) return;
  if (S.user.muted) { c.innerHTML = `<div class="muted-bar">${ICON.mute}مدیر شما را در حالت سکوت قرار داده؛ امکان ارسال پیام ندارید</div>`; return; }
  const ed = CHAT.editing && CHAT.msgs.find(m => m.id === CHAT.editing), rp = CHAT.replyTo && CHAT.msgs.find(m => m.id === CHAT.replyTo);
  c.innerHTML = `${ed || rp ? `<div class="cmp-ctx">${ed ? `${ICON.edit}ویرایش پیام` : `${ICON.reply}پاسخ به ${esc((uname(chatUser(rp.user_id)) || rp.username || '').split(' ')[0])}: ${esc(String(rp.body).slice(0, 60))}`}<button id="ctxX" class="icon-btn">${ICON.x}</button></div>` : ''}
    <div class="cmp-row"><textarea id="cmpIn" rows="1" placeholder="${CHAT.room === GENERAL ? 'پیام به گروه… (برای منشن: @نام‌کاربری)' : 'پیام…'}" dir="auto">${ed ? esc(ed.body) : ''}</textarea>
    <button class="send-btn" id="sendBtn" title="ارسال (Enter)">${ICON.send}</button></div>`;
  const ta = $('#cmpIn');
  const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; };
  ta.oninput = fit; fit();
  ta.onkeydown = ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); send(); } if (ev.key === 'Escape') { CHAT.editing = null; CHAT.replyTo = null; drawComposer(); } };
  if ($('#ctxX')) $('#ctxX').onclick = () => { CHAT.editing = null; CHAT.replyTo = null; drawComposer(); };
  const send = async () => {
    const body = ta.value.trim(); if (!body) return;
    const btn = $('#sendBtn'); btn.disabled = true;
    try {
      if (CHAT.editing) { const u = await S.store.editChat(CHAT.editing, body); const i = CHAT.msgs.findIndex(x => x.id === u.id); if (i >= 0) CHAT.msgs[i] = u; CHAT.editing = null; }
      else { const m = await S.store.sendChat(CHAT.room, body, CHAT.replyTo); if (!CHAT.msgs.some(x => x.id === m.id)) CHAT.msgs.push(m); if (!CHAT.summary.some(x => x.id === m.id)) CHAT.summary.unshift(m); setSeen(CHAT.room, m.id); CHAT.replyTo = null; }
      drawMessages(true); drawComposer(); drawRooms(); $('#cmpIn')?.focus();
    } catch (e) { toast(e.message, 'err'); if (/سکوت/.test(e.message)) { S.user.muted = true; drawComposer(); } }
    finally { if (btn.isConnected) btn.disabled = false; }
  };
  $('#sendBtn').onclick = send;
  if (innerWidth > 860) ta.focus();
}
async function chatAction(act, id) {
  const m = CHAT.msgs.find(x => x.id === id); if (!m) return;
  if (act === 'reply') { CHAT.replyTo = id; CHAT.editing = null; drawComposer(); }
  if (act === 'edit') { CHAT.editing = id; CHAT.replyTo = null; drawComposer(); }
  if (act === 'del') {
    if (!(await confirmBox(m.user_id === S.user.id ? 'این پیام حذف شود؟' : `پیام «${esc(uname(chatUser(m.user_id)) || m.username)}» حذف شود؟`, 'حذف'))) return;
    try { await S.store.deleteChat(id); CHAT.msgs = CHAT.msgs.filter(x => x.id !== id); CHAT.summary = CHAT.summary.filter(x => x.id !== id); drawMessages(); drawRooms(); }
    catch (e) { toast(e.message, 'err'); }
  }
}
async function toggleMute(uid) {
  const on = !CHAT.muted.has(uid);
  if (on && !(await confirmBox(`«${esc(uname(chatUser(uid)))}» ساکت شود؟ تا وقتی سکوت را برندارید نمی‌تواند در چت پیام بفرستد یا ویرایش کند.`, 'سکوت'))) return;
  try { await S.store.setMute(uid, on); on ? CHAT.muted.add(uid) : CHAT.muted.delete(uid); toast(on ? 'کاربر ساکت شد' : 'سکوت برداشته شد', 'ok'); if (CHAT.room) openRoom(CHAT.room); drawRooms(); }
  catch (e) { toast(e.message, 'err'); }
}
function membersModal() {
  const m = modal('اعضای گروه و سکوت', `<div class="mem-list" style="max-height:60vh">${CHAT.users.map(u => `<div class="mem-row">${avatar(u.id, uname(u), CHAT.online.has(u.id))}<span style="flex:1">${esc(uname(u))} <small class="muted mono">${esc(u.username)}</small></span>
    ${u.id === S.user.id ? '<small class="muted">شما</small>' : `<button class="btn sm ${CHAT.muted.has(u.id) ? 'danger' : ''}" data-mu="${u.id}">${CHAT.muted.has(u.id) ? 'برداشتن سکوت' : 'سکوت'}</button>`}</div>`).join('')}</div>`);
  $$('[data-mu]', m.el).forEach(b => b.onclick = async () => { m.close(); await toggleMute(b.dataset.mu); membersModal(); });
}
