const GOOGLE_CLIENT_ID = "726105967128-hpv2tes67ad9m4iflgea1crc8lp9oohj.apps.googleusercontent.com";
const API_BASE = "https://brief.berkaytaskol.workers.dev";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "summarize-selection",
      title: "Summarize Selection with Brief",
      contexts: ["selection"]
    });
  });
});

function clearCardFromAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab?.id && !tab.url?.startsWith("chrome://") && !tab.url?.startsWith("edge://") && !tab.url?.startsWith("about:")) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const card = document.getElementById("ai-floating-card");
            if (card) card.remove();
          }
        }).catch(() => {});
      }
    });
  });
}

function syncDashboardLogoutTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab?.id && tab?.url && tab.url.includes("brief.berkaytaskol.workers.dev")) {
        chrome.tabs.update(tab.id, { url: `${API_BASE}/dashboard?action=logout` });
      }
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SYNC_TOKEN_FROM_WEB") {
    chrome.storage.local.get(["sessionToken"], (res) => {
      if (res.sessionToken !== request.token) {
        fetch(`${API_BASE}/api/auth/verify`, {
          headers: { "Authorization": `Bearer ${request.token}` }
        })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            chrome.storage.local.set({ sessionToken: request.token, user: data.user });
          }
        }).catch(() => {});
      }
    });
    return true;
  }

  if (request.action === "CLEAR_TOKEN_FROM_WEB") {
    chrome.storage.local.get(["sessionToken"], (res) => {
      if (res.sessionToken) {
        chrome.storage.local.clear(() => {
          clearCardFromAllTabs();
        });
      }
    });
    return true;
  }

  if (request.action === "LOGIN_GOOGLE") {
    const redirectUrl = chrome.identity.getRedirectURL();
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("response_type", "id_token");
    authUrl.searchParams.set("redirect_uri", redirectUrl);
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("nonce", Math.random().toString(36).substring(2));

    chrome.identity.launchWebAuthFlow({ url: authUrl.href, interactive: true }, async (responseUrl) => {
      if (chrome.runtime.lastError || !responseUrl) {
        sendResponse({ error: chrome.runtime.lastError?.message || "Login closed." });
        return;
      }
      const hashParams = new URLSearchParams(new URL(responseUrl).hash.substring(1));
      const idToken = hashParams.get("id_token");

      try {
        const res = await fetch(`${API_BASE}/api/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ googleToken: idToken })
        });
        const data = await res.json();
        if (data.success) {
          chrome.storage.local.set({ sessionToken: data.sessionToken, user: data.user }, () => {
            sendResponse({ success: true, user: data.user });
          });
        } else {
          sendResponse({ error: data.error || "Authentication failed." });
        }
      } catch (err) {
        sendResponse({ error: "Server offline." });
      }
    });
    return true;
  }

  if (["FETCH_SUMMARY", "SAVE_DASHBOARD"].includes(request.action)) {
    chrome.storage.local.get(["sessionToken"], async (res) => {
      const token = res.sessionToken;
      if (!token) {
        clearCardFromAllTabs();
        return sendResponse({ error: "Please sign in first." });
      }

      const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
      try {
        let endpoint = request.action === "SAVE_DASHBOARD" ? "save-dashboard" : "extension-capture";
        const response = await fetch(`${API_BASE}/api/${endpoint}`, {
          method: "POST",
          headers,
          body: JSON.stringify(request.data || { pageText: request.pageText })
        });

        if (response.status === 401) {
          chrome.storage.local.clear(() => {
            clearCardFromAllTabs();
            syncDashboardLogoutTabs();
          });
          return sendResponse({ error: "Session expired. Please sign in again." });
        }

        sendResponse(await response.json());
      } catch (err) {
        sendResponse({ error: "Server unreachable." });
      }
    });
    return true;
  }

  if (request.action === "LOGOUT_USER") {
    chrome.storage.local.clear(() => {
      clearCardFromAllTabs();
      syncDashboardLogoutTabs();
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === "OPEN_DASHBOARD") {
    chrome.storage.local.get(["sessionToken"], (res) => {
      if (res.sessionToken) {
        chrome.tabs.create({ url: `${API_BASE}/dashboard?token=${res.sessionToken}` });
      } else {
        chrome.tabs.create({ url: `${API_BASE}/dashboard` });
      }
    });
    return true;
  }
});

chrome.action.onClicked.addListener((tab) => injectModal(tab, false));
chrome.contextMenus.onClicked.addListener((info, tab) => injectModal(tab, true, info.selectionText));

function injectModal(tab, isSelection, selectedText = "") {
  if (!tab?.id || tab.url?.startsWith("chrome://") || tab.url?.startsWith("edge://") || tab.url?.startsWith("about:")) return;

  chrome.storage.local.get(["user", "sessionToken"], async (res) => {
    const currentUser = (res.sessionToken && res.user) ? res.user : null;

    let textToUse = selectedText;
    let finalIsSelection = isSelection;

    if (!isSelection) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const sel = window.getSelection().toString().trim();
          return sel ? { isSelection: true, text: sel } : { isSelection: false, text: document.body.innerText };
        }
      });
      const payload = results?.[0]?.result || { isSelection: false, text: "" };
      textToUse = payload.text;
      finalIsSelection = payload.isSelection;
    }

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: renderUI,
      args: [{
        user: currentUser,
        title: tab.title || "Capture",
        url: tab.url || "",
        wordCount: textToUse ? textToUse.trim().split(/\s+/).length : 0,
        pageText: textToUse,
        isSelection: finalIsSelection
      }]
    });
  });
}

function renderUI(context) {
  let card = document.getElementById("ai-floating-card");
  if (card) card.remove();

  card = document.createElement("div");
  card.id = "ai-floating-card";
  card.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; width: 360px; max-height: 80vh; overflow-y: auto;
    background: #ffffff; color: #111827; padding: 20px; border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.08); z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif; font-size: 13px; border: 1px solid #e5e7eb; box-sizing: border-box;
  `;

  if (!context.user) {
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:20px;height:20px;background:#111827;color:#fff;border-radius:4px;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;">B</div>
          <strong style="font-size:14px;font-weight:600;color:#111827;">Brief</strong>
        </div>
        <button id="ai-close" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:16px;padding:0;">✕</button>
      </div>
      <button id="ai-login-btn" style="width:100%;padding:10px;background:#111827;color:white;border:none;border-radius:6px;font-weight:500;cursor:pointer;font-size:13px;">
        Sign in with Google
      </button>
      <div id="ai-status" style="margin-top:10px;font-size:12px;color:#6b7280;text-align:center;"></div>
    `;
    document.body.appendChild(card);
    document.getElementById("ai-close").onclick = () => card.remove();
    document.getElementById("ai-login-btn").onclick = () => {
      const status = document.getElementById("ai-status");
      status.innerText = "Connecting to Google...";
      chrome.runtime.sendMessage({ action: "LOGIN_GOOGLE" }, (res) => {
        if (res?.success) {
          status.innerText = "Signed in successfully.";
          setTimeout(() => card.remove(), 800);
        } else {
          status.innerText = res?.error || "Sign in failed.";
        }
      });
    };
    return;
  }

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:6px;">
        <div style="width:18px;height:18px;background:#111827;color:#fff;border-radius:4px;font-weight:700;font-size:10px;display:flex;align-items:center;justify-content:center;">B</div>
        <strong style="font-size:12px;font-weight:600;color:#2563eb;">${context.isSelection ? "Selected Text" : "Full Page"}</strong>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <button id="ai-dash-btn" style="background:none;border:none;color:#374151;cursor:pointer;font-size:12px;font-weight:500;padding:0;">Dashboard</button>
        <button id="ai-logout-btn" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:12px;font-weight:500;padding:0;">Sign Out</button>
        <button id="ai-close" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:16px;padding:0;">✕</button>
      </div>
    </div>
    <div style="background:#f9fafb;border:1px solid #f3f4f6;padding:10px 12px;border-radius:6px;margin-bottom:14px;font-size:12px;color:#4b5563;">
      <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px;font-weight:600;color:#111827;">${context.title}</div>
      <div style="display:flex;justify-content:space-between;color:#6b7280;">
        <span>${context.user.email}</span>
        <span>~${context.wordCount} words</span>
      </div>
    </div>
    <div id="ai-body">
      <button id="ai-sum-btn" style="width:100%;padding:9px;background:#111827;color:white;border:none;border-radius:6px;font-weight:500;cursor:pointer;font-size:13px;">Summarize</button>
    </div>
  `;
  document.body.appendChild(card);
  document.getElementById("ai-close").onclick = () => card.remove();

  document.getElementById("ai-dash-btn").onclick = () => {
    chrome.runtime.sendMessage({ action: "OPEN_DASHBOARD" });
  };

  document.getElementById("ai-logout-btn").onclick = () => {
    chrome.runtime.sendMessage({ action: "LOGOUT_USER" }, () => card.remove());
  };

  document.getElementById("ai-sum-btn").onclick = () => {
    const body = document.getElementById("ai-body");
    body.innerHTML = `<div style="color:#6b7280;font-size:12px;padding:8px 0;">Generating summary...</div>`;
    chrome.runtime.sendMessage({ action: "FETCH_SUMMARY", pageText: context.pageText }, (data) => {
      if (data?.summary) {
        body.innerHTML = `
          <div style="background:#f9fafb;border:1px solid #e5e7eb;padding:12px;border-radius:6px;max-height:180px;overflow-y:auto;margin-bottom:10px;color:#374151;line-height:1.6;font-size:12px;">${data.summary.replace(/\n/g, '<br>')}</div>
          <input type="text" id="ai-tag" placeholder="Tag / Custom Title (Optional)" style="width:100%;padding:8px;background:#ffffff;border:1px solid #d1d5db;border-radius:6px;color:#111827;font-size:12px;box-sizing:border-box;margin-bottom:8px;">
          <textarea id="ai-comment" rows="2" placeholder="Note (Optional)" style="width:100%;padding:8px;background:#ffffff;border:1px solid #d1d5db;border-radius:6px;color:#111827;font-size:12px;box-sizing:border-box;resize:none;margin-bottom:10px;"></textarea>
          <button id="ai-save-btn" style="width:100%;padding:9px;background:#059669;color:white;border:none;border-radius:6px;font-weight:500;cursor:pointer;font-size:13px;">Save Capture</button>
          <div id="ai-save-status" style="font-size:12px;text-align:center;margin-top:8px;"></div>
        `;
        document.getElementById("ai-save-btn").onclick = () => {
          const statusDiv = document.getElementById("ai-save-status");
          statusDiv.style.color = "#6b7280";
          statusDiv.innerText = "Saving...";

          const payload = {
            title: context.title,
            customTitle: document.getElementById("ai-tag").value.trim(),
            comment: document.getElementById("ai-comment").value.trim(),
            url: context.url,
            summary: data.summary,
            pageText: context.pageText
          };
          chrome.runtime.sendMessage({ action: "SAVE_DASHBOARD", data: payload }, (res) => {
            if (res?.success) {
              statusDiv.style.color = "#059669";
              statusDiv.innerText = "Saved to Dashboard";
            } else {
              statusDiv.style.color = "#dc2626";
              statusDiv.innerText = res?.error || "Save failed.";
            }
          });
        };
      } else {
        body.innerHTML = `<div style="color:#dc2626;font-size:12px;">${data?.error || "Error generating summary."}</div>`;
      }
    });
  };
}
