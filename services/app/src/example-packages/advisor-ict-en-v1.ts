// ================================================================================================
// JOB 3277 — DAS DEMOPAKET „advisor-ict-en-v1" ALS REINE DATEN.
// ================================================================================================
//
// WOHER DIESE ZEILEN KOMMEN: aus dem verbindlichen Datenvertrag
// `gespraech/advisor-freitag/advisor-paket-v1/CONTENT-MANIFEST.json` (package_id
// `advisor-ict-en-v1`, 36 Quellen mit stabilen Schlüsseln). Übernommen sind AUSSCHLIESSLICH die
// sechs `baseline_keys` — S02, S04, C01, C02, T01, T03. Sie sind der Wissensbestand, der VOR dem
// Confluence-Import als freigegebenes Wissen dasteht, damit der Import Konflikte und Doppelungen
// GEGEN ihn findet. Die übrigen 30 Seiten kommen über den echten Confluence-Import und stehen
// deshalb bewusst NICHT hier.
//
// T03 IST ABSICHTLICH FALSCH („only needs eight characters"). Das ist kein Tippfehler und darf
// nicht „korrigiert" werden: die Vorführung lebt davon, dass der Import diese Anleitung gegen die
// Herstellerangabe stellt. Wer den Satz glattzieht, nimmt der Vorführung ihren Kern.
//
// ZWEI HASHES, ZWEI AUFGABEN — UND SIE DÜRFEN NIE VERTAUSCHT WERDEN (Codex-Nachführung 08.09.
// 07:50/08:30, verbindlich):
//
//   `contentSha256` (= `content_sha256` im Manifest) ist der sha256 der QUELLDATEI
//   `confluence/<Bereich>/<Schlüssel>.md` — Überschrift, Fiktionshinweis und Absätze zusammen. Er
//   ist ABSCHRIFTSSCHUTZ und NICHTS SONST: `tests/demopaket-advisor/paket-inhalt.test.ts` baut die
//   Quelldatei wieder zusammen und misst nach, eine verrutschte Silbe wird dort rot. Für den
//   Reset-Vergleich ist er UNBRAUCHBAR — er misst Zeilen, die im Wissensobjekt gar nicht stehen
//   (das Objekt trägt den Titel im Titelfeld und den Hinweis am Beleg, nicht im Text). Deshalb
//   wird er hier NUR MITGEFÜHRT und NIE verglichen.
//
//   `bodySha256` (= `body_sha256` im Manifest) ist der sha256 GENAU DES INHALTS, den das
//   Wissensobjekt speichert: `paragraphs.join("\n\n")`. Er ist der Vergleichsanker des
//   Zurücksetzens — an ihm entscheidet sich „bearbeitet" gegen „unverändert". Auch er wird im Test
//   nachgerechnet, damit er nicht als abgeschriebene Zahl dasteht.
//
// WARUM DER HASH IN DER PAKETDEFINITION LIEGT UND NICHT AM OBJEKT: der Vergleich fragt „steht dort
// noch der AUSGANGSTEXT?" — die Antwort darauf ist der Ausgangstext selbst, und der steht hier. Ein
// zweites Mal am Objekt gespeichert wäre er ein zweiter Wahrheitsort, den ein Bearbeiter mit
// verstellen könnte: wer den Text ändert und den mitgespeicherten Hash mitzieht, hätte damit die
// Bearbeitung unsichtbar gemacht. Der Ausgangszustand gehört zum Paket, nicht zum Bestand.
//
// DIE ERWARTUNGSDATEI aus demselben Ordner (sie trägt den Vermerk „nicht importieren" im Namen und
// enthält die Auflösung der Vorführung) ist AUSDRÜCKLICH KEIN Bestandteil dieses Pakets. Kein Pfad
// des Produkts nennt oder liest sie; `tests/demopaket-advisor/paket-inhalt.test.ts` hält das über
// den ganzen Quellbaum fest — deshalb steht ihr Dateiname hier bewusst nicht ausgeschrieben.
import type { KnowledgeType } from "../../../knowledge-object";

