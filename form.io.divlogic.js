// ---------- minimal loader with retry + fallback ----------
function loadOnce(id, mk) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) return resolve();
    const el = mk(); el.id = id;
    el.onload = () => { console.log('[RB] loaded:', id); resolve(); };
    el.onerror = (e) => { console.error('[RB] load failed:', id, e); reject(e); };
    document.head.appendChild(el);
  });
}
function waitFor(testFn, tries = 30, delay = 100) {
  return new Promise((resolve, reject) => {
    (function loop(n){
      try {
        if (testFn()) return resolve(true);
      } catch (e) {}
      if (n <= 0) return reject(new Error('timeout'));
      setTimeout(() => loop(n - 1), delay);
    })(tries);
  });
}

(async () => {
  // 0) quick sanity: do we have host + form?
  const host = instance.element && instance.element.querySelector('#rankBoardHost');
  if (!host) { console.error('[RB] ❌ #rankBoardHost not found'); return; }
  const form = instance.root;
  if (!form) { console.error('[RB] ❌ No form instance (instance.root)'); return; }

  try {
    // 1) load CSS + Sortable + dq-rankboard @latest
    await loadOnce('dq-rankboard-css', () => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'https://cdn.jsdelivr.net/gh/jearowland/dq-rankboard@latest/dq-rankboard.css';
      return l;
    });
    await loadOnce('sortablejs', () => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js';
      return s;
    });
    await loadOnce('dq-rankboard-js-latest', () => {
      const s = document.createElement('script');
      s.src = 'https://jearowland.github.io/dq-rankboard/dq-rankboard.js';
      return s;
    });

    // 2) wait up to ~3s for the global to appear
    try {
      await waitFor(() => typeof window.initDqRankBoard === 'function', 30, 100);
    } catch {
      console.warn('[RB] @latest did not expose initDqRankBoard — trying @main as fallback...');
      // 2b) load @main as a fallback (older but known-good global)
      await loadOnce('dq-rankboard-js-main', () => {
        const s = document.createElement('script');
        s.src = 'https://jearowland.github.io/dq-rankboard/dq-rankboard.js';
        return s;
      });
      await waitFor(() => typeof window.initDqRankBoard === 'function', 30, 100);
    }

    // 3) resolve brands/questions from components (most reliable in portal)
    const brandsCmp = form.getComponent && form.getComponent('brands');
    const questionsCmp = form.getComponent && form.getComponent('questions');
    const brandsRaw = brandsCmp ? (brandsCmp.getValue ? brandsCmp.getValue() : brandsCmp.dataValue) : [];
    const questionsRaw = questionsCmp ? (questionsCmp.getValue ? questionsCmp.getValue() : questionsCmp.dataValue) : [];
    const norm = (r) => (r && r.data && typeof r.data === 'object') ? r.data : (r || {});
    const brands = (Array.isArray(brandsRaw) ? brandsRaw : []).map((b, i) => {
      const r = norm(b);
      return { name: r.name, img: r.img, key: r.key || ('brand_' + (i+1)) };
    });
    const questions = (Array.isArray(questionsRaw) ? questionsRaw : []).map(q => norm(q).text);

    if (!brands.length || !questions.length) {
      console.warn('[RB] Using fallback data because grids were empty at init.');
    }

    // 4) init
    window.initDqRankBoard(host, {
      brands: brands.length ? brands : [
        { name:'Brand A', img:'https://dummyimage.com/60x60/000/fff.png&text=A', key:'brand_a' },
        { name:'Brand B', img:'https://dummyimage.com/60x60/333/fff.png&text=B', key:'brand_b' },
        { name:'Brand C', img:'https://dummyimage.com/60x60/666/fff.png&text=C', key:'brand_c' }
      ],
      questions: questions.length ? questions : [
        'How likely are you to recommend this brand?',
        'Does this brand meet your expectations?',
        'Would you purchase from this brand again?'
      ]
    });
    console.log('[RB] ✅ RankBoard initialised');
  } catch (e) {
    // super helpful breadcrumbs
    console.error('[RB] ❌ Failed to initialize RankBoard:', e);
    console.log('[RB] typeof initDqRankBoard =', typeof window.initDqRankBoard);
    console.log('[RB] window keys with "rankboard":',
      Object.keys(window).filter(k => k.toLowerCase().includes('rankboard')));
  }
})();