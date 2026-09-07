(function () {
  const url = new URL(window.location.href);

  // 1. HARD STOP: Explicit dashboard logout
  if (url.searchParams.get("action") === "logout") {
    localStorage.removeItem("sessionToken");
    chrome.runtime.sendMessage({ action: "CLEAR_TOKEN_FROM_WEB" });
    return;
  }

  // 2. INITIAL PAGE LOAD SYNC
  chrome.storage.local.get(["sessionToken"], (res) => {
    const extToken = res?.sessionToken;
    const webToken = localStorage.getItem("sessionToken");

    if (extToken) {
      localStorage.setItem("sessionToken", extToken);
      if (!url.searchParams.has("token")) {
        url.searchParams.set("token", extToken);
        window.location.replace(url.toString());
      }
    } else if (webToken) {
      chrome.runtime.sendMessage({
        action: "SYNC_TOKEN_FROM_WEB",
        token: webToken
      });
    }
  });
})();
