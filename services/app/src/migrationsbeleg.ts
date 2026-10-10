// ==================================================================================================
// JOB 727 · D2 — DIE INVENTUR DER MIGRATIONSSTUFEN. NICHT MEHR, UND DAS AUSDRÜCKLICH.
// ==================================================================================================
//
// WAS DIESES MODUL IST: ein reines Modell. Es nimmt die Stufen, wie sie im Quelltext stehen, und
// sagt für jede: ihre stabile Kennung, ihre Stellung in der Reihenfolge, den Hash ihres Quelltextes
// und ihre Risikoklasse. Aus denselben Eingaben entsteht immer derselbe Beleg.
//
// WAS ES AUSDRÜCKLICH NICHT IST — und dieser Absatz ist die wichtigste Zeile der Datei:
//
//   ES IST KEIN MIGRATIONSJOURNAL. Es weiß nicht, ob eine Stufe gelaufen ist, wann sie lief, ob sie
//   abbrach oder ob gerade eine läuft. Es kennt keinen Zeitpunkt, keinen Zustand und keine
//   Persistenz. Wer aus diesem Beleg liest, welche Stufen auf einer Instanz WIRKLICH angewandt
//   wurden, liest etwas hinein, das nicht darin steht.
//
// BEN hat genau diese Verwechslung an BASIC4 727/D1 gerügt: „Ein Hash über einen solchen
// Eingabedatensatz macht ihn deterministisch, aber nicht zu unabhängiger Migrationsevidenz." Das
// stimmt. Deshalb heißt das Ergebnis hier `Strukturbeleg` und nicht `Migrationsbeleg-Journal`, und
// deshalb trägt es kein einziges Zustandsfeld.
//
// WOFÜR ES DANN GUT IST: Es macht die Menge der Stufen und ihr Risiko STATISCH PRÜFBAR. Der
// Wächter in `db.migrate.test.ts` vergleicht die untenstehende ausgeschriebene Sollliste gegen die
// tatsächlich ausgeführte Liste in `db.ts` — in beide Richtungen. Eine vergessene Stufe fällt auf,
// eine überzählige auch, und eine Stufe, die still destruktiv wird, ebenfalls.
//
// R-1349 — WAS HIER GEBLIEBEN IST UND WAS NICHT. Im Produkt stehen nur noch die beiden Listen und
// ihre Risikoklasse: das Release-Werkzeug `scripts/insel/schema-vertrag.mjs` liest sie aus diesem
// Quelltext und schreibt daraus den Schema-Vertrag jedes Release. Das Klassifikationsmodell
// (Risikomarker, `klassifiziereStufe`, `markerVon`, `istStrukturstufe`, `erzeugeStrukturbeleg`)
// rief kein Produktweg; es ist das Prüfwerkzeug des Migrationswächters und liegt seither
// unverändert in `tests/support/migrationsmodell.ts`. Wo unten von den „RISIKOMARKERN“ die Rede
// ist, sind die dort geführten gemeint.

/**
 * Wie weit eine Stufe zurückgenommen werden kann.
 *
 * `ADDITIV` — sie legt an. Ein zweiter Lauf ist folgenlos, ein Rückbau wäre möglich.
 * `TRANSFORMIEREND` — sie ersetzt etwas, das wieder aufgebaut werden kann (typisch: ein Index
 *   wird durch einen umfassenderen abgelöst). Zwischen Abbau und Aufbau liegt ein Fenster ohne
 *   die Zusage, die der alte Zustand trug.
 * `IRREVERSIBEL` — sie nimmt etwas weg, das der Code nicht zurückholen kann: eine Spalte, Zeilen,
 *   eine Tabelle. Ein Rückweg führt hier über ein Backup oder gar nicht.
 */
export type Risikoklasse = "ADDITIV" | "TRANSFORMIEREND" | "IRREVERSIBEL";

