/* 训练营打分系统 · 数据层与公共小工具
   依赖：vendor/workbuddy-cloud-sdk.js（必须先加载） */
const cloud = WorkBuddyCloud.createWorkBuddyCloud({
  endpoint: 'https://camp-scoring-gz.app.workbuddy.host',
  publishableKey: 'wbpk_06KE60P5cB0lhTrGCKcONG_MiYvT1lQwjVQhbcS627llU0xQpvvYcK5',
});

/* 管理口令只存指纹（SHA-256），看源代码也看不出口令本身。改口令：把新口令的 SHA-256 填到这里 */
const ADMIN_HASH = '38ceff672a2cd0ac3a7c3a8f1a58a7da42e54420ea7d4093e67bffa34493a765';
async function checkPass(text) {
  if (!(window.crypto && crypto.subtle)) return false;   // 只在 https 下可用
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('') === ADMIN_HASH;
}
const SCORE_HINT = '6 分及格，10 分最好';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

/* 完整名单（含缺席），只有后台用 */
async function getAllParticipants() {
  return unwrap(await cloud.database.from('participants').select('*').order('id'));
}

/* 缺席名单：settings 表里 key=absent，值是逗号分隔的 id，例如 "3,12" */
function parseAbsent(v) { return new Set(String(v || '').split(',').filter(Boolean).map(Number)); }
async function getAbsent() { return parseAbsent(await getSetting('absent')); }

/* 名单分三种：
   - 选手 players：上台、被打分、进排名（去掉缺席和工作人员）
   - 评委 judges：所有到场的人都要打分（选手 + 工作人员，去掉缺席）
   工作人员记在 settings 表 key=staff（逗号分隔 id），他们没有出场顺序、不被打分 */
async function getRoster() {
  const [all, st] = await Promise.all([getAllParticipants(), getSettings()]);
  const absent = parseAbsent(st.absent), staff = parseAbsent(st.staff);
  return {
    all, absent, staff,
    players: all.filter(p => !absent.has(p.id) && !staff.has(p.id)),
    judges: all.filter(p => !absent.has(p.id)),
  };
}
async function getParticipants() { return (await getRoster()).players; }
async function getJudges() { return (await getRoster()).judges; }

/* 彩排模式：网址加 ?demo=1，用假分数看效果，不读写真实分数 */
const DEMO = new URLSearchParams(location.search).has('demo');
/* 彩排模式下站内跳转也带上 demo，免得一点链接就进了真实数据 */
if (DEMO) document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a) return;
  const u = new URL(a.href, location.href);
  if (u.origin === location.origin && /\.html$/.test(u.pathname) && !u.searchParams.has('demo')) {
    u.searchParams.set('demo', '1'); a.href = u.href;
  }
}, true);
function demoScores(participants) {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const out = [];
  participants.forEach(t => {
    const base = 5 + rnd() * 4;
    participants.forEach(j => {
      if (rnd() < .12) return;
      out.push({ judge_token: j.token, target_id: t.id, score: Math.max(1, Math.min(10, Math.round(base + (rnd() - .5) * 4))) });
    });
  });
  return out;
}

/* 只去掉打给缺席者的分；缺席者之前打出的分照常算（中途离场的人已经打的分不作废）。数据都保留，取消缺席就回来 */
async function getScores() {
  const present = await getParticipants();
  if (DEMO) return demoScores(present);
  const ids = new Set(present.map(p => p.id));
  const rows = unwrap(await cloud.database.from('scores').select('judge_token, target_id, score, updated_at'));
  return rows.filter(s => ids.has(s.target_id));
}

async function getSettings() {
  const rows = unwrap(await cloud.database.from('settings').select('key, value'));
  const map = {};
  (rows || []).forEach(r => { map[r.key] = r.value; });
  if (DEMO) {   // 彩排：名单（缺席、工作人员）用真实的，其余用假的；网址参数可以覆盖
    const q = new URLSearchParams(location.search);
    return { draw_done: 'true', finalized: 'true', on_stage: q.get('stage') || '3',
      absent: q.has('absent') ? q.get('absent') : (map.absent || ''), staff: q.has('staff') ? q.get('staff') : (map.staff || '') };
  }
  return map;
}

async function getSetting(key) {
  if (DEMO) return (await getSettings())[key] ?? null;
  const { data } = await cloud.database.from('settings').select('value').eq('key', key).maybeSingle();
  return data ? data.value : null;
}

async function setSetting(key, value) {
  if (DEMO) return null;
  return unwrap(await cloud.database.from('settings').upsert({ key, value: String(value) }));
}

