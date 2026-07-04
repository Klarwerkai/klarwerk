import type { AskService } from "../../ask";
import type { AuthService } from "../../auth";
import type { ConflictService } from "../../conflicts";
import type { KoService } from "../../knowledge-object";
import type { LifecycleService } from "../../lifecycle";
import type { ObjectStore } from "../../object-store";
import type { ValidationService } from "../../validation";

// SCRUM-156/181: reproduzierbarer Demo-/Dev-Seed. Erzeugt einen kleinen, ehrlichen Bestand
// AUSSCHLIESSLICH über die echten Services — Audit/Statuslogik/Side-Effects bleiben real,
// nichts wird manuell gefälscht. Macht die Stage-1-Flows (Start/Library/Ask/Validation/Risk/
// Lifecycle/Analytics/MyTasks/KnowledgeDetail) in der Review sichtbar.
//
// NICHT-Ziele: keine Produktionsdaten, kein Auto-Start, keine UI-Mocks, kein Fake-Backend.
//
// Hinweis zur Modulstruktur: bewusst KEIN Import aus build-app (würde build-app↔seed-Zyklus
// erzeugen). Stattdessen ein strukturelles Service-Interface — AppServices erfüllt es.
export interface DemoSeedServices {
  auth: AuthService;
  ko: KoService;
  validation: ValidationService;
  ask: AskService;
  conflicts: ConflictService;
  lifecycle: LifecycleService;
  objects: ObjectStore;
}

// 1×1 transparentes PNG als kleiner, technisch sauberer Demo-Anhang (kein großer Blob).
// Demo-Herkunfts-Tag — MUSS mit apps/web/src/lib/demoKnowledge.ts übereinstimmen.
// Modulweit, damit Seed UND Purge dieselbe Quelle nutzen.
export const DEMO_TAG = "pilot-demo";

// Bug (Pedi 04.07.): Die vom Seed erzeugte Demo-Wissenslücke gehört zu den Beispielen und muss
// beim Demo-Purge mitverschwinden. EINE Quelle für Seed UND Purge (Abgleich per Frage-Präfix,
// robust gegen die Normalisierung der gespeicherten Gap-Frage).
export const DEMO_GAP_QUESTION =
  "Warum schwankt der Dosierwert an Linie L4 nach jedem Schichtwechsel?";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

export interface SeedResult {
  skipped: boolean;
  users: number;
  kos: number;
  validated: number;
  gaps: number;
  conflicts: number;
  pendingRevalidation: number;
  attachments: number;
  sources: number;
}

const EMPTY_RESULT: SeedResult = {
  skipped: true,
  users: 0,
  kos: 0,
  validated: 0,
  gaps: 0,
  conflicts: 0,
  pendingRevalidation: 0,
  attachments: 0,
  sources: 0,
};

interface SeedActors {
  adminId: string;
  controllerId: string;
  expertId: string;
}

// Deterministischer Seed über die echten Services. Guard: nur eine frische, NOCH NICHT
// eingerichtete Instanz (needsSetup) → CLI/Dev-Pfad. Idempotent (zweiter Lauf überspringt).
export async function seedDemo(services: DemoSeedServices): Promise<SeedResult> {
  if (!(await services.auth.needsSetup()) || (await services.ko.list()).length > 0) {
    return EMPTY_RESULT;
  }

  const { auth } = services;
  // Erstes Konto = Admin + freigegeben; weitere via diesen Admin freigeben.
  const admin = await auth.register({
    name: "Demo Admin",
    email: "admin@demo.klarwerk",
    password: "demo-admin-pass",
  });
  const actors = await seedDemoUsers(services, admin.id);
  return buildDemoContent(services, { adminId: admin.id, ...actors });
}

// SCRUM-181: Admin-getriebener Demo-Seed für eine BEREITS eingerichtete Instanz (Login existiert).
// Idempotenz-Guard: nur seeden, wenn die Wissensbasis leer ist (keine stillen Duplikate). Die
// Demo-Mitnutzer werden über den real angemeldeten Admin freigegeben — keine gefälschten Rechte.
export async function seedDemoForAdmin(
  services: DemoSeedServices,
  adminId: string,
): Promise<SeedResult> {
  if ((await services.ko.list()).length > 0) {
    return EMPTY_RESULT;
  }
  const actors = await seedDemoUsers(services, adminId);
  return buildDemoContent(services, { adminId, ...actors });
}

