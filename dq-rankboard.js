/* dq-rankboard SHIM — minimal, non-invasive.
   - Keeps existing DOM & behavior.
   - Adds onChange(state) emission (debounced) using DOM reads.
   - Adds getState() helper to the returned API.
*/

(function(){
  if (typeof window.initDqRankBoard !== 'function') {
    console.error('[RB shim] initDqRankBoard not found. Load original file first.');
    return;
  }

  var origInit = window.initDqRankBoard;

  function debounce(fn, wait){ var t; return function(){ clearTimeout(t); var a=arguments; t=setTimeout(function(){ fn.apply(null,a); }, wait); }; }

  // DOM readers – adjust selectors ONLY if your original markup differs.
  function buildState(container) {
    var list = container.querySelector('[data-rankboard-list]') || container.querySelector('.rb-list');
    var order = list ? Array.from(list.children).map(function(el){ return el.getAttribute('data-brand-key'); }).filter(Boolean) : [];

    var scores = {};
    Array.from(container.querySelectorAll('[data-score]')).forEach(function(input){
      var b = input.getAttribute('data-brand');
      var q = input.getAttribute('data-question');
      if (!b || !q) return;
      var v = input.value;
      if (v === '') return;
      var n = Number(v);
      if (Number.isNaN(n)) return;
      (scores[b] || (scores[b] = {}))[q] = n;
    });

    var notes = {};
    Array.from(container.querySelectorAll('[data-note]')).forEach(function(ta){
      var b = ta.getAttribute('data-brand');
      if (!b) return;
      var v = ta.value;
      if (!v) return;
      (notes[b] || (notes[b] = {})).all = v;
    });

    return { order: order, scores: scores, notes: notes };
  }

  window.initDqRankBoard = function(container, options){
    var opts = options || {};
    var api = origInit(container, opts);   // call the original, unmodified

    // Debounced emitter -> options.onChange(state)
    var emit = debounce(function(){
      if (typeof opts.onChange === 'function') {
        try { opts.onChange(buildState(container)); } catch(e){ console.warn('[RB shim] onChange error', e); }
      }
    }, 120);

    // Wire typical interactions (non-invasive: listen only)
    container.addEventListener('input', function(e){
      var t = e.target;
      if (!t) return;
      if (t.matches('[data-score]') || t.matches('[data-note]')) emit();
    });
    container.addEventListener('change', function(e){
      var t = e.target;
      if (!t) return;
      if (t.matches('[data-score]') || t.matches('[data-note]')) emit();
    });

    // If Sortable is used, also emit after drags (listen for common event)
    container.addEventListener('sortupdate', emit); // some libs dispatch this
    // If your original creates Sortable on an element, fallback to a generic mouseup as last resort:
    container.addEventListener('mouseup', function(e){
      var t = e.target;
      if (t && (t.classList && t.classList.contains('drag-handle'))) emit();
    });

    // Emit once so the host can capture initial state
    try { emit(); } catch(_) {}

    // Return original API, plus getState()
    var shimApi = api || {};
    shimApi.getState = function(){ return buildState(container); };
    return shimApi;
  };
})();

// ---- minimal global export (append to the very end of the file) ----
if (typeof window !== 'undefined' && typeof initDqRankBoard === 'function') {
  window.initDqRankBoard = initDqRankBoard;
}