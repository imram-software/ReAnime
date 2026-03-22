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

enableIndexedDbPersistence(db).catch(() => {});

const discordUser = JSON.parse(localStorage.getItem("user")) || null;

const DEFAULT_DATA = {
  watching: [], completed: [], favorites: [], watchlist: [], episodesSeen: {},
  holy: 0,
  collection: [],
  featured: null,
  displayName: "",
  likes: 0,
  likesGiven: {},
  pvpAttack: [],
  pvpDefense: [],
  upgrades: {}
};

let _localData    = null;
let _unsubscribe  = null;
let _readyResolve = null;
const _readyPromise = new Promise(res => { _readyResolve = res; });

function userRef() { return doc(db, "users", discordUser.id); }

async function ensureDoc() {
  const profileData = { discordId: discordUser.id };
  if (discordUser.username) profileData.discordUsername = discordUser.username;
  if (discordUser.avatar)   profileData.discordAvatar   = discordUser.avatar;
  await setDoc(userRef(), profileData, { merge: true });
}

function startListener() {
  if (!discordUser) {
    _localData = JSON.parse(localStorage.getItem("user_data") || "null") || { ...DEFAULT_DATA };
    _readyResolve();
    window.dispatchEvent(new Event("reanimdb:ready"));
    return;
  }

  _unsubscribe = onSnapshot(
    userRef(),
    { includeMetadataChanges: false },
    (snap) => {
      if (snap.exists()) {
        _localData = { ...DEFAULT_DATA, ...snap.data() };
      } else {
        _localData = { discordId: discordUser.id, discordUsername: discordUser.username || "", discordAvatar: discordUser.avatar || "", ...DEFAULT_DATA };
        setDoc(userRef(), _localData).catch(e => console.warn("[Re:Anime] setDoc:", e));
      }
      if (_readyResolve) {
        _readyResolve();
        _readyResolve = null;
        window.dispatchEvent(new Event("reanimdb:ready"));
      }
      window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
    },
    (err) => {
      console.warn("[Re:Anime] onSnapshot error:", err);
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

/* ── API ── */

async function loadUserData() {
  if (_localData) return _localData;
  await _readyPromise;
  return _localData;
}

async function addToList(listName, animeId) {
  if (!discordUser) {
    _localData[listName] = [...new Set([...(_localData[listName] || []), animeId])];
    localStorage.setItem("user_data", JSON.stringify(_localData));
    return;
  }
  _localData[listName] = [...new Set([...(_localData[listName] || []), animeId])];
  window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
  try { await ensureDoc(); await updateDoc(userRef(), { [listName]: arrayUnion(animeId) }); }
  catch (e) { console.warn("[Re:Anime] addToList:", e); }
}

async function removeFromList(listName, animeId) {
  if (!discordUser) {
    _localData[listName] = (_localData[listName] || []).filter(id => id !== animeId);
    localStorage.setItem("user_data", JSON.stringify(_localData));
    return;
  }
  _localData[listName] = (_localData[listName] || []).filter(id => id !== animeId);
  window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
  try { await ensureDoc(); await updateDoc(userRef(), { [listName]: arrayRemove(animeId) }); }
  catch (e) { console.warn("[Re:Anime] removeFromList:", e); }
}

async function toggleAnimeInList(listName, animeId) {
  await _readyPromise;
  const inList = (_localData[listName] || []).includes(animeId);
  if (inList) { await removeFromList(listName, animeId); return false; }
  else        { await addToList(listName, animeId);      return true;  }
}

async function isInList(listName, animeId) {
  await _readyPromise;
  return (_localData[listName] || []).includes(animeId);
}

async function markEpisodeSeen(animeId, episodeIndex) {
  await _readyPromise;
  _localData.episodesSeen = _localData.episodesSeen || {};
  _localData.episodesSeen[animeId] = _localData.episodesSeen[animeId] || [];
  if (!_localData.episodesSeen[animeId].includes(episodeIndex)) {
    _localData.episodesSeen[animeId].push(episodeIndex);
  }
  if (!discordUser) { localStorage.setItem("user_data", JSON.stringify(_localData)); return; }
  try { await ensureDoc(); await updateDoc(userRef(), { [`episodesSeen.${animeId}`]: arrayUnion(episodeIndex) }); }
  catch (e) { console.warn("[Re:Anime] markEpisodeSeen:", e); }
}

async function getSeenEpisodes(animeId) {
  await _readyPromise;
  return (_localData.episodesSeen || {})[animeId] || [];
}

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
  try { await ensureDoc(); await updateDoc(userRef(), { holy: newVal }); }
  catch(e) { console.warn("[Re:Anime] addHoly:", e); }
  return newVal;
}

async function spendHoly(amount) {
  await _readyPromise;
  const current = _localData.holy || 0;
  if (current < amount) return false;
  const newVal = current - amount;
  _localData.holy = newVal;
  window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
  if (!discordUser) { localStorage.setItem("user_data", JSON.stringify(_localData)); return true; }
  try { await ensureDoc(); await updateDoc(userRef(), { holy: newVal }); }
  catch(e) { console.warn("[Re:Anime] spendHoly:", e); }
  return true;
}

async function addToCollection(chars) {
  await _readyPromise;
  const toAdd = chars.map(c => ({ ...c, obtainedAt: Date.now() }));
  _localData.collection = [...(_localData.collection || []), ...toAdd];
  window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
  if (!discordUser) { localStorage.setItem("user_data", JSON.stringify(_localData)); return; }
  try {
    await ensureDoc();
    const capped = _localData.collection.slice(-500);
    await updateDoc(userRef(), { collection: capped });
  } catch(e) { console.warn("[Re:Anime] addToCollection:", e); }
}

async function getCollection() {
  await _readyPromise;
  return _localData.collection || [];
}

async function setFeatured(charData) {
  await _readyPromise;
  _localData.featured = charData || null;
  window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
  if (!discordUser) { localStorage.setItem("user_data", JSON.stringify(_localData)); return; }
  try { await ensureDoc(); await updateDoc(userRef(), { featured: charData || null }); }
  catch(e) { console.warn("[Re:Anime] setFeatured:", e); }
}

async function getFeaturedChar() {
  await _readyPromise;
  return _localData.featured || null;
}

async function likeProfile(targetUserId) {
  await _readyPromise;
  if (!discordUser) return 'not_logged_in';
  if (discordUser.id === targetUserId) return 'self';
  const today = new Date().toISOString().slice(0, 10);
  const given = _localData.likesGiven || {};
  if (given[targetUserId] === today) return 'already_today';
  given[targetUserId] = today;
  _localData.likesGiven = given;
  try { await ensureDoc(); await updateDoc(userRef(), { [`likesGiven.${targetUserId}`]: today }); }
  catch(e) { console.warn('[Re:Anime] likeProfile (own doc):', e); }
  try {
    const commitUrl = `https://firestore.googleapis.com/v1/projects/reanime-1a781/databases/(default)/documents:commit?key=AIzaSyDjVVsA-22tvlsUbbDenoS_vWlWLNY-HsU`;
    await fetch(commitUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: [{ transform: { document: `projects/reanime-1a781/databases/(default)/documents/users/${targetUserId}`, fieldTransforms: [{ fieldPath: 'likes', increment: { integerValue: 1 } }] } }] })
    });
  } catch(e) { console.warn('[Re:Anime] likeProfile (target increment):', e); }
  return 'ok';
}

