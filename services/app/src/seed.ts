import { type AppServices, buildPgServices, buildServices } from "./build-app";
import { createPool, migrate } from "./db";

// SCRUM-156: reproduzierbarer Demo-/Dev-Seed. Erzeugt einen kleinen, ehrlichen Bestand
// AUSSCHLIESSLICH über die echten Services — Audit/Statuslogik/Side-Effects bleiben real,
// nichts wird manuell gefälscht. Macht die Stage-1-Flows (Start/Library/Ask/Validation/Risk/
// Lifecycle/Analytics/MyTasks/KnowledgeDetail) in der Review sichtbar.
//
// NICHT-Ziele: keine Produktionsdaten, kein Auto-Start, keine UI-Mocks, kein Fake-Backend.
// Nur für eine LEERE Instanz gedacht (Guard über auth.needsSetup) → idempotent (zweiter Lauf
// erkennt vorhandenen Bestand und überspringt, keine Duplikate).

// 1×1 transparentes PNG als kleiner, technisch sauberer Demo-Anhang (kein großer Blob).
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
};

// Deterministischer Seed über die echten Services. Gibt eine Kennzahl-Übersicht zurück.
export async function seedDemo(services: AppServices): Promise<SeedResult> {
  // Idempotenz/Schutz: nur eine frische, leere Instanz seeden.
  if (!(await services.auth.needsSetup()) || (await services.ko.list()).length > 0) {
    return EMPTY_RESULT;
  }

  const { auth, ko, validation, ask, conflicts, lifecycle, objects } = services;

  // --- Nutzer (erstes Konto = Admin + freigegeben; weitere via Admin freigeben) ---
  const admin = await auth.register({
    name: "Demo Admin",
    email: "admin@demo.klarwerk",
    password: "demo-admin-pass",
  });
  const carla = await auth.register({
    name: "Carla Controller",
    email: "carla@demo.klarwerk",
    password: "demo-pass-carla",
  });
  await auth.approveUser(carla.id, admin.id);
  await auth.changeRole(carla.id, "controller", admin.id);
  const erik = await auth.register({
    name: "Erik Experte",
    email: "erik@demo.klarwerk",
    password: "demo-pass-erik",
  });
  await auth.approveUser(erik.id, admin.id);

  // --- Wissensobjekte (verschiedene Kategorien, Arten, Trust, Tags) ---
  const koValid = await ko.create({
    title: "Ventil X bei Überdruck manuell schließen.",
    statement:
      "Bei Überdruck über 6 bar Ventil X von Hand schließen, bis die Anlage entlastet ist.",
    type: "best_practice",
    category: "Anlage 1",
    author: erik.id,
    tags: ["ventil", "überdruck", "sicherheit"],
    conditions: ["Druck > 6 bar"],
    measures: ["Ventil X schließen"],
    confidence: 80,
    neededValidations: 2,
    asset: "ANL-01",
  });
  const koOpen = await ko.create({
    title: "Pumpe P2 alle 200 Betriebsstunden schmieren.",
    statement: "Pumpe P2 alle 200 h mit Fett Typ Z schmieren.",
    type: "technik",
    category: "Anlage 2",
    author: erik.id,
    tags: ["pumpe", "wartung"],
    confidence: 40,
    neededValidations: 2,
  });
  const koWarm = await ko.create({
    title: "Bei Kaltstart zuerst die Vorwärmung aktivieren.",
    statement: "Vor dem Kaltstart die Vorwärmung 10 min laufen lassen.",
    type: "lernkurve",
    category: "Anlage 1",
    author: erik.id,
    tags: ["kaltstart", "vorwärmung"],
    confidence: 55,
    neededValidations: 2,
  });
  const koNoWarm = await ko.create({
    title: "Vorwärmung bei Kaltstart ist nicht nötig.",
    statement: "Kaltstart ohne Vorwärmung ist möglich und spart Zeit.",
    type: "negativwissen",
    category: "Anlage 1",
    author: admin.id,
    tags: ["kaltstart", "vorwärmung"],
    confidence: 30,
    neededValidations: 2,
  });
  await ko.create({
    title: "Filter F3 monatlich auf Verschmutzung prüfen.",
    statement: "Filter F3 einmal pro Monat auf Verschmutzung prüfen und bei Bedarf tauschen.",
    type: "best_practice",
    category: "Anlage 3",
    author: erik.id,
    tags: ["filter", "wartung"],
    confidence: 65,
    neededValidations: 2,
  });

  // --- Validierung: koValid bekommt 2 grüne Bewertungen → Status „validiert" (echte Logik) ---
  await validation.rate(koValid.id, carla.id, "up");
  await validation.rate(koValid.id, admin.id, "up");

  // --- Offene Validierungsaufgabe: koOpen Carla zuweisen (erscheint im Board/MyTasks) ---
  await validation.assign(koOpen.id, [carla.id], admin.id);

  // --- Wissenslücke: bewusst bestandsfremde Frage (keine Token-Überschneidung mit den KOs)
  // → echte Lücke statt Antwort; danach Priorität setzen. ---
  const asked = await ask.ask("Welche Hauptstadt hat Australien?", admin.id);
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
    admin.id,
  );

  // --- Lebenszyklus: koValid an Asset koppeln + Asset-Änderung → Revalidierung fällig ---
  await lifecycle.couple("ANL-01", koValid.id);
  await lifecycle.assetChanged("ANL-01");

  // --- Anhang/Quelle: kleines Bild in den (jetzt persistenten) Object-Store + Referenz am KO ---
  const ref = await objects.put({ name: "skizze.png", mime: "image/png", data: TINY_PNG });
  await ko.addAttachment(koValid.id, erik.id, {
    name: "skizze.png",
    mime: "image/png",
    objectId: ref.id,
    thumbnail: TINY_PNG,
    size: ref.size,
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
  };
}

// CLI-Runner: mit DATABASE_URL gegen Postgres (persistent), sonst In-Memory (nur Smoke).
// In Produktion gesperrt, außer SEED_ALLOW_PROD=1 wird bewusst gesetzt.
export async function runSeed(): Promise<void> {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PROD !== "1") {
    console.error("[seed:demo] In Produktion deaktiviert. Nur bewusst mit SEED_ALLOW_PROD=1.");
    process.exitCode = 1;
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;
  let services: AppServices;
  if (databaseUrl) {
    const pool = createPool(databaseUrl);
    await migrate(pool);
    services = buildPgServices(pool);
  } else {
    console.warn(
      "[seed:demo] Kein DATABASE_URL — In-Memory-Lauf, Daten NICHT persistent. Für sichtbaren Review DATABASE_URL setzen.",
    );
    services = buildServices();
  }
  const result = await seedDemo(services);
  if (result.skipped) {
    console.warn("[seed:demo] Übersprungen: Instanz ist nicht leer (Bestand/Nutzer vorhanden).");
  } else {
    console.warn(`[seed:demo] Fertig: ${JSON.stringify(result)}`);
  }
}

// Nur ausführen, wenn die Datei direkt gestartet wird (nicht beim Import in Tests).
if (process.argv[1]?.endsWith("seed.ts")) {
  void runSeed();
}