// Legt Controller/Experte an und gibt sie über den (realen) Admin frei.
async function seedDemoUsers(
  services: DemoSeedServices,
  adminId: string,
): Promise<{ controllerId: string; expertId: string }> {
  const { auth } = services;
  const carla = await auth.register({
    name: "Carla Controller",
    email: "carla@demo.klarwerk",
    password: "demo-pass-carla",
  });
  await auth.approveUser(carla.id, adminId);
  await auth.changeRole(carla.id, "controller", adminId);
  const erik = await auth.register({
    name: "Erik Experte",
    email: "erik@demo.klarwerk",
    password: "demo-pass-erik",
  });
  await auth.approveUser(erik.id, adminId);
  return { controllerId: carla.id, expertId: erik.id };
}

// Baut den eigentlichen Demo-Bestand über die echten Services — identisch für CLI und Admin-UI.
async function buildDemoContent(
  services: DemoSeedServices,
  actors: SeedActors,
): Promise<SeedResult> {
  const { auth, ko, validation, ask, conflicts, lifecycle, objects } = services;
  const adminId = actors.adminId;
  const carlaId = actors.controllerId;
  const erikId = actors.expertId;

  // SCRUM-308: eindeutiger Herkunfts-Tag für Demo-/Seed-Wissen (kein neues Datenmodell, keine
  // Migration — nur ein zusätzlicher Tag im vorhandenen tags-Feld). Muss mit dem FE-Konstanten
  // DEMO_TAG in apps/web/src/lib/demoKnowledge.ts übereinstimmen. Produktiv erfasste KOs tragen
  // diesen Tag NICHT (er wird ausschließlich hier im Seed gesetzt).
  // (DEMO_TAG jetzt modulweit — siehe oben; hier bewusst keine zweite Definition.)

  // --- Wissensobjekte (verschiedene Kategorien, Arten, Trust, Tags) ---
  const koValid = await ko.create({
    demoSeed: true,
    title: "Ventil X bei Überdruck manuell schließen.",
    statement:
      "Bei Überdruck über 6 bar Ventil X von Hand schließen, bis die Anlage entlastet ist.",
    type: "best_practice",
    category: "Anlage 1",
    author: erikId,
    tags: ["ventil", "überdruck", "sicherheit", DEMO_TAG],
    conditions: ["Druck > 6 bar"],
    measures: ["Ventil X schließen"],
    confidence: 80,
    neededValidations: 2,
    asset: "ANL-01",
  });
  const koOpen = await ko.create({
    demoSeed: true,
    title: "Pumpe P2 alle 200 Betriebsstunden schmieren.",
    statement: "Pumpe P2 alle 200 h mit Fett Typ Z schmieren.",
    type: "technik",
    category: "Anlage 2",
    author: erikId,
    tags: ["pumpe", "wartung", DEMO_TAG],
    confidence: 40,
    neededValidations: 2,
  });
  const koWarm = await ko.create({
    demoSeed: true,
    title: "Bei Kaltstart zuerst die Vorwärmung aktivieren.",
    statement: "Vor dem Kaltstart die Vorwärmung 10 min laufen lassen.",
    type: "lernkurve",
    category: "Anlage 1",
    author: erikId,
    tags: ["kaltstart", "vorwärmung", DEMO_TAG],
    confidence: 55,
    neededValidations: 2,
  });
  const koNoWarm = await ko.create({
    demoSeed: true,
    title: "Vorwärmung bei Kaltstart ist nicht nötig.",
    statement: "Kaltstart ohne Vorwärmung ist möglich und spart Zeit.",
    type: "negativwissen",
    category: "Anlage 1",
    author: adminId,
    tags: ["kaltstart", "vorwärmung", DEMO_TAG],
    confidence: 30,
    neededValidations: 2,
  });
  const koFilter = await ko.create({
    demoSeed: true,
    title: "Filter F3 monatlich auf Verschmutzung prüfen.",
    statement: "Filter F3 einmal pro Monat auf Verschmutzung prüfen und bei Bedarf tauschen.",
    type: "best_practice",
    category: "Anlage 3",
    author: erikId,
    tags: ["filter", "wartung", DEMO_TAG],
    confidence: 65,
    neededValidations: 2,
  });

  // Pedi 02.07. (Positionierung, wie KWEB-105/107): KLARWERK spricht JEDE Organisation an —
  // die Beta-Beispiele zeigen das ab dem ersten Blick. Vier zusätzliche Demo-KOs aus
  // Pflege, Kanzlei/Beratung, Verein/NGO und Versicherung (frei erfundenes Beispielwissen,
  // gleiche Mechanik: Tag + demoSeed-Merker, echte Services, purge-bar).
  // Wortwahl bewusst OHNE Überschneidung zur Demo-Wissenslücken-Frage („Schichtwechsel…",
  // s. u.): sonst fände der deterministische Reasoner eine Pseudo-Antwort und die
  // Demo-Lücke entstünde nicht mehr (Seed-Test fängt das ab).
  const koPflege = await ko.create({
    demoSeed: true,
    title: "Sturzprotokoll noch am selben Tag anlegen.",
    statement:
      "Stürzt ein Bewohner, das Sturzprotokoll sofort anlegen und die Pflegedienstleitung informieren — Erinnerungen am Folgetag sind unzuverlässig.",
    type: "best_practice",
    category: "Pflege & Gesundheit",
    author: erikId,
    tags: ["pflege", "dokumentation", "übergabe", DEMO_TAG],
    conditions: ["Sturzereignis eines Bewohners"],
    measures: ["Protokoll sofort anlegen", "PDL informieren"],
    confidence: 70,
    neededValidations: 2,
  });
  const koKanzlei = await ko.create({
    demoSeed: true,
    title: "Fristsachen doppelt eintragen: Akte UND zentraler Kalender.",
    statement:
      "Jede Frist wird sowohl in der Akte als auch im zentralen Fristenkalender notiert; nur der Kalender löst die Vorfrist eine Woche vorher aus.",
    type: "best_practice",
    category: "Kanzlei & Beratung",
    author: adminId,
    tags: ["frist", "kanzlei", "organisation", DEMO_TAG],
    confidence: 75,
    neededValidations: 2,
  });
  await ko.create({
    demoSeed: true,
    title: "Vereinsfest: Schankgenehmigung sechs Wochen vorher beantragen.",
    statement:
      "Die Gemeinde braucht den Antrag auf Schankgenehmigung spätestens sechs Wochen vor dem Fest — später wird es eng, weil der Ordnungsamts-Ausschuss nur monatlich tagt.",
    type: "lernkurve",
    category: "Verein & Ehrenamt",
    author: erikId,
    tags: ["verein", "veranstaltung", "genehmigung", DEMO_TAG],
    confidence: 50,
    neededValidations: 2,
  });
  await ko.create({
    demoSeed: true,
    title: "Wasserschaden: Erstmeldung ohne Gutachten sofort anlegen.",
    statement:
      "Bei gemeldetem Wasserschaden die Schadenakte sofort mit der Erstmeldung eröffnen und nicht auf das Gutachten warten — die Regressfrist läuft ab Meldung, nicht ab Gutachten.",
    type: "negativwissen",
    category: "Versicherung",
    author: adminId,
    tags: ["schaden", "frist", "regress", DEMO_TAG],
    confidence: 60,
    neededValidations: 2,
  });

  // SCRUM-385 Teil B (PMO-TODO-0002, Pedi): kuratierte Breite — JEDE der fünf Wissensarten
  // mit mindestens DREI Beispielen, inkl. Schweißnaht-Lernkurve und Negativwissen. Frei
  // erfundenes Beispielwissen, gleiche Mechanik (Tag + demoSeed-Merker, echte Services,
  // purge-bar). Wortwahl weiterhin OHNE Inhaltstoken der Demo-Wissenslücken-Frage
  // (schwankt/Dosierwert/Linie/jedem/Schichtwechsel) — sonst fände der deterministische
  // Reasoner eine Pseudo-Antwort und die Demo-Lücke entstünde nicht mehr (Seed-Test prüft).
  await ko.create({
    demoSeed: true,
    title: "Schweißnaht Baugruppe 7: Werkstück vorwärmen senkt Nacharbeit.",
    statement:
      "Seit die Werkstücke vor dem Schweißen auf 80 °C vorgewärmt werden, geht die Nacharbeitsquote der Naht deutlich zurück — über drei Monate dokumentierte Lernkurve der Spätschicht.",
    type: "lernkurve",
    category: "Anlage 2",
    author: erikId,
    tags: ["schweißen", "nacharbeit", "qualität", DEMO_TAG],
    conditions: ["Werkstück kälter als 80 °C"],
    measures: ["Vorwärmen auf 80 °C", "Temperatur dokumentieren"],
    confidence: 55,
    neededValidations: 2,
  });
  await ko.create({
    demoSeed: true,
    title: "Presse 3: dumpfes Brummen im Hauptlager ernst nehmen.",
    statement:
      "Beginnt das Hauptlager der Presse dumpf zu brummen, fällt es erfahrungsgemäß binnen weniger Tage aus — Gefühl erfahrener Instandhalter, noch ohne Messreihe.",
    type: "bauchgefuehl",
    category: "Anlage 2",
    author: erikId,
    tags: ["lager", "instandhaltung", DEMO_TAG],
    confidence: 25,
    neededValidations: 2,
  });
  await ko.create({
    demoSeed: true,
    title: "Auffällig unruhige Nacht kündigt oft einen Infekt an.",
    statement:
      "Wird ein sonst ruhiger Bewohner nachts auffällig unruhig, folgt erfahrungsgemäß binnen 48 Stunden ein Infekt — Erfahrungsgefühl der Nachtwachen, ärztlich nicht bestätigt.",
    type: "bauchgefuehl",
    category: "Pflege & Gesundheit",
    author: erikId,
    tags: ["pflege", "beobachtung", DEMO_TAG],
    confidence: 20,
    neededValidations: 2,
  });
  await ko.create({
    demoSeed: true,
    title: "Zu schnelle Zustimmung der Gegenseite: Nachforderungen einplanen.",
    statement:
      "Nimmt die Gegenseite ein Vergleichsangebot ungewöhnlich schnell an, folgen erfahrungsgemäß Nachforderungen — Bauchgefühl aus vielen Verfahren, keine belastbare Statistik.",
    type: "bauchgefuehl",
    category: "Kanzlei & Beratung",
    author: adminId,
    tags: ["verhandlung", "kanzlei", DEMO_TAG],
    confidence: 20,
    neededValidations: 2,
  });
  await ko.create({
    demoSeed: true,
    title: "Drehmomentschlüssel der Montage halbjährlich kalibrieren.",
    statement:
      "Alle Drehmomentschlüssel der Montage werden halbjährlich kalibriert; das Prüfprotokoll hängt am Gerät und wird bei der Ausgabe kontrolliert.",
    type: "technik",
    category: "Anlage 3",
    author: erikId,
    tags: ["kalibrierung", "montage", DEMO_TAG],
    confidence: 60,
    neededValidations: 2,
  });
  await ko.create({
    demoSeed: true,
    title: "Notstromaggregat monatlich 30 Minuten unter Last testen.",
    statement:
      "Das Notstromaggregat läuft einmal im Monat 30 Minuten unter Last; erst der Lasttest zeigt schwache Batterien und verharzte Regler.",
    type: "technik",
    category: "Anlage 1",
    author: adminId,
    tags: ["notstrom", "prüfung", DEMO_TAG],
    confidence: 50,
    neededValidations: 2,
  });
  await ko.create({
    demoSeed: true,
    title: "Schaltschränke nicht mit Druckluft ausblasen.",
    statement:
      "Druckluft drückt Staub tiefer in Kontakte und Lüfter der Schaltschränke — führte zweimal zu Ausfällen. Nur absaugen, nie ausblasen.",
    type: "negativwissen",
    category: "Anlage 3",
    author: erikId,
    tags: ["schaltschrank", "reinigung", DEMO_TAG],
    confidence: 45,
    neededValidations: 2,
  });

  // --- Validierung: koValid bekommt 2 grüne Bewertungen → Status „validiert" (echte Logik) ---
  await validation.rate(koValid.id, carlaId, "up");
  await validation.rate(koValid.id, adminId, "up");

  // SCRUM-244: zweites validiertes, output-fähiges KO — koFilter ebenfalls 2× grün → „validiert".
  await validation.rate(koFilter.id, carlaId, "up");
  await validation.rate(koFilter.id, adminId, "up");

  // SCRUM-244: Teil-Review für einen mittleren Trust-Zustand — koWarm erhält eine grüne Bewertung
  // (1/2 nötig) → Trust ~50, bleibt „offen" (sichtbar „in Prüfung", echte Trust-Varianz).
  await validation.rate(koWarm.id, adminId, "up");

  // Pedi 02.07.: auch ein NICHT-industrielles Beispiel ist von Anfang an „validiert" —
  // die Breite zeigt sich in jedem Status, nicht nur in der offenen Liste.
  await validation.rate(koPflege.id, carlaId, "up");
  await validation.rate(koPflege.id, adminId, "up");
  // Kanzlei-Frist in Prüfung (1/2), Verein/Versicherung bleiben offen — ehrliche Varianz.
  await validation.rate(koKanzlei.id, carlaId, "up");

  // --- Offene Validierungsaufgabe: koOpen Carla zuweisen (erscheint im Board/MyTasks) ---
  await validation.assign(koOpen.id, [carlaId], adminId);

  // --- Wissenslücke: plausible industrielle Betriebsfrage ohne Token-Überschneidung mit den
  // vorhandenen KOs (Ventil/Überdruck/Pumpe/Filter/Kaltstart/Vorwärmung samt deren Stoppwörtern
  // wie „die"/„dem"). Der deterministische Reasoner-Fallback findet daher keinen Treffer →
  // echte Wissenslücke statt Antwort; danach Priorität wie bisher auf „hoch". ---
  const asked = await ask.ask(DEMO_GAP_QUESTION, adminId);
  if (asked.gap) {
    await ask.setGapPriority(asked.gap.id, "hoch");
  }

  // --- Konflikt: widersprüchliche Aussagen zur Vorwärmung gegenüberstellen ---
  await conflicts.create(
    {
      koA: koWarm.id,
      koB: koNoWarm.id,
      type: "truth",
      description: "Widerspruch: Vorwärmung bei Kaltstart nötig vs. nicht nötig.",
    },
    adminId,
  );

  // --- Lebenszyklus: koValid an Asset koppeln + Asset-Änderung → Revalidierung fällig ---
  await lifecycle.couple("ANL-01", koValid.id);
  await lifecycle.assetChanged("ANL-01");

  // SCRUM-217/218: rollenspezifische Beispiel-Lernpfade, damit der Lifecycle-Lernpfad nach dem
  // Demo-Seed sichtbar ist statt 404. Über die echte createPath-Methode — kein Fake, kein Editor.
  // Die Lifecycle-Seite ist controller+ gesichert; daher bekommen auch controller/admin einen
  // Pfad, sonst sähe der reviewende Admin/Controller dort weiter nur die Leer-Karte (SCRUM-218).
  const learningSteps = [
    { title: "Wissensobjekte lesen und Vertrauensstufen verstehen" },
    { title: "Erstes Wissensobjekt erfassen (Formular oder Interview)" },
    { title: "Quelle/Anhang als Evidence anhängen" },
    { title: "Eine Validierungsaufgabe bearbeiten" },
  ];
  for (const role of ["experte", "controller", "admin"]) {
    await lifecycle.createPath(role, learningSteps);
  }

  // --- Anhang/Quelle: kleines Bild in den (jetzt persistenten) Object-Store + Referenz am KO ---
  const ref = await objects.put({ name: "skizze.png", mime: "image/png", data: TINY_PNG });
  await ko.addAttachment(koValid.id, erikId, {
    name: "skizze.png",
    mime: "image/png",
    objectId: ref.id,
    thumbnail: TINY_PNG,
    size: ref.size,
  });

  // SCRUM-244: zusätzlich zur Anhang-Evidence eine externe Quelle → koValid trägt Quelle UND
  // Anhang, der Evidence-Stand enthält damit beide Arten (source + attachment).
  await ko.addSource(koValid.id, erikId, {
    label: "Anlagenhandbuch Abschnitt 4.2",
    url: "https://intern.klarwerk/handbuch#4-2",
    excerpt: "Ventil X bei Überdruck manuell schließen.",
    provider: "Intern",
  });

  // --- Kennzahlen aus echten Service-Reads ableiten ---
  const allKos = await ko.list();
  return {
    skipped: false,
    users: (await auth.listUsers()).length,
    kos: allKos.length,
    validated: allKos.filter((k) => k.status === "validiert").length,
    gaps: (await ask.listGaps()).length,
    conflicts: (await conflicts.unresolved()).length,
    pendingRevalidation: (await lifecycle.pendingRevalidation()).length,
    attachments: allKos.reduce((n, k) => n + (k.attachments?.length ?? 0), 0),
    sources: allKos.reduce((n, k) => n + (k.sources?.length ?? 0), 0),
  };
}

