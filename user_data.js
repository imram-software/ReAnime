import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDjVVsA-22tvlsUbbDenoS_vWlWLNY-HsU",
  authDomain:        "reanime-1a781.firebaseapp.com",
  projectId:         "reanime-1a781",
  storageBucket:     "reanime-1a781.firebasestorage.app",
  messagingSenderId: "129737601446",
  appId:             "1:129737601446:web:721e6601c2f5ba0bb35f67"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

/* Cache offline de Firestore en IndexedDB — permite cargar datos
   sin red en la primera renderizacion, igual que sessionStorage
   pero manejado por Firestore automaticamente */
enableIndexedDbPersistence(db).catch(() => {
  /* Falla silenciosamente en modo privado o si hay otra pestaña abierta */
});

const discordUser = JSON.parse(localStorage.getItem("user")) || null;

const DEFAULT_DATA = {
  watching: [], completed: [], favorites: [], watchlist: [], episodesSeen: {},
  holy: 0,          // moneda del gacha
  collection: [],   // personajes obtenidos [{id,name,anime,image,stars,obtainedAt}]
  featured: null,   // personaje destacado en perfil
  displayName: "",   // nombre personalizable
  likes: 0,          // total de likes recibidos (publico)
  likesGiven: {},    // { userId: "YYYY-MM-DD" } — rastreo de likes dados hoy
  pvpAttack: [],     // equipo de ataque [{ charId, charName }]
  pvpDefense: []     // equipo de defensa [{ charId, charName }]
  pvpDefense: [],     // equipo de defensa [{ charId, charName }]
  upgrades: {}         // mejoras por personaje

/* ─────────────────────────────────────────────────────────────
   ESTADO LOCAL
   onSnapshot mantiene _localData actualizado en tiempo real.
   Las funciones de lectura usan _localData directamente (0ms).
   Las funciones de escritura mandan a Firestore y onSnapshot
   propaga el cambio a todos los dispositivos conectados.
───────────────────────────────────────────────────────────── */
let _localData    = null;   // datos en memoria, siempre frescos
let _unsubscribe  = null;   // para cancelar el listener si hace falta
let _readyResolve = null;
const _readyPromise = new Promise(res => { _readyResolve = res; });

function userRef() { return doc(db, "users", discordUser.id); }

async function ensureDoc() {
  // Guardar tambien username y avatar para que otros perfiles puedan mostrarlos
  const profileData = { discordId: discordUser.id };
  if (discordUser.username) profileData.discordUsername = discordUser.username;
  if (discordUser.avatar)   profileData.discordAvatar   = discordUser.avatar;
  await setDoc(userRef(), profileData, { merge: true });
}

/* ─────────────────────────────────────────────────────────────
   LISTENER EN TIEMPO REAL
   Se llama una vez al cargar el modulo.
   Firestore lo dispara:
     - inmediatamente con datos del cache local (IndexedDB)
     - cada vez que el documento cambia en cualquier dispositivo
───────────────────────────────────────────────────────────── */
function startListener() {
  if (!discordUser) {
    _localData = JSON.parse(localStorage.getItem("user_data") || "null") || { ...DEFAULT_DATA };
    _readyResolve();
    window.dispatchEvent(new Event("reanimdb:ready"));
    return;
  }

  _unsubscribe = onSnapshot(
    userRef(),
    { includeMetadataChanges: false },  // solo cambios reales, no cache intermedio
    (snap) => {
      if (snap.exists()) {
        _localData = { ...DEFAULT_DATA, ...snap.data() };
      } else {
        /* Primera vez: crear documento */
        _localData = { discordId: discordUser.id, discordUsername: discordUser.username || "", discordAvatar: discordUser.avatar || "", ...DEFAULT_DATA };
        setDoc(userRef(), _localData).catch(e => console.warn("[Re:Anime] setDoc:", e));
      }

      /* Primera llamada: marcar como listo */
      if (_readyResolve) {
        _readyResolve();
        _readyResolve = null;
        window.dispatchEvent(new Event("reanimdb:ready"));
      }

      /* Llamadas posteriores (cambio desde otro dispositivo):
         disparar evento para que la UI se actualice */
      window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
    },
    (err) => {
      console.warn("[Re:Anime] onSnapshot error:", err);
      /* Fallback: intentar con localStorage */
      _localData = JSON.parse(localStorage.getItem("user_data") || "null") || { ...DEFAULT_DATA };
      if (_readyResolve) {
        _readyResolve();
        _readyResolve = null;
        window.dispatchEvent(new Event("reanimdb:ready"));
      }
    }
  );
}

startListener();

/* ─────────────────────────────────────────────────────────────
   API PUBLICA
───────────────────────────────────────────────────────────── */

/* loadUserData — sincrono si ya hay datos, async solo la primera vez */
async function loadUserData() {
  if (_localData) return _localData;
  await _readyPromise;
  return _localData;
}

/* addToList */
async function addToList(listName, animeId) {
  if (!discordUser) {
    _localData[listName] = [...new Set([...(_localData[listName] || []), animeId])];
    localStorage.setItem("user_data", JSON.stringify(_localData));
    return;
  }
  /* Optimistic local update — onSnapshot confirmara desde el servidor */
  _localData[listName] = [...new Set([...(_localData[listName] || []), animeId])];
  window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
  try {
    await ensureDoc();
    await updateDoc(userRef(), { [listName]: arrayUnion(animeId) });
  } catch (e) { console.warn("[Re:Anime] addToList:", e); }
}

/* removeFromList */
async function removeFromList(listName, animeId) {
  if (!discordUser) {
    _localData[listName] = (_localData[listName] || []).filter(id => id !== animeId);
    localStorage.setItem("user_data", JSON.stringify(_localData));
    return;
  }
  _localData[listName] = (_localData[listName] || []).filter(id => id !== animeId);
  window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
  try {
    await ensureDoc();
    await updateDoc(userRef(), { [listName]: arrayRemove(animeId) });
  } catch (e) { console.warn("[Re:Anime] removeFromList:", e); }
}

/* toggleAnimeInList */
async function toggleAnimeInList(listName, animeId) {
  await _readyPromise;
  const inList = (_localData[listName] || []).includes(animeId);
  if (inList) { await removeFromList(listName, animeId); return false; }
  else        { await addToList(listName, animeId);      return true;  }
}

/* isInList */
async function isInList(listName, animeId) {
  await _readyPromise;
  return (_localData[listName] || []).includes(animeId);
}

/* markEpisodeSeen */
async function markEpisodeSeen(animeId, episodeIndex) {
  await _readyPromise;
  _localData.episodesSeen = _localData.episodesSeen || {};
  _localData.episodesSeen[animeId] = _localData.episodesSeen[animeId] || [];
  if (!_localData.episodesSeen[animeId].includes(episodeIndex)) {
    _localData.episodesSeen[animeId].push(episodeIndex);
  }
  if (!discordUser) {
    localStorage.setItem("user_data", JSON.stringify(_localData));
    return;
  }
  try {
    await ensureDoc();
    await updateDoc(userRef(), {
      [`episodesSeen.${animeId}`]: arrayUnion(episodeIndex)
    });
  } catch (e) { console.warn("[Re:Anime] markEpisodeSeen:", e); }
}

/* getSeenEpisodes */
async function getSeenEpisodes(animeId) {
  await _readyPromise;
  return (_localData.episodesSeen || {})[animeId] || [];
}

/* ─────────────────────────────────────────────────────────────
   HOLY — moneda del gacha
───────────────────────────────────────────────────────────── */
async function getHoly() {
  await _readyPromise;
  return _localData.holy || 0;
}

async function addHoly(amount) {
  await _readyPromise;
  const newVal = (_localData.holy || 0) + amount;
  _localData.holy = newVal;
  window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
  if (!discordUser) { localStorage.setItem("user_data", JSON.stringify(_localData)); return newVal; }
  try {
    await ensureDoc();
    await updateDoc(userRef(), { holy: newVal });
  } catch(e) { console.warn("[Re:Anime] addHoly:", e); }
  return newVal;
}

async function spendHoly(amount) {
  await _readyPromise;
  const current = _localData.holy || 0;
  if (current < amount) return false; // sin fondos
  const newVal = current - amount;
  _localData.holy = newVal;
  window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
  if (!discordUser) { localStorage.setItem("user_data", JSON.stringify(_localData)); return true; }
  try {
    await ensureDoc();
    await updateDoc(userRef(), { holy: newVal });
  } catch(e) { console.warn("[Re:Anime] spendHoly:", e); }
  return true;
}

/* ─────────────────────────────────────────────────────────────
   COLLECTION — personajes del gacha
───────────────────────────────────────────────────────────── */
async function addToCollection(chars) {
  // chars: array de objetos {id, name, anime, image, stars}
  await _readyPromise;
  const toAdd = chars.map(c => ({ ...c, obtainedAt: Date.now() }));
  _localData.collection = [...(_localData.collection || []), ...toAdd];
  window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
  if (!discordUser) { localStorage.setItem("user_data", JSON.stringify(_localData)); return; }
  try {
    await ensureDoc();
    // Guardar los ultimos 500 personajes para no superar limite de Firestore
    const capped = _localData.collection.slice(-500);
    await updateDoc(userRef(), { collection: capped });
  } catch(e) { console.warn("[Re:Anime] addToCollection:", e); }
}

async function getCollection() {
  await _readyPromise;
  return _localData.collection || [];
}

/* ─────────────────────────────────────────────────────────────
   MEJORA DE PERSONAJES (duplicados → nivel + skins)
─────────────────────────────────────────────────────────────── */

  /* Retorna el mapa de mejoras: { "Rem": { level:3, unlockedSkins:[0,1,2], selectedPassive:"def_pen", selectedSkin:1 } } */
  async getUpgrades() {
    await _readyPromise;
    return _localData.upgrades || {};
  },

  /* Retorna la mejora de un personaje específico */
  async getCharUpgrade(name) {
    await _readyPromise;
    const up = (_localData.upgrades || {})[name];
    return up || { level: 1, unlockedSkins: [0], selectedPassive: null, selectedSkin: 0 };
  },

  /* Sube el nivel de un personaje usando duplicados de la colección.
     Requiere DUPE_PER_LEVEL duplicados (default 1) por nivel.
     Retorna { ok, newLevel, error } */
  async upgradeChar(name) {
    await _readyPromise;
    const MAX_LEVEL = 10;
    const DUPE_PER_LEVEL = 1;

    const coll = _localData.collection || [];
    const copies = coll.filter(c => c.name === name);
    if (copies.length < 2) return { ok: false, error: 'Necesitas al menos 1 duplicado para mejorar.' };

    const upgrades = _localData.upgrades || {};
    const cur = upgrades[name] || { level: 1, unlockedSkins: [0], selectedPassive: null, selectedSkin: 0 };
    if (cur.level >= MAX_LEVEL) return { ok: false, error: 'Ya está en nivel máximo (10).' };

    // Consume 1 duplicado (deja 1 copia base)
    const idx = coll.findIndex(c => c.name === name && coll.indexOf(c) !== coll.findIndex(x => x.name === name));
    if (idx === -1) {
      // fallback: remove last copy
      const lastIdx = [...coll].reverse().findIndex(c => c.name === name);
      if (lastIdx === -1) return { ok: false, error: 'No hay duplicados disponibles.' };
      coll.splice(coll.length - 1 - lastIdx, 1);
    } else {
      coll.splice(idx, 1);
    }

    const newLevel = cur.level + 1;
    // Unlock skin if available (cada 2 niveles)
    const skins = cur.unlockedSkins || [0];
    const newSkinIdx = Math.floor((newLevel - 1) / 2);
    if (!skins.includes(newSkinIdx)) skins.push(newSkinIdx);

    upgrades[name] = { ...cur, level: newLevel, unlockedSkins: skins };
    _localData.upgrades = upgrades;
    _localData.collection = coll;
    window.dispatchEvent(new CustomEvent('reanimdb:update', { detail: _localData }));
    await _save();
    return { ok: true, newLevel, unlockedSkins: skins };
  },

  /* Cambia la pasiva activa de un personaje (solo pasivas desbloqueadas) */
  async setActivePassive(name, passiveId) {
    await _readyPromise;
    const upgrades = _localData.upgrades || {};
    const cur = upgrades[name] || { level: 1, unlockedSkins: [0], selectedPassive: null, selectedSkin: 0 };
    upgrades[name] = { ...cur, selectedPassive: passiveId };
    _localData.upgrades = upgrades;
    await _save();
    return { ok: true };
  },

  /* Cambia la skin activa de un personaje */
  async setActiveSkin(name, skinIdx) {
    await _readyPromise;
    const upgrades = _localData.upgrades || {};
    const cur = upgrades[name] || { level: 1, unlockedSkins: [0], selectedPassive: null, selectedSkin: 0 };
    if (!(cur.unlockedSkins || [0]).includes(skinIdx)) return { ok: false, error: 'Skin no desbloqueada.' };
    upgrades[name] = { ...cur, selectedSkin: skinIdx };
    _localData.upgrades = upgrades;
    await _save();
    return { ok: true };
  },

/* ─────────────────────────────────────────────────────────────
   EXPONER
───────────────────────────────────────────────────────────── */
async function setFeatured(charData) {
  await _readyPromise;
  _localData.featured = charData || null;
  window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
  if (!discordUser) { localStorage.setItem("user_data", JSON.stringify(_localData)); return; }
  try {
    await ensureDoc();
    await updateDoc(userRef(), { featured: charData || null });
  } catch(e) { console.warn("[Re:Anime] setFeatured:", e); }
}

async function getFeaturedChar() {
  await _readyPromise;
  return _localData.featured || null;
}

/* ─────────────────────────────────────────────────────────────
   LIKES
   likesGiven se guarda en el documento del usuario que da el like.
   likes (contador) se guarda en el documento del perfil que lo recibe.
───────────────────────────────────────────────────────────── */

/* Dar like al perfil de otro usuario.
   Retorna: 'ok' | 'already_today' | 'not_logged_in' */
async function likeProfile(targetUserId) {
  await _readyPromise;
  if (!discordUser) return 'not_logged_in';
  if (discordUser.id === targetUserId) return 'self';

  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const given = _localData.likesGiven || {};

  if (given[targetUserId] === today) return 'already_today';

  // 1. Marcar en nuestro propio doc que dimos like hoy
  given[targetUserId] = today;
  _localData.likesGiven = given;

  try {
    await ensureDoc();
    await updateDoc(userRef(), { [`likesGiven.${targetUserId}`]: today });
  } catch(e) { console.warn('[Re:Anime] likeProfile (own doc):', e); }

  // 2. Incrementar el contador en el doc del destinatario
  //    Usamos la REST commit API con fieldTransforms (no necesita auth para reglas publicas)
  try {
    const commitUrl = `https://firestore.googleapis.com/v1/projects/reanime-1a781/databases/(default)/documents:commit?key=AIzaSyDjVVsA-22tvlsUbbDenoS_vWlWLNY-HsU`;
    await fetch(commitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        writes: [{
          transform: {
            document: `projects/reanime-1a781/databases/(default)/documents/users/${targetUserId}`,
            fieldTransforms: [{ fieldPath: 'likes', increment: { integerValue: 1 } }]
          }
        }]
      })
    });
  } catch(e) { console.warn('[Re:Anime] likeProfile (target increment):', e); }

  return 'ok';
}

