const WORKER_URL = "https://news-aggregator-worker.berkaytaskol.workers.dev";

let allArticles = [];
let customFeeds = [];

document.addEventListener('DOMContentLoaded', () => {
  loadFeeds();
  renderFeedsList();
  document.getElementById("loadBtn").addEventListener("click", loadArticles);
  document.getElementById("addFeedBtn").addEventListener("click", addFeed);
  document.getElementById("feedInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") addFeed();
  });
});

function loadFeeds() {
  const saved = localStorage.getItem('customFeeds');
  customFeeds = saved ? JSON.parse(saved) : [];
}

function saveFeeds() {
  localStorage.setItem('customFeeds', JSON.stringify(customFeeds));
}

function renderFeedsList() {
  const feedsList = document.getElementById("feedsList");
  
  if (customFeeds.length === 0) {
    feedsList.innerHTML = '<p style="color: #999; font-size: 13px; padding: 10px;">No feeds added yet. Add a feed URL above!</p>';
    return;
  }

  feedsList.innerHTML = customFeeds.map((feed, idx) => `
    <div class="feed-item">
      <input type="checkbox" id="feed-${idx}" class="feed-checkbox" checked>
      <label for="feed-${idx}">${feed}</label>
      <button class="btn btn-danger" onclick="deleteFeed('${feed.replace(/'/g, "\\'")}')">Delete</button>
    </div>
  `).join('');
}

function addFeed() {
  const input = document.getElementById("feedInput");
  const url = input.value.trim();

  if (!url) {
    alert("Please enter a URL");
    return;
  }

  if (!url.startsWith('http')) {
    alert("URL must start with http:// or https://");
    return;
  }

  if (customFeeds.includes(url)) {
    alert("This feed is already added");
    return;
  }

  customFeeds.push(url);
  saveFeeds();
  input.value = "";
  renderFeedsList();
}

function deleteFeed(url) {
  if (confirm(`Delete feed: ${url}?`)) {
    customFeeds = customFeeds.filter(feed => feed !== url);
    saveFeeds();
    renderFeedsList();
  }
}

async function loadArticles() {
  const loading = document.getElementById("loading");
  const articlesDiv = document.getElementById("articles");
  const errorDiv = document.getElementById("error");
  const statusDiv = document.getElementById("status");
  const loadBtn = document.getElementById("loadBtn");

  loading.style.display = "block";
  articlesDiv.innerHTML = "";
  errorDiv.style.display = "none";
  loadBtn.disabled = true;
  statusDiv.textContent = "Loading articles...";

  try {
    // Use the default Worker endpoint (has built-in feeds)
    const response = await fetch(`${WORKER_URL}/api/articles`);
    
    if (!response.ok) {
      throw new Error(`Worker error: ${response.status}`);
    }

    allArticles = await response.json();
    
    if (!Array.isArray(allArticles)) {
      throw new Error("Invalid response format");
    }

    loading.style.display = "none";
    statusDiv.textContent = `Loaded ${allArticles.length} articles`;

    if (allArticles.length === 0) {
      articlesDiv.innerHTML = "<p>No articles found. The feeds might be unavailable.</p>";
      return;
    }

    articlesDiv.innerHTML = allArticles
      .map((article) => renderArticle(article))
      .join("");

    document.querySelectorAll(".btn-ask").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const articleId = e.target.dataset.articleId;
        const article = allArticles.find((a) => a.id === articleId);
        if (article) askQuestion(article);
      });
    });
  } catch (error) {
    loading.style.display = "none";
    errorDiv.style.display = "block";
    errorDiv.textContent = `Error: ${error.message}`;
    statusDiv.textContent = "Error loading articles";
    console.error("Error:", error);
  } finally {
    loadBtn.disabled = false;
  }
}

function renderArticle(article) {
  return `
    <div class="article-card">
      <div class="article-title">${article.title}</div>
      <span class="article-source">${article.source}</span>
      
      <div class="article-summary">
        <div class="article-summary-label">Summary:</div>
        ${article.summary}
      </div>
      
      <a href="${article.link}" target="_blank" class="article-link">Read Full Article →</a>
      
      <div class="qa-section">
        <div class="qa-input-group">
          <input 
            type="text" 
            class="qa-question-${article.id}" 
            placeholder="Ask a question about this article..."
          >
          <button class="btn btn-ask" data-article-id="${article.id}">Ask AI</button>
        </div>
        <div class="qa-answer-${article.id}"></div>
      </div>
    </div>
  `;
}

async function askQuestion(article) {
  const question = document.querySelector(`.qa-question-${article.id}`).value;
  const answerDiv = document.querySelector(`.qa-answer-${article.id}`);

  if (!question) {
    alert("Please enter a question");
    return;
  }

  answerDiv.innerHTML = "<p style='color: #999;'>Thinking...</p>";

  try {
    const response = await fetch(`${WORKER_URL}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        articleText: article.description, 
        question 
      }),
    });

    const data = await response.json();
    answerDiv.innerHTML = `
      <div class="qa-answer">
        <div class="qa-answer-label">Answer:</div>
        ${data.answer}
      </div>
    `;
  } catch (error) {
    answerDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
  }
}
