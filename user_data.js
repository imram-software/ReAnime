/* ══════════════════════════════════════════════════════════════
   Re:Anime — Firebase Firestore data layer
   Reemplaza el localStorage para usuarios logueados con Discord.
   Para usuarios sin login sigue usando localStorage como fallback.

   SETUP:
   1. Ir a https://console.firebase.google.com
   2. Crear proyecto → Firestore Database → modo produccion
   3. En Reglas de Firestore pegar las reglas del bloque RULES
   4. En Configuracion del proyecto → Agregar app web → copiar firebaseConfig
   5. Reemplazar el objeto firebaseConfig de abajo con el tuyo
   6. Incluir este archivo en index.html, anime.html y profile.html
      antes de cualquier script que use userData

   REGLAS FIRESTORE (pegar en Firebase Console → Firestore → Reglas):
   ──────────────────────────────────────────────────────────────
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.resource.data.discordId == userId
                            || resource.data.discordId == userId;
       }
     }
   }
   ──────────────────────────────────────────────────────────────
   NOTA: Estas reglas son las mejores posibles sin un servidor propio.
   Sin backend no podemos verificar el token de Discord 100% seguro,
   pero si los datos son listas de anime no es un riesgo critico.
══════════════════════════════════════════════════════════════ */

/* ── FIREBASE CONFIG (reemplazar con el tuyo) ── */
const firebaseConfig = {
  apiKey: "AIzaSyDjVVsA-22tvlsUbbDenoS_vWlWLNY-HsU",
  authDomain: "reanime-1a781.firebaseapp.com",
  projectId: "reanime-1a781",
  storageBucket: "reanime-1a781.firebasestorage.app",
  messagingSenderId: "129737601446",
  appId: "1:129737601446:web:721e6601c2f5ba0bb35f67"
};

/* ── ESTRUCTURA DE DATOS POR DEFECTO ── */
const DEFAULT_DATA = {
  watching:     [],   // ids de animes en progreso
  completed:    [],   // ids de animes terminados
  favorites:    [],   // ids de favoritos
  watchlist:    [],   // ids de "ver despues"
  episodesSeen: {}    // { animeId: [0,1,2,...] }
};

/* ══════════════════════════════════════════════════════════════
   INICIALIZACION
══════════════════════════════════════════════════════════════ */
import { initializeApp }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseApp = initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);

/* ── Usuario actual (desde localStorage, seteado por Discord OAuth) ── */
const discordUser = JSON.parse(localStorage.getItem("user")) || null;

/* ══════════════════════════════════════════════════════════════
   API PUBLICA
   Usa estas funciones en vez de acceder a localStorage directo.
══════════════════════════════════════════════════════════════ */

/**
 * Carga los datos del usuario.
 * Si hay login con Discord → Firestore.
 * Si no hay login → localStorage (igual que antes).
 * @returns {Promise<object>} datos del usuario
 */
async function loadUserData() {
  if (!discordUser) {
    /* fallback: sin login */
    const raw = localStorage.getItem("user_data");
    return raw ? JSON.parse(raw) : { ...DEFAULT_DATA };
  }

  try {
    const ref  = doc(db, "users", discordUser.id);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      return snap.data();
    } else {
      /* Primera vez: crear documento con datos vacios */
      const fresh = { discordId: discordUser.id, ...DEFAULT_DATA };
      await setDoc(ref, fresh);
      return fresh;
    }
  } catch (err) {
    console.warn("Firestore error, usando localStorage:", err);
    /* Si Firestore falla, usar localStorage como respaldo */
    const raw = localStorage.getItem("user_data");
    return raw ? JSON.parse(raw) : { ...DEFAULT_DATA };
  }
}

/**
 * Guarda datos del usuario (parcial o total).
 * @param {object} partial — solo los campos que cambiaron
 */
async function saveUserData(partial) {
  if (!discordUser) {
    /* fallback: sin login */
    const current = JSON.parse(localStorage.getItem("user_data") || "{}");
    const updated = { ...current, ...partial };
    localStorage.setItem("user_data", JSON.stringify(updated));
    return;
  }

  try {
    const ref = doc(db, "users", discordUser.id);
    await updateDoc(ref, { ...partial, discordId: discordUser.id });
  } catch (err) {
    /* Si no existe el documento todavia, crearlo */
    if (err.code === "not-found") {
      await setDoc(doc(db, "users", discordUser.id), {
        discordId: discordUser.id,
        ...DEFAULT_DATA,
        ...partial
      });
    } else {
      console.warn("Firestore save error:", err);
    }
  }
}

/**
 * Agrega o quita un animeId de una lista (toggle).
 * @param {'favorites'|'watchlist'|'watching'|'completed'} listName
 * @param {string} animeId
 * @returns {Promise<boolean>} true si fue agregado, false si fue quitado
 */
async function toggleAnimeInList(listName, animeId) {
  const data = await loadUserData();
  const list = data[listName] || [];
  const idx  = list.indexOf(animeId);
  if (idx > -1) {
    list.splice(idx, 1);
  } else {
    list.push(animeId);
  }
  await saveUserData({ [listName]: list });
  return idx === -1; // true = fue agregado
}

/**
 * Marca un episodio como visto.
 * @param {string} animeId
 * @param {number} episodeIndex
 */
async function markEpisodeSeen(animeId, episodeIndex) {
  const data    = await loadUserData();
  const seen    = data.episodesSeen || {};
  const epList  = seen[animeId] || [];
  if (!epList.includes(episodeIndex)) epList.push(episodeIndex);
  seen[animeId] = epList;
  await saveUserData({ episodesSeen: seen });
}

/**
 * Devuelve los episodios vistos de un anime.
 * @param {string} animeId
 * @returns {Promise<number[]>}
 */
async function getSeenEpisodes(animeId) {
  const data = await loadUserData();
  return (data.episodesSeen || {})[animeId] || [];
}

/**
 * Verifica si un anime esta en una lista.
 * @param {'favorites'|'watchlist'|'watching'|'completed'} listName
 * @param {string} animeId
 * @returns {Promise<boolean>}
 */
async function isInList(listName, animeId) {
  const data = await loadUserData();
  return (data[listName] || []).includes(animeId);
}

/* ══════════════════════════════════════════════════════════════
   EJEMPLO DE USO (reemplaza tu codigo actual)
══════════════════════════════════════════════════════════════

   // Antes (localStorage directo):
   let userData = JSON.parse(localStorage.getItem("user_data")) || {};
   userData[user.id].favorites.push(animeId);
   localStorage.setItem("user_data", JSON.stringify(userData));

   // Ahora (Firestore con fallback):
   await toggleAnimeInList("favorites", animeId);

   // Cargar perfil:
   const data = await loadUserData();
   console.log(data.favorites); // ["re-zero", "aot", ...]

   // Marcar episodio visto:
   await markEpisodeSeen("re-zero", 0);

   // En profile.html para renderizar listas:
   const data = await loadUserData();
   const myFavIds = data.favorites; // array de ids

══════════════════════════════════════════════════════════════ */