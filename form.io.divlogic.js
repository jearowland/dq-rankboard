(function () {
  // Run once per render of this Content/HTML component
  if (instance._rbInit) return;
  instance._rbInit = true;

  // --- tiny helpers ---
  function loadOnce(id, mk) {
    return new Promise(function(resolve, reject){
      if (document.getElementById(id)) return resolve();
      var el = mk(); el.id = id;
      el.onload = function(){ resolve(); };
      el.onerror = function(e){ reject(e); };
      document.head.appendChild(el);
    });
  }
  function waitFor(test, tries, delay) {
    return new Promise(function(resolve, reject){
      (function loop(n){
        try { if (test()) return resolve(true); } catch (e) {}
        if (n <= 0) return reject(new Error('timeout'));
        setTimeout(function(){ loop(n-1); }, delay);
      })(tries);
    });
  }
  function debounce(fn, wait){ var t; return function(){ clearTimeout(t); var a=arguments; t=setTimeout(function(){ fn.apply(null,a); }, wait); }; }
  function safeStringify(v){ try { return JSON.stringify(v); } catch(e){ return ''; } }

  // --- 0) locate form + host ---
  var form = instance.root;
  var host = instance.element && instance.element.querySelector('#rankBoardHost');
  if (!form) { console.error('[RB] missing form instance'); return; }
  if (!host) { console.error('[RB] #rankBoardHost not found inside this Content component'); return; }

  (async function run(){
    try {
      // --- 1) deps: CSS + Sortable + rankboard JS ---
      await loadOnce('dq-rankboard-css', function(){
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = 'https://cdn.jsdelivr.net/gh/jearowland/dq-rankboard@latest/dq-rankboard.css';
        return l;
      });
      await loadOnce('sortablejs', function(){
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js';
        return s;
      });
      await loadOnce('dq-rankboard-js', function(){
        var s = document.createElement('script');
        s.src = 'https://jearowland.github.io/dq-rankboard/dq-rankboard.js';
        return s;
      });
      await waitFor(function(){ return typeof window.initDqRankBoard === 'function'; }, 30, 100);

      // --- 2) read Brands / Questions from Edit Grids ---
      var brandsCmp = form.getComponent('brands');
      var questionsCmp = form.getComponent('questions');
      var brandsRaw = brandsCmp ? (brandsCmp.getValue ? brandsCmp.getValue() : brandsCmp.dataValue) : [];
      var questionsRaw = questionsCmp ? (questionsCmp.getValue ? questionsCmp.getValue() : questionsCmp.dataValue) : [];
      var norm = function(r){ return (r && r.data && typeof r.data === 'object') ? r.data : (r || {}); };
      var brands = (Array.isArray(brandsRaw) ? brandsRaw : []).map(function(b,i){
        var r = norm(b); return { name: r.name, img: r.img, key: r.key || ('brand_' + (i+1)) };
      });
      var questions = (Array.isArray(questionsRaw) ? questionsRaw : []).map(function(q){ return norm(q).text; });

      // --- 3) hidden sink for persistence ---
      var sink = form.getComponent('rankBoardData');
      function setSink(val){
        if (!sink) return;
        try { if (typeof sink.setValue === 'function') return sink.setValue(val); } catch(e){}
        try { if (typeof sink.updateValue === 'function') return sink.updateValue(val); } catch(e){}
        try { sink.dataValue = val; if (typeof sink.triggerChange === 'function') sink.triggerChange({ modified: true }); } catch(e){}
      }
      function getSink(){
        if (!sink) return undefined;
        try { if (typeof sink.getValue === 'function') return sink.getValue(); } catch(e){}
        return sink.dataValue;
      }

      // --- 4) restore saved state, if any ---
      var initialState = (sink ? getSink() : null) ||
                         (form.submission && form.submission.data && form.submission.data.rankBoardData) ||
                         null;

      // --- 5) init board, save back politely ---
      var initializing = true;
      var lastSaved = safeStringify(initialState || []);
      var debouncedSave = debounce(function(state){
        var now = safeStringify(state || []);
        if (now === lastSaved) return;
        lastSaved = now;
        setSink(state);
      }, 150);

      var rb = window.initDqRankBoard(host, {
        brands: brands.length ? brands : [
          { name:'Brand A', img:'https://dummyimage.com/60x60/000/fff.png&text=A', key:'brand_a' },
          { name:'Brand B', img:'https://dummyimage.com/60x60/333/fff.png&text=B', key:'brand_b' },
          { name:'Brand C', img:'https://dummyimage.com/60x60/666/fff.png&text=C', key:'brand_c' }
        ],
        questions: questions.length ? questions : [
          'How likely are you to recommend this brand?',
          'Does this brand meet your expectations?',
          'Would you purchase from this brand again?'
        ],
        initialState: initialState,
        onChange: function(state){
          if (initializing) return;
          debouncedSave(state);
        }
      });

      // --- 6) seed hidden field once so it's never empty ---
      if (sink) {
        var current = getSink();
        var empty = (current == null) || (Array.isArray(current) && current.length === 0);
        if (empty) {
          var seed = rb.getResultsJson();
          lastSaved = safeStringify(seed);
          setSink(seed);
        } else {
          lastSaved = safeStringify(current);
        }
      }

      setTimeout(function(){ initializing = false; }, 100);
      console.log('[RB] ✅ RankBoard initialised');
    } catch (e) {
      console.error('[RB] ❌ init failed', e);
    }
  })();
})();
