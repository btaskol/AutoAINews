export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/articles") {
      return handleGetArticles(request, env);
    }

    if (url.pathname === "/api/fetch-feeds" && request.method === "POST") {
      return handleFetchFeeds(request, env);
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  },
};

async function handleFetchFeeds(request, env) {
  const { feeds } = await request.json();
  const articles = [];

  for (const feedUrl of feeds) {
    try {
      const response = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const text = await response.text();
      const parsed = parseRSS(text);
      articles.push(...parsed);
    } catch (e) {
      console.error(`Error: ${feedUrl}`, e.message);
    }
  }

  return new Response(JSON.stringify(articles), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

async function handleGetArticles(request, env) {
  const feeds = [
    "https://feeds.thehackernews.com/thehackernews",
    "https://www.bbc.com/news/rss.xml",
    "https://feeds.techcrunch.com/techcrunch/feed/",
  ];

  const articles = [];

  for (const feedUrl of feeds) {
    try {
      const response = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const text = await response.text();
      const parsed = parseRSS(text);
      articles.push(...parsed);
    } catch (e) {
      console.error(`Error: ${feedUrl}`, e.message);
    }
  }

  return new Response(JSON.stringify(articles), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function parseRSS(xml) {
  const articles = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const titleMatch = /<title>([^<]*)<\/title>/.exec(item);
    const linkMatch = /<link>([^<]*)<\/link>/.exec(item);
    const descMatch = /<description>([^<]*)<\/description>/.exec(item);

    const title = titleMatch ? titleMatch[1] : "No title";
    const link = linkMatch ? linkMatch[1].trim() : "";
    const description = descMatch ? descMatch[1].substring(0, 300) : "No description";

    if (title && title.length > 3) {
      articles.push({
        id: Math.random().toString(36).substr(2, 9),
        title: title.trim(),
        link: link,
        description: description.trim(),
        source: new URL(link || "https://example.com").hostname,
        summary: "Summarizing..."
      });
    }
  }

  return articles;
}
