// 1. Load SortableJS first
var sortableScript = document.createElement('script');
sortableScript.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js';
sortableScript.onload = function() {
  console.log("✅ SortableJS loaded");

  // 2. Load dq-rankboard.js from @latest
  var rankScript = document.createElement('script');
  rankScript.src = 'https://cdn.jsdelivr.net/gh/jearowland/dq-rankboard@latest/dq-rankboard.js';
  rankScript.onload = function() {
    console.log("✅ RankBoard JS loaded");

    // 3. Delay to ensure DOM and Form.io form data are ready
    setTimeout(() => {
      const container = document.getElementById("rankBoardHost");
      if (!container) {
        console.error("❌ RankBoard container not found.");
        return;
      }

      if (typeof initDqRankBoard !== "function") {
        console.error("❌ initDqRankBoard not defined.");
        return;
      }

      // 🔎 Grab the latest Form.io form instance
      const form = Formio.forms && Formio.forms.length ? Formio.forms[Formio.forms.length - 1] : null;
      const data = (form && form.submission && form.submission.data) ? form.submission.data : {};
      console.log("👉 submission.data:", data);

      // ✅ Use brands/questions from Edit Grids if available, else fallback
      const brands = Array.isArray(data.brands) && data.brands.length
        ? data.brands.map((b, i) => ({
            name: b.name || ("Brand " + (i + 1)),
            img: b.img || "https://dummyimage.com/60x60/000/fff.png&text=" + encodeURIComponent((b.name || "B").charAt(0)),
            key: b.key || ("brand_" + (i + 1))
          }))
        : [
            { name: "Brand A", img: "https://dummyimage.com/60x60/000/fff.png&text=A", key: "brand_a" },
            { name: "Brand B", img: "https://dummyimage.com/60x60/333/fff.png&text=B", key: "brand_b" },
            { name: "Brand C", img: "https://dummyimage.com/60x60/666/fff.png&text=C", key: "brand_c" }
          ];

      const questions = Array.isArray(data.questions) && data.questions.length
        ? data.questions.map((q, i) => q.text || ("Question " + (i + 1)))
        : [
            "How likely are you to recommend this brand?",
            "Does this brand meet your expectations?",
            "Would you purchase from this brand again?"
          ];

      try {
        initDqRankBoard(container, { brands, questions });
        console.log("✅ RankBoard rendered with", brands.length, "brands and", questions.length, "questions");
      } catch (e) {
        console.error("❌ Error initializing RankBoard:", e);
      }
    }, 250); // Delay ensures DOM & Form.io hydration
  };
  document.head.appendChild(rankScript);
};
document.head.appendChild(sortableScript);

// 4. Load dq-rankboard.css (from @latest)
var css = document.createElement('link');
css.rel = 'stylesheet';
css.href = 'https://cdn.jsdelivr.net/gh/jearowland/dq-rankboard@latest/dq-rankboard.css';
document.head.appendChild(css);