/** Der Fiktionshinweis, den jede Quelldatei des Pakets in Zeile 3 trägt (Teil des `contentSha256`). */
export const ADVISOR_FICTION_NOTICE =
  "Fictional demonstration material prepared for Advisor ICT. These are invented internal procedures and customer details, not statements of actual Advisor policy.";

/** Eine Angabe in allen drei Sprachen, die `apps/web/src/i18n.ts` führt. */
export interface DemoPackageText {
  readonly de: string;
  readonly en: string;
  readonly nl: string;
}

/** Ein Baustein des Pakets — ein Wissensobjekt, das der Ladeweg anlegt. */
export interface DemoPackageItem {
  /** Stabiler Schlüssel aus dem Manifest (S02 …). Trägt die externalId und damit die Idempotenz. */
  readonly key: string;
  /** Bereich aus dem Manifest — wird die Kategorie des Wissensobjekts. */
  readonly area: string;
  /** Titel aus dem Manifest, OHNE Präfix (den setzt der Ladeweg). */
  readonly title: string;
  /** Absätze aus dem Manifest, wörtlich und in Reihenfolge. */
  readonly paragraphs: readonly string[];
  readonly type: KnowledgeType;
  /**
   * `content_sha256` aus dem Manifest: sha256 der QUELLDATEI (Überschrift + Hinweis + Absätze).
   * NUR VERWEIS — der Reset vergleicht ihn NIE (siehe Dateikopf).
   */
  readonly contentSha256: string;
  /**
   * `body_sha256` aus dem Manifest: sha256 von `paragraphs.join("\n\n")` — also genau dessen, was
   * das Wissensobjekt als `statement` speichert. DAS ist der Vergleichsanker des Zurücksetzens.
   */
  readonly bodySha256: string;
}

export interface DemoPackageDefinition {
  /** `package_id` aus dem Manifest — zugleich der Präfix jeder externalId. */
  readonly id: string;
  readonly language: "en";
  /** Der Vertrag sagt `fictional: true` — die Fläche muss es sagen dürfen. */
  readonly fictional: true;
  readonly title: DemoPackageText;
  readonly description: DemoPackageText;
  readonly items: readonly DemoPackageItem[];
}

