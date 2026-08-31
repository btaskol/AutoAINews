const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

const htmlHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  ...corsHeaders
};

const GOOGLE_CLIENT_ID = "726105967128-hpv2tes67ad9m4iflgea1crc8lp9oohj.apps.googleusercontent.com";

async function verifyGoogleToken(googleIdToken) {
  try {
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${googleIdToken}`);
    if (!googleRes.ok) return null;

    const payload = await googleRes.json();
    if (!payload.sub || !payload.email) return null;

    return { sub: payload.sub, email: payload.email, name: payload.name || "", picture: payload.picture || "" };
  } catch (e) {
    return null;
  }
}

async function getUserBySessionToken(authHeader, env) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];

  const user = await env.DB.prepare(`
    SELECT * FROM users 
    WHERE session_token = ? 
    AND (session_expires_at IS NULL OR session_expires_at > CURRENT_TIMESTAMP)
  `).bind(token).first();

  return user || null;
}

function calculateTrial(createdAtStr, subscriptionStatus) {
  if (subscriptionStatus === 'active') {
    return { allowed: true, status: 'active', daysLeft: 0 };
  }
  const createdAt = new Date(createdAtStr || Date.now());
  const now = new Date();
  const diffMs = now - createdAt;
  const daysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const daysLeft = Math.max(0, 14 - daysPassed);
  const isTrialActive = daysPassed < 14;

  return {
    allowed: isTrialActive,
    status: isTrialActive ? 'trial' : 'expired',
    daysLeft
  };
}

function renderMinimalAuthPage(origin, message = "", clearStorage = false) {
  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.set("response_type", "id_token");
  googleAuthUrl.searchParams.set("redirect_uri", `${origin}/dashboard`);
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("nonce", Math.random().toString(36).substring(2));

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Brief — Sign In</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        :root { --bg: #fcfcfc; --card-bg: #ffffff; --text: #111827; --text-muted: #6b7280; --border: #e5e7eb; --sub-bg: #f3f4f6; }
        [data-theme="dark"] { --bg: #0f172a; --card-bg: #1e293b; --text: #f8fafc; --text-muted: #94a3b8; --border: #334155; --sub-bg: #1e293b; }
        * { box-sizing: border-box; }
        body { background-color: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 24px; }
        .login-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 40px 32px; width: 100%; max-width: 400px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); text-align: center; }
        .logo-mark { width: 44px; height: 44px; background: #111827; color: #ffffff; border-radius: 10px; font-weight: 700; font-size: 22px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; }
        [data-theme="dark"] .logo-mark { background: #38bdf8; color: #0f172a; }
        h1 { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 8px 0; }
        p { font-size: 14px; color: var(--text-muted); margin: 0 0 28px 0; line-height: 1.5; }
        .btn-google { display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 10px 16px; background-color: #ffffff; color: #374151; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; font-weight: 500; text-decoration: none; cursor: pointer; }
        .btn-google:hover { background-color: #f9fafb; }
        .message { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; padding: 10px; background: var(--sub-bg); border-radius: 6px; }
      </style>
    </head>
    <body>
      <div class="login-card">
        <div class="logo-mark">B</div>
        <h1>Brief</h1>
        <p>Sign in to access your personal research summaries and web captures.</p>
        <div id="statusMsg" class="message" style="${message ? '' : 'display:none;'}">${message}</div>
        <a href="${googleAuthUrl.href}" id="loginBtn" class="btn-google">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          Sign in with Google
        </a>
      </div>

      <script>
        if (localStorage.getItem('theme') === 'dark') {
          document.documentElement.setAttribute('data-theme', 'dark');
        }

        ${clearStorage ? "localStorage.removeItem('sessionToken');" : ""}

        function emitLogout() {
          window.postMessage({ source: 'BRIEF_DASHBOARD', status: 'logged_out' }, window.location.origin);
        }

        emitLogout();

        window.addEventListener('message', (event) => {
          if (event.origin !== window.location.origin) return;
          if (event.data && event.data.source === 'BRIEF_EXTENSION' && event.data.action === 'REQUEST_AUTH_STATE') {
            emitLogout();
          }
        });

        if (window.location.search.includes('action=logout')) {
          localStorage.removeItem('sessionToken');
          window.history.replaceState({}, document.title, '/dashboard');
        }

        const statusMsg = document.getElementById('statusMsg');

        if (window.location.hash.includes('id_token=')) {
          statusMsg.innerText = "Signing in...";
          statusMsg.style.display = "block";
          const params = new URLSearchParams(window.location.hash.substring(1));
          const idToken = params.get('id_token');
          if (idToken) {
            fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ googleToken: idToken })
            })
            .then(res => res.json())
            .then(data => {
              if (data.success && data.sessionToken) {
                localStorage.setItem('sessionToken', data.sessionToken);
                window.location.href = '/dashboard?token=' + data.sessionToken;
              } else {
                statusMsg.innerText = "Authentication failed. Please try again.";
                localStorage.removeItem('sessionToken');
              }
            })
            .catch(() => {
              statusMsg.innerText = "Connection error. Please try again.";
              localStorage.removeItem('sessionToken');
            });
          }
        } else {
          const savedToken = localStorage.getItem('sessionToken');
          if (savedToken && !window.location.search.includes('token')) {
            window.location.href = '/dashboard?token=' + savedToken;
          }
        }
      </script>
    </body>
    </html>
  `;
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(req.url);
    const origin = url.origin;

    if (url.pathname === "/" && req.method === "GET") {
      return new Response(renderMinimalAuthPage(origin), { headers: htmlHeaders });
    }

    if (url.pathname === "/api/auth/google" && req.method === "POST") {
      try {
        const { googleToken } = await req.json();
        const googleUser = await verifyGoogleToken(googleToken);

        if (!googleUser) return new Response(JSON.stringify({ error: "Invalid Google Token" }), { status: 401, headers: corsHeaders });

        const appSessionToken = crypto.randomUUID();
        const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        await env.DB.prepare(`
          INSERT INTO users (id, email, name, picture, session_token, session_expires_at) 
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET 
            email = excluded.email, 
            name = excluded.name, 
            picture = excluded.picture,
            session_token = excluded.session_token,
            session_expires_at = excluded.session_expires_at
        `).bind(googleUser.sub, googleUser.email, googleUser.name, googleUser.picture, appSessionToken, sessionExpiresAt).run();

        const dbUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(googleUser.sub).first();
        const trialInfo = calculateTrial(dbUser.created_at, dbUser.subscription_status);

        return new Response(JSON.stringify({
          success: true,
          user: { id: googleUser.sub, email: googleUser.email, name: googleUser.name, picture: googleUser.picture, trial: trialInfo },
          sessionToken: appSessionToken
        }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Auth Error: " + err.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/api/auth/verify" && req.method === "GET") {
      const authHeader = req.headers.get("Authorization");
      const user = await getUserBySessionToken(authHeader, env);
      
      if (!user) return new Response(JSON.stringify({ error: "Invalid or expired session" }), { status: 401, headers: corsHeaders });

      const trialInfo = calculateTrial(user.created_at, user.subscription_status);

      return new Response(JSON.stringify({
        success: true,
        user: { id: user.id, email: user.email, name: user.name, picture: user.picture, trial: trialInfo }
      }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    if (url.pathname === "/dashboard" && req.method === "GET") {
      if (url.searchParams.get("action") === "logout") {
        return new Response(renderMinimalAuthPage(origin, "Signed out successfully.", true), { headers: htmlHeaders });
      }

      let token = url.searchParams.get("token");
      let user = null;

      if (token) {
        user = await getUserBySessionToken(`Bearer ${token}`, env);
      }

      if (!user) {
        return new Response(renderMinimalAuthPage(origin, "Session expired. Please sign in.", true), { headers: htmlHeaders });
      }

      const trialInfo = calculateTrial(user.created_at, user.subscription_status);

      const { results } = await env.DB.prepare(
        "SELECT * FROM summaries WHERE user_id = ? ORDER BY created_at DESC"
      ).bind(user.id).all();

      const cardsHtml = results.length > 0 ? results.map(s => `
        <div id="card-${s.id}" class="card">
          <div class="card-header">
            <span id="tag-display-${s.id}" class="card-tag">${s.custom_title || "Web Capture"}</span>
            <input type="text" id="tag-edit-${s.id}" class="card-input-inline" value="${s.custom_title || ''}" style="display:none;" placeholder="Tag / Category">
            <div class="card-meta">
              <span>${s.created_at || "Recent"}</span>
              <button id="btn-edit-${s.id}" onclick="enableCardEdit('${s.id}')" class="btn-text">Edit</button>
              <button onclick="deleteSummary('${s.id}')" class="btn-text-danger">Delete</button>
            </div>
          </div>
          
          <h2 id="title-display-${s.id}" class="card-title">${s.title}</h2>
          <input type="text" id="title-edit-${s.id}" class="card-title-input-inline" value="${s.title}" style="display:none;" placeholder="Article Title">

          <div class="card-body-wrapper">
            <div class="card-body clamped">${s.summary}</div>
            <button class="btn-expand" onclick="toggleExpand(this)" style="display:none;">Show More</button>
          </div>

          <div id="note-display-${s.id}" class="card-note" style="${s.comment ? '' : 'display:none;'}">${s.comment ? 'Note: ' + s.comment : ''}</div>
          <textarea id="note-edit-${s.id}" class="card-textarea-inline" style="display:none;" placeholder="Add a note...">${s.comment || ''}</textarea>
          
          <div id="edit-actions-${s.id}" class="edit-actions" style="display:none;">
            <button onclick="saveCardEdit('${s.id}')" class="btn-secondary-sm">Save Changes</button>
            <button onclick="cancelCardEdit('${s.id}')" class="btn-text">Cancel</button>
          </div>

          <div class="card-footer">
            <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="resource-link">Visit Source ↗</a>
          </div>
        </div>
      `).join("") : `<div class="empty-state">No saved briefs found. Use Brief to capture pages.</div>`;

      const badgeText = trialInfo.status === 'active' ? 'Pro Member' : (trialInfo.allowed ? `Trial: ${trialInfo.daysLeft} days left` : 'Trial Expired');
      const badgeStyle = trialInfo.status === 'active' ? 'background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;' : (trialInfo.allowed ? 'background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;' : 'background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;');

      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <title>Dashboard — Brief</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            :root { --bg: #fcfcfc; --card-bg: #ffffff; --text: #111827; --text-muted: #6b7280; --border: #e5e7eb; --sub-bg: #f9fafb; --sub-border: #f3f4f6; --accent: #2563eb; --accent-hover: #1d4ed8; --note-bg: #fffbe3; --note-border: #fef3c7; --note-text: #d97706; }
            [data-theme="dark"] { --bg: #0f172a; --card-bg: #1e293b; --text: #f8fafc; --text-muted: #94a3b8; --border: #334155; --sub-bg: #0f172a; --sub-border: #334155; --accent: #38bdf8; --accent-hover: #60a5fa; --note-bg: #292524; --note-border: #44403c; --note-text: #fbbf24; }
            * { box-sizing: border-box; }
            body { background-color: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 720px; margin: 0 auto; padding: 40px 20px; line-height: 1.5; transition: background-color 0.2s ease, color 0.2s ease; }
            header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 20px; margin-bottom: 24px; }
            .brand { display: flex; align-items: center; gap: 10px; }
            .logo-icon { width: 28px; height: 28px; background: var(--text); color: var(--bg); border-radius: 6px; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; }
            h1 { font-size: 18px; font-weight: 600; letter-spacing: -0.01em; margin: 0; }
            .header-actions { display: flex; align-items: center; gap: 12px; }
            .status-badge { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 12px; }
            .search-container { margin-bottom: 24px; }
            .search-input { width: 100%; padding: 10px 14px; background: var(--card-bg); color: var(--text); border: 1px solid var(--border); border-radius: 8px; font-size: 13px; outline: none; transition: border-color 0.15s ease; }
            .search-input:focus { border-color: var(--accent); }
            .btn-secondary { background: var(--card-bg); color: var(--text); border: 1px solid var(--border); padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; }
            .btn-secondary:hover { background: var(--sub-bg); }
            .btn-secondary-sm { background: var(--card-bg); color: var(--text); border: 1px solid var(--border); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; }
            .btn-secondary-sm:hover { background: var(--sub-bg); }
            .btn-text { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 12px; padding: 0; }
            .btn-text:hover { color: var(--text); }
            .btn-text-danger { background: none; border: none; color: #dc2626; cursor: pointer; font-size: 12px; padding: 0; }
            .btn-text-danger:hover { text-decoration: underline; }
            .profile-dropdown { position: relative; }
            .dropdown-menu { display: none; position: absolute; right: 0; top: 36px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; width: 200px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 100; padding: 4px 0; }
            .dropdown-menu.show { display: block; }
            .dropdown-item { width: 100%; text-align: left; padding: 8px 12px; background: none; border: none; color: var(--text); font-size: 13px; cursor: pointer; }
            .dropdown-item:hover { background: var(--sub-bg); }
            .dropdown-item.danger { color: #dc2626; border-top: 1px solid var(--border); }
            .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 16px; }
            .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
            .card-tag { font-size: 12px; font-weight: 500; color: var(--accent); }
            .card-meta { display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--text-muted); }
            .card-title { font-size: 15px; font-weight: 600; margin: 0 0 12px 0; color: var(--text); }
            .card-input-inline { font-size: 12px; padding: 4px 8px; background: var(--sub-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; outline: none; width: 50%; }
            .card-title-input-inline { width: 100%; font-size: 15px; font-weight: 600; padding: 6px 10px; margin-bottom: 12px; background: var(--sub-bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; outline: none; font-family: inherit; }
            .card-textarea-inline { width: 100%; font-size: 12px; padding: 8px; margin-top: 10px; background: var(--sub-bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; outline: none; resize: vertical; font-family: inherit; }
            .edit-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; align-items: center; }
            .card-body-wrapper { position: relative; }
            .card-body { font-size: 13px; color: var(--text); white-space: pre-wrap; line-height: 1.6; background: var(--sub-bg); padding: 12px; border-radius: 6px; border: 1px solid var(--sub-border); }
            .card-body.clamped { display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
            .btn-expand { background: none; border: none; color: var(--accent); font-size: 12px; font-weight: 500; cursor: pointer; margin-top: 6px; padding: 0; }
            .btn-expand:hover { text-decoration: underline; }
            .card-note { font-size: 12px; color: var(--note-text); margin-top: 10px; background: var(--note-bg); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--note-border); }
            .card-footer { margin-top: 14px; display: flex; justify-content: flex-end; }
            .resource-link { font-size: 12px; color: var(--accent); text-decoration: none; font-weight: 500; }
            .resource-link:hover { text-decoration: underline; }
            .empty-state { text-align: center; padding: 48px 20px; color: var(--text-muted); background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; font-size: 14px; }
          </style>
        </head>
        <body>
          <script>
            if (localStorage.getItem('theme') === 'dark') {
              document.documentElement.setAttribute('data-theme', 'dark');
            }

            const activeToken = "${token}";
            localStorage.setItem('sessionToken', activeToken);

            if (window.location.search.includes('token=')) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }

            function emitAuthState() {
              window.postMessage({
                source: 'BRIEF_DASHBOARD',
                status: 'logged_in',
                token: activeToken
              }, window.location.origin);
            }

            emitAuthState();
            window.addEventListener('message', (event) => {
              if (event.origin !== window.location.origin) return;
              if (event.data && event.data.source === 'BRIEF_EXTENSION' && event.data.action === 'REQUEST_AUTH_STATE') {
                emitAuthState();
              }
            });
          </script>
          <header>
            <div class="brand">
              <div class="logo-icon">B</div>
              <h1>Brief</h1>
            </div>
            <div class="header-actions">
              <span class="status-badge" style="${badgeStyle}">${badgeText}</span>
              <button class="btn-secondary" id="themeToggleBtn">Dark</button>
              <div class="profile-dropdown">
                <button class="btn-secondary" id="profBtn">${user.email}</button>
                <div class="dropdown-menu" id="profMenu">
                  <button class="dropdown-item" id="logoutBtn">Sign Out</button>
                  <button class="dropdown-item danger" id="deleteBtn">Delete Account</button>
                </div>
              </div>
            </div>
          </header>

          <div class="search-container">
            <input type="text" id="searchInput" class="search-input" placeholder="Search briefs, tags, or notes...">
          </div>

          <main id="cardsContainer">${cardsHtml}</main>
          <div id="noSearchResults" class="empty-state" style="display: none;">No matching briefs found.</div>

          <script>
            const themeBtn = document.getElementById('themeToggleBtn');
            const isDark = localStorage.getItem('theme') === 'dark';
            themeBtn.innerText = isDark ? 'Light' : 'Dark';

            themeBtn.onclick = () => {
              const currentlyDark = document.documentElement.getAttribute('data-theme') === 'dark';
              if (currentlyDark) {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                themeBtn.innerText = 'Dark';
              } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                themeBtn.innerText = 'Light';
              }
            };

            function enableCardEdit(id) {
              document.getElementById('tag-display-' + id).style.display = 'none';
              document.getElementById('tag-edit-' + id).style.display = 'inline-block';
              document.getElementById('title-display-' + id).style.display = 'none';
              document.getElementById('title-edit-' + id).style.display = 'block';
              document.getElementById('note-display-' + id).style.display = 'none';
              document.getElementById('note-edit-' + id).style.display = 'block';
              document.getElementById('edit-actions-' + id).style.display = 'flex';
              document.getElementById('btn-edit-' + id).style.display = 'none';
            }

            function cancelCardEdit(id) {
              document.getElementById('tag-display-' + id).style.display = 'inline-block';
              document.getElementById('tag-edit-' + id).style.display = 'none';
              document.getElementById('title-display-' + id).style.display = 'block';
              document.getElementById('title-edit-' + id).style.display = 'none';
              
              const noteText = document.getElementById('note-edit-' + id).value.trim();
              if (noteText) {
                document.getElementById('note-display-' + id).innerText = 'Note: ' + noteText;
                document.getElementById('note-display-' + id).style.display = 'block';
              } else {
                document.getElementById('note-display-' + id).style.display = 'none';
              }
              document.getElementById('note-edit-' + id).style.display = 'none';
              document.getElementById('edit-actions-' + id).style.display = 'none';
              document.getElementById('btn-edit-' + id).style.display = 'inline-block';
            }

            async function saveCardEdit(id) {
              const customTitle = document.getElementById('tag-edit-' + id).value.trim();
              const title = document.getElementById('title-edit-' + id).value.trim();
              const comment = document.getElementById('note-edit-' + id).value.trim();

              try {
                const res = await fetch('/api/summary/update', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ${token}'
                  },
                  body: JSON.stringify({ id, title, customTitle, comment })
                });
                const data = await res.json();
                if (data.success) {
                  document.getElementById('tag-display-' + id).innerText = customTitle || 'Web Capture';
                  document.getElementById('title-display-' + id).innerText = title || 'Untitled';
                  cancelCardEdit(id);
                } else {
                  alert('Failed to save changes: ' + (data.error || 'Unknown error'));
                }
              } catch (e) {
                alert('Error saving changes: ' + e.message);
              }
            }

            function initExpandButtons() {
              document.querySelectorAll('.card-body-wrapper').forEach(wrapper => {
                const body = wrapper.querySelector('.card-body');
                const btn = wrapper.querySelector('.btn-expand');
                if (body && btn && body.scrollHeight > body.clientHeight) {
                  btn.style.display = 'inline-block';
                }
              });
            }

            function toggleExpand(btn) {
              const body = btn.previousElementSibling;
              if (body.classList.contains('clamped')) {
                body.classList.remove('clamped');
                btn.innerText = 'Show Less';
              } else {
                body.classList.add('clamped');
                btn.innerText = 'Show More';
              }
            }

            window.addEventListener('DOMContentLoaded', initExpandButtons);

            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
              searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase().trim();
                const cards = document.querySelectorAll('.card');
                let visibleCount = 0;

                cards.forEach(card => {
                  const content = card.innerText.toLowerCase();
                  if (content.includes(query)) {
                    card.style.display = 'block';
                    visibleCount++;
                  } else {
                    card.style.display = 'none';
                  }
                });

                const noResults = document.getElementById('noSearchResults');
                if (noResults) {
                  noResults.style.display = (visibleCount === 0 && cards.length > 0) ? 'block' : 'none';
                }
              });
            }

            const profBtn = document.getElementById('profBtn');
            const profMenu = document.getElementById('profMenu');

            profBtn.onclick = (e) => {
              e.stopPropagation();
              profMenu.classList.toggle('show');
            };
            document.onclick = () => profMenu.classList.remove('show');

            document.getElementById('logoutBtn').onclick = () => {
              localStorage.removeItem('sessionToken');
              window.postMessage({ source: 'BRIEF_DASHBOARD', status: 'logged_out' }, window.location.origin);
              setTimeout(() => {
                window.location.href = '/dashboard?action=logout';
              }, 100);
            };

            document.getElementById('deleteBtn').onclick = async () => {
              if (!confirm("Permanently delete account and all saved summaries?")) return;
              try {
                const res = await fetch('/api/account/delete', {
                  method: 'DELETE',
                  headers: { 'Authorization': 'Bearer ${token}' }
                });
                const data = await res.json();
                if (data.success) {
                  localStorage.removeItem('sessionToken');
                  window.postMessage({ source: 'BRIEF_DASHBOARD', status: 'logged_out' }, window.location.origin);
                  setTimeout(() => {
                    window.location.href = '/dashboard?action=logout';
                  }, 100);
                } else {
                  alert('Deletion failed: ' + (data.error || 'Unknown error'));
                }
              } catch (e) {
                alert('Error: ' + e.message);
              }
            };

            async function deleteSummary(id) {
              if (!confirm("Delete this summary?")) return;
              try {
                const res = await fetch('/api/summary/delete?id=' + id, {
                  method: 'DELETE',
                  headers: { 'Authorization': 'Bearer ${token}' }
                });
                const data = await res.json();
                if (data.success) {
                  const card = document.getElementById('card-' + id);
                  if (card) card.remove();
                } else {
                  alert('Delete failed: ' + (data.error || 'Unknown error'));
                }
              } catch (e) {
                alert('Error: ' + e.message);
              }
            }
          </script>
        </body>
        </html>
      `;

      return new Response(html, { headers: htmlHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    const user = await getUserBySessionToken(authHeader, env);

    if (!user && url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Unauthorized. Session expired." }), { status: 401, headers: corsHeaders });
    }

    const trialInfo = calculateTrial(user.created_at, user.subscription_status);

    if (url.pathname === "/api/summary/update" && req.method === "POST") {
      try {
        const { id, title, customTitle, comment } = await req.json();
        if (!id) return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400, headers: corsHeaders });

        await env.DB.prepare(
          "UPDATE summaries SET title = ?, custom_title = ?, comment = ? WHERE id = ? AND user_id = ?"
        ).bind(title || "Untitled", customTitle || "", comment || "", id, user.id).run();

        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Update Error: " + err.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/api/summary/delete" && req.method === "DELETE") {
      try {
        const id = url.searchParams.get("id");
        if (!id) return new Response(JSON.stringify({ error: "Missing summary ID" }), { status: 400, headers: corsHeaders });

        const row = await env.DB.prepare("SELECT snapshot_key FROM summaries WHERE id = ? AND user_id = ?").bind(id, user.id).first();
        if (row && row.snapshot_key) {
          await env.SNAPSHOTS.delete(row.snapshot_key);
        }

        await env.DB.prepare("DELETE FROM summaries WHERE id = ? AND user_id = ?").bind(id, user.id).run();

        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Delete Error: " + err.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/api/extension-capture" && req.method === "POST") {
      if (!trialInfo.allowed) {
        return new Response(JSON.stringify({
          error: "Your 14-day free trial has expired. Please upgrade to Brief Pro to generate new summaries.",
          trialExpired: true
        }), { status: 402, headers: corsHeaders });
      }

      try {
        const { pageText } = await req.json();
        if (!pageText) return new Response(JSON.stringify({ error: "No text provided" }), { status: 400, headers: corsHeaders });

        const modelsToTry = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"];
        let summary = null;
        let lastError = null;

        for (const model of modelsToTry) {
          try {
            const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                model: model,
                messages: [
                  {
                    role: "system",
                    content: "You are an expert analyst. Provide a high-quality executive summary of the provided text in its native language. Structure clearly into:\n\nCore Takeaway\nKey Points (bullet points)\nStrategic Context"
                  },
                  { role: "user", content: pageText.slice(0, 6000) }
                ]
              })
            });

            const groqData = await groqRes.json();
            if (groqData.choices?.[0]?.message?.content) {
              summary = groqData.choices[0].message.content;
              break;
            } else if (groqData.error) {
              lastError = groqData.error.message;
            }
          } catch (e) {
            lastError = e.message;
          }
        }

        if (!summary) {
          return new Response(JSON.stringify({ error: "Groq Error: " + (lastError || "No accessible models found.") }), { status: 500, headers: corsHeaders });
        }

        return new Response(JSON.stringify({ summary }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      } catch (err) {
        return new Response(JSON.stringify({ error: "AI Error: " + err.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/api/save-dashboard" && req.method === "POST") {
      if (!trialInfo.allowed) {
        return new Response(JSON.stringify({
          error: "Your 14-day free trial has expired. Please upgrade to Brief Pro to save summaries.",
          trialExpired: true
        }), { status: 402, headers: corsHeaders });
      }

      const body = await req.json().catch(() => ({}));
      const { title, customTitle, comment, url: articleUrl, summary, pageText } = body;

      const snapshotKey = `snapshots/${user.id}/snapshot-${Date.now()}.txt`;
      await env.SNAPSHOTS.put(snapshotKey, pageText || "");

      await env.DB.prepare(
        "INSERT INTO summaries (user_id, title, custom_title, comment, url, summary, snapshot_key) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(user.id, title, customTitle || "", comment || "", articleUrl, summary, snapshotKey).run();

      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    if (url.pathname === "/api/account/delete" && req.method === "DELETE") {
      const { results } = await env.DB.prepare("SELECT snapshot_key FROM summaries WHERE user_id = ?").bind(user.id).all();
      for (const row of results) {
        if (row.snapshot_key) await env.SNAPSHOTS.delete(row.snapshot_key);
      }
      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id).run();
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    return new Response(JSON.stringify({ error: "Endpoint Not Found" }), { status: 404, headers: corsHeaders });
  }
};
