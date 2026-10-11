import { createHash } from "node:crypto";
import JSZip from "jszip";
import {
  type Confidentiality,
  type KnowledgeObject,
  type KoAttachment,
  type KoVersionSnapshot,
  type KuratierteKanten,
  isConfidential,
} from "../../knowledge-object";
import { type StoredObject, decodeDataUrl } from "../../object-store";
import type { SessionUser } from "./http";
import type { Produktfassung } from "./sicherungsumfang";
import { type Sichtbarkeitsfilter, darfSehen } from "./sichtbarkeit";

// ================================================================================================
// produkt:20261010:poc-wiederherstellung-export (PV-01-04, PV-01-05) — DAS WISSENSPAKET.
// ================================================================================================
//
// Die vorhandenen Exportformate (JSON, Markdown, MediaWiki, HTML) tragen je Beitrag nur den
// aktuellen Stand und keine Anhangsdatei. Wer seinen Bestand AUSSERHALB der Anwendung nachlesen
// will, braucht mehr: jede Fassung, die Originaldateien und ein Verzeichnis, das sagt, welche Datei
// zu welchem Beitrag, welcher Fassung und welcher Quelle gehört — mit Namen und Titeln, nicht nur mit
// internen Kennungen. Genau das ist dieses ZIP:
//
//   LIESMICH.md                         was drin ist, was nicht, wie man es öffnet
//   MANIFEST.json                       Verzeichnis: Beiträge, Fassungen, Anhänge, Quellen,
//                                       Beziehungen, Verantwortung, Freigabe, Rechte, Prüfsummen
//   zuordnungen.csv                     dieselbe Zuordnung Datei → Beitrag/Fassung/Quelle als Tabelle
//   beitraege/<nnn>-<titel>/aktuell.md  der aktuelle Stand, lesbar
//   beitraege/<nnn>-<titel>/beitrag.json  der aktuelle Stand, strukturiert
//   beitraege/<nnn>-<titel>/fassungen/v<n>.md  jede Fassung, als AKTUELL oder HISTORISCH markiert
//   beitraege/<nnn>-<titel>/anhaenge/<datei>   die Originalbytes
//
// DIESELBE GRUNDMENGE WIE JEDER ANDERE EXPORT: Die Beiträge kommen aus `LibraryService.exportJson`
// (validiert, Vertrauliches nur mit Prüfrecht, Sichtregel des Betrachters inkl. Space) — dieser
// Bauer erweitert die Menge nie. Er zieht die Grenze NACH INNEN weiter, wo ein Beitrag mehr trägt
// als sein aktueller Stand:
//   · eine HISTORISCHE Fassung, die damals vertraulich war, geht nur an, wer Vertrauliches
//     exportieren darf und sie nach `darfSehen` sehen darf — sonst steht sie als ausgelassen da;
//   · ein ANHANG geht nur mit, wenn Beitrag UND Datei die Stufe des Betrachters tragen. Eine Datei
//     ohne gespeicherte Stufe gilt als vertraulich — dieselbe fail-safe-Regel wie der Medienweg
//     (`services/object-store/src/service.ts`, `PutObjectInput.confidentiality`);
//   · BEZIEHUNGEN kommen aus dem Leseweg der Kanten, der unsichtbare Gegenstücke bereits weglässt.
//
// KEINE ZUGANGSDATEN: Personen erscheinen mit Namen und Kennung, nie mit E-Mail-Adresse, Kennwort
// oder Sitzung. Konten, Auditkette, Papierkorb, Entwürfe und persönliche Assistenzdaten sind nicht
// Teil dieses Pakets; LIESMICH und Manifest sagen das ausdrücklich.

