import type { AskService } from "../../ask";
import type { AuthService } from "../../auth";
import type { ConflictService } from "../../conflicts";
import type { KoService } from "../../knowledge-object";
import type { LifecycleService } from "../../lifecycle";
import type { ObjectStore } from "../../object-store";
import type { ValidationService } from "../../validation";
import { DEMO_GAP_QUESTIONS, type DemoLocale, demoTexts } from "./demo-content";

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

// Bug (Pedi 05.07.): Beim Demo-Purge sollen auch die Demo-ANWENDER verschwinden. Alle vom Seed
// erzeugten Konten liegen unter dieser E-Mail-Domain — EINE Quelle für Seed (Anlegen) UND Purge
// (Entfernen). Produktive Konten tragen diese Domain nicht.
export const DEMO_EMAIL_DOMAIN = "demo.klarwerk";

function isDemoEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

// Bug (Pedi 04.07.): Die vom Seed erzeugte Demo-Wissenslücke gehört zu den Beispielen und muss
// beim Demo-Purge mitverschwinden. SCRUM-487: die Frage ist jetzt sprachabhängig (DE/EN/NL) — der
// Purge gleicht deshalb gegen ALLE drei lokalisierten Fragen ab (Frage-Präfix, robust gegen die
// Normalisierung der gespeicherten Gap-Frage). DEMO_GAP_QUESTION (DE) bleibt für Rückwärtskompat.
export const DEMO_GAP_QUESTION = demoTexts("de").gapQuestion;

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
export async function seedDemo(
  services: DemoSeedServices,
  locale: DemoLocale = "de",
): Promise<SeedResult> {
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
  return buildDemoContent(services, { adminId: admin.id, ...actors }, locale);
}

// SCRUM-181: Admin-getriebener Demo-Seed für eine BEREITS eingerichtete Instanz (Login existiert).
// Idempotenz-Guard: standardmäßig nur seeden, wenn die Wissensbasis leer ist (keine stillen
// Duplikate). Die Demo-Mitnutzer werden über den real angemeldeten Admin freigegeben — keine
// gefälschten Rechte.
//
// Pedi 05.07. (Beta): Mit `force` lässt sich das Demo-Set AUCH laden, wenn bereits (echte) Daten
// erfasst sind. Damit dabei keine Demo-Dubletten entstehen, wird das vorhandene Demo-Set zuerst
// entfernt (nur die als Demo markierten KOs/Konflikte/Lücken/Anwender) und dann frisch geseedet —
// echte, selbst erfasste Daten bleiben unberührt.
export async function seedDemoForAdmin(
  services: DemoSeedServices,
  adminId: string,
  opts?: { force?: boolean; locale?: DemoLocale },
): Promise<SeedResult> {
  const hasData = (await services.ko.list()).length > 0;
  if (hasData && !opts?.force) {
    return EMPTY_RESULT;
  }
  if (opts?.force) {
    // Nur das bestehende Demo-Set aufräumen (echte Daten bleiben), dann frisch seeden.
    await purgeDemoSeed(services, adminId);
  }
  const actors = await seedDemoUsers(services, adminId);
  // SCRUM-487: Demo-Sprache = UI-Sprache des ladenden Admins (Frontend sendet locale); Default "de".
  return buildDemoContent(services, { adminId, ...actors }, opts?.locale ?? "de");
}

// Legt Controller/Experte an und gibt sie über den (realen) Admin frei. Idempotent: existiert ein
// Demo-Konto bereits (force-Re-Seed nach unvollständigem Purge), wird es wiederverwendet statt an
// der Dublette-Prüfung zu scheitern.
async function seedDemoUsers(
  services: DemoSeedServices,
  adminId: string,
): Promise<{ controllerId: string; expertId: string }> {
  const carlaId = await ensureDemoUser(
    services,
    { name: "Carla Controller", email: "carla@demo.klarwerk", password: "demo-pass-carla" },
    adminId,
    "controller",
  );
  const erikId = await ensureDemoUser(
    services,
    { name: "Erik Experte", email: "erik@demo.klarwerk", password: "demo-pass-erik" },
    adminId,
  );
  return { controllerId: carlaId, expertId: erikId };
}

