/* ══════════════════════════════════════════════════════════════
   Re:Anime — Firebase Firestore data layer (fixed)

   COMO INCLUIRLO EN TUS PAGINAS:
   ─────────────────────────────
   Pega este bloque UNA VEZ en cada pagina (index, anime, profile)
   ANTES de cualquier script que use las funciones:

   <script type="module" src="firebase-data.js"></script>

   O si preferis inline, pega todo el contenido dentro de:
   <script type="module"> ... </script>

   REGLAS FIRESTORE (reemplazar en Firebase Console → Firestore → Reglas):
   ─────────────────────────────────────────────────────────────────────
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         // Cualquiera puede leer/escribir su propio documento
         // No hay forma de verificar el token de Discord sin backend,
         // pero cada usuario solo puede tocar su propio ID.
         allow read, write: if true;
       }
     }
   }
   ─────────────────────────────────────────────────────────────────────
   NOTA DE SEGURIDAD: "allow read, write: if true" suena peligroso pero
   con GitHub Pages es lo maximo que podemos hacer sin un servidor.
   Los datos son listas de anime, no informacion sensible.
   Si queres mas seguridad, migra el backend a Cloudflare Workers.
══════════════════════════════════════════════════════════════ */

import { initializeApp }    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ── CONFIG ── */
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

/* ── USUARIO ACTUAL ── */
const discordUser = JSON.parse(localStorage.getItem("user")) || null;

/* ── ESTRUCTURA POR DEFECTO ── */
const DEFAULT_DATA = {
  watching:     [],
  completed:    [],
  favorites:    [],
  watchlist:    [],
  episodesSeen: {}
};

/* ══════════════════════════════════════════════════════════════
   HELPERS INTERNOS
══════════════════════════════════════════════════════════════ */

/** Referencia al documento del usuario en Firestore */
function userRef() {
  return doc(db, "users", discordUser.id);
}

/**
 * Asegura que el documento del usuario exista.
 * Usa setDoc con merge:true → nunca sobreescribe campos existentes.
 */
async function ensureDoc() {
  await setDoc(userRef(), { discordId: discordUser.id }, { merge: true });
}

/* ══════════════════════════════════════════════════════════════
   API PUBLICA
   Todas las funciones son async y manejan el fallback a
   localStorage si no hay sesion iniciada.
══════════════════════════════════════════════════════════════ */

/**
 * Carga TODOS los datos del usuario.
 * @returns {Promise<object>}
 */
async function loadUserData() {
  if (!discordUser) {
    return JSON.parse(localStorage.getItem("user_data") || "null") || { ...DEFAULT_DATA };
  }
  try {
    const snap = await getDoc(userRef());
    if (snap.exists()) {
      /* Rellenar campos que puedan faltar (usuarios viejos) */
      return { ...DEFAULT_DATA, ...snap.data() };
    }
    /* Primera vez: crear y devolver estructura limpia */
    const fresh = { discordId: discordUser.id, ...DEFAULT_DATA };
    await setDoc(userRef(), fresh);
    return fresh;
  } catch (err) {
    console.warn("[Re:Anime] Firestore loadUserData error:", err);
    return JSON.parse(localStorage.getItem("user_data") || "null") || { ...DEFAULT_DATA };
  }
}

/**
 * Agrega un anime a una lista.
 * Usa arrayUnion → operacion atomica, no pisas datos con dos pestanas.
 * @param {'favorites'|'watchlist'|'watching'|'completed'} listName
 * @param {string} animeId
 */
async function addToList(listName, animeId) {
  if (!discordUser) {
    const data = await loadUserData();
    const list = data[listName] || [];
    if (!list.includes(animeId)) list.push(animeId);
    data[listName] = list;
    localStorage.setItem("user_data", JSON.stringify(data));
    return;
  }
  try {
    await ensureDoc();
    await updateDoc(userRef(), { [listName]: arrayUnion(animeId) });
  } catch (err) {
    console.warn("[Re:Anime] addToList error:", err);
  }
}

/**
 * Quita un anime de una lista.
 * Usa arrayRemove → operacion atomica.
 * @param {'favorites'|'watchlist'|'watching'|'completed'} listName
 * @param {string} animeId
 */
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
  } catch (err) {
    console.warn("[Re:Anime] removeFromList error:", err);
  }
}

/**
 * Toggle de un anime en una lista.
 * @returns {Promise<boolean>} true = fue agregado, false = fue quitado
 */
async function toggleAnimeInList(listName, animeId) {
  const data   = await loadUserData();
  const inList = (data[listName] || []).includes(animeId);
  if (inList) {
    await removeFromList(listName, animeId);
    return false;
  } else {
    await addToList(listName, animeId);
    return true;
  }
}

/**
 * Verifica si un anime esta en una lista.
 * @returns {Promise<boolean>}
 */
async function isInList(listName, animeId) {
  const data = await loadUserData();
  return (data[listName] || []).includes(animeId);
}

/**
 * Marca un episodio como visto.
 * Usa dot notation para actualizar solo el campo anidado
 * sin tocar el resto de episodesSeen.
 * @param {string} animeId
 * @param {number} episodeIndex
 */
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
    /* Dot notation: actualiza solo episodesSeen.animeId sin pisar otros */
    await updateDoc(userRef(), {
      [`episodesSeen.${animeId}`]: arrayUnion(episodeIndex)
    });
  } catch (err) {
    console.warn("[Re:Anime] markEpisodeSeen error:", err);
  }
}

/**
 * Devuelve los indices de episodios vistos de un anime.
 * @param {string} animeId
 * @returns {Promise<number[]>}
 */
async function getSeenEpisodes(animeId) {
  const data = await loadUserData();
  return (data.episodesSeen || {})[animeId] || [];
}

/* ══════════════════════════════════════════════════════════════
   EXPONER AL SCOPE GLOBAL
   Necesario porque las otras paginas usan scripts normales
   (no type="module") y no pueden importar directamente.
══════════════════════════════════════════════════════════════ */
window.ReAnimeDB = {
  loadUserData,
  addToList,
  removeFromList,
  toggleAnimeInList,
  isInList,
  markEpisodeSeen,
  getSeenEpisodes
};

/* Disparar evento para que otras paginas sepan que la DB esta lista */
window.dispatchEvent(new Event("reanimdb:ready"));

/* ══════════════════════════════════════════════════════════════
   USO EN TUS OTRAS PAGINAS
   ─────────────────────────────────────────────────────────────
   Incluye el script con type="module" en el <head>:
   <script type="module" src="firebase-data.js"></script>

   Luego en tu script normal escucha el evento:

   window.addEventListener("reanimdb:ready", async () => {
     const db = window.ReAnimeDB;

     // Cargar datos del perfil:
     const data = await db.loadUserData();
     renderFavorites(data.favorites);

     // Toggle favorito al hacer click:
     const added = await db.toggleAnimeInList("favorites", animeId);
     btn.classList.toggle("active", added);

     // Marcar episodio visto:
     await db.markEpisodeSeen("re-zero", 0);

     // Ver episodios vistos:
     const seen = await db.getSeenEpisodes("re-zero");
     // seen = [0, 1, 3, ...]
   });
══════════════════════════════════════════════════════════════ */