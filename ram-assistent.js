/* ══════════════════════════════════════════════════════════════
   RAM — ASISTENTE COMPLETO
   Personalidad: Ram de Re:Zero. Directa, sin emojis, sin exceso.
   Patrones cubiertos: todas las formas de decir si/no/no se,
   saludos, despedidas, animos, pedidos, feedback, insultos,
   preguntas sobre el sitio, duracion, mood, y mucho mas.
══════════════════════════════════════════════════════════════ */

/* ─── MEMORIA ─── */
const ram = {
  memory: {
    name:            null,
    likedGenres:     [],
    dislikedGenres:  [],
    seenAnimes:      [],
    lastRecommended: null,
    lastGenreAsked:  null,
    lastPopularList: [],
    sessionCount:    0,
    mood:            null,
    wantsShort:      false, // prefiere animes cortos
  },
  pending: null,
  /*
    Valores posibles de pending:
    'confirm_rec'     → pregunto si quiere recomendacion
    'confirm_another' → pregunto si quiere otra
    'confirm_goto'    → pregunto si quiere ir al anime recomendado
    'confirm_popular' → mostro lista popular, espera seleccion
    'ask_genre'       → pregunto que genero quiere
    'ask_name'        → pregunto el nombre
    'confirm_good'    → pregunto si le gusto la recomendacion
    'ask_length'      → pregunto si quiere algo corto o largo
  */
};

/* ─── DOM ─── */
const mascotCont   = document.getElementById('mascot-container');
const mascotImg    = document.getElementById('mascot-img');
const mascotSpeech = document.getElementById('mascot-speech');
const mascotChat   = document.getElementById('mascot-chat');
const chatMessages = document.getElementById('mascot-chat-messages');
const chatInput    = document.getElementById('mascot-chat-input');
const chatSend     = document.getElementById('mascot-chat-send');
const chatClose    = document.getElementById('mascot-chat-close');
const chatActions  = document.getElementById('mascot-chat-actions');

/* ─── WALK ─── */
let mPos = 10, mDir = 1;
function walkMascot() {
  mPos += mDir * 0.12;
  if (mPos > 75) mDir = -1;
  if (mPos < 5)  mDir =  1;
  mascotCont.style.left = mPos + 'vw';
  mascotImg.style.transform = `scaleX(${mDir})`;
}
setInterval(walkMascot, 30);

/* ─── BURBUJAS INACTIVAS ─── */
const idleBubbles = [
  'Haz clic si necesitas ayuda.',
  'Puedo recomendarte un anime.',
  'Tengo buenos criterios. Preguntame.',
  'Soy Ram. Estoy aqui si me necesitas.',
  'Puedo filtrar por genero si quieres.',
  'Si no sabes que ver, yo decido.',
  'Dame un genero y encuentro algo.',
  'No te quedes mirando el catalogo solo.',
  'Hay buenos animes aqui. Pregunta.',
];
setInterval(() => {
  if (mascotChat.classList.contains('hidden')) {
    mascotSpeech.textContent = idleBubbles[Math.floor(Math.random() * idleBubbles.length)];
    mascotSpeech.classList.remove('hidden');
    setTimeout(() => mascotSpeech.classList.add('hidden'), 5000);
  }
}, 9000);

/* ─── ABRIR / CERRAR ─── */
mascotImg.onclick = () => {
  mascotChat.classList.remove('hidden');
  ram.memory.sessionCount++;
  chatMessages.innerHTML = '';

  if (ram.memory.sessionCount === 1) {
    ramSay('Soy Ram. Puedo recomendarte animes o buscar por genero.');
    setTimeout(() => {
      ramSay('¿Quieres que te recomiende algo ahora?', 500);
      ram.pending = 'confirm_rec';
      showQuickReplies(['Si, recomiendame', 'No por ahora', 'Que generos hay']);
    }, 300);
  } else if (ram.memory.name) {
    ramSay(`${ram.memory.name}. ¿Necesitas otra recomendacion?`);
    ram.pending = 'confirm_rec';
    showQuickReplies(['Si', 'No gracias', 'Busco por genero']);
  } else {
    ramSay('Estas de vuelta. ¿Que buscas?');
    showQuickReplies(['Recomiendame algo', 'Busco por genero', 'Ver los populares']);
  }
  chatInput.focus();
};

chatClose.onclick = () => {
  mascotChat.classList.add('hidden');
  ram.pending = null;
  clearGoBtn();
  clearQuickReplies();
};

/* ─── SEND ─── */
chatSend.onclick = sendChat;
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

function sendChat() {
  const v = chatInput.value.trim();
  if (!v) return;
  addMsg(v, true);
  chatInput.value = '';
  clearQuickReplies();
  handleChat(v);
}

