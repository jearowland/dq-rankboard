// tiny loader that won't collide if run twice
function loadOnce(id, mk) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) return resolve();
    const el = mk(); el.id = id;
    el.onload = () => resolve();
    el.onerror = (e) => reject(e);
    document.head.appendChild(el);
  });
}

Promise.resolve()
  // load CSS/JS (@latest)
  .then(() => loadOnce('dq-rankboard-css', () => { const l=document.createElement('link'); l.rel='stylesheet'; l.href='https://cdn.jsdelivr.net/gh/jearowland/dq-rankboard@latest/dq-rankboard.css'; return l; }))
  .then(() => loadOnce('sortablejs', () => { const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js'; return s; }))
  .then(() => loadOnce('dq-rankboard-js', () => { const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/gh/jearowland/dq-rankboard@latest/dq-rankboard.js'; return s; }))
  .then(() => {
    setTimeout(() => {
      const form = instance.root;
      const host = instance.element && instance.element.querySelector('#rankBoardHost');
      if (!host) { console.error('[STEP3] ❌ #rankBoardHost not found'); return; }

      // read grids via component (most reliable at render time)
      const brandsCmp = form.getComponent('brands');
      const questionsCmp = form.getComponent('questions');
      const brandsRaw = brandsCmp ? (brandsCmp.getValue ? brandsCmp.getValue() : brandsCmp.dataValue) : [];
      const questionsRaw = questionsCmp ? (questionsCmp.getValue ? questionsCmp.getValue() : questionsCmp.dataValue) : [];

      console.log('[STEP3] brandsRaw:', brandsRaw);
      console.log('[STEP3] questionsRaw:', questionsRaw);

      // normalize possible {data:{...}} rows
      const norm = r => (r && r.data && typeof r.data === 'object') ? r.data : (r || {});

      const brands = (Array.isArray(brandsRaw) ? brandsRaw : []).map((b, i) => {
        const r = norm(b);
        return { name: r.name, img: r.img, key: r.key || ('brand_' + (i+1)) };
      });
      const questions = (Array.isArray(questionsRaw) ? questionsRaw : []).map(q => norm(q).text);

      if (typeof window.initDqRankBoard !== 'function') {
        console.error('[STEP3] ❌ initDqRankBoard not available'); return;
      }

      // render (fallback only if truly empty so you still see something)
      const useFallback = (!brands.length || !questions.length);
      const finalBrands = brands.length ? brands : [
        { name: 'Brand A', img: 'https://dummyimage.com/60x60/000/fff.png&text=A', key: 'brand_a' },
        { name: 'Brand B', img: 'https://dummyimage.com/60x60/333/fff.png&text=B', key: 'brand_b' },
        { name: 'Brand C', img: 'https://dummyimage.com/60x60/666/fff.png&text=C', key: 'brand_c' }
      ];
      const finalQuestions = questions.length ? questions : [
        'How likely are you to recommend this brand?',
        'Does this brand meet your expectations?',
        'Would you purchase from this brand again?'
      ];

      try {
        window.initDqRankBoard(host, { brands: finalBrands, questions: finalQuestions });
        console.log(`[STEP3] ✅ RankBoard rendered (${finalBrands.length} brands, ${finalQuestions.length} questions)${useFallback ? ' [FALLBACK]' : ''}`);
      } catch (e) {
        console.error('[STEP3] ❌ Error initializing RankBoard:', e);
      }
    }, 300); // small delay lets the grids hydrate
  })
  .catch(e => console.error('[STEP3] ❌ Failed to load assets', e));