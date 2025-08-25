(() => {
  // Avoid redefining if script is loaded multiple times
  if (window.initDqRankBoard) return;

  // Expose a single global function
  window.initDqRankBoard = function initDqRankBoard(container, config) {
    const {
      brands,
      questions,
      scaleLabels = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"],
      scaleWeight
    } = config;

    const weight = scaleWeight || Object.fromEntries(scaleLabels.map((l, i) => [l, i + 1]));

    // Clear previous content if any
    container.innerHTML = '';
    const board = document.createElement('div');
    board.className = 'dq-board';

    // Header
    board.innerHTML = `<div class="dq-header-row">
      <div class="dq-header-spacer"></div>
      <div class="dq-header-unsorted">Unsorted</div>
      ${scaleLabels.map(l => `<div class="dq-header-col">${l}</div>`).join('')}
    </div>`;

    // Rows
    questions.forEach((q, rowIdx) => {
      const row = document.createElement('div');
      row.className = 'dq-row';
      row.innerHTML = `<div class="dq-row-label">${q}</div>`;

      // Unsorted column
      const uns = document.createElement('div');
      uns.className = 'dq-unsorted';
      const ulUns = document.createElement('ul');
      ulUns.className = 'dq-card-list';
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
        col.innerHTML = '<ul class="dq-card-list"></ul>';
        row.appendChild(col);
      });

      board.appendChild(row);
    });

    container.appendChild(board);

    // Drag-and-drop (row-locked)
    board.querySelectorAll('.dq-row').forEach((row, rowIdx) => {
      const group = `row-${rowIdx}`;
      row.querySelectorAll('ul.dq-card-list').forEach(ul => {
        ul.dataset.row = group;
        new Sortable(ul, {
          group: { name: group, pull: true, put: true },
          animation: 150,
          onMove: e => e.from.dataset.row === e.to.dataset.row,
          onSort: updateRanks
        });
      });
    });

    // Ranking logic
    function updateRanks() {
      board.querySelectorAll('.dq-row').forEach(row => {
        const cardBuckets = [...row.querySelectorAll('ul.dq-card-list')];
        const ranked = [];

        cardBuckets.forEach((ul, i) => {
          if (i === 0) {
            ul.querySelectorAll('.dq-badge').forEach(b => b.textContent = '');
            return;
          }
          const scale = scaleLabels[i - 1];
          [...ul.children].forEach((li, pos) => {
            ranked.push({ li, score: weight[scale] * 10 + (ul.children.length - pos) });
          });
        });

        ranked.sort((a, b) => b.score - a.score)
              .forEach((c, i) => c.li.querySelector('.dq-badge').textContent = i + 1);
      });
    }

    // Public API (optional)
    return {
      getResultsJson() {
        const out = [];
        board.querySelectorAll('.dq-row').forEach((row, rIdx) => {
          const q = questions[rIdx];
          row.querySelectorAll('.dq-col').forEach((col, cIdx) => {
            const scale = scaleLabels[cIdx];
            [...col.querySelectorAll('li')].forEach((li, pos) => {
              out.push({
                question: q,
                brand: li.dataset.brand,
                scale,
                rank: pos + 1,
                value: weight[scale]
              });
            });
          });
        });
        return out;
      }
    };
  };
})();