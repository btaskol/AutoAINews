const WORKER_URL = "https://ai-news.berkaytaskol.workers.dev";

let allArticles = [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById("loadBtn").addEventListener("click", loadArticles);
});

async function loadArticles() {
  const loading = document.getElementById("loading");
  const articlesDiv = document.getElementById("articles");
  const statusDiv = document.getElementById("status");
  const loadBtn = document.getElementById("loadBtn");

  loading.style.display = "block";
  loadBtn.disabled = true;
  statusDiv.textContent = "Loading articles...";

  try {
    const response = await fetch(`${WORKER_URL}/api/articles`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    allArticles = await response.json();

    loading.style.display = "none";
    statusDiv.textContent = `Loaded ${allArticles.length} articles`;

    articlesDiv.innerHTML = allArticles
      .map((article) => `
        <div class="article-card">
          <div class="article-title">${article.title}</div>
          <span class="article-source">${article.source}</span>
          <div class="article-summary">${article.summary}</div>
          <a href="${article.link}" target="_blank">Read More →</a>
        </div>
      `).join("");

  } catch (error) {
    loading.style.display = "none";
    console.error("Error:", error);
    document.getElementById("error").textContent = `Error: ${error.message}`;
  } finally {
    loadBtn.disabled = false;
  }
}
