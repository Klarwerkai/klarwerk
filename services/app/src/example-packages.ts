// WP-B6 (Pedis Wunsch für die VIP-2-Tester): MODULARE Beispielpakete. Statt eines unsortierten
// Datenbergs laden Tester gezielt EIN kuratiertes Szenario — Konflikte, Bilder oder gemischte
// Qualität. Die Pakete sind reine DATEN (kein UI-Hardcode) und laufen ausschließlich über die
// BESTEHENDEN Anlege-Wege (KoService.create — dieselbe Mechanik wie der Demo-Seed: Beispiel-KOs
// entstehen direkt als KO, Audit/Statuslogik bleiben real). Jedes Beispiel-KO trägt:
//  - den sichtbaren Titel-Präfix EXAMPLE_TITLE_PREFIX (klar als Beispiel gekennzeichnet),
//  - einen Herkunfts-Anker (provider "Beispielpaket" + stabile externalId) für die IDEMPOTENZ
//    (zweites Laden desselben Pakets legt nichts doppelt an),
//  - das bestehende demoSeed-Flag: ENTFERNT werden Beispiele über den vorhandenen
//    Demo-Daten-Purge (DELETE /api/admin/demo-seed) — BEWUSST NICHT über das Import-Aufräumen
//    (WP-D-CLEAN): das räumt Confluence-/Jira-Provenienz auf, Beispiele sind aber Demo-Inhalt
//    mit eigener Provenienz. Die UI sagt das ehrlich dazu.
import type { AuditService } from "../../audit";
import type { Conflict, ConflictService } from "../../conflicts";
import type { KnowledgeType, KoService, KoSource } from "../../knowledge-object";
import type { ObjectStore } from "../../object-store";

export const EXAMPLE_PROVIDER = "Beispielpaket";
export const EXAMPLE_TITLE_PREFIX = "[Beispiel] ";

export type ExamplePackageId = "konflikte" | "bilder" | "qualitaet";
export const EXAMPLE_PACKAGE_IDS: readonly ExamplePackageId[] = [
  "konflikte",
  "bilder",
  "qualitaet",
];

export interface ExampleImageDef {
  caption: string;
}

export interface ExampleKoDef {
  key: string; // stabiler Bestandteil der externalId (Idempotenz)
  title: string; // OHNE Präfix — der Loader setzt EXAMPLE_TITLE_PREFIX davor
  statement: string;
  type: KnowledgeType;
  category: string;
  tags?: string[];
  conditions?: string[];
  measures?: string[];
  // "bilder"-Paket: je Eintrag entsteht eine echte figure mit Bild-Fußnote (Objekt im Store).
  images?: ExampleImageDef[];
  // "konflikte"-Paket: key des Widerspruchs-Partners — paarweise, gegenseitig.
  conflictsWith?: string;
}

export interface ExamplePackage {
  id: ExamplePackageId;
  kos: ExampleKoDef[];
}

