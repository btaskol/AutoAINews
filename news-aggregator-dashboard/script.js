const WORKER_URL = "https://news-aggregator-worker.berkaytaskol.workers.dev";

let allArticles = [];
let customFeeds = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadFeeds();
  renderFeedsList();
  document.getElementById("loadBtn").addEventListener("click", loadArticles);
  document.getElementById("addFeedBtn").addEventListener("click", addFeed);
  document.getElementById("feedInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") addFeed();
  });
});

// Load feeds from localStorage
function loadFeeds() {
  const saved = localStorage.getItem('customFeeds');
  customFeeds = saved ? JSON.parse(saved) : [];
}

// Save feeds to localStorage
function saveFeeds() {
  localStorage.setItem('customFeeds', JSON.stringify(customFeeds));
}

// Render feeds list
function renderFeedsList() {
  const feedsList = document.getElementById("feedsList");
  
  if (customFeeds.length === 0) {
    feedsList.innerHTML = '<p style="color: #999; font-size: 13px;">No custom feeds added yet. Add one above!</p>';
    return;
  }

  feedsList.innerHTML = customFeeds.map(feed => `
    <div class="feed-tag">
      <span class="feed-tag-url">${feed}</span>
      <button class="btn btn-danger" onclick="deleteFeed('${feed.replace(/'/g, "\\'")}')">Delete</button>
    </div>
  `).join('');
}

// Add new feed
function addFeed() {
  const input = document.getElementById("feedInput");
  const url = input.value.trim();

  if (!url) {
    alert("Please enter a valid URL");
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

// Delete feed
function deleteFeed(url) {
  if (confirm(`Delete feed: ${url}?`)) {
    customFeeds = customFeeds.filter(feed => feed !== url);
    saveFeeds();
    renderFeedsList();
  }
}

// Load articles from custom feeds
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
    // If custom feeds exist, fetch from them; otherwise use default Worker feeds
    let articles = [];
    
    if (customFeeds.length > 0) {
      articles = await fetchCustomFeeds();
    } else {
      // Fall back to Worker default feeds
      const response = await fetch(`${WORKER_URL}/api/articles`);
      if (!response.ok) throw new Error(`Worker error: ${response.status}`);
      articles = await response.json();
    }

    allArticles = articles;
    loading.style.display = "none";
    statusDiv.textContent = `Loaded ${allArticles.length} articles`;

    if (allArticles.length === 0) {
      articlesDiv.innerHTML = "<p>No articles found. Try adding some feeds!</p>";
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

// Fetch from custom feeds
async function fetchCustomFeeds() {
  const articles = [];

  for (const feed of customFeeds) {
    try {
      const response = await fetch(feed);
      const text = await response.text();

      const titleMatches = text.match(/<title>([^<]+)<\/title>/g) || [];
      const linkMatches = text.match(/<link>([^<]+)<\/link>/g) || [];
      const descMatches = text.match(/<description>([^<]+)<\/description>/g) || [];

      for (let i = 0; i < Math.min(3, titleMatches.length); i++) {
        const title = titleMatches[i]
          .replace(/<title>|<\/title>/g, "")
          .substring(0, 200);
        const link = linkMatches[i]
          ?.replace(/<link>|<\/link>/g, "")
          .trim() || "";
        const description = descMatches[i]
          ?.replace(/<description>|<\/description>/g, "")
          .substring(0, 500) || "No description";

        articles.push({
          id: Math.random().toString(36).substr(2, 9),
          title,
          link,
          description,
          source: new URL(feed).hostname,
          timestamp: new Date().toISOString(),
          summary: "Summarizing...",
        });
      }

      // Summarize articles with Grok
      for (let article of articles) {
        if (article.summary === "Summarizing...") {
          article.summary = await summarizeWithGrok(article.description);
        }
      }
    } catch (error) {
      console.error(`Error fetching ${feed}:`, error);
    }
  }

  return articles;
}

// Summarize with Grok
async function summarizeWithGrok(text) {
  if (!text || text.length < 10) return "No content to summarize";

  try {
    const response = await fetch(`${WORKER_URL}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.substring(0, 1000) }),
    });

    if (!response.ok) return "Summarization failed";

    const data = await response.json();
    return data.summary || "Summarization failed";
  } catch (error) {
    console.error("Grok API error:", error);
    return "Error summarizing";
  }
}

// Render article
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

// Ask question
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
