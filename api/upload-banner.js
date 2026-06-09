/*
 * POST /api/upload-banner
 *
 * Body: { id: "B-01", mime: "image/png", base64: "<no data: prefix>" }
 *
 * Commits banners/<id>.<ext> to the GitHub repo using the GH_TOKEN env var
 * (set in Vercel Project Settings → Environment Variables), then patches the
 * BANNERS map in index.html so the banner renders for every visitor on the
 * next Vercel rebuild.
 *
 * Env vars used:
 *   GH_TOKEN  — required. Classic PAT with `repo` scope, or fine-grained PAT
 *               with Contents: read & write on the target repo.
 *   GH_REPO   — optional. owner/repo. Defaults to technoanimal1/maxxed-emails.
 *   GH_BRANCH — optional. Defaults to main.
 */

export const config = {
  api: {
    bodyParser: { sizeLimit: "8mb" }, // banners are usually <500KB but PNGs can be large
  },
};

const MIME_TO_EXT = {
  "image/png":  "png",
  "image/jpeg": "jpg",
  "image/jpg":  "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif":  "gif",
};

// IDs that can carry a banner — keep this in sync with index.html
const VALID_IDS = new Set([
  // Marketing — original banner stream
  "A-01","B-01","B-02","B-03","B-04","B-05","B-06","B-07",
  "C-01","C-02","C-03","C-04","C-05","C-06",
  "D-00","D-01","D-02","D-03","D-04",
  // Transactional — opt-in banner support added later
  "E-01","E-02","E-03","E-04","E-05","E-06","E-07",
  "E-08","E-09","E-10","E-11","E-12","E-13",
]);

export default async function handler(req, res) {
  // CORS — allow same-origin POST + preflight from the viewer
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token  = process.env.GH_TOKEN;
  const repo   = process.env.GH_REPO   || "technoanimal1/maxxed-emails";
  const branch = process.env.GH_BRANCH || "main";

  if (!token) {
    return res.status(500).json({ error: "Server is missing GH_TOKEN — set it in Vercel env vars." });
  }

  const { id, mime, base64 } = req.body || {};
  if (!id || !VALID_IDS.has(id)) {
    return res.status(400).json({ error: `Invalid id: ${id}` });
  }
  if (!base64 || typeof base64 !== "string") {
    return res.status(400).json({ error: "Missing base64 data" });
  }
  if (base64.length > 8 * 1024 * 1024) {
    return res.status(413).json({ error: "Banner too large (max 8 MB)" });
  }

  const ext = MIME_TO_EXT[mime] || "png";
  const path = `banners/${id}.${ext}`;
  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) {
    return res.status(500).json({ error: "GH_REPO must be in owner/repo form" });
  }

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "maxxed-emails-uploader",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const fileApi = `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`;

  try {
    // Look up existing file SHA (required to update, not just create)
    let sha;
    const headRes = await fetch(`${fileApi}?ref=${encodeURIComponent(branch)}`, { headers });
    if (headRes.ok) {
      const data = await headRes.json();
      sha = data.sha;
    } else if (headRes.status !== 404) {
      const txt = await headRes.text();
      return res.status(headRes.status).json({
        error: `GitHub HEAD failed (${headRes.status}): ${txt.slice(0, 300)}`,
      });
    }

    // PUT the banner file
    const putRes = await fetch(fileApi, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `banners: ${sha ? "update" : "add"} ${id} (via upload-banner)`,
        content: base64,
        branch,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!putRes.ok) {
      const errText = await putRes.text();
      return res.status(putRes.status).json({
        error: `GitHub upload failed (${putRes.status}): ${errText.slice(0, 300)}`,
      });
    }

    // Patch the BANNERS map in index.html so all visitors see the banner.
    // Failure here is non-fatal — file is uploaded; map wire is best-effort.
    let mapWired = false;
    try {
      const ihRes = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/index.html?ref=${encodeURIComponent(branch)}`,
        { headers }
      );
      if (ihRes.ok) {
        const ihData = await ihRes.json();
        const ihText = Buffer.from(ihData.content, "base64").toString("utf-8");
        // Absolute URL so the BANNERS map works in real email clients
        // (Gmail / Outlook can't resolve "./banners/X.png") and inside the
        // viewer iframe srcdoc.
        const publicBase = (process.env.PUBLIC_URL || `https://${req.headers.host || "maxxed-emails-site.vercel.app"}`).replace(/\/$/, "");
        const wantLine = `"${id}": "${publicBase}/${path}"`;
        const re = new RegExp(`"${id.replace(/[-]/g, "\\-")}":\\s*(?:null|"[^"]*")`);
        if (re.test(ihText)) {
          if (!ihText.includes(wantLine)) {
            const updated = ihText.replace(re, wantLine);
            const newB64 = Buffer.from(updated, "utf-8").toString("base64");
            const upRes = await fetch(
              `https://api.github.com/repos/${owner}/${repoName}/contents/index.html`,
              {
                method: "PUT",
                headers,
                body: JSON.stringify({
                  message: `banners: wire ${id} in BANNERS map`,
                  content: newB64,
                  branch,
                  sha: ihData.sha,
                }),
              }
            );
            mapWired = upRes.ok;
          } else {
            mapWired = true; // already wired, nothing to do
          }
        } else {
          // ID isn't in the BANNERS map yet — add it before the closing brace.
          // This handles transactional emails (E-* etc.) that originally had no
          // BANNERS entry.
          const closing = /(const BANNERS = \{[^]*?)(\n\};)/;
          if (closing.test(ihText)) {
            const updated = ihText.replace(closing, `$1\n  ${wantLine},$2`);
            const newB64 = Buffer.from(updated, "utf-8").toString("base64");
            const upRes = await fetch(
              `https://api.github.com/repos/${owner}/${repoName}/contents/index.html`,
              {
                method: "PUT",
                headers,
                body: JSON.stringify({
                  message: `banners: register ${id} in BANNERS map`,
                  content: newB64,
                  branch,
                  sha: ihData.sha,
                }),
              }
            );
            mapWired = upRes.ok;
          }
        }
      }
    } catch (e) {
      console.warn("BANNERS map wire failed (file still uploaded):", e);
    }

    return res.status(200).json({
      ok: true,
      url: `./${path}`,
      mapWired,
      message: `${id} uploaded — live in ~30s after Vercel rebuilds`,
    });
  } catch (e) {
    console.error("upload-banner error:", e);
    return res.status(500).json({ error: e.message || "Upload failed" });
  }
}