// Nüchternes, realistisches Beispielwissen (Maschinenbau/Fertigung, DE) — bewusst kurz gehalten.
export const EXAMPLE_PACKAGES: readonly ExamplePackage[] = [
  {
    // (a) Validierungs-Szenario: drei Paare mit sich widersprechenden Aussagen.
    id: "konflikte",
    kos: [
      {
        key: "anzug-a",
        title: "Radschrauben der Baureihe RS-40 mit 120 Nm anziehen",
        statement:
          "Radschrauben der Baureihe RS-40 werden über Kreuz mit 120 Nm angezogen. Nach dem Anziehen den Drehmomentschlüssel entspannen und den Wert im Wartungsblatt vermerken.",
        type: "best_practice",
        category: "Montage",
        tags: ["beispiel", "montage"],
        conflictsWith: "anzug-b",
      },
      {
        key: "anzug-b",
        title: "Radschrauben der Baureihe RS-40 mit 90 Nm anziehen",
        statement:
          "Radschrauben der Baureihe RS-40 dürfen mit höchstens 90 Nm angezogen werden — höhere Momente beschädigen die Felgenauflage und führen zu Setzverlusten.",
        type: "technik",
        category: "Montage",
        tags: ["beispiel", "montage"],
        conflictsWith: "anzug-a",
      },
      {
        key: "kuehl-a",
        title: "Kühlschmierstoff der Drehbank wöchentlich prüfen",
        statement:
          "Der Kühlschmierstoff der Drehbank D-12 wird jede Woche auf Konzentration und pH-Wert geprüft; unter 8,5 Prozent Konzentration wird nachdosiert.",
        type: "best_practice",
        category: "Wartung",
        tags: ["beispiel", "wartung"],
        conflictsWith: "kuehl-b",
      },
      {
        key: "kuehl-b",
        title: "Kühlschmierstoff der Drehbank nur monatlich prüfen",
        statement:
          "Eine monatliche Prüfung des Kühlschmierstoffs an der Drehbank D-12 reicht aus — häufigeres Prüfen bringt keinen messbaren Nutzen und kostet Rüstzeit.",
        type: "bauchgefuehl",
        category: "Wartung",
        tags: ["beispiel", "wartung"],
        conflictsWith: "kuehl-a",
      },
      {
        key: "schmier-a",
        title: "Linearführungen vor jeder Schicht abschmieren",
        statement:
          "Die Linearführungen der Portalfräse werden vor jeder Schicht mit zwei Hüben Fett abgeschmiert, damit kein Trockenlauf entsteht.",
        type: "best_practice",
        category: "Wartung",
        tags: ["beispiel", "schmierung"],
        conflictsWith: "schmier-b",
      },
      {
        key: "schmier-b",
        title: "Linearführungen nur alle 200 Betriebsstunden schmieren",
        statement:
          "Die Linearführungen der Portalfräse werden nur alle 200 Betriebsstunden geschmiert — tägliches Abschmieren verharzt die Führung und bindet Späne.",
        type: "lernkurve",
        category: "Wartung",
        tags: ["beispiel", "schmierung"],
        conflictsWith: "schmier-a",
      },
    ],
  },
  {
    // (b) Galerie-/Suche-Szenario: KOs mit figures und beschreibenden Bild-Fußnoten.
    id: "bilder",
    kos: [
      {
        key: "verschleiss",
        title: "Verschleißbild einer Führungsschiene erkennen",
        statement:
          "Riefen in Laufrichtung deuten auf Schmiermangel, punktförmige Ausbrüche auf Überlastung. Das Verschleißbild wird vor jedem Austausch fotografiert und dokumentiert.",
        type: "technik",
        category: "Instandhaltung",
        tags: ["beispiel", "verschleiss"],
        images: [
          { caption: "Riefen in Laufrichtung — typisches Bild bei Schmiermangel" },
          { caption: "Punktförmige Ausbrüche an der Lauffläche nach Überlastung" },
        ],
      },
      {
        key: "kabel",
        title: "Korrekte Kabelführung am Schaltschrank",
        statement:
          "Leitungen werden vor der Klemmleiste zugentlastet und mit mindestens 30 mm Abstand zu Leistungskabeln geführt; die Beschriftung zeigt zur Schranktür.",
        type: "best_practice",
        category: "Elektrik",
        tags: ["beispiel", "elektrik"],
        images: [{ caption: "Zugentlastung vor der Klemmleiste, Beschriftung zur Tür" }],
      },
      {
        key: "messuhr",
        title: "Messuhr am Planlauf richtig ansetzen",
        statement:
          "Die Messuhr wird senkrecht zur Planfläche angesetzt und mit einer Vorspannung von etwa einer halben Umdrehung genullt; erst dann wird das Werkstück gedreht.",
        type: "technik",
        category: "Messtechnik",
        tags: ["beispiel", "messen"],
        images: [
          { caption: "Messuhr senkrecht zur Planfläche mit halber Umdrehung Vorspannung" },
          { caption: "Ablesung nach einer vollen Werkstückumdrehung" },
        ],
      },
    ],
  },
  {
    // (c) Review-Szenario: bewusst gemischte Qualität — gut, kurz, veraltet.
    id: "qualitaet",
    kos: [
      {
        key: "gut-ruesten",
        title: "Rüstzeit an der Presse P-3 mit Rüstwagen halbieren",
        statement:
          "Alle Werkzeuge, Spannmittel und Messmittel für den nächsten Auftrag werden während der laufenden Serie auf dem Rüstwagen vorbereitet. Der Wechsel selbst folgt der Checkliste am Wagen: Werkzeug ausfahren, Wagen andocken, Spannpunkte in fester Reihenfolge lösen. Damit sinkt die Rüstzeit von rund 40 auf unter 20 Minuten.",
        type: "best_practice",
        category: "Fertigung",
        tags: ["beispiel", "ruesten"],
        measures: [
          "Rüstwagen während der laufenden Serie bestücken",
          "Checkliste am Wagen abarbeiten",
        ],
      },
      {
        key: "gut-einfahren",
        title: "Neue Fräswerkzeuge kontrolliert einfahren",
        statement:
          "Neue Fräswerkzeuge werden mit 70 Prozent des Katalogvorschubs eingefahren und nach zehn Minuten auf Schneidenverschleiß geprüft. Erst wenn keine Aufbauschneide sichtbar ist, wird auf den vollen Vorschub erhöht — das verlängert die Standzeit messbar.",
        type: "lernkurve",
        category: "Fertigung",
        tags: ["beispiel", "werkzeuge"],
      },
      {
        key: "kurz-filter",
        title: "Hydraulikfilter tauschen",
        statement: "Filter bei Bedarf tauschen.",
        type: "bauchgefuehl",
        category: "Wartung",
        tags: ["beispiel"],
      },
      {
        key: "alt-norm",
        title: "Instandhaltungsplan nach zurückgezogener Norm pflegen",
        statement:
          "Der Instandhaltungsplan folgt der Gliederung der DIN 31051 in der Fassung von 2003 — diese Fassung ist inzwischen zurückgezogen; die Begriffe decken sich nicht mehr mit der aktuellen Ausgabe.",
        type: "technik",
        category: "Instandhaltung",
        tags: ["beispiel", "veraltet"],
      },
      {
        key: "alt-fax",
        title: "Ersatzteil-Eilbestellungen per Fax an die Zentrale senden",
        statement:
          "Eilbestellungen für Ersatzteile werden per Fax an die Zentrale geschickt; das Faxgerät steht im Meisterbüro. Das Bestellportal gilt als Zusatzweg.",
        type: "negativwissen",
        category: "Organisation",
        tags: ["beispiel", "veraltet"],
      },
    ],
  },
];

