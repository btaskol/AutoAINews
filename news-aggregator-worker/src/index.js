const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export default {
  async fetch(req, env) {
    // 1. Handle CORS Preflight OPTIONS Request Immediately
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(req.url);

    // 2. Health Check Endpoint to test reachability
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ status: "ok", worker: "active" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 3. Extension Capture Endpoint
    if (url.pathname === "/api/extension-capture" && req.method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        const { url: articleUrl, title, pageText } = body;

        if (!pageText || pageText.length < 20) {
          return new Response(JSON.stringify({ error: "No page text received from extension." }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        const apiKey = env.GROQ_API_KEY || env.GROK_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "GROQ_API_KEY is missing in Cloudflare secrets." }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // Truncate text to avoid huge token loads
        const prompt = `Title: ${title}\nURL: ${articleUrl}\n\nContent:\n${pageText.slice(0, 3000)}\n\nProvide an executive briefing: 3 bullet key points and a 1-sentence risk/impact summary.`;
        
        const summary = await askGroq(apiKey, prompt);

        return new Response(JSON.stringify({
          success: true,
          title,
          url: articleUrl,
          summary
        }), { 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: "Worker Crash: " + err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    return new Response("Endpoint Not Found", { status: 404, headers: corsHeaders });
  }
};

async function askGroq(key, prompt) {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500
      })
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return `Groq Error (${res.status}): ${data.error?.message || res.statusText}`;
    }

    return data.choices?.[0]?.message?.content || "No text returned from model.";
  } catch (e) {
    return "Groq Fetch Failure: " + e.message;
  }
}
