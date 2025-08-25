// @ts-nocheck
function initDqRankBoard(container, config) {
      const { brands, questions, scaleLabels = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"], scaleWeight } = config;
      const weight = scaleWeight || Object.fromEntries(scaleLabels.map((lbl, idx) => [lbl, idx + 1]));

      container.innerHTML = '';

      const board = document.createElement('div');
      board.className = 'dq-board';

      // Header row
      const header = document.createElement('div');
      header.className = 'dq-header-row';
      header.innerHTML = `<div class="dq-header-spacer"></div><div class="dq-header-unsorted">Unsorted</div>` +
        scaleLabels.map(lbl => `<div class="dq-header-col">${lbl}</div>`).join('');
      board.appendChild(header);

      // Question rows
      questions.forEach((q, rowIdx) => {
        const row = document.createElement('div');
        row.className = 'dq-row';

        const label = document.createElement('div');
        label.className = 'dq-row-label';
        label.textContent = q;
        row.appendChild(label);

        const unsorted = document.createElement('div');
        unsorted.className = 'dq-unsorted';
        const unsortedList = document.createElement('ul');
        unsortedList.className = 'dq-card-list';
        brands.forEach(b => {
          const li = document.createElement('li');
          li.setAttribute('data-brand', b.name);
          li.innerHTML = `<img src="${b.img}" alt="${b.name}"/><div>${b.name}</div><div class="dq-badge"></div>`;
          unsortedList.appendChild(li);
        });
        unsorted.appendChild(unsortedList);
        row.appendChild(unsorted);

        scaleLabels.forEach(lbl => {
          const col = document.createElement('div');
          col.className = 'dq-col';
          const ul = document.createElement('ul');
          ul.className = 'dq-card-list';
          col.appendChild(ul);
          row.appendChild(col);
        });

        board.appendChild(row);
      });

      container.appendChild(board);

      // Setup drag-drop per row so cards can't cross questions
      const rowsEls = container.querySelectorAll('.dq-row');
      rowsEls.forEach((row, rowIdx) => {
        // Unique group name for each row
        const groupName = `row-group-${rowIdx}`;
        // Store a reference on each list for parent row
        row.querySelectorAll('ul.dq-card-list').forEach(el => {
          el.dataset.rowIdx = rowIdx; // <-- mark the row this list belongs to
          // Remove any old Sortable instance, if present
          if (el._sortable) { el._sortable.destroy(); }
          el._sortable = new Sortable(el, {
            group: { name: groupName, pull: true, put: true },
            animation: 150,
            // The key logic: prevent cross-row drops
            onMove: function (evt) {
              // Only allow moving within lists from the same row
              const fromRow = evt.from.dataset.rowIdx;
              const toRow = evt.to.dataset.rowIdx;
              return fromRow === toRow;
            },
            onSort: updateRanks
          });
        });
      });

      // Updated updateRanks function
      function updateRanks() {
        // For each question row, rank across ALL scale columns (ignore unsorted)
        const rows = container.querySelectorAll('.dq-row');
        rows.forEach((row, rowIdx) => {
          const cards = [];
          // get all card lists except the first (unsorted)
          const uls = row.querySelectorAll('ul.dq-card-list');
          uls.forEach((ul, listIdx) => {
            if (listIdx === 0) {
              // Unsorted: clear badge
              [...ul.children].forEach((li) => {
                li.querySelector('.dq-badge').textContent = '';
              });
              return;
            }
            const scale = scaleLabels[listIdx - 1];
            [...ul.children].forEach((li, pos) => {
              const score = weight[scale] * 10 + (ul.children.length - pos);
              cards.push({ li, score });
            });
          });
          // sort descending by score and label badges 1..N
          cards.sort((a, b) => b.score - a.score);
          cards.forEach((c, i) => {
            c.li.querySelector('.dq-badge').textContent = i + 1;
          });
        });
      }

      function getResultsJson() {
        const results = [];
        const rows = container.querySelectorAll(".dq-row");
        rows.forEach((row, rowIdx) => {
          const qText = questions[rowIdx];
          const lists = row.querySelectorAll("ul.dq-card-list");
          lists.forEach((ul, listIdx) => {
            if (listIdx === 0) return; // skip unsorted
            const scale = scaleLabels[listIdx - 1];
            [...ul.children].forEach((li, pos) => {
              const brand = li.getAttribute('data-brand');
              results.push({
                question: qText,
                brand,
                scale,
                rank: pos + 1,
                value: weight[scale]
              });
            });
          });
        });
        return results;
      }

      return { getResultsJson };
    }


    const brands = [
      {name:'Brand A', img:'https://dummyimage.com/60x60/ffffff/000.png?text=A'},
      {name:'Brand B', img:'https://dummyimage.com/60x60/ffffff/000.png?text=B'},
      {name:'Brand C', img:'https://dummyimage.com/60x60/ffffff/000.png?text=C'}
    ];
    const questions = [
      'The support they provide is person-centred.',
      'Service quality is consistent.',
      'They respond promptly to changes.'
    ];
    const api = initDqRankBoard(document.getElementById('rankBoardHost'), {brands, questions});
    document.getElementById('showJson').onclick = () => {
      console.log(api.getResultsJson());
      alert('JSON logged');
    };