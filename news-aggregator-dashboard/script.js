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

// Render feeds list with checkboxes
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

// Add new feed
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

// Delete feed
function deleteFeed(url) {
  if (confirm(`Delete feed: ${url}?`)) {
    customFeeds = customFeeds.filter(feed => feed !== url);
    saveFeeds();
    renderFeedsList();
  }
}

// Load articles from selected feeds
async function loadArticles() {
  const loading = document.getElementById("loading");
  const articlesDiv = document.getElementById("articles");
  const errorDiv = document.getElementById("error");
  const statusDiv = document.getElementById("status");
  const loadBtn = document.getElementById("loadBtn");

  // Get selected feeds based on checkboxes
  const checkboxes = document.querySelectorAll('.feed-checkbox:checked');
  const selectedFeeds = Array.from(checkboxes).map((checkbox) => {
    const idx = checkbox.id.replace('feed-', '');
    return customFeeds[idx];
  });

  if (selectedFeeds.length === 0) {
    if (customFeeds.length > 0) {
      errorDiv.style.display = "block";
      errorDiv.textContent = "Please check at least one feed to load articles";
    } else {
      errorDiv.style.display = "block";
      errorDiv.textContent = "Please add at least one feed first";
    }
    return;
  }

  loading.style.display = "block";
  articlesDiv.innerHTML = "";
  errorDiv.style.display = "none";
  loadBtn.disabled = true;
  statusDiv.textContent = "Loading articles...";

  try {
    const articles = await fetchCustomFeeds(selectedFeeds);

    allArticles = articles;
    loading.style.display = "none";
    statusDiv.textContent = `Loaded ${allArticles.length} articles`;

    if (allArticles.length === 0) {
      articlesDiv.innerHTML = "<p>No articles found. Check your feed URLs and try again.</p>";
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
async function fetchCustomFeeds(feeds) {
  const articles = [];

  for (const feed of feeds) {
    try {
      const response = await fetch(feed);
      const text = await response.text();

      // Check if it's RSS/XML
      if (text.includes('<?xml') || text.includes('<rss') || text.includes('<feed')) {
        const rssArticles = parseRssFeed(text, feed);
        articles.push(...rssArticles);
      } else {
        // It's HTML - extract articles
        const htmlArticles = parseHtmlPage(text, feed);
        articles.push(...htmlArticles);
      }

      // Summarize articles
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

// Parse RSS feed
function parseRssFeed(text, sourceUrl) {
  const articles = [];

  const titleMatches = text.match(/<title>([^<]+)<\/title>/g) || [];
  const linkMatches = text.match(/<link>([^<]+)<\/link>/g) || [];
  const descMatches = text.match(/<description>([^<]+)<\/description>/g) || [];

  for (let i = 1; i < Math.min(4, titleMatches.length); i++) {
    const title = titleMatches[i]
      .replace(/<title>|<\/title>/g, "")
      .substring(0, 200);
    const link = linkMatches[i]
      ?.replace(/<link>|<\/link>/g, "")
      .trim() || "";
    const description = descMatches[i]
      ?.replace(/<description>|<\/description>/g, "")
      .substring(0, 500) || "No description";

    if (title) {
      articles.push({
        id: Math.random().toString(36).substr(2, 9),
        title,
        link,
        description,
        source: new URL(sourceUrl).hostname,
        timestamp: new Date().toISOString(),
        summary: "Summarizing...",
      });
    }
  }

  return articles;
}

// Parse HTML page
function parseHtmlPage(text, sourceUrl) {
  const articles = [];

  const h2Matches = text.match(/<h[1-3][^>]*>([^<]{10,})<\/h[1-3]>/g) || [];

  h2Matches.slice(0, 3).forEach((heading) => {
    const title = heading
      .replace(/<h[1-3][^>]*>|<\/h[1-3]>/g, "")
      .substring(0, 200);

    if (title.length > 10) {
      articles.push({
        id: Math.random().toString(36).substr(2, 9),
        title,
        link: sourceUrl,
        description: `Article from ${new URL(sourceUrl).hostname}`,
        source: new URL(sourceUrl).hostname,
        timestamp: new Date().toISOString(),
        summary: "Summarizing...",
      });
    }
  });

  return articles.length > 0 ? articles : [{
    id: Math.random().toString(36).substr(2, 9),
    title: `Latest from ${new URL(sourceUrl).hostname}`,
    link: sourceUrl,
    description: "Visit the website for latest content",
    source: new URL(sourceUrl).hostname,
    timestamp: new Date().toISOString(),
    summary: "Please visit the site directly for latest content",
  }];
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
