/* dq-rankboard.js — RankBoard with save/restore + onChange
   Public API:
     window.initDqRankBoard(container, {
       brands: [{ key?, name, img? }, ...],
       questions: [ "Question text" | { text, key? }, ... ],
       initialState?: { order: string[], scores: {[brandKey]: {[qKey]: number}}, notes: {[brandKey]: {[qKey]: string}} },
       onChange?: (state) => void
     })
*/

(function (root, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory();
  } else {
    root.initDqRankBoard = factory();
  }
})(typeof window !== "undefined" ? window : this, function () {
  // --- utils ---
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "style" && typeof attrs[k] === "object") {
          Object.assign(el.style, attrs[k]);
        } else if (k === "dataset" && attrs[k]) {
          for (const d in attrs[k]) el.dataset[d] = attrs[k][d];
        } else if (k === "class") {
          el.className = attrs[k];
        } else {
          el.setAttribute(k, attrs[k]);
        }
      }
    }
    (children || []).forEach((c) => {
      if (c == null) return;
      if (typeof c === "string") el.appendChild(document.createTextNode(c));
      else el.appendChild(c);
    });
    return el;
  }

  function debounce(fn, wait) {
    let t;
    return function () {
      clearTimeout(t);
      const args = arguments;
      t = setTimeout(function () {
        fn.apply(null, args);
      }, wait);
    };
  }

  function toKey(s, i) {
    if (s && typeof s === "string") {
      const k = s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      return k || "q_" + (i + 1);
    }
    return "q_" + (i + 1);
  }

  // --- main ---
  function init(container, opts) {
    if (!container) throw new Error("RankBoard: container missing");
    const options = opts || {};

    // Normalize brands
    const brands = (options.brands || []).map((b, i) => ({
      key: b.key || "brand_" + (i + 1),
      name: b.name || ("Brand " + (i + 1)),
      img: b.img || null
    }));

    // Normalize questions (strings or {text,key})
    const questions = (options.questions || []).map((q, i) => {
      if (typeof q === "string") return { text: q, key: toKey(q, i) };
      return { text: q.text, key: q.key || toKey(q.text, i) };
    });

    if (!brands.length || !questions.length) {
      container.innerHTML = "";
      container.appendChild(
        h("div", { class: "rb-empty" }, ["RankBoard: no brands or questions to display."])
      );
      return { getState: () => ({ order: [], scores: {}, notes: {} }), setState: () => {} };
    }

    // --- layout ---
    container.innerHTML = "";
    container.classList.add("dq-rankboard");

    const header = h("div", { class: "rb-header grid rb-grid" }, [
      h("div", { class: "rb-col rb-col-brand" }, ["Brand"]),
      ...questions.map((q) => h("div", { class: "rb-col rb-col-score" }, [q.text])),
      h("div", { class: "rb-col rb-col-notes" }, ["Notes"])
    ]);

    const list = h("div", { class: "rb-list", dataset: { rankboardList: "" } });

    function buildRow(b) {
      const brandCell = h("div", { class: "rb-cell rb-brand-cell" }, [
        h("span", { class: "drag-handle", title: "Drag to reorder" }, ["⋮⋮"]),
        b.img ? h("img", { class: "rb-logo", src: b.img, alt: b.name }) : null,
        h("span", { class: "rb-name" }, [b.name || b.key])
      ]);

      const scoreCells = questions.map((q) =>
        h("div", { class: "rb-cell rb-score-cell" }, [
          h("input", {
            type: "number",
            min: "0",
            step: "1",
            class: "rb-score",
            dataset: { score: "", brand: b.key, question: q.key },
            "aria-label": `${b.name} - ${q.text}`
          })
        ])
      );

      const notesCell = h("div", { class: "rb-cell rb-notes-cell" }, [
        h("textarea", {
          class: "rb-note",
          rows: "1",
          placeholder: "Add note…",
          dataset: { note: "", brand: b.key, question: "all" },
          "aria-label": `${b.name} - notes`
        })
      ]);

      return h(
        "div",
        { class: "rb-row grid rb-grid", dataset: { brandKey: b.key } },
        [brandCell, ...scoreCells, notesCell]
      );
    }

    brands.forEach((b) => list.appendChild(buildRow(b)));
    container.appendChild(h("div", { class: "rb-root" }, [header, list]));

    // --- state helpers ---
    function currentOrder() {
      return Array.from(list.children).map((el) => el.dataset.brandKey);
    }
    function readScores() {
      const res = {};
      brands.forEach((b) => {
        res[b.key] = {};
        questions.forEach((q) => {
          const el = container.querySelector(
            `[data-score][data-brand="${b.key}"][data-question="${q.key}"]`
          );
          if (el && el.value !== "") {
            const n = Number(el.value);
            if (!Number.isNaN(n)) res[b.key][q.key] = n;
          }
        });
      });
      return res;
    }
    function readNotes() {
      const res = {};
      brands.forEach((b) => {
        const el = container.querySelector(
          `[data-note][data-brand="${b.key}"][data-question="all"]`
        );
        const v = el && el.value != null ? String(el.value) : "";
        if (v) {
          res[b.key] = res[b.key] || {};
          res[b.key].all = v;
        }
      });
      return res;
    }
    function buildState() {
      return { order: currentOrder(), scores: readScores(), notes: readNotes() };
    }

    const emit = debounce(() => {
      if (typeof options.onChange === "function") options.onChange(buildState());
    }, 120);

    // --- wiring ---
    if (window.Sortable && typeof window.Sortable === "function") {
      try {
        new window.Sortable(list, { animation: 150, handle: ".drag-handle", onEnd: emit });
      } catch {}
    }
    container.addEventListener("input", (e) => {
      const t = e.target;
      if (t && (t.matches("[data-score]") || t.matches("[data-note]"))) emit();
    });
    container.addEventListener("change", (e) => {
      const t = e.target;
      if (t && (t.matches("[data-score]") || t.matches("[data-note]"))) emit();
    });

    // --- restore state ---
    if (options.initialState && typeof options.initialState === "object") {
      const st = options.initialState;
      if (Array.isArray(st.order) && st.order.length) {
        const byKey = {};
        Array.from(list.children).forEach((ch) => (byKey[ch.dataset.brandKey] = ch));
        st.order.forEach((k) => byKey[k] && list.appendChild(byKey[k]));
      }
      if (st.scores) {
        brands.forEach((b) => {
          const bs = st.scores[b.key] || {};
          questions.forEach((q) => {
            const v = bs[q.key];
            const el = container.querySelector(
              `[data-score][data-brand="${b.key}"][data-question="${q.key}"]`
            );
            if (el && v != null) el.value = String(v);
          });
        });
      }
      if (st.notes) {
        brands.forEach((b) => {
          const bn = st.notes[b.key] || {};
          const txt = bn.all;
          const el = container.querySelector(
            `[data-note][data-brand="${b.key}"][data-question="all"]`
          );
          if (el && txt != null) el.value = String(txt);
        });
      }
    }

    if (typeof options.onChange === "function") options.onChange(buildState());

    return {
      getState: buildState,
      setState: (st) => {
        if (!st) return;
        if (Array.isArray(st.order) && st.order.length) {
          const byKey = {};
          Array.from(list.children).forEach((ch) => (byKey[ch.dataset.brandKey] = ch));
          st.order.forEach((k) => byKey[k] && list.appendChild(byKey[k]));
        }
        if (st.scores) {
          brands.forEach((b) => {
            const bs = st.scores[b.key] || {};
            questions.forEach((q) => {
              const v = bs[q.key];
              const el = container.querySelector(
                `[data-score][data-brand="${b.key}"][data-question="${q.key}"]`
              );
              if (el) el.value = v != null ? String(v) : "";
            });
          });
        }
        if (st.notes) {
          brands.forEach((b) => {
            const bn = st.notes[b.key] || {};
            const txt = bn.all;
            const el = container.querySelector(
              `[data-note][data-brand="${b.key}"][data-question="all"]`
            );
            if (el) el.value = txt != null ? String(txt) : "";
          });
        }
        emit();
      }
    };
  }

  // Resize grid columns based on questions count
  function setQuestionCount(container, count) {
    container.style.setProperty("--rb-qcount", String(count));
  }

  function publicInit(container, options) {
    const qs = options && options.questions ? options.questions : [];
    setQuestionCount(container, qs.length || 0);
    return init(container, options);
  }

  return publicInit;
});