/* Verificar si ya dimos like hoy a este perfil */
async function hasLikedToday(targetUserId) {
  await _readyPromise;
  if (!discordUser) return false;
  const today = new Date().toISOString().slice(0, 10);
  const given = _localData.likesGiven || {};
  return given[targetUserId] === today;
}

async function setPvpTeam(type, team) {
  // type: 'attack' | 'defense'
  // team: array de hasta 5 objetos { id, name, anime, image, stars }
  await _readyPromise;
  const field = type === 'attack' ? 'pvpAttack' : 'pvpDefense';
  _localData[field] = team;
  window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
  if (!discordUser) { localStorage.setItem("user_data", JSON.stringify(_localData)); return; }
  try {
    await ensureDoc();
    await updateDoc(userRef(), { [field]: team });
  } catch(e) { console.warn("[Re:Anime] setPvpTeam:", e); }
}

async function getPvpTeams() {
  await _readyPromise;
  return {
    attack:  _localData.pvpAttack  || [],
    defense: _localData.pvpDefense || [],
  };
}

async function setDisplayName(name) {
  await _readyPromise;
  const clean = (name || '').trim().slice(0, 32);
  _localData.displayName = clean;
  window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
  if (!discordUser) { localStorage.setItem("user_data", JSON.stringify(_localData)); return; }
  try {
    await ensureDoc();
    await updateDoc(userRef(), { displayName: clean });
  } catch(e) { console.warn("[Re:Anime] setDisplayName:", e); }
}


