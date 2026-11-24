// Gemeinsam für das Word-Aufgabenfenster und die Verbindung zur Klara-App.
// WP-UX-WOW-1 U1 (Word): Klartext statt Markdown — dieselbe Subset-Logik wie die Konsole,
// aber als STRIP (Ueberschriften-/Fett-/Kursiv-Marker raus, Listenpunkte als "- "-Zeilen).
function stripAskAnswerMarkdown(answer) {
  const lines = answer.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i].trim();
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading && heading[1] !== undefined) {
      line = heading[1].trim();
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet && bullet[1] !== undefined) {
      line = `- ${bullet[1]}`;
    }
    out.push(line.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*\n]+)\*/g, "$1"));
  }
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// R-0310 (Spiegel von wordAddin.ts#askAbsaetzeLesen): die Absatz-Beleg-Zuordnung des Servers.
// Fehlt das Feld → undefined (alter Server, keine Aussage). Sonst NUR Absaetze mit mindestens einer
// TRAGENDEN Quelle (`cited`), Marken `[n]` und Markdown entfernt; unbelegte fallen weg.
function askAbsaetzeLesen(body, cited) {
  if (!body || !Array.isArray(body.absaetze)) {
    return undefined;
  }
  const tragend = Array.isArray(cited) ? cited : [];
  const out = [];
  for (let i = 0; i < body.absaetze.length; i += 1) {
    const a = body.absaetze[i] || {};
    const q = Array.isArray(a.quellen)
      ? a.quellen.filter((id) => typeof id === "string" && tragend.indexOf(id) !== -1)
      : [];
    const text =
      typeof a.text === "string"
        ? stripAskAnswerMarkdown(a.text.replace(/\s*\[[0-9\s,]+\]/g, ""))
        : "";
    if (q.length > 0 && text.length > 0) {
      out.push({ text: text, quellen: q });
    }
  }
  return out;
}

// Ohne Modellurteil kennzeichnen wir nur eindeutige Prüfaufträge als offenen Vergleich.
// Eine beliebige Sachfrage oder eine Störung bleibt in ihrem eigenen Antwortweg.
function askPrueftAussage(frage) {
  const text = frage
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "")
    .replace(/\s+/g, " ");
  const en = text
    .replace(/^(?:can|could|would) you (?:please )?(?:check|verify|tell me) (?:whether|if) /, "")
    .replace(/\b(?:this|that) (?:statement|sentence|passage|paragraph|wording)\b/g, "this")
    .replace(/ (?:according to|based on|under|against|with) .+$/, "");
  if (
    /^(?:(?:is|was) (?:this|that|it)|(?:this|that|it) (?:is|was)) (?:correct|right|true|accurate|consistent)$/.test(
      en,
    ) ||
    /^(?:please )?(?:verify|check) (?:this|that)$/.test(en) ||
    /^(?:does|would) (?:this|that|it)(?: (?:statement|sentence|passage|paragraph))? (?:comply with|contradict|match) .+$/.test(
      text,
    )
  )
    return true;
  const de = text
    .replace(/\b(?:dieser (?:absatz|satz)|diese (?:passage|aussage|formulierung))\b/g, "das")
    .replace(/ (?:laut|gemäß|nach|anhand) .+$/, "");
  if (
    /^(?:ist|war) (?:das|dies) (?:so )?(?:richtig|korrekt|wahr|zutreffend)$/.test(de) ||
    /^(?:stimmt|passt) (?:das|dies)(?: so)?$/.test(de) ||
    /^(?:bitte )?(?:prüfe|überprüfe) (?:das|dies)$/.test(de)
  )
    return true;
  const nl = text
    .replace(/\bdeze (?:uitspraak|zin|alinea)\b/g, "dit")
    .replace(/ (?:volgens|op basis van|gezien) .+$/, "");
  return (
    /^(?:is|was) (?:dit|dat) (?:juist|correct|goed|waar)$/.test(nl) ||
    /^(?:klopt|controleer) (?:dit|dat)$/.test(nl)
  );
}