async function hasLikedToday(targetUserId) {
  await _readyPromise;
  if (!discordUser) return false;
  const today = new Date().toISOString().slice(0, 10);
  return (_localData.likesGiven || {})[targetUserId] === today;
}

async function setPvpTeam(type, team) {
  await _readyPromise;
  const field = type === 'attack' ? 'pvpAttack' : 'pvpDefense';
  _localData[field] = team;
  window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
  if (!discordUser) { localStorage.setItem("user_data", JSON.stringify(_localData)); return; }
  try { await ensureDoc(); await updateDoc(userRef(), { [field]: team }); }
  catch(e) { console.warn("[Re:Anime] setPvpTeam:", e); }
}

async function getPvpTeams() {
  await _readyPromise;
  return { attack: _localData.pvpAttack || [], defense: _localData.pvpDefense || [] };
}

async function setDisplayName(name) {
  await _readyPromise;
  const clean = (name || '').trim().slice(0, 32);
  _localData.displayName = clean;
  window.dispatchEvent(new CustomEvent("reanimdb:update", { detail: _localData }));
  if (!discordUser) { localStorage.setItem("user_data", JSON.stringify(_localData)); return; }
  try { await ensureDoc(); await updateDoc(userRef(), { displayName: clean }); }
  catch(e) { console.warn("[Re:Anime] setDisplayName:", e); }
}

async function registerPvpPlayer() {
  if (!discordUser) return;
  try {
    const commitUrl = `https://firestore.googleapis.com/v1/projects/reanime-1a781/databases/(default)/documents:commit?key=AIzaSyDjVVsA-22tvlsUbbDenoS_vWlWLNY-HsU`;
    await fetch(commitUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: [{ transform: { document: 'projects/reanime-1a781/databases/(default)/documents/pvp/registry', fieldTransforms: [{ fieldPath: 'players', appendMissingElements: { values: [{ stringValue: discordUser.id }] } }] } }] })
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

async function recordDefenseWin(targetUserId) {
  try {
    const commitUrl = `https://firestore.googleapis.com/v1/projects/reanime-1a781/databases/(default)/documents:commit?key=AIzaSyDjVVsA-22tvlsUbbDenoS_vWlWLNY-HsU`;
    await fetch(commitUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: [{ transform: { document: `projects/reanime-1a781/databases/(default)/documents/users/${targetUserId}`, fieldTransforms: [{ fieldPath: 'conquest', increment: { integerValue: 10 } }] } }] })
    });
  } catch(e) { console.warn("[Re:Anime] recordDefenseWin:", e); }
}