async function registerPvpPlayer() {
  if (!discordUser) return;
  try {
    /* Atomically add this player's ID to the registry array */
    const commitUrl = `https://firestore.googleapis.com/v1/projects/reanime-1a781/databases/(default)/documents:commit?key=AIzaSyDjVVsA-22tvlsUbbDenoS_vWlWLNY-HsU`;
    await fetch(commitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        writes: [{
          transform: {
            document: 'projects/reanime-1a781/databases/(default)/documents/pvp/registry',
            fieldTransforms: [{
              fieldPath: 'players',
              appendMissingElements: { values: [{ stringValue: discordUser.id }] }
            }]
          }
        }]
      })
    });
  } catch(e) { console.warn("[Re:Anime] registerPvpPlayer:", e); }
}

async function addConquestPoints(amount) {
  await _readyPromise;
  const newVal = Math.max(0, (_localData.conquest || 0) + amount);
  _localData.conquest = newVal;
  window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
  if (!discordUser) { localStorage.setItem("user_data", JSON.stringify(_localData)); return newVal; }
  try { await ensureDoc(); await updateDoc(userRef(), { conquest: newVal }); } catch(e) {}
  return newVal;
}
async function getConquest() { await _readyPromise; return _localData.conquest || 0; }

async function addBattleLog(entry) {
  await _readyPromise;
  const log = (_localData.battleLog || []);
  log.unshift({ ...entry, date: Date.now() });
  _localData.battleLog = log.slice(0, 50);
  window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
  if (!discordUser) { localStorage.setItem("user_data", JSON.stringify(_localData)); return; }
  try { await ensureDoc(); await updateDoc(userRef(), { battleLog: _localData.battleLog }); } catch(e) {}
}
async function getBattleLog() { await _readyPromise; return _localData.battleLog || []; }

  recordDefenseWin,
  getUpgrades,
  getCharUpgrade,
  upgradeChar,
  setActivePassive,
  setActiveSkin
  try {
    const commitUrl = `https://firestore.googleapis.com/v1/projects/reanime-1a781/databases/(default)/documents:commit?key=AIzaSyDjVVsA-22tvlsUbbDenoS_vWlWLNY-HsU`;
    await fetch(commitUrl, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ writes:[{ transform:{ document:`projects/reanime-1a781/databases/(default)/documents/users/${targetUserId}`, fieldTransforms:[{ fieldPath:'conquest', increment:{integerValue:10} }] }}] })
    });
  } catch(e) { console.warn("[Re:Anime] recordDefenseWin:", e); }
}

window.ReAnimeDB = {
  loadUserData,
  addToList,
  removeFromList,
  toggleAnimeInList,
  isInList,
  markEpisodeSeen,
  getSeenEpisodes,
  getHoly,
  addHoly,
  spendHoly,
  addToCollection,
  getCollection,
  setFeatured,
  getFeaturedChar,
  setDisplayName,
  likeProfile,
  hasLikedToday,
  setPvpTeam,
  getPvpTeams,
  registerPvpPlayer,
  addConquestPoints,
  getConquest,
  addBattleLog,
  getBattleLog,
  recordDefenseWin
};