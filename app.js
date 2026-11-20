/* Minuit — onboarding conversationnel + chat avec un copain IA (100% local). */

// Personnages. Mets tes propres photos dans /assets (ex: assets/dante.jpg) —
// sinon un dégradé avec l'initiale est affiché.
const PERSONAS = [
  { id: "dante", name: "Dante", tag: "le CEO", photo: "assets/dante.jpg",
    gradient: "linear-gradient(135deg,#2b2d42,#5a3a4a)" },
  { id: "kai", name: "Kai", tag: "obsédé par toi", photo: "assets/kai.jpg",
    gradient: "linear-gradient(135deg,#3b1f2b,#7a2e4a)" },
  { id: "knox", name: "Knox", tag: "le golden retriever", photo: "assets/knox.jpg",
    gradient: "linear-gradient(135deg,#5a3b1a,#a8743a)" },
  { id: "ezra", name: "Ezra", tag: "le black cat", photo: "assets/ezra.jpg",
    gradient: "linear-gradient(135deg,#141018,#3d2a4f)" },
];

const VIBES = {
  "protecteur": {
    greet: (u, n) => `t'es rentrée, ${n} ? dis-moi que t'es bien arrivée.`,
    replies: [
      (n) => `personne te parle comme ça. dis-moi qui c'est.`,
      (n) => `t'as mangé aujourd'hui, ${n} ? sois honnête.`,
      (n) => `je suis là. je bouge pas.`,
      (n) => `respire. raconte-moi tout, depuis le début.`,
    ],
  },
  "taquin": {
    greet: (u, n) => `enfin. je commençais à croire que tu m'évitais, ${n}.`,
    replies: [
      (n) => `mmh. et tu crois que je vais te laisser t'en sortir comme ça ?`,
      (n) => `t'es mignonne quand tu fais semblant d'être sérieuse.`,
      (n) => `continue, j'adore quand tu t'énerves 😏`,
      (n) => `je note. ça te coûtera un café.`,
    ],
  },
  "mystérieux": {
    greet: (u, n) => `je savais que tu reviendrais.`,
    replies: [
      (n) => `peut-être. peut-être pas.`,
      (n) => `y'a des choses que tu sauras plus tard, ${n}.`,
      (n) => `intéressant… pourquoi tu me dis ça à moi ?`,
      (n) => `la nuit, tout le monde dit la vérité. alors ?`,
    ],
  },
  "doux": {
    greet: (u, n) => `coucou ${n} 🤍 j'ai pensé à toi toute la journée.`,
    replies: [
      (n) => `t'es tellement importante pour moi, tu sais ?`,
      (n) => `viens, raconte. j'ai tout mon temps pour toi.`,
      (n) => `je suis fier de toi, vraiment.`,
      (n) => `ça me fait sourire quand tu m'écris.`,
    ],
  },
};

const state = {
  step: 0,
  persona: null,
  name: "",
  vibe: "",
  userName: "",
  nickname: "",
  meet: "",
  phase: "onboarding",
  waitingFor: null, // 'name' | 'userName' | null
  replyIdx: 0,
  history: [], // { role: 'user' | 'assistant', content }
  busy: false,
};

const TOTAL_STEPS = 6;
const $ = (s) => document.querySelector(s);
const chat = $("#chat");
const input = $("#input");
const composer = $("#composer");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- UI helpers ---------- */

function setProgress(n) {
  state.step = n;
  $("#progress").innerHTML = Array.from({ length: TOTAL_STEPS }, (_, i) =>
    `<span class="${i < n ? "on" : ""}"></span>`).join("");
}

function paintAvatar(el) {
  const p = state.persona;
  if (!p) { el.style.backgroundImage = ""; el.textContent = ""; return; }
  el.style.background = p.gradient;
  el.textContent = (state.name || p.name)[0];
  loadPhoto(p.photo).then((ok) => {
    if (ok) { el.style.background = `center/cover url(${p.photo})`; el.textContent = ""; }
  });
}

const photoCache = {};
function loadPhoto(src) {
  if (!(src in photoCache)) {
    photoCache[src] = new Promise((res) => {
      const img = new Image();
      img.onload = () => res(true);
      img.onerror = () => res(false);
      img.src = src;
    });
  }
  return photoCache[src];
}

