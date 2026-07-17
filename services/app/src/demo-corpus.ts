// SCRUM-487 (Confluence-Demo-Korpus): ein versioniertes Repo-Artefakt, damit VIP-2/12.08. den
// Showcase reproduzierbar aufsetzen können. Dreisprachig (DE Basis, EN, NL) — die Sprache folgt
// der System-/UI-Sprache des ladenden Admins (siehe demo-content.ts, dieselbe Entscheidung).
//
// Der Korpus ist ein kompakter, aber VOLLSTÄNDIGER Demo-Space: die kleinste Seitenzahl, die alle
// drei Showcase-Effekte trägt — 8 Seiten (24 gesamt über drei Sprachen):
//   • 2 Konfliktpaare (4 Seiten): eingebaute Widersprüche mit wörtlichem Streitwert je Sprache
//       – Farbe:  blau / blue / blauw   ↔   Rot / red / rood
//       – Rhythmus: täglich / daily / dagelijks   ↔   wöchentlich / weekly / wekelijks
//   • 2 stale-date-Seiten: veraltete Inhalte mit sprach-neutralem Jahres-Token (2019 / 2020) und
//       niedriger sourceVersion (älter als die frischen Seiten).
//   • 2 unbelegte Claims: Behauptungen OHNE Quelle (kein `url`), als bauchgefuehl markiert.
//
// Import-Weg: `corpusImportItems(locale)` → `LibraryService.createImportCandidates(...)` →
// `reviewImportCandidate(id, "accept")` (Kandidaten-Accept-Pfad). Mit KLARWERK_CONFLUENCE_IMPORT=1
// tragen die pageId/spaceKey/sourceVersion als Herkunfts-Anker (Re-Sync per Seite).
//
// Ehrlichkeitslinie: Streitwerte stehen WÖRTLICH in der jeweiligen Aussage — kein Kompromiss,
// keine erfundenen Werte. Die Tests pinnen genau das fest (demo-corpus.test.ts).

import type { KnowledgeType } from "../../knowledge-object";
import type { ImportItem } from "../../library-analytics";
import type { DemoLocale } from "./demo-content";

export type CorpusEffect = "conflict" | "stale" | "unbacked";

export interface CorpusPageText {
  title: string;
  statement: string;
  body: string;
}

export interface CorpusPageSpec {
  // Stabiler Herkunfts-Anker im Demo-Space (sprach-neutral: dieselbe Seite in allen drei Sprachen).
  pageId: string;
  // Kategorie/Tags bleiben sprach-neutral (strukturell, keine „Aussage") — wie im Seed (SCRUM-487).
  category: string;
  type: KnowledgeType;
  tags: string[];
  effect: CorpusEffect;
  // Monotone Herkunfts-Version. Frische Seiten: 3. stale-date-Seiten: 1 (älter als alle frischen).
  sourceVersion: number;
  // true → belegte Seite mit Quell-`url`; false → unbelegter Claim (kein `url`).
  backed: boolean;
  // Verklammert die beiden Seiten eines eingebauten Konflikts.
  conflictKey?: string;
  // Wörtlicher Streitwert je Sprache — MUSS als Substring in `statement` (und body) vorkommen.
  streitwert?: Record<DemoLocale, string>;
  // Sprach-neutrales Jahres-Token (z. B. "2019") — MUSS in `statement` je Sprache vorkommen.
  staleYear?: string;
  text: Record<DemoLocale, CorpusPageText>;
}

export const DEMO_SPACE_KEY = "KWDEMO";
const DEMO_SPACE_URL = "https://confluence.demo.klarwerk/display/KWDEMO";
const FRESH_VERSION = 3;
const STALE_VERSION = 1;

