// ================================================================================================
// I18N-AUFTEILUNG (Aufnahme 20260922 · zentrale-module-aufteilen) — DAS WÖRTERBUCH IN VIER DATEIEN.
// ================================================================================================
//
// Bis zur Aufteilung trug `apps/web/src/i18n.ts` die drei Grundwörterbücher selbst (18.928 Zeilen).
// Jetzt stehen sie je Sprache in `apps/web/src/woerterbuch/{de,en,nl}.ts`, und `i18n.ts` importiert
// sie nur noch. Die Aufteilung ist eine REINE TEXTOPERATION: jeder Block ist Zeile für Zeile
// verschoben, kein Schlüssel und kein Wert ist angefasst.
//
// Diese Datei ist ihr Gegenstück. Sie fügt die vier Dateien wieder zu GENAU dem Text zusammen, der
// vorher in `i18n.ts` stand. Dass es wirklich derselbe ist, misst
// `tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts` gegen die unveränderte Kopie
// `tests/i18n-woerterbuch/i18n-vor-aufteilung.txt`. Seit der Integration von `main` (Nacharbeit 3)
// ist das die Datei des integrierten Hauptstands `a2ff8da8` — dieselbe Datei samt der dort
// hinzugekommenen Schlüssel und des R-0801-Nachladens (nachprüfbar ohne Test mit
// `git hash-object` gegen `git rev-parse a2ff8da8:apps/web/src/i18n.ts`, Blob `42ab6f8b…`). Seit
// Nacharbeit 5 ist es die Datei von `main` 1147c026 (Blob `1dbd6f42…`, dazu R-0247).
//
// WOZU DAS ZUSAMMENFÜGEN: rund fünfzig bestehende Prüfstände lesen das Wörterbuch als TEXT (sie
// suchen Schlüssel, Wortlaute und Verbote quer über alle drei Sprachen). Sie lesen ab hier
// `woerterbuchQuelle()` statt der Datei und sehen damit unverändert, was sie vorher sahen. Was das
// laufende i18next daraus macht, ist davon unberührt — es bekommt dieselben drei Objekte.
//
// JEDE ERSETZUNG IST FAIL-CLOSED: steht ein Anker nicht genau einmal da, bricht es mit Klartext ab,
// statt still einen anderen Text zu liefern.
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { repoPfad } from "./repoPfad";
import { GEAENDERTE_WERTE, type SpaetereWertaenderung } from "./woerterbuch-geaenderte-werte";
import { type Abschnitt, zeilenVergleich } from "./zeilenvergleich";

export const I18N_RELATIV = "apps/web/src/i18n.ts";

export const WOERTERBUCH_SPRACHEN = ["de", "en", "nl"] as const;
export type WoerterbuchSprache = (typeof WOERTERBUCH_SPRACHEN)[number];

export function woerterbuchRelativ(sprache: WoerterbuchSprache): string {
  return `apps/web/src/woerterbuch/${sprache}.ts`;
}

/** Was in `i18n.ts` vor der Aufteilung zwischen `htmlLang`- und `sprachwahl`-Import stand. */
const KOPF_ANKER = 'import { sprachAusEintritt } from "./lib/htmlLang";\n';
const KOPF_VORHER = [
  "// JOB 3326 R4: die Texte der Lesevariante wohnen bei ihrer Funktion, damit diese Woerterbuchdatei",
  "// unter dem 1-MiB-Deckel von Biome bleibt. Messung und Begruendung: `lib/lesevariante.ts`.",
  'import { lesevarianteTexteDe, lesevarianteTexteEn, lesevarianteTexteNl } from "./lib/lesevariante";',
  "",
].join("\n");

/** Die drei Importe, die die Aufteilung in `i18n.ts` gesetzt hat. */
export const WOERTERBUCH_IMPORTE = [
  'import { de } from "./woerterbuch/de";',
  'import { en } from "./woerterbuch/en";',
  'import { nl } from "./woerterbuch/nl";',
  "",
].join("\n");

/** Der Hinweis, der in `i18n.ts` an der Stelle der drei Blöcke steht (samt folgender Leerzeile). */
export const WOERTERBUCH_MARKE = [
  "// I18N-AUFTEILUNG (Aufnahme 20260922): die drei Grundwörterbücher wohnen je Sprache in",
  "// `woerterbuch/de.ts`, `woerterbuch/en.ts` und `woerterbuch/nl.ts` — Zeile für Zeile verschoben,",
  "// kein Schlüssel und kein Wert geändert. Neue Texte kommen in ein Textmodul (`texte/`).",
  "",
  "",
].join("\n");

/**
 * Der eine Kommentarabsatz, den die Aufteilung in `i18n.ts` umformulieren MUSSTE: R-0801 (Nachladen
 * von en/nl, integriert aus `main` a2ff8da8) beschrieb die drei Blöcke als „oben, wo sie sind". Nach
 * der Aufteilung wäre der Satz falsch; das Zusammenfügen setzt den früheren Wortlaut wieder ein.
 * Nur Kommentarzeilen, kein Code — und fail-closed wie jede andere Ersetzung hier.
 */
export const R0801_ABSATZ_JETZT = [
  "// Die drei Wörterbücher stehen je Sprache in `woerterbuch/` (I18N-AUFTEILUNG) und werden oben",
  "// statisch importiert. Getrennt wird erst im PRODUKTIONSBAU: das Plugin `sprachpaketeNachladen`",
  "// (`texte/intern/sprachpakete.ts`) nimmt die Importe von `en` und `nl` aus dieser Datei heraus,",
  "// liefert ihre Blöcke als eigene Stücke, ersetzt `{ en, nl }` in `VORLIEGEND` durch `{}` und trägt",
  "// in `NACHLADEN` je Sprache ein `import()` ein. Es bricht den Bau ab, wenn es einen seiner Anker",
  "// nicht genau einmal findet — sonst lägen beide Sprachen still wieder im Eintritt.",
  "",
].join("\n");
const R0801_ABSATZ_VORHER = [
  "// Die drei Blöcke oben bleiben, wo sie sind: diese Datei ist die eine Quelle aller Texte, und",
  "// zahlreiche Wächter lesen sie als Text. Getrennt wird erst im PRODUKTIONSBAU: das Plugin",
  "// `sprachpaketeNachladen` (`texte/intern/sprachpakete.ts`) schneidet die Blöcke `en` und `nl` als",
  "// eigene Stücke heraus, ersetzt `{ en, nl }` in `VORLIEGEND` durch `{}` und trägt in `NACHLADEN`",
  "// je Sprache ein `import()` ein. Es greift NUR auf die zwei Zeilen unten und bricht den Bau ab, wenn",
  "// es eine davon nicht genau einmal findet — sonst lägen beide Sprachen still wieder im Eintritt.",
  "",
].join("\n");

const GROSS: Record<WoerterbuchSprache, string> = { de: "De", en: "En", nl: "Nl" };

/** Der Vorspann einer Sprachdatei — alles vor `const <sprache>…`. */
export function woerterbuchVorspann(sprache: WoerterbuchSprache): string {
  return [
    `// GRUNDWÖRTERBUCH \`${sprache}\` — I18N-AUFTEILUNG (Aufnahme 20260922, zentrale-module-aufteilen).`,
    "//",
    "// Dieser Block stand bis zur Aufteilung in `apps/web/src/i18n.ts`. Er ist Zeile für Zeile hierher",
    "// verschoben; kein Schlüssel und kein Wert ist geändert (Beleg:",
    "// `tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts`). Neue Texte gehören in ein Textmodul",
    "// unter `apps/web/src/texte/` (docs/i18n-textmodule.md), nicht hierher.",
    `import { lesevarianteTexte${GROSS[sprache]} } from "../lib/lesevariante";`,
    ...(sprache === "de" ? [] : ['import type { de } from "./de";']),
    "",
    "",
  ].join("\n");
}

