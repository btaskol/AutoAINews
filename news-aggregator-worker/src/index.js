export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/articles") {
      return new Response(JSON.stringify([
        {
          id: "1",
          title: "Test Article 1",
          link: "https://example.com",
          description: "Test description",
          source: "example.com",
          summary: "Test summary"
        }
      ]), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }

    return new Response("OK", { headers: { "Access-Control-Allow-Origin": "*" } });
  }
};