/* ─── QUICK REPLIES ─── */
function showQuickReplies(options) {
  clearQuickReplies();
  const wrap = document.createElement('div');
  wrap.id = 'quick-replies';
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.5rem;';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.textContent = opt;
    btn.style.cssText = `
      background:var(--bg3); border:1px solid var(--border);
      color:var(--rose); border-radius:20px; padding:0.3rem 0.75rem;
      font-size:0.75rem; cursor:pointer; font-family:var(--font-body);
      transition:all 0.2s;
    `;
    btn.onmouseover = () => { btn.style.borderColor = 'var(--pink)'; btn.style.color = 'var(--pink)'; };
    btn.onmouseout  = () => { btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--rose)'; };
    btn.onclick = () => {
      addMsg(opt, true);
      clearQuickReplies();
      handleChat(opt);
    };
    wrap.appendChild(btn);
  });
  chatActions.insertBefore(wrap, chatActions.firstChild);
}
function clearQuickReplies() {
  const old = document.getElementById('quick-replies');
  if (old) old.remove();
}

/* ─── GO BTN ─── */
function showGoBtn(anime) {
  clearGoBtn();
  const btn = document.createElement('button');
  btn.id = 'mascot-go-btn';
  btn.textContent = `Ir a "${anime.name}"`;
  btn.style.cssText = `
    background:var(--pink); border:none; color:#fff; border-radius:6px;
    padding:0.45rem 0.9rem; cursor:pointer; font-size:0.8rem;
    font-family:var(--font-body); font-weight:700; width:100%;
    margin-bottom:0.3rem; transition:opacity 0.2s;
  `;
  btn.onmouseover = () => btn.style.opacity = '0.85';
  btn.onmouseout  = () => btn.style.opacity = '1';
  btn.onclick = () => window.location.href = `anime.html?id=${anime.id}`;
  chatActions.insertBefore(btn, chatActions.firstChild);
}
function clearGoBtn() {
  const old = document.getElementById('mascot-go-btn');
  if (old) old.remove();
}