/** Der Nachspann einer Sprachdatei — alles nach dem schließenden `};` des Blocks. */
export function woerterbuchNachspann(sprache: WoerterbuchSprache): string {
  return `\nexport { ${sprache} };\n`;
}

export interface WoerterbuchTeile {
  i18n: string;
  de: string;
  en: string;
  nl: string;
}

/** Die vier Dateien, wie sie im Baum liegen. */
export function woerterbuchTeile(): WoerterbuchTeile {
  return {
    i18n: readFileSync(repoPfad(I18N_RELATIV), "utf8"),
    de: readFileSync(repoPfad(woerterbuchRelativ("de")), "utf8"),
    en: readFileSync(repoPfad(woerterbuchRelativ("en")), "utf8"),
    nl: readFileSync(repoPfad(woerterbuchRelativ("nl")), "utf8"),
  };
}

function einmal(text: string, anker: string, ersatz: string, wo: string): string {
  const teile = text.split(anker);
  if (teile.length !== 2) {
    throw new Error(`${wo}: der Anker steht ${teile.length - 1}-mal da, erwartet genau einmal`);
  }
  return `${teile[0]}${ersatz}${teile[1]}`;
}

/** Der verschobene Block einer Sprachdatei — fail-closed gegen Vor- und Nachspann. */
export function woerterbuchBlock(sprache: WoerterbuchSprache, datei: string): string {
  const vor = woerterbuchVorspann(sprache);
  const nach = woerterbuchNachspann(sprache);
  if (!datei.startsWith(vor) || !datei.endsWith(nach)) {
    throw new Error(
      `${woerterbuchRelativ(sprache)}: Vorspann oder Nachspann weicht ab — die Datei ist nicht mehr der reine verschobene Block`,
    );
  }
  return datei.slice(vor.length, datei.length - nach.length);
}

// ================================================================================================
// NACH DER AUFTEILUNG ERLAUBT ERGÄNZT — Aufnahme 20260922 · antwort-quellenanzeige (Ben zu e6eb2409).
// ================================================================================================
// Der Umzugsnachweis (W1) gilt dem Text, der VOR der Aufteilung stand. Neue Produkttexte, die ein
// späterer Auftrag ausdrücklich ergänzt, gehören nicht zu diesem historischen Umfang. Sie stehen hier
// BENANNT — Schlüssel und die Kommentarzeilen, die sie begründen —, und NUR der historische
// Vergleich (`woerterbuchQuelleHistorisch`, W1) nimmt GENAU diese Zeilen heraus; der volle Text für
// alle anderen Leser bleibt unberührt. Fail-closed wie `einmal`: steht ein Eintrag nicht genau einmal
// da, bricht es ab; eine stille Toleranz für irgendwelche neuen Zeilen gibt es nicht. Was W1 danach
// noch meldet, stammt NICHT aus diesen Ergänzungen. Gegenprobe: `tests/i18n-woerterbuch/
// ergaenzungen-antwort-quellenanzeige.test.ts`.
export const ERGAENZTE_SCHLUESSEL: readonly string[] = [
  // R-0326: die Lage der Belegstelle an der Lesefläche (BibliothekLesen).
  "lib.lesen.belegstelle.markiert",
  "lib.lesen.belegstelle.nichtGefunden",
  "lib.lesen.belegstelle.andereFassung",
  // R-0310: der Chip „+N" unter der Web-Antwort (Ask.tsx).
  "ask.quellen.weitere",
  // R-0310/R-0325: die zurückgehaltene Antwort bei unbekannter Zuordnung (Ask.tsx).
  "ask.zuordnungUnbekannt",
];

export const ERGAENZTE_KOMMENTARE: Readonly<Record<WoerterbuchSprache, readonly string[]>> = {
  de: [
    "  // R-0310/R-0325 (Ben zu 8e6c9d73): die Antwort ist zurückgehalten, weil sich kein Absatz einer",
    "  // Quelle zuordnen ließ. Zuordnung unbekannt macht einen unbelegten Absatz nicht ausgabefähig.",
    '  // R-0310: der Chip „+N" unter der Antwort — sein zugänglicher Name.',
  ],
  en: [
    "  // R-0310/R-0325: the answer is withheld because no paragraph could be attributed to a source.",
  ],
  nl: [
    "  // R-0310/R-0325: het antwoord wordt achtergehouden omdat geen alinea aan een bron toe te wijzen was.",
  ],
};

/** Der Block einer Sprache OHNE die benannten Ergänzungen — fail-closed (je Eintrag genau einmal). */
export function ohneErgaenzungen(sprache: WoerterbuchSprache, block: string): string {
  const zeilen = block.split("\n");
  const raus = new Set<number>();
  const genauEinmal = (treffer: number[], was: string): number => {
    if (treffer.length !== 1) {
      throw new Error(
        `${woerterbuchRelativ(sprache)}: ${was} steht ${treffer.length}-mal da, erwartet genau einmal`,
      );
    }
    return treffer[0] as number;
  };
  for (const kommentar of ERGAENZTE_KOMMENTARE[sprache]) {
    const treffer = zeilen.flatMap((z, i) => (z === kommentar ? [i] : []));
    raus.add(genauEinmal(treffer, `der Kommentar „${kommentar.trim()}"`));
  }
  for (const schluessel of ERGAENZTE_SCHLUESSEL) {
    const kopf = `  "${schluessel}":`;
    const treffer = zeilen.flatMap((z, i) => (z.startsWith(kopf) ? [i] : []));
    const i = genauEinmal(treffer, `der Schlüssel ${schluessel}`);
    raus.add(i);
    // Steht der Wert auf der Folgezeile (`"schluessel":` am Zeilenende), gehört sie dazu.
    if ((zeilen[i] ?? "").trimEnd() === kopf) {
      raus.add(i + 1);
    }
  }
  return zeilen.filter((_, i) => !raus.has(i)).join("\n");
}

// ================================================================================================
// SPÄTERE, BELEGTE ÄNDERUNGEN SEIT DEM BEZUGSPUNKT — Gesamtcheck R-1329, Nacharbeit 59 (W1).
// ================================================================================================
// W1 ist seit Nacharbeit 8 rot: der Bezugspunkt ist die ungeteilte `i18n.ts` von `main` 1147c026,
// der Baum trägt seither weitere Aufträge. Statt den Bezugspunkt zu ersetzen (dann bewiese W1 nichts
// mehr über die Aufteilung), ist jede spätere Abweichung hier EINZELN mit ihrem Beleg benannt:
//
//   SPAETERE_CODEAENDERUNGEN  — die Codestellen in `i18n.ts`, wörtlich jetzt → vorher, fail-closed
//                               über `einmal` (steht eine nicht genau einmal da, bricht es ab).
//   SPAETERE_REGISTER         — Schlüssel, die ein späterer Auftrag ergänzt oder deren Wert er
//                               geändert hat, und einzeln benannte Kommentarzeilen.
//
// `spaetereAenderungen` vergleicht den Bezugspunkt Zeile für Zeile mit dem rekonstruierten Stand
// (`./zeilenvergleich.ts`) und ordnet JEDEN Abweichungsabschnitt zu. Eine Zeile gilt nur als
// erklärt, wenn sie Kopf- oder Fortsetzungszeile eines registrierten Schlüssels ist — oder eine
// Kommentar-/Leerzeile, die mit einem solchen Schlüssel ergänzt wurde (gleicher Abschnitt oder
// unmittelbar daneben). Alles andere — ein fremder Schlüssel, ein geänderter Wert, ein umformulierter
// Kommentar, ein Codefragment — bleibt UNERKLÄRT und W1 rot. Umgekehrt ist jeder Registereintrag,
// dem keine Abweichung gehört, ein Fehler: das Register darf nichts vorhalten.

