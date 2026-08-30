const DASHBOARD_ORIGIN = "https://brief.berkaytaskol.workers.dev";

// Listen for secure messages broadcasted by dashboard
window.addEventListener("message", (event) => {
  if (event.origin !== DASHBOARD_ORIGIN) return;
  if (!event.data || event.data.source !== "BRIEF_DASHBOARD") return;

  if (event.data.status === "logged_in" && event.data.token) {
    chrome.runtime.sendMessage({ action: "SYNC_TOKEN_FROM_WEB", token: event.data.token });
  } else if (event.data.status === "logged_out") {
    chrome.runtime.sendMessage({ action: "CLEAR_TOKEN_FROM_WEB" });
  }
});

// Request initial auth state on page load
function requestAuthState() {
  window.postMessage({ source: "BRIEF_EXTENSION", action: "REQUEST_AUTH_STATE" }, DASHBOARD_ORIGIN);
}

requestAuthState();
