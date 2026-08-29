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

    if (url.pathname === "/api/fetch-feeds" && request.method === "POST") {
      return handleFetchFeeds(request, env);
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

async function handleFetchFeeds(request, env) {
  const { feeds } = await request.json();

  if (!feeds || feeds.length === 0) {
    return new Response(JSON.stringify({ error: "No feeds provided", articles: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const articles = [];

  for (const feed of feeds) {
    try {
      console.log(`Fetching feed: ${feed}`);
      const response = await fetch(feed);
      const text = await response.text();

      if (text.includes('<?xml') || text.includes('<rss') || text.includes('<feed')) {
        const rssArticles = parseRssFeed(text, feed);
        console.log(`Found ${rssArticles.length} articles in ${feed}`);
        articles.push(...rssArticles);
      }
    } catch (error) {
      console.error(`Error fetching ${feed}:`, error);
    }
  }

  console.log(`Total articles found: ${articles.length}`);

  // Summarize all articles
  for (let article of articles) {
    article.summary = await summarizeWithGrok(article.description, env);
  }

  return new Response(JSON.stringify(articles), {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function parseRssFeed(text, sourceUrl) {
  const articles = [];

  const titleMatches = text.match(/<title>([^<]+)<\/title>/g) || [];
  const linkMatches = text.match(/<link>([^<]+)<\/link>/g) || [];
  const descMatches = text.match(/<description>([^<]+)<\/description>/g) || [];

  for (let i = 1; i < Math.min(4, titleMatches.length); i++) {
    try {
      const title = titleMatches[i]?.replace(/<title>|<\/title>/g, "").substring(0, 200);
      const link = linkMatches[i]?.replace(/<link>|<\/link>/g, "").trim() || "";
      const description = descMatches[i]?.replace(/<description>|<\/description>/g, "").substring(0, 500) || "No description";

      if (title && title.length > 3) {
        articles.push({
          id: Math.random().toString(36).substr(2, 9),
          title: title.trim(),
          link: link.trim(),
          description: description.trim(),
          source: new URL(sourceUrl).hostname,
          timestamp: new Date().toISOString(),
          summary: "Summarizing...",
        });
      }
    } catch (e) {
      console.error("Error parsing article:", e);
    }
  }

  return articles;
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
    return data.choices[0].message.content || "Unable to summarize";
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

async function handleGetArticles(request, env) {
  const RSS_FEEDS = [
    "https://feeds.thehackernews.com/feed.xml",
    "https://www.bbc.com/news/rss.xml",
    "https://feeds.techcrunch.com/",
  ];

  const articles = [];

  for (const feed of RSS_FEEDS) {
    try {
      const response = await fetch(feed);
      const text = await response.text();

      if (text.includes('<?xml') || text.includes('<rss') || text.includes('<feed')) {
        const rssArticles = parseRssFeed(text, feed);
        articles.push(...rssArticles);
      }
    } catch (error) {
      console.error(`Error fetching ${feed}:`, error);
    }
  }

  const articlesWithSummaries = await Promise.all(
    articles.map(async (article) => {
      const summary = await summarizeWithGrok(article.description, env);
      return { ...article, summary };
    })
  );

  return new Response(JSON.stringify(articlesWithSummaries), {
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