export interface SpaetereCodeaenderung {
  readonly beleg: string;
  readonly jetzt: string;
  readonly vorher: string;
}

export const SPAETERE_CODEAENDERUNGEN: readonly SpaetereCodeaenderung[] = [
  {
    beleg: "R-0997 / FR-I18N-02 (Sprachmenge aus den Ressourcen, lib/sprachregister.ts)",
    jetzt: [
      'import { sprachNachlader } from "./lib/sprachNachlader";',
      'import { OBERFLAECHEN_SPRACHEN, ladeWeitereSprache } from "./lib/sprachregister";',
      "",
    ].join("\n"),
    vorher: 'import { sprachNachlader } from "./lib/sprachNachlader";\n',
  },
  {
    beleg: "R-0997 / FR-I18N-02 (Kommentar zur Sprachmenge)",
    jetzt: [
      "// drei Sprachen sofort vor; der Nachlader (`lib/sprachNachlader.ts`) wird dann nie gefragt.",
      "//",
      "// R-0997 / FR-I18N-02: `en`/`nl` sind hier nur noch der Sonderfall des Produktionsschnitts, keine",
      "// Grenze der Sprachmenge mehr. Welche Sprachen die Oberfläche kann, kommt aus den Ressourcen",
      "// (`lib/sprachregister.ts`, `OBERFLAECHEN_SPRACHEN`): jede weitere `woerterbuch/<kürzel>.ts` wird",
      "// nachgeladen (`ladeWeitereSprache` in `nachladen` unten), und Textmodulvertrag wie Zusammenführung",
      "// laufen über genau diese Menge. Eine neue Sprache braucht keine Zeile in dieser Datei.",
      "",
    ].join("\n"),
    vorher:
      "// drei Sprachen sofort vor; der Nachlader (`lib/sprachNachlader.ts`) wird dann nie gefragt.\n",
  },
  {
    beleg:
      "R-0997 (Textmodulvertrag über OBERFLAECHEN_SPRACHEN) und R-0801 (Gesamtcheck R-1329, Nacharbeit 49: Textmodule nachgeladen)",
    jetzt: [
      "const basis = new Set(Object.keys(de));",
      "// R-0801 (Gesamtcheck R-1329, Nacharbeit 49): auch die Textmodule tragen alle drei Sprachen. Im",
      "// PRODUKTIONSBAU nimmt `sprachpaketeNachladen` ihre Blöcke en und nl aus den Modulen (an ihrer Stelle",
      "// steht ein leerer Block) und liefert sie im Paket `i18n.textmodule.<sprache>.js` zusammen mit dem",
      '// Wörterbuch nach; diese Zeile wird dann zu `["en", "nl"]`. Ein Modul, das ausserhalb dieser Datei',
      "// direkt importiert wird (etwa `texte/anmeldefehler` in `auth/maskenfehler.ts`), behält alle Blöcke.",
      "// Den vollen Vertrag prüfen weiter das Tor und das Build-Plugin `textmodul-vertrag` an den Quellen.",
      "const TEXTMODULE_NACHGELADEN: readonly string[] = [];",
      "const textmodulFehler = pruefeTextmodule(",
      "  textmodule,",
      "  basis,",
      "  OBERFLAECHEN_SPRACHEN,",
      "  TEXTMODULE_NACHGELADEN,",
      ");",
      "",
    ].join("\n"),
    vorher: "const textmodulFehler = pruefeTextmodule(textmodule, new Set(Object.keys(de)));\n",
  },
  {
    beleg: "R-0997 / FR-I18N-02 (Zusammenführung über OBERFLAECHEN_SPRACHEN)",
    jetzt: "const modulTexte = fuehreTextmoduleZusammen(textmodule, OBERFLAECHEN_SPRACHEN);\n",
    vorher: "const modulTexte = fuehreTextmoduleZusammen(textmodule);\n",
  },
  {
    beleg: "R-0997 / FR-I18N-02 (weitere Sprachen nachladen)",
    jetzt: [
      "    // R-0997: jede weitere, über `woerterbuch/` angemeldete Sprache — sonst nichts (Rückfall).",
      "    return ladeWeitereSprache(sprache, modulTexte[sprache]);",
      "",
    ].join("\n"),
    vorher: "    return undefined;\n",
  },
  {
    beleg: "R-1034 (im Betrieb gepflegte Texte, lib/textpflege.ts)",
    jetzt: [
      "    interpolation: { escapeValue: false },",
      "    // R-1034: im Betrieb gepflegte Texte kommen NACH dem ersten Zeichnen vom Server",
      "    // (`lib/textpflege.ts`). Ohne diese Bindung zeichnete React sie erst beim nächsten",
      "    // Sprachwechsel; mit ihr erscheint die Anpassung sofort.",
      '    react: { bindI18nStore: "added" },',
      "",
    ].join("\n"),
    vorher: "    interpolation: { escapeValue: false },\n",
  },
];

/** `i18n.ts` mit zurückgeführten späteren Codeänderungen — fail-closed je Eintrag. */
export function ohneSpaetereCodeaenderungen(
  i18n: string,
  aenderungen: readonly SpaetereCodeaenderung[] = SPAETERE_CODEAENDERUNGEN,
): string {
  return aenderungen.reduce(
    (text, a) => einmal(text, a.jetzt, a.vorher, `${I18N_RELATIV} (${a.beleg})`),
    i18n,
  );
}

export interface SpaetereSchluessel {
  readonly beleg: string;
  readonly schluessel: readonly string[];
}

export interface SpaetereKommentare {
  readonly beleg: string;
  /** Kommentarzeilen, wörtlich, die später hinzukamen. */
  readonly hinzu: readonly string[];
  /** Kommentarzeilen, wörtlich, die später entfielen. */
  readonly weg: readonly string[];
}

export interface SpaetereRegister {
  /** Schlüssel, die ein späterer Auftrag ergänzt hat — in allen drei Sprachen. */
  readonly ergaenzt: readonly SpaetereSchluessel[];
  /** Belegte Wertänderungen — je Sprache und Schlüssel mit wörtlichem Vorher- und Nachherwert. */
  readonly geaendert: readonly SpaetereWertaenderung[];
  /** Schlüssel, deren Eintrag nur anders umbrochen ist — gilt nur bei wörtlich gleichem Wert. */
  readonly umbrochen: readonly SpaetereSchluessel[];
  readonly kommentare: readonly SpaetereKommentare[];
}

