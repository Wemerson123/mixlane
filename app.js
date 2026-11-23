(() => {
  const P = window.PRODUCTS;
  const byId = Object.fromEntries(P.map(p => [p.id, p]));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const money = n => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

  // ---------- cart state (per-viewer convenience only) ----------
  let cart = {};
  try { cart = JSON.parse(localStorage.getItem('mixlane-cart') || '{}') || {}; } catch { cart = {}; }
  const save = () => { try { localStorage.setItem('mixlane-cart', JSON.stringify(cart)); } catch {} };

  // ---------- grid ----------
  const grid = $('[data-grid]');
  const giftIds = new Set(['slushie-mini', 'fryer-r35', 'blender', 'sealer']); // Christmas gift guide picks
  // The last tile fills the row and points to Instagram; it only shows when nothing is filtered.
  const followTile = `
    <li class="card card-follow reveal" data-follow>
      <a href="https://www.instagram.com/mixlane.au/" target="_blank" rel="noopener">
        <span class="follow-eyebrow">Instagram</span>
        <span class="follow-title">New arrivals, first on Instagram.</span>
        <span class="follow-handle">@mixlane.au</span>
      </a>
    </li>`;
  grid.innerHTML = P.map((p, i) => `
    <li class="card reveal" data-cat="${p.cat}" data-id="${p.id}" data-order="${i}">
      ${giftIds.has(p.id) ? '<span class="card-gift">Gift pick</span>' : ''}
      <button type="button" data-open="${p.id}" aria-label="${p.name}, ${money(p.price)}">
        <div class="card-img"><img src="${p.img}" alt="${p.name}" loading="lazy"></div>
        <div class="card-info">
          <p class="card-model">${p.model}${p.key ? `<span>${p.key}</span>` : ''}</p>
          <h3 class="card-name">${p.name}</h3>
          <p class="card-line">${p.line}</p>
          <p class="card-price">${money(p.price)}</p>
        </div>
      </button>
      <button class="card-add" type="button" aria-label="Add ${p.name} to cart" data-quick-add="${p.id}">+</button>
    </li>`).join('') + followTile;

  // ---------- compare: the four glass air fryers, straight from the product data ----------
  const cmp = $('[data-compare]');
  if (cmp) {
    const F = P.filter(p => p.cat === 'fryers');
    const spec = (p, re) => { const s = p.specs.find(([k]) => re.test(k)); return s ? s[1] : '—'; };
    const row = (label, fn) => `<tr><th scope="row">${label}</th>${F.map(p => `<td>${fn(p)}</td>`).join('')}</tr>`;
    cmp.innerHTML = `
      <thead><tr><td></td>${F.map(p => `
        <th scope="col">
          <span class="cmp-img"><img src="${p.img}" alt="" loading="lazy"></span>
          <span class="cmp-model">Model ${p.model}</span>
          <span class="cmp-name">${p.name.replace('Glass Air Fryer, ', '')}</span>
        </th>`).join('')}</tr></thead>
      <tbody>
        ${row('Design', p => p.line)}
        ${row('Bowls', p => spec(p, /^Bowl/))}
        ${row('In the box', p => spec(p, /box/i))}
        ${row('Power', p => spec(p, /^Power/))}
        ${row('Price', p => `<span class="cmp-price">${money(p.price)}</span>`)}
        <tr><td></td>${F.map(p => `<td><button type="button" class="cmp-btn" data-open="${p.id}" aria-label="View ${p.name}">View</button></td>`).join('')}</tr>
      </tbody>`;
  }

  $$('[data-price-of]').forEach(el => { el.textContent = money(byId[el.dataset.priceOf].price); });
  ['all', 'frozen', 'fryers', 'kitchen'].forEach(c => {
    const el = $(`[data-count="${c}"]`);
    if (el) el.textContent = c === 'all' ? P.length : P.filter(p => p.cat === c).length;
  });

  // ---------- filters ----------
  const shopCount = $('[data-shop-count]');
  const shopCountWord = $('[data-shop-count-word]');
  const setFilter = cat => {
    $$('[data-filter-btn]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filterBtn === cat)));
    let shown = 0;
    $$('.card[data-id]').forEach(c => {
      const show = cat === 'all' || c.dataset.cat === cat;
      c.classList.toggle('is-hidden', !show);
      if (show) { c.classList.add('in'); shown++; }
    });
    const follow = $('[data-follow]');
    if (follow) follow.classList.toggle('is-hidden', cat !== 'all');
    if (shopCount) shopCount.textContent = shown;
    if (shopCountWord) shopCountWord.textContent = shown === 1 ? 'product' : 'products';
  };

  // ---------- sort ----------
  const sortSel = $('[data-sort]');
  const applySort = () => {
    const mode = sortSel.value;
    const cards = $$('.card[data-id]', grid);
    const price = c => byId[c.dataset.id].price;
    cards.sort((a, b) => mode === 'low' ? price(a) - price(b) : mode === 'high' ? price(b) - price(a) : a.dataset.order - b.dataset.order);
    const follow = $('[data-follow]', grid);
    cards.forEach(c => { c.classList.add('in'); grid.insertBefore(c, follow); });
  };
  if (sortSel) sortSel.addEventListener('change', applySort);
  $$('[data-filter-btn]').forEach(b => b.addEventListener('click', () => setFilter(b.dataset.filterBtn)));
  $$('[data-filter], [data-filter-jump]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    setFilter(a.dataset.filter || a.dataset.filterJump);
    $('#shop').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }));

  // ---------- drawers ----------
  const scrim = $('[data-scrim]');
  const pd = $('[data-product-drawer]');
  const cd = $('[data-cart-drawer]');
  let lastFocus = null;
  let current = null;
  let qty = 1;

  const open = drawer => {
    // moving from one product to another inside the drawer keeps the element that opened it first
    if (!pd.classList.contains('open') && !cd.classList.contains('open')) lastFocus = document.activeElement;
    [pd, cd].forEach(d => { if (d !== drawer) close(d, true); });
    scrim.hidden = false;
    requestAnimationFrame(() => scrim.classList.add('on'));
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('[data-close]', drawer).focus(), 50);
  };
  const close = (drawer, silent) => {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    if (silent) return;
    scrim.classList.remove('on');
    setTimeout(() => { if (!pd.classList.contains('open') && !cd.classList.contains('open')) scrim.hidden = true; }, 300);
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  };
  const closeAll = () => { [pd, cd].forEach(d => d.classList.contains('open') && close(d)); };

  const openProduct = id => {
    const p = byId[id];
    current = p; qty = 1;
    $('[data-qty-out]').textContent = qty;
    const img = $('[data-pd-img]');
    img.src = p.img; img.alt = p.name;
    $('[data-pd-model]').textContent = 'Model ' + p.model;
    $('[data-pd-name]').textContent = p.name;
    $('[data-pd-line]').textContent = p.line;
    $('[data-pd-price]').innerHTML = `${money(p.price)}<small>incl. GST</small>`;
    $('[data-pd-specs]').innerHTML = p.specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    const also = (p.pairs || []).map(x => byId[x]).filter(Boolean);
    $('[data-pd-also]').innerHTML = also.length ? `
      <h3 class="pd-specs-title">Goes well with</h3>
      <ul class="pd-also-list">${also.map(o => `
        <li>
          <button type="button" class="pd-also-item" data-open="${o.id}">
            <span class="thumb"><img src="${o.img}" alt=""></span>
            <span><b>${o.name}</b><i>${money(o.price)}</i></span>
          </button>
          <button type="button" class="pd-also-add" data-quick-add="${o.id}" aria-label="Add ${o.name} to cart">Add</button>
        </li>`).join('')}</ul>` : '';
    pd.scrollTop = 0;
    open(pd);
  };

  document.addEventListener('click', e => {
    const t = e.target;
    const quickAdd = t.closest('[data-quick-add]');
    if (quickAdd) { add(quickAdd.dataset.quickAdd, 1); return; }
    const o = t.closest('[data-open]'); if (o) return openProduct(o.dataset.open);
    const q = t.closest('[data-quick]'); if (q) return openProduct(q.dataset.quick);
    if (t.closest('[data-open-cart]')) { renderCart(); return open(cd); }
    if (t.closest('[data-close]') || t === scrim) return closeAll();
    const qb = t.closest('[data-qty]');
    if (qb) { qty = Math.max(1, Math.min(20, qty + Number(qb.dataset.qty))); $('[data-qty-out]').textContent = qty; return; }
    if (t.closest('[data-add]') && current) { add(current.id, qty); close(pd); return; }
    const rm = t.closest('[data-ci-remove]');
    if (rm) { setQty(rm.dataset.ciRemove, 0); return; }
    const ci = t.closest('[data-ci]');
    if (ci) { setQty(ci.dataset.ci, (cart[ci.dataset.ci] || 0) + Number(ci.dataset.d)); return; }
    if (t.closest('[data-checkout]')) { $('[data-checkout-msg]').hidden = false; }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAll();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-quick-add]')) { e.preventDefault(); add(e.target.dataset.quickAdd, 1); }
  });

  // ---------- cart ----------
  const countEl = $('[data-cart-count]');
  const toastEl = $('[data-toast]');
  let toastT;
  const toast = msg => {
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 2200);
  };
  const updateCount = bump => {
    const n = Object.values(cart).reduce((a, b) => a + b, 0);
    countEl.textContent = n;
    countEl.toggleAttribute('data-zero', n === 0);
    if (bump) { countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump'); }
  };
  const add = (id, n) => {
    cart[id] = (cart[id] || 0) + n; save(); updateCount(true); renderCart();
    toast(`${byId[id].name} added`);
  };
  const setQty = (id, n) => {
    if (n <= 0) delete cart[id]; else cart[id] = Math.min(20, n);
    save(); updateCount(false); renderCart();
  };
  const renderCart = () => {
    const ids = Object.keys(cart).filter(id => byId[id]);
    $('[data-cart-items]').innerHTML = ids.map(id => {
      const p = byId[id];
      return `<li class="cart-item">
        <div class="thumb"><img src="${p.img}" alt=""></div>
        <div><h3>${p.name}</h3>
          <div class="ci-meta mono">
            <button type="button" data-ci="${id}" data-d="-1" aria-label="One less">−</button>
            <span>${cart[id]}</span>
            <button type="button" data-ci="${id}" data-d="1" aria-label="One more">+</button>
            <button type="button" class="ci-remove" data-ci-remove="${id}" aria-label="Remove ${p.name}">Remove</button>
          </div></div>
        <span class="ci-price">${money(p.price * cart[id])}</span>
      </li>`;
    }).join('');
    const total = ids.reduce((s, id) => s + byId[id].price * cart[id], 0);
    $('[data-cart-empty]').hidden = ids.length > 0;
    $('[data-subtotal]').textContent = money(total);
    $('[data-gst]').textContent = money(Math.round(total / 11 * 100) / 100); // AU GST-inclusive: 1/11
    $('[data-checkout]').disabled = !ids.length;
    $('[data-checkout-msg]').hidden = true;
  };
  updateCount(false);
  // arriving from the landing page's "Add to cart" → open the cart straight away
  if (location.hash === '#cart') { renderCart(); setTimeout(() => open(cd), 300); history.replaceState(null, '', location.pathname); }

  // ---------- reveal (time-safe: never leaves content hidden) ----------
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el, i) => { el.style.transitionDelay = (i % 3) * 70 + 'ms'; io.observe(el); });
    setTimeout(() => reveals.forEach(el => el.classList.add('in')), 2500);
  } else {
    reveals.forEach(el => el.classList.add('in'));
  }
})();