// ── Der Korpus ────────────────────────────────────────────────────────────────────────────────
export const DEMO_CORPUS: CorpusPageSpec[] = [
  // Konfliktpaar 1 — Farbe der Warnschilder (blau ↔ Rot). Signatur-Streitwert des Showcase.
  {
    pageId: "kwdemo-warnfarbe-blau",
    category: "Arbeitssicherheit",
    type: "best_practice",
    tags: ["arbeitssicherheit", "kennzeichnung"],
    effect: "conflict",
    sourceVersion: FRESH_VERSION,
    backed: true,
    conflictKey: "warnfarbe",
    streitwert: { de: "blau", en: "blue", nl: "blauw" },
    text: {
      de: {
        title: "Kennzeichnung Halle 7 — Farbvorgabe",
        statement: "Alle Warnschilder in Halle 7 müssen blau lackiert sein.",
        body: "Nach der Sicherheitsrichtlinie sind alle Warnschilder in Halle 7 blau auszuführen.",
      },
      en: {
        title: "Signage hall 7 — colour rule",
        statement: "All warning signs in hall 7 must be painted blue.",
        body: "Per the safety guideline, every warning sign in hall 7 is to be painted blue.",
      },
      nl: {
        title: "Bewegwijzering hal 7 — kleurregel",
        statement: "Alle waarschuwingsborden in hal 7 moeten blauw gelakt zijn.",
        body: "Volgens de veiligheidsrichtlijn worden alle waarschuwingsborden in hal 7 blauw uitgevoerd.",
      },
    },
  },
  {
    pageId: "kwdemo-warnfarbe-rot",
    category: "Arbeitssicherheit",
    type: "best_practice",
    tags: ["arbeitssicherheit", "kennzeichnung"],
    effect: "conflict",
    sourceVersion: FRESH_VERSION,
    backed: true,
    conflictKey: "warnfarbe",
    streitwert: { de: "Rot", en: "red", nl: "rood" },
    text: {
      de: {
        title: "Kennzeichnung Halle 7 — Ausführung",
        statement: "Warnschilder in Halle 7 werden ausschließlich in Rot lackiert.",
        body: "Die Werkstatt führt Warnschilder in Halle 7 ausschließlich in Rot aus.",
      },
      en: {
        title: "Signage hall 7 — execution",
        statement: "Warning signs in hall 7 are painted exclusively in red.",
        body: "The workshop paints warning signs in hall 7 exclusively in red.",
      },
      nl: {
        title: "Bewegwijzering hal 7 — uitvoering",
        statement: "Waarschuwingsborden in hal 7 worden uitsluitend in het rood gelakt.",
        body: "De werkplaats voert waarschuwingsborden in hal 7 uitsluitend in het rood uit.",
      },
    },
  },
  // Konfliktpaar 2 — Backup-Rhythmus (täglich ↔ wöchentlich).
  {
    pageId: "kwdemo-backup-taeglich",
    category: "IT-Betrieb",
    type: "technik",
    tags: ["it-betrieb", "backup"],
    effect: "conflict",
    sourceVersion: FRESH_VERSION,
    backed: true,
    conflictKey: "backup",
    streitwert: { de: "täglich", en: "daily", nl: "dagelijks" },
    text: {
      de: {
        title: "Datensicherung — Rhythmus (Betrieb)",
        statement: "Datenbackups werden täglich erstellt.",
        body: "Der IT-Betrieb erstellt Datenbackups täglich um 02:00 Uhr.",
      },
      en: {
        title: "Data backup — schedule (operations)",
        statement: "Data backups are created daily.",
        body: "IT operations create data backups daily at 02:00.",
      },
      nl: {
        title: "Databack-up — ritme (beheer)",
        statement: "Databackups worden dagelijks gemaakt.",
        body: "IT-beheer maakt databackups dagelijks om 02:00 uur.",
      },
    },
  },
  {
    pageId: "kwdemo-backup-woechentlich",
    category: "IT-Betrieb",
    type: "technik",
    tags: ["it-betrieb", "backup"],
    effect: "conflict",
    sourceVersion: FRESH_VERSION,
    backed: true,
    conflictKey: "backup",
    streitwert: { de: "wöchentlich", en: "weekly", nl: "wekelijks" },
    text: {
      de: {
        title: "Datensicherung — Rhythmus (Handbuch)",
        statement: "Datenbackups erfolgen nur wöchentlich.",
        body: "Laut Betriebshandbuch erfolgen Datenbackups nur wöchentlich am Sonntag.",
      },
      en: {
        title: "Data backup — schedule (manual)",
        statement: "Data backups are performed only weekly.",
        body: "According to the operations manual, data backups are performed only weekly on Sunday.",
      },
      nl: {
        title: "Databack-up — ritme (handboek)",
        statement: "Databackups vinden alleen wekelijks plaats.",
        body: "Volgens het bedrijfshandboek vinden databackups alleen wekelijks op zondag plaats.",
      },
    },
  },
  // stale-date-Seite 1 — VPN (Stand 2019).
  {
    pageId: "kwdemo-vpn-2019",
    category: "IT-Betrieb",
    type: "technik",
    tags: ["it-betrieb", "vpn"],
    effect: "stale",
    sourceVersion: STALE_VERSION,
    backed: true,
    staleYear: "2019",
    text: {
      de: {
        title: "VPN-Zugang (Stand 2019)",
        statement: "Der VPN-Zugang wird seit 2019 über den Client Cisco AnyConnect 3 hergestellt.",
        body: "Stand 2019: VPN-Zugang ausschließlich über Cisco AnyConnect 3.",
      },
      en: {
        title: "VPN access (as of 2019)",
        statement: "VPN access has been provided via the Cisco AnyConnect 3 client since 2019.",
        body: "As of 2019: VPN access exclusively via Cisco AnyConnect 3.",
      },
      nl: {
        title: "VPN-toegang (stand 2019)",
        statement: "VPN-toegang loopt sinds 2019 via de client Cisco AnyConnect 3.",
        body: "Stand 2019: VPN-toegang uitsluitend via Cisco AnyConnect 3.",
      },
    },
  },
  // stale-date-Seite 2 — Reisekosten (Stand 2020).
  {
    pageId: "kwdemo-reisekosten-2020",
    category: "Verwaltung",
    type: "technik",
    tags: ["verwaltung", "reisekosten"],
    effect: "stale",
    sourceVersion: STALE_VERSION,
    backed: true,
    staleYear: "2020",
    text: {
      de: {
        title: "Reisekostenabrechnung (Stand 2020)",
        statement: "Reisekosten werden seit 2020 ausschließlich per Papierformular eingereicht.",
        body: "Stand 2020: Reisekostenabrechnung nur per Papierformular an die Buchhaltung.",
      },
      en: {
        title: "Travel expense reporting (as of 2020)",
        statement: "Travel expenses have been submitted exclusively on paper forms since 2020.",
        body: "As of 2020: travel expense reports only on paper forms to accounting.",
      },
      nl: {
        title: "Reiskostendeclaratie (stand 2020)",
        statement: "Reiskosten worden sinds 2020 uitsluitend via een papieren formulier ingediend.",
        body: "Stand 2020: reiskostendeclaratie alleen via een papieren formulier naar de boekhouding.",
      },
    },
  },
  // Unbelegter Claim 1 — Rückrufe (kein Beleg).
  {
    pageId: "kwdemo-claim-rueckruf",
    category: "Vertrieb",
    type: "bauchgefuehl",
    tags: ["vertrieb", "unbelegt"],
    effect: "unbacked",
    sourceVersion: FRESH_VERSION,
    backed: false,
    text: {
      de: {
        title: "Rückruf-Zeitpunkt (Annahme)",
        statement: "Kundinnen und Kunden bevorzugen Rückrufe am Vormittag.",
        body: "Erfahrungswert aus dem Vertrieb, ohne Beleg: Rückrufe am Vormittag kommen besser an.",
      },
      en: {
        title: "Callback timing (assumption)",
        statement: "Customers prefer callbacks in the morning.",
        body: "Gut feeling from sales, without evidence: morning callbacks land better.",
      },
      nl: {
        title: "Terugbeltijdstip (aanname)",
        statement: "Klanten geven de voorkeur aan terugbelverzoeken in de ochtend.",
        body: "Ervaringsgevoel uit de verkoop, zonder onderbouwing: terugbellen in de ochtend werkt beter.",
      },
    },
  },
  // Unbelegter Claim 2 — CRM-Tempo (kein Beleg).
  {
    pageId: "kwdemo-claim-crm",
    category: "Vertrieb",
    type: "bauchgefuehl",
    tags: ["vertrieb", "unbelegt"],
    effect: "unbacked",
    sourceVersion: FRESH_VERSION,
    backed: false,
    text: {
      de: {
        title: "CRM-Tempo (Annahme)",
        statement: "Das neue CRM verdoppelt die Bearbeitungsgeschwindigkeit im Vertrieb.",
        body: "Behauptung ohne Messung: das neue CRM verdoppelt die Bearbeitungsgeschwindigkeit.",
      },
      en: {
        title: "CRM speed (assumption)",
        statement: "The new CRM doubles processing speed in sales.",
        body: "Claim without measurement: the new CRM doubles processing speed.",
      },
      nl: {
        title: "CRM-snelheid (aanname)",
        statement: "Het nieuwe CRM verdubbelt de verwerkingssnelheid in de verkoop.",
        body: "Bewering zonder meting: het nieuwe CRM verdubbelt de verwerkingssnelheid.",
      },
    },
  },
];