async function saveScore(token, targetId, score) {
  if (DEMO) return null;
  // 名次公布后就不收分了，免得颁奖结果和排名对不上（后台撤回公布即可重新打开）
  if (await getSetting('finalized') === 'true') { const e = new Error('closed'); e.closed = true; throw e; }
  return unwrap(await cloud.database.from('scores').upsert(
    { judge_token: token, target_id: targetId, score, updated_at: new Date().toISOString() },
    { onConflict: 'judge_token,target_id' }));
}

/* 计分：≥3 票去掉 1 个最高 + 1 个最低再平均；≤2 票直接平均 */
function calcFinal(scoreList) {
  const arr = scoreList.map(s => s.score);
  if (arr.length === 0) return { avg: null, count: 0, droppedMax: null, droppedMin: null };
  const used = arr.slice();
  let droppedMax = null, droppedMin = null;
  if (arr.length >= 3) {
    droppedMax = Math.max(...arr); used.splice(used.indexOf(droppedMax), 1);
    droppedMin = Math.min(...used); used.splice(used.indexOf(droppedMin), 1);
  }
  const avg = used.reduce((a, b) => a + b, 0) / used.length;
  return { avg: Math.round(avg * 100) / 100, count: arr.length, droppedMax, droppedMin };
}

/* 排名：同分同名次（1,2,2,4），没票的排最后 */
function buildRanking(participants, scores, judges) {
  const nameByToken = {};
  (judges || participants).forEach(p => { nameByToken[p.token] = p.name; });
  const rows = participants.map(p => {
    const list = scores.filter(s => s.target_id === p.id);
    const votes = list.map(s => ({ judge: nameByToken[s.judge_token] || '?', score: s.score }));
    return { ...p, ...calcFinal(list), votes };
  });
  rows.sort((a, b) => {
    if (a.avg === null && b.avg === null) return (a.draw_order || a.id) - (b.draw_order || b.id);
    if (a.avg === null) return 1;
    if (b.avg === null) return -1;
    return b.avg - a.avg || b.count - a.count;
  });
  let prev = null, rank = 0;
  rows.forEach((r, i) => {
    if (r.avg === null) { r.rank = null; return; }
    if (r.avg !== prev) { rank = i + 1; prev = r.avg; }
    r.rank = rank;
  });
  return rows;
}

/* 标出被剔除的那 1 个最高、1 个最低 */
function markDropped(r) {
  let maxLeft = r.droppedMax !== null ? 1 : 0, minLeft = r.droppedMin !== null ? 1 : 0;
  return r.votes.slice().sort((a, b) => b.score - a.score).map(v => {
    let dropped = false;
    if (maxLeft && v.score === r.droppedMax) { maxLeft--; dropped = true; }
    else if (minLeft && v.score === r.droppedMin) { minLeft--; dropped = true; }
    return { ...v, dropped };
  });
}

function byDrawOrder(list) {
  return list.slice().sort((a, b) => (a.draw_order || 999) - (b.draw_order || 999) || a.id - b.id);
}

function pad2(n) { return String(n).padStart(2, '0'); }

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* 管理口令：同一浏览器标签页内只问一次 */
function isAdmin() {
  try { return sessionStorage.getItem('camp_admin') === '1'; } catch (e) { return false; }
}
function markAdmin() {
  try { sessionStorage.setItem('camp_admin', '1'); } catch (e) {}
}

function askPass() {
  if (isAdmin()) return Promise.resolve(true);
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'pass-sheet';
    wrap.innerHTML = `<form class="pass-box">
        <label for="__pwd">管理口令</label>
        <input id="__pwd" type="password" autocomplete="off" inputmode="text">
        <div class="pass-actions">
          <button type="button" class="link-btn" data-x>取消</button>
          <button type="submit" class="btn btn-sm">确定</button>
        </div>
      </form>`;
    document.body.appendChild(wrap);
    const input = wrap.querySelector('input');
    setTimeout(() => input.focus(), 30);
    const close = ok => { wrap.remove(); resolve(ok); };
    wrap.querySelector('[data-x]').onclick = () => close(false);
    wrap.addEventListener('click', e => { if (e.target === wrap) close(false); });
    wrap.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      if (await checkPass(input.value)) { markAdmin(); close(true); }
      else { input.value = ''; wrap.querySelector('.pass-box').classList.add('shake'); setTimeout(() => wrap.querySelector('.pass-box').classList.remove('shake'), 400); }
    };
  });
}

function toast(msg, ok = true) {
  let t = document.getElementById('__toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '__toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.toggle('bad', !ok);
  t.classList.add('show');
  clearTimeout(t.__timer);
  t.__timer = setTimeout(() => t.classList.remove('show'), 1800);
}
