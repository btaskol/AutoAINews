let contextData = { url: "", title: "", pageText: "", lastAiSummary: "" };

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SELECTION_CAPTURED") {
    contextData.url = msg.url;
    contextData.title = msg.title;
    contextData.pageText = msg.text;
    appendMessage("user", `Selected Text:\n"${msg.text.slice(0, 150)}..."`);
    sendToWorker("Summarize this selected text in its native language.");
  }
});

document.getElementById("sendBtn").addEventListener("click", () => {
  const input = document.getElementById("userInput").value.trim();
  if (!input) return;
  appendMessage("user", input);
  document.getElementById("userInput").value = "";
  sendToWorker(input);
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  if (!contextData.lastAiSummary) {
    alert("No AI response available to save.");
    return;
  }
  
  const customTitle = prompt("Enter a custom tag/title (optional):", "");
  const comment = prompt("Enter a comment/note (optional):", "");

  const res = await fetch("http://localhost:8787/api/save-dashboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: contextData.title || "Manual Chat Capture",
      customTitle: customTitle || "",
      comment: comment || "",
      url: contextData.url || "N/A",
      summary: contextData.lastAiSummary,
      pageText: contextData.pageText
    })
  });

  const data = await res.json();
  if (data.success) {
    appendMessage("ai", "✅ Saved response directly to your Dashboard!");
  } else {
    appendMessage("ai", "❌ Save failed: " + data.error);
  }
});

async function sendToWorker(promptText) {
  const chatBox = document.getElementById("chat-box");
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "msg ai";
  loadingDiv.innerText = "⏳ Thinking...";
  chatBox.appendChild(loadingDiv);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && !contextData.pageText) {
      contextData.url = tab.url;
      contextData.title = tab.title;
    }

    const fullPrompt = `${promptText}\n\n[Context: ${contextData.pageText ? contextData.pageText.slice(0, 2000) : "No text selected"}]`;

    const res = await fetch("http://localhost:8787/api/extension-capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: contextData.url,
        title: contextData.title,
        pageText: fullPrompt
      })
    });

    const data = await res.json();
    loadingDiv.remove();

    if (data.summary) {
      contextData.lastAiSummary = data.summary;
      appendMessage("ai", data.summary);
    } else {
      appendMessage("ai", "❌ Error: " + (data.error || "Unknown error"));
    }
  } catch (err) {
    loadingDiv.remove();
    appendMessage("ai", "❌ Connection error: " + err.message);
  }
}

function appendMessage(role, text) {
  const chatBox = document.getElementById("chat-box");
  const msg = document.createElement("div");
  msg.className = `msg ${role}`;
  msg.innerText = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}