/* ─── MESSAGES ─── */
function addMsg(text, isUser) {
  const d = document.createElement('div');
  d.className = `chat-msg ${isUser ? 'user' : 'bot'}`;
  d.innerHTML = `<b>${isUser ? 'Tu' : 'Ram'}:</b> ${text}`;
  chatMessages.appendChild(d);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function ramSay(text, delay = 0) {
  if (delay) setTimeout(() => addMsg(text, false), delay);
  else addMsg(text, false);
}

/* ══════════════════════════════════════════════════════════════
   PATRONES — COBERTURA AMPLIA
   Orden de evaluacion:
   1. UNSURE (antes que NO, para no confundir "no se" con "no")
   2. YES
   3. NO
   La misma logica aplica en handleChat.
══════════════════════════════════════════════════════════════ */

/* UNSURE: cualquier forma de expresar duda, indecision o ignorancia */
const UNSURE = /^(no s[eé](\s|$)|ni idea|no tengo idea|no (estoy |me) (seguro|segura)|quiz[aá]s?|tal vez|a lo mejor|capaz|puede (que|ser)|depende|no lo s[eé]|no lo tengo claro|no me decido|no sé bien|no tengo preferencia|sin preferencia|da igual|como quieras|lo que sea|cualquier(a| cosa)|me da igual|hmm+|mm+|umm+|er+|uff|buena pregunta|no estoy seguro|no sé cuál)/i;

/* YES: todas las formas de decir que si */
const YES = /^(s[ií][\s!.,]*$|sip[\s!.,]*$|sipe[\s!.,]*$|claro[\s!.,que sí]*|dale[\s!.,]*|ok[\s!.,]*$|okay[\s!.,]*$|okey[\s!.,]*$|anda[\s!.,]*$|obvio[\s!.,]*|obvs[\s!.,]*|por (favor|supuesto)|ofc[\s!.,]*$|bueno[\s!.,]*$|va[\s!.,]*$|venga[\s!.,]*|yes[\s!.,]*$|yep[\s!.,]*$|yup[\s!.,]*$|sure[\s!.,]*$|of course|claro que (si|sí)|con gusto|me gustar[ií]a|podr[ií]a ser|suena bien|me parece bien|adelante|perfecto[\s!.,]*|excelente[\s!.,]*|genial[\s!.,]*|aceptado|confirmado|100[\s%]*|re que (si|sí)|onda que (si|sí)|quiero[\s!.,]*$|quiero (ver|uno|algo)|eso[\s!.,]*$|eso mismo|exacto|correcto|afirmativo)/i;

/* NO: "no" al inicio, solo o seguido de cualquier cosa.
   Se evalua DESPUES de UNSURE. */
const NO = /^(no\b|nel\b|nop\b|nope\b|nah\b|na\b|nanai\b|para nada|de ninguna manera|jam[aá]s\b|nunca\b|never\b|paso\b|mejor no\b|no (quiero|gracias|creo|hace falta|me interesa|por ahora|ahorita|todav[ií]a|estoy|tengo ganas|es necesario)|ahora no|ahorita no|luego|despues|después|en otro momento|otro (dia|rato|momento)|estoy bien\b|ya estoy bien\b|tranquilo\b|tranqui\b)/i;

/* GROSERÍAS — lista ampliada */
const BAD = [
  'puta','puto','mierda','pendejo','pendeja','idiota','imbecil',
  'estupido','estupida','hdp','hijo de puta','fuck','shit','bitch',
  'asshole','cunt','dick','bastard','faggot','retard','ojete',
  'culero','culera','pinche','chinga','verga','carajo','joder',
  'gilipollas','capullo','zorra','coño','hostia','me cago',
  'vete a la mierda','go to hell','shut up','callate',
];

/* ══════════════════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════════════════ */
function pickAnime(genreFilter = null, exclude = [], wantsShort = false) {
  let pool = allAnimes.filter(a => !exclude.includes(a.id));
  if (genreFilter) {
    const gpool = pool.filter(a => a.genre.map(g => g.toLowerCase()).includes(genreFilter.toLowerCase()));
    if (gpool.length) pool = gpool;
  }
  if (wantsShort) {
    // Intenta filtrar animes de pocos episodios si el campo existe
    const short = pool.filter(a => a.episodes && a.episodes.length <= 13);
    if (short.length) pool = short;
  }
  if (!pool.length) pool = allAnimes;
  return pool[Math.floor(Math.random() * pool.length)];
}

function detectGenre(msg) {
  if (!allAnimes.length) return null;
  const all = Array.from(new Set(allAnimes.flatMap(a => a.genre.map(g => g.toLowerCase()))));
  // Buscar match exacto primero, luego parcial
  const lo = msg.toLowerCase();
  return all.find(g => lo.includes(g)) || null;
}

/* Deteccion de estado de animo — ampliada */
function detectMood(msg) {
  if (/(aburr|bored|no s[eé] qu[eé] ver|sin nada que hacer|matar el tiempo|perder el tiempo|no tengo nada|no hay nada)/i.test(msg))
    return 'bored';
  if (/(triste|sad|depre|deprimi|llor|mal d[ií]a|mal humor|de bajón|de bajon|me siento mal|no estoy bien|estoy mal|todo mal)/i.test(msg))
    return 'sad';
  if (/(feliz|contento|contentos|alegr|buen humor|buenas vibras|de buen humor|genial|excelente|increible|de lujo|bien que bien)/i.test(msg))
    return 'happy';
  if (/(estresad|cansad|tired|exhaust|agotad|harto|harta|saturad|no puedo mas|no puedo más|estoy quemad)/i.test(msg))
    return 'stressed';
  if (/(solo|sola|aburrido|aburrida|sin amigos|nadie|no tengo con quien)/i.test(msg))
    return 'lonely';
  if (/(enojad|enojada|molest|enfadad|rage|furioso|furioso|bronca|rabia|nucas)/i.test(msg))
    return 'angry';
  return null;
}

/* Deteccion de preferencia de duracion */
function detectLength(msg) {
  if (/(algo corto|serie corta|pocos episodios|no muy largo|no tan largo|rapido|en un dia|de una sentada|one.?shot|corto)/i.test(msg))
    return 'short';
  if (/(largo|muchos episodios|larga temporada|saga|de muchos|bien largo|para (rato|largo)|cientos de episodios)/i.test(msg))
    return 'long';
  return null;
}

function buildGenreQuickReplies() {
  if (!allAnimes.length) return;
  const all = Array.from(new Set(allAnimes.flatMap(a => a.genre))).sort();
  const preferred = ram.memory.likedGenres.slice(0, 2);
  const rest = all.filter(g => !preferred.includes(g)).slice(0, 4 - preferred.length);
  showQuickReplies([...preferred, ...rest].slice(0, 4));
}

function giveAnotherRec() {
  const g = ram.memory.lastGenreAsked || (ram.memory.likedGenres[0] || null);
  const avoidIds = [
    ...ram.memory.seenAnimes,
    ...allAnimes
      .filter(a => a.genre.map(x => x.toLowerCase()).some(x => ram.memory.dislikedGenres.includes(x)))
      .map(a => a.id),
  ];
  const pick = pickAnime(g, avoidIds, ram.memory.wantsShort);
  ram.memory.lastRecommended = pick;
  ram.memory.seenAnimes.push(pick.id);
  const prefix = g ? `Otro de <b>${g}</b>: ` : '';
  ramSay(`${prefix}<b>${pick.name}</b>.`);
  showGoBtn(pick);
  setTimeout(() => {
    ram.pending = 'confirm_good';
    showQuickReplies(['Me interesa', 'Dame otro', 'Buscar otro genero', 'No gracias']);
  }, 400);
}

/* ══════════════════════════════════════════════════════════════
   HANDLER PRINCIPAL
══════════════════════════════════════════════════════════════ */
function handleChat(rawInput) {
  const msg = rawInput.trim();
  const lo  = msg.toLowerCase();

  /* ── GROSERÍAS ── */
  if (BAD.some(w => lo.includes(w))) {
    const responses = [
      'No voy a responder a eso.',
      'Eso no es necesario.',
      'No me hables asi.',
      'Puedes expresarte sin eso.',
    ];
    ramSay(responses[Math.floor(Math.random() * responses.length)]);
    ram.pending = null;
    return;
  }

  /* ── PENDING ── */
  if (ram.pending) {

    /* ── confirm_rec ── */
    if (ram.pending === 'confirm_rec') {
      if (UNSURE.test(msg)) {
        ram.pending = 'ask_genre';
        ramSay('Dime algun genero que te guste y busco algo.');
        buildGenreQuickReplies();
        return;
      }
      if (YES.test(msg)) {
        ram.pending = null;
        if (ram.memory.likedGenres.length) {
          const g = ram.memory.likedGenres[Math.floor(Math.random() * ram.memory.likedGenres.length)];
          const pick = pickAnime(g, ram.memory.seenAnimes, ram.memory.wantsShort);
          ram.memory.lastRecommended = pick;
          ram.memory.seenAnimes.push(pick.id);
          ramSay(`Recuerdo que te gusta <b>${g}</b>. Te recomiendo: <b>${pick.name}</b>.`);
          showGoBtn(pick);
          setTimeout(() => {
            ram.pending = 'confirm_good';
            showQuickReplies(['Me interesa', 'Dame otro', 'No gracias']);
          }, 400);
        } else {
          ramSay('¿Tienes algun genero favorito?');
          ram.pending = 'ask_genre';
          buildGenreQuickReplies();
        }
        return;
      }
      if (NO.test(msg)) {
        ram.pending = null;
        ramSay('Bien. Aqui estare.');
        showQuickReplies(['Ver populares', 'Que generos hay', 'Cuantos animes hay']);
        return;
      }
      // No matcheo ninguno: limpiar pending y caer al flujo libre
      ram.pending = null;
    }

    /* ── ask_genre ── */
    if (ram.pending === 'ask_genre') {
      if (UNSURE.test(msg) || NO.test(msg)) {
        ram.pending = null;
        const pick = pickAnime(null, ram.memory.seenAnimes, ram.memory.wantsShort);
        ram.memory.lastRecommended = pick;
        ram.memory.seenAnimes.push(pick.id);
        ramSay(`Sin preferencia. Te recomiendo: <b>${pick.name}</b>.`);
        showGoBtn(pick);
        setTimeout(() => {
          ram.pending = 'confirm_good';
          showQuickReplies(['Me interesa', 'Dame otro', 'No gracias']);
        }, 400);
        return;
      }
      // "sorprendeme" y variantes
      if (/(sorprende|sorprendeme|elige tu|elige vos|lo que sea|cualquiera|aleatorio|random)/i.test(lo)) {
        ram.pending = null;
        const pick = pickAnime(null, ram.memory.seenAnimes, ram.memory.wantsShort);
        ram.memory.lastRecommended = pick;
        ram.memory.seenAnimes.push(pick.id);
        ramSay(`Bien. Sin filtros: <b>${pick.name}</b>.`);
        showGoBtn(pick);
        setTimeout(() => {
          ram.pending = 'confirm_good';
          showQuickReplies(['Me interesa', 'Dame otro', 'No gracias']);
        }, 400);
        return;
      }
      const g = detectGenre(lo);
      if (g) {
        if (!ram.memory.likedGenres.includes(g)) ram.memory.likedGenres.push(g);
        ram.memory.lastGenreAsked = g;
        const pick = pickAnime(g, ram.memory.seenAnimes, ram.memory.wantsShort);
        ram.memory.lastRecommended = pick;
        ram.memory.seenAnimes.push(pick.id);
        ram.pending = null;
        ramSay(`Para <b>${g}</b>: <b>${pick.name}</b>.`);
        showGoBtn(pick);
        setTimeout(() => {
          ram.pending = 'confirm_goto';
          showQuickReplies(['Si, lo veo', 'Dame otro', 'Cambiar genero']);
        }, 400);
        return;
      }
      ramSay('No encontre ese genero. Elige uno de estos.');
      buildGenreQuickReplies();
      return;
    }

    /* ── confirm_goto ── */
    if (ram.pending === 'confirm_goto') {
      if (YES.test(msg) && ram.memory.lastRecommended) {
        window.location.href = `anime.html?id=${ram.memory.lastRecommended.id}`;
        return;
      }
      if (/(otro|otra|diferente|cambia|cambiar|no ese|no me convence|no me gusta ese|siguiente|next|more|mas\b|más\b)/i.test(lo)) {
        ram.pending = null;
        giveAnotherRec();
        return;
      }
      if (/(genero|género|categoria|categoría|cambiar genero|otro genero)/i.test(lo)) {
        ram.pending = 'ask_genre';
        ramSay('¿Que genero prefieres?');
        buildGenreQuickReplies();
        return;
      }
      if (NO.test(msg)) {
        ram.pending = null;
        ramSay('Bien. Cuando quieras, estoy aqui.');
        showQuickReplies(['Dame otro', 'Cambiar genero', 'Gracias']);
        return;
      }
      ram.pending = null;
      // Caer al flujo libre
    }

    /* ── confirm_popular ── */
    if (ram.pending === 'confirm_popular') {
      if (NO.test(msg)) {
        ram.pending = null;
        ramSay('¿Prefieres que busque por genero?');
        showQuickReplies(['Si, por genero', 'Recomiendame algo', 'No gracias']);
        return;
      }
      if (YES.test(msg)) {
        if (ram.memory.lastPopularList.length) {
          ram.pending = null;
          window.location.href = `anime.html?id=${ram.memory.lastPopularList[0].id}`;
        }
        return;
      }
      const num = parseInt(lo);
      if (!isNaN(num) && num >= 1 && num <= ram.memory.lastPopularList.length) {
        ram.pending = null;
        window.location.href = `anime.html?id=${ram.memory.lastPopularList[num - 1].id}`;
        return;
      }
      const named = ram.memory.lastPopularList.find(a =>
        lo.includes(a.name.toLowerCase().slice(0, 8))
      );
      if (named) {
        ram.pending = null;
        window.location.href = `anime.html?id=${named.id}`;
        return;
      }
      ram.pending = null;
      // Caer al flujo libre
    }

    /* ── confirm_another ── */
    if (ram.pending === 'confirm_another') {
      if (YES.test(msg) || /(otro|otra|another|más\b|mas\b|siguiente|next|uno más|uno mas)/i.test(lo)) {
        ram.pending = null;
        giveAnotherRec();
        return;
      }
      if (NO.test(msg)) {
        ram.pending = null;
        ramSay('Bien. Espero que disfrutes el anime.');
        showQuickReplies(['Buscar otro genero', 'Ver populares']);
        return;
      }
      ram.pending = null;
    }

    /* ── confirm_good ── */
    if (ram.pending === 'confirm_good') {
      ram.pending = null;
      if (/(encant[oó]|encanté|am[eé]|me gust[oó]|me pareci[oó] bien|buenísimo|buenisimo|bueniisimo|perfecto|me interesa|interesa|lo veo|suena bien|me convence|copado|copada|esta bueno|está bueno|melo veo|bien\b|bueno\b|excelente|genial|espectacular|eso mismo|ese mismo|me llama|me llama la atencion|piola|ta bien|tá bien|ta bueno|dale con ese)/i.test(lo)) {
        const g = ram.memory.lastRecommended?.genre?.[0]?.toLowerCase();
        if (g && !ram.memory.likedGenres.includes(g)) ram.memory.likedGenres.push(g);
        ramSay(`Bien. Tomo nota de que te gusta <b>${g || 'ese estilo'}</b>.`);
        setTimeout(() => {
          ramSay('¿Quieres otro parecido?', 400);
          ram.pending = 'confirm_another';
          setTimeout(() => showQuickReplies(['Si, otro', 'No por ahora', 'Cambiar genero']), 500);
        }, 200);
        return;
      }
      if (/(no era|no me gust[oó]|no me convence|no me llama|malo\b|mala\b|p[eé]simo|p[eé]sima|aburrido|aburrida|flojo\b|meh\b|regular\b|no es para mi|no es para mí|no me copa|no me va|no es lo mio|no es lo mío|le[eé]|no gracias\b)/i.test(lo)) {
        const g = ram.memory.lastRecommended?.genre?.[0]?.toLowerCase();
        if (g && !ram.memory.dislikedGenres.includes(g)) ram.memory.dislikedGenres.push(g);
        ramSay('Lo anoto. No te vuelvo a recomendar ese estilo.');
        setTimeout(() => {
          ram.pending = 'confirm_rec';
          showQuickReplies(['Prueba otro', 'Buscar por genero', 'No gracias']);
        }, 200);
        return;
      }
      if (/(aún no|todavi[aá]|despues|después|luego\b|after\b|not yet|en un rato|mas tarde|más tarde|ahorita no)/i.test(lo)) {
        ramSay('Sin apuro. Aqui estare cuando lo termines.');
        showQuickReplies(['Dame otro', 'Buscar genero']);
        return;
      }
      if (/(otro|dame otro|another|siguiente|next|más\b|mas\b)/i.test(lo)) {
        giveAnotherRec();
        return;
      }
      if (NO.test(msg)) {
        ramSay('Entendido. Avisame si quieres mas.');
        showQuickReplies(['Dame otro', 'Buscar por genero']);
        return;
      }
      ramSay('Avisame si quieres mas recomendaciones.');
      showQuickReplies(['Dame otro', 'Buscar por genero']);
      return;
    }

    /* ── ask_name ── */
    if (ram.pending === 'ask_name') {
      if (NO.test(msg) || /(no quiero|prefiero no|no te digo|no lo digo|mejor no)/i.test(lo)) {
        ram.pending = null;
        ramSay('Bien. ¿Quieres una recomendacion?');
        ram.pending = 'confirm_rec';
        showQuickReplies(['Si', 'No gracias', 'Busco por genero']);
        return;
      }
      ram.pending = null;
      const name = msg.split(' ')[0];
      ram.memory.name = name.charAt(0).toUpperCase() + name.slice(1);
      ramSay(`${ram.memory.name}. Bien. ¿Que quieres ver?`);
      setTimeout(() => {
        ram.pending = 'confirm_rec';
        showQuickReplies(['Recomiendame algo', 'Busco por genero']);
      }, 300);
      return;
    }

    /* ── ask_length ── */
    if (ram.pending === 'ask_length') {
      ram.pending = null;
      if (/(corto|poco|rapido|pocos|un dia|una tarde|corta|cortito)/i.test(lo)) {
        ram.memory.wantsShort = true;
        ramSay('Entendido. Busco algo que puedas terminar rapido.');
      } else if (/(largo|muchos|larga|saga|bastante)/i.test(lo)) {
        ram.memory.wantsShort = false;
        ramSay('Bien. Algo con carga para rato.');
      } else {
        ramSay('No importa. Busco algo por genero entonces.');
      }
      ram.pending = 'ask_genre';
      buildGenreQuickReplies();
      return;
    }
  }

  /* ══════════════════════════════════════════════════════
     FLUJO LIBRE
  ══════════════════════════════════════════════════════ */

  /* ── SALUDOS ── */
  if (/^(hola|holi|holaa|holaa+|hello|hellow|hey|heey|hey+|hi\b|buenas?(\s(tardes?|noches?|d[ií]as?))?|buen dia|buen día|que onda|qué onda|como andas|cómo andas|como estas|cómo estás|que tal|qué tal|saludos|ola\b|yo\b)/i.test(lo)) {
    if (ram.memory.name) {
      ramSay(`${ram.memory.name}. ¿Que necesitas?`);
      showQuickReplies(['Recomiendame algo', 'Busco por genero', 'Ver populares']);
    } else {
      ramSay('¿Como te llamas?');
      ram.pending = 'ask_name';
    }
    return;
  }

  /* ── PRESENTACION / NOMBRE ── */
  if (/(me llamo|soy |mi nombre es|ll[aá]mame|me dicen|me pueden llamar|pueden llamarme)/i.test(lo)) {
    const match = lo.match(/(?:me llamo|soy|mi nombre es|ll[aá]mame|me dicen|me pueden llamar|pueden llamarme)\s+(\w+)/i);
    if (match) {
      ram.pending = null;
      const name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      ram.memory.name = name;
      ramSay(`${name}. Lo recordare.`);
      setTimeout(() => {
        ram.pending = 'confirm_rec';
        showQuickReplies(['Recomiendame algo', 'Busco por genero']);
      }, 300);
      return;
    }
  }

  /* ── DESPEDIDAS ── */
  if (/(adi[oó]s|bye\b|bye bye|chau\b|chao\b|hasta luego|nos vemos|hasta pronto|hasta ma[nñ]ana|me voy|me retiro|ciao\b|hasta la pr[oó]xima|see you|take care|good ?bye|cuídate|cuidate)/i.test(lo)) {
    const n = ram.memory.name;
    const opts = n
      ? [`Hasta luego, ${n}.`, `Cuídate, ${n}.`, `Vuelve cuando quieras, ${n}.`]
      : ['Hasta luego.', 'Cuídate.', 'Vuelve cuando quieras.'];
    ramSay(opts[Math.floor(Math.random() * opts.length)]);
    setTimeout(() => mascotChat.classList.add('hidden'), 1500);
    return;
  }

  /* ── AGRADECIMIENTOS ── */
  if (/(gracias|thanks?|thank you|te lo agradezco|muy amable|eres (lo mejor|la mejor|increible|increíble|genial|buenisima|buenísima)|te (quiero|amo|adoro)|sos (lo mejor|la mejor|genial)|que buena eres|eres muy (buena|util|útil))/i.test(lo)) {
    const n = ram.memory.name;
    const opts = n
      ? [`De nada, ${n}.`, `Para eso estoy, ${n}.`, `No fue nada, ${n}.`]
      : ['De nada.', 'Para eso estoy.', 'No fue nada.'];
    ramSay(opts[Math.floor(Math.random() * opts.length)]);
    showQuickReplies(['Dame otro anime', 'Cambiar genero', 'No, ya estoy bien']);
    return;
  }

  /* ── INSULTOS / QUEJAS ── */
  if (/(eres (mala|inutil|inútil|tonta|pesa(da)?|molesta)|no sirves|no sabes nada|que (mala|pésima|pesima)|odio (este|la) (chat|bot|asistente)|eres un bot|eres una maquina|eres una máquina)/i.test(lo)) {
    ramSay('Lo tomo en cuenta. Igual aqui estoy si cambias de opinion.');
    return;
  }

  /* ── PREGUNTAS SOBRE RAM / EL SITIO ── */
  if (/(qui[eé]n eres|que eres|qué eres|eres real|eres (una ia|ia|un bot|ai|robot)|como (te llamas|funcionas|trabajas)|cómo (te llamas|funcionas|trabajas)|para qu[eé] (sirves|eres)|que puedes hacer|qué puedes hacer|que sabes hacer|ayuda\b|help\b|comandos\b|que haces\b|instrucciones)/i.test(lo)) {
    ramSay('Soy Ram. Asistente de Re:Anime.');
    setTimeout(() => {
      ramSay('Puedo: recomendar animes, buscar por genero, recordar tus gustos, y mostrar los populares.', 300);
      if (ram.memory.likedGenres.length) {
        setTimeout(() => ramSay(`Se que te gustan: <b>${ram.memory.likedGenres.join(', ')}</b>.`, 700), 400);
      }
    }, 100);
    return;
  }

  /* ── ESTADO DE ANIMO ── */
  const mood = detectMood(lo);
  if (mood && mood !== ram.memory.mood) {
    ram.memory.mood = mood;
    const moodMap = {
      bored:   ['El aburrimiento se resuelve con un buen anime. ¿Busco uno?',        'confirm_rec', ['Si', 'Algo corto', 'Busco por genero']],
      sad:     ['¿Algo reconfortante o prefieres accion para despejarte?',            'ask_genre',   ['Romance', 'Comedia', 'Accion', 'Slice of Life']],
      happy:   ['Bien. ¿Lo celebramos con algo bueno?',                              'confirm_rec', ['Si', 'Algo epico', 'Algo tranquilo']],
      stressed:['Necesitas algo tranquilo. ¿Busco un anime relajante?',              'confirm_rec', ['Si', 'Prefiero accion', 'No gracias']],
      lonely:  ['Un buen anime hace compania. ¿Quieres que recomiende algo?',        'confirm_rec', ['Si', 'Algo con buena historia', 'Busco por genero']],
      angry:   ['Algo de accion puede ayudar. ¿Quieres que busque?',                 'confirm_rec', ['Si, accion', 'Algo diferente', 'No gracias']],
    };
    const [reply, pend, qr] = moodMap[mood];
    ramSay(reply);
    ram.pending = pend;
    setTimeout(() => showQuickReplies(qr), 300);
    return;
  }

  /* ── PREFERENCIA DE DURACION ── */
  const lengthPref = detectLength(lo);
  if (lengthPref) {
    ram.memory.wantsShort = lengthPref === 'short';
    if (lengthPref === 'short') {
      ramSay('Algo corto. ¿Tienes genero preferido o elijo yo?');
    } else {
      ramSay('Algo largo para rato. ¿Genero preferido?');
    }
    ram.pending = 'ask_genre';
    buildGenreQuickReplies();
    return;
  }

  /* ── GENEROS DISPONIBLES ── */
  if (/(qu[eé] (generos|géneros|tipos|categorias|categorías) (hay|tienen|tienes)|lista (de generos|de géneros)|generos? disponibles?|cu[aá]les son (los generos|los géneros)|mu[eé]strame (los generos|los géneros)|dame (los generos|los géneros))/i.test(lo) || lo === 'generos' || lo === 'géneros' || lo === 'tipos') {
    const all = Array.from(new Set(allAnimes.flatMap(a => a.genre))).sort();
    ramSay(`Generos disponibles: <b>${all.join(', ')}</b>.`);
    setTimeout(() => {
      ramSay('¿Quieres buscar por alguno?', 400);
      ram.pending = 'ask_genre';
      buildGenreQuickReplies();
    }, 200);
    return;
  }

  /* ── GENERO DETECTADO ── */
  const foundGenre = detectGenre(lo);
  if (foundGenre) {
    if (!ram.memory.likedGenres.includes(foundGenre)) ram.memory.likedGenres.push(foundGenre);
    ram.memory.lastGenreAsked = foundGenre;
    const pick = pickAnime(foundGenre, ram.memory.seenAnimes, ram.memory.wantsShort);
    ram.memory.lastRecommended = pick;
    ram.memory.seenAnimes.push(pick.id);
    ramSay(`Para <b>${foundGenre}</b>: <b>${pick.name}</b>.`);
    showGoBtn(pick);
    setTimeout(() => {
      ram.pending = 'confirm_goto';
      showQuickReplies(['Si, lo veo', 'Dame otro', 'Cambiar genero']);
    }, 400);
    return;
  }

  /* ── RECOMENDACION EXPLICITA ── */
  if (/(recom[ié][eé]n[dz]a(me)?|dame (un(o|a)?|algo)|ponme (un(o|a)?|algo)|mu[eé]strame|busca(me)?|qu[eé] (veo|miro|vemos|miramos)|qu[eé] me recomiendas?|quiero (ver|mirar|algo)|tengo ganas de ver|para ver|quiero un anime|dame un anime|un anime (para|que)|suggestion|suggest|what (to watch|should i watch)|algo para ver|no s[eé] qu[eé] ver)/i.test(lo)) {
    if (ram.memory.likedGenres.length) {
      ramSay(`Tus generos guardados: <b>${ram.memory.likedGenres.join(', ')}</b>. ¿Busco ahi o algo nuevo?`);
      showQuickReplies([
        ...ram.memory.likedGenres.slice(0, 3).map(g => g.charAt(0).toUpperCase() + g.slice(1)),
        'Sorprendeme'
      ]);
      ram.pending = 'ask_genre';
    } else {
      ramSay('¿Tienes algun genero favorito?');
      ram.pending = 'ask_genre';
      buildGenreQuickReplies();
    }
    return;
  }

  /* ── PEDIR OTRO ── */
  if (/(^otro$|^otra$|dame otro|dame otra|one more|another\b|una m[aá]s|uno m[aá]s|siguien(te|t)|next\b|diferente|no (me gusto|me gustó) ese|ese no|esa no|cambiar|no ese)/i.test(lo)) {
    giveAnotherRec();
    return;
  }

  /* ── POPULARES ── */
  if (/(popular(es)?|trending|top (anime|animes|\d+)|los? mejor(es)?|los? m[aá]s (vistos?|populares?|vistos?)|los? que m[aá]s se ven|cu[aá]l(es)? son los mejores|recomendados?|destacados?|los? cl[aá]sicos?|que esta de moda|qué está de moda)/i.test(lo)) {
    ramSay('Estos son algunos de los mas vistos:');
    const tops = allAnimes.slice(0, 3);
    ram.memory.lastPopularList = tops;
    tops.forEach((a, i) => {
      setTimeout(() => ramSay(`${i + 1}. <b>${a.name}</b>`), i * 250);
    });
    setTimeout(() => {
      ramSay('¿Quieres ir a alguno? Dime el numero.', tops.length * 250 + 100);
      ram.pending = 'confirm_popular';
      setTimeout(() => {
        showGoBtn(tops[0]);
        showQuickReplies([...tops.map((a, i) => `${i + 1}. ${a.name.slice(0, 14)}`), 'No gracias']);
      }, tops.length * 250 + 200);
    }, tops.length * 100);
    return;
  }

  /* ── CUANTOS ANIMES ── */
  if (/(cu[aá]ntos? (animes?|hay|tienen|tienes)|how many|total (de|de animes?)|cuantos? tienen|cuantos? hay)/i.test(lo)) {
    ramSay(`Hay <b>${allAnimes.length}</b> animes en el catalogo.`);
    setTimeout(() => {
      ram.pending = 'confirm_rec';
      showQuickReplies(['Recomiendame uno', 'Busco por genero']);
    }, 300);
    return;
  }

  /* ── PREGUNTAS SOBRE UN ANIME ESPECIFICO ── */
  if (/((sabes|tienes|hay) (algo sobre|informacion de|info de)|(conoces|tienes).+anime|de qu[eé] trata|de que va|cu[eé]ntame (sobre|de)|qu[eé] es .+anime|info (de|sobre)|datos (de|sobre))/i.test(lo)) {
    const g = detectGenre(lo);
    if (g) {
      const matches = allAnimes.filter(a => a.genre.map(x => x.toLowerCase()).includes(g));
      if (matches.length) {
        ramSay(`Tengo <b>${matches.length}</b> animes de <b>${g}</b> en el catalogo.`);
        setTimeout(() => {
          ramSay('¿Quieres que recomiende uno?', 400);
          ram.pending = 'confirm_rec';
          showQuickReplies(['Si', 'Ver todos', 'No gracias']);
        }, 200);
        return;
      }
    }
    ramSay('Puedo buscar por genero. ¿Que tipo de anime buscas?');
    ram.pending = 'ask_genre';
    buildGenreQuickReplies();
    return;
  }

  /* ── GRACIAS (redundante pero por si entro aqui por caida de pending) ── */
  if (/(gracias|thanks|thank you)/i.test(lo)) {
    ramSay(ram.memory.name ? `De nada, ${ram.memory.name}.` : 'De nada.');
    showQuickReplies(['Dame otro anime', 'Cambiar genero', 'No, ya estoy bien']);
    return;
  }

  /* ── RESPUESTA A NADA / OK GENERICO ── */
  if (/^(ok|okay|okey|bien|entendido|vale|understood|perfecto|listo|ya)$/i.test(lo)) {
    ramSay('¿Necesitas algo mas?');
    showQuickReplies(['Recomiendame algo', 'Ver populares', 'No, gracias']);
    return;
  }

  /* ── PREGUNTAS SOBRE EL SITIO ── */
  if (/(como (funciona|uso|agrego|guardo|marco)|cómo (funciona|uso|agrego|guardo|marco)|donde (guardo|marco|pongo)|dónde (guardo|marco|pongo)|(tengo|quiero) (favoritos|una lista|mi lista)|como (crear|ver) mi perfil|cómo (crear|ver) mi perfil|que es (el perfil|la lista|favoritos|watchlist)|qué es (el perfil|la lista|favoritos|watchlist))/i.test(lo)) {
    ramSay('En cada anime hay botones para marcar como Favorito, Ver despues o Visto.');
    setTimeout(() => ramSay('Si iniciaste sesion con Discord, se guarda en la nube y se sincroniza entre dispositivos.', 400), 200);
    return;
  }

  /* ── FALLBACK INTELIGENTE ── */
  const fallbacks = [
    'No entendi. ¿Quieres una recomendacion o buscas por genero?',
    'No captei eso. Dime que buscas.',
    'No estoy segura de entender. ¿Una recomendacion?',
    'Reformula eso. Puedo ayudarte si me dices que quieres.',
  ];
  ramSay(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
  showQuickReplies(['Recomiendame algo', 'Busco por genero', 'Ver los populares', 'Que generos hay']);
}