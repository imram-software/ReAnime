import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDjVVsA-22tvlsUbbDenoS_vWlWLNY-HsU",
  authDomain:        "reanime-1a781.firebaseapp.com",
  projectId:         "reanime-1a781",
  storageBucket:     "reanime-1a781.firebasestorage.app",
  messagingSenderId: "129737601446",
  appId:             "1:129737601446:web:721e6601c2f5ba0bb35f67"
};

const db          = getFirestore(initializeApp(firebaseConfig));
const discordUser = JSON.parse(localStorage.getItem("user")) || null;

const DEFAULT_DATA = {
  watching: [], completed: [], favorites: [], watchlist: [], episodesSeen: {}
};

/* ─────────────────────────────────────────────────────────────
   CACHE (sessionStorage)
   - Se guarda cuando llega la respuesta de Firestore
   - Se actualiza localmente despues de cada escritura
     sin necesidad de volver a ir a la red
   - Se borra solo al cerrar el tab
───────────────────────────────────────────────────────────── */
const CACHE_KEY = discordUser ? `reanime_${discordUser.id}` : null;

function cacheRead() {
  if (!CACHE_KEY) return null;
  try {
    const r = sessionStorage.getItem(CACHE_KEY);
    return r ? JSON.parse(r) : null;
  } catch { return null; }
}

function cacheWrite(data) {
  if (!CACHE_KEY) return;
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

function cacheClear() {
  if (!CACHE_KEY) return;
  try { sessionStorage.removeItem(CACHE_KEY); } catch {}
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
function userRef() { return doc(db, "users", discordUser.id); }

async function ensureDoc() {
  await setDoc(userRef(), { discordId: discordUser.id }, { merge: true });
}

/* ─────────────────────────────────────────────────────────────
   API PUBLICA
───────────────────────────────────────────────────────────── */

/* loadUserData
   1ro: cache (0ms)
   2do: Firestore (solo si no hay cache)
   3ro: localStorage como fallback si Firestore falla */
async function loadUserData() {
  if (!discordUser) {
    return JSON.parse(localStorage.getItem("user_data") || "null") || { ...DEFAULT_DATA };
  }

  const cached = cacheRead();
  if (cached) return cached;                 // hit instantaneo

  try {
    const snap = await getDoc(userRef());
    let data;
    if (snap.exists()) {
      data = { ...DEFAULT_DATA, ...snap.data() };
    } else {
      data = { discordId: discordUser.id, ...DEFAULT_DATA };
      await setDoc(userRef(), data);
    }
    cacheWrite(data);
    return data;
  } catch (err) {
    console.warn("[Re:Anime] loadUserData:", err);
    return JSON.parse(localStorage.getItem("user_data") || "null") || { ...DEFAULT_DATA };
  }
}

/* addToList — usa arrayUnion (atomico en Firestore) y actualiza cache local */
async function addToList(listName, animeId) {
  if (!discordUser) {
    const data = await loadUserData();
    if (!(data[listName] || []).includes(animeId)) {
      data[listName] = [...(data[listName] || []), animeId];
      localStorage.setItem("user_data", JSON.stringify(data));
    }
    return;
  }
  try {
    await ensureDoc();
    await updateDoc(userRef(), { [listName]: arrayUnion(animeId) });
    /* actualizar cache sin nueva lectura de red */
    const cached = cacheRead();
    if (cached) {
      cached[listName] = [...new Set([...(cached[listName] || []), animeId])];
      cacheWrite(cached);
    }
  } catch (err) { console.warn("[Re:Anime] addToList:", err); }
}

/* removeFromList — usa arrayRemove y actualiza cache local */
async function removeFromList(listName, animeId) {
  if (!discordUser) {
    const data = await loadUserData();
    data[listName] = (data[listName] || []).filter(id => id !== animeId);
    localStorage.setItem("user_data", JSON.stringify(data));
    return;
  }
  try {
    await ensureDoc();
    await updateDoc(userRef(), { [listName]: arrayRemove(animeId) });
    const cached = cacheRead();
    if (cached) {
      cached[listName] = (cached[listName] || []).filter(id => id !== animeId);
      cacheWrite(cached);
    }
  } catch (err) { console.warn("[Re:Anime] removeFromList:", err); }
}

/* toggleAnimeInList — lee cache (instantaneo) para saber estado actual */
async function toggleAnimeInList(listName, animeId) {
  const data   = await loadUserData();
  const inList = (data[listName] || []).includes(animeId);
  if (inList) { await removeFromList(listName, animeId); return false; }
  else        { await addToList(listName, animeId);      return true;  }
}

/* isInList */
async function isInList(listName, animeId) {
  const data = await loadUserData();
  return (data[listName] || []).includes(animeId);
}

/* markEpisodeSeen — dot notation para no pisar otros episodios */
async function markEpisodeSeen(animeId, episodeIndex) {
  if (!discordUser) {
    const data = await loadUserData();
    const seen = data.episodesSeen || {};
    seen[animeId] = seen[animeId] || [];
    if (!seen[animeId].includes(episodeIndex)) seen[animeId].push(episodeIndex);
    data.episodesSeen = seen;
    localStorage.setItem("user_data", JSON.stringify(data));
    return;
  }
  try {
    await ensureDoc();
    await updateDoc(userRef(), {
      [`episodesSeen.${animeId}`]: arrayUnion(episodeIndex)
    });
    const cached = cacheRead();
    if (cached) {
      cached.episodesSeen = cached.episodesSeen || {};
      cached.episodesSeen[animeId] = cached.episodesSeen[animeId] || [];
      if (!cached.episodesSeen[animeId].includes(episodeIndex)) {
        cached.episodesSeen[animeId].push(episodeIndex);
      }
      cacheWrite(cached);
    }
  } catch (err) { console.warn("[Re:Anime] markEpisodeSeen:", err); }
}

/* getSeenEpisodes */
async function getSeenEpisodes(animeId) {
  const data = await loadUserData();
  return (data.episodesSeen || {})[animeId] || [];
}

/* ─────────────────────────────────────────────────────────────
   EXPONER AL SCOPE GLOBAL
   Las otras paginas usan scripts normales (no module),
   por eso se expone en window.ReAnimeDB
───────────────────────────────────────────────────────────── */
window.ReAnimeDB = {
  loadUserData,
  addToList,
  removeFromList,
  toggleAnimeInList,
  isInList,
  markEpisodeSeen,
  getSeenEpisodes,
  cacheClear  // expuesto por si necesitas forzar un refresh
};

window.dispatchEvent(new Event("reanimdb:ready"));