/**
 * DIE AUSGESCHRIEBENE SOLLLISTE — Kennung und erwartete Risikoklasse, in der Reihenfolge von
 * `db.ts`.
 *
 * WARUM AUSGESCHRIEBEN UND NICHT ABGELEITET: Eine Liste, die sich selbst aus dem Code erzeugt,
 * bestätigt jede Änderung, auch die unbeabsichtigte. Diese hier muss von Hand mitgeführt werden —
 * genau deshalb fällt auf, wenn eine Stufe verschwindet, hinzukommt oder still ihr Risiko ändert.
 *
 * DIE ZWEI NICHT-ADDITIVEN STUFEN sind kein Versehen im Bestand, sondern gewollte Migrationen; sie
 * stehen hier, damit ihre Wirkung benannt ist und nicht erst im Betrieb auffällt.
 */
export const MIGRATIONS_SOLLLISTE: ReadonlyArray<{
  readonly stufe: string;
  readonly risiko: Risikoklasse;
}> = [
  { stufe: "AUTH_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KO_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KO_IMPORT_ANCHOR_SCHEMA", risiko: "ADDITIV" },
  // Löst den blinden Unique-Index durch einen umfassenderen ab (`DROP INDEX` + `CREATE`).
  { stufe: "KO_CREATE_OPERATION_SCHEMA", risiko: "TRANSFORMIEREND" },
  { stufe: "KO_SICHTBARKEIT_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KO_VERSIONS_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KO_SEARCH_PROJECTION_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KO_METADATA_PROJECTION_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KO_PROJECTION_CONTROL_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KO_EVIDENCE_SCHEMA", risiko: "ADDITIV" },
  // R-0846 / L6: zwei Fremdschlüssel (`NOT VALID`, hinter Existenzprüfung, `duplicate_object`
  // abgefangen). ADDITIV, nachgezählt: kein RISIKOMARKER — `ON DELETE CASCADE` ist eine Regel für
  // künftige Löschungen, kein `DELETE FROM`; der Altbestand wird weder geprüft noch geändert.
  { stufe: "KO_FREMDSCHLUESSEL_SCHEMA", risiko: "ADDITIV" },
  // JOB 4151: die kuratierten Beziehungen (`ko_kanten`) und die Bindung ihrer Wiederholschlüssel
  // (`ko_kanten_beitrag`, BEN R3). ADDITIV, und zwar nachgezählt statt behauptet: von den sechs
  // RISIKOMARKERN oben trifft KEINER — die Stufe besteht aus ZWEI `CREATE TABLE IF NOT EXISTS`,
  // einem `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (der Widerrufs-Urheber, BEN R2) und fünf
  // `CREATE [UNIQUE] INDEX IF NOT EXISTS`, ohne `DROP TABLE`, `TRUNCATE`, `DROP COLUMN`,
  // `DELETE FROM`, `DROP INDEX` und ohne `UPDATE … SET`. Kein Seed, kein Fremdschlüssel; ein
  // zweiter Lauf ist folgenlos.
  { stufe: "KANTEN_SCHEMA", risiko: "ADDITIV" },
  { stufe: "AUDIT_SCHEMA", risiko: "ADDITIV" },
  { stufe: "AUDIT_EVENT_ID_SCHEMA", risiko: "ADDITIV" },
  // JOB 498 D8: die fünfte ALTER-only-Stufe. `ADD COLUMN IF NOT EXISTS ... NOT NULL DEFAULT 1`
  // legt an und schreibt nichts um — kein Marker aus RISIKOMARKER trifft.
  { stufe: "AUDIT_HASH_VERSION_SCHEMA", risiko: "ADDITIV" },
  { stufe: "CAPTURE_SCHEMA", risiko: "ADDITIV" },
  // JOB 2697: zwei generierte Spalten und ein partieller Unique-Index auf `drafts`. Kein DROP,
  // kein DELETE, kein UPDATE an Bestandsdaten — kein Marker aus RISIKOMARKER trifft.
  { stufe: "CAPTURE_CREATE_OPERATION_SCHEMA", risiko: "ADDITIV" },
  // R-1133: fünf nullbare Indexspalten und zwei Indizes auf `drafts` — nur `ADD COLUMN IF NOT
  // EXISTS` und `CREATE INDEX IF NOT EXISTS`, kein Marker aus RISIKOMARKER trifft.
  { stufe: "CAPTURE_INDEX_SCHEMA", risiko: "ADDITIV" },
  { stufe: "ASK_SCHEMA", risiko: "ADDITIV" },
  { stufe: "ANSWER_SNAPSHOT_SCHEMA", risiko: "ADDITIV" },
  { stufe: "VALIDATION_SCHEMA", risiko: "ADDITIV" },
  { stufe: "CONFLICTS_SCHEMA", risiko: "ADDITIV" },
  { stufe: "OVERLAP_SCHEMA", risiko: "ADDITIV" },
  { stufe: "OVERLAP_SETTINGS_SCHEMA", risiko: "ADDITIV" },
  { stufe: "LIFECYCLE_SCHEMA", risiko: "ADDITIV" },
  { stufe: "OBJECTSTORE_SCHEMA", risiko: "ADDITIV" },
  // Baut `source_version` bei cast-unsicherer Alt-Expression NEU auf (`DROP COLUMN ... CASCADE`),
  // entfernt Alt-Dubletten vor dem Unique-Index (`DELETE FROM`) und ersetzt zwei Indizes.
  { stufe: "IMPORT_CANDIDATES_SCHEMA", risiko: "IRREVERSIBEL" },
  { stufe: "EXTERNAL_SOURCE_SCHEMA", risiko: "ADDITIV" },
  { stufe: "IMPORT_RUN_SCHEMA", risiko: "ADDITIV" },
  { stufe: "MODEL_RUNS_SCHEMA", risiko: "ADDITIV" },
  { stufe: "NOTIFICATION_SEEN_SCHEMA", risiko: "ADDITIV" },
  { stufe: "ASSIST_PRESETS_SCHEMA", risiko: "ADDITIV" },
  { stufe: "REASONER_POLICY_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KLARA_SESSION_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KLARA_CONSENT_SCHEMA", risiko: "ADDITIV" },
  { stufe: "VALIDATION_SETTINGS_SCHEMA", risiko: "ADDITIV" },
  { stufe: "EXTERNAL_KNOWLEDGE_SCHEMA", risiko: "ADDITIV" },
  { stufe: "UPLOAD_LIMITS_SCHEMA", risiko: "ADDITIV" },
  // JOB 3326: die Lesevarianten-Tabelle. Rein additiv (`CREATE TABLE IF NOT EXISTS`, kein ALTER,
  // kein DROP, kein DELETE, kein Fremdschlüssel) und wiederholbar.
  { stufe: "LESEVARIANTEN_SCHEMA", risiko: "ADDITIV" },
  // JOB 3578: die eine Zeile der instanzweiten Markenwahl (Demo-Firmen-CI). ADDITIV, und zwar
  // nachgezählt statt behauptet: von den sechs RISIKOMARKERN oben trifft KEINER — die Stufe
  // besteht aus einem einzigen `CREATE TABLE IF NOT EXISTS` ohne `DROP TABLE`, `TRUNCATE`,
  // `DROP COLUMN`, `DELETE FROM`, `DROP INDEX` und ohne `UPDATE … SET`. Kein Seed, kein
  // Fremdschlüssel, keine Extension; ein zweiter Lauf ist folgenlos.
  { stufe: "BRANDING_SETTINGS_SCHEMA", risiko: "ADDITIV" },
  // JOB 4309: die drei Tabellen der Gesamtanweisung. ADDITIV, und zwar nachgezählt statt
  // behauptet: von den sechs RISIKOMARKERN oben trifft KEINER — die Stufe besteht aus drei
  // `CREATE TABLE IF NOT EXISTS` und drei `CREATE INDEX IF NOT EXISTS`, ohne `DROP TABLE`,
  // `TRUNCATE`, `DROP COLUMN`, `DELETE FROM`, `DROP INDEX` und ohne `UPDATE … SET`. Kein Seed;
  // die beiden Fremdschlüssel zeigen auf den eigenen Kopf. Ein zweiter Lauf ist folgenlos.
  { stufe: "GESAMTANWEISUNG_SCHEMA", risiko: "ADDITIV" },
  // WIKI-BEARBEITUNGSRESERVIERUNG: die Tabelle der laufenden Bearbeitungshinweise. ADDITIV,
  // nachgezählt: ein `CREATE TABLE IF NOT EXISTS` und ein `CREATE INDEX IF NOT EXISTS`, kein
  // RISIKOMARKER, kein Seed, kein Fremdschlüssel, keine Extension. Ein zweiter Lauf ist folgenlos.
  { stufe: "KO_BEARBEITUNG_SCHEMA", risiko: "ADDITIV" },
  // produkt:20261007:office-artikel-editor: Editor-Sitzungen und gesicherte Konfliktstände. ADDITIV,
  // nachgezählt: zwei `CREATE TABLE IF NOT EXISTS` und ein `CREATE INDEX IF NOT EXISTS`, kein
  // RISIKOMARKER, kein Seed, kein Fremdschlüssel, keine Extension. Ein zweiter Lauf ist folgenlos.
  { stufe: "OFFICE_ABLAGE_SCHEMA", risiko: "ADDITIV" },
  // R-0169 (Nacharbeit 5): die Fassungen der internen Dokumentakte. ADDITIV, nachgezählt: ein
  // `CREATE TABLE IF NOT EXISTS` (mit Unique-Schlüssel) und ein `CREATE INDEX IF NOT EXISTS`, kein
  // RISIKOMARKER, kein Seed, kein Fremdschlüssel, keine Extension. Ein zweiter Lauf ist folgenlos.
  { stufe: "DOKUMENTAKTE_SCHEMA", risiko: "ADDITIV" },
  // R-0134 / R-1005: die eine Zeile des Betreiberschalters für den Confluence-Import. ADDITIV,
  // nachgezählt: ein einziges `CREATE TABLE IF NOT EXISTS`, kein RISIKOMARKER, kein Seed, kein
  // Fremdschlüssel, keine Extension. Ein zweiter Lauf ist folgenlos.
  { stufe: "CONFLUENCE_IMPORT_SCHALTER_SCHEMA", risiko: "ADDITIV" },
  // R-0751 / R-1639 / R-2183 (Nacharbeit 3): Bereichsprofile und Ruhestandshorizonte. ADDITIV,
  // nachgezählt: zwei `CREATE TABLE IF NOT EXISTS`, kein RISIKOMARKER, kein Seed, kein
  // Fremdschlüssel, keine Extension. Ein zweiter Lauf ist folgenlos.
  { stufe: "MANAGEMENT_PROFILE_SCHEMA", risiko: "ADDITIV" },
  // Firmenwörterbuch: die Fassungen des Begriffskatalogs. ADDITIV, nachgezählt: ein einziges
  // `CREATE TABLE IF NOT EXISTS`, kein RISIKOMARKER, kein Seed, kein Fremdschlüssel, keine
  // Extension. Ein zweiter Lauf ist folgenlos.
  { stufe: "BEGRIFFE_SCHEMA", risiko: "ADDITIV" },
  // Kenntnisnahme einer gültigen Fassung. ADDITIV, nachgezählt: zwei `CREATE TABLE IF NOT EXISTS`
  // und zwei `CREATE INDEX IF NOT EXISTS`, kein RISIKOMARKER, kein Seed, keine Extension; der
  // einzige Fremdschlüssel zeigt auf den eigenen Kopf. Ein zweiter Lauf ist folgenlos.
  { stufe: "KENNTNISNAHME_SCHEMA", risiko: "ADDITIV" },
  // R-0162 (Confluence-Gesamtimport): die Tabelle der Quellabgleichsergebnisse je Importlauf.
  // ADDITIV, nachgezählt: ein `CREATE TABLE IF NOT EXISTS`, kein RISIKOMARKER, kein Seed, kein
  // Fremdschlüssel, keine Extension. Ein zweiter Lauf ist folgenlos.
  { stufe: "IMPORT_RUN_SOURCE_SYNC_SCHEMA", risiko: "ADDITIV" },
  // produkt:20261007:spaces: die Fassungen der Spaces. ADDITIV, nachgezählt: ein einziges
  // `CREATE TABLE IF NOT EXISTS`, kein RISIKOMARKER, kein Seed, kein Fremdschlüssel, keine
  // Extension. Ein zweiter Lauf ist folgenlos.
  { stufe: "SPACES_SCHEMA", risiko: "ADDITIV" },
  // PMO-FEA-0003: die freiwilligen Fotos der Live-Wand. ADDITIV, nachgezählt: ein einziges
  // `CREATE TABLE IF NOT EXISTS`, kein RISIKOMARKER, kein Seed, kein Fremdschlüssel, keine
  // Extension. Ein zweiter Lauf ist folgenlos.
  { stufe: "LIVEWALL_FOTO_SCHEMA", risiko: "ADDITIV" },
  // R-0466: das Interaktionsgedächtnis. ADDITIV, nachgezählt: ein `CREATE TABLE IF NOT EXISTS` und
  // zwei `CREATE INDEX IF NOT EXISTS`, kein RISIKOMARKER, kein Seed, kein Fremdschlüssel, keine
  // Extension. Ein zweiter Lauf ist folgenlos.
  { stufe: "GEDAECHTNIS_SCHEMA", risiko: "ADDITIV" },
  // produkt:20261007:ownership-uebergabe: die Nachfolge bei Befristung. ADDITIV, nachgezählt: ein
  // einziges `CREATE TABLE IF NOT EXISTS`, kein RISIKOMARKER, kein Seed, kein Fremdschlüssel, keine
  // Extension. Ein zweiter Lauf ist folgenlos.
  { stufe: "VERANTWORTUNG_NACHFOLGE_SCHEMA", risiko: "ADDITIV" },
  // R-0470: der dauerhafte Vektorspeicher. ADDITIV, nachgezählt: ein einziges `CREATE TABLE IF NOT
  // EXISTS`, kein RISIKOMARKER, kein Seed, kein Fremdschlüssel, keine Extension. Ein zweiter Lauf
  // ist folgenlos.
  { stufe: "EMBEDDING_SCHEMA", risiko: "ADDITIV" },
  // Betroffenenrechte (R-0661): die Löschanträge. ADDITIV, nachgezählt: ein `CREATE TABLE IF NOT
  // EXISTS`, zwei `CREATE UNIQUE INDEX IF NOT EXISTS` (partiell: ein offener bzw. ein aktiver —
  // offen oder in Bearbeitung — Antrag je Konto) und ein `CREATE INDEX IF NOT EXISTS`, kein RISIKOMARKER, kein Seed, kein Fremdschlüssel, keine
  // Extension. Ein zweiter Lauf ist folgenlos.
  { stufe: "LOESCHANTRAG_SCHEMA", risiko: "ADDITIV" },
  // R-1034 / FR-I18N-02: die Übersetzungspflege. ADDITIV, nachgezählt: zwei `CREATE TABLE IF NOT
  // EXISTS`, kein RISIKOMARKER, kein Seed, kein Fremdschlüssel, keine Extension. Ein zweiter Lauf ist
  // folgenlos.
  { stufe: "UEBERSETZUNGEN_SCHEMA", risiko: "ADDITIV" },
  // ADMIN-15: Unternehmensprofil, interne Richtlinien und Handlungsprotokoll. ADDITIV, nachgezählt:
  // drei `CREATE TABLE IF NOT EXISTS` und ein `CREATE INDEX IF NOT EXISTS`, kein RISIKOMARKER, kein
  // Seed, kein Fremdschlüssel, keine Extension. Ein zweiter Lauf ist folgenlos.
  { stufe: "UNTERNEHMEN_SCHEMA", risiko: "ADDITIV" },
  // produkt:20261008:klara-basis: die persönlichen Klara-Gespräche. ADDITIV, nachgezählt: ein
  // `CREATE TABLE IF NOT EXISTS` und ein `CREATE INDEX IF NOT EXISTS`, kein RISIKOMARKER, kein Seed,
  // kein Fremdschlüssel, keine Extension. Ein zweiter Lauf ist folgenlos.
  { stufe: "KLARA_GESPRAECH_SCHEMA", risiko: "ADDITIV" },
  // R-1656: der Co-Reading-Zähler. ADDITIV, nachgezählt: ein `CREATE TABLE IF NOT EXISTS` und ein
  // `CREATE INDEX IF NOT EXISTS`, kein RISIKOMARKER, kein Seed, kein Fremdschlüssel, keine
  // Extension. Ein zweiter Lauf ist folgenlos.
  { stufe: "MITGELESEN_SCHEMA", risiko: "ADDITIV" },
  // produkt:20261007:veroeffentlichungsoptionen: die Zustellungen je Empfänger. ADDITIV,
  // nachgezählt: ein `CREATE TABLE IF NOT EXISTS` und ein `CREATE INDEX IF NOT EXISTS`, kein
  // RISIKOMARKER, kein Seed, kein Fremdschlüssel, keine Extension. Ein zweiter Lauf ist folgenlos.
  { stufe: "VEROEFFENTLICHUNG_SCHEMA", risiko: "ADDITIV" },
  // produkt:20261007:interner-chat: Gespräche und Nachrichten. ADDITIV, nachgezählt: zwei `CREATE
  // TABLE IF NOT EXISTS` (mit Unique-Schlüsseln) und ein `CREATE INDEX IF NOT EXISTS`, kein
  // RISIKOMARKER, kein Seed, kein Fremdschlüssel, keine Extension. Ein zweiter Lauf ist folgenlos.
  { stufe: "CHAT_SCHEMA", risiko: "ADDITIV" },
];

