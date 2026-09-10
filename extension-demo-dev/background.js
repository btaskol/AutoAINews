const GOOGLE_CLIENT_ID = "726105967128-hpv2tes67ad9m4iflgea1crc8lp9oohj.apps.googleusercontent.com";
const API_BASE = "https://dev.brieflykeep.com";

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "summarize-selection",
      title: "Summarize Selection with Brief",
      contexts: ["selection"]
    });
  });
});

function isRestrictedPageUrl(url = "") {
  return url.startsWith("chrome://")
    || url.startsWith("edge://")
    || url.startsWith("about:")
    || url.startsWith("https://chromewebstore.google.com/")
    || url.startsWith("https://chrome.google.com/webstore/");
}

function clearCardFromAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab?.id && !isRestrictedPageUrl(tab.url)) {
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

function syncDashboardLoginTabs(token) {
  chrome.tabs.query({ url: `${API_BASE}/*` }, (tabs) => {
    tabs.forEach((tab) => {
      if (tab?.id) {
        chrome.tabs.update(tab.id, { url: `${API_BASE}/dashboard?token=${token}` });
      }
    });
  });
}

function syncDashboardLogoutTabs() {
  chrome.tabs.query({ url: `${API_BASE}/*` }, (tabs) => {
    tabs.forEach((tab) => {
      if (tab?.id) {
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
    chrome.storage.local.clear(() => {
      clearCardFromAllTabs();
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
            syncDashboardLoginTabs(data.sessionToken);
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
          body: JSON.stringify(request.data || {
            pageText: request.pageText,
            pageTitle: request.pageTitle,
            summaryLanguage: request.summaryLanguage
          })
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

  if (request.action === "SUBMIT_PRODUCT_FEEDBACK") {
    chrome.storage.local.get(["sessionToken"], async (res) => {
      if (!res.sessionToken) return sendResponse({ error: "Please sign in first." });
      try {
        const response = await fetch(`${API_BASE}/api/product-feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${res.sessionToken}` },
          body: JSON.stringify(request.data || {})
        });
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

  if (request.action === "OPEN_REPORT") {
    chrome.storage.local.get(["sessionToken"], (res) => {
      if (res.sessionToken) chrome.tabs.create({ url: `${API_BASE}/report?token=${res.sessionToken}` });
    });
    return true;
  }
});

chrome.action.onClicked.addListener((tab) => injectModal(tab, false));
chrome.contextMenus.onClicked.addListener((info, tab) => injectModal(tab, true, info.selectionText));

function injectModal(tab, isSelection, selectedText = "") {
  if (!tab?.id || isRestrictedPageUrl(tab.url)) return;

  chrome.storage.local.get(["user", "sessionToken", "summaryLanguage"], async (res) => {
    const currentUser = (res.sessionToken && res.user) ? res.user : null;

    let textToUse = selectedText;
    let finalIsSelection = isSelection;

    if (!isSelection) {
      let results;
      try {
        results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const sel = window.getSelection().toString().trim();
            return sel ? { isSelection: true, text: sel } : { isSelection: false, text: document.body.innerText };
          }
        });
      } catch {
        return;
      }
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
        isSelection: finalIsSelection,
        summaryLanguage: res.summaryLanguage || "auto"
      }]
    }).catch(() => {});
  });
}

function renderUI(context) {
  // chrome.scripting serializes this function into the page, so helpers used
  // below must live inside it rather than relying on the service-worker scope.
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const summaryLanguages = [
    ["auto", "Same as article"], ["en", "English"], ["tr", "Türkçe"],
    ["de", "Deutsch"], ["es", "Español"], ["fr", "Français"],
    ["it", "Italiano"], ["pt", "Português"], ["nl", "Nederlands"],
    ["pl", "Polski"], ["ru", "Русский"], ["uk", "Українська"],
    ["ar", "العربية"], ["ja", "日本語"], ["ko", "한국어"],
    ["zh", "中文"], ["hi", "हिन्दी"]
  ];
  const selectedSummaryLanguage = summaryLanguages.some(([value]) => value === context.summaryLanguage)
    ? context.summaryLanguage
    : "auto";
  const languageOptions = summaryLanguages.map(([value, label]) =>
    `<option value="${value}"${value === selectedSummaryLanguage ? " selected" : ""}>${label}</option>`
  ).join("");
  const showProductPrompt = (prompt) => {
    const body = document.getElementById("ai-body");
    if (!body || !prompt?.type) return;
    const submit = (data) => chrome.runtime.sendMessage({ action: "SUBMIT_PRODUCT_FEEDBACK", data }, (response) => {
      if (response?.success) body.innerHTML = `<div style="color:#059669;font-size:12px;padding:8px 0;text-align:center;">Thank you — this helps make Brief better.</div>`;
      else body.innerHTML = `<div style="color:#dc2626;font-size:12px;padding:8px 0;">${escapeHtml(response?.error || "Could not save your response.")}</div>`;
    });
    if (prompt.type === "use_case") {
      const options = [["research_study", "Research and study"], ["news_current_events", "Keep up with news"], ["work_reading", "Save useful work reading"], ["learning", "Learn new topics"], ["personal_interest", "Organize personal interests"], ["other", "Something else"]];
      body.innerHTML = `<div style="font-size:14px;font-weight:600;color:#111827;margin-bottom:6px;">What are you hoping to do with Brief?</div><div style="font-size:12px;color:#6b7280;margin-bottom:10px;">Optional — choose one so we can improve the right things.</div><div id="ai-use-options" style="display:grid;gap:6px;">${options.map(([value, label]) => `<button data-use="${value}" style="text-align:left;padding:8px 10px;background:#fff;border:1px solid #d1d5db;border-radius:6px;color:#374151;cursor:pointer;font-size:12px;">${label}</button>`).join("")}</div><button id="ai-prompt-skip" style="width:100%;margin-top:10px;background:none;border:0;color:#6b7280;cursor:pointer;font-size:12px;">Skip for now</button>`;
      document.querySelectorAll("#ai-use-options button").forEach(button => button.onclick = () => submit({ type: "use_case", intendedUse: button.dataset.use }));
      document.getElementById("ai-prompt-skip").onclick = () => submit({ type: "use_case", skip: true });
      return;
    }
    body.innerHTML = `<div style="font-size:14px;font-weight:600;color:#111827;margin-bottom:6px;">How is Brief working for you?</div><div style="font-size:12px;color:#6b7280;margin-bottom:10px;">Optional — your feedback helps us improve.</div><div id="ai-rating" style="display:flex;gap:6px;margin-bottom:10px;">${[1, 2, 3, 4, 5].map(rating => `<button data-rating="${rating}" aria-label="${rating} star${rating === 1 ? '' : 's'}" style="background:none;border:0;color:#f59e0b;cursor:pointer;font-size:22px;padding:0;">★</button>`).join("")}</div><div id="ai-feedback-extra" style="display:none;"><textarea id="ai-feedback-comment" rows="2" placeholder="What could we improve? (optional)" style="width:100%;padding:8px;background:#ffffff;border:1px solid #d1d5db;border-radius:6px;color:#111827;font-size:12px;box-sizing:border-box;resize:none;margin-bottom:8px;"></textarea><button id="ai-feedback-send" style="width:100%;padding:8px;background:#111827;color:white;border:0;border-radius:6px;cursor:pointer;font-size:12px;">Send feedback</button></div><button id="ai-prompt-skip" style="width:100%;margin-top:10px;background:none;border:0;color:#6b7280;cursor:pointer;font-size:12px;">Skip for now</button>`;
    let selectedRating = null;
    document.querySelectorAll("#ai-rating button").forEach(button => button.onclick = () => { selectedRating = Number(button.dataset.rating); document.getElementById("ai-feedback-extra").style.display = "block"; });
    document.getElementById("ai-feedback-send").onclick = () => submit({ type: "feedback", rating: selectedRating, comment: document.getElementById("ai-feedback-comment").value.trim() });
    document.getElementById("ai-prompt-skip").onclick = () => submit({ type: "feedback", skip: true });
  };
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
          // Keep the card in place and immediately reveal the signed-in tools.
          renderUI({ ...context, user: res.user });
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
        <button id="ai-report-btn" style="background:none;border:none;color:#374151;cursor:pointer;font-size:12px;font-weight:500;padding:0;">Report</button>
        <button id="ai-logout-btn" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:12px;font-weight:500;padding:0;">Sign Out</button>
        <button id="ai-close" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:16px;padding:0;">✕</button>
      </div>
    </div>
    <div style="background:#f9fafb;border:1px solid #f3f4f6;padding:10px 12px;border-radius:6px;margin-bottom:14px;font-size:12px;color:#4b5563;">
      <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px;font-weight:600;color:#111827;">${escapeHtml(context.title)}</div>
      <div style="display:flex;justify-content:space-between;color:#6b7280;">
        <span>${escapeHtml(context.user.email)}</span>
        <span>~${context.wordCount} words</span>
      </div>
    </div>
    <div id="ai-body">
      <label for="ai-language" style="display:block;color:#4b5563;font-size:12px;font-weight:500;margin:0 0 6px;">Summary language</label>
      <select id="ai-language" style="width:100%;padding:8px;background:#ffffff;border:1px solid #d1d5db;border-radius:6px;color:#111827;font-size:12px;box-sizing:border-box;margin-bottom:10px;">${languageOptions}</select>
      <button id="ai-sum-btn" style="width:100%;padding:9px;background:#111827;color:white;border:none;border-radius:6px;font-weight:500;cursor:pointer;font-size:13px;">Summarize</button>
    </div>
  `;
  document.body.appendChild(card);
  document.getElementById("ai-close").onclick = () => card.remove();

  document.getElementById("ai-dash-btn").onclick = () => {
    chrome.runtime.sendMessage({ action: "OPEN_DASHBOARD" });
  };

  document.getElementById("ai-report-btn").onclick = () => {
    chrome.runtime.sendMessage({ action: "OPEN_REPORT" });
  };

  document.getElementById("ai-logout-btn").onclick = () => {
    chrome.runtime.sendMessage({ action: "LOGOUT_USER" }, () => card.remove());
  };

  document.getElementById("ai-sum-btn").onclick = () => {
    const summaryLanguage = document.getElementById("ai-language").value;
    chrome.storage.local.set({ summaryLanguage });
    const body = document.getElementById("ai-body");
    body.innerHTML = `<div style="color:#6b7280;font-size:12px;padding:8px 0;">Generating summary...</div>`;
    chrome.runtime.sendMessage({ action: "FETCH_SUMMARY", pageText: context.pageText, pageTitle: context.title, summaryLanguage }, (data) => {
      if (data?.summary) {
        body.innerHTML = `
          <div style="background:#f9fafb;border:1px solid #e5e7eb;padding:12px;border-radius:6px;max-height:180px;overflow-y:auto;margin-bottom:10px;color:#374151;line-height:1.6;font-size:12px;">${escapeHtml(data.summary).replace(/\n/g, '<br>')}</div>
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
            title: data.title || context.title,
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
              if (res.prompt) setTimeout(() => showProductPrompt(res.prompt), 700);
            } else {
              statusDiv.style.color = "#dc2626";
              statusDiv.innerText = res?.error || "Save failed.";
            }
          });
        };
      } else {
        body.innerHTML = `<div style="color:#dc2626;font-size:12px;">${escapeHtml(data?.error || "Error generating summary.")}</div>`;
      }
    });
  };
}
