(() => {
  // Avoid redefining if script is loaded multiple times
  if (window.initDqRankBoard) return;

  window.initDqRankBoard = function initDqRankBoard(container, config) {
    const {
      brands,
      questions,
      scaleLabels = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"],
      scaleWeight,
      onChange,        // optional callback
      initialState,    // optional restore array
      questionMeta,    // optional: array aligned with questions -> {domain, subdomain}
      questionMetaMap  // optional: map keyed by question text -> {domain, subdomain}
    } = config;

    const weight = scaleWeight || Object.fromEntries(scaleLabels.map((l, i) => [l, i + 1]));

    // --- metadata helpers ---
    function metaFor(idx, qText) {
      if (questionMeta && questionMeta[idx]) return questionMeta[idx];
      if (questionMetaMap && qText && questionMetaMap[qText]) return questionMetaMap[qText];
      return { domain: null, subdomain: null };
    }

    function normalise(s) {
      return (s == null || s === '') ? null : String(s);
    }

    function buildGroups() {
      // If no metadata, single ungrouped bucket
      const anyMeta = !!(questionMeta || questionMetaMap);
      if (!anyMeta) {
        return [{
          domain: null,
          subdomain: null,
          rows: questions.map((q, i) => ({ qText: q, qIndex: i }))
        }];
      }

      // Build domain/subdomain grouping in question order
      const groups = [];
      questions.forEach((q, i) => {
        const m = metaFor(i, q) || {};
        const domain = normalise(m.domain) || 'Other';
        const subdomain = normalise(m.subdomain) || null;

        // try to reuse last matching group (domain + subdomain adjacency)
        const last = groups[groups.length - 1];
        if (last && last.domain === domain && last.subdomain === subdomain) {
          last.rows.push({ qText: q, qIndex: i });
        } else {
          groups.push({ domain, subdomain, rows: [{ qText: q, qIndex: i }] });
        }
      });
      return groups;
    }

    // Clear previous content
    container.innerHTML = '';
    const board = document.createElement('div');
    board.className = 'dq-board';

    // Header row (fixed)
    board.innerHTML = `<div class="dq-header-row">
      <div class="dq-header-spacer"></div>
      <div class="dq-header-unsorted">Unsorted</div>
      ${scaleLabels.map(l => `<div class="dq-header-col">${l}</div>`).join('')}
    </div>`;

    // Build grouped sections + rows
    const groups = buildGroups();
    // Map of question text -> row element for fast restore
    const questionToRowEl = new Map();

    groups.forEach((g, gIdx) => {
      // Section wrapper
      const section = document.createElement('div');
      section.className = 'dq-section';
      section.dataset.sectionIndex = String(gIdx);

      // Domain header (if present)
      if (g.domain) {
        const d = document.createElement('div');
        d.className = 'dq-domain-header';
        d.textContent = g.domain;
        section.appendChild(d);
      }

      // Subdomain header (if present)
      if (g.subdomain) {
        const s = document.createElement('div');
        s.className = 'dq-subdomain-header';
        s.textContent = g.subdomain;
        section.appendChild(s);
      }

      // Rows for this group
      g.rows.forEach(({ qText, qIndex }) => {
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
        ulUns.dataset.row = `row-${qIndex}`;
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
          ul.dataset.row = `row-${qIndex}`;
          col.appendChild(ul);
          row.appendChild(col);
        });

        section.appendChild(row);
        questionToRowEl.set(qText, row);
      });

      board.appendChild(section);
    });

    container.appendChild(board);

    // Drag-and-drop wiring (row-locked by question index)
    board.querySelectorAll('.dq-row').forEach((row) => {
      const groupName = row.querySelector('ul.dq-card-list')?.dataset.row || `row-${row.dataset.qIndex}`;
      row.querySelectorAll('ul.dq-card-list').forEach(ul => {
        ul.dataset.row = groupName;
        new Sortable(ul, {
          group: { name: groupName, pull: true, put: true },
          animation: 150,
          onMove: e => e.from.dataset.row === e.to.dataset.row,
          onSort: () => {
            updateRanks();
            triggerChange();
          }
        });
      });
    });

    // Ranking logic (compute global ranks per row; display as badge)
    function updateRanks() {
      board.querySelectorAll('.dq-row').forEach(row => {
        const lists = Array.from(row.querySelectorAll('ul.dq-card-list'));
        const ranked = [];

        lists.forEach((ul, i) => {
          if (i === 0) {
            ul.querySelectorAll('.dq-badge').forEach(b => b.textContent = '');
            return;
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

    // Public API
    const api = {
      getResultsJson() {
        const out = [];
        // Only iterate real rows (not headers)
        board.querySelectorAll('.dq-row').forEach((row) => {
          const qIdx = parseInt(row.dataset.qIndex, 10);
          const q = questions[qIdx];
          const m = metaFor(qIdx, q);
          row.querySelectorAll('.dq-col').forEach((col, cIdx) => {
            const scale = scaleLabels[cIdx];
            const scaleVal = weight[scale];
            Array.from(col.querySelectorAll('li')).forEach((li) => {
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

    // Restore from initialState
    function restoreState(state) {
      if (!state || !Array.isArray(state)) return;
      state.forEach(item => {
        const { question, brand, scale } = item || {};
        if (!question || !brand) return;
        const row = questionToRowEl.get(question);
        if (!row) return;

        const li = row.querySelector(`li[data-brand="${CSS.escape ? CSS.escape(brand) : brand}"]`);
        if (!li) return;

        let targetUl;
        if (scaleLabels.includes(scale)) {
          const colIdx = scaleLabels.indexOf(scale) + 1; // +1 skips unsorted
          targetUl = row.querySelectorAll('ul.dq-card-list')[colIdx];
        } else {
          targetUl = row.querySelector('ul.dq-card-list'); // unsorted
        }
        if (targetUl) targetUl.appendChild(li);
      });
    }

    if (initialState) {
      restoreState(initialState);
      updateRanks();
    }

    // Emit initial state
    triggerChange();

    return api;
  };
})();
