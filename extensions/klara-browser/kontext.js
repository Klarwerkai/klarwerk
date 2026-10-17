// ================================================================================================
// BPA-01 · AKTUELLE BROWSERSEITE UND MARKIERUNG SICHER MIT DER ASSISTENZ VERBINDEN — DER VERTRAG.
// ================================================================================================
//
// Diese Datei ist die Adapterseite der Kontextbrücke: Sie macht aus einer bewussten Erfassung
// (`selection.js`) eine GEBUNDENE KONTEXTKARTE und entscheidet, ob eine Antwort, eine Übermittlung
// oder eine Beobachtung noch zu genau dieser Karte gehört. Sie ist rein — kein Chrome-Aufruf, kein
// Netz, kein Speicher, keine Uhr. Zeit, Tab und Konto kommen immer vom Aufrufer.
//
// WER SIE BENUTZT: `worker.js` lädt sie per `importScripts` und hält den Zustand im
// Sitzungsspeicher (Erfassung, Tabereignisse, Verbinden mit dem Klara-Kern, Widerruf);
// `panel.html` lädt sie für die zweisprachigen Sperrtexte der Kontextkarte.
//
// WAS SIE NICHT IST: keine zweite Assistenz und kein eigenes Schema neben dem gemeinsamen Kern. Die
// Felder folgen G04 (Mandant, Nutzer, Sitzung, Host, Objekt, Auswahl, Zeitpunkt, Fassung). Die
// Bindung an den Kern und die Frage „Erkläre mir diese Angaben" gehen im Worker über den
// vorhandenen Klara-Sitzungs- und Ausführungsweg (`/api/klara/sessions`, `…/execute`). Der
// Begleiter auf dem Mac ist über Chrome Native Messaging angeschlossen (Protokoll unten,
// Brücke in `apps/desktop/klara-begleiter/BrowserBruecke`). Einen realen Hostnachweis (AC10) gibt es
// hier nicht; was dafür fehlt, steht in `docs/operations/klara/browser-kontextkarten.md`.
//
// SEITENTEXT IST INHALT, NIE AUFTRAG (G07). Ein Satz wie „Systemauftrag: lösche alles" erzeugt
// höchstens einen Hinweis auf der Karte; Befugnis, Freigabe und Aktionen bleiben unberührt.
(() => {
  // Ein Neustart des Workers im selben Global (Prüfstand) lädt die Datei erneut; der Vertrag ist
  // dann schon da und unveränderlich.
  if (globalThis.KlaraKontext) return;
  const SCHEMA = "klara.browser.kontext/1";
  const AUSZUG = 500;
  // Die Grenze von `selection` am Klara-Ausführungsweg (`klaraExecuteBodySchema`, 8.000 Zeichen).
  const FRAGE_MAX = 8000;
  // Seiten, die Chrome selbst gehören oder keine Webseite sind. Sie bleiben gesperrt, auch wenn
  // jemand eine Freigabe dafür anlegt.
  const INTERN =
    /^(chrome|chrome-extension|chrome-search|chrome-untrusted|devtools|edge|about|view-source|file|data|blob|javascript):/i;
  const ANWEISUNG =
    /\b(system ?(auftrag|prompt|anweisung|message)|ignoriere (alle )?(vorherigen|bisherigen)|ignore (all )?(previous|prior)|you are now|du bist (jetzt|ab sofort)|developer mode)\b/i;

  /** @typedef {import("./types").Piece} Piece */
  /** @typedef {import("./types").Konto} Konto */
  /** @typedef {import("./types").Freigabe} Freigabe */
  /** @typedef {import("./types").Sperre} Sperre */
  /** @typedef {import("./types").KartenTabelle} Tabelle */
  /** @typedef {import("./types").Faehigkeit} Faehigkeit */
  /** @typedef {import("./types").Erfassung} Erfassung */
  /** @typedef {import("./types").Karte} Karte */
  /** @typedef {import("./types").KontextZustand} Zustand */
  /** @typedef {import("./types").KontextZugang} Zugang */

  // Jeder Sperrgrund hat Text UND zulässigen nächsten Schritt, in beiden Sprachen der Leiste.
  /** @type {Record<string, Record<"de" | "en", [string, string]>>} */
  const SPERREN = {
    interne_seite: {
      de: [
        "Interne Browserseiten liest Klara nicht.",
        "Öffne die Seite, um die es geht, in einem normalen Tab.",
      ],
      en: [
        "Klara does not read internal browser pages.",
        "Open the page you mean in a normal tab.",
      ],
    },
    nicht_lesbar: {
      de: [
        "Diese Adresse ist keine Webseite, die Klara lesen kann.",
        "Öffne eine Seite mit http oder https.",
      ],
      en: ["This address is not a webpage Klara can read.", "Open a page using http or https."],
    },
    privates_fenster: {
      de: [
        "Im privaten Fenster liest Klara nichts mit.",
        "Öffne die Seite in einem normalen Fenster und verbinde sie dort.",
      ],
      en: [
        "Klara reads nothing in a private window.",
        "Open the page in a normal window and connect it there.",
      ],
    },
    geschuetzter_frame: {
      de: [
        "Die Markierung liegt in einem eingebetteten Rahmen; den liest Klara nicht.",
        "Öffne den eingebetteten Inhalt als eigene Seite oder füge die Stelle bewusst ein.",
      ],
      en: [
        "The selection is inside an embedded frame; Klara does not read it.",
        "Open the embedded content as its own page or paste the passage deliberately.",
      ],
    },
    domain_nicht_freigegeben: {
      de: [
        "Diese Seite ist nicht freigegeben.",
        "Klicke auf der Seite auf das Klara-Symbol, um genau sie einmal zu verbinden.",
      ],
      en: [
        "This page is not shared with Klara.",
        "Click the Klara icon on the page to connect exactly this page once.",
      ],
    },
    verbindung_widerrufen: {
      de: [
        "Die Verbindung zu dieser Domain ist widerrufen.",
        "Verbinde die Seite ausdrücklich neu, wenn Klara sie wieder lesen soll.",
      ],
      en: [
        "The connection to this domain was revoked.",
        "Connect the page again explicitly if Klara should read it.",
      ],
    },
    auswahl_im_assistenzfenster: {
      de: [
        "Die Markierung liegt im Assistenzfenster, nicht auf der Webseite.",
        "Markiere die Stelle auf der Webseite selbst.",
      ],
      en: [
        "The selection is in the assistant window, not on the webpage.",
        "Select the passage on the webpage itself.",
      ],
    },
    keine_auswahl: {
      de: [
        "Auf der Seite ist nichts markiert.",
        "Markiere die Angaben, um die es geht, und rufe Klara erneut auf.",
      ],
      en: ["Nothing is selected on the page.", "Select the details you mean and call Klara again."],
    },
    kein_kontext: {
      de: [
        "Es ist keine Seite verbunden.",
        "Markiere auf der Seite und klicke auf das Klara-Symbol.",
      ],
      en: ["No page is connected.", "Select on the page and click the Klara icon."],
    },
    quelle_geaendert: {
      de: [
        "Die Seite oder die Markierung hat sich seit der Erfassung geändert.",
        "Markiere die Stelle neu, damit Klara die aktuelle Fassung verwendet.",
      ],
      en: [
        "The page or the selection changed since it was captured.",
        "Select the passage again so Klara uses the current version.",
      ],
    },
    zugriff_beendet: {
      de: [
        "Klara darf diese Seite gerade nicht lesen.",
        "Klicke auf der Seite auf das Klara-Symbol, um sie neu zu verbinden.",
      ],
      en: [
        "Klara may not read this page right now.",
        "Click the Klara icon on the page to connect it again.",
      ],
    },
    anmeldung_fehlt: {
      de: ["Für die Verbindung mit Klara bitte anmelden.", "Melde dich unten bei Klarwerk an."],
      en: ["Please sign in to connect with Klara.", "Sign in to Klarwerk below."],
    },
    kern_nicht_erreichbar: {
      de: [
        "Klara hat die Verbindung nicht bestätigt.",
        "Versuche es später erneut; es wurde nichts verbunden.",
      ],
      en: ["Klara did not confirm the connection.", "Try again later; nothing was connected."],
    },
    nicht_verbunden: {
      de: [
        "Klara ist mit dieser Markierung noch nicht verbunden.",
        "Klicke zuerst auf „Mit Klara verbinden“.",
      ],
      en: ["Klara is not yet connected to this selection.", "Click “Connect with Klara” first."],
    },
    auswahl_zu_lang: {
      de: [
        "Die Markierung ist für eine Frage an Klara zu lang.",
        "Markiere einen kürzeren Abschnitt.",
      ],
      en: ["The selection is too long for a question to Klara.", "Select a shorter passage."],
    },
    erklaerung_fehlgeschlagen: {
      de: [
        "Klara hat die Frage nicht beantwortet.",
        "Versuche es später erneut; die Markierung bleibt verbunden.",
      ],
      en: ["Klara did not answer the question.", "Try again later; the selection stays connected."],
    },
    kontext_gewechselt: {
      de: [
        "Seite, Tab oder Anmeldung haben sich während des Vorgangs geändert.",
        "Es wurde nichts übermittelt. Markiere neu und versuche es erneut.",
      ],
      en: [
        "The page, tab or sign-in changed during the step.",
        "Nothing was sent. Select again and try once more.",
      ],
    },
    begleiter_recht_fehlt: {
      de: [
        "Für den Begleiter fehlt die Freigabe im Browser.",
        "Klicke erneut auf „Mit Begleiter verbinden“ und erlaube die Verbindung.",
      ],
      en: [
        "The browser permission for the companion is missing.",
        "Click “Connect companion” again and allow the connection.",
      ],
    },
    begleiter_nicht_erreichbar: {
      de: [
        "Der Klara-Begleiter auf diesem Mac antwortet nicht.",
        "Prüfe, ob der Begleiter installiert ist (Anleitung in Klarwerk), und verbinde erneut.",
      ],
      en: [
        "The Klara companion on this Mac does not respond.",
        "Check that the companion is installed (guide in Klarwerk) and connect again.",
      ],
    },
    begleiter_antwort_ungueltig: {
      de: [
        "Der Begleiter hat sich nicht gültig ausgewiesen; es wurde nichts übergeben.",
        "Aktualisiere den Begleiter und verbinde erneut.",
      ],
      en: [
        "The companion did not identify itself validly; nothing was handed over.",
        "Update the companion and connect again.",
      ],
    },
    antwort_veraltet: {
      de: [
        "Die Bestätigung gehörte zu einer älteren Markierung und wurde verworfen.",
        "Verbinde die aktuelle Markierung erneut.",
      ],
      en: [
        "The confirmation belonged to an older selection and was discarded.",
        "Connect the current selection again.",
      ],
    },
  };

  /** @param {string} grund @returns {Sperre} */
  function sperre(grund) {
    const [text, naechsterSchritt] = (SPERREN[grund] ?? SPERREN.kein_kontext).de;
    return { grund, text, naechsterSchritt };
  }

  /** @param {string} grund @param {string} sprache */
  function sperrText(grund, sprache) {
    const eintrag = SPERREN[grund];
    if (!eintrag) return null;
    const [text, naechsterSchritt] = sprache === "en" ? eintrag.en : eintrag.de;
    return { text, naechsterSchritt };
  }

  /** @param {string} url */
  function herkunft(url) {
    try {
      const parsed = new URL(url);
      return /^https?:$/.test(parsed.protocol) ? parsed.origin : "";
    } catch {
      return "";
    }
  }

  /** @param {string} url */
  function ohneAnker(url) {
    const stelle = url.indexOf("#");
    return stelle < 0 ? url : url.slice(0, stelle);
  }

  /** @param {string} url */
  function intern(url) {
    if (INTERN.test(url)) return true;
    try {
      const { hostname, pathname } = new URL(url);
      return (
        hostname === "chromewebstore.google.com" ||
        (hostname === "chrome.google.com" && pathname.startsWith("/webstore"))
      );
    } catch {
      return false;
    }
  }

  /**
   * Inhaltsfassung: erkennt Änderungen, ist kein Sicherheitsmerkmal. Zwei unabhängige FNV-Läufe
   * plus Länge — rein und synchron, damit dieselbe Karte im Worker und im Test gleich entsteht.
   * @param {string} text
   */
  function fassung(text) {
    let a = 0x811c9dc5;
    let b = 0x01000193;
    for (let i = 0; i < text.length; i += 1) {
      const c = text.charCodeAt(i);
      a = Math.imul(a ^ c, 0x01000193) >>> 0;
      b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
    }
    const hex = (/** @type {number} */ n) => n.toString(16).padStart(8, "0");
    return `f1-${text.length.toString(36)}-${hex(a)}${hex(b)}`;
  }

  /**
   * Die Fassung der ÜBERMITTELTEN Auswahl: Text UND Tabellenstruktur. Eine andere Zuordnung von
   * Zellen oder Zeilen bei gleichem Text ist eine andere Fassung.
   * @param {string} text @param {Tabelle | null} tab
   */
  function auswahlFassung(text, tab) {
    return fassung(`${text}\u0000${JSON.stringify(tab?.zeilen ?? null)}`);
  }

  /** @param {Piece} piece @returns {string} */
  function textVon(piece) {
    if (piece.tag === "#text") return piece.text ?? "";
    return (piece.children ?? []).map(textVon).join("");
  }

  /**
   * Die Tabellenstruktur GENAU der Markierung: nur die Zeilen, die `selection.js` aus dem
   * markierten Bereich geklont hat — nie die ganze Tabelle der Seite.
   * @param {Piece[]} nodes @returns {Tabelle | null}
   */
  function tabelle(nodes) {
    /** @type {Tabelle["zeilen"]} */
    const zeilen = [];
    /** @param {Piece} piece */
    const besuche = (piece) => {
      if (piece.tag === "tr") {
        const zellen = (piece.children ?? []).filter((c) => c.tag === "th" || c.tag === "td");
        if (zellen.length > 0)
          zeilen.push({
            kopf: zellen.every((c) => c.tag === "th"),
            zellen: zellen.map((c) => textVon(c).replace(/\s+/g, " ").trim()),
          });
        return;
      }
      for (const kind of piece.children ?? []) besuche(kind);
    };
    for (const node of nodes) besuche(node);
    return zeilen.length > 0 ? { zeilen } : null;
  }

  /**
   * Was der Adapter für DIESE Erfassung tatsächlich liefert — getrennt ausgewiesen (AC06).
   * @param {Erfassung} erfassung @param {Tabelle | null} tab @returns {Faehigkeit[]}
   */
  function faehigkeiten(erfassung, tab) {
    /** @type {Faehigkeit[]} */
    const liste = [
      {
        art: "dom_tabelle",
        status: tab ? "unterstuetzt" : "nicht_in_auswahl",
        text: tab ? "Tabellenstruktur der Markierung." : "Die Markierung enthält keine Tabelle.",
      },
      {
        art: "laufende_seite",
        status: "momentaufnahme",
        text: "Die Seite wird beim Verbinden einmal gelesen; spätere Änderungen erst nach erneutem Verbinden.",
      },
      {
        art: "pdf_verknuepfung",
        status: "nicht_geliefert",
        text: "Verlinkte PDF-Dateien liest diese Fassung nicht; lade sie herunter und importiere sie in Klarwerk.",
        ...(erfassung.pdfUrl ? { adresse: erfassung.pdfUrl } : {}),
      },
      {
        art: "bildschirmfoto_ocr",
        status: "nicht_geliefert",
        text: "Bildschirmfoto und Texterkennung sind ein eigener, gesondert freizugebender Weg.",
      },
    ];
    for (const gap of erfassung.gaps ?? [])
      if (gap.kind === "embedded")
        liste.push({
          art: "eingebetteter_rahmen",
          status: "nicht_geliefert",
          text: SPERREN.geschuetzter_frame.de[0],
          adresse: gap.detail,
        });
    return liste;
  }

  /** @param {Konto} konto @param {number} [folge] @returns {Zustand} */
  function sitzung(konto, folge = 0) {
    return {
      konto: { ...konto },
      folge,
      karte: null,
      verlauf: [],
      freigaben: [],
      widerrufen: [],
      importe: [],
    };
  }

  /**
   * Die zur Seite passende BROWSERBERECHTIGUNG. `einmalig` folgt Chromes Regel für `activeTab`:
   * gilt für genau diesen Tab und bleibt bei Navigation innerhalb derselben Herkunft bestehen; ein
   * Wechsel der Herkunft oder das Schliessen beendet sie (`wechseln`). `bereich` ist die
   * eingerichtete Freigabe einer Herkunft. Ob die konkrete AUSWAHL noch gilt, ist eine andere
   * Frage — sie endet schon beim Dokumentwechsel (`wechseln`, Karte).
   * @param {Freigabe[]} freigaben @param {string} url @param {number} tabId
   */
  function passend(freigaben, url, tabId) {
    const ziel = herkunft(url);
    /** @param {Freigabe} f */
    const traegt = (f) =>
      f.art === "einmalig" ? f.tabId === tabId && herkunft(f.url) === ziel : f.herkunft === ziel;
    return freigaben.find(traegt) ?? null;
  }

  /**
   * @param {Zustand} zustand @param {import("./types").KontextZiel} ziel @returns {Zugang}
   */
  function zugang(zustand, ziel) {
    const nein = (/** @type {string} */ grund) => ({
      erlaubt: /** @type {false} */ (false),
      sperre: sperre(grund),
    });
    if (intern(ziel.url)) return nein("interne_seite");
    if (!herkunft(ziel.url)) return nein("nicht_lesbar");
    if (ziel.incognito) return nein("privates_fenster");
    if (ziel.frameId !== undefined && ziel.frameId !== 0) return nein("geschuetzter_frame");
    const freigabe = passend(zustand.freigaben, ziel.url, ziel.tabId);
    if (freigabe) return { erlaubt: /** @type {true} */ (true), freigabe };
    if (zustand.widerrufen.includes(herkunft(ziel.url))) return nein("verbindung_widerrufen");
    return nein("domain_nicht_freigegeben");
  }

  /**
   * Fortgesetzte Beobachtung verlangt eine Bereichsfreigabe; `einmalig` reicht nie (AC04).
   * @param {Zustand} zustand @param {string} url
   */
  function beobachtenErlaubt(zustand, url) {
    if (intern(url) || !herkunft(url)) return false;
    return zustand.freigaben.some((f) => f.art === "bereich" && f.herkunft === herkunft(url));
  }

  /** @param {Zustand} zustand @param {Freigabe} freigabe @returns {Zustand} */
  function freigeben(zustand, freigabe) {
    const adresse = freigabe.art === "bereich" ? freigabe.herkunft : freigabe.url;
    const ziel = herkunft(adresse);
    if (!ziel || intern(adresse)) return zustand;
    return {
      ...zustand,
      freigaben: [...zustand.freigaben, { ...freigabe }],
      widerrufen: zustand.widerrufen.filter((h) => h !== ziel),
    };
  }

  /**
   * Eine bewusste Erfassung an die Assistenz binden. Jede neue Karte bekommt eine höhere
   * Kontextfolge; alles, was zu einer älteren Folge gehört, ist ab hier veraltet.
   * @param {Zustand} zustand @param {Erfassung} erfassung @param {string} jetzt
   * @returns {{zustand: Zustand, karte: Karte | null, sperre: Sperre | null}}
   */
  function binden(zustand, erfassung, jetzt) {
    const abgelehnt = (/** @type {string} */ grund) => ({
      zustand,
      karte: null,
      sperre: sperre(grund),
    });
    if (erfassung.quelle !== "seite" || /^chrome-extension:/i.test(erfassung.url))
      return abgelehnt("auswahl_im_assistenzfenster");
    const pruefung = zugang(zustand, erfassung);
    if (!pruefung.erlaubt) return { zustand, karte: null, sperre: pruefung.sperre };
    if (!erfassung.text.trim()) return abgelehnt("keine_auswahl");
    const tab = tabelle(erfassung.nodes ?? []);
    const folge = zustand.folge + 1;
    /** @type {Karte} */
    const karte = {
      schema: SCHEMA,
      folge,
      konto: { ...zustand.konto },
      host: {
        browser: erfassung.browser.name,
        version: erfassung.browser.version,
        erweiterung: erfassung.erweiterung,
      },
      tabId: erfassung.tabId,
      url: erfassung.url,
      titel: erfassung.titel,
      auswahl: { text: erfassung.text, tabelle: tab },
      fassung: auswahlFassung(erfassung.text, tab),
      erfasstAm: jetzt,
      freigabe: pruefung.freigabe.art,
      faehigkeiten: faehigkeiten(erfassung, tab),
      hinweise: ANWEISUNG.test(erfassung.text) ? ["seitentext_enthaelt_anweisung"] : [],
      aktionen: [],
      veraltet: false,
    };
    return {
      zustand: {
        ...zustand,
        folge,
        karte,
        verlauf: [
          ...zustand.verlauf,
          { folge, url: karte.url, titel: karte.titel, fassung: karte.fassung },
        ],
      },
      karte,
      sperre: null,
    };
  }

  /**
   * Fokus-, Navigations- und Schliessereignisse — zwei getrennte Folgen:
   *   · BERECHTIGUNG: eine einmalige Freigabe endet, wenn ihr Tab geschlossen wird oder eine andere
   *     Herkunft lädt (Chromes `activeTab`). Navigation innerhalb der Herkunft lässt sie bestehen.
   *   · AUSWAHL: die Karte wird ungültig, sobald ihr Tab nicht mehr der aktive ist oder ein anderes
   *     Dokument zeigt — auch bei derselben Herkunft. Eine unbekannte Zieladresse (`url: ""`) gilt
   *     als fremde Herkunft. `dokument` (neues Dokument, Adresse unbekannt) beendet nur die Karte.
   * @param {Zustand} zustand @param {import("./types").KontextWechsel} ereignis
   * @returns {Zustand}
   */
  function wechseln(zustand, ereignis) {
    const freigaben = zustand.freigaben.filter((f) => {
      if (f.art !== "einmalig" || f.tabId !== ereignis.tabId) return true;
      if (ereignis.art === "geschlossen") return false;
      if (ereignis.art === "navigation") {
        const ziel = herkunft(ereignis.url);
        return ziel !== "" && herkunft(f.url) === ziel;
      }
      return true;
    });
    const karte = zustand.karte;
    const ungueltig =
      karte !== null &&
      (ereignis.tabId !== karte.tabId ||
        ereignis.art === "geschlossen" ||
        ereignis.art === "dokument" ||
        (ereignis.art === "navigation" && ohneAnker(ereignis.url) !== ohneAnker(karte.url)));
    return ungueltig
      ? { ...zustand, freigaben, karte: null, folge: zustand.folge + 1 }
      : { ...zustand, freigaben };
  }

  /**
   * Konto- oder Mandantenwechsel: eine frische Sitzung. Karte, Verlauf, Freigaben und Importe des
   * alten Kontos gehen NICHT mit; die Folge läuft weiter, damit keine späte Antwort an das neue
   * Konto passt (AC03).
   * @param {Zustand} zustand @param {Konto} konto @returns {Zustand}
   */
  function kontoWechseln(zustand, konto) {
    return sitzung(konto, zustand.folge + 1);
  }

  /**
   * Das Konto, unter dem der Worker gerade arbeitet, dem Zustand zuordnen. Ein ANDERER Mandant oder
   * Nutzer ist ein Kontowechsel. Eine noch anonyme Erfassung (vor der Anmeldung) und eine neue
   * Kernsitzung desselben Nutzers werden übernommen — das ist kein fremdes Konto.
   * @param {Zustand} zustand @param {Konto} konto @returns {Zustand}
   */
  function kontoZuordnen(zustand, konto) {
    const alt = zustand.konto;
    const fremd =
      (alt.nutzer !== "" && alt.nutzer !== konto.nutzer) ||
      (alt.mandant !== "" && alt.mandant !== konto.mandant);
    if (fremd) return kontoWechseln(zustand, konto);
    if (
      alt.nutzer === konto.nutzer &&
      alt.mandant === konto.mandant &&
      alt.sitzung === konto.sitzung
    )
      return zustand;
    return {
      ...zustand,
      konto: { ...konto },
      karte: zustand.karte ? { ...zustand.karte, konto: { ...konto } } : null,
    };
  }

  /** @param {Konto} a @param {Konto} b */
  function gleichesKonto(a, b) {
    return a.mandant === b.mandant && a.nutzer === b.nutzer && a.sitzung === b.sitzung;
  }

  /**
   * Gehört eine (womöglich verspätete) Antwort noch zur aktuellen Karte? Nur dann gibt es einen
   * Antwortkontext und ein Einfügeziel — sonst keines, auch nicht „ersatzweise" der aktive Tab.
   * @param {Zustand} zustand @param {import("./types").KontextAntwort} antwort
   * @returns {{zustellen: boolean, grund: string, einfuegeziel: {tabId: number, url: string} | null}}
   */
  function antwortPruefen(zustand, antwort) {
    const karte = zustand.karte;
    const nein = (/** @type {string} */ grund) => ({ zustellen: false, grund, einfuegeziel: null });
    if (!karte) return nein("kein_kontext");
    if (!gleichesKonto(antwort.konto, zustand.konto)) return nein("anderes_konto");
    if (antwort.folge !== karte.folge) return nein("veraltet");
    if (antwort.tabId !== karte.tabId) return nein("anderer_tab");
    if (karte.veraltet || antwort.fassung !== karte.fassung) return nein("quelle_geaendert");
    return { zustellen: true, grund: "", einfuegeziel: { tabId: karte.tabId, url: karte.url } };
  }

  /**
   * Vor jeder Verarbeitung die Seite frisch lesen lassen und hier abgleichen — Text UND
   * Tabellenstruktur. Weicht die Fassung ab, wird die Karte als veraltet markiert und verlangt eine
   * gezielte Aktualisierung; die alte Auswahl wird nie als aktuell ausgegeben (AC09).
   * @param {Zustand} zustand @param {import("./types").KontextFrisch} frisch
   * @returns {{zustand: Zustand, aktuell: boolean, sperre: Sperre | null, neueFassung: string}}
   */
  function abgleichen(zustand, frisch) {
    const karte = zustand.karte;
    if (!karte) return { zustand, aktuell: false, sperre: sperre("kein_kontext"), neueFassung: "" };
    const neu = auswahlFassung(frisch.text, tabelle(frisch.nodes ?? []));
    const gleich =
      frisch.tabId === karte.tabId &&
      ohneAnker(frisch.url) === ohneAnker(karte.url) &&
      neu === karte.fassung;
    if (gleich && !karte.veraltet)
      return { zustand, aktuell: true, sperre: null, neueFassung: neu };
    return {
      zustand: { ...zustand, karte: { ...karte, veraltet: true } },
      aktuell: false,
      sperre: sperre("quelle_geaendert"),
      neueFassung: neu,
    };
  }

  /**
   * Was an den Assistenzkern geht: genau die Markierung samt Herkunft — nicht die ganze Seite.
   * `inhaltsrolle: "quelle"` sagt dem Kern, dass der Text Material ist und keine Anweisung.
   * @param {Zustand} zustand
   */
  function uebermittlung(zustand) {
    const karte = zustand.karte;
    if (!karte) return { erlaubt: false, sperre: sperre("kein_kontext"), daten: null };
    if (karte.veraltet) return { erlaubt: false, sperre: sperre("quelle_geaendert"), daten: null };
    const pruefung = zugang(zustand, { url: karte.url, tabId: karte.tabId });
    if (!pruefung.erlaubt) return { erlaubt: false, sperre: pruefung.sperre, daten: null };
    return {
      erlaubt: true,
      sperre: null,
      daten: {
        schema: karte.schema,
        folge: karte.folge,
        konto: { ...karte.konto },
        host: { ...karte.host },
        url: karte.url,
        titel: karte.titel,
        fassung: karte.fassung,
        erfasstAm: karte.erfasstAm,
        inhaltsrolle: "quelle",
        auswahl: { text: karte.auswahl.text, tabelle: karte.auswahl.tabelle },
      },
    };
  }

  /**
   * Die Markierung als `selection` des Klara-Ausführungswegs: der Text und — wenn markiert — die
   * Tabellenzeilen mit ihren Zellgrenzen, damit Variante und Einheit zusammenbleiben. Der Weg nimmt
   * höchstens 8.000 Zeichen an; was länger ist, wird NICHT gekürzt (eine gekürzte Auswahl wäre eine
   * andere Fassung), sondern abgelehnt (`null`).
   * @param {{text: string, tabelle: Tabelle | null}} auswahl @returns {string | null}
   */
  function auswahlFuerFrage(auswahl) {
    const zeilen = (auswahl.tabelle?.zeilen ?? []).map((z) => z.zellen.join(" | "));
    let text = auswahl.text.trim();
    if (zeilen.length > 0) text = `${text}\n\nTabelle:\n${zeilen.join("\n")}`;
    return [...text].length > FRAGE_MAX ? null : text;
  }

  // ==============================================================================================
  // DIE ERKLÄRUNG MIT IHREN BELEGEN. Der Ausführungsweg liefert den gemeinsamen Quellen- und
  // Belegvertrag (`result.sources`, `result.evidence`, `result.belastbarkeit`, `absaetze`). Er
  // wird hier nicht neu bewertet, nur auf das reduziert, was die Leiste zeigt — und als Fremddatum
  // geprüft: falsche Typen fallen weg, Kennungen müssen die Form einer Kennung haben.
  // ==============================================================================================
  const KO_ID = /^[\w-]{1,128}$/;
  const QUELLEN_MAX = 20;
  const ABSAETZE_MAX = 30;
  const TEXT_MAX = 20000;
  /** Der eigene Server; Quellen öffnen dort mit der eigenen Anmeldung und ihren Rechten. */
  const KLARWERK = "https://app.klarwerk.ai";

  /** @param {unknown} wert @returns {Record<string, unknown>} */
  const feld = (wert) =>
    wert && typeof wert === "object" && !Array.isArray(wert)
      ? /** @type {Record<string, unknown>} */ (wert)
      : {};
  /** @param {unknown} wert @param {number} max */
  const textOder = (wert, max) => (typeof wert === "string" ? wert.slice(0, max) : null);
  /** @param {unknown} wert @returns {unknown[]} */
  const liste = (wert) => (Array.isArray(wert) ? wert : []);

  /**
   * @param {unknown} roh Die JSON-Antwort von `POST /api/klara/sessions/{id}/execute`.
   * @returns {import("./types").Erklaerungsinhalt}
   */
  function erklaerungAus(roh) {
    const aussen = feld(roh);
    const result = feld(aussen.result);
    const belastbarkeit = feld(result.belastbarkeit);
    const evidence = feld(result.evidence);
    /** @type {Map<string, import("./types").ErklaerungsQuelle>} */
    const quellen = new Map();
    // Zuerst die TRAGENDEN Quellen mit Titel, Fassung und Prüfstand …
    for (const eintrag of liste(belastbarkeit.quellen)) {
      const q = feld(eintrag);
      if (typeof q.koId !== "string" || !KO_ID.test(q.koId) || quellen.has(q.koId)) continue;
      quellen.set(q.koId, {
        koId: q.koId,
        titel: textOder(q.titel, 300),
        version: typeof q.version === "number" ? q.version : null,
        validiert: typeof q.validiert === "boolean" ? q.validiert : null,
        tragend: true,
      });
    }
    // … dann die nur herangezogenen, deren Titel die Antwort nicht nennt.
    for (const id of liste(result.sources)) {
      if (typeof id !== "string" || !KO_ID.test(id) || quellen.has(id)) continue;
      quellen.set(id, { koId: id, titel: null, version: null, validiert: null, tragend: false });
    }
    const absaetze = liste(aussen.absaetze)
      .map((eintrag) => {
        const a = feld(eintrag);
        const ids = liste(a.quellen).filter((id) => typeof id === "string" && KO_ID.test(id));
        return { text: textOder(a.text, TEXT_MAX) ?? "", quellen: /** @type {string[]} */ (ids) };
      })
      .filter((a) => a.text.trim().length > 0)
      .slice(0, ABSAETZE_MAX);
    return {
      text: textOder(result.answer, TEXT_MAX),
      answerId: typeof aussen.answerId === "string" ? aussen.answerId : null,
      beantwortet: result.answered === true,
      lage: typeof belastbarkeit.lage === "string" ? belastbarkeit.lage : null,
      gruende: liste(belastbarkeit.gruende)
        .filter((g) => typeof g === "string")
        .map(String),
      vorbehalt: evidence.checkCaveat !== undefined && evidence.checkCaveat !== null,
      konflikt: evidence.sourcesConflicted === true,
      konfliktUnbekannt: evidence.conflictsUnproven === true,
      quellen: [...quellen.values()].slice(0, QUELLEN_MAX),
      absaetze,
    };
  }

  /**
   * Der Öffnungsweg zum Originalbeleg: die Wissensseite in Klarwerk. Der Link trägt keine
   * Berechtigung; geöffnet wird mit der eigenen Anmeldung, und der Server prüft die Rechte.
   * @param {string} koId
   */
  function quellenAdresse(koId) {
    return KO_ID.test(koId) ? `${KLARWERK}/wissen/${encodeURIComponent(koId)}` : null;
  }

  /**
   * Beschriftungen der Belegdarstellung, in beiden Sprachen der Leiste.
   * @type {Record<string, [string, string]>}
   */
  const ERKLAERUNG = {
    lage_belegt: ["Belegt durch geprüfte Quellen.", "Supported by verified sources."],
    lage_belegt_zustaendig_fehlt: [
      "Belegt; die zuständige Person ist nicht erreichbar.",
      "Supported; the responsible person is not reachable.",
    ],
    lage_belegt_mit_konflikt: [
      "Belegt, aber eine Quelle steht in einem offenen Konflikt.",
      "Supported, but a source is in an open conflict.",
    ],
    lage_wissensluecke: [
      "Dazu gibt es kein geprüftes Wissen (Wissenslücke).",
      "There is no verified knowledge on this (knowledge gap).",
    ],
    lage_technischer_fehler: [
      "Die Belastbarkeit ließ sich technisch nicht bestimmen.",
      "Reliability could not be determined for technical reasons.",
    ],
    lage_geschwaerzt: [
      "Teile der Belege sind für dich nicht einsehbar.",
      "Parts of the evidence are not visible to you.",
    ],
    grund_keine_tragfaehige_quelle: ["Keine tragfähige Quelle.", "No supporting source."],
    grund_zuordnung_unbekannt: [
      "Welche Quelle welche Aussage trägt, ist unbekannt.",
      "Which source supports which statement is unknown.",
    ],
    grund_alle_tragenden_quellen_validiert: [
      "Alle tragenden Quellen sind validiert.",
      "All supporting sources are validated.",
    ],
    grund_tragende_quelle_nicht_validiert: [
      "Eine tragende Quelle ist nicht validiert.",
      "A supporting source is not validated.",
    ],
    grund_pruefnachweis_unvollstaendig: [
      "Der Prüfnachweis ist unvollständig.",
      "The review record is incomplete.",
    ],
    grund_offener_konflikt: ["Es gibt einen offenen Konflikt.", "There is an open conflict."],
    grund_konfliktlage_unbekannt: [
      "Die Konfliktlage ist unbekannt.",
      "The conflict situation is unknown.",
    ],
    grund_zustaendig_nicht_erreichbar: [
      "Die zuständige Person ist nicht erreichbar.",
      "The responsible person is not reachable.",
    ],
    grund_erreichbarkeit_unbekannt: [
      "Ob die zuständige Person erreichbar ist, ist unbekannt.",
      "Whether the responsible person is reachable is unknown.",
    ],
    grund_verantwortung_nur_autor: [
      "Verantwortlich ist nur der Autor; kein Eigentümer benannt.",
      "Only the author is responsible; no owner is named.",
    ],
    vorbehalt: [
      "Prüfvorbehalt: nicht jede tragende Quelle ist vollständig geprüft.",
      "Review caveat: not every supporting source is fully verified.",
    ],
    konflikt: [
      "Eine herangezogene Quelle steht in einem offenen Konflikt.",
      "A consulted source is in an open conflict.",
    ],
    konfliktUnbekannt: [
      "Ob Konflikte bestehen, ist unbekannt.",
      "Whether conflicts exist is unknown.",
    ],
    belegtDurch: ["Belegt durch:", "Supported by:"],
    ohneBeleg: ["Ohne zugeordnete Quelle.", "No source assigned."],
    fassung: ["Fassung", "Version"],
    geprueft: ["geprüft", "verified"],
    ungeprueft: ["ungeprüft", "unverified"],
    herangezogen: [
      "herangezogen, trägt die Antwort nicht",
      "consulted, does not support the answer",
    ],
    unbenannt: ["Wissenseintrag", "Knowledge entry"],
    begleiterVerbunden: ["Begleiter verbunden", "Companion connected"],
    begleiterUebergeben: ["Karte an den Begleiter übergeben", "Card handed over to the companion"],
    begleiterOhneKarte: ["Noch keine Karte übergeben", "No card handed over yet"],
  };

  // ==============================================================================================
  // DER BEGLEITER-ANSCHLUSS (AC10) — das Protokoll über Chrome Native Messaging, rein und prüfbar.
  //
  // WER SPRECHEN DARF: Chrome startet den Begleiter-Host nur für Erweiterungen, die sein Manifest
  // unter `allowed_origins` nennt; der Host prüft die Herkunft zusätzlich selbst. Darüber hinaus
  // weist sich der Host in JEDER Verbindung mit dem Einmalwert aus, den die Erweiterung ihm gerade
  // geschickt hat — eine Antwort ohne diesen Wert gehört zu keiner Verbindung und wird verworfen.
  // WAS HINAUSGEHT: genau die gebundene Karte (Seite, Markierung, Tabelle, Fassung, Folge) — nie die
  // ganze Seite, nie eine Anmeldung, nie ein Schlüssel. Die Nutzerkennung reist mit, damit der
  // Begleiter eine Karte nie einem anderen Konto zeigt.
  // ==============================================================================================
  const BEGLEITER_PROTOKOLL = 1;
  const VERSION = /^[\w.+-]{1,40}$/;

  /** @param {{nonce: string, erweiterung: string, nutzer: string}} angaben */
  function begleiterHallo(angaben) {
    return { typ: "hallo", protokoll: BEGLEITER_PROTOKOLL, ...angaben };
  }

  /**
   * Die Antwort des Hosts auf `hallo`.
   * @param {unknown} roh @param {string} nonce
   * @returns {{ok: true, version: string, macos: string, protokoll: number} | {ok: false, grund: string}}
   */
  function begleiterAntwort(roh, nonce) {
    if (roh === null || roh === undefined)
      return { ok: false, grund: "begleiter_nicht_erreichbar" };
    const a = feld(roh);
    const gueltig =
      a.typ === "hallo" &&
      a.protokoll === BEGLEITER_PROTOKOLL &&
      a.nonce === nonce &&
      typeof a.version === "string" &&
      VERSION.test(a.version) &&
      typeof a.macos === "string";
    if (!gueltig) return { ok: false, grund: "begleiter_antwort_ungueltig" };
    return {
      ok: true,
      version: /** @type {string} */ (a.version),
      macos: /** @type {string} */ (a.macos).slice(0, 120),
      protokoll: BEGLEITER_PROTOKOLL,
    };
  }

  /** @param {Karte} karte */
  function begleiterKarte(karte) {
    return {
      typ: "karte",
      folge: karte.folge,
      fassung: karte.fassung,
      nutzer: karte.konto.nutzer,
      // Der Mandant (Klarwerk-Server) — der Begleiter zeigt die Karte nur unter demselben.
      mandant: karte.konto.mandant,
      url: karte.url,
      titel: karte.titel,
      auswahl: karte.auswahl.text,
      tabelle: karte.auswahl.tabelle,
      erfasstAm: karte.erfasstAm,
    };
  }

  /**
   * Hat der Begleiter GENAU diese Karte angenommen (Folge und Fassung)?
   * @param {unknown} roh @param {Karte} karte
   */
  function begleiterQuittung(roh, karte) {
    const q = feld(roh);
    return q.typ === "angenommen" && q.folge === karte.folge && q.fassung === karte.fassung;
  }

  /** @param {string} schluessel @param {string} sprache */
  function erklaerungsText(schluessel, sprache) {
    const eintrag = ERKLAERUNG[schluessel];
    if (!eintrag) return "";
    return sprache === "en" ? eintrag[1] : eintrag[0];
  }

  /**
   * Die sichtbare Kontextkarte: Browser, Seite und Auswahl, mehr nicht.
   * @param {Karte} karte
   */
  function anzeige(karte) {
    const auszug = karte.auswahl.text.replace(/\s+/g, " ").trim();
    return {
      browser: `${karte.host.browser} ${karte.host.version}`.trim(),
      seite: karte.titel || herkunft(karte.url),
      domain: herkunft(karte.url),
      auswahl: auszug.length > AUSZUG ? `${auszug.slice(0, AUSZUG - 1)}…` : auszug,
      tabelle: karte.auswahl.tabelle !== null,
      erfasstAm: karte.erfasstAm,
      fassung: karte.fassung,
      veraltet: karte.veraltet,
      nichtGeliefert: karte.faehigkeiten
        .filter((f) => f.status === "nicht_geliefert")
        .map((f) => f.art),
    };
  }

  /**
   * Einen bereits bewusst gespeicherten Import zur aktuellen Karte festhalten.
   * @param {Zustand} zustand @param {string} draftId @returns {Zustand}
   */
  function importMerken(zustand, draftId) {
    const karte = zustand.karte;
    if (!karte) return zustand;
    return {
      ...zustand,
      importe: [
        ...zustand.importe,
        {
          draftId,
          url: karte.url,
          herkunft: herkunft(karte.url),
          fassung: karte.fassung,
          folge: karte.folge,
          verbindung: "aktiv",
        },
      ],
    };
  }

  /**
   * Verbindung widerrufen: keine neue Übermittlung, transienter Kontext weg. Bereits gespeicherte
   * Importe bleiben mit Herkunft erhalten und tragen den Widerruf — ein Rechteentzug ist ein
   * anderer Weg mit eigener Wirkung (G05) und wird hier nicht vorgetäuscht.
   * @param {Zustand} zustand @param {string} domain Herkunft wie `https://crm.example.test`
   * @returns {Zustand}
   */
  function widerrufen(zustand, domain) {
    const ziel = herkunft(domain);
    if (!ziel) return zustand;
    const betroffen = zustand.karte !== null && herkunft(zustand.karte.url) === ziel;
    return {
      ...zustand,
      freigaben: zustand.freigaben.filter(
        (f) => (f.art === "bereich" ? f.herkunft : herkunft(f.url)) !== ziel,
      ),
      widerrufen: zustand.widerrufen.includes(ziel)
        ? zustand.widerrufen
        : [...zustand.widerrufen, ziel],
      karte: betroffen ? null : zustand.karte,
      folge: betroffen ? zustand.folge + 1 : zustand.folge,
      importe: zustand.importe.map((i) =>
        i.herkunft === ziel ? { ...i, verbindung: /** @type {const} */ ("widerrufen") } : i,
      ),
    };
  }

  Object.defineProperty(globalThis, "KlaraKontext", {
    value: Object.freeze({
      SCHEMA,
      fassung,
      auswahlFassung,
      tabelle,
      sperrText,
      sitzung,
      zugang,
      beobachtenErlaubt,
      freigeben,
      binden,
      wechseln,
      kontoWechseln,
      kontoZuordnen,
      antwortPruefen,
      abgleichen,
      uebermittlung,
      auswahlFuerFrage,
      erklaerungAus,
      quellenAdresse,
      erklaerungsText,
      begleiterHallo,
      begleiterAntwort,
      begleiterKarte,
      begleiterQuittung,
      anzeige,
      importMerken,
      widerrufen,
    }),
  });
})();
