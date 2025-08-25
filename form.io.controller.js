// 1. Load SortableJS first
var sortableScript = document.createElement('script');
sortableScript.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js';
sortableScript.onload = function() {
  console.log("✅ SortableJS loaded");

  // 2. Now load dq-rankboard.js after Sortable is ready
  var rankScript = document.createElement('script');
  rankScript.src = 'https://cdn.jsdelivr.net/gh/jearowland/dq-rankboard@main/dq-rankboard.js';
  rankScript.onload = function() {
    console.log("✅ RankBoard JS loaded");
  };
  document.head.appendChild(rankScript);
};
document.head.appendChild(sortableScript);

// 3. Load dq-rankboard.css (can be done in parallel)
var css = document.createElement('link');
css.rel = 'stylesheet';
css.href = 'https://cdn.jsdelivr.net/gh/jearowland/dq-rankboard@main/dq-rankboard.css';
document.head.appendChild(css);

Formio.events.on('render', function() {
  // ✅ Confirm the widget is available globally
  if (typeof initDqRankBoard !== "function") {
    console.error("initDqRankBoard is not available");
    return;
  }

  // ✅ Find your target container (must exist in Custom HTML)
  var container = document.getElementById("rankBoardHost");
  if (!container) {
    console.error("No element with id 'rankBoardHost' found.");
    return;
  }

  // ✅ Define your brand images and names
  var brands = [
    { name: "Brand A", img: "https://dummyimage.com/60x60/000/fff.png&text=A" },
    { name: "Brand B", img: "https://dummyimage.com/60x60/333/fff.png&text=B" },
    { name: "Brand C", img: "https://dummyimage.com/60x60/666/fff.png&text=C" }
  ];

  // ✅ Define your Likert-style questions
  var questions = [
    "How likely are you to recommend this brand?",
    "Does this brand meet your expectations?",
    "Would you purchase from this brand again?"
  ];

  // ✅ Run the widget
  try {
    initDqRankBoard(container, { brands: brands, questions: questions });
    console.log("✅ RankBoard rendered");
  } catch (e) {
    console.error("❌ Error running RankBoard:", e);
  }
});