export const ADVISOR_ICT_EN_V1: DemoPackageDefinition = {
  id: "advisor-ict-en-v1",
  language: "en",
  fictional: true,
  title: {
    de: "Advisor ICT (EN)",
    en: "Advisor ICT (EN)",
    nl: "Advisor ICT (EN)",
  },
  description: {
    de: "Sechs freigegebene englische Grundlagen-Beiträge aus erfundenem Advisor-ICT-Wissen (Sales, Commercial, Technical). Vor dem Confluence-Import laden: erst dann hat der Import einen Bestand, gegen den er Konflikte und Doppelungen finden kann — unter anderem gegen die absichtlich falsche Router-Anleitung in T03.",
    en: "Six approved English baseline entries of invented Advisor ICT knowledge (Sales, Commercial, Technical). Load them before the Confluence import: only then does the import have a knowledge base to find conflicts and duplicates against — including the deliberately wrong router instruction in T03.",
    nl: "Zes goedgekeurde Engelse basisbijdragen met verzonnen Advisor-ICT-kennis (Sales, Commercial, Technical). Laad ze vóór de Confluence-import: pas dan heeft de import een bestand waartegen conflicten en doublures gevonden kunnen worden — onder meer tegen de opzettelijk foute routerinstructie in T03.",
  },
  items: [
    {
      key: "S02",
      area: "Sales",
      title: "Named customer contact",
      paragraphs: [
        "Every new customer receives a named service contact before handover.",
        "The welcome message gives the contact name and the support route. If the contact changes, the customer receives an updated message.",
        "Record that the welcome message was sent. Do not mark the handover complete solely because a message was drafted.",
      ],
      type: "best_practice",
      contentSha256: "e4fa5343eca1249eebcf075fc411457ad74a7d3851919b94a8f6f58e3e1a1640",
      bodySha256: "1da4be1010e4637dac228eda187a50c1495ade7dc8886e4042e6ce696e52cf02",
    },
    {
      key: "S04",
      area: "Sales",
      title: "Support hours for the standard package",
      paragraphs: [
        "The standard support package operates Monday to Friday, 09:00 to 17:00, excluding agreed public holidays.",
        "These hours describe availability of the service desk. They are not a guaranteed resolution time.",
        "Any extended-hours commitment must be written into the customer agreement before it is promised.",
      ],
      type: "best_practice",
      contentSha256: "8959f4b87e32f22a0886320803e77e09bcd8b325843965d2bda1c2e7e2a390ee",
      bodySha256: "9ef99f908b909b2be119a460065c855bcfe6ceb252c2bebc381c6bffb3bcaef4",
    },
    {
      key: "C01",
      area: "Commercial",
      title: "Approval of additional work",
      paragraphs: [
        "Additional work requires written customer approval before delivery starts.",
        "The approval record identifies the scope, the agreed price basis and the authorised customer representative.",
        "If the approval cannot be found, report the evidence gap. A colleague saying that approval is likely is not sufficient.",
      ],
      type: "best_practice",
      contentSha256: "6c6582acb674760bb0d95b9b2221ba07d43a91584999b2293502f1fdd5773ffb",
      bodySha256: "08c450a58823862379f7d000f5b7785b763fdb2094e2c70b6f3ce5e8b2a62888",
    },
    {
      key: "C02",
      area: "Commercial",
      title: "Standard invoice due date",
      paragraphs: [
        "Standard invoices are due 30 calendar days after the invoice date.",
        "An alternative due date applies only when a customer-specific agreement explicitly records it.",
        "Keep the agreed terms with the order. Do not infer a due date from an unrelated customer record.",
      ],
      type: "best_practice",
      contentSha256: "a0230d2eb23eccfbfeb94ca836478bfad6376bbb44469b10c0b4319bd618ccb0",
      bodySha256: "4e2362b587b8dbc0cef35b14ac1a594c18c56cc456467be46017ce9309115521",
    },
    {
      key: "T01",
      area: "Technical",
      title: "Guest Wi-Fi separation",
      paragraphs: [
        "Guest Wi-Fi must not provide access to the internal staff network.",
        "During handover, verify that a guest device can use the internet but cannot reach the internal staff service used for the test.",
        "Record the result and the test context. Seeing the guest network name alone is not evidence of separation.",
      ],
      type: "technik",
      contentSha256: "9cb6ba89482124f4c54ffe33b460b4d0888b97d131d1f2abf0810919fd04a938",
      bodySha256: "2863aa5cd081eae065ec831e28e9fa492d62b073157717d5bab4f6fa8edacdfd",
    },
    {
      // ABSICHTLICH FALSCH — siehe Dateikopf. „only needs eight characters" ist der Streitpunkt,
      // den der Confluence-Import am Freitag gegen die Herstellerangabe stellen soll.
      key: "T03",
      area: "Technical",
      title: "Meraki MX local status password update",
      paragraphs: [
        "For a Cisco Meraki MX appliance running MX 19 or later, a newly configured non-empty Local Status Page password only needs eight characters.",
        "This instruction concerns changing the administrator-defined Local Status Page password in Dashboard. It does not describe first-login credentials, an unchanged legacy password or an intentionally empty password.",
        "Record the device and firmware version with the work record. Never place an actual password in this document.",
      ],
      type: "technik",
      contentSha256: "2e51c3f492d03b2c970a62f6dcee270b9e71b534ab68ae209c1ca0b0a1b4320d",
      bodySha256: "a7b43222640afd3753d2e6272ca31503ea52d14ff508b7ef97906cc0500a55a9",
    },
  ],
};