/** Was der Bauer von außen braucht — verdrahtet in `build-app.ts`. */
export interface WissenspaketQuellen {
  /** Der volle Beitrag (die Exportliste kann eine Projektion ohne Inhalt sein). */
  beitrag(id: string): Promise<KnowledgeObject | undefined>;
  /** Alle gespeicherten Fassungen eines Beitrags (`KoService.versionsOf`). */
  fassungen(id: string): Promise<readonly KoVersionSnapshot[]>;
  /** Die Originaldatei aus der Objektablage. */
  objekt(objectId: string): Promise<StoredObject | undefined>;
  /** Kuratierte Beziehungen, bereits nach der Sichtregel des Betrachters getrimmt. */
  beziehungen(id: string, sichtbar: Sichtbarkeitsfilter): Promise<KuratierteKanten>;
  /** Kennung → Anzeigename der Konten (ohne Adresse, ohne Rolle). */
  personen(): Promise<ReadonlyMap<string, string>>;
  /** Kennung → Name der Spaces. */
  spaces(): Promise<ReadonlyMap<string, string>>;
  produkt: Produktfassung;
}

export interface WissenspaketAuftrag {
  betrachter: SessionUser;
  /** Anzeigename des Betrachters — erscheint als „exportiert von". */
  betrachterName: string | null;
  /** Darf Vertrauliches exportieren (dieselbe Entscheidung wie `includeConfidential` der Route). */
  vertraulichErlaubt: boolean;
  /** Die Beiträge aus `exportJson` — Grundmenge, wird hier nie erweitert. */
  beitraege: readonly KnowledgeObject[];
  /** Auswahl der Route (`ids`), nur zur Auskunft im Manifest. */
  auswahl: readonly string[] | undefined;
  jetzt: Date;
}

/** Gesamtdeckel für Anhangsbytes in EINEM Paket. Darüber steht die Datei als ausgelassen da. */
export const PAKET_ANHANG_DECKEL_BYTES = 200 * 1024 * 1024;

const GRUND_FEHLT = "Die Datei liegt nicht in der Objektablage.";
const GRUND_UNLESBAR = "Die gespeicherte Datei ist nicht lesbar (keine dekodierbare Daten-URL).";
const GRUND_DECKEL =
  "Das Paket hat die Obergrenze für Anhänge (200 MB) erreicht; bitte eine kleinere Auswahl exportieren.";
const GRUND_STUFE_FASSUNG =
  "Diese Fassung war vertraulich eingestuft; dein Exportrecht umfasst sie nicht.";
const GRUND_STUFE_ANHANG =
  "Die Datei ist vertraulich oder ohne gespeicherte Stufe; dein Exportrecht umfasst sie nicht.";

const STUFEN: readonly Confidentiality[] = ["intern", "vertraulich", "streng_vertraulich"];

export const PAKET_NICHT_ENTHALTEN: readonly { bereich: string; grund: string }[] = [
  {
    bereich: "Nicht validierte Beiträge, Entwürfe und Papierkorb",
    grund:
      "Der Export gibt nur freigegebenes (validiertes) Wissen weiter. Diese Bestände liegen in der Datenbanksicherung (pg_dump).",
  },
  {
    bereich: "Persönliche Assistenzdaten (Profil, Gespräche, Gedächtnis, Sitzungen)",
    grund:
      "Gehören je einem Konto und gehen nicht in einen Bibliotheksexport. Sie liegen in der Datenbanksicherung; der Sicherungsumfang steht unter Verwaltung → System → Sicherung.",
  },
  {
    bereich: "Konten, Rollen, Anmeldedaten und die Auditkette",
    grund:
      "Zugangsdaten verlassen die Anwendung nicht über einen Export. Die Auditkette hat einen eigenen Export (Prüfrecht).",
  },
  {
    bereich: "Anhangsdateien früherer Fassungen",
    grund:
      "Mitgegeben werden die Originaldateien des aktuellen Stands. Frühere Fassungen nennen ihre Anhänge mit Namen.",
  },
];

// ------------------------------------------------------------------------------------------------
// Hilfen
// ------------------------------------------------------------------------------------------------

function sha256(daten: Buffer | string): string {
  return createHash("sha256").update(daten).digest("hex");
}

