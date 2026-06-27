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

  // --- Wissensobjekte (verschiedene Kategorien, Arten, Trust, Tags) ---
  const koValid = await ko.create({
    title: "Ventil X bei Überdruck manuell schließen.",
    statement:
      "Bei Überdruck über 6 bar Ventil X von Hand schließen, bis die Anlage entlastet ist.",
    type: "best_practice",
    category: "Anlage 1",
    author: erikId,
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
    author: erikId,
    tags: ["pumpe", "wartung"],
    confidence: 40,
    neededValidations: 2,
  });
  const koWarm = await ko.create({
    title: "Bei Kaltstart zuerst die Vorwärmung aktivieren.",
    statement: "Vor dem Kaltstart die Vorwärmung 10 min laufen lassen.",
    type: "lernkurve",
    category: "Anlage 1",
    author: erikId,
    tags: ["kaltstart", "vorwärmung"],
    confidence: 55,
    neededValidations: 2,
  });
  const koNoWarm = await ko.create({
    title: "Vorwärmung bei Kaltstart ist nicht nötig.",
    statement: "Kaltstart ohne Vorwärmung ist möglich und spart Zeit.",
    type: "negativwissen",
    category: "Anlage 1",
    author: adminId,
    tags: ["kaltstart", "vorwärmung"],
    confidence: 30,
    neededValidations: 2,
  });
  await ko.create({
    title: "Filter F3 monatlich auf Verschmutzung prüfen.",
    statement: "Filter F3 einmal pro Monat auf Verschmutzung prüfen und bei Bedarf tauschen.",
    type: "best_practice",
    category: "Anlage 3",
    author: erikId,
    tags: ["filter", "wartung"],
    confidence: 65,
    neededValidations: 2,
  });

  // --- Validierung: koValid bekommt 2 grüne Bewertungen → Status „validiert" (echte Logik) ---
  await validation.rate(koValid.id, carlaId, "up");
  await validation.rate(koValid.id, adminId, "up");

  // --- Offene Validierungsaufgabe: koOpen Carla zuweisen (erscheint im Board/MyTasks) ---
  await validation.assign(koOpen.id, [carlaId], adminId);

  // --- Wissenslücke: bewusst bestandsfremde Frage (keine Token-Überschneidung mit den KOs)
  // → echte Lücke statt Antwort; danach Priorität setzen. ---
  const asked = await ask.ask("Welche Hauptstadt hat Australien?", adminId);
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

  // --- Anhang/Quelle: kleines Bild in den (jetzt persistenten) Object-Store + Referenz am KO ---
  const ref = await objects.put({ name: "skizze.png", mime: "image/png", data: TINY_PNG });
  await ko.addAttachment(koValid.id, erikId, {
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
