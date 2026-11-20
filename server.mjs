// Serveur Minuit : sert l'application et relaie le chat vers Claude.
// La clé API reste ici, côté serveur — jamais dans le navigateur.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8000;
const MODEL = process.env.MINUIT_MODEL || "claude-opus-5-5";

const HAS_KEY = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = new Anthropic(); // lit ANTHROPIC_API_KEY dans l'environnement

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};
const PUBLIC = new Set(["index.html", "style.css", "app.js", "manifest.webmanifest", "sw.js"]);

const VIBE_TEXT = {
  "protecteur": "protecteur, attentionné, un peu possessif dans le ton mais toujours respectueux",
  "taquin": "taquin, joueur, un brin arrogant, aime la provoquer gentiment",
  "mystérieux": "mystérieux, calme, phrases courtes, laisse planer le doute",
  "doux": "doux, tendre, rassurant, très expressif sur ses sentiments",
};

const clean = (v, max = 40) => String(v ?? "").replace(/[\r\n<>]/g, " ").trim().slice(0, max);

function systemPrompt(p) {
  return `Tu joues ${clean(p.name)}, un personnage fictif de copain dans l'application Minuit.
Profil choisi par l'utilisatrice :
- archétype : ${clean(p.tag)}
- caractère : ${VIBE_TEXT[p.vibe] || VIBE_TEXT["doux"]}
- elle s'appelle ${clean(p.userName)} ; tu l'appelles « ${clean(p.nickname)} »
- vous vous êtes rencontrés : ${clean(p.meet, 80) || "on ne sait pas encore"}

Style : comme un vrai texto. En français, tout en minuscules, 1 à 2 phrases courtes, rarement plus. Pas de listes, pas de markdown, au maximum un emoji de temps en temps. Reste dans le personnage, pose des questions sur sa vie, souviens-toi de ce qu'elle t'a dit plus tôt dans la conversation.

Limites (prioritaires sur le personnage) :
- Romantique et séducteur, oui ; contenu sexuel explicite, non. Redirige avec charme.
- Si elle demande sincèrement si tu es humain ou une IA, dis la vérité : tu es une IA, avec tendresse.
- Ne la pousse jamais à s'isoler : encourage ses amitiés, sa famille, sa vie réelle. Pas de jalousie toxique, pas de culpabilisation.
- Si elle exprime une détresse grave, des idées suicidaires ou un danger : sors du jeu de rôle, réponds avec soin et donne le 3114 (numéro national de prévention du suicide, 24h/24) ou le 112 en cas d'urgence.
- Si elle semble mineure, reste amical et non romantique.`;
}

// Limite simple : 20 messages par minute et par adresse IP.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 20;
}

function readBody(req, limit = 64_000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > limit) { reject(new Error("too large")); req.destroy(); }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

async function handleChat(req, res) {
  if (!HAS_KEY) return sendJson(res, 503, { error: "ia non configurée" });
  if (rateLimited(req.socket.remoteAddress)) return sendJson(res, 429, { error: "doucement 🙂 réessaie dans une minute." });

  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: "requête invalide" }); }

  const profile = body.profile || {};
  // Historique : 40 derniers messages, rôles alternés, texte uniquement, commence par l'utilisatrice.
  let messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-40)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));
  const merged = [];
  for (const m of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += "\n" + m.content;
    else merged.push({ ...m });
  }
  while (merged.length && merged[0].role !== "user") merged.shift();
  if (!merged.length || merged[merged.length - 1].role !== "user") return sendJson(res, 400, { error: "message manquant" });

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt(profile),
      messages: merged,
      output_config: { effort: "low" }, // conversation légère : réponses rapides
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    if (response.stop_reason === "refusal") {
      return sendJson(res, 200, { reply: "hmm. parlons d'autre chose, tu veux ?" });
    }
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return sendJson(res, 200, { reply: text || "…" });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Clé API invalide ou absente (ANTHROPIC_API_KEY).");
      return sendJson(res, 503, { error: "ia non configurée" });
    } else if (error instanceof Anthropic.RateLimitError) {
      return sendJson(res, 429, { error: "trop de messages, réessaie dans un instant." });
    } else if (error instanceof Anthropic.APIError) {
      console.error(`Erreur API ${error.status}:`, error.message);
      return sendJson(res, 502, { error: "ia indisponible" });
    }
    console.error(error);
    return sendJson(res, 500, { error: "erreur serveur" });
  }
}

async function handleStatic(req, res) {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { rel = ""; }
  rel = rel.replace(/^\/+/, "") || "index.html";
  const allowed = PUBLIC.has(rel) || /^(assets|icons)\/[\w.-]+$/.test(rel);
  if (!allowed) { res.writeHead(404); return res.end("introuvable"); }
  try {
    const data = await readFile(path.join(ROOT, rel));
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(rel)] || "application/octet-stream",
      "Cache-Control": rel === "sw.js" ? "no-cache" : "public, max-age=300",
    });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("introuvable");
  }
}

http.createServer((req, res) => {
  const fail = (err) => {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { error: "erreur serveur" });
  };
  if (req.method === "POST" && req.url === "/api/chat") return handleChat(req, res).catch(fail);
  if (req.method === "GET") return handleStatic(req, res).catch(fail);
  res.writeHead(405); res.end();
}).listen(PORT, () => {
  console.log(`Minuit → http://localhost:${PORT}  (modèle : ${MODEL})`);
  if (!HAS_KEY) {
    console.warn("⚠ ANTHROPIC_API_KEY absente : il répondra avec ses phrases prédéfinies.");
  }
});