// ---- Demodaten komplett entfernen (Pedi 02.07.) -------------------------------------
// Entfernt ALLE als demoSeed markierten Wissensobjekte (der Marker überlebt Bearbeitungen
// und Versionen) samt zugehöriger Konflikte. Läuft über die echten Services → Audit bleibt
// ehrlich. Demo-NUTZER bleiben bewusst bestehen (könnten inzwischen echte Beiträge haben).
// Bug (Pedi 04.07.): Auch die vom Seed erzeugte Demo-Wissenslücke wird jetzt mitgelöscht —
// sie gehörte zu den Beispielen und blieb sonst als „offene Lücke/Aufgabe" stehen.
// Hinweis: „Fragen gesamt" in den Kennzahlen kommt aus dem UNVERÄNDERLICHEN Audit-Log
// (jede Frage ist echte Historie) und lässt sich bewusst nicht „wegputzen".
export interface PurgeResult {
  kos: number;
  conflicts: number;
  gaps: number;
}

export async function purgeDemoSeed(
  services: Pick<DemoSeedServices, "ko" | "conflicts" | "ask">,
  actor: string,
): Promise<PurgeResult> {
  const { ko, conflicts, ask } = services;
  const demoKos = (await ko.list({})).filter(
    (k) => k.demoSeed === true || (k.tags ?? []).includes(DEMO_TAG),
  );
  const demoIds = new Set(demoKos.map((k) => k.id));
  let removedConflicts = 0;
  for (const c of await conflicts.unresolved()) {
    if (demoIds.has(c.koA) || demoIds.has(c.koB)) {
      await conflicts
        .resolve(c.id, actor, "Demodaten entfernt (beide Seiten verworfen)")
        .catch(() => undefined);
      removedConflicts += 1;
    }
  }
  for (const k of demoKos) {
    // SCRUM-422: Demo-Daten IMMER endgültig löschen — nie in den Papierkorb
    // (gilt auch für nur per Tag markierte Alt-Demo-KOs ohne demoSeed-Flag).
    await ko.delete(k.id, actor, { hard: true });
  }
  // Bug (Pedi 04.07.): Demo-Wissenslücke(n) mitlöschen — Abgleich über den Frage-Präfix
  // (robust gegen die Normalisierung der gespeicherten Gap-Frage).
  const demoGapPrefix = DEMO_GAP_QUESTION.slice(0, 40);
  let removedGaps = 0;
  for (const g of await ask.listGaps()) {
    if (g.question.startsWith(demoGapPrefix)) {
      await ask.deleteGap(g.id, true).catch(() => undefined);
      removedGaps += 1;
    }
  }
  return { kos: demoKos.length, conflicts: removedConflicts, gaps: removedGaps };
}