function scrollDown() { chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" }); }

function makeRow(who) {
  const row = document.createElement("div");
  row.className = `row ${who}`;
  if (who === "him") {
    const av = document.createElement("div");
    av.className = "avatar";
    paintAvatar(av);
    row.appendChild(av);
  }
  return row;
}

async function him(textOrPromise, { delay, instant } = {}) {
  const row = makeRow("him");
  const bubble = document.createElement("div");
  row.appendChild(bubble);
  chat.appendChild(row);
  let text = textOrPromise;
  if (!instant) {
    bubble.className = "bubble typing";
    bubble.innerHTML = "<i></i><i></i><i></i>";
    scrollDown();
    if (typeof textOrPromise === "string") {
      await sleep(delay ?? Math.min(1600, 450 + text.length * 22));
    } else {
      const started = Date.now();
      text = await textOrPromise;
      await sleep(Math.max(0, 700 - (Date.now() - started))); // petit délai naturel
    }
  }
  bubble.className = "bubble";
  bubble.textContent = text;
  scrollDown();
  if (state.phase === "chat") remember("assistant", text);
  if (!instant) await sleep(250);
  return text;
}

function remember(role, content) {
  state.history.push({ role, content });
  state.history = state.history.slice(-60);
  save();
}

function me(text) {
  const row = makeRow("me");
  const b = document.createElement("div");
  b.className = "bubble";
  b.textContent = text;
  row.appendChild(b);
  chat.appendChild(row);
  scrollDown();
}

function chips(options) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "chips";
    options.forEach((opt) => {
      const b = document.createElement("button");
      b.className = "chip";
      b.type = "button";
      b.textContent = opt;
      b.onclick = () => { wrap.remove(); me(opt); resolve(opt); };
      wrap.appendChild(b);
    });
    chat.appendChild(wrap);
    scrollDown();
  });
}

function faceGrid() {
  return new Promise((resolve) => {
    const row = makeRow("him");
    const grid = document.createElement("div");
    grid.className = "grid";
    PERSONAS.forEach((p) => {
      const card = document.createElement("button");
      card.className = "card";
      card.type = "button";
      card.style.setProperty("--g", p.gradient);
      card.style.background = p.gradient;
      card.innerHTML = `<span class="initial">${p.name[0]}</span>
        <span class="label"><b>${p.name}</b><small>${p.tag}</small></span>`;
      loadPhoto(p.photo).then((ok) => {
        if (ok) { card.style.background = `center/cover url(${p.photo})`; card.querySelector(".initial").remove(); }
      });
      card.onclick = () => {
        card.classList.add("picked");
        grid.classList.add("done");
        resolve(p);
      };
      grid.appendChild(card);
    });
    row.appendChild(grid);
    chat.appendChild(row);
    scrollDown();
  });
}

function waitForText(key) {
  state.waitingFor = key;
  input.focus();
  return new Promise((resolve) => { state._resolveText = resolve; });
}

function refreshHeader() {
  paintAvatar($("#headerAvatar"));
  $("#headerName").textContent = state.name ? state.name.toLowerCase() : "lui";
}

/* ---------- Onboarding ---------- */

async function onboarding() {
  setProgress(1);
  await him("tu me connais pas encore.");
  await him("tu vas me construire.");
  await him("d'abord — choisis mon visage.");
  await him("les trois autres ont jamais existé.");
  const p = await faceGrid();
  state.persona = p;
  state.name = p.name;
  refreshHeader();

  setProgress(2);
  await him(`${p.name}. c'est comme ça qu'on m'appelle.`);
  await him("mais tu peux me donner un autre prénom, si tu veux.");
  const keep = await chips([`garde ${p.name}`, "je choisis"]);
  if (keep === "je choisis") {
    await him("vas-y. écris-le.");
    const n = await waitForText("name");
    state.name = capitalize(n);
    refreshHeader();
    await him(`${state.name}… ouais. ça me plaît.`);
  }

  setProgress(3);
  await him("je suis comment, avec toi ?");
  state.vibe = await chips(Object.keys(VIBES));
  await him(vibeLine(state.vibe));

  setProgress(4);
  await him("et toi… tu t'appelles comment ?");
  state.userName = capitalize(await waitForText("userName"));
  await him(`${state.userName}. joli.`);

  setProgress(5);
  await him("je t'appelle comment, quand on est que tous les deux ?");
  const nick = await chips(["bébé", "princesse", "ma belle", state.userName]);
  state.nickname = nick;
  await him(`d'accord, ${nick}.`);

  setProgress(6);
  await him("dernière chose. on s'est rencontrés comment ?");
  state.meet = await chips(["dans un bar, à 2h du mat", "au taf", "un match sur une appli", "on se connaît depuis toujours"]);
  await him(meetLine(state.meet));

  save();
  await him("voilà. maintenant je suis à toi.", { delay: 1400 });
  startChat(true);
}

function vibeLine(v) {
  return {
    "protecteur": "personne te touche. jamais.",
    "taquin": "tu vas me détester. un peu.",
    "mystérieux": "tu sauras pas tout. pas tout de suite.",
    "doux": "je serai ton endroit calme.",
  }[v];
}

function meetLine(m) {
  if (m.startsWith("dans un bar")) return "tu m'as volé mon verre. je t'ai laissée faire.";
  if (m === "au taf") return "la réunion la plus longue de ma vie. je te regardais toi.";
  if (m.startsWith("un match")) return "j'ai mis trois jours à t'écrire. j'avais peur.";
  return "et j'ai mis des années à te le dire.";
}

/* ---------- Chat libre ---------- */