export const SPAETERE_REGISTER: SpaetereRegister = {
  ergaenzt: [
    {
      beleg: "d7cd765ab Ask-Wartezustand und Abbruch",
      schluessel: [
        "ask.wartestand.dauer",
        "ask.wartestand.langsam",
        "ask.wartestand.abbrechen",
        "ask.wartestand.abgebrochen",
      ],
    },
    {
      beleg: "43cfa82d4 Ask erneuter Quellenbezug",
      schluessel: ["ask.quellenwechsel.titel", "ask.quellenwechsel.hinweis"],
    },
    {
      beleg: "f86286148 Quellenneubewertung",
      schluessel: [
        "ko.neubewertung.fehlt",
        "ko.neubewertung.hinweis",
        "ko.neubewertung.nachholen",
        "ko.neubewertung.nachgeholt",
      ],
    },
    {
      beleg: "af5f7a8f0 Profil-Mailbestätigung",
      schluessel: ["prof.emailPending", "prof.emailConfirm"],
    },
    {
      beleg: "93f3bf634 späte mobile Eingaben",
      schluessel: ["mob.spaeteEingabe", "mob.speichernLaeuft"],
    },
    {
      beleg: "Auftrag gesamt-ki-freigaberegeln (R-0606), shell/ExternStatus.tsx",
      schluessel: [
        "topbar.extern.blockiert",
        "topbar.extern.frei",
        "topbar.extern.freiVertraulich",
        "topbar.extern.hinweis",
      ],
    },
    { beleg: "R-0953/R-1015, lib/einblendungen.ts", schluessel: ["einblendung.erledigt"] },
    {
      beleg: "R-0582 (Kontokorrektur): services/auth/src/service.ts",
      schluessel: ["audit.action.user_account_corrected", "audit.action.user_freigabe_set"],
    },
    {
      beleg: "R-0541 (nur SSO) und R-0560 (SAML)",
      schluessel: ["auth.ssoOnlyNote", "auth.ssoOnlyMissing", "auth.samlButton"],
    },
    {
      beleg: "R-0961 Autorenübergabe, pages/MyTasks.tsx, lib/autorenuebergabe.ts",
      schluessel: [
        "task.filter.authorTransfer",
        "task.authorTransfer",
        "task.authorTransfer.grund.konto-geloescht",
        "task.authorTransfer.grund.ausgeschieden",
        "task.authorTransfer.grund.angefordert",
        "task.action.authorTransfer",
        "task.explain.authorTransfer",
        "ko.transferRequest",
        "ko.transferRequestHint",
        "ko.transferRequestDone",
      ],
    },
    {
      beleg: "PETER-20261011-P08 Firmenreset",
      schluessel: [
        "adm.factory.vorschau.entfernt",
        "adm.factory.vorschau.erhalten",
        "adm.factory.vorschau.kos",
        "adm.factory.vorschau.fragen",
        "adm.factory.vorschau.weitere",
        "adm.factory.vorschau.anmeldungen",
        "adm.factory.vorschau.konten",
        "adm.factory.vorschau.woerterbuch",
        "adm.factory.vorschau.protokoll",
        "adm.factory.checkbox",
        "adm.factory.password2Label",
        "adm.factory.sso.stand",
        "adm.factory.sso.schritt1",
        "adm.factory.sso.schritt2",
        "adm.factory.sso.nichtEingerichtet",
        "adm.factory.sso.fehler",
      ],
    },
    {
      beleg: "pages/AdminKiDetails.tsx (KI-Stufe je Aufgabe)",
      schluessel: [
        "adm.ai.stufe.titel",
        "adm.ai.stufe.text",
        "adm.ai.stufe.wieAufgabe",
        "adm.ai.stufe.keineKi",
        "adm.ai.stufe.gespeichert",
      ],
    },
    {
      beleg: "entscheidung:8b909a1e (Option A, bereits gespeicherter Entwurf)",
      schluessel: [
        "capture.bereitsGespeichert",
        "capture.bereitsGespeichertFortgeschrieben",
        "capture.bereitsGespeichertOeffnen",
      ],
    },
    {
      beleg: "KI-WAHL-BETRIEBSABNAHME · N-0087 (Interview-Ersatz) und N-0070 (Ausführer je Stufe)",
      schluessel: [
        "capture.ivErsatzGrundKeinModell",
        "capture.ivErsatzGrundZeit",
        "capture.ivErsatzGrundFehler",
        "capture.ivErsatzGrundVertraulich",
        "capture.ivErsatzGrundUnbekannt",
        "capture.ivErsatzWeiter",
        "erfassen.ki.ausfuehrer",
        "erfassen.ki.ausfuehrerUnbekannt",
        "erfassen.ki.verfuegbar",
        "erfassen.ki.nichtVerfuegbar",
        "erfassen.ki.einschraenkung.freigabe_fehlt",
        "erfassen.ki.einschraenkung.vertraulich_ohne_cloud",
        "erfassen.ki.einschraenkung.ki_abgeschaltet",
        "erfassen.ki.einschraenkung.nicht_erreichbar",
        "erfassen.ki.keineKiFuer",
        "erfassen.ki.jeStufe",
        "erfassen.ki.wirksam",
      ],
    },
    { beleg: "gesamt-integrations-api R-0842", schluessel: ["ask.gebremst.titel"] },
    {
      beleg: "R-0703 (Antwortexport) und R-1643 (Prüfprotokoll im Export)",
      schluessel: [
        "ask.export.docx",
        "ask.export.pptx",
        "ask.export.pdfDatei",
        "ask.export.pdfZeichen",
        "ask.export.protocol.heading",
        "ask.export.protocol.time",
        "ask.export.protocol.user",
        "ask.export.protocol.userUnknown",
        "ask.export.protocol.argumentation",
        "ask.export.protocol.supportedBy",
        "ask.export.protocol.argumentationMissing",
      ],
    },
    {
      beleg:
        "AUFNAHME 20260922 · Antwort-Erklärung (components/fragen/Belastbarkeit.tsx; services/ask/src/answer-belastbarkeit.ts)",
      schluessel: [
        "ask.belastbarkeit.titel",
        "ask.belastbarkeit.lage.belegt",
        "ask.belastbarkeit.lage.belegt_zustaendig_fehlt",
        "ask.belastbarkeit.lage.belegt_mit_konflikt",
        "ask.belastbarkeit.lage.wissensluecke",
        "ask.belastbarkeit.lage.technischer_fehler",
        "ask.belastbarkeit.lage.geschwaerzt",
        "ask.belastbarkeit.anzahl",
        "ask.belastbarkeit.vertrauenswert",
        "ask.belastbarkeit.vertrauenswertKeiner",
        "ask.belastbarkeit.vertrauenswertKurz",
        "ask.belastbarkeit.stand",
        "ask.belastbarkeit.quelle.validiert",
        "ask.belastbarkeit.quelle.nichtValidiert",
        "ask.belastbarkeit.verantwortung.eigentuemer",
        "ask.belastbarkeit.verantwortung.autor",
        "ask.belastbarkeit.erreichbar.ja",
        "ask.belastbarkeit.erreichbar.nein",
        "ask.belastbarkeit.erreichbar.unbekannt",
        "ask.belastbarkeit.grund.keine_tragfaehige_quelle",
        "ask.belastbarkeit.grund.zuordnung_unbekannt",
        "ask.belastbarkeit.grund.alle_tragenden_quellen_validiert",
        "ask.belastbarkeit.grund.tragende_quelle_nicht_validiert",
        "ask.belastbarkeit.grund.pruefnachweis_unvollstaendig",
        "ask.belastbarkeit.grund.offener_konflikt",
        "ask.belastbarkeit.grund.konfliktlage_unbekannt",
        "ask.belastbarkeit.grund.zustaendig_nicht_erreichbar",
        "ask.belastbarkeit.grund.erreichbarkeit_unbekannt",
        "ask.belastbarkeit.grund.verantwortung_nur_autor",
        "ask.belastbarkeit.konflikt.titel",
        "ask.belastbarkeit.konflikt.seite",
        "ask.belastbarkeit.konflikt.traegt",
        "ask.belastbarkeit.konflikt.nichtEinsehbar",
        "ask.belastbarkeit.konflikt.keinGewinner",
        "ask.belastbarkeit.hinweis",
        "ask.belastbarkeit.argumentation.titel",
        "ask.belastbarkeit.argumentation.belegstelle",
        "ask.belastbarkeit.argumentation.art.aussage",
        "ask.belastbarkeit.woerterbuch.titel",
        "ask.belastbarkeit.woerterbuch.eintrag",
        "ask.belastbarkeit.woerterbuch.verantwortlich",
        "ask.belastbarkeit.woerterbuch.ohneVerantwortung",
        "ask.belastbarkeit.woerterbuch.nichtBewertet",
        "ask.belastbarkeit.argumentation.art.beziehung",
        "ask.belastbarkeit.argumentation.beziehung.gehoert_zu",
        "ask.belastbarkeit.argumentation.beziehung.ergaenzt",
        "ask.belastbarkeit.argumentation.beziehung.ersetzt",
        "ask.belastbarkeit.argumentation.beziehung.widerspricht",
        "ask.belastbarkeit.argumentation.beziehung.beispiel_fuer",
        "ask.belastbarkeit.argumentation.gesetztVon",
        "ask.belastbarkeit.argumentation.gestuetztAuf",
        "ask.belastbarkeit.argumentation.unabhaengig",
        "ask.belastbarkeit.argumentation.art.einwand",
        "ask.belastbarkeit.argumentation.art.vorbehalt",
        "ask.belastbarkeit.argumentation.art.schluss",
        "ask.belastbarkeit.argumentation.einstufung.verified",
        "ask.belastbarkeit.argumentation.einstufung.unverified",
        "ask.belastbarkeit.argumentation.einstufung.gap",
        "ask.belastbarkeit.wissensart.bauchgefuehl",
        "ask.belastbarkeit.wissensart.best_practice",
        "ask.belastbarkeit.wissensart.lernkurve",
        "ask.belastbarkeit.wissensart.technik",
        "ask.belastbarkeit.wissensart.negativwissen",
        "ask.belastbarkeit.zuschnitt",
        "ask.belastbarkeit.rolle.viewer",
        "ask.belastbarkeit.rolle.experte",
        "ask.belastbarkeit.rolle.controller",
        "ask.belastbarkeit.rolle.admin",
        "ask.belastbarkeit.rolle.unbekannt",
        "ask.belastbarkeit.anlass.dokument",
        "ask.belastbarkeit.anlass.frage",
        "ask.pruefrahmen.satz",
        "ask.pruefrahmen.umfang.validiert",
        "ask.pruefrahmen.umfang.nicht_vertraulich",
        "ask.pruefrahmen.woertlich",
      ],
    },
    { beleg: "gesamt-wissen-herkunft K3", schluessel: ["ko.authorDeleted"] },
    {
      beleg: "PMO-FEA-0003, components/start/LiveWallValidiert.tsx (R-0918)",
      schluessel: [
        "start.livewall.validated",
        "start.livewall.validatedEmpty",
        "start.livewall.nameConsent",
        "start.livewall.photoConsent",
        "start.livewall.photoAdd",
        "start.livewall.photoReplace",
        "start.livewall.photoRevoke",
        "start.livewall.photoError",
        "start.livewall.consentError",
        "start.livewall.photoRevokeError",
        "start.livewall.photoAlt",
        "start.livewall.photoOwnAlt",
        "start.livewall.beamerOpen",
        "start.livewall.beamerFullscreen",
        "start.livewall.beamerLoading",
        "start.livewall.beamerError",
        "start.livewall.beamerStale",
      ],
    },
    { beleg: "gesamt-konfliktboard FR-CON-04", schluessel: ["con.caseList"] },
    {
      beleg:
        "R-0681/FR-LIB-02 (produkt:20261010:poc-wiederherstellung-export), lib/libraryExport.ts",
      schluessel: ["lib.format.paket"],
    },
    {
      beleg: "gesamt-ocr R-0121 Nacharbeit 6",
      schluessel: ["imp.gallery.hintAvtranscriptActive"],
    },
    {
      beleg: "R-0920, pages/ImportLauf.tsx",
      schluessel: [
        "imp.lauf.oeffnen",
        "imp.lauf.titel",
        "imp.lauf.lead",
        "imp.lauf.kennung",
        "imp.lauf.ausgang",
        "imp.lauf.nichtGefunden",
        "imp.lauf.zaehler.gesamt",
        "imp.lauf.zaehler.angelegt",
        "imp.lauf.zaehler.gebunden",
        "imp.lauf.zaehler.uebersprungen",
        "imp.lauf.zaehler.gescheitert",
        "imp.lauf.gestartet",
        "imp.lauf.beendet",
        "imp.lauf.nochNichtBeendet",
        "imp.lauf.zurueck",
      ],
    },
    {
      beleg: "R-0953, components/BereichsprofilPflege.tsx, pages/Risk.tsx, pages/Lifecycle.tsx",
      schluessel: [
        "risk.pflege.retirementSaved",
        "risk.pflege.retirementNotRefreshed",
        "risk.pflege.profileSaved",
        "risk.pflege.profileError",
        "risk.pflege.retirementError",
        "risk.closeWithTitle",
        "risk.closeFailed",
        "risk.gapToast.closed",
        "risk.gapToast.assigned",
        "risk.gapToast.assignFailed",
        "risk.gapToast.removed",
        "risk.gapToast.removeFailed",
        "risk.gapToast.prioritySaved",
        "risk.gapToast.priorityFailed",
        "lcy.toast.revalidateFailed",
        "lcy.toast.stepDone",
        "lcy.toast.stepFailed",
      ],
    },
    {
      beleg: "R-0582 DS13 (Kontokorrektur durch Verwaltung und im Profil)",
      schluessel: [
        "adm.correct",
        "adm.correctSave",
        "adm.correctDone",
        "prof.correctTitle",
        "prof.correctPassword",
        "prof.correctSubmit",
        "prof.correctSaved",
        "prof.correctUnchanged",
        "prof.correctSso",
        "prof.correctSaml",
        "prof.correctSsoConfirmed",
        "prof.correctSsoKontoGewechselt",
      ],
    },
    {
      beleg: "R-0956/R-1023, lib/emptyStateActions.ts und lib/knowledgeStory.ts",
      schluessel: [
        "empty.cta.wissensnetz",
        "empty.cta.ask",
        "story.surface.gaps.lead",
        "story.surface.lifecycle.lead",
        "story.surface.duplicates.lead",
        "story.surface.audit.lead",
        "story.surface.neighborhood.lead",
        "story.surface.risk.lead",
        "story.surface.objekt.lead",
        "story.surface.entwuerfe.lead",
        "story.surface.verwaltung.lead",
        "story.surface.auswertung.lead",
        "story.surface.import.lead",
        "story.surface.anleitung.lead",
        "story.surface.spaces.lead",
        "story.surface.ausgang.lead",
        "story.surface.wissensnetz.lead",
        "story.surface.meldungen.lead",
        "story.surface.horizont.lead",
        "story.surface.lernpfad.lead",
        "story.surface.hilfe.lead",
        "story.surface.gliederung.lead",
        "story.surface.conflicts.lead",
      ],
    },
    {
      beleg: "R-0603/R-0604 gesamt-ki-kennzeichnung",
      schluessel: [
        "klara.helpAnswerTitle",
        "klara.ohneModell",
        "ai.surfaceNotice",
        "ergebnisStufe.entwurf",
        "ergebnisStufe.empfehlung",
        "ergebnisStufe.validiert",
      ],
    },
    {
      beleg: "FR-MOB-02/FR-CAP-04 (mobile Erfassung)",
      schluessel: [
        "mob.modusGruppe",
        "mob.modusGesperrt",
        "mob.iv.frage1",
        "mob.iv.frage2",
        "mob.iv.frage3",
        "mob.iv.frage4",
        "mob.iv.fortschritt",
        "mob.iv.weiter",
        "mob.iv.zurueck",
        "mob.iv.hinweis",
        "mob.foto.kamera",
        "mob.foto.mediathek",
        "mob.foto.entfernen",
        "mob.foto.fehler",
        "mob.foto.max",
        "mob.foto.inArbeit",
      ],
    },
    {
      beleg: "gesamt-sprachassistent R-0104",
      schluessel: [
        "sprachaufnahme.start",
        "sprachaufnahme.stop",
        "sprachaufnahme.frage",
        "sprachaufnahme.verarbeitet",
        "sprachaufnahme.keinMikrofon",
        "sprachaufnahme.fehler",
      ],
    },
    {
      beleg: "produkt:20261007:arbeitswege-objekt",
      schluessel: [
        "arbeitsweg.pruefen.sucht",
        "arbeitsweg.pruefen.fehlt",
        "arbeitsweg.pruefen.lesen",
        "arbeitsweg.pruefen.entschieden",
        "arbeitsweg.pruefen.oeffnen",
        "arbeitsweg.pruefen.standOffen",
        "arbeitsweg.pruefen.standRaus",
        "arbeitsweg.pruefen.weiter",
        "arbeitsweg.fassung",
        "arbeitsweg.fragen.bezug",
        "arbeitsweg.fragen.zurueck",
        "arbeitsweg.lesen.fassungAbweichend",
        "arbeitsweg.klara.label",
        "arbeitsweg.klara.chat",
      ],
    },
    {
      beleg: "produkt:20261010:fragen-pruefen-einstieg",
      schluessel: [
        "fragenEinstieg.erklaerung",
        "fragenEinstieg.ersterSchritt",
        "fragenEinstieg.beispieleZeigen",
        "fragenEinstieg.beispieleVerbergen",
        "fragenEinstieg.fiktiv",
        "fragenEinstieg.fiktivTitel",
        "fragenEinstieg.optionalTitel",
        "pruefgrund.label.warum",
        "pruefgrund.label.was",
        "pruefgrund.label.wirkung",
        "pruefgrund.label.sichtbar",
        "pruefgrund.anlass.new",
        "pruefgrund.anlass.revision",
        "pruefgrund.warum.mir",
        "pruefgrund.warum.andere",
        "pruefgrund.warum.offen",
        "pruefgrund.wirkung",
      ],
    },
  ],
  // R-0962 und P08: 12 Schlüssel × 3 Sprachen, wörtlich in `./woerterbuch-geaenderte-werte.ts`.
  geaendert: GEAENDERTE_WERTE,
  umbrochen: [
    {
      beleg:
        "woerterbuch/nl.ts unter Biome (biome.json lineWidth 100): einzeilig 101 Zeichen breit (gezählt), Wert unverändert; ein Auftrag für den Umbruch ist nicht belegt",
      schluessel: ["capture.ocrRunning"],
    },
  ],
  kommentare: [
    {
      beleg: "Aufnahme 20260922 · Prüfboard-Bedienung (N-0072), apps/web/src/texte/pruefboard.ts",
      hinzu: [
        "  // NACHTRAG Aufnahme 20260922 · Prüfboard-Bedienung (N-0072): der Inhalt WIRD jetzt durchsucht.",
        "  // Das Feld trägt seitdem `pruefboard.volltextFiltern` (apps/web/src/texte/pruefboard.ts). Dieser",
        "  // Wert bleibt unverändert stehen, weil der Umzugsnachweis (tests/i18n-textmodule) ihn festhält.",
      ],
      weg: [],
    },
  ],
};