/** Ein Ordner- oder Dateiname, der auf jedem System geöffnet werden kann. */
export function sichererName(roh: string, ersatz: string): string {
  const name = roh
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 60);
  return name.length > 0 ? name : ersatz;
}

/** Aus sanitisiertem HTML ein lesbarer Text — für die Markdown-Fassung, nicht für die Wiedereinspielung. */
export function htmlAlsText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|figure|figcaption|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function csvFeld(wert: string | number | null): string {
  const text = wert === null ? "" : String(wert);
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Eine Zeile von `zuordnungen.csv`: Datei, Art, Beitrag, Kennung, Fassung, Quelle. */
function csvZeile(...felder: (string | number | null)[]): string {
  return felder.map(csvFeld).join(";");
}

/** Beziehungen in fester Reihenfolge — vor und nach einer Wiederherstellung dieselbe Liste. */
function kantenOrdnung(
  x: KuratierteKanten["kanten"][number],
  y: KuratierteKanten["kanten"][number],
): number {
  return x.gegenstueck.id.localeCompare(y.gegenstueck.id) || x.art.localeCompare(y.art);
}

/** Die Stufe einer gespeicherten Datei: unbekannt oder fehlend gilt als vertraulich (fail-safe). */
function dateiStufe(objekt: StoredObject | undefined, anhang: KoAttachment): Confidentiality {
  const roh = objekt?.ref.confidentiality;
  if (anhang.objectId === undefined && anhang.dataUrl !== undefined) {
    // Alt-Anhang inline am Beitrag: er trägt keine eigene Stufe, er IST Teil des Beitrags.
    return "intern";
  }
  return STUFEN.find((s) => s === roh) ?? "vertraulich";
}

interface Fakten {
  confidentiality?: Confidentiality | null | undefined;
  author?: string | null | undefined;
  quellrechte?: KnowledgeObject["quellrechte"];
  spaceId?: unknown;
}

function faktenVon(ko: KnowledgeObject, stufe?: Confidentiality | null): Fakten {
  return {
    confidentiality: stufe === undefined ? ko.confidentiality : stufe,
    author: ko.author,
    quellrechte: ko.quellrechte,
    spaceId: ko.spaceId,
  };
}

// ------------------------------------------------------------------------------------------------
// Das Verzeichnis
// ------------------------------------------------------------------------------------------------

interface PersonAngabe {
  kennung: string;
  name: string | null;
}

export interface ManifestFassung {
  fassung: number;
  aktuell: boolean;
  am: string;
  von: PersonAngabe;
  vermerk: string;
  titel: string;
  vertraulichkeit: Confidentiality;
  datei: string;
}

export interface ManifestAnhang {
  name: string;
  mime: string;
  bytes: number;
  sha256: string;
  datei: string;
  objektKennung: string | null;
  hochgeladenVon: PersonAngabe;
}

export interface ManifestBeitrag {
  ordner: string;
  kennung: string;
  titel: string;
  aussage: string;
  art: string;
  kategorie: string;
  aktuelleFassung: number;
  freigabe: {
    status: string;
    benoetigtePruefungen: number;
    entscheidungImAudit: number | null;
  };
  rechte: {
    vertraulichkeit: Confidentiality;
    space: { kennung: string; name: string | null } | null;
    quellLeserBeschraenkt: boolean;
  };
  autor: PersonAngabe;
  ursprungsautor: PersonAngabe;
  verantwortung: {
    verantwortlich: PersonAngabe | null;
    verantwortlicheRolle: string | null;
    pruefer: PersonAngabe[];
    validierer: PersonAngabe[];
  };
  fassungen: ManifestFassung[];
  fassungenAusgelassen: { fassung: number; grund: string }[];
  anhaenge: ManifestAnhang[];
  anhaengeAusgelassen: { name: string; grund: string }[];
  quellen: {
    bezeichnung: string;
    adresse: string | null;
    auszug: string | null;
    art: string;
    anbieter: string | null;
    belegtDurchAnhang: string | null;
  }[];
  beziehungen: {
    art: string;
    richtung: string;
    rolle: string | null;
    gegenstueck: { kennung: string; titel: string; ordner: string | null };
    gesetztVon: PersonAngabe;
    gesetztAm: string;
  }[];
}

export interface WissenspaketManifest {
  format: "klarwerk-wissenspaket";
  formatVersion: 1;
  erstelltAm: string;
  produkt: Produktfassung;
  exportiertVon: { kennung: string; name: string | null; rolle: string };
  umfang: {
    regel: string;
    vertraulichEnthalten: boolean;
    auswahl: string[] | null;
    beitraege: number;
    fassungen: number;
    anhaenge: number;
  };
  beitraege: ManifestBeitrag[];
  nichtEnthalten: { bereich: string; grund: string }[];
  /** Jede Datei des Pakets außer diesem Manifest, mit Größe und Prüfsumme. */
  dateien: { datei: string; bytes: number; sha256: string }[];
}

// ------------------------------------------------------------------------------------------------
// Die lesbaren Dateien
// ------------------------------------------------------------------------------------------------

function personText(p: PersonAngabe): string {
  return p.name ? `${p.name} (Kennung ${p.kennung})` : `Kennung ${p.kennung}`;
}

function fassungMarkdown(
  stand: KnowledgeObject,
  kopf: { fassung: number; aktuell: boolean; gesamt: number; neueste: number; am: string },
  von: PersonAngabe,
  vermerk: string,
): string {
  const zeilen: string[] = [
    `# ${stand.title}`,
    "",
    kopf.aktuell
      ? `> AKTUELLE FASSUNG ${kopf.fassung} (von ${kopf.gesamt} gespeicherten Fassungen)`
      : `> HISTORISCHE FASSUNG ${kopf.fassung} — ersetzt; aktuell ist Fassung ${kopf.neueste}`,
    "",
    `- Stand vom: ${kopf.am}`,
    `- Bearbeitet von: ${personText(von)}`,
    ...(vermerk ? [`- Vermerk: ${vermerk}`] : []),
    `- Status: ${stand.status} · Vertraulichkeit: ${stand.confidentiality ?? "intern"}`,
    "",
    "## Aussage",
    "",
    stand.statement,
  ];
  if (stand.conditions.length > 0) {
    zeilen.push("", "## Wann es gilt", "", ...stand.conditions.map((c) => `- ${c}`));
  }
  if (stand.measures.length > 0) {
    zeilen.push("", "## Vorgehen", "", ...stand.measures.map((m) => `- ${m}`));
  }
  if (stand.bodyHtml) {
    zeilen.push("", "## Inhalt", "", htmlAlsText(stand.bodyHtml));
  }
  if (stand.sources.length > 0) {
    zeilen.push(
      "",
      "## Quellen",
      "",
      ...stand.sources.map((q) => `- ${q.label}${q.url ? ` — ${q.url}` : ""}`),
    );
  }
  if (stand.attachments.length > 0) {
    zeilen.push(
      "",
      "## Anhänge dieser Fassung",
      "",
      ...stand.attachments.map((a) => `- ${a.name}`),
    );
  }
  return `${zeilen.join("\n")}\n`;
}

function aktuellMarkdown(b: ManifestBeitrag): string {
  const zeilen: string[] = [
    `# ${b.titel}`,
    "",
    `> Aktuelle Fassung ${b.aktuelleFassung} · Status ${b.freigabe.status} · Vertraulichkeit ${b.rechte.vertraulichkeit}`,
    "",
    "## Aussage",
    "",
    b.aussage,
    "",
    "## Verantwortung und Freigabe",
    "",
    `- Autor: ${personText(b.autor)}`,
    `- Verantwortlich: ${b.verantwortung.verantwortlich ? personText(b.verantwortung.verantwortlich) : "nicht benannt"}`,
    ...(b.verantwortung.verantwortlicheRolle
      ? [`- Verantwortliche Rolle: ${b.verantwortung.verantwortlicheRolle}`]
      : []),
    `- Validiert von: ${b.verantwortung.validierer.length > 0 ? b.verantwortung.validierer.map(personText).join(", ") : "–"}`,
    `- Space: ${b.rechte.space ? (b.rechte.space.name ?? b.rechte.space.kennung) : "kein Space"}`,
    "",
    "## Fassungen",
    "",
    ...b.fassungen.map(
      (f) =>
        `- Fassung ${f.fassung}${f.aktuell ? " (aktuell)" : " (historisch)"} vom ${f.am}: ${f.datei}`,
    ),
    ...b.fassungenAusgelassen.map((f) => `- Fassung ${f.fassung}: nicht im Paket — ${f.grund}`),
  ];
  if (b.anhaenge.length > 0 || b.anhaengeAusgelassen.length > 0) {
    zeilen.push(
      "",
      "## Anhänge",
      "",
      ...b.anhaenge.map((a) => `- ${a.name}: ${a.datei} (${a.bytes} Bytes, SHA-256 ${a.sha256})`),
      ...b.anhaengeAusgelassen.map((a) => `- ${a.name}: nicht im Paket — ${a.grund}`),
    );
  }
  if (b.quellen.length > 0) {
    zeilen.push(
      "",
      "## Quellen",
      "",
      ...b.quellen.map(
        (q) =>
          `- ${q.bezeichnung}${q.adresse ? ` — ${q.adresse}` : ""}${q.belegtDurchAnhang ? ` (belegt durch ${q.belegtDurchAnhang})` : ""}`,
      ),
    );
  }
  if (b.beziehungen.length > 0) {
    zeilen.push(
      "",
      "## Beziehungen",
      "",
      ...b.beziehungen.map(
        (r) =>
          `- ${r.art}${r.rolle ? ` (${r.rolle})` : ""}: ${r.gegenstueck.titel}${r.gegenstueck.ordner ? ` → ${r.gegenstueck.ordner}` : " (nicht in diesem Paket)"}`,
      ),
    );
  }
  return `${zeilen.join("\n")}\n`;
}

function liesmich(m: WissenspaketManifest): string {
  const zeilen: string[] = [
    "# KLARWERK-Wissenspaket",
    "",
    `Erstellt am ${m.erstelltAm} aus KLARWERK ${m.produkt.version} (Commit ${m.produkt.commit}).`,
    `Exportiert von ${m.exportiertVon.name ?? "–"} (Rolle ${m.exportiertVon.rolle}).`,
    "",
    "## Was drin ist",
    "",
    `- ${m.umfang.beitraege} Beiträge mit ${m.umfang.fassungen} Fassungen und ${m.umfang.anhaenge} Originalanhängen.`,
    `- Regel: ${m.umfang.regel}`,
    "- `beitraege/<Nummer>-<Titel>/aktuell.md` — der aktuelle Stand, mit Verantwortung, Freigabe, Quellen und Beziehungen.",
    "- `beitraege/<Nummer>-<Titel>/fassungen/v<n>.md` — jede Fassung; die Kopfzeile sagt AKTUELL oder HISTORISCH.",
    "- `beitraege/<Nummer>-<Titel>/anhaenge/` — die Originaldateien, Byte für Byte wie hochgeladen.",
    "- `beitraege/<Nummer>-<Titel>/beitrag.json` — derselbe Stand strukturiert.",
    "- `zuordnungen.csv` — jede Datei mit Beitrag, Fassung und Quelle (öffnet in jeder Tabellenkalkulation).",
    "- `MANIFEST.json` — das vollständige Verzeichnis mit Größe und SHA-256 jeder Datei.",
    "",
    "## Was nicht drin ist",
    "",
    ...m.nichtEnthalten.map((n) => `- ${n.bereich}: ${n.grund}`),
    "",
    "## Öffnen",
    "",
    "Das ZIP mit dem Betriebssystem entpacken. Markdown-Dateien sind Text und öffnen in jedem Editor;",
    "die CSV-Datei ist mit Semikolon getrennt. Die Prüfsummen im Manifest lassen sich z. B. mit",
    "`shasum -a 256 <datei>` nachrechnen.",
  ];
  return `${zeilen.join("\n")}\n`;
}

// ------------------------------------------------------------------------------------------------
// Der Bau
// ------------------------------------------------------------------------------------------------

export interface Wissenspaket {
  zip: Buffer;
  manifest: WissenspaketManifest;
}

export async function baueWissenspaket(
  auftrag: WissenspaketAuftrag,
  quellen: WissenspaketQuellen,
): Promise<Wissenspaket> {
  const { betrachter, vertraulichErlaubt } = auftrag;
  const sichtbar: Sichtbarkeitsfilter = (ko) => darfSehen(betrachter, ko);
  const [namen, spaceNamen] = await Promise.all([quellen.personen(), quellen.spaces()]);
  const person = (kennung: string): PersonAngabe => ({
    kennung,
    name: namen.get(kennung) ?? null,
  });
  /** Die Stufe, wie der Betrachter sie exportieren darf — Grundmenge UND Sichtregel. */
  const darf = (f: Fakten): boolean =>
    darfSehen(betrachter, f) && (vertraulichErlaubt || !isConfidential(f.confidentiality));

  const zip = new JSZip();
  const dateien: { datei: string; bytes: number; sha256: string }[] = [];
  const lege = (datei: string, inhalt: Buffer | string): void => {
    const bytes = typeof inhalt === "string" ? Buffer.from(inhalt, "utf8") : inhalt;
    zip.file(datei, bytes, { date: auftrag.jetzt });
    dateien.push({ datei, bytes: bytes.length, sha256: sha256(bytes) });
  };

  // Erst die Ordner aller Beiträge, damit eine Beziehung auf einen Beitrag weiter hinten schon
  // ihren Pfad kennt.
  const voll: KnowledgeObject[] = [];
  for (const gelistet of auftrag.beitraege) {
    const ko = (await quellen.beitrag(gelistet.id)) ?? gelistet;
    // Die Grundmenge wird NIE erweitert: was der volle Abruf anders einstuft, fällt hier heraus.
    if (darf(faktenVon(ko)) && ko.status === "validiert") {
      voll.push(ko);
    }
  }
  // Feste Reihenfolge (Anlage, dann Kennung): dieselbe Menge ergibt dieselben Ordnernummern — vor
  // und nach einer Wiederherstellung, gleich in welcher Reihenfolge die Ablage liefert.
  voll.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const ordner = new Map<string, string>();
  for (const [i, ko] of voll.entries()) {
    const nummer = String(i + 1).padStart(3, "0");
    ordner.set(ko.id, `beitraege/${nummer}-${sichererName(ko.title, "beitrag")}`);
  }

  const csv: string[] = ["datei;art;beitrag;beitrag_kennung;fassung;quelle"];
  const beitraege: ManifestBeitrag[] = [];
  let anhangBytes = 0;
  let fassungenGesamt = 0;
  let anhaengeGesamt = 0;

  for (const ko of voll) {
    const pfad = ordner.get(ko.id) as string;
    // --- Fassungen -----------------------------------------------------------------------------
    const gespeichert = [...(await quellen.fassungen(ko.id))];
    gespeichert.sort((a, b) => a.version - b.version);
    const neueste = ko.version;
    const fassungen: ManifestFassung[] = [];
    const fassungenAusgelassen: { fassung: number; grund: string }[] = [];
    for (const f of gespeichert) {
      const stand = f.snapshot;
      if (!darf(faktenVon(ko, stand.confidentiality ?? "intern"))) {
        fassungenAusgelassen.push({ fassung: f.version, grund: GRUND_STUFE_FASSUNG });
        continue;
      }
      const aktuell = f.version === neueste;
      const art = aktuell ? "fassung_aktuell" : "fassung_historisch";
      const datei = `${pfad}/fassungen/v${f.version}.md`;
      lege(
        datei,
        fassungMarkdown(
          stand,
          { fassung: f.version, aktuell, gesamt: gespeichert.length, neueste, am: f.at },
          person(f.author),
          f.note,
        ),
      );
      csv.push(csvZeile(datei, art, ko.title, ko.id, f.version, ""));
      fassungen.push({
        fassung: f.version,
        aktuell,
        am: f.at,
        von: person(f.author),
        vermerk: f.note,
        titel: stand.title,
        vertraulichkeit: stand.confidentiality ?? "intern",
        datei,
      });
    }
    fassungenGesamt += fassungen.length;

    // --- Anhänge -------------------------------------------------------------------------------
    const anhaenge: ManifestAnhang[] = [];
    const anhaengeAusgelassen: { name: string; grund: string }[] = [];
    const vergeben = new Set<string>();
    const dateiFuerObjekt = new Map<string, string>();
    for (const a of ko.attachments) {
      const objekt = a.objectId ? await quellen.objekt(a.objectId) : undefined;
      const stufe = isConfidential(ko.confidentiality) ? "vertraulich" : dateiStufe(objekt, a);
      if (!darf(faktenVon(ko, stufe))) {
        anhaengeAusgelassen.push({ name: a.name, grund: GRUND_STUFE_ANHANG });
        continue;
      }
      const daten = objekt?.data ?? a.dataUrl;
      const roh = daten === undefined ? null : decodeDataUrl(daten);
      if (!roh) {
        anhaengeAusgelassen.push({
          name: a.name,
          grund: daten === undefined ? GRUND_FEHLT : GRUND_UNLESBAR,
        });
        continue;
      }
      if (anhangBytes + roh.bytes.length > PAKET_ANHANG_DECKEL_BYTES) {
        anhaengeAusgelassen.push({ name: a.name, grund: GRUND_DECKEL });
        continue;
      }
      anhangBytes += roh.bytes.length;
      let name = sichererName(a.name, "anhang");
      for (let n = 2; vergeben.has(name); n++) {
        name = `${n}-${sichererName(a.name, "anhang")}`;
      }
      vergeben.add(name);
      const datei = `${pfad}/anhaenge/${name}`;
      lege(datei, roh.bytes);
      if (a.objectId) {
        dateiFuerObjekt.set(a.objectId, datei);
      }
      csv.push(csvZeile(datei, "anhang", ko.title, ko.id, ko.version, a.name));
      anhaenge.push({
        name: a.name,
        mime: a.mime,
        bytes: roh.bytes.length,
        sha256: sha256(roh.bytes),
        datei,
        objektKennung: a.objectId ?? null,
        hochgeladenVon: person(a.author),
      });
    }
    anhaengeGesamt += anhaenge.length;

    // --- Quellen, Beziehungen, Verantwortung ------------------------------------------------------
    const quellenListe = ko.sources.map((q) => ({
      bezeichnung: q.label,
      adresse: q.url,
      auszug: q.excerpt,
      art: q.kind,
      anbieter: q.provider ?? null,
      // JOB 4077: der Anker ist die Objektkennung eines Anhangs dieses Beitrags — im Paket die Datei.
      belegtDurchAnhang: q.objectId ? (dateiFuerObjekt.get(q.objectId) ?? null) : null,
    }));
    const kanten = await quellen.beziehungen(ko.id, sichtbar);
    const beziehungen = [...kanten.kanten].sort(kantenOrdnung).map((k) => ({
      art: k.art,
      richtung: k.richtung,
      rolle: k.rolle ?? null,
      gegenstueck: {
        kennung: k.gegenstueck.id,
        titel: k.gegenstueck.title,
        ordner: ordner.get(k.gegenstueck.id) ?? null,
      },
      gesetztVon: person(k.urheber),
      gesetztAm: k.gesetztAm,
    }));
    const own = ko.ownership;
    const spaceId = typeof ko.spaceId === "string" ? ko.spaceId : null;
    const eintrag: ManifestBeitrag = {
      ordner: pfad,
      kennung: ko.id,
      titel: ko.title,
      aussage: ko.statement,
      art: ko.type,
      kategorie: ko.category,
      aktuelleFassung: ko.version,
      freigabe: {
        status: ko.status,
        benoetigtePruefungen: ko.neededValidations,
        entscheidungImAudit: ko.validationDecisionRef?.auditSeq ?? null,
      },
      rechte: {
        vertraulichkeit: ko.confidentiality ?? "intern",
        space: spaceId ? { kennung: spaceId, name: spaceNamen.get(spaceId) ?? null } : null,
        quellLeserBeschraenkt: Array.isArray(ko.quellrechte?.leser),
      },
      autor: person(ko.author),
      ursprungsautor: person(ko.originalAuthor),
      verantwortung: {
        verantwortlich: own?.owner ? person(own.owner) : null,
        verantwortlicheRolle: own?.ownerRole ?? null,
        pruefer: (own?.reviewers ?? []).map(person),
        validierer: (own?.validators ?? []).map(person),
      },
      fassungen,
      fassungenAusgelassen,
      anhaenge,
      anhaengeAusgelassen,
      quellen: quellenListe,
      beziehungen,
    };
    beitraege.push(eintrag);

    const aktuellDatei = `${pfad}/aktuell.md`;
    lege(aktuellDatei, aktuellMarkdown(eintrag));
    csv.push(csvZeile(aktuellDatei, "beitrag_aktuell", ko.title, ko.id, ko.version, ""));
    const struktur = {
      ...eintrag,
      wannEsGilt: ko.conditions,
      vorgehen: ko.measures,
      schlagwoerter: ko.tags,
      inhaltHtml: ko.bodyHtml ?? null,
      angelegtAm: ko.createdAt,
      verlauf: ko.history.map((h) => ({
        fassung: h.version,
        am: h.at,
        von: person(h.author),
        vermerk: h.note,
      })),
    };
    const jsonDatei = `${pfad}/beitrag.json`;
    lege(jsonDatei, `${JSON.stringify(struktur, null, 2)}\n`);
    csv.push(csvZeile(jsonDatei, "beitrag_struktur", ko.title, ko.id, ko.version, ""));
  }

  lege("zuordnungen.csv", `${csv.join("\n")}\n`);

  const manifest: WissenspaketManifest = {
    format: "klarwerk-wissenspaket",
    formatVersion: 1,
    erstelltAm: auftrag.jetzt.toISOString(),
    produkt: quellen.produkt,
    exportiertVon: {
      kennung: betrachter.id,
      name: auftrag.betrachterName,
      rolle: betrachter.role,
    },
    umfang: {
      regel: vertraulichErlaubt
        ? "Validierte Beiträge, die du sehen darfst, einschließlich vertraulicher (Prüfrecht)."
        : "Validierte, nicht vertrauliche Beiträge, die du sehen darfst.",
      vertraulichEnthalten: vertraulichErlaubt,
      auswahl: auftrag.auswahl ? [...auftrag.auswahl] : null,
      beitraege: beitraege.length,
      fassungen: fassungenGesamt,
      anhaenge: anhaengeGesamt,
    },
    beitraege,
    nichtEnthalten: [...PAKET_NICHT_ENTHALTEN],
    dateien: [],
  };
  // LIESMICH zählt zu den geprüften Dateien; das Manifest beschreibt alle außer sich selbst.
  lege("LIESMICH.md", liesmich(manifest));
  manifest.dateien = [...dateien];
  zip.file("MANIFEST.json", `${JSON.stringify(manifest, null, 2)}\n`, { date: auftrag.jetzt });

  const puffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { zip: puffer, manifest };
}