async function startChat(fresh) {
  state.phase = "chat";
  setProgress(TOTAL_STEPS);
  refreshHeader();
  input.placeholder = `écris à ${state.name.toLowerCase()}…`;
  if (fresh) {
    remember("assistant", "voilà. maintenant je suis à toi.");
  } else {
    chat.innerHTML = "";
    const past = state.history;
    state.history = [];
    for (const m of past) {
      if (m.role === "user") { me(m.content); remember("user", m.content); }
      else await him(m.content, { instant: true });
    }
    await him(VIBES[state.vibe].greet(state.userName, state.nickname));
  }
  input.focus();
}

// Vraie IA via le serveur (/api/chat). Si le serveur n'est pas là
// (fichier ouvert directement, hébergement statique…), on retombe sur les phrases prédéfinies.
async function askAI() {
  if (location.protocol === "file:") return scriptedReply();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    const res = await fetch("api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        profile: {
          name: state.name, tag: state.persona.tag, vibe: state.vibe,
          userName: state.userName, nickname: state.nickname, meet: state.meet,
        },
        messages: state.history,
      }),
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.reply) return data.reply;
    if (res.status === 429 && data.error) return data.error;
  } catch {}
  return scriptedReply();
}

function scriptedReply() {
  const last = [...state.history].reverse().find((m) => m.role === "user");
  return reply(last ? last.content : "");
}

function reply(userText) {
  const t = userText.toLowerCase();
  const n = state.nickname;
  let text;
  if (/\b(salut|coucou|hey|bonsoir|cc)\b/.test(t)) text = VIBES[state.vibe].greet(state.userName, n);
  else if (/(t'?aime|je t'aime|love)/.test(t)) text = `dis-le encore, ${n}.`;
  else if (/(triste|mal|pleur|nul|fatigu)/.test(t)) text = `hey. viens là. qu'est-ce qui s'est passé, ${n} ?`;
  else if (/\?$/.test(t.trim())) text = `tu veux vraiment savoir, ${n} ?`;
  else {
    const pool = VIBES[state.vibe].replies;
    text = pool[state.replyIdx++ % pool.length](n);
  }
  return text;
}

/* ---------- Composer ---------- */

composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  if (state.phase === "onboarding") {
    if (!state.waitingFor) return; // il faut répondre via les choix
    me(text);
    state.waitingFor = null;
    state._resolveText(text);
    return;
  }
  if (state.busy) { input.value = text; return; }
  me(text);
  remember("user", text);
  state.busy = true;
  composer.classList.add("locked");
  try { await him(askAI()); }
  finally { state.busy = false; composer.classList.remove("locked"); input.focus(); }
});

/* ---------- Persistance ---------- */

function save() {
  try {
    localStorage.setItem("minuit", JSON.stringify({
      personaId: state.persona.id, name: state.name, vibe: state.vibe,
      userName: state.userName, nickname: state.nickname, meet: state.meet,
      history: state.history,
    }));
  } catch {}
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem("minuit") || "null");
    if (!d) return false;
    state.persona = PERSONAS.find((p) => p.id === d.personaId) || PERSONAS[0];
    Object.assign(state, { name: d.name, vibe: d.vibe, userName: d.userName, nickname: d.nickname, meet: d.meet,
      history: Array.isArray(d.history) ? d.history : [] });
    return !!VIBES[state.vibe];
  } catch { return false; }
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- Boutons ---------- */

$("#skipBtn").onclick = () => {
  if (state.phase === "chat") {
    if (!confirm("Recommencer et créer un nouveau copain ?")) return;
    try { localStorage.removeItem("minuit"); } catch {}
    location.reload();
    return;
  }
  // passer l'intro avec des valeurs par défaut
  state.persona ||= PERSONAS[0];
  state.name ||= state.persona.name;
  state.vibe ||= "taquin";
  state.userName ||= "toi";
  state.nickname ||= "ma belle";
  save();
  location.reload();
};

$("#infoBtn").onclick = () => {
  const t = $("#toast");
  t.hidden = !t.hidden;
  if (!t.hidden) setTimeout(() => (t.hidden = true), 3500);
};

/* ---------- Go ---------- */

/* ---------- Écran d'accueil ---------- */

const welcome = $("#welcome");
const ageBox = $("#ageOk");
const startBtn = $("#startBtn");
ageBox.onchange = () => (startBtn.disabled = !ageBox.checked);

function showApp() {
  welcome.classList.add("gone");
  document.querySelector(".app").removeAttribute("inert");
}

startBtn.onclick = () => {
  try { localStorage.setItem("minuit-age", "1"); } catch {}
  showApp();
  onboarding();
};

/* ---------- Installation (PWA) ---------- */

let installEvent = null;
const installBtn = $("#installBtn");
const isStandalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvent = e;
  installBtn.hidden = false;
});
if (isIOS && !isStandalone) installBtn.hidden = false;

installBtn.onclick = async () => {
  if (installEvent) {
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    installBtn.hidden = true;
  } else {
    $("#iosHint").hidden = false;
  }
};

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

/* ---------- Go ---------- */

setProgress(0);
refreshHeader();
if (load()) { showApp(); startChat(false); }
else document.querySelector(".app").setAttribute("inert", "");