export interface SpaetereAenderungenBefund {
  /** Abweichende Zeilen ohne Zuordnung — `-` Bezugspunkt, `+` Baum, Zeilennummer 1-basiert. */
  readonly unerklaert: readonly string[];
  /** Registereinträge ohne zugehörige Abweichung oder im Widerspruch zum Bezugspunkt. */
  readonly unbenutzt: readonly string[];
  /** Der Baumstand mit allen ERKLÄRTEN Abschnitten auf ihre Bezugsfassung zurückgesetzt. */
  readonly zurueckgefuehrt: string;
}

interface Abweichung {
  readonly seite: "-" | "+";
  readonly zeile: number;
  readonly text: string;
}

const SCHLUESSELZEILE = /^ {2}"([^"]+)":/;

function istFortsetzung(zeile: string): boolean {
  return /^ {4,}\S/.test(zeile) && !zeile.trimStart().startsWith("//");
}

function istKommentarOderLeer(zeile: string): boolean {
  return zeile.trim() === "" || zeile.trimStart().startsWith("//");
}

/** Der Schlüssel, dem die Zeile gehört (Kopf- oder Fortsetzungszeile) — sonst nichts. */
function eignerSchluessel(zeilen: readonly string[], i: number): string | undefined {
  for (let j = i; j >= 0; j -= 1) {
    const zeile = zeilen[j] ?? "";
    const kopf = SCHLUESSELZEILE.exec(zeile);
    if (kopf) {
      return kopf[1];
    }
    if (!istFortsetzung(zeile)) {
      return undefined;
    }
  }
  return undefined;
}

/** Der Eintrag ab Kopfzeile `i`: Kopf und Fortsetzung, getrimmt, mit Leerzeichen verbunden. */
function eintragAb(zeilen: readonly string[], i: number): string {
  const teile = [(zeilen[i] ?? "").trim()];
  for (let j = i + 1; j < zeilen.length && istFortsetzung(zeilen[j] ?? ""); j += 1) {
    teile.push((zeilen[j] ?? "").trim());
  }
  return teile.join(" ");
}

/** Jeder Eintrag des Schlüssels: Kopf und Fortsetzung, getrimmt, mit Leerzeichen verbunden. */
function eintraege(zeilen: readonly string[], schluessel: string): string[] {
  const ergebnis: string[] = [];
  for (let i = 0; i < zeilen.length; i += 1) {
    if (SCHLUESSELZEILE.exec(zeilen[i] ?? "")?.[1] === schluessel) {
      ergebnis.push(eintragAb(zeilen, i));
    }
  }
  return ergebnis;
}

const SPRACHKOPF = /^const (de|en|nl)\b/;

/** Je Zeile die Sprache des Wörterbuchblocks, in dem sie steht (ab `const de = {` usw.). */
function sprachenJeZeile(zeilen: readonly string[]): (string | undefined)[] {
  let sprache: string | undefined;
  return zeilen.map((zeile) => {
    sprache = SPRACHKOPF.exec(zeile)?.[1] ?? sprache;
    return sprache;
  });
}

/** Je Schlüssel die Zeilen, in denen sein Kopf steht. */
function kopfzeilen(zeilen: readonly string[]): Map<string, number[]> {
  const index = new Map<string, number[]>();
  for (let i = 0; i < zeilen.length; i += 1) {
    const schluessel = SCHLUESSELZEILE.exec(zeilen[i] ?? "")?.[1];
    if (schluessel === undefined) {
      continue;
    }
    const liste = index.get(schluessel);
    if (liste) {
      liste.push(i);
    } else {
      index.set(schluessel, [i]);
    }
  }
  return index;
}

/**
 * Die Werte eines Schlüssels in einer Sprache, als Zeichenkette gelesen. Ist ein Wert kein
 * einfaches Literal in doppelten Anführungszeichen, steht dort `undefined` (fail-closed: das
 * stimmt mit keinem belegten Wert überein).
 */
function werteIn(
  zeilen: readonly string[],
  kopf: ReadonlyMap<string, readonly number[]>,
  sprachen: readonly (string | undefined)[],
  sprache: string,
  schluessel: string,
): (string | undefined)[] {
  const vorsatz = `"${schluessel}":`;
  const werte: (string | undefined)[] = [];
  for (const i of kopf.get(schluessel) ?? []) {
    if (sprachen[i] !== sprache) {
      continue;
    }
    const rest = eintragAb(zeilen, i).slice(vorsatz.length).trim();
    const literal = rest.endsWith(",") ? rest.slice(0, -1) : rest;
    try {
      const wert: unknown = JSON.parse(literal);
      werte.push(typeof wert === "string" ? wert : undefined);
    } catch {
      werte.push(undefined);
    }
  }
  return werte;
}

/**
 * Ordnet jede Abweichung zwischen Bezugspunkt (`vorher`) und rekonstruiertem Baum (`nachher`)
 * einem Eintrag aus `register` zu. Ohne Zuordnung landet die Zeile in `unerklaert`.
 */
export function spaetereAenderungen(
  vorher: string,
  nachher: string,
  register: SpaetereRegister = SPAETERE_REGISTER,
): SpaetereAenderungenBefund {
  const a = vorher.split("\n");
  const b = nachher.split("\n");
  const unbenutzt: string[] = [];
  const belegVon = new Map<string, string>();
  const ergaenzt = new Set<string>();
  const geaendert = new Set<string>();
  const imBezug = new Set(a.flatMap((z) => SCHLUESSELZEILE.exec(z)?.[1] ?? []));
  for (const { beleg, schluessel } of register.ergaenzt) {
    for (const s of schluessel) {
      if (imBezug.has(s)) {
        unbenutzt.push(`${beleg}: ${s} als ergänzt benannt, steht aber im Bezugspunkt`);
      }
      ergaenzt.add(s);
      belegVon.set(s, beleg);
    }
  }
  // Wertänderungen gelten je Sprache und Schlüssel (`"<sprache> <schluessel>"`), und nur, wenn der
  // Bezugspunkt genau einmal den belegten Vorherwert und der Baum genau einmal den belegten
  // Nachherwert trägt. Ein anderer Wert, ein entfernter oder doppelter Schlüssel und eine andere
  // Sprache machen den Eintrag ungültig — dann bleiben seine Zeilen unerklärt.
  const spracheA = sprachenJeZeile(a);
  const spracheB = sprachenJeZeile(b);
  const kopfA = kopfzeilen(a);
  const kopfB = kopfzeilen(b);
  const benannt = new Set<string>();
  for (const e of register.geaendert) {
    const id = `${e.sprache} ${e.schluessel}`;
    const wo = `${e.beleg}: ${id}`;
    const vorherWerte = werteIn(a, kopfA, spracheA, e.sprache, e.schluessel);
    const nachherWerte = werteIn(b, kopfB, spracheB, e.sprache, e.schluessel);
    if (benannt.has(id)) {
      unbenutzt.push(`${wo} doppelt benannt`);
      geaendert.delete(id);
    } else if (ergaenzt.has(e.schluessel)) {
      unbenutzt.push(`${wo} zugleich als ergänzt und als geändert benannt`);
    } else if (e.vorher === e.nachher) {
      unbenutzt.push(`${wo}: Vorher- und Nachherwert sind gleich`);
    } else if (vorherWerte.length !== 1 || vorherWerte[0] !== e.vorher) {
      unbenutzt.push(`${wo}: belegter Vorherwert nicht genau einmal im Bezugspunkt`);
    } else if (nachherWerte.length !== 1 || nachherWerte[0] !== e.nachher) {
      unbenutzt.push(`${wo}: belegter Nachherwert nicht genau einmal im Baum`);
    } else {
      geaendert.add(id);
      belegVon.set(id, e.beleg);
    }
    benannt.add(id);
  }
  // Nur umbrochen: gilt allein, wenn jeder Eintrag des Schlüssels (Kopf samt Fortsetzung,
  // Leerraum zusammengezogen) vorher und nachher wörtlich gleich ist. Sonst bleibt er rot.
  const umbrochen = new Set<string>();
  for (const { beleg, schluessel } of register.umbrochen) {
    for (const s of schluessel) {
      belegVon.set(s, beleg);
      if (!imBezug.has(s)) {
        unbenutzt.push(`${beleg}: ${s} als umbrochen benannt, fehlt aber im Bezugspunkt`);
      } else if (eintraege(a, s).join("\n") !== eintraege(b, s).join("\n")) {
        unbenutzt.push(`${beleg}: ${s} als umbrochen benannt, aber der Wert hat sich geändert`);
      } else {
        umbrochen.add(s);
      }
    }
  }
  const benannteKommentare = new Map<string, string>();
  for (const { beleg, hinzu, weg } of register.kommentare) {
    for (const z of hinzu) {
      benannteKommentare.set(`+${z}`, beleg);
    }
    for (const z of weg) {
      benannteKommentare.set(`-${z}`, beleg);
    }
  }

  const benutzt = new Set<string>();
  const abschnitte = zeilenVergleich(a, b);
  // Je Abschnitt: die nicht zugeordneten Zeilen, und ob er einen registrierten Schlüssel trägt.
  const offen: Abweichung[][] = [];
  const traegtSchluessel: boolean[] = [];
  for (const abschnitt of abschnitte) {
    const rest: Abweichung[] = [];
    const kommentare: Abweichung[] = [];
    let mitSchluessel = false;
    let mitGeaendert = false;
    for (let t = 0; t < abschnitt.vorher.length; t += 1) {
      const zeile = abschnitt.vorherAb + t;
      const text = abschnitt.vorher[t] ?? "";
      const eigner = eignerSchluessel(a, zeile);
      const id = `${spracheA[zeile]} ${eigner}`;
      if (eigner !== undefined && umbrochen.has(eigner)) {
        benutzt.add(eigner);
      } else if (eigner !== undefined && geaendert.has(id)) {
        benutzt.add(id);
        mitSchluessel = true;
        mitGeaendert = true;
      } else {
        (istKommentarOderLeer(text) ? kommentare : rest).push({ seite: "-", zeile, text });
      }
    }
    for (let t = 0; t < abschnitt.nachher.length; t += 1) {
      const zeile = abschnitt.nachherAb + t;
      const text = abschnitt.nachher[t] ?? "";
      const eigner = eignerSchluessel(b, zeile);
      const id = `${spracheB[zeile]} ${eigner}`;
      if (eigner !== undefined && umbrochen.has(eigner)) {
        benutzt.add(eigner);
      } else if (eigner !== undefined && geaendert.has(id)) {
        benutzt.add(id);
        mitSchluessel = true;
      } else if (eigner !== undefined && ergaenzt.has(eigner)) {
        benutzt.add(eigner);
        mitSchluessel = true;
      } else {
        (istKommentarOderLeer(text) ? kommentare : rest).push({ seite: "+", zeile, text });
      }
    }
    for (const k of kommentare) {
      const merkmal = `${k.seite}${k.text}`;
      if (benannteKommentare.has(merkmal)) {
        benutzt.add(merkmal);
        continue;
      }
      // Ergänzte Kommentar-/Leerzeilen begleiten den Schlüssel, mit dem sie kamen; entfallene
      // Leerzeilen ebenso. Ein entfallener KOMMENTAR nur dort, wo ein Wert geändert wurde.
      const leer = k.text.trim() === "";
      const begleitet = k.seite === "+" || leer ? mitSchluessel : mitGeaendert;
      if (!begleitet) {
        rest.push(k);
      }
    }
    offen.push(rest);
    traegtSchluessel.push(mitSchluessel);
  }

  // Ein Abschnitt aus NUR ergänzten Kommentar-/Leerzeilen gilt als Begleitung, wenn ihn höchstens
  // `NAH` gleiche Kommentar-/Leerzeilen von einem Abschnitt mit registriertem Schlüssel trennen.
  const NAH = 3;
  const lueckeHarmlos = (von: number, bis: number): boolean =>
    bis - von <= NAH && b.slice(von, bis).every(istKommentarOderLeer);
  for (let i = 0; i < abschnitte.length; i += 1) {
    const abschnitt = abschnitte[i] as Abschnitt;
    const rest = offen[i] ?? [];
    const nurNeueKommentare =
      !traegtSchluessel[i] &&
      rest.length > 0 &&
      abschnitt.vorher.length === 0 &&
      rest.every((z) => istKommentarOderLeer(z.text));
    if (!nurNeueKommentare) {
      continue;
    }
    const davor = abschnitte[i - 1];
    const danach = abschnitte[i + 1];
    const nebenDavor =
      davor !== undefined &&
      traegtSchluessel[i - 1] === true &&
      lueckeHarmlos(davor.nachherAb + davor.nachher.length, abschnitt.nachherAb);
    const nebenDanach =
      danach !== undefined &&
      traegtSchluessel[i + 1] === true &&
      lueckeHarmlos(abschnitt.nachherAb + abschnitt.nachher.length, danach.nachherAb);
    if (nebenDavor || nebenDanach) {
      offen[i] = [];
    }
  }

  const unerklaert = offen.flatMap((rest) =>
    rest.map((z) => `${z.seite} Z.${z.zeile + 1}: ${z.text}`),
  );

  for (const s of [...ergaenzt, ...geaendert, ...umbrochen]) {
    if (!benutzt.has(s)) {
      unbenutzt.push(`${belegVon.get(s)}: ${s} — im Vergleich keine Abweichung zugeordnet`);
    }
  }
  for (const [merkmal, beleg] of benannteKommentare) {
    if (!benutzt.has(merkmal)) {
      unbenutzt.push(`${beleg}: Kommentar „${merkmal}" — keine Abweichung zugeordnet`);
    }
  }

  // Der Baumstand, die erklärten Abschnitte auf den Bezugspunkt zurückgesetzt. Ist alles erklärt,
  // muss genau der Bezugspunkt herauskommen — das prüft zugleich die gleichen Zeilen dazwischen.
  const zurueck: string[] = [];
  let pos = 0;
  for (let i = 0; i < abschnitte.length; i += 1) {
    const abschnitt = abschnitte[i] as Abschnitt;
    const erklaert = (offen[i] ?? []).length === 0;
    zurueck.push(...b.slice(pos, abschnitt.nachherAb));
    zurueck.push(...(erklaert ? abschnitt.vorher : abschnitt.nachher));
    pos = abschnitt.nachherAb + abschnitt.nachher.length;
  }
  zurueck.push(...b.slice(pos));

  return { unerklaert, unbenutzt, zurueckgefuehrt: zurueck.join("\n") };
}

/**
 * Der Umzugsnachweis in seinem HISTORISCHEN Umfang: wie `fuegeWoerterbuchZusammen`, aber ohne die
 * oben benannten, nach der Aufteilung erlaubt ergänzten Zeilen und mit den benannten späteren
 * Codeänderungen in `i18n.ts` auf ihren Bezugswortlaut zurückgeführt (`SPAETERE_CODEAENDERUNGEN`).
 * NUR für W1 — alle übrigen Leser (`woerterbuchQuelle()`, über 30 Prüfungen auf Schlüssel und
 * Texte) sehen weiter den VOLLEN Text.
 */
export function fuegeWoerterbuchZusammenHistorisch(teile: WoerterbuchTeile): string {
  return fuegeWoerterbuchZusammen({
    i18n: ohneSpaetereCodeaenderungen(teile.i18n),
    de: ohneErgaenzungenDatei("de", teile.de),
    en: ohneErgaenzungenDatei("en", teile.en),
    nl: ohneErgaenzungenDatei("nl", teile.nl),
  });
}

/** Der historische Vergleichstext aus dem Baum — `woerterbuchQuelle()` ohne die benannten Ergänzungen. */
export function woerterbuchQuelleHistorisch(): string {
  return fuegeWoerterbuchZusammenHistorisch(woerterbuchTeile());
}

/** Eine ganze Sprachdatei ohne die Ergänzungen — Vor- und Nachspann bleiben, wie sie sind. */
function ohneErgaenzungenDatei(sprache: WoerterbuchSprache, datei: string): string {
  const block = woerterbuchBlock(sprache, datei);
  return `${woerterbuchVorspann(sprache)}${ohneErgaenzungen(sprache, block)}${woerterbuchNachspann(sprache)}`;
}

/** Die Umkehrung der Aufteilung: der Text von `i18n.ts`, wie er vorher war. */
export function fuegeWoerterbuchZusammen(teile: WoerterbuchTeile): string {
  const bloecke = WOERTERBUCH_SPRACHEN.map((sprache) => woerterbuchBlock(sprache, teile[sprache]));
  let text = einmal(teile.i18n, KOPF_ANKER, `${KOPF_ANKER}${KOPF_VORHER}`, I18N_RELATIV);
  text = einmal(text, WOERTERBUCH_IMPORTE, "", I18N_RELATIV);
  text = einmal(text, R0801_ABSATZ_JETZT, R0801_ABSATZ_VORHER, I18N_RELATIV);
  return einmal(text, WOERTERBUCH_MARKE, `${bloecke.join("\n")}\n`, I18N_RELATIV);
}

/** Das Wörterbuch als EIN Text — genau der frühere Inhalt von `apps/web/src/i18n.ts`. */
export function woerterbuchQuelle(): string {
  return fuegeWoerterbuchZusammen(woerterbuchTeile());
}

/**
 * Wie `woerterbuchQuelle()`, für Prüfstände, die den Pfad als eigene Konstante führen (relativ
 * zum Startverzeichnis, zur Testdatei oder absolut). Der Pfad muss auf `apps/web/src/i18n.ts`
 * zeigen — sonst ist es ein Testfehler, kein stiller Rückfall auf eine andere Datei.
 */
export function woerterbuchQuelleAus(pfad: string): string {
  const ende = I18N_RELATIV.split("/").join(sep);
  if (!resolve(pfad).endsWith(ende)) {
    throw new Error(`woerterbuchQuelleAus: ${pfad} ist nicht ${I18N_RELATIV}`);
  }
  return woerterbuchQuelle();
}
