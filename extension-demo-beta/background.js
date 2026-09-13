const GOOGLE_CLIENT_ID = "726105967128-hpv2tes67ad9m4iflgea1crc8lp9oohj.apps.googleusercontent.com";
const API_BASE = "https://beta.brieflykeep.com";
const SUMMARY_FEEDBACK_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;
const SUMMARY_FEEDBACK_STORAGE_KEY = "summaryFeedbackPromptState";
const SUMMARY_REQUEST_TIMEOUT_MS = 65000;
const AUTH_STORAGE_KEYS = ["sessionToken", "user"];

// Ask after the third successful summary, then after ten further summaries,
// but never more frequently than once every fourteen days in this browser.
function planSummaryFeedbackPrompt(callback) {
  chrome.storage.local.get({ [SUMMARY_FEEDBACK_STORAGE_KEY]: {} }, (stored) => {
    const previous = stored[SUMMARY_FEEDBACK_STORAGE_KEY] || {};
    const successfulSummaries = Math.max(0, Number(previous.successfulSummaries) || 0) + 1;
    const nextPromptAt = Math.max(3, Number(previous.nextPromptAt) || 3);
    const lastPromptAt = Math.max(0, Number(previous.lastPromptAt) || 0);
    const now = Date.now();
    const shouldShow = successfulSummaries >= nextPromptAt && (!lastPromptAt || now - lastPromptAt >= SUMMARY_FEEDBACK_INTERVAL_MS);
    const nextState = shouldShow
      ? { successfulSummaries, nextPromptAt: successfulSummaries + 10, lastPromptAt: now }
      : { successfulSummaries, nextPromptAt, lastPromptAt };
    chrome.storage.local.set({ [SUMMARY_FEEDBACK_STORAGE_KEY]: nextState }, () => callback(shouldShow));
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

// Signing out must not erase local preferences or the feedback sampling state.
function clearSignedInState(callback) {
  chrome.storage.local.remove(AUTH_STORAGE_KEYS, callback);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "summarize-selection",
      title: "Brief: summarize selected text",
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

function isPdfUrl(url = "") {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

async function ensurePdfParserDocument() {
  const parserUrl = chrome.runtime.getURL("pdf-parser.html");
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [parserUrl] });
  if (contexts.length) return;
  await chrome.offscreen.createDocument({ url: "pdf-parser.html", reasons: ["DOM_PARSER"], justification: "Extract selectable text from a PDF the user chose to summarize." });
}

async function extractPdfText(url) {
  let response;
  try {
    response = await fetch(url, { credentials: "include", cache: "no-store" });
  } catch {
    throw new Error("Brief could not download this PDF. Check your connection and try again.");
  }

  if (!response.ok) throw new Error(`Brief could not download this PDF (${response.status}).`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  const header = String.fromCharCode(...bytes.slice(0, 5));
  if (header !== "%PDF-") {
    throw new Error("Brief could not access the original PDF. It may require a separate download or sign-in.");
  }

  await ensurePdfParserDocument();
  try {
    const parsed = await chrome.runtime.sendMessage({ action: "EXTRACT_PDF_TEXT", bytes: Array.from(bytes) });
    if (parsed?.error) throw new Error(parsed.error);
    if (!parsed?.text) throw new Error("No selectable text was found in this PDF. It may be a scanned image or protected document.");
    return parsed;
  } catch (error) {
    if (error?.message?.startsWith("No selectable text")) throw error;
    throw new Error("Brief could not read this PDF. It may be password-protected or use an unsupported format.");
  }
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

function syncDashboardLoginTabs(token, excludedTabId = null) {
  chrome.tabs.query({ url: `${API_BASE}/*` }, (tabs) => {
    tabs.forEach((tab) => {
      if (tab?.id && tab.id !== excludedTabId) {
        chrome.tabs.update(tab.id, { url: `${API_BASE}/dashboard?token=${token}` });
      }
    });
  });
}

function restorePanelAfterDashboardLogin(tabId, token) {
  let finished = false;
  const restore = () => {
    if (finished) return;
    finished = true;
    chrome.tabs.onUpdated.removeListener(onUpdated);
    chrome.tabs.get(tabId, (tab) => {
      if (!chrome.runtime.lastError && tab?.id) injectModal(tab, false);
    });
  };
  const onUpdated = (updatedTabId, changeInfo) => {
    if (updatedTabId === tabId && changeInfo.status === "complete") restore();
  };
  chrome.tabs.onUpdated.addListener(onUpdated);
  setTimeout(restore, 8000);
  chrome.tabs.update(tabId, { url: `${API_BASE}/dashboard?token=${token}` }, () => {
    if (chrome.runtime.lastError) restore();
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
    clearSignedInState(() => {
      clearCardFromAllTabs();
    });
    return true;
  }

  if (request.action === "LOGIN_GOOGLE") {
    // Keep the originating tab so the signed-in panel can be restored after
    // Chrome closes the interactive OAuth window.
    const sourceTabId = sender.tab?.id;
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
            syncDashboardLoginTabs(data.sessionToken, sourceTabId);
            if (sourceTabId) {
              chrome.tabs.get(sourceTabId, (sourceTab) => {
                if (chrome.runtime.lastError || !sourceTab?.id) return;
                if (sourceTab.url?.startsWith(`${API_BASE}/`)) {
                  restorePanelAfterDashboardLogin(sourceTab.id, data.sessionToken);
                } else {
                  injectModal(sourceTab, false);
                }
              });
            }
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

  if (["FETCH_SUMMARY", "SAVE_DASHBOARD", "CREATE_SHARE_LINK"].includes(request.action)) {
    chrome.storage.local.get(["sessionToken"], async (res) => {
      const token = res.sessionToken;
      if (!token) {
        clearCardFromAllTabs();
        return sendResponse({ error: "Please sign in first." });
      }

      const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SUMMARY_REQUEST_TIMEOUT_MS);
      try {
        let endpoint = request.action === "SAVE_DASHBOARD"
          ? "save-dashboard"
          : request.action === "CREATE_SHARE_LINK"
            ? "share-links"
            : "extension-capture";
        const response = await fetch(`${API_BASE}/api/${endpoint}`, {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify(request.data || {
            pageText: request.pageText,
            pageTitle: request.pageTitle,
            summaryLanguage: request.summaryLanguage,
            summaryMode: request.summaryMode,
            sourceSections: request.sourceSections
          })
        });

        if (response.status === 401) {
          clearSignedInState(() => {
            clearCardFromAllTabs();
            syncDashboardLogoutTabs();
          });
          return sendResponse({ error: "Session expired. Please sign in again." });
        }

        sendResponse(await response.json());
      } catch (err) {
        sendResponse({ error: controller.signal.aborted ? "Summary request timed out. Please try again." : "Server unreachable." });
      } finally {
        clearTimeout(timeoutId);
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
    clearSignedInState(() => {
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

  chrome.storage.local.get(["user", "sessionToken", "summaryLanguage", "summaryMode"], async (res) => {
    const currentUser = (res.sessionToken && res.user) ? res.user : null;

    let textToUse = selectedText;
    let finalIsSelection = isSelection;

    let documentKind = "page";
    let sourceError = "";
    let pageCount = 0;
    let textWasTruncated = false;
    let sourceSections = [];
    if (!isSelection && isPdfUrl(tab.url)) {
      documentKind = "PDF";
      try {
        const extracted = await extractPdfText(tab.url);
        textToUse = extracted.text;
        pageCount = extracted.pageCount;
        textWasTruncated = extracted.truncated;
        sourceSections = extracted.sections || [];
      } catch (error) {
        textToUse = "";
        sourceError = error?.message || "Brief could not read this PDF.";
      }
    } else if (!isSelection) {
      let results;
      try {
        results = await chrome.scripting.executeScript({
          // A page can place readable content in an iframe. Check all frames
          // and prefer an actual selection from any of them before using the
          // document text as the full-page capture.
          target: { tabId: tab.id, allFrames: true },
          func: () => {
            const selectedPageText = window.getSelection?.().toString().trim() || "";
            const activeElement = document.activeElement;
            const isTextField = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;
            const selectedFieldText = isTextField
              && typeof activeElement.selectionStart === "number"
              && typeof activeElement.selectionEnd === "number"
              && activeElement.selectionEnd > activeElement.selectionStart
              ? activeElement.value.slice(activeElement.selectionStart, activeElement.selectionEnd).trim()
              : "";
            const selection = selectedPageText || selectedFieldText;
            return selection
              ? { isSelection: true, text: selection }
              : { isSelection: false, text: document.body.innerText || "" };
          }
        });
      } catch {
        return;
      }
      const payloads = results?.map(result => result?.result).filter(Boolean) || [];
      const payload = payloads.find(result => result.isSelection)
        || payloads.find(result => result.text)
        || { isSelection: false, text: "" };
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
        summaryLanguage: res.summaryLanguage || "auto",
        summaryMode: res.summaryMode || "quick",
        documentKind,
        pageCount,
        textWasTruncated,
        sourceSections,
        sourceError
      }]
    }).catch(() => {});
  });
}

function renderUI(context) {
  // chrome.scripting serializes this function into the page, so helpers used
  // below must live inside it rather than relying on the service-worker scope.
  const SUMMARY_FEEDBACK_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;
  const SUMMARY_FEEDBACK_STORAGE_KEY = "summaryFeedbackPromptState";
  const SUMMARY_REQUEST_TIMEOUT_MS = 65000;
  const planSummaryFeedbackPrompt = (callback) => {
    chrome.storage.local.get({ [SUMMARY_FEEDBACK_STORAGE_KEY]: {} }, (stored) => {
      const previous = stored[SUMMARY_FEEDBACK_STORAGE_KEY] || {};
      const successfulSummaries = Math.max(0, Number(previous.successfulSummaries) || 0) + 1;
      const nextPromptAt = Math.max(3, Number(previous.nextPromptAt) || 3);
      const lastPromptAt = Math.max(0, Number(previous.lastPromptAt) || 0);
      const now = Date.now();
      const shouldShow = successfulSummaries >= nextPromptAt && (!lastPromptAt || now - lastPromptAt >= SUMMARY_FEEDBACK_INTERVAL_MS);
      const nextState = shouldShow
        ? { successfulSummaries, nextPromptAt: successfulSummaries + 10, lastPromptAt: now }
        : { successfulSummaries, nextPromptAt, lastPromptAt };
      chrome.storage.local.set({ [SUMMARY_FEEDBACK_STORAGE_KEY]: nextState }, () => callback(shouldShow));
    });
  };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  // Order languages by broad global web-content reach, rather than by the
  // development team's locale. "Same as article" remains the default.
  const summaryLanguages = [
    ["auto", "Same as article"], ["en", "English"], ["es", "Español"],
    ["de", "Deutsch"], ["ja", "日本語"], ["fr", "Français"],
    ["pt", "Português"], ["ru", "Русский"], ["zh", "中文"],
    ["ar", "العربية"], ["hi", "हिन्दी"], ["ko", "한국어"],
    ["it", "Italiano"], ["tr", "Türkçe"], ["nl", "Nederlands"],
    ["pl", "Polski"], ["uk", "Українська"]
  ];
  const selectedSummaryLanguage = summaryLanguages.some(([value]) => value === context.summaryLanguage)
    ? context.summaryLanguage
    : "auto";
  const languageOptions = summaryLanguages.map(([value, label]) =>
    `<option value="${value}"${value === selectedSummaryLanguage ? " selected" : ""}>${label}</option>`
  ).join("");
  const summaryModes = [
    ["quick", "Quick brief — main takeaway"],
    ["detailed", "Detailed notes — more context"],
    ["source_notes", "Notes by page/section — beta"]
  ];
  const selectedSummaryMode = summaryModes.some(([value]) => value === context.summaryMode)
    ? context.summaryMode
    : "quick";
  const summaryModeOptions = summaryModes.map(([value, label]) =>
    `<option value="${value}"${value === selectedSummaryMode ? " selected" : ""}>${label}</option>`
  ).join("");
  const sourceLabels = {
    en: "Source", tr: "Kaynak", de: "Quelle", es: "Fuente", fr: "Source",
    it: "Fonte", pt: "Fonte", nl: "Bron", pl: "Źródło", ru: "Источник",
    uk: "Джерело", ar: "المصدر", ja: "出典", ko: "출처", zh: "来源", hi: "स्रोत"
  };
  const pageLanguage = String(document.documentElement.lang || "").toLowerCase().split("-")[0];
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
        <span>${context.documentKind === "PDF" && context.pageCount ? `${context.pageCount} pages · ` : ""}~${context.wordCount} words</span>
      </div>
    </div>
    ${context.documentKind === "PDF" && !context.isSelection ? `<div style="color:#6b7280;font-size:11px;line-height:1.4;margin:-6px 0 12px;">To summarize highlighted PDF text, right-click the selection and choose “Brief: summarize selected text”.</div>` : ""}
    <div id="ai-body">
      ${context.sourceError ? `<div style="color:#dc2626;font-size:12px;line-height:1.5;">${escapeHtml(context.sourceError)}</div><div style="color:#6b7280;font-size:12px;line-height:1.5;margin-top:8px;">Brief supports text-based PDFs. A scanned PDF needs OCR before it can be summarized.</div>` : `${context.textWasTruncated ? `<div style="color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px;font-size:12px;line-height:1.4;margin-bottom:10px;">This PDF is long, so Brief will summarize the first part of its selectable text.</div>` : ""}<label for="ai-language" style="display:block;color:#4b5563;font-size:12px;font-weight:500;margin:0 0 6px;">Summary language</label><select id="ai-language" style="width:100%;padding:8px;background:#ffffff;border:1px solid #d1d5db;border-radius:6px;color:#111827;font-size:12px;box-sizing:border-box;margin-bottom:10px;">${languageOptions}</select><label for="ai-summary-mode" style="display:block;color:#4b5563;font-size:12px;font-weight:500;margin:0 0 6px;">What do you need?</label><select id="ai-summary-mode" style="width:100%;padding:8px;background:#ffffff;border:1px solid #d1d5db;border-radius:6px;color:#111827;font-size:12px;box-sizing:border-box;margin-bottom:6px;">${summaryModeOptions}</select><div style="color:#6b7280;font-size:11px;line-height:1.4;margin-bottom:10px;">Page notes use PDF pages; web pages are split into readable sections.</div><button id="ai-sum-btn" style="width:100%;padding:9px;background:#111827;color:white;border:none;border-radius:6px;font-weight:500;cursor:pointer;font-size:13px;">${context.documentKind === "PDF" ? "Summarize PDF" : "Summarize"}</button>`}
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

  const summarizeButton = document.getElementById("ai-sum-btn");
  if (!summarizeButton) return;

  summarizeButton.onclick = () => {
    const summaryLanguage = document.getElementById("ai-language").value;
    const summaryMode = document.getElementById("ai-summary-mode").value;
    chrome.storage.local.set({ summaryLanguage, summaryMode });
    const body = document.getElementById("ai-body");
    body.innerHTML = `<div style="color:#6b7280;font-size:12px;padding:8px 0;">Generating summary...</div>`;
    let requestFinished = false;
    const uiTimeoutId = setTimeout(() => {
      if (requestFinished) return;
      requestFinished = true;
      body.innerHTML = `<div style="color:#dc2626;font-size:12px;line-height:1.5;">This summary is taking longer than expected. Please close this panel and try again.</div>`;
    }, SUMMARY_REQUEST_TIMEOUT_MS + 5000);
    chrome.runtime.sendMessage({ action: "FETCH_SUMMARY", pageText: context.pageText, pageTitle: context.title, summaryLanguage, summaryMode, sourceSections: context.sourceSections }, (data) => {
      if (requestFinished) return;
      requestFinished = true;
      clearTimeout(uiTimeoutId);
      if (data?.summary) {
        planSummaryFeedbackPrompt((showSummaryFeedback) => {
          body.innerHTML = `
          <div style="background:#f9fafb;border:1px solid #e5e7eb;padding:12px;border-radius:6px;max-height:180px;overflow-y:auto;margin-bottom:10px;color:#374151;line-height:1.6;font-size:12px;">${escapeHtml(data.summary).replace(/\n/g, '<br>')}</div>
          ${showSummaryFeedback ? '<div id="ai-summary-feedback" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:9px 10px;margin-bottom:10px;color:#4b5563;font-size:12px;">Was this summary helpful? <button id="ai-summary-helpful" style="background:#fff;border:1px solid #d1d5db;border-radius:5px;color:#374151;cursor:pointer;font-size:12px;margin-left:5px;padding:4px 7px;">Yes</button><button id="ai-summary-not-helpful" style="background:#fff;border:1px solid #d1d5db;border-radius:5px;color:#374151;cursor:pointer;font-size:12px;margin-left:4px;padding:4px 7px;">No</button></div>' : ''}
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <button id="ai-copy-btn" style="flex:1;padding:8px;background:#ffffff;color:#374151;border:1px solid #d1d5db;border-radius:6px;font-weight:500;cursor:pointer;font-size:12px;">Copy summary</button>
            <button id="ai-share-btn" style="flex:1;padding:8px;background:#ffffff;color:#374151;border:1px solid #d1d5db;border-radius:6px;font-weight:500;cursor:pointer;font-size:12px;">Share</button>
            <button id="ai-change-options" style="flex:1;padding:8px;background:#ffffff;color:#374151;border:1px solid #d1d5db;border-radius:6px;font-weight:500;cursor:pointer;font-size:12px;">Change options</button>
          </div>
          <div id="ai-share-options" style="display:none;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:-2px 0 10px;">
            <button id="ai-system-share" style="padding:7px;background:#ffffff;color:#374151;border:1px solid #d1d5db;border-radius:6px;font-weight:500;cursor:pointer;font-size:11px;">System</button>
            <button id="ai-whatsapp-share" style="padding:7px;background:#ffffff;color:#374151;border:1px solid #d1d5db;border-radius:6px;font-weight:500;cursor:pointer;font-size:11px;">WhatsApp</button>
            <button id="ai-email-share" style="padding:7px;background:#ffffff;color:#374151;border:1px solid #d1d5db;border-radius:6px;font-weight:500;cursor:pointer;font-size:11px;">Email</button>
            <div id="ai-share-note" style="grid-column:1 / -1;color:#6b7280;font-size:11px;line-height:1.4;padding-top:2px;"></div>
          </div>
          <details style="margin:0 0 10px;"><summary style="color:#6b7280;cursor:pointer;font-size:12px;">Add a tag or note (optional)</summary><div style="padding-top:8px;"><input type="text" id="ai-tag" placeholder="Tag / Custom Title" style="width:100%;padding:8px;background:#ffffff;border:1px solid #d1d5db;border-radius:6px;color:#111827;font-size:12px;box-sizing:border-box;margin-bottom:8px;"><textarea id="ai-comment" rows="2" placeholder="Note" style="width:100%;padding:8px;background:#ffffff;border:1px solid #d1d5db;border-radius:6px;color:#111827;font-size:12px;box-sizing:border-box;resize:none;"></textarea></div></details>
          <button id="ai-save-btn" style="width:100%;padding:9px;background:#059669;color:white;border:none;border-radius:6px;font-weight:500;cursor:pointer;font-size:13px;">Save to library</button>
          <button id="ai-discard-btn" style="width:100%;padding:7px;background:none;color:#6b7280;border:none;font-weight:500;cursor:pointer;font-size:12px;margin-top:4px;">Close without saving</button>
          <div id="ai-save-status" style="font-size:12px;text-align:center;margin-top:8px;"></div>
        `;
        document.getElementById("ai-change-options").onclick = () => renderUI(context);
        document.getElementById("ai-discard-btn").onclick = () => card.remove();
        const submitSummaryFeedback = (helpful, comment = "") => {
          chrome.runtime.sendMessage({ action: "SUBMIT_PRODUCT_FEEDBACK", data: { type: "summary_feedback", helpful, comment } }, (res) => {
            const feedback = document.getElementById("ai-summary-feedback");
            if (!feedback) return;
            feedback.innerText = res?.success ? "Thank you — this helps improve Brief." : (res?.error || "Could not send feedback.");
          });
        };
        if (showSummaryFeedback) document.getElementById("ai-summary-helpful").onclick = () => submitSummaryFeedback(true);
        if (showSummaryFeedback) document.getElementById("ai-summary-not-helpful").onclick = () => {
          const feedback = document.getElementById("ai-summary-feedback");
          feedback.innerHTML = `<div style="margin-bottom:6px;">What could be better? <span style="color:#6b7280;">(optional)</span></div><textarea id="ai-summary-feedback-comment" rows="2" maxlength="1200" style="width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:5px;font:inherit;font-size:12px;padding:6px;resize:none;"></textarea><button id="ai-summary-feedback-send" style="background:#111827;border:0;border-radius:5px;color:#fff;cursor:pointer;font-size:12px;margin-top:6px;padding:6px 8px;">Send feedback</button><button id="ai-summary-feedback-skip" style="background:none;border:0;color:#6b7280;cursor:pointer;font-size:12px;margin-left:6px;">Skip</button>`;
          document.getElementById("ai-summary-feedback-send").onclick = () => submitSummaryFeedback(false, document.getElementById("ai-summary-feedback-comment").value.trim());
          document.getElementById("ai-summary-feedback-skip").onclick = () => submitSummaryFeedback(false);
        };
        // Use the language selected for this request, not the language that
        // happened to be selected when the card was first opened.
        const generatedShareLanguage = summaryLanguage === "auto" ? pageLanguage : summaryLanguage;
        const generatedSourceLabel = sourceLabels[generatedShareLanguage] || sourceLabels[pageLanguage] || "Source";
        const shareTitle = data.title || context.title || "Brief summary";
        const shareText = [shareTitle, data.summary, context.url ? `${generatedSourceLabel}: ${context.url}` : ""].filter(Boolean).join("\n\n");
        const shareFooters = {
          tr: "Brief ile özetlendi · Brief’e kaydet:", es: "Resumido con Brief · Guarda una copia en Brief:",
          de: "Mit Brief zusammengefasst · In Brief speichern:", fr: "Résumé avec Brief · Enregistrer dans Brief :",
          it: "Riassunto con Brief · Salva una copia in Brief:", pt: "Resumido com Brief · Salvar uma cópia no Brief:",
          nl: "Samengevat met Brief · Bewaar een kopie in Brief:", pl: "Podsumowano z Brief · Zapisz kopię w Brief:",
          ru: "Кратко с Brief · Сохранить копию в Brief:", uk: "Підсумовано з Brief · Зберегти копію в Brief:",
          ar: "تم التلخيص باستخدام Brief · احفظ نسخة في Brief:", ja: "Brief で要約 · Brief に保存:",
          ko: "Brief로 요약됨 · Brief에 사본 저장:", zh: "由 Brief 总结 · 保存到 Brief:",
          hi: "Brief द्वारा सारांशित · Brief में कॉपी सहेजें:"
        };
        const shareFooter = shareFooters[generatedShareLanguage] || "Summarized with Brief · Save a copy:";
        const shareNotes = {
          tr: "Paylaşımlar, alıcıların bir kopyayı kaydedebilmesi için listelenmemiş bir Brief bağlantısı içerir.",
          es: "Las comparticiones incluyen un enlace no listado de Brief para que los destinatarios puedan guardar una copia.",
          de: "Geteilte Inhalte enthalten einen nicht gelisteten Brief-Link, damit Empfänger eine Kopie speichern können.",
          fr: "Les partages incluent un lien Brief non répertorié pour que les destinataires puissent enregistrer une copie.",
          it: "Le condivisioni includono un link Brief non in elenco per consentire ai destinatari di salvare una copia.",
          pt: "Os compartilhamentos incluem um link não listado do Brief para que os destinatários possam salvar uma cópia.",
          nl: "Gedeelde items bevatten een niet-vermelde Brief-link zodat ontvangers een kopie kunnen opslaan.",
          pl: "Udostępnienia zawierają niepubliczny link Brief, aby odbiorcy mogli zapisać kopię.",
          ru: "В публикации есть непубличная ссылка Brief, чтобы получатели могли сохранить копию.",
          uk: "Поширення містять непублічне посилання Brief, щоб одержувачі могли зберегти копію.",
          ar: "تتضمن المشاركات رابط Brief غير مدرج ليتمكن المستلمون من حفظ نسخة.",
          ja: "共有には、受信者がコピーを保存できる未公開の Brief リンクが含まれます。",
          ko: "공유에는 수신자가 사본을 저장할 수 있도록 비공개 Brief 링크가 포함됩니다.",
          zh: "分享内容包含一个未公开的 Brief 链接，收件人可以保存副本。",
          hi: "शेयर में एक असूचीबद्ध Brief लिंक शामिल है ताकि प्राप्तकर्ता एक कॉपी सहेज सकें।"
        };
        document.getElementById("ai-share-note").innerText = shareNotes[generatedShareLanguage] || "Shares include an unlisted Brief link so recipients can save a copy.";
        const shareOptions = document.getElementById("ai-share-options");
        document.getElementById("ai-share-btn").onclick = () => {
          shareOptions.style.display = shareOptions.style.display === "grid" ? "none" : "grid";
        };
        const shareTextWithBrief = () => new Promise((resolve, reject) => {
          chrome.storage.local.get(["briefShareLinkConsent"], (stored) => {
            if (!stored.briefShareLinkConsent) {
              const include = confirm("To let recipients save this Brief, Brief will create an unlisted public link containing this title, summary, and source. OK includes the link. Cancel shares normally without it.");
              if (!include) return resolve(shareText);
              chrome.storage.local.set({ briefShareLinkConsent: true });
            }
            chrome.runtime.sendMessage({ action: "CREATE_SHARE_LINK", data: { title: shareTitle, summary: data.summary, sourceUrl: context.url } }, (res) => {
              if (!res?.success || !res?.url) return reject(new Error(res?.error || "Could not create a Brief share link."));
              resolve([shareText, `${shareFooter} ${res.url}`].filter(Boolean).join("\n\n"));
            });
          });
        });
        document.getElementById("ai-system-share").onclick = async () => {
          if (!navigator.share) {
            alert("System sharing is not available here. Choose WhatsApp, Email, or Copy instead.");
            return;
          }
          try {
            await navigator.share({ title: shareTitle, text: await shareTextWithBrief() });
          } catch (error) {
            if (error?.name !== "AbortError") alert("Could not open system sharing. Please try another option.");
          }
        };
        document.getElementById("ai-whatsapp-share").onclick = async () => {
          try {
            window.open(`https://wa.me/?text=${encodeURIComponent(await shareTextWithBrief())}`, "_blank", "noopener,noreferrer");
          } catch (error) {
            alert(error.message || "Could not prepare this share.");
          }
        };
        document.getElementById("ai-email-share").onclick = async () => {
          try {
            window.location.href = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(await shareTextWithBrief())}`;
          } catch (error) {
            alert(error.message || "Could not prepare this share.");
          }
        };
        document.getElementById("ai-copy-btn").onclick = async () => {
          const copyButton = document.getElementById("ai-copy-btn");
          try {
            await navigator.clipboard.writeText(data.summary);
            copyButton.innerText = "Copied";
          } catch {
            copyButton.innerText = "Copy unavailable";
          }
        };
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
            pageText: context.pageText,
            summaryLanguage,
            summaryMode
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
        });
      } else {
        body.innerHTML = `<div style="color:#dc2626;font-size:12px;">${escapeHtml(data?.error || "Error generating summary.")}</div>`;
      }
    });
  };
}
