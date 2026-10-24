/* 装饰与动效公共件：放射金线、数字滚动、金纸 */

/* 在 .rays 容器里画放射金线；rays(el, {count, slow}) */
function drawRays(el, opt = {}) {
  const n = opt.count || 44, W = 1600, H = 1200, cx = W / 2;
  let lines = '';
  for (let i = 0; i <= n; i++) {
    const a = Math.PI * (i / n);
    lines += `<line x1="${cx}" y1="0" x2="${cx + Math.cos(a) * 1700}" y2="${Math.sin(a) * 1700}"/>`;
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMin slice">
    <g stroke="rgba(161,122,53,.16)" stroke-width="1.2">${lines}</g>
    <circle cx="${cx}" cy="0" r="300" fill="none" stroke="rgba(161,122,53,.32)"/>
    <circle cx="${cx}" cy="0" r="314" fill="none" stroke="rgba(161,122,53,.18)"/>
    <circle cx="${cx}" cy="0" r="520" fill="none" stroke="rgba(161,122,53,.12)" stroke-dasharray="2 8"/>
  </svg>`;
  if (opt.spin && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.querySelector('g').animate([{ transform: 'rotate(-2deg)' }, { transform: 'rotate(2deg)' }],
      { duration: 9000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }).effect.target.style.transformOrigin = `${cx}px 0px`;
  }
}
document.querySelectorAll('.rays').forEach(el => drawRays(el, { spin: el.dataset.spin !== undefined }));

/* 数字滚动到目标值：countTo(el, 8.47, {digits:2, ms:700}) */
function countTo(el, to, opt = {}) {
  const digits = opt.digits ?? 2, ms = opt.ms ?? 700;
  const from = parseFloat(el.dataset.v ?? el.textContent) || 0;
  el.dataset.v = to;
  const tok = el.__tok = {};          // 新的一次滚动或 stopCount 会让旧动画停下
  if (from === to) { el.textContent = to.toFixed(digits); return; }
  const t0 = performance.now();
  (function f(t) {
    if (el.__tok !== tok) return;
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = (from + (to - from) * e).toFixed(digits);
    if (k < 1) requestAnimationFrame(f);
  })(t0);
}

/* 停掉数字滚动并直接写字 */
function stopCount(el, text) { el.__tok = null; delete el.dataset.v; el.textContent = text; }

/* 金纸：长条纸片翻转飘落 */
function confetti(opt = {}) {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;z-index:60;pointer-events:none';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
  const colors = opt.colors || ['#c7952f', '#f1d58a', '#e3b85c', '#0f5c4d', '#9b2438', '#213f8c', '#fbf8f1'];
  const bits = Array.from({ length: opt.count || 180 }, (_, i) => ({
    x: W / 2 + (Math.random() - .5) * W * .7, y: -20 - Math.random() * H * .7,
    vx: (Math.random() - .5) * 2.4, vy: 1.8 + Math.random() * 2.6,
    w: 6 + Math.random() * 6, h: 12 + Math.random() * 12,
    a: Math.random() * Math.PI, va: (Math.random() - .5) * .2, flip: Math.random() * 6, vf: .08 + Math.random() * .12,
    c: colors[i % colors.length]
  }));
  const t0 = performance.now();
  (function f(t) {
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    bits.forEach(b => {
      b.x += b.vx + Math.sin(b.flip) * .6; b.y += b.vy; b.a += b.va; b.flip += b.vf;
      if (b.y < H + 30) alive = true;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.scale(1, Math.cos(b.flip));
      ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore();
    });
    if (alive && t - t0 < 10000) requestAnimationFrame(f); else cv.remove();
  })(t0);
}
