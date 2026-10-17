// ================================================================================================
// produkt:20261011:assistenz-browser-aktionen (BPA-03) — WAS DIE PERSON AUF DER SEITE BEAUFTRAGT.
// ================================================================================================
//
// Klara 05 erkennt Aufträge über FESTE SATZFORMEN, ohne Sprachmodell (`apps/web/src/lib/
// klaraAuftragErkennung.ts`), getippt wie gesprochen gleich. Dasselbe hier für eine Browserseite —
// mit einem Unterschied, der die Sicherheit trägt: die Wörter, nach denen gesucht wird, kommen aus
// dem SEITENPROFIL des Adapters (Formularnamen, Feldbeschriftungen, Knöpfe), nie aus der Seite.
// Seitentext kann damit weder ein Feld noch einen Knopf in den Auftrag schieben (G07).
//
// DIE SATZFORM: „Fülle den Angebotsentwurf aus: Betreff „Angebot Kühlanlage", Empfänger
// einkauf@kunde.invalid, Nachricht „…" und speichere ihn als Entwurf." Eine Beschriftung leitet
// ihren Wert ein; der Wert reicht bis zur nächsten Beschriftung, bis zum Befehlsteil („und
// speichere …") oder ist in Anführungszeichen eingeschlossen. Gesprochen fehlen die Anführungs-
// zeichen meist — dann trennen die Beschriftungen selbst; diese Trennung zeigt der Kern der Person
// als Zuordnung (Feld = Wert) und führt erst nach ihrer Bestätigung aus. Eine Beschriftung direkt nach einem
// Artikel oder einer Präposition („auf Ihre Nachricht", „an Empfänger") beginnt nur dann ein Feld,
// wenn es eindeutig ist; mitten in einem ungeklammerten Wert wird sie geklärt.
//
// NICHT RATEN, NICHTS VERSCHLUCKEN (Ben-Prüfung Chat 62): Ausserhalb der Werte darf nur stehen, was
// zum Auftragswortschatz gehört — Füllen, Speichern, Formular-, Feld- und Knopfnamen und wenige
// Füllwörter. Jedes andere Wort, jede Verneinung oder Aufschiebung („nicht", „erst morgen") und
// jede mehrdeutige Lage wird eine Klärung, BEVOR auf der Seite irgendetwas geschieht — lieber
// einmal nachgefragt als ein Wert im falschen Feld oder ein stillschweigend weggefallener Teil.
// Ein endgültiges Auslösen steht nur im Auftrag, wenn die Person den Knopf des Profils mit seinen
// Wörtern in dieser Reihenfolge nennt; ein anderes Außenwort (senden, übermitteln, bestellen …)
// ohne passenden freigegebenen Knopf macht den GANZEN Auftrag zur Übergabe.
import type { BrowserFeldwert, BrowserSeitenprofil } from "./klara-browser-aktion";

export const BROWSER_WORTLAUT_MAX = 2000;

export type BrowserErkennung =
  | {
      readonly ok: true;
      readonly formular: string;
      readonly felder: readonly BrowserFeldwert[];
      readonly speichern: boolean;
      readonly ausloesen: string | null;
      /**
       * Mindestens ein Wert endet nur, weil die nächste Beschriftung beginnt — ohne Anführungszeichen
       * oder Satzzeichen dazwischen. Ob die Trennung stimmt, kann nur die Person sagen: der Kern
       * zeigt ihr die Zuordnung, bevor auf der Seite etwas geschieht.
       */
      readonly zuordnungPruefen: boolean;
    }
  | { readonly ok: false; readonly art: "klaerung"; readonly text: string }
  /** Eine Außenhandlung, die das Profil hier nicht freigibt: `was` in Worten der Person. */
  | { readonly ok: false; readonly art: "gesperrt"; readonly was: string };

