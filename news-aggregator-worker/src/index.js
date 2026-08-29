// Main Worker handler
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/articles") {
      return handleGetArticles(request, env);
    }

    if (url.pathname === "/api/ask" && request.method === "POST") {
      return handleAskQuestion(request, env);
    }

    if (url.pathname === "/api/summarize" && request.method === "POST") {
      return handleSummarize(request, env);
    }

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("News Aggregator Worker is running", {
      headers: { "Content-Type": "text/plain" },
    });
  },
};

async function handleGetArticles(request, env) {
  const RSS_FEEDS = [
    "https://feeds.thehackernews.com/feed.xml",
    "https://www.bbc.com/news/rss.xml",
    "https://feeds.techcrunch.com/",
  ];

  const articles = [];

  for (const feed of RSS_FEEDS) {
    const fetchedArticles = await fetchFeedOrUrl(feed, env);
    articles.push(...fetchedArticles);
  }

  return new Response(JSON.stringify(articles), {
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function fetchFeedOrUrl(sourceUrl, env) {
  const articles = [];

  try {
    const response = await fetch(sourceUrl);
    const text = await response.text();

    // Check if it's RSS/XML
    if (text.includes('<?xml') || text.includes('<rss') || text.includes('<feed')) {
      return parseRssFeed(text, sourceUrl);
    } else {
      // It's a regular HTML page - extract articles
      return parseHtmlPage(text, sourceUrl, env);
    }
  } catch (error) {
    console.error(`Error fetching ${sourceUrl}:`, error);
    return [];
  }
}

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

  return articles;
}

function parseHtmlPage(text, sourceUrl, env) {
  const articles = [];

  // Extract article-like content from HTML
  // Look for common patterns: h1/h2 tags, article tags, links with titles
  
  const h2Matches = text.match(/<h2[^>]*>([^<]+)<\/h2>/g) || [];
  const h3Matches = text.match(/<h3[^>]*>([^<]+)<\/h3>/g) || [];
  const linkMatches = text.match(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g) || [];

  // Combine and limit to 3 articles
  const headlines = [
    ...h2Matches.slice(0, 2).map(h => h.replace(/<h2[^>]*>|<\/h2>/g, "")),
    ...h3Matches.slice(0, 2).map(h => h.replace(/<h3[^>]*>|<\/h3>/g, "")),
  ].slice(0, 3);

  headlines.forEach((title, idx) => {
    articles.push({
      id: Math.random().toString(36).substr(2, 9),
      title: title.substring(0, 200),
      link: sourceUrl,
      description: `Article from ${new URL(sourceUrl).hostname}`,
      source: new URL(sourceUrl).hostname,
      timestamp: new Date().toISOString(),
      summary: "Summarizing...",
    });
  });

  return articles.length > 0 ? articles : [{
    id: Math.random().toString(36).substr(2, 9),
    title: `Latest from ${new URL(sourceUrl).hostname}`,
    link: sourceUrl,
    description: "Visit the website for latest news",
    source: new URL(sourceUrl).hostname,
    timestamp: new Date().toISOString(),
    summary: "Please visit the site directly for latest content",
  }];
}

async function summarizeWithGrok(text, env) {
  if (!text || text.length < 10) return "No content to summarize";

  const GROK_API_KEY = env.GROK_API_KEY;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mixtral-8x7b-32768",
        messages: [
          {
            role: "user",
            content: `Summarize this news in 2-3 sentences:\n\n${text.substring(0, 1000)}`,
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      return "Summarization failed";
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Grok API error:", error);
    return "Error summarizing";
  }
}

async function handleSummarize(request, env) {
  const { text } = await request.json();

  if (!text) {
    return new Response(JSON.stringify({ error: "Missing text" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const summary = await summarizeWithGrok(text, env);
  
  return new Response(JSON.stringify({ summary }), {
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function handleAskQuestion(request, env) {
  const { articleText, question } = await request.json();

  if (!articleText || !question) {
    return new Response(JSON.stringify({ error: "Missing article or question" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const GROK_API_KEY = env.GROK_API_KEY;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mixtral-8x7b-32768",
        messages: [
          {
            role: "user",
            content: `Based on this article:\n\n${articleText}\n\nAnswer this question: ${question}`,
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    return new Response(JSON.stringify({ answer: data.choices[0].message.content }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to process question" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