/* ── SISTEMA DE MEJORAS ── */

async function getUpgrades() {
  await _readyPromise;
  return _localData.upgrades || {};
}

async function getCharUpgrade(name) {
  await _readyPromise;
  return (_localData.upgrades || {})[name] || { level: 1, unlockedSkins: [0], selectedPassive: null, selectedSkin: 0 };
}

async function upgradeChar(name) {
  await _readyPromise;
  const MAX_LEVEL = 10;
  const coll = _localData.collection || [];
  const copies = coll.filter(c => c.name === name);
  if (copies.length < 2) return { ok: false, error: 'Necesitas al menos 1 duplicado para mejorar.' };

  const upgrades = { ...(_localData.upgrades || {}) };
  const cur = upgrades[name] || { level: 1, unlockedSkins: [], selectedPassive: null, selectedSkin: -1 };
  if (cur.level >= MAX_LEVEL) return { ok: false, error: 'Ya está en nivel máximo (10).' };

  // Consume 1 duplicado (mantiene 1 copia base)
  const newColl = [...coll];
  const dupIdx = newColl.slice(1).findIndex(c => c.name === name);
  if (dupIdx !== -1) newColl.splice(dupIdx + 1, 1);
  else {
    const lastIdx = [...newColl].reverse().findIndex(c => c.name === name);
    if (lastIdx !== -1) newColl.splice(newColl.length - 1 - lastIdx, 1);
  }

  const newLevel = cur.level + 1;
  const skins = [...(cur.unlockedSkins || [])];
  // Unlock a skin every 2 levels (level 2 → skin 0, level 4 → skin 1, etc.)
  const newSkinIdx = Math.floor((newLevel) / 2) - 1; // level 2→0, 4→1, 6→2...
  if (newSkinIdx >= 0 && !skins.includes(newSkinIdx)) skins.push(newSkinIdx);

  // Keep selectedSkin as-is — don't auto-switch
  upgrades[name] = { ...cur, level: newLevel, unlockedSkins: skins };
  _localData.upgrades   = upgrades;
  _localData.collection = newColl;
  window.dispatchEvent(new CustomEvent('reanimdb:update', { detail: _localData }));

  if (!discordUser) { localStorage.setItem("user_data", JSON.stringify(_localData)); }
  else {
    try {
      await ensureDoc();
      await updateDoc(userRef(), { upgrades, collection: newColl.slice(-500) });
    } catch(e) { console.warn("[Re:Anime] upgradeChar:", e); }
  }
  return { ok: true, newLevel, unlockedSkins: skins };
}

async function setActivePassive(name, passiveId) {
  await _readyPromise;
  const upgrades = { ...(_localData.upgrades || {}) };
  const cur = upgrades[name] || { level: 1, unlockedSkins: [], selectedPassive: null, selectedSkin: -1 };
  upgrades[name] = { ...cur, selectedPassive: passiveId };
  _localData.upgrades = upgrades;
  if (!discordUser) { localStorage.setItem("user_data", JSON.stringify(_localData)); }
  else { try { await ensureDoc(); await updateDoc(userRef(), { upgrades }); } catch(e) {} }
  return { ok: true };
}

async function setActiveSkin(name, skinIdx) {
  await _readyPromise;
  const upgrades = { ...(_localData.upgrades || {}) };
  const cur = upgrades[name] || { level: 1, unlockedSkins: [], selectedPassive: null, selectedSkin: -1 };
  // -1 = default (always allowed), otherwise check unlocked
  if (skinIdx !== -1 && !(cur.unlockedSkins || []).includes(skinIdx)) return { ok: false, error: 'Skin no desbloqueada.' };
  upgrades[name] = { ...cur, selectedSkin: skinIdx };
  _localData.upgrades = upgrades;
  if (!discordUser) { localStorage.setItem("user_data", JSON.stringify(_localData)); }
  else { try { await ensureDoc(); await updateDoc(userRef(), { upgrades }); } catch(e) {} }
  return { ok: true };
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
  recordDefenseWin,
  getUpgrades,
  getCharUpgrade,
  upgradeChar,
  setActivePassive,
  setActiveSkin
};