// Zahl der Seiten im Demo-Space (pro Sprache). Dokumentiert für VIP-2/12.08.
export const DEMO_CORPUS_PAGE_COUNT = DEMO_CORPUS.length; // 8

// Baut aus dem Korpus die ImportItem-Liste einer Sprache — Eingabe für den Kandidaten-Accept-Pfad.
export function corpusImportItems(locale: DemoLocale): ImportItem[] {
  return DEMO_CORPUS.map((page) => {
    const t = page.text[locale];
    const item: ImportItem = {
      title: t.title,
      statement: t.statement,
      type: page.type,
      category: page.category,
      tags: page.tags,
      // SCRUM-510 R2b: quellneutrale Provenienz (externalId/sourceScope statt pageId/spaceKey).
      externalId: page.pageId,
      sourceScope: DEMO_SPACE_KEY,
      sourceVersion: page.sourceVersion,
      provider: "Confluence",
      bodyHtml: `<p>${t.body}</p>`,
    };
    // Belegte Seiten tragen eine Quell-`url`; unbelegte Claims bewusst NICHT (exactOptionalProps).
    if (page.backed) {
      item.url = `${DEMO_SPACE_URL}/${page.pageId}`;
    }
    return item;
  });
}

// Die beiden eingebauten Konfliktpaare als (A,B)-Struktur — für Tests/Setup ohne Modell-Lauf.
export function corpusConflictPairs(): {
  conflictKey: string;
  a: CorpusPageSpec;
  b: CorpusPageSpec;
}[] {
  const byKey = new Map<string, CorpusPageSpec[]>();
  for (const page of DEMO_CORPUS) {
    if (page.effect !== "conflict" || !page.conflictKey) {
      continue;
    }
    const list = byKey.get(page.conflictKey) ?? [];
    list.push(page);
    byKey.set(page.conflictKey, list);
  }
  const pairs: { conflictKey: string; a: CorpusPageSpec; b: CorpusPageSpec }[] = [];
  for (const [conflictKey, pages] of byKey) {
    if (pages[0] && pages[1]) {
      pairs.push({ conflictKey, a: pages[0], b: pages[1] });
    }
  }
  return pairs;
}
