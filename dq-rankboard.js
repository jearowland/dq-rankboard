(() => {
  // Avoid redefining if script is loaded multiple times
  if (window.initDqRankBoard) return;

  window.initDqRankBoard = function initDqRankBoard(container, config) {
    const {
      brands,
      questions,
      scaleLabels = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"],
      scaleWeight,
      onChange,        // optional callback(stateArray)
      initialState,    // optional restore array [{question, brand, scale, rank?, value?}, ...]
      questionMeta,    // optional: array aligned with `questions` -> {domain, subdomain}
      questionMetaMap  // optional: map keyed by question text -> {domain, subdomain}
    } = config;

    const weight = scaleWeight || Object.fromEntries(scaleLabels.map((l, i) => [l, i + 1]));

    // ------- helpers -------
    function metaFor(idx, qText) {
      if (questionMeta && questionMeta[idx]) return questionMeta[idx];
      if (questionMetaMap && qText && questionMetaMap[qText]) return questionMetaMap[qText];
      return { domain: null, subdomain: null };
    }
    function norm(s) {
      return (s == null || s === '') ? null : String(s);
    }

    // Build a nested structure: Domain -> Subdomain -> [{qText, qIndex}]
    function buildDomainStructure() {
      const anyMeta = !!(questionMeta || questionMetaMap);
      if (!anyMeta) {
        // single bucket: no domain/subdomain grouping
        return { '': { '': questions.map((q, i) => ({ qText: q, qIndex: i })) } };
      }
      const struct = {};
      questions.forEach((q, i) => {
        const m = metaFor(i, q) || {};
        const domain = norm(m.domain) || 'Other';
        const subdomain = norm(m.subdomain) || '';
        if (!struct[domain]) struct[domain] = {};
        if (!struct[domain][subdomain]) struct[domain][subdomain] = [];
        struct[domain][subdomain].push({ qText: q, qIndex: i });
      });
      return struct;
    }

    // ------- DOM build -------
    container.innerHTML = '';
    const board = document.createElement('div');
    board.className = 'dq-board';

    // Header row (fixed)
    board.innerHTML = `<div class="dq-header-row">
      <div class="dq-header-spacer"></div>
      <div class="dq-header-unsorted">Unsorted</div>
      ${scaleLabels.map(l => `<div class="dq-header-col">${l}</div>`).join('')}
    </div>`;

    const structure = buildDomainStructure();

    // Fast lookup map: question text -> row element
    const questionToRowEl = new Map();

    // Build per domain -> subdomain -> rows
    Object.keys(structure).forEach(domain => {
      const domainSection = document.createElement('div');
      domainSection.className = 'dq-domain-section';
      domainSection.dataset.domain = domain || '';

      // Domain header (once)
      if (domain) {
        const d = document.createElement('div');
        d.className = 'dq-domain-header';
        d.textContent = domain;
        domainSection.appendChild(d);
      }

      // Subdomains
      Object.keys(structure[domain]).forEach(subdomain => {
        const subSection = document.createElement('div');
        subSection.className = 'dq-subdomain-section';
        subSection.dataset.subdomain = subdomain || '';

        if (subdomain) {
          const s = document.createElement('div');
          s.className = 'dq-subdomain-header';
          s.textContent = subdomain;
          subSection.appendChild(s);
        }

        // Rows (questions) under this subdomain
        structure[domain][subdomain].forEach(({ qText, qIndex }) => {
          const row = document.createElement('div');
          row.className = 'dq-row';
          row.dataset.qIndex = String(qIndex);
          const m = metaFor(qIndex, qText);
          if (m && m.domain) row.dataset.domain = m.domain;
          if (m && m.subdomain) row.dataset.subdomain = m.subdomain;

          row.innerHTML = `<div class="dq-row-label">${qText}</div>`;

          // Unsorted column
          const uns = document.createElement('div');
          uns.className = 'dq-unsorted';
          const ulUns = document.createElement('ul');
          ulUns.className = 'dq-card-list';
          // group name per question keeps drags row-locked
          const groupName = `row-${qIndex}`;
          ulUns.dataset.row = groupName;

          brands.forEach(b => {
            const li = document.createElement('li');
            li.dataset.brand = b.name;
            li.innerHTML = `<img src="${b.img}" alt="${b.name}"><div>${b.name}</div><div class="dq-badge"></div>`;
            ulUns.appendChild(li);
          });
          uns.appendChild(ulUns);
          row.appendChild(uns);

          // Likert columns
          scaleLabels.forEach(() => {
            const col = document.createElement('div');
            col.className = 'dq-col';
            const ul = document.createElement('ul');
            ul.className = 'dq-card-list';
            ul.dataset.row = groupName;
            col.appendChild(ul);
            row.appendChild(col);
          });

          subSection.appendChild(row);
          questionToRowEl.set(qText, row);
        });

        domainSection.appendChild(subSection);
      });

      board.appendChild(domainSection);
    });

    container.appendChild(board);

    // ------- DnD wiring (row-locked) -------
    board.querySelectorAll('.dq-row').forEach(row => {
      const groupName = row.querySelector('ul.dq-card-list')?.dataset.row || `row-${row.dataset.qIndex}`;
      row.querySelectorAll('ul.dq-card-list').forEach(ul => {
        ul.dataset.row = groupName;
        new Sortable(ul, {
          group: { name: groupName, pull: true, put: true },
          animation: 150,
          onMove: e => e.from.dataset.row === e.to.dataset.row, // lock to row
          onSort: () => { updateRanks(); triggerChange(); }
        });
      });
    });

    // ------- ranking (badge = global rank per row) -------
    function updateRanks() {
      board.querySelectorAll('.dq-row').forEach(row => {
        const lists = Array.from(row.querySelectorAll('ul.dq-card-list'));
        const ranked = [];

        lists.forEach((ul, i) => {
          if (i === 0) {
            ul.querySelectorAll('.dq-badge').forEach(b => b.textContent = '');
            return; // skip Unsorted
          }
          const scale = scaleLabels[i - 1];
          const children = Array.from(ul.children);
          children.forEach((li, pos) => {
            ranked.push({ li, score: weight[scale] * 10 + (children.length - pos) });
          });
        });

        ranked.sort((a, b) => b.score - a.score)
              .forEach((c, i) => c.li.querySelector('.dq-badge').textContent = i + 1);
      });
    }

    // Emit state via onChange
    function triggerChange() {
      if (typeof onChange === 'function') {
        onChange(api.getResultsJson());
      }
    }

    // ------- Public API -------
    const api = {
      getResultsJson() {
        const out = [];
        board.querySelectorAll('.dq-row').forEach(row => {
          const qIdx = parseInt(row.dataset.qIndex, 10);
          const q = questions[qIdx];
          const m = metaFor(qIdx, q);
          row.querySelectorAll('.dq-col').forEach((col, cIdx) => {
            const scale = scaleLabels[cIdx];
            const scaleVal = weight[scale];
            Array.from(col.querySelectorAll('li')).forEach(li => {
              const badge = li.querySelector('.dq-badge');
              const globalRank = parseInt(badge && badge.textContent, 10);
              out.push({
                domain: m.domain || null,
                subdomain: m.subdomain || null,
                question: q,
                brand: li.dataset.brand,
                scale,
                rank: Number.isFinite(globalRank) ? globalRank : null,
                value: scaleVal
              });
            });
          });
        });
        return out;
      },
      setState(state) {
        restoreState(state);
        updateRanks();
        triggerChange();
      }
    };

    // ------- restore from initialState -------
    function restoreState(state) {
      if (!state || !Array.isArray(state)) return;
      state.forEach(item => {
        const { question, brand, scale } = item || {};
        if (!question || !brand) return;
        const row = questionToRowEl.get(question);
        if (!row) return;

        // find the brand card in this row
        const safeBrand = (window.CSS && CSS.escape) ? CSS.escape(brand) : brand;
        const li = row.querySelector(`li[data-brand="${safeBrand}"]`);
        if (!li) return;

        // target list: unsorted (index 0) or one of the Likert columns
        let targetUl;
        if (scaleLabels.includes(scale)) {
          const colIdx = scaleLabels.indexOf(scale) + 1; // +1 skips Unsorted
          targetUl = row.querySelectorAll('ul.dq-card-list')[colIdx];
        } else {
          targetUl = row.querySelector('ul.dq-card-list'); // Unsorted
        }
        if (targetUl) targetUl.appendChild(li);
      });
    }

    // Initial render pass
    if (initialState) {
      restoreState(initialState);
      updateRanks();
    }
    // Emit initial snapshot
    triggerChange();

    return api;
  };
})();
