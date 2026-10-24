/* GitHub Pages 外壳：把 app/ 里同名的页面装进沙盒框。
   沙盒框发出的请求不带来源，WorkBuddy 数据库才肯收（它拒绝别的网址发来的请求）。
   框里不能用浏览器存储，由这里代存：开框时交给它（window.name），它改了再发回来。 */
(function () {
  const page = location.pathname.split('/').pop() || 'index.html';
  let st = { l: {}, s: {} };
  try {
    st.l = JSON.parse(localStorage.getItem('camp_store_l') || '{}');
    st.s = JSON.parse(sessionStorage.getItem('camp_store_s') || '{}');
  } catch (e) {}
  const f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-downloads allow-popups allow-popups-to-escape-sandbox');
  f.setAttribute('allow', 'clipboard-write; autoplay; fullscreen');
  f.name = 'camp_store:' + JSON.stringify(st);
  f.src = 'app/' + page + location.search + location.hash;
  document.body.appendChild(f);
  addEventListener('message', e => {
    if (e.source !== f.contentWindow) return;
    const d = e.data || {};
    if (d.campStore) try {
      localStorage.setItem('camp_store_l', JSON.stringify(d.campStore.l));
      sessionStorage.setItem('camp_store_s', JSON.stringify(d.campStore.s));
    } catch (err) {}
    if (d.campNav) {
      try { history.replaceState(null, '', d.campNav.url); } catch (err) {}
      if (d.campNav.title) document.title = d.campNav.title;
    }
  });
})();
