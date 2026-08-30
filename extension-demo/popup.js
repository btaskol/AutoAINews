const API = "https://ai-news.berkaytaskol.workers.dev/api/extension-capture";

document.getElementById("captureBtn").addEventListener("click", async () => {
  const resultDiv = document.getElementById("result");
  resultDiv.className = "status";
  resultDiv.innerText = "⏳ Extracting page content...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      resultDiv.innerText = "❌ Active tab not detected.";
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText
    });

    if (!results || !results[0] || !results[0].result) {
      resultDiv.innerText = "❌ Could not extract text from this page.";
      return;
    }

    const pageText = results[0].result;
    resultDiv.innerText = "⏳ Requesting AI summary...";

    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: tab.url, title: tab.title, pageText })
    });

    const data = await res.json();
    if (data.error) {
      resultDiv.innerText = "❌ " + data.error;
    } else {
      resultDiv.className = "";
      resultDiv.innerHTML = `<strong>✨ Summary:</strong><br>${data.summary.replace(/\n/g, '<br>')}`;
    }
  } catch (err) {
    resultDiv.innerText = "❌ Connection Error: " + err.message;
  }
});