export function examplePackage(id: string): ExamplePackage | undefined {
  return EXAMPLE_PACKAGES.find((pkg) => pkg.id === id);
}

// Stabile externalId je Beispiel-KO — der Idempotenz-Anker (provider EXAMPLE_PROVIDER).
export function exampleExternalId(pkg: ExamplePackageId, key: string): string {
  return `beispiel-${pkg}-${key}`;
}

// 1×1 transparentes PNG — kleiner, technisch sauberer Beispiel-Bildinhalt (kein großer Blob).
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

export interface ExampleLoadServices {
  ko: KoService;
  objects: ObjectStore;
  // WP-SAMMEL21-FIX (bens Fix 1): die Konflikt-Paare des konflikte-Pakets entstehen über den
  // ECHTEN Konflikt-Service (createAuto — dasselbe Muster wie der Demo-Seed), damit sie am
  // Konflikt-Board wirklich erscheinen.
  conflicts: ConflictService;
  audit?: AuditService;
}

export interface ExampleLoadResult {
  package: ExamplePackageId;
  created: number;
  skipped: number;
  // WP-SAMMEL21-FIX (bens Fix 1): ehrliche Teilbilanz der Konflikt-Anlage (nur das
  // konflikte-Paket erzeugt welche; sonst stehen alle Zähler auf 0).
  conflicts: { created: number; skipped: number; failed: number };
}

// Lädt EIN Paket idempotent über die bestehenden Anlege-Wege. Bereits vorhandene Beispiel-KOs
// (Anker provider+externalId, nicht gelöscht) werden übersprungen — keine Duplikate, ehrliche
// Bilanz. Bilder entstehen als echte Objekte im Store (die figure verweist auf /api/objects/…).
export async function loadExamplePackage(
  services: ExampleLoadServices,
  pkg: ExamplePackage,
  actor: string,
): Promise<ExampleLoadResult> {
  // Anker → KO-Id auch für BEREITS vorhandene Beispiele merken: die Konflikt-Anlage unten braucht
  // die Paar-KO-Ids in JEDEM Lauf (auch beim idempotenten zweiten Laden).
  const existingByAnchor = new Map<string, string>();
  for (const ko of await services.ko.list()) {
    for (const s of ko.sources ?? []) {
      if (s.provider === EXAMPLE_PROVIDER && s.externalId) {
        existingByAnchor.set(s.externalId, ko.id);
      }
    }
  }
  let created = 0;
  let skipped = 0;
  const koIdByKey = new Map<string, string>();
  for (const def of pkg.kos) {
    const externalId = exampleExternalId(pkg.id, def.key);
    const existingId = existingByAnchor.get(externalId);
    if (existingId !== undefined) {
      koIdByKey.set(def.key, existingId);
      skipped += 1;
      continue;
    }
    // Bilder-Paket: echte figures im BILD-1a-Vertrag (beidseitige data-image-id) — die Fußnoten
    // landen über den bestehenden create-Pfad im captionTexts-Suchfeld (Galerie/Suche-Szenario).
    let bodyHtml: string | undefined;
    if (def.images && def.images.length > 0) {
      const figures: string[] = [];
      for (let i = 0; i < def.images.length; i++) {
        const image = def.images[i] as ExampleImageDef;
        const ref = await services.objects.put({
          name: `${externalId}-${i + 1}.png`,
          mime: "image/png",
          data: TINY_PNG,
        });
        const imageId = `kw-img-bsp-${pkg.id}-${def.key}-${i + 1}`;
        figures.push(
          `<figure><img data-image-id="${imageId}" src="/api/objects/${ref.id}/raw" alt="${image.caption}"><figcaption data-image-id="${imageId}">${image.caption}</figcaption></figure>`,
        );
      }
      bodyHtml = `<p>${def.statement}</p>${figures.join("")}`;
    }
    const source: KoSource = {
      id: externalId,
      label: `${EXAMPLE_TITLE_PREFIX}${def.title}`,
      url: null,
      excerpt: null,
      kind: "external",
      peerValidated: false,
      provider: EXAMPLE_PROVIDER,
      externalId,
      sourceVersion: 1,
      author: actor,
      at: new Date().toISOString(),
    };
    const ko = await services.ko.create({
      title: `${EXAMPLE_TITLE_PREFIX}${def.title}`,
      statement: def.statement,
      type: def.type,
      category: def.category,
      author: actor,
      tags: def.tags ?? ["beispiel"],
      ...(def.conditions ? { conditions: def.conditions } : {}),
      ...(def.measures ? { measures: def.measures } : {}),
      ...(bodyHtml ? { bodyHtml } : {}),
      sources: [source],
      // Entfernen-Weg: der bestehende Demo-Purge (demoSeed) — NICHT das Import-Aufräumen.
      demoSeed: true,
    });
    koIdByKey.set(def.key, ko.id);
    created += 1;
  }
  const conflicts = await createExampleConflicts(services, pkg, koIdByKey, actor);
  await services.audit?.record({
    actor,
    action: "examples.load",
    target: pkg.id,
    payload: { created, skipped, conflicts },
  });
  return { package: pkg.id, created, skipped, conflicts };
}

