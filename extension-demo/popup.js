const API = "http://localhost:8787/api/extension-capture";
const SAVE_API = "http://localhost:8787/api/save-dashboard";

let currentData = null;

document.getElementById("captureBtn").addEventListener("click", async () => {
  const resultDiv = document.getElementById("result");
  const saveSection = document.getElementById("saveSection");
  
  saveSection.style.display = "none";
  resultDiv.className = "status";
  resultDiv.innerText = "⏳ Reading page content...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      resultDiv.innerText = "❌ No active tab found.";
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText
    });

    if (!results || !results[0] || !results[0].result) {
      resultDiv.innerText = "❌ Unable to read text from this page.";
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
      currentData = data;
      resultDiv.className = "";
      resultDiv.innerHTML = `<strong>✨ Summary:</strong><br>${data.summary.replace(/\n/g, '<br>')}`;
      saveSection.style.display = "block";
    }
  } catch (err) {
    resultDiv.innerText = "❌ Error: " + err.message;
  }
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  if (!currentData) return;

  const saveStatus = document.getElementById("saveStatus");
  const customTitle = document.getElementById("customTitle").value.trim();
  const comment = document.getElementById("comment").value.trim();
  const saveBtn = document.getElementById("saveBtn");

  saveStatus.style.color = "#64748b";
  saveStatus.innerText = "⏳ Saving to dashboard...";
  saveBtn.disabled = true;

  try {
    const res = await fetch(SAVE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: currentData.title,
        customTitle,
        comment,
        url: currentData.url,
        summary: currentData.summary,
        pageText: currentData.pageText
      })
    });

    const data = await res.json();
    if (data.success) {
      saveStatus.style.color = "#16a34a";
      saveStatus.innerText = "✅ Saved to Dashboard!";
    } else {
      saveStatus.style.color = "#dc2626";
      saveStatus.innerText = "❌ " + (data.error || "Failed to save.");
      saveBtn.disabled = false;
    }
  } catch (e) {
    saveStatus.style.color = "#dc2626";
    saveStatus.innerText = "❌ Connection Error: " + e.message;
    saveBtn.disabled = false;
  }
});