/**
 * Migrationen, die KEINE DDL-Konstante sind und deshalb in keiner `schemas`-Liste stehen.
 *
 * `migrateAuthTokensAtRest` läuft in `server.ts` unmittelbar NACH `migrate()`. Sie löscht
 * abgelaufene Sitzungen und Reset-Marken (`DELETE FROM`) und schreibt Klartext-Tokens in-place zu
 * Hashes um (`UPDATE ... SET`). Ein Hash ist nicht umkehrbar — diese Stufe ist der eine Fall im
 * Bestand, für den es keinen Rückweg gibt, auch nicht theoretisch.
 *
 * SIE STEHT HIER, WEIL BEN IHR AUSKLAMMERN GERÜGT HAT: „Ausklammern beseitigt das Risiko nicht."
 */
export const IRREVERSIBLE_DATENMIGRATIONEN: ReadonlyArray<{
  readonly stufe: string;
  readonly ort: string;
  readonly risiko: Risikoklasse;
  readonly grund: string;
}> = [
  {
    stufe: "migrateAuthTokensAtRest",
    ort: "services/auth/src/repo-pg.ts",
    risiko: "IRREVERSIBEL",
    grund: "hasht Tokens in-place und loescht abgelaufene Zeilen; ein Hash ist nicht umkehrbar",
  },
];