// WP-SAMMEL21-FIX (bens Fix 1, ROT): die conflictsWith-Paare als ECHTE Konflikte anlegen —
// über conflicts.createAuto (dasselbe Muster wie der Demo-Seed), damit sie am Board erscheinen.
// IDEMPOTENT über einen stabilen Paar-Anker: die KO-Ids der Beispiel-KOs sind über den
// externalId-Anker laufübergreifend stabil; existiert bereits ein UNGELÖSTER Konflikt mit genau
// diesem KO-Paar (in beliebiger Reihenfolge), wird NICHT erneut angelegt.
// bens GELB (Idempotenz-Atomik, ohne großen Umbau): das check-then-create ist per catch-and-recheck
// gehärtet — wirft createAuto (z. B. kollidierendes Parallel-Laden), wird der Bestand ERNEUT
// geprüft: existiert das Paar inzwischen, zählt es ehrlich als übersprungen, sonst als
// fehlgeschlagen (Teilbilanz statt Abbruch; die übrigen Paare laufen weiter).
async function createExampleConflicts(
  services: ExampleLoadServices,
  pkg: ExamplePackage,
  koIdByKey: ReadonlyMap<string, string>,
  actor: string,
): Promise<{ created: number; skipped: number; failed: number }> {
  const balance = { created: 0, skipped: 0, failed: 0 };
  const pairExists = (open: readonly Conflict[], idA: string, idB: string): boolean =>
    open.some((c) => (c.koA === idA && c.koB === idB) || (c.koA === idB && c.koB === idA));
  for (const def of pkg.kos) {
    // Jedes Paar ist beidseitig definiert (a→b und b→a) — nur EINE Richtung verarbeitet es.
    if (!def.conflictsWith || def.key > def.conflictsWith) {
      continue;
    }
    const idA = koIdByKey.get(def.key);
    const idB = koIdByKey.get(def.conflictsWith);
    const partner = pkg.kos.find((k) => k.key === def.conflictsWith);
    if (idA === undefined || idB === undefined || partner === undefined) {
      balance.failed += 1; // Paar unvollständig (KO-Anlage scheiterte) — ehrlich ausweisen
      continue;
    }
    if (pairExists(await services.conflicts.unresolved(), idA, idB)) {
      balance.skipped += 1;
      continue;
    }
    try {
      await services.conflicts.createAuto(
        {
          koA: idA,
          koB: idB,
          type: "truth",
          description: `Widersprüchliche Beispiel-Aussagen: ${def.title} vs. ${partner.title}`,
        },
        {
          trigger: "background",
          method: "deterministic",
          rationale:
            "Kuratiertes Widerspruchs-Paar aus dem Beispielpaket (kein Modell-Fund) — zum Ausprobieren des Konflikt-Boards.",
        },
        actor,
      );
      balance.created += 1;
    } catch {
      // catch-and-recheck: hat ein paralleler Lauf das Paar inzwischen angelegt → übersprungen.
      if (pairExists(await services.conflicts.unresolved(), idA, idB)) {
        balance.skipped += 1;
      } else {
        balance.failed += 1;
      }
    }
  }
  return balance;
}