// Ein Demo-Konto sicherstellen: vorhandenes wiederverwenden (freigeben/Rolle angleichen) oder neu
// anlegen und über den realen Admin freigeben. Keine gefälschten Rechte — nur echte Service-Aufrufe.
async function ensureDemoUser(
  services: DemoSeedServices,
  input: { name: string; email: string; password: string },
  adminId: string,
  role?: "controller",
): Promise<string> {
  const { auth } = services;
  const existing = (await auth.listUsers()).find((u) => u.email === input.email);
  if (existing) {
    if (!existing.approved) {
      await auth.approveUser(existing.id, adminId).catch(() => undefined);
    }
    if (role && existing.role !== role) {
      await auth.changeRole(existing.id, role, adminId).catch(() => undefined);
    }
    return existing.id;
  }
  const created = await auth.register(input);
  await auth.approveUser(created.id, adminId);
  if (role) {
    await auth.changeRole(created.id, role, adminId);
  }
  return created.id;
}

// Baut den eigentlichen Demo-Bestand über die echten Services — identisch für CLI und Admin-UI.
async function buildDemoContent(
  services: DemoSeedServices,
  actors: SeedActors,
  locale: DemoLocale = "de",
): Promise<SeedResult> {
  const { auth, ko, validation, ask, conflicts, lifecycle, objects } = services;
  const adminId = actors.adminId;
  const carlaId = actors.controllerId;
  const erikId = actors.expertId;
  // SCRUM-487: lokalisierte Titel/Aussagen/Konflikt-Texte (Kategorien/Tags bleiben sprachneutral).
  const t = demoTexts(locale);

  // SCRUM-308: eindeutiger Herkunfts-Tag für Demo-/Seed-Wissen (kein neues Datenmodell, keine
  // Migration — nur ein zusätzlicher Tag im vorhandenen tags-Feld). Muss mit dem FE-Konstanten
  // DEMO_TAG in apps/web/src/lib/demoKnowledge.ts übereinstimmen. Produktiv erfasste KOs tragen
  // diesen Tag NICHT (er wird ausschließlich hier im Seed gesetzt).
  // (DEMO_TAG jetzt modulweit — siehe oben; hier bewusst keine zweite Definition.)

  // --- Wissensobjekte (verschiedene Kategorien, Arten, Trust, Tags) ---
  const koValid = await ko.create({
    demoSeed: true,
    title: t.koValid.title,
    statement: t.koValid.statement,
    type: "best_practice",
    category: "Anlage 1",
    author: erikId,
    tags: ["ventil", "überdruck", "sicherheit", DEMO_TAG],
    conditions: t.koValid.conditions ?? [],
    measures: t.koValid.measures ?? [],
    confidence: 80,
    neededValidations: 2,
    asset: "ANL-01",
  });
  const koOpen = await ko.create({
    demoSeed: true,
    title: t.koOpen.title,
    statement: t.koOpen.statement,
    type: "technik",
    category: "Anlage 2",
    author: erikId,
    tags: ["pumpe", "wartung", DEMO_TAG],
    confidence: 40,
    neededValidations: 2,
  });
  const koWarm = await ko.create({
    demoSeed: true,
    title: t.koWarm.title,
    statement: t.koWarm.statement,
    type: "lernkurve",
    category: "Anlage 1",
    author: erikId,
    tags: ["kaltstart", "vorwärmung", DEMO_TAG],
    confidence: 55,
    neededValidations: 2,
  });
  const koNoWarm = await ko.create({
    demoSeed: true,
    title: t.koNoWarm.title,
    statement: t.koNoWarm.statement,
    type: "negativwissen",
    category: "Anlage 1",
    author: adminId,
    tags: ["kaltstart", "vorwärmung", DEMO_TAG],
    confidence: 30,
    neededValidations: 2,
  });
  // SCRUM-492: zweiter Showcase-Konflikt (Firmenwagenfarbe blau ↔ rot) als reproduzierbarer
  // Demo-Bestand. Zwei echte, gegensätzliche Farb-Vorgaben — der klassische „direkt unvereinbar"-Fall.
  const koCarBlau = await ko.create({
    demoSeed: true,
    title: t.koCarBlau.title,
    statement: t.koCarBlau.statement,
    type: "best_practice",
    category: "Fuhrpark",
    author: erikId,
    tags: ["firmenwagen", "fahrzeugfarbe", "blau", DEMO_TAG],
    confidence: 60,
    neededValidations: 2,
  });
  const koCarRot = await ko.create({
    demoSeed: true,
    title: t.koCarRot.title,
    statement: t.koCarRot.statement,
    type: "best_practice",
    category: "Fuhrpark",
    author: carlaId,
    tags: ["firmenwagen", "fahrzeugfarbe", "rot", "bestellrichtlinie", DEMO_TAG],
    confidence: 60,
    neededValidations: 2,
  });
  const koFilter = await ko.create({
    demoSeed: true,
    title: t.koFilter.title,
    statement: t.koFilter.statement,
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
    title: t.koPflege.title,
    statement: t.koPflege.statement,
    type: "best_practice",
    category: "Pflege & Gesundheit",
    author: erikId,
    tags: ["pflege", "dokumentation", "übergabe", DEMO_TAG],
    conditions: t.koPflege.conditions ?? [],
    measures: t.koPflege.measures ?? [],
    confidence: 70,
    neededValidations: 2,
  });
  const koKanzlei = await ko.create({
    demoSeed: true,
    title: t.koKanzlei.title,
    statement: t.koKanzlei.statement,
    type: "best_practice",
    category: "Kanzlei & Beratung",
    author: adminId,
    tags: ["frist", "kanzlei", "organisation", DEMO_TAG],
    confidence: 75,
    neededValidations: 2,
  });
  await ko.create({
    demoSeed: true,
    title: t.koVerein.title,
    statement: t.koVerein.statement,
    type: "lernkurve",
    category: "Verein & Ehrenamt",
    author: erikId,
    tags: ["verein", "veranstaltung", "genehmigung", DEMO_TAG],
    confidence: 50,
    neededValidations: 2,
  });
  await ko.create({
    demoSeed: true,
    title: t.koWasser.title,
    statement: t.koWasser.statement,
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
    title: t.koSchweiss.title,
    statement: t.koSchweiss.statement,
    type: "lernkurve",
    category: "Anlage 2",
    author: erikId,
    tags: ["schweißen", "nacharbeit", "qualität", DEMO_TAG],
    conditions: t.koSchweiss.conditions ?? [],
    measures: t.koSchweiss.measures ?? [],
    confidence: 55,
    neededValidations: 2,
  });
  await ko.create({
    demoSeed: true,
    title: t.koPresse.title,
    statement: t.koPresse.statement,
    type: "bauchgefuehl",
    category: "Anlage 2",
    author: erikId,
    tags: ["lager", "instandhaltung", DEMO_TAG],
    confidence: 25,
    neededValidations: 2,
  });
  await ko.create({
    demoSeed: true,
    title: t.koNacht.title,
    statement: t.koNacht.statement,
    type: "bauchgefuehl",
    category: "Pflege & Gesundheit",
    author: erikId,
    tags: ["pflege", "beobachtung", DEMO_TAG],
    confidence: 20,
    neededValidations: 2,
  });
  await ko.create({
    demoSeed: true,
    title: t.koVergleich.title,
    statement: t.koVergleich.statement,
    type: "bauchgefuehl",
    category: "Kanzlei & Beratung",
    author: adminId,
    tags: ["verhandlung", "kanzlei", DEMO_TAG],
    confidence: 20,
    neededValidations: 2,
  });
  await ko.create({
    demoSeed: true,
    title: t.koDreh.title,
    statement: t.koDreh.statement,
    type: "technik",
    category: "Anlage 3",
    author: erikId,
    tags: ["kalibrierung", "montage", DEMO_TAG],
    confidence: 60,
    neededValidations: 2,
  });
  await ko.create({
    demoSeed: true,
    title: t.koNotstrom.title,
    statement: t.koNotstrom.statement,
    type: "technik",
    category: "Anlage 1",
    author: adminId,
    tags: ["notstrom", "prüfung", DEMO_TAG],
    confidence: 50,
    neededValidations: 2,
  });
  await ko.create({
    demoSeed: true,
    title: t.koSchalt.title,
    statement: t.koSchalt.statement,
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
  const asked = await ask.ask(t.gapQuestion, adminId);
  if (asked.gap) {
    await ask.setGapPriority(asked.gap.id, "hoch");
  }

  // --- Konflikt: widersprüchliche Aussagen zur Vorwärmung gegenüberstellen ---
  // SCRUM-492: als automatisch-erkannter Konflikt MIT strukturierten Kollisionsfeldern seeden, damit
  // die visuelle Gegenüberstellung (zwei Kacheln + Kollisionspunkt) im Demo GARANTIERT erscheint —
  // die Erkennung läuft nie auf demoSeed-KOs, daher hier fest gesetzt. Die Streitwerte stehen wörtlich
  // in den beiden Belegzitaten (streitwertWoertlich=true), passend zu den echten Demo-Aussagen.
  await conflicts.createAuto(
    {
      koA: koWarm.id,
      koB: koNoWarm.id,
      type: "truth",
      description: t.warmConflict.description,
    },
    {
      trigger: "validation",
      method: "model",
      promptVersion: "kon-v1",
      modelLabel: "demo:seed",
      confidence: 0.94,
      rationale: t.warmConflict.rationale,
      quotes: {
        a: t.warmConflict.quoteA,
        b: t.warmConflict.quoteB,
      },
      kollision: {
        streitpunkt: t.warmConflict.streitpunkt,
        seiteA: {
          kernaussage: t.warmConflict.aKern,
          streitwert: t.warmConflict.aWert,
          streitwertWoertlich: true,
        },
        seiteB: {
          kernaussage: t.warmConflict.bKern,
          streitwert: t.warmConflict.bWert,
          streitwertWoertlich: true,
        },
      },
    },
    adminId,
  );

  // --- SCRUM-492: Firmenwagenfarbe blau ↔ rot als zweiter, garantiert sichtbarer Kollisions-Showcase.
  // createAuto mit festem kollision (kein Modell-Zufall); die Streitwerte „blau"/„Rot" stehen wörtlich
  // in den beiden Belegzitaten (streitwertWoertlich=true) → belegt-Kennzeichnung in den Kacheln.
  await conflicts.createAuto(
    {
      koA: koCarBlau.id,
      koB: koCarRot.id,
      type: "truth",
      description: t.carConflict.description,
    },
    {
      trigger: "validation",
      method: "model",
      promptVersion: "kon-v1",
      modelLabel: "demo:seed",
      confidence: 0.9,
      rationale: t.carConflict.rationale,
      quotes: {
        a: t.carConflict.quoteA,
        b: t.carConflict.quoteB,
      },
      kollision: {
        streitpunkt: t.carConflict.streitpunkt,
        seiteA: {
          kernaussage: t.carConflict.aKern,
          streitwert: t.carConflict.aWert,
          streitwertWoertlich: true,
        },
        seiteB: {
          kernaussage: t.carConflict.bKern,
          streitwert: t.carConflict.bWert,
          streitwertWoertlich: true,
        },
      },
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
    excerpt: t.koValid.title,
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
// ehrlich.
// Bug (Pedi 04.07.): Auch die vom Seed erzeugte Demo-Wissenslücke wird jetzt mitgelöscht —
// sie gehörte zu den Beispielen und blieb sonst als „offene Lücke/Aufgabe" stehen.
// Bug (Pedi 05.07.): Auch die Demo-ANWENDER werden jetzt mitentfernt (Konten unter der
// Demo-Domain). Der ausführende Admin bleibt selbstverständlich bestehen; der Last-Admin-Schutz
// im Auth-Service verhindert zusätzlich, dass der letzte aktive Admin verschwindet.
// Hinweis: „Fragen gesamt" in den Kennzahlen kommt aus dem UNVERÄNDERLICHEN Audit-Log
// (jede Frage ist echte Historie) und lässt sich bewusst nicht „wegputzen".
export interface PurgeResult {
  kos: number;
  conflicts: number;
  gaps: number;
  users: number;
}

export async function purgeDemoSeed(
  services: Pick<DemoSeedServices, "ko" | "conflicts" | "ask" | "auth">,
  actor: string,
): Promise<PurgeResult> {
  const { ko, conflicts, ask, auth } = services;
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
  // (robust gegen die Normalisierung der gespeicherten Gap-Frage). SCRUM-487: sprachabhängig →
  // gegen ALLE drei lokalisierten Demo-Fragen prüfen (DE/EN/NL), damit auch ein NL/EN-Seed
  // rückstandsfrei purge-bar bleibt.
  const demoGapPrefixes = DEMO_GAP_QUESTIONS.map((q) => q.slice(0, 40));
  let removedGaps = 0;
  for (const g of await ask.listGaps()) {
    if (demoGapPrefixes.some((p) => g.question.startsWith(p))) {
      await ask.deleteGap(g.id, true).catch(() => undefined);
      removedGaps += 1;
    }
  }
  // Bug (Pedi 05.07.): Demo-ANWENDER entfernen — alle Konten unter der Demo-Domain, außer dem
  // aktuell ausführenden Admin. Fehlversuche (z. B. Last-Admin-Schutz) werden bewusst geschluckt,
  // damit der Purge der übrigen Demo-Konten nicht abbricht.
  let removedUsers = 0;
  for (const u of await auth.listUsers()) {
    if (u.id === actor || !isDemoEmail(u.email)) {
      continue;
    }
    try {
      await auth.deleteUser(u.id, actor);
      removedUsers += 1;
    } catch {
      // z. B. letzter aktiver Admin — bleibt bestehen, kein Abbruch.
    }
  }
  return {
    kos: demoKos.length,
    conflicts: removedConflicts,
    gaps: removedGaps,
    users: removedUsers,
  };
}