function askVergleichToken(text) {
  // Satzzeichen im Satz gehören mit zum Wortlaut (etwa 1.5, 15 %, < oder >).
  // Ein abschließender Punkt darf bei einer Word-Markierung außerhalb liegen.
  const tokens = Array.from(text.matchAll(/[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*|[^\s]/gu));
  if (tokens.length && tokens[tokens.length - 1][0] === ".") tokens.pop();
  return tokens;
}

function askVergleichSpanne(tokens, von, bis) {
  const letztes = tokens[bis - 1];
  return { start: tokens[von].index, end: letztes.index + letztes[0].length };
}

function askVergleichMarken(vergleich) {
  const dokument = askVergleichToken(vergleich.dokument);
  const beleg = askVergleichToken(vergleich.belege[0].text);
  if (!dokument.length || !beleg.length) return;
  let vorn = 0;
  while (vorn < dokument.length && vorn < beleg.length && dokument[vorn][0] === beleg[vorn][0])
    vorn++;
  if (vergleich.art === "bestaetigt") {
    if (vorn === dokument.length && vorn === beleg.length) {
      vergleich.dokumentMarke = askVergleichSpanne(dokument, 0, dokument.length);
      vergleich.belegMarke = askVergleichSpanne(beleg, 0, beleg.length);
    }
    return;
  }
  let dEnde = dokument.length;
  let bEnde = beleg.length;
  while (dEnde > vorn && bEnde > vorn && dokument[dEnde - 1][0] === beleg[bEnde - 1][0]) {
    dEnde--;
    bEnde--;
  }
  const geaendert = Math.max(dEnde - vorn, bEnde - vorn);
  // Nur EINE enge Stelle in sonst übereinstimmendem Wortlaut auszeichnen.
  // Keine herausgegriffenen Einzelwörter in Übersetzungen oder Paraphrasen.
  const gemeinsam = vorn + dokument.length - dEnde;
  if (geaendert === 0 || geaendert > 3 || gemeinsam < 2 || gemeinsam < 2 * geaendert) return;
  // Bei „only only“ könnte das entfernte Wort an zwei Stellen liegen.
  if (dEnde === vorn && vorn && beleg[bEnde - 1][0] === beleg[vorn - 1][0]) return;
  if (bEnde === vorn && vorn && dokument[dEnde - 1][0] === dokument[vorn - 1][0]) return;
  function spanne(tokens, ende) {
    if (ende > vorn) return askVergleichSpanne(tokens, vorn, ende);
    // Ein Wort fehlt hier. Seine vorhandenen Nachbarn bilden die reale Fundstelle.
    return askVergleichSpanne(tokens, Math.max(0, vorn - 1), Math.min(tokens.length, vorn + 1));
  }
  vergleich.dokumentMarke = spanne(dokument, dEnde);
  vergleich.belegMarke = spanne(beleg, bEnde);
}

function askVergleichBeleg(absatz, schritte) {
  let original = null;
  if (absatz.quellen.length === 1) {
    // Nur in der zugeordneten Quelle lesen. Leerraum darf im Ask-Absatz
    // anders umbrochen sein; angezeigt und markiert wird der Originalausschnitt.
    const muster = absatz.text
      .split(/\s+/)
      .map((wort) => wort.replace(/[.*+?^$\x7b\x7d()|[\]\\]/g, "\\$&"))
      .join("\\s+");
    const wortlaut = new RegExp(
      `(?:^|[^\\p{L}\\p{M}\\p{N}_])(${muster})(?![\\p{L}\\p{M}\\p{N}_])`,
      "u",
    );
    for (let i = 0; i < schritte.length; i++) {
      const quelle = schritte[i];
      if (!quelle || quelle.sourceId !== absatz.quellen[0] || typeof quelle.snippet !== "string")
        continue;
      const fund = wortlaut.exec(quelle.snippet);
      if (fund) {
        original = fund[1];
        break;
      }
    }
  }
  return { text: original || absatz.text, quellen: absatz.quellen, woertlich: original !== null };
}

function askDirektvergleich(art, dokument, absaetze, schritte, einzeln) {
  const belege = absaetze.map((absatz) => askVergleichBeleg(absatz, schritte));
  const vergleich = {
    art: art,
    dokument: dokument,
    belege: belege,
    dokumentMarke: null,
    belegMarke: null,
  };
  if (einzeln && belege.length === 1 && belege[0].woertlich) askVergleichMarken(vergleich);
  return vergleich;
}

function askFragtNachWordAbsatz(frage) {
  const text = String(frage || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "")
    .trim();
  // Ein expliziter Verweis kann überall in einer Sachfrage stehen.
  if (
    /\b(?:this|that) (?:paragraph|passage|statement|sentence|wording|excerpt)\b/.test(text) ||
    /\bdiese(?:n|m|r|s)? (?:absatz|passage|aussage|satz|formulierung|text)\b/.test(text) ||
    /\b(?:deze|dit) (?:alinea|passage|zin|uitspraak|tekst)\b/.test(text)
  ) {
    return true;
  }

  // „Is it correct that …?“ hat einen eigenen Gegenstand. Bei einer kurzen
  // Verweisfrage sind dagegen Zusätze wie „according to our policy“ möglich.
  const en = text
    .replace(/^(?:can|could|would) you (?:please )?(?:check|verify|tell me) (?:if|whether) /, "")
    .replace(/ (?:according to|based on|in light of|under|against|given) .+$/, "");
  if (
    /^(?:(?:is|was) (?:this|that|it)|(?:this|that|it) (?:is|was)) (?:correct|right|true|accurate|consistent)$/.test(
      en,
    ) ||
    /^(?:does|would) (?:this|that|it) (?:match|comply with|contradict)\b/.test(en) ||
    /^(?:what does (?:this|that|it) mean|(?:please )?(?:check|verify|explain) (?:this|that))$/.test(
      en,
    )
  ) {
    return true;
  }

  const de = text.replace(/ (?:laut|gemäß|nach|anhand|mit blick auf) .+$/, "");
  if (
    /^(?:ist|war) (?:das|dies) (?:so )?(?:richtig|korrekt|wahr|zutreffend)$/.test(de) ||
    /^(?:stimmt|passt) (?:das|dies)(?: so)?$/.test(de) ||
    /^(?:was (?:bedeutet|heißt) das|(?:prüfe|erkläre) (?:das|dies))$/.test(de)
  ) {
    return true;
  }

  const nl = text.replace(/ (?:volgens|op basis van|gezien) .+$/, "");
  return (
    /^(?:is|was) (?:dit|dat) (?:juist|correct|goed|waar)$/.test(nl) ||
    /^klopt (?:dit|dat)$/.test(nl) ||
    /^(?:wat betekent (?:dit|dat)|(?:controleer|verklaar) (?:dit|dat))$/.test(nl)
  );
}

async function wordVergleichZeigen(word, bereich, text, stelle, gilt) {
  if (!gilt()) return false;
  let suchtext = null;
  if (stelle != null) {
    if (
      !Number.isInteger(stelle.start) ||
      !Number.isInteger(stelle.end) ||
      stelle.start < 0 ||
      stelle.end <= stelle.start ||
      stelle.end > text.length
    )
      return false;
    if (stelle.start !== 0 || stelle.end !== text.length)
      suchtext = text.slice(stelle.start, stelle.end);
  }
  try {
    return await word.run(bereich, async (context) => {
      bereich.load("text");
      let treffer;
      if (suchtext !== null) {
        // ^ leitet in der Word-Suche Sonderzeichen ein. Steuerzeichen/überlange Suchbegriffe
        // werden vom Host unterschiedlich behandelt; niemals ersatzweise im Dokument suchen.
        const literal = suchtext.replace(/\^/g, "^^");
        if (literal.length > 255 || /[\r\n\t]/.test(literal)) return false;
        treffer = bereich.search(literal, {
          matchCase: true,
          matchWildcards: false,
          ignorePunct: false,
          ignoreSpace: false,
        });
        treffer.load("items/text");
      }
      await context.sync();
      if (!gilt() || bereich.text.replace(/\r\n?/g, "\n").trim() !== text) return false;
      let ziel = bereich;
      if (treffer) {
        // Bei einem wiederholten Ausdruck ist der Offset im geprüften Text maßgeblich.
        const positionen = [];
        for (
          let pos = text.indexOf(suchtext);
          pos !== -1;
          pos = text.indexOf(suchtext, pos + suchtext.length)
        ) {
          positionen.push(pos);
        }
        const index = positionen.indexOf(stelle.start);
        if (
          treffer.items.length !== positionen.length ||
          !treffer.items[index] ||
          treffer.items.some((fund) => fund.text !== suchtext)
        )
          return false;
        ziel = treffer.items[index];
      }
      ziel.select();
      await context.sync();
      return true;
    });
  } catch (e) {
    return false;
  }
}

function askAbsatzAmCursor(context, auswahl, abgebrochen) {
  const absaetze = auswahl.paragraphs;
  absaetze.load("items/text");
  return context.sync().then(() => {
    if (abgebrochen()) {
      return "";
    }
    const absatz = absaetze.items.length === 1 ? absaetze.items[0] : null;
    if (!absatz) {
      return { hinweis: "askAbsatzFehlt" };
    }
    if (absatz.text.trim()) {
      return { text: absatz.text, bezug: "cursor", absatz: absatz };
    }
    // Nach Einfügen mit Absatzende steht Word häufig bereits am Beginn der nächsten Zeile.
    // Nur der unmittelbar vorhergehende Word-Absatz kommt dann in Betracht.
    if (typeof absatz.getPreviousOrNullObject !== "function") {
      return { hinweis: "askAbsatzFehlt" };
    }
    const vorher = absatz.getPreviousOrNullObject();
    vorher.load("text");
    return context
      .sync()
      .then(() =>
        vorher.isNullObject || !vorher.text.trim()
          ? { hinweis: "askAbsatzFehlt" }
          : { text: vorher.text, bezug: "previous", absatz: vorher },
      );
  });
}

// Die schmale Office-Brücke liest denselben belegten Antwortvertrag wie das Aufgabenfenster.
function begleitVergleichAusAntwort(body, dokument, frage, locale) {
  const result = body?.result;
  if (!dokument || !result || result.belastbarkeit?.lage === "geschwaerzt") return null;
  if (
    result.answered === false &&
    askPrueftAussage(frage) &&
    (!result.belastbarkeit || result.belastbarkeit.lage === "wissensluecke")
  ) {
    return askDirektvergleich("offen", dokument, [], [], false);
  }
  const urteil = result.dokumentUrteil;
  if (
    result.answered !== true ||
    typeof result.answer !== "string" ||
    !result.answer.trim() ||
    (result.belastbarkeit &&
      !["belegt", "belegt_zustaendig_fehlt", "belegt_mit_konflikt"].includes(
        result.belastbarkeit.lage,
      )) ||
    !Array.isArray(result.sources) ||
    !Array.isArray(result.citedSources) ||
    !urteil ||
    (urteil.art !== "bestaetigt" && urteil.art !== "widersprochen")
  )
    return null;
  const tragend = result.citedSources.filter((id) => result.sources.includes(id));
  const absaetze = askAbsaetzeLesen(body, tragend);
  if (!absaetze || absaetze.length < 2 || absaetze[0].text !== urteil.texte?.[locale]) return null;
  return askDirektvergleich(
    urteil.art,
    dokument,
    absaetze.slice(1),
    Array.isArray(result.steps) ? result.steps : [],
    tragend.length === 1,
  );
}

if (typeof self !== "undefined") {
  self.KlarwerkDokumentvergleich = {
    absatzFrage: askFragtNachWordAbsatz,
    ausAntwort: begleitVergleichAusAntwort,
    absatzAmCursor: askAbsatzAmCursor,
    zeigen: wordVergleichZeigen,
  };
}