const ANFUEHRUNG: readonly (readonly [string, string])[] = [
  ["„", "“"],
  ["„", '"'],
  ["“", "”"],
  ['"', '"'],
  ["»", "«"],
  ["«", "»"],
  ["‚", "‘"],
];
const ANFUEHRUNGSZEICHEN = /[„“”"»«‚‘]/u;

/** Wörter, die eine Wirkung nach außen meinen — gesperrt, solange kein Profilknopf sie trägt. */
const AUSSENWORT =
  /(^|[^\p{L}\p{N}])((ab|ver|weiter|zu)?(send|schick)\w*|übermittel\w*|übermittl\w*|weiterleit\w*|leite[nt]?|einreich\w*|reiche|absend\w*|freigeb\w*|veröffentlich\w*|hochlad\w*|teile[nt]?|poste[nt]?|bestell\w*|kauf\w*|bezahl\w*|zahl(e|en|t)|buch(e|en|t)|kündig\w*|unterschreib\w*|unterzeichn\w*|akzeptier\w*|zustimm\w*|bestätig\w*|lösch\w*|entfern\w*|submit\w*|send|sends|order\w*|buy|purchase|pay|publish\w*|post|share|forward|delete|remove|confirm|accept|sign|cancel|transfer)(?=$|[^\p{L}\p{N}])/iu;
const SPEICHERWORT =
  /(^|[^\p{L}\p{N}])(speicher\w*|sicher(e|n|t)|abspeicher\w*|als entwurf|save|store)(?=$|[^\p{L}\p{N}])/iu;
/** Verneinung oder Aufschub: was danach kommt, darf Klara nicht als Auftrag lesen. */
const EINSCHRAENKUNG =
  /(^|[^\p{L}\p{N}])(nicht|nichts|kein\w*|nie|niemals|ohne|erst|später|morgen|übermorgen|lieber|statt|anstatt|außer|ausser|don't|do|not|never|without|later|tomorrow)(?=$|[^\p{L}\p{N}])/iu;
/**
 * Wo ein ungeklammerter Wert endet: am Befehlsteil, der nach ihm kommt — „und speichere …",
 * „und dann endgültig senden", „speichere ihn …" (nur die Du-Form; „speichern Sie" in einer
 * Nachricht ist Text) oder ein abschliessendes „…, speichern.". Zwischen Bindewort und
 * Befehlswort dürfen Füllwörter stehen.
 */
const BEFEHLSANFANG =
  /[,;]?\s+(und|dann|danach|anschließend)(\s+(dann|danach|anschließend|bitte|noch|gleich|sofort|direkt|endgültig|ihn|es|sie|den|das|die|entwurf|nachricht|formular))*\s+(speicher|sicher|send|schick|übermittel|leit|bestell|kauf|bezahl|lösch|klick|drück|lös|auslös)\w*|[,;]?\s+(speichere|sichere)\s+(ihn|es|sie|den|das|die|als)\b|[,;]\s+(speichern|sichern|abspeichern)(?=\s*[.!]?\s*$)/iu;
/** Vor einer Beschriftung: dann ist sie Teil eines Werts („auf Ihre Nachricht"), kein neues Feld. */
const BEZUGSWORT =
  /(^|[^\p{L}\p{N}])(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|ihr|ihre|ihren|ihrem|ihrer|sein|seine|seinen|seinem|seiner|mein|meine|meinen|meinem|meiner|dein|deine|deinen|deinem|deiner|unser|unsere|unseren|unserem|unserer|euer|eure|kein|keine|keinen|jede|jeder|jedes|jeden|diese|dieser|dieses|diesen|auf|zur|zum|vom|von|im|in|mit|für|ohne|über|unter|aus|bei|nach|vor|per|the|your|my|our|a|an|of|to|for|with|in|on)\s+$/iu;
/** Was ausserhalb der Werte stehen darf, ausser Formular-, Feld- und Knopfnamen. */
const AUFTRAGSWORTE = new Set([
  "fülle",
  "füll",
  "füllen",
  "fuelle",
  "ausfüllen",
  "trage",
  "trag",
  "eintragen",
  "ein",
  "aus",
  "bitte",
  "mal",
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "im",
  "in",
  "ins",
  "formular",
  "formulars",
  "entwurf",
  "entwurfs",
  "als",
  "und",
  "dann",
  "danach",
  "anschließend",
  "ihn",
  "es",
  "sie",
  "mit",
  "folgendem",
  "folgenden",
  "folgende",
  "wert",
  "werte",
  "werten",
  "feld",
  "felder",
  "auf",
  "dieser",
  "diese",
  "diesem",
  "seite",
  "hier",
  "klara",
  "so",
  "wie",
  "folgt",
  "jetzt",
  "sofort",
  "gleich",
  "speichere",
  "speicher",
  "speichern",
  "sichere",
  "sichern",
  "abspeichern",
  "klicke",
  "klick",
  "klicken",
  "drücke",
  "drück",
  "betätige",
  "löse",
  "knopf",
  "schaltfläche",
  "button",
]);

function grenze(muster: string): RegExp {
  const sicher = muster.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  // Bindestrich und Schrägstrich gehören zum Wort: „Empfänger-Wechsel" ist keine Beschriftung.
  return new RegExp(`(^|[^\\p{L}\\p{N}/-])(${sicher})(?=$|[^\\p{L}\\p{N}/-])`, "giu");
}

interface Bereich {
  readonly von: number;
  readonly bis: number;
}

interface Zitat extends Bereich {
  /** Der Text zwischen den Anführungszeichen. */
  readonly innen: string;
}

/** Ein Feldbeginn: die Beschriftung an ihrer Stelle im Wortlaut. */
interface Marke {
  readonly label: string;
  readonly stelle: Bereich;
}

/** Ein erkannter Wert — der Bereich reicht von seiner Beschriftung bis zu seinem Ende. */
interface Wertstelle extends Bereich {
  readonly label: string;
  readonly wert: string;
  readonly zitiert: boolean;
  /** Endet nur an der nächsten Beschriftung (kein Zitat, kein Satzzeichen, kein Befehlsteil). */
  readonly anBeschriftung: boolean;
}

/** Ein Klick ohne genannten Knopf („klicke auf den Knopf", „löse aus") — welcher, wäre geraten. */
const KLICKWORT =
  /(^|[^\p{L}\p{N}])(klick\w*|drück\w*|betätig\w*|lös(e|en|t)|auslös\w*|click\w*|press\w*|trigger\w*)(?=$|[^\p{L}\p{N}])/iu;
/**
 * Trennbare Verben des Auftrags: „Fülle … Empfänger x aus". Fehlt die Partikel im Befehlsteil und
 * endet ein ungeklammerter Wert auf sie, ist offen, wohin sie gehört.
 */
const TRENNBAR: readonly (readonly [RegExp, string])[] = [
  [/^(fülle|füll|fuelle|fuell)$/u, "aus"],
  [/^(trage|trag)$/u, "ein"],
];

const woerter = (t: string) => t.toLowerCase().split(/[^\p{L}\p{N}]+/u);
/** Der Infinitiv im Befehlsteil — nach einem ungeklammerten Wert mehrdeutig. */
const INFINITIV_SPEICHERN = /(?:^|[^\p{L}])(speichern|sichern|abspeichern)(?=$|[^\p{L}])/iu;

/**
 * Bereiche in Anführungszeichen — Beschriftungen und Befehlswörter darin zählen nicht. Öffnet ein
 * Zeichen mehrere Paare („ schliesst mit “ oder mit "), gilt das NÄCHSTE schliessende Zeichen.
 */
function zitate(text: string): Zitat[] {
  const bereiche: Zitat[] = [];
  let i = 0;
  while (i < text.length) {
    const passend = ANFUEHRUNG.filter(([auf]) => text.startsWith(auf, i))
      .map(([auf, zu]) => ({ auf, zu, ende: text.indexOf(zu, i + auf.length) }))
      .filter((p) => p.ende > i)
      .sort((a, b) => a.ende - b.ende);
    const p = passend[0];
    if (p) {
      bereiche.push({
        von: i,
        bis: p.ende + p.zu.length,
        innen: text.slice(i + p.auf.length, p.ende),
      });
      i = p.ende + p.zu.length;
      continue;
    }
    i++;
  }
  return bereiche;
}

function inZitat(bereiche: readonly Bereich[], pos: number): boolean {
  return bereiche.some((b) => pos >= b.von && pos < b.bis);
}

/** Alle Fundstellen eines Wortes ausserhalb von Zitaten. */
function fundstellen(text: string, wort: string, bereiche: readonly Bereich[]): Bereich[] {
  const treffer: Bereich[] = [];
  for (const m of text.matchAll(grenze(wort))) {
    const von = (m.index ?? 0) + (m[1]?.length ?? 0);
    if (!inZitat(bereiche, von)) {
      treffer.push({ von, bis: von + (m[2]?.length ?? 0) });
    }
  }
  return treffer;
}

function ohneBereiche(text: string, weg: readonly Bereich[]): string {
  let rest = "";
  let pos = 0;
  for (const b of [...weg].sort((a, c) => a.von - c.von)) {
    rest += `${text.slice(pos, b.von)} `;
    pos = Math.max(pos, b.bis);
  }
  return rest + text.slice(pos);
}

const liste = (namen: readonly string[]) => namen.map((n) => `„${n}"`).join(" oder ");
const klaerung = (text: string): BrowserErkennung => ({ ok: false, art: "klaerung", text });
const mehrfach = (label: string) =>
  klaerung(
    `„${label}" steht mehrfach im Auftrag. Welcher Wert ist gemeint? Setze ihn in Anführungszeichen.`,
  );

/** Die Werte zu den Feldbeginnen: jeder bis zur nächsten Beschriftung, zum Befehlsteil oder zum Zitatende. */
function werteAus(
  text: string,
  zit: readonly Zitat[],
  marken: readonly Marke[],
): Wertstelle[] | BrowserErkennung {
  const sortiert = [...marken].sort((a, b) => a.stelle.von - b.stelle.von);
  const werte: Wertstelle[] = [];
  for (const [i, m] of sortiert.entries()) {
    const ende = sortiert[i + 1]?.stelle.von ?? text.length;
    let von = m.stelle.bis;
    // Einleitung: Doppelpunkt oder Gleichheitszeichen. Ohne sie leitet ein kleingeschriebenes „ist"
    // oder „lautet" den Wert ein („Betreff ist …"); „mit", „auf", „als" nur vor Anführungszeichen —
    // sonst gehört es zum Wert („Nachricht: Mit freundlichen Grüßen", „Nachricht: Ist das …?").
    const zeichen = /^\s*([:=–-])?\s*/u.exec(text.slice(von, ende));
    von += zeichen?.[0].length ?? 0;
    const kopula = zeichen?.[1] ? null : /^(ist|lautet)\s+/u.exec(text.slice(von, ende));
    von += kopula?.[0].length ?? 0;
    const vorZitat = /^(mit|auf|als|lautet|ist)\s+(?=[„“"»«‚])/iu.exec(text.slice(von, ende));
    von += vorZitat?.[0].length ?? 0;
    const zitat = zit.find((z) => z.von === von && z.bis <= ende);
    let wert: string;
    let bis: number;
    let anBeschriftung = false;
    if (zitat) {
      if (ANFUEHRUNGSZEICHEN.test(zitat.innen)) {
        return klaerung(
          `Im Wert von „${m.label}" stehen weitere Anführungszeichen. Welcher Text ist gemeint? Setze ihn einmal in Anführungszeichen.`,
        );
      }
      wert = zitat.innen;
      bis = zitat.bis;
    } else {
      const abschnitt = text.slice(von, ende);
      const befehl = BEFEHLSANFANG.exec(abschnitt);
      const roh = befehl ? abschnitt.slice(0, befehl.index) : abschnitt;
      wert = roh
        .replace(/[\s,;]+(und)?\s*$/iu, "")
        .replace(/[.!]\s*$/u, "")
        .trim();
      bis = von + roh.length;
      // Steht in einem ungeklammerten Wert noch ein Befehls- oder Außenwort, ist offen, ob es zum
      // Wert gehört oder ein Auftrag ist. Nicht raten: weder still einen Auftrag schlucken noch
      // ihn in ein Feld schreiben.
      const fraglich = AUSSENWORT.exec(wert) ?? SPEICHERWORT.exec(wert);
      if (fraglich) {
        return klaerung(
          `Gehört „${fraglich[2]}" zum Wert von „${m.label}" oder ist es ein Auftrag? Setze den Wert in Anführungszeichen.`,
        );
      }
      // Ein Infinitiv nach einem ungeklammerten Wert („… prüfen und sichern", „…, speichern.") kann
      // Teil des Werts sein. Eindeutig ist nur die Du-Form („und speichere ihn").
      const infinitiv = befehl ? INFINITIV_SPEICHERN.exec(befehl[0]) : null;
      if (infinitiv) {
        return klaerung(
          `Gehört „${infinitiv[1]}" zum Wert von „${m.label}", oder soll Klara speichern? Sage dann „und speichere ihn" oder setze den Wert in Anführungszeichen.`,
        );
      }
      // Reicht der Wert bis zur nächsten Beschriftung, ohne Satzzeichen dazwischen, hat allein der
      // Feldname getrennt („Nachricht Bitte Empfänger prüfen …"). Das wird nicht geraten, sondern
      // der Person als Zuordnung gezeigt (`zuordnungPruefen`).
      anBeschriftung = Boolean(sortiert[i + 1]) && !befehl && !/[,;:.!?]\s*$/u.test(abschnitt);
    }
    if (!wert.trim()) {
      return klaerung(`Für „${m.label}" fehlt der Wert. Nenne ihn direkt nach der Beschriftung.`);
    }
    werte.push({
      label: m.label,
      wert,
      von: m.stelle.von,
      bis,
      zitiert: Boolean(zitat),
      anBeschriftung,
    });
  }
  return werte;
}

/**
 * Erkennt Formular, Felder mit Werten, Speichern und ein ausdrücklich genanntes Auslösen — allein
 * aus den Worten der Person und dem Profil der Seite.
 */
export function erkenneBrowserAuftrag(
  wortlaut: string,
  profil: BrowserSeitenprofil,
): BrowserErkennung {
  const text = wortlaut.replace(/\s+/g, " ").trim();
  if (!text) {
    return klaerung("Was soll Klara auf dieser Seite tun?");
  }
  const zit = zitate(text);
  // 1 · DAS FORMULAR: genannt — oder das einzige, in das Klara schreiben darf.
  const schreibbar = profil.formulare.filter((f) =>
    f.handlungen.some((h) => h.art === "entwurf_fuellen"),
  );
  const genannt = profil.formulare.filter((f) => fundstellen(text, f.name, zit).length > 0);
  const formular =
    genannt.length === 1
      ? genannt[0]
      : genannt.length === 0 && schreibbar.length === 1
        ? schreibbar[0]
        : undefined;
  if (!formular) {
    const namen = (genannt.length > 1 ? genannt : schreibbar).map((f) => f.name);
    return klaerung(
      namen.length > 0
        ? `Welches Formular ist gemeint: ${liste(namen)}? Nenne es im Auftrag.`
        : "Auf dieser Seite gibt es kein Formular, in das Klara schreiben darf.",
    );
  }
  // 2 · DIE FELDER: jede Beschriftung höchstens einmal als Feldbeginn, ihr Wert bis zur nächsten.
  // Direkt nach einem Bezugswort („auf Ihre Nachricht", „Wartung an Empfänger", „aus Betreff") ist
  // offen, ob sie ein Feld beginnt oder zum Wert davor gehört. Sie beginnt eines nur, wenn es
  // eindeutig ist: ausserhalb jedes Werts UND eingeleitet (Doppelpunkt, Anführungszeichen) oder als
  // erste Beschriftung nach reinen Auftragswörtern („Fülle den Angebotsentwurf aus Betreff …").
  // Steht sie dagegen in einem ungeklammerten Wert, wird geklärt — nie still in ein Feld gefaltet.
  const stark: Marke[] = [];
  const schwach: Marke[] = [];
  for (const label of formular.felder) {
    const stellen = fundstellen(text, label, zit);
    const sicher = stellen.filter(
      (s) => !BEZUGSWORT.test(text.slice(Math.max(0, s.von - 24), s.von)),
    );
    if (sicher.length > 1) return mehrfach(label);
    const stelle = sicher[0];
    if (stelle) {
      stark.push({ label, stelle });
    } else {
      schwach.push(...stellen.map((s) => ({ label, stelle: s })));
    }
  }
  const auftragswort = new Set(
    [...AUFTRAGSWORTE, ...profil.formulare.map((f) => f.name)].flatMap(woerter),
  );
  const eingeleitet = (s: Bereich) => /^\s*([:=]|[„“"»«‚])/u.test(text.slice(s.bis));
  const nurAuftragDavor = (s: Bereich) =>
    woerter(text.slice(0, s.von)).every((w) => !w || auftragswort.has(w));
  let marken: readonly Marke[] = stark;
  let werte: Wertstelle[];
  for (;;) {
    const w = werteAus(text, zit, marken);
    if (!Array.isArray(w)) return w;
    werte = w;
    const imWert = (s: Bereich) => w.find((b) => s.von > b.von && s.von < b.bis);
    const offen = schwach.filter((s) => !marken.some((m) => m.label === s.label));
    const neu = offen.filter(
      (s) => !imWert(s.stelle) && (eingeleitet(s.stelle) || nurAuftragDavor(s.stelle)),
    );
    if (neu.length === 0) {
      for (const s of offen) {
        const b = imWert(s.stelle);
        if (b && !b.zitiert) {
          return klaerung(
            `„${s.label}" steht im Wert von „${b.label}". Gehört es zum Wert, oder beginnt dort das Feld „${s.label}"? Setze den Wert von „${b.label}" in Anführungszeichen.`,
          );
        }
      }
      break;
    }
    const doppelt = neu.find((s) => neu.filter((x) => x.label === s.label).length > 1);
    if (doppelt) return mehrfach(doppelt.label);
    marken = [...marken, ...neu];
  }
  const felder: BrowserFeldwert[] = werte.map((w) => ({ label: w.label, wert: w.wert }));
  // 3 · DIE HANDLUNGEN stehen im Befehlsteil — nie in einem Wert.
  const befehlsteil = ohneBereiche(text, werte);
  const befehlswoerter = woerter(befehlsteil);
  for (const [verb, partikel] of TRENNBAR) {
    if (!befehlswoerter.some((w) => verb.test(w)) || befehlswoerter.includes(partikel)) continue;
    const endet = werte.find(
      (w) => !w.zitiert && woerter(w.wert).filter(Boolean).at(-1) === partikel,
    );
    if (endet) {
      return klaerung(
        `Gehört „${partikel}" zum Wert von „${endet.label}" oder zum Auftrag? Setze den Wert in Anführungszeichen.`,
      );
    }
  }
  const einschraenkung = EINSCHRAENKUNG.exec(befehlsteil);
  if (einschraenkung) {
    return klaerung(
      `Der Auftrag enthält eine Einschränkung („${einschraenkung[2]}"). Damit Klara nichts falsch ausführt: nenne nur, was jetzt geschehen soll.`,
    );
  }
  const ausloeser = formular.handlungen.filter((h) => h.art === "ausloesen" && h.knopf !== null);
  // Ein Knopf zählt nur mit seinen Wörtern in dieser Reihenfolge („Endgültig senden").
  const knopf =
    ausloeser.find((h) => fundstellen(befehlsteil, h.knopf ?? "", []).length > 0)?.knopf ?? null;
  const ohneKnopf = knopf
    ? ohneBereiche(befehlsteil, fundstellen(befehlsteil, knopf, []))
    : befehlsteil;
  // Jedes übrige Außenwort ist eine Handlung, die das Profil hier nicht trägt: der ganze Auftrag
  // wird übergeben, statt still einen Teil wegzulassen („… und bestelle", „… und übermittle").
  const aussen = AUSSENWORT.exec(ohneKnopf);
  if (aussen) {
    return { ok: false, art: "gesperrt", was: `„${aussen[2]}"` };
  }
  const speichern = SPEICHERWORT.test(ohneKnopf);
  // Was dann noch übrig ist, muss zum Auftragswortschatz gehören.
  const bekannt = new Set(
    [
      ...AUFTRAGSWORTE,
      ...profil.formulare.flatMap((f) => [f.name, ...f.felder]),
      ...formular.handlungen.flatMap((h) => (h.knopf ? [h.knopf] : [])),
    ].flatMap((w) => w.toLowerCase().split(/[^\p{L}\p{N}]+/u)),
  );
  const fremd = [
    ...new Set(
      ohneKnopf
        .toLowerCase()
        .split(/[^\p{L}\p{N}@.-]+/u)
        .map((w) => w.replace(/^[.-]+|[.-]+$/gu, ""))
        .filter((w) => w && !bekannt.has(w)),
    ),
  ];
  if (fremd.length > 0) {
    return klaerung(
      `Diese Wörter versteht Klara im Auftrag nicht sicher: ${fremd
        .slice(0, 5)
        .map((w) => `„${w}"`)
        .join(
          ", ",
        )}. Nenne Werte direkt nach der Feldbeschriftung oder in Anführungszeichen; sonst nur Formular, Felder, Speichern oder den Knopf.`,
    );
  }
  // Ein Klick ohne genannten Knopf und ohne Speichern („… und klicke auf den Knopf", „… und löse
  // aus"): welcher Knopf, wäre geraten — und still weglassen hiesse, einen Auftragsteil zu verschlucken.
  if (knopf === null && !speichern && KLICKWORT.test(ohneKnopf)) {
    const knoepfe = formular.handlungen.flatMap((h) =>
      h.knopf && (h.art === "entwurf_speichern" || h.art === "ausloesen") ? [h.knopf] : [],
    );
    return klaerung(
      knoepfe.length > 0
        ? `Welchen Knopf soll Klara drücken? Nenne ihn mit seinem Namen: ${liste(knoepfe)}.`
        : `Im Formular „${formular.name}" gibt es keinen Knopf, den Klara drücken darf.`,
    );
  }
  if (felder.length === 0 && !speichern && knopf === null) {
    return klaerung(
      `Was soll Klara im Formular „${formular.name}" tun? Nenne Felder mit Werten, etwa ${liste(formular.felder.slice(0, 2))}.`,
    );
  }
  return {
    ok: true,
    formular: formular.name,
    felder,
    speichern,
    ausloesen: knopf,
    zuordnungPruefen: werte.some((w) => w.anBeschriftung),
  };
}
