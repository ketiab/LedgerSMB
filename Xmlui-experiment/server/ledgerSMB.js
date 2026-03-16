/**
 * LedgerSMB Proxy Server
 *
 * Sits between XMLUI (which can't send cookies cross-origin) and LedgerSMB.
 * Handles login, maintains the LedgerSMB session cookie server-side, and
 * forwards API requests transparently.
 *
 * Usage:
 *   npm install
 *   node server.js
 *
 * Then in XMLUI, point DataSource at this proxy instead of LedgerSMB directly:
 *   url="http://localhost:3000/erp/api/v0/menu-nodes"
 */

import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();

// ── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  // LedgerSMB server to proxy to
 ledgersmb: {
  target: process.env.LEDGERSMB_URL || "http://localhost",
  loginPath: "/login.pl",
  username: "admin",
  password: "admin",
  company: "testco",
},
  // This proxy server
  proxy: {
    port: process.env.PORT || 3000,
    // Origins allowed to call this proxy (your XMLUI dev server)
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:8080",
  },
};

// ── State ────────────────────────────────────────────────────────────────────
// Stores the LedgerSMB session cookie after login
let lsmb_session_cookie = null;
let login_in_progress = false;

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: CONFIG.proxy.corsOrigin,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());

// ── Login helper ─────────────────────────────────────────────────────────────
async function loginToLedgerSMB() {
  if (login_in_progress) {
    // Wait briefly and return existing cookie if a login is already running
    await new Promise((r) => setTimeout(r, 500));
    return lsmb_session_cookie;
  }

  login_in_progress = true;
  console.log("[proxy] Logging in to LedgerSMB...");

  try {
    const loginUrl = `${CONFIG.ledgersmb.target}${CONFIG.ledgersmb.loginPath}`;

    const body = new URLSearchParams({
      login: CONFIG.ledgersmb.username,
      password: CONFIG.ledgersmb.password,
      company: CONFIG.ledgersmb.company,
      action: "login",
    });

    const res = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      redirect: "manual", // LedgerSMB redirects on success; grab cookie before following
    });

    // Collect Set-Cookie headers
    const setCookie = res.headers.getSetCookie?.() ?? [];
    const sessionCookies = setCookie.filter(
      (c) => c.startsWith("LedgerSMB") || c.startsWith("CGISESSID") || c.startsWith("lsmb")
    );

    if (sessionCookies.length === 0) {
      // Some versions set the cookie after the redirect — try following it
      const allCookies = setCookie.join("; ");
      if (allCookies) {
        lsmb_session_cookie = allCookies.split(",").map((c) => c.split(";")[0].trim()).join("; ");
      } else {
        console.warn("[proxy] Login may have failed — no session cookie found in response.");
        console.warn("[proxy] Status:", res.status, "Location:", res.headers.get("location"));
      }
    } else {
      // Extract just the name=value part of each cookie
      lsmb_session_cookie = sessionCookies
        .map((c) => c.split(";")[0].trim())
        .join("; ");
    }

    console.log("[proxy] Session cookie acquired:", lsmb_session_cookie ? "yes" : "no");
    return lsmb_session_cookie;
  } catch (err) {
    console.error("[proxy] Login failed:", err.message);
    lsmb_session_cookie = null;
    return null;
  } finally {
    login_in_progress = false;
  }
}

// ── Auto-login on startup ────────────────────────────────────────────────────
loginToLedgerSMB();

// ── Health / status endpoint ─────────────────────────────────────────────────
app.get("/__proxy/status", (_req, res) => {
  res.json({
    status: "ok",
    session: lsmb_session_cookie ? "active" : "none",
    target: CONFIG.ledgersmb.target,
  });
});

// ── Manual re-login endpoint ─────────────────────────────────────────────────
app.post("/__proxy/login", async (_req, res) => {
  lsmb_session_cookie = null;
  const cookie = await loginToLedgerSMB();
  res.json({ success: !!cookie });
});

// ── Proxy middleware ─────────────────────────────────────────────────────────
app.use(
  "/erp",
  async (req, _res, next) => {
    // Ensure we have a session before forwarding
    if (!lsmb_session_cookie) {
      await loginToLedgerSMB();
    }
    next();
  },
  createProxyMiddleware({
    target: CONFIG.ledgersmb.target,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req) => {
        // Inject the LedgerSMB session cookie into every forwarded request
        if (lsmb_session_cookie) {
          const existing = req.headers["cookie"] || "";
          const merged = existing
            ? `${existing}; ${lsmb_session_cookie}`
            : lsmb_session_cookie;
          proxyReq.setHeader("Cookie", merged);
        }

        // Forward Accept header from XMLUI
        if (req.headers["accept"]) {
          proxyReq.setHeader("Accept", req.headers["accept"]);
        }

        console.log(`[proxy] → ${req.method} ${req.path}`);
      },

      proxyRes: async (proxyRes, req, res) => {
        console.log(`[proxy] ← ${proxyRes.statusCode} ${req.path}`);

        // If LedgerSMB returns 401/403, re-login and let the client retry
        if (proxyRes.statusCode === 401 || proxyRes.statusCode === 403) {
          console.warn("[proxy] Session expired — re-logging in...");
          lsmb_session_cookie = null;
          loginToLedgerSMB(); // async, next request will pick up new cookie
        }
      },

      error: (err, _req, res) => {
        console.error("[proxy] Proxy error:", err.message);
        res.status(502).json({ error: "Proxy error", detail: err.message });
      },
    },
  })
);

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(CONFIG.proxy.port, () => {
  console.log(`\n✅ LedgerSMB proxy running on http://localhost:${CONFIG.proxy.port}`);
  console.log(`   Forwarding /erp/* → ${CONFIG.ledgersmb.target}/erp/*`);
  console.log(`   CORS allowed from: ${CONFIG.proxy.corsOrigin}`);
  console.log(`   Status: http://localhost:${CONFIG.proxy.port}/__proxy/status\n`);
});