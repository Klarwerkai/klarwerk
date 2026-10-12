// ================================================================================================
// KLARA 05 (produkt:20261008:klara-aktionen) — WELCHER SATZ IST EIN KLARER AUSFÜHRUNGSAUFTRAG?
// ================================================================================================
//
// Klara führt nur aus, was die Person SELBST klar beauftragt — getippt oder als „Auftrag sprechen“,
// beides über diese eine Erkennung. Kein Sprachmodell entscheidet hier: die Erkennung ist eine feste,
// enge Satzform je vorhandener Klarwerk-Aktion. Was nicht passt, bleibt eine Frage (Frageweg) oder
// ein „Arbeitsauftrag, den Klara noch nicht ausführt“ (`klaraSprache.ts`, Klara 02).
//
// DIE VIER AKTIONEN, bewusst nur vorhandene Produktwege:
//   · öffnen            „Öffne den Artikel „Hydraulikfilter““, „Öffne den Entwurf „Wartung““
//   · Entwurf anlegen   „Lege den Entwurf „Wartung“ an“, „Lege die Entwürfe „A“ und „B“ an“,
//                       „… mit dem Text „…““, „… an und öffne ihn“
//   · Entwurf bearbeiten „Ergänze im Entwurf „Wartung“: Filter prüfen“,
//                       „Benenne den Entwurf „Alt“ in „Neu“ um“
//   · Aufgabe bearbeiten „Bearbeite die Aufgabe „Hydraulikfilter““
//
// NIE: Text aus einer Markierung, einem Dokument oder einer Antwort. Diese Funktion bekommt nur, was
// die Person ins Eingabefeld tippte oder als Auftrag sprach — eine Versandaufforderung in einem
// zusammengefassten Dokument erreicht sie gar nicht. Versenden, Einladen und Veröffentlichen sind
// keine Aktion dieser Erkennung.
//
// DOM-FREI, wie `klaraSprache.ts`: geprüft von einem `.ts`-Test ohne Browser.

export type KlaraAktion =
  | "oeffnen"
  | "entwurf_erstellen"
  | "entwurf_bearbeiten"
  | "aufgabe_bearbeiten";

/** Wonach Klara das Ziel sucht. `neu`: ein Entwurf, den der Schritt erst anlegt. */
export type Zielsuche = "wissensobjekt" | "entwurf" | "aufgabe" | "beliebig" | "neu";

export type Aenderung = { art: "ergaenzen"; text: string } | { art: "umbenennen"; titel: string };

/**
 * Nacharbeit 4: was an einer Aufgabe getan werden soll, wie die Person es sagte. Die Person wird
 * beim Zuweisen noch über das Personenverzeichnis aufgelöst (mehrdeutig: Rückfrage).
 */
export type ErkannteAufgabenaktion =
  | { art: "prioritaet"; wert: "hoch" | "mittel" | "niedrig" }
  | { art: "zuweisen"; person: string }
  | { art: "eskalieren" };

export interface ErkannterSchritt {
  aktion: KlaraAktion;
  suche: Zielsuche;
  /** Der genannte Name des Ziels — beim Anlegen der Titel des neuen Entwurfs. */
  name: string;
  /** Nur beim Anlegen: der genannte Inhalt (Kernaussage). */
  inhalt?: string;
  /** Nur beim Bearbeiten eines Entwurfs: was geändert wird. */
  aenderung?: Aenderung;
  /** Öffnet das Ergebnis des Schritts mit diesem Index (0-basiert) desselben Auftrags. */
  ausSchritt?: number;
  /** Nacharbeit 4: nur bei `aufgabe_bearbeiten` — die genannte Aktion; fehlt sie, fragt Klara. */
  aufgabenaktion?: ErkannteAufgabenaktion;
}

export interface ErkannterAuftrag {
  schritte: ErkannterSchritt[];
}

const MAX_NAME = 300;

/** Anrede, „bitte“ und Satzzeichen am Rand gehören nicht zum Auftrag. */
function bereinige(roh: string): string {
  return roh
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:(?:hey\s+)?klara[,:]?\s+)?(?:bitte\s+|please\s+|alsjeblieft\s+)?/iu, "")
    .replace(/[\s.!]+$/u, "")
    .replace(/,?\s+(?:bitte|please|alsjeblieft)$/iu, "")
    .trim();
}

const ZITAT = /„([^“”"]+)[“”"]|"([^"]+)"|“([^”"]+)[”"]|«([^»]+)»|‚([^‘’]+)[‘’]/gu;

/** Die Namen in Anführungszeichen, in Reihenfolge. */
export function zitate(text: string): string[] {
  return [...text.matchAll(ZITAT)]
    .map((m) => (m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? "").trim())
    .filter((s) => s.length > 0);
}

const ARTIKEL = /^(?:den|die|das|dem|der|the|het|de)\s+/iu;

/** Ein Name ohne Anführungszeichen: der Rest des Satzes, ohne führenden Artikel. */
function freierName(text: string): string {
  return text
    .replace(/[„“”"«»‚‘’]/gu, "")
    .replace(ARTIKEL, "")
    .trim();
}

function name(text: string): string | null {
  const n = zitate(text)[0] ?? freierName(text);
  return n.length > 0 && n.length <= MAX_NAME ? n : null;
}

// ------------------------------------------------------------------------------------------------
// Satzformen.
// ------------------------------------------------------------------------------------------------

const ANLEGEN = [
  // DE: „Lege (mir) (einen|den|die) (neuen) Entwurf/Entwürfe … an (und öffne ihn)“
  /^(?:lege|leg)\s+(?:mir\s+)?(?:(?:einen|ein|den|die|zwei|drei)\s+)?(?:neuen?\s+)?entw(?:u|ü|ue)rfe?\s+(.+?)\s+an(\s+und\s+(?:öffne|oeffne)\s+(?:ihn|sie|es|diesen|diese))?$/iu,
  // DE: „Erstelle (einen) (neuen) Entwurf … (und öffne ihn)“
  /^(?:erstelle|erstell)\s+(?:mir\s+)?(?:(?:einen|ein|zwei|drei)\s+)?(?:neuen?\s+)?entw(?:u|ü|ue)rfe?\s+(.+?)(\s+und\s+(?:öffne|oeffne)\s+(?:ihn|sie|es))?$/iu,
  // EN
  /^(?:create|add|start)\s+(?:a\s+|an\s+|two\s+|three\s+)?(?:new\s+)?drafts?\s+(.+?)(\s+and\s+open\s+(?:it|them))?$/iu,
  // NL
  /^maak\s+(?:een\s+)?(?:nieuw\s+)?concepten?\s+(.+?)(?:\s+aan)?(\s+en\s+open\s+(?:het|ze))?$/iu,
];

const INHALT =
  /\s+(?:mit\s+(?:dem\s+)?(?:text|inhalt)|with\s+(?:the\s+)?(?:text|content)|met\s+(?:de\s+)?(?:tekst|inhoud))\s+(.+)$/iu;

const ERGAENZEN = [
  /^(?:ergänze|ergänz|ergaenze)\s+(?:im|in\s+dem|den)\s+entwurf\s+(.+)$/iu,
  /^(?:bearbeite|bearbeit)\s+(?:den\s+)?entwurf\s+(.+?:\s*.+)$/iu,
  /^(?:append|add)\s+to\s+(?:the\s+)?draft\s+(.+)$/iu,
  /^edit\s+(?:the\s+)?draft\s+(.+?:\s*.+)$/iu,
  /^vul\s+(?:het\s+)?concept\s+(.+?)\s+aan\s*:\s*(.+)$/iu,
];

const UMBENENNEN = [
  /^benenne\s+(?:den\s+)?entwurf\s+(.+?)\s+(?:in|zu)\s+(.+?)\s+um$/iu,
  /^rename\s+(?:the\s+)?draft\s+(.+?)\s+to\s+(.+)$/iu,
  /^hernoem\s+(?:het\s+)?concept\s+(.+?)\s+(?:naar|in)\s+(.+)$/iu,
];

const AUFGABE = [
  /^(?:bearbeite|bearbeit|öffne|oeffne|erledige)\s+(?:die\s+)?aufgabe\s+(.+)$/iu,
  /^(?:work\s+on|open|edit)\s+(?:the\s+)?task\s+(.+)$/iu,
  /^(?:open|bewerk)\s+(?:de\s+)?taak\s+(.+)$/iu,
];

const OEFFNEN = [
  /^(?:öffne|oeffne|öffnen)\s+(?:mir\s+)?(?:(?:den|die|das)\s+)?(?:(artikel|beitrag|wissensobjekt|eintrag|objekt|entwurf)\s+)?(.+)$/iu,
  /^open\s+(?:the\s+|het\s+|de\s+)?(?:(article|entry|object|draft|artikel|concept)\s+)?(.+)$/iu,
];

const ENTWURFSWORT = /^(?:entwurf|draft|concept)$/iu;

function anlegen(s: string): ErkannterAuftrag | null {
  for (const muster of ANLEGEN) {
    const m = muster.exec(s);
    if (!m) {
      continue;
    }
    let rest = m[1] ?? "";
    const oeffnen = Boolean(m[2]);
    let inhalt: string | null = null;
    const mitInhalt = INHALT.exec(rest);
    if (mitInhalt) {
      inhalt = zitate(mitInhalt[1] ?? "")[0] ?? freierName(mitInhalt[1] ?? "");
      rest = rest.slice(0, mitInhalt.index);
    }
    const genannt = zitate(rest);
    const ohneZitat = rest.replace(/^(?:namens|mit dem titel|titled|called|genaamd)\s+/iu, "");
    const titel = genannt.length > 0 ? genannt : [freierName(ohneZitat)];
    if (titel.some((t) => t.length === 0 || t.length > MAX_NAME) || titel.length > 10) {
      return null;
    }
    const schritte: ErkannterSchritt[] = titel.map((t) => ({
      aktion: "entwurf_erstellen",
      suche: "neu",
      name: t,
      ...(inhalt ? { inhalt } : {}),
    }));
    if (oeffnen) {
      titel.forEach((t, i) => {
        schritte.push({ aktion: "oeffnen", suche: "entwurf", name: t, ausSchritt: i });
      });
    }
    return { schritte };
  }
  return null;
}

function bearbeiten(s: string): ErkannterAuftrag | null {
  for (const muster of UMBENENNEN) {
    const m = muster.exec(s);
    if (m) {
      const alt = name(m[1] ?? "");
      const neu = name(m[2] ?? "");
      return alt && neu
        ? {
            schritte: [
              {
                aktion: "entwurf_bearbeiten",
                suche: "entwurf",
                name: alt,
                aenderung: { art: "umbenennen", titel: neu },
              },
            ],
          }
        : null;
    }
  }
  for (const muster of ERGAENZEN) {
    const m = muster.exec(s);
    if (!m) {
      continue;
    }
    let ziel: string | null;
    let text: string | null;
    if (m[2] !== undefined) {
      ziel = name(m[1] ?? "");
      text = zitate(m[2])[0] ?? m[2].trim();
    } else {
      const rest = m[1] ?? "";
      const genannt = zitate(rest);
      const doppelpunkt = rest.indexOf(":");
      if (doppelpunkt > 0) {
        ziel = name(rest.slice(0, doppelpunkt));
        const danach = rest.slice(doppelpunkt + 1);
        text = zitate(danach)[0] ?? danach.trim();
      } else if (genannt.length >= 2) {
        ziel = genannt[0] ?? null;
        text = genannt[1] ?? null;
      } else {
        return null;
      }
    }
    return ziel && text
      ? {
          schritte: [
            {
              aktion: "entwurf_bearbeiten",
              suche: "entwurf",
              name: ziel,
              aenderung: { art: "ergaenzen", text },
            },
          ],
        }
      : null;
  }
  return null;
}

const PRIORITAET = [
  /^(?:setze|setz)\s+(?:die\s+)?priorit(?:ä|ae)t\s+(?:der|von)\s+(?:der\s+)?aufgabe\s+(.+?)\s+auf\s+(hoch|mittel|niedrig)$/iu,
  /^set\s+(?:the\s+)?priority\s+of\s+(?:the\s+)?task\s+(.+?)\s+to\s+(high|medium|low)$/iu,
];
const PRIORITAET_WERT: Record<string, "hoch" | "mittel" | "niedrig"> = {
  hoch: "hoch",
  mittel: "mittel",
  niedrig: "niedrig",
  high: "hoch",
  medium: "mittel",
  low: "niedrig",
};
const ZUWEISEN_DE = /^(?:weise|weis)\s+(?:die\s+)?aufgabe\s+(.+)\s+zu$/iu;
const ZUWEISEN_EN = /^assign\s+(?:the\s+)?task\s+(.+?)\s+to\s+(.+)$/iu;
const ESKALIEREN = [
  /^(?:eskaliere|eskalier)\s+(?:die\s+)?aufgabe\s+(.+)$/iu,
  /^escalate\s+(?:the\s+)?task\s+(.+)$/iu,
];

/** Nacharbeit 4: eine genannte Aktion an einer Aufgabe (Priorität, zuweisen, eskalieren). */
function aufgabenaktion(s: string): ErkannterAuftrag | null {
  const schritt = (n: string | null, a: ErkannteAufgabenaktion): ErkannterAuftrag | null =>
    n
      ? {
          schritte: [
            { aktion: "aufgabe_bearbeiten", suche: "aufgabe", name: n, aufgabenaktion: a },
          ],
        }
      : null;
  for (const muster of PRIORITAET) {
    const m = muster.exec(s);
    const wert = PRIORITAET_WERT[(m?.[2] ?? "").toLowerCase()];
    if (m && wert) {
      return schritt(name(m[1] ?? ""), { art: "prioritaet", wert });
    }
  }
  const de = ZUWEISEN_DE.exec(s);
  if (de) {
    // „Weise die Aufgabe „X“ (an) Anna Kramer zu“ — der Aufgabenname steht in Anführungszeichen.
    const innen = de[1] ?? "";
    const aufgabe = zitate(innen)[0];
    if (!aufgabe) {
      return null;
    }
    const nach = innen.slice(innen.indexOf(aufgabe) + aufgabe.length + 1);
    const person = name(nach.replace(/^\s*(?:an\s+)/iu, ""));
    return person ? schritt(aufgabe, { art: "zuweisen", person }) : null;
  }
  const en = ZUWEISEN_EN.exec(s);
  if (en) {
    const person = name(en[2] ?? "");
    return person ? schritt(name(en[1] ?? ""), { art: "zuweisen", person }) : null;
  }
  for (const muster of ESKALIEREN) {
    const m = muster.exec(s);
    if (m) {
      return schritt(name(m[1] ?? ""), { art: "eskalieren" });
    }
  }
  return null;
}

function aufgabe(s: string): ErkannterAuftrag | null {
  for (const muster of AUFGABE) {
    const m = muster.exec(s);
    if (m) {
      const n = name(m[1] ?? "");
      return n ? { schritte: [{ aktion: "aufgabe_bearbeiten", suche: "aufgabe", name: n }] } : null;
    }
  }
  return null;
}

function oeffnen(s: string): ErkannterAuftrag | null {
  for (const muster of OEFFNEN) {
    const m = muster.exec(s);
    if (m) {
      const art = m[1];
      const n = name(m[2] ?? "");
      if (!n) {
        return null;
      }
      let suche: Zielsuche = "beliebig";
      if (art) {
        suche = ENTWURFSWORT.test(art) ? "entwurf" : "wissensobjekt";
      }
      return { schritte: [{ aktion: "oeffnen", suche, name: n }] };
    }
  }
  return null;
}

/**
 * Der klare Ausführungsauftrag in diesem Text — oder `null`, wenn der Text keiner ist (eine Frage,
 * ein Diktat, eine nicht angebotene Handlung). Eine Frage („…?“) ist nie ein Auftrag.
 */
export function erkenneAuftrag(text: string): ErkannterAuftrag | null {
  const roh = text.trim();
  if (roh.length === 0 || roh.length > 2_000 || roh.endsWith("?")) {
    return null;
  }
  const s = bereinige(roh);
  return anlegen(s) ?? bearbeiten(s) ?? aufgabenaktion(s) ?? aufgabe(s) ?? oeffnen(s);
}

/** Kurzform für die Oberfläche: ist dieser Text ein ausführbarer Auftrag? */
export function istAusfuehrungsauftrag(text: string): boolean {
  return erkenneAuftrag(text) !== null;
}
