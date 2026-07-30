import { randomBytes } from "node:crypto";
import type { AskService } from "../../ask";
import type { AuthService } from "../../auth";
import {
  type ConflictService,
  DEFAULT_OVERLAP_SETTINGS,
  type DetectSubject,
  type OverlapService,
  type OverlapSettingsRepo,
} from "../../conflicts";
import type { KnowledgeObject, KoService } from "../../knowledge-object";
import type { LifecycleService } from "../../lifecycle";
import type { ObjectStore } from "../../object-store";
import type { Reasoner } from "../../reasoner";
import type { ValidationService } from "../../validation";
import { type DemoLocale, demoTexts } from "./demo-content";

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
  // SCRUM-487 (Proben): das reifen-Duplikat läuft durch die ECHTE Duplikaterkennung (online →
  // Befund; offline → ehrlich keiner). Dafür braucht der Seed OverlapService + Reasoner + die
  // Anzeige-Schwelle. (Der Konflikt bleibt bewusst vorgeformt — SCRUM-487-Streitwert-Showcase.)
  overlaps: OverlapService;
  overlapSettings: OverlapSettingsRepo;
  reasoner: Reasoner;
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

// Die vom Seed erzeugte Demo-Wissenslücke wird beim Purge über das stabile Herkunfts-Flag
// (Gap.demoSeed) mitentfernt — siehe purgeDemoSeed. DEMO_GAP_QUESTION (DE) bleibt als Referenz.
export const DEMO_GAP_QUESTION = demoTexts("de").gapQuestion;

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

// K0-2: Erkennungs-Gegenstand ist der Kerntext (title+statement+conditions+measures) — identisch zum
// App-Wrapper (conflict-/duplicate-detection.ts). Für den paar-genauen Demo-Duplikat-Durchlauf.
function toDetectSubject(ko: KnowledgeObject): DetectSubject {
  return {
    refId: ko.id,
    title: ko.title,
    statement: ko.statement,
    conditions: ko.conditions,
    measures: ko.measures,
    category: ko.category,
    tags: ko.tags,
    asset: ko.asset,
  };
}

// ================================================================================================
// AUFTRAG-mega64 BLOCK A — DIE ZUGANGSDATEN VERLASSEN DEN QUELLTEXT.
// ================================================================================================
//
// Bis mega64 standen die Kennwörter der drei Demo-Konten wörtlich in dieser Datei. Wer das
// Repository lesen konnte, kannte die Zugangsdaten jedes freigegebenen Demo-Controllers jeder
// Instanz, die einmal geseedet wurde — und der Login unterscheidet ein Demo-Konto von einem echten
// nicht (`services/auth/src/routes.ts:238-272`). Der Brute-Force-Zähler hilft dagegen nicht: er
// bremst Raten, nicht bereits bekannte richtige Zugangsdaten.
//
// AB HIER: bei jeder NEUANLAGE ein frisches Einmalkennwort aus `crypto.randomBytes`. Es steht
// genau einmal an genau einer Stelle — im Rückgabewert dieses Aufrufs, damit der ausführende
// Administrator es weitergeben kann. Nicht im Quelltext, nicht in einer Datei, nicht in einem
// Protokoll.
//
// WAS HIER AUSDRÜCKLICH NICHT GEBAUT IST, und zwar weil es die Grundlage nicht gibt: der bessere
// Weg wäre, die Konten ganz OHNE Kennwort-Login anzulegen und einen erzwungenen Wechsel bei der
// ersten Anmeldung zu verlangen. Der Auth-Dienst kann das heute nicht — `User`
// (`services/auth/src/types.ts:3-20`) trägt kein Feld, das „muss wechseln" bedeutet, und der
// Anmeldeweg hat keine Stelle, die es auswerten könnte. Ein halber Wechselzwang (Kennwort setzen und
// hoffen) wäre schlechter als ein ehrliches Einmalkennwort, weil er eine Zusage behauptete, die
// niemand einlöst.
export interface DemoZugang {
  email: string;
  /** Frisch erzeugt, NUR in dieser Antwort. Wird nirgends erneut ausgegeben. */
  kennwort: string;
}

/**
 * Ein Einmalkennwort: 18 Zufallsbytes als base64url, also 24 Zeichen aus 144 Bit Entropie.
 * Deutlich über `MIN_PASSWORD_LENGTH` (8) des Auth-Dienstes, und base64url enthält keine Zeichen,
 * die beim Weitergeben über eine Zeile verlorengehen oder eine Shell erschrecken.
 */
function einmalkennwort(): string {
  return randomBytes(18).toString("base64url");
}

export interface SeedResult {
  skipped: boolean;
  users: number;
  kos: number;
  validated: number;
  gaps: number;
  conflicts: number;
  // SCRUM-487: erkannte Duplikate (reifen-Paar) — >0 nur mit online-Reasoner, offline ehrlich 0.
  duplicates: number;
  pendingRevalidation: number;
  attachments: number;
  sources: number;
  /**
   * AUFTRAG-mega64 Block A: die Einmalkennwörter der in DIESEM Lauf NEU angelegten Demo-Konten.
   * Leer, wenn nichts angelegt wurde (übersprungen) oder alle Konten schon bestanden — ein
   * vorhandenes Konto bekommt bewusst KEIN neues Kennwort (s. `ensureDemoUser`).
   */
  einmalkennwoerter: DemoZugang[];
}

const EMPTY_RESULT: SeedResult = {
  skipped: true,
  users: 0,
  kos: 0,
  validated: 0,
  gaps: 0,
  conflicts: 0,
  duplicates: 0,
  pendingRevalidation: 0,
  attachments: 0,
  sources: 0,
  einmalkennwoerter: [],
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
  // AUFTRAG-mega64 Block A: auch dieses Kennwort ist ab hier ein Einmalkennwort. Der CLI-Weg ist
  // zwar gegen Produktion abgesichert (`seed.ts:12-17`) und läuft nur auf einer leeren Instanz —
  // aber „gesperrt" ist eine andere Zusage als „das Kennwort steht nicht im Repository". Es steht
  // ab hier nicht mehr darin, und `runSeed` gibt es dem Aufrufer einmalig aus.
  const adminKennwort = einmalkennwort();
  const admin = await auth.register({
    name: "Demo Admin",
    email: "admin@demo.klarwerk",
    password: adminKennwort,
  });
  const { controllerId, expertId, zugaenge } = await seedDemoUsers(services, admin.id);
  const inhalt = await buildDemoContent(
    services,
    { adminId: admin.id, controllerId, expertId },
    locale,
  );
  return {
    ...inhalt,
    einmalkennwoerter: [{ email: admin.email, kennwort: adminKennwort }, ...zugaenge],
  };
}

// SCRUM-181: Admin-getriebener Demo-Seed für eine BEREITS eingerichtete Instanz (Login existiert).
// Idempotenz-Guard: standardmäßig nur seeden, wenn die Wissensbasis leer ist (keine stillen
// Duplikate). Die Demo-Mitnutzer werden über den real angemeldeten Admin freigegeben — keine
// gefälschten Rechte.
//
// Pedi 14.07.: „Demodaten laden" funktioniert jetzt AUCH neben (echten) Daten — der frühere
// Leer-Guard („nur wirksam, wenn keine Wissensobjekte existieren") entfällt. Die Demo-Daten werden
// ZUSÄTZLICH geladen; der vorhandene Bestand bleibt unberührt.
//
// Idempotenz strikt über die Herkunfts-Markierung (KO-Feld `demoSeed`), NICHT über „Instanz leer":
// ist der Demo-Satz bereits da → nicht nochmal anlegen (keine Dubletten). Nach „Demodaten entfernen"
// ist erneutes Laden wieder möglich. `force` lädt den Demo-Satz frisch (erst den vorhandenen Demo-
// Satz gezielt entfernen, dann neu seeden) — echte, selbst erfasste Daten bleiben in beiden Fällen.
export async function seedDemoForAdmin(
  services: DemoSeedServices,
  adminId: string,
  opts?: { force?: boolean; locale?: DemoLocale },
): Promise<SeedResult> {
  const demoPresent = (await services.ko.list()).some((k) => k.demoSeed === true);
  if (demoPresent && !opts?.force) {
    // Demo-Satz schon vorhanden → nicht duplizieren (echte Daten sind hier irrelevant).
    return EMPTY_RESULT;
  }
  if (demoPresent && opts?.force) {
    // Nur das bestehende Demo-Set aufräumen (echte Daten bleiben), dann frisch seeden.
    await purgeDemoSeed(services, adminId);
  }
  const { controllerId, expertId, zugaenge } = await seedDemoUsers(services, adminId);
  // SCRUM-487: Demo-Sprache = UI-Sprache des ladenden Admins (Frontend sendet locale); Default "de".
  const inhalt = await buildDemoContent(
    services,
    { adminId, controllerId, expertId },
    opts?.locale ?? "de",
  );
  // AUFTRAG-mega64 Block A: die Einmalkennwörter der neu angelegten Konten reisen mit der Antwort
  // zum ausführenden Administrator — und nur dorthin.
  return { ...inhalt, einmalkennwoerter: zugaenge };
}

// Die E-Mail-Adressen der beiden Demo-Mitnutzer. Ausdrücklich exportiert und ausdrücklich OHNE
// Kennwörter: die Adresse ist eine Kennung (der Purge braucht sie, Tests suchen danach), das
// Kennwort ist ein Geheimnis. Bis mega64 standen beide zusammen hier.
export const DEMO_CONTROLLER_EMAIL = "carla@demo.klarwerk";
export const DEMO_EXPERT_EMAIL = "erik@demo.klarwerk";

// Legt Controller/Experte an und gibt sie über den (realen) Admin frei. Idempotent: existiert ein
// Demo-Konto bereits (force-Re-Seed nach unvollständigem Purge), wird es wiederverwendet statt an
// der Dublette-Prüfung zu scheitern.
async function seedDemoUsers(
  services: DemoSeedServices,
  adminId: string,
): Promise<{ controllerId: string; expertId: string; zugaenge: DemoZugang[] }> {
  const carla = await ensureDemoUser(
    services,
    { name: "Carla Controller", email: DEMO_CONTROLLER_EMAIL },
    adminId,
    "controller",
  );
  const erik = await ensureDemoUser(
    services,
    { name: "Erik Experte", email: DEMO_EXPERT_EMAIL },
    adminId,
  );
  return {
    controllerId: carla.id,
    expertId: erik.id,
    // Nur die WIRKLICH neu angelegten Konten tragen ein Kennwort bei.
    zugaenge: [carla.zugang, erik.zugang].filter((z): z is DemoZugang => z !== null),
  };
}

// ================================================================================================
// AUFTRAG-mega64 BLOCK A — EIN DEMODATEN-LADEVORGANG VERGIBT KEINE RECHTE MEHR.
// ================================================================================================
//
// Hier stand bis mega64 eine stille Rechtevergabe, und sie war der schlimmere Teil des Befunds:
// Traf der Seed ein VORHANDENES Demo-Konto, gab er es wieder frei (`approveUser`), wenn es nicht
// freigegeben war, und setzte die Rolle neu (`changeRole`). Wer die Demo-Konten nach einem Pilot
// bewusst deaktiviert hatte, bekam sie durch einen Klick auf „Demodaten laden" reaktiviert — samt
// Controllerrolle, ohne dass irgendwo etwas nach einer Rechteänderung ausgesehen hätte.
//
// Eine Deaktivierung IST eine Entscheidung. Ein Datenladevorgang darf sie nicht umkehren.
//
// Ein Bestandsaufrufer, der die Wiederfreigabe gebraucht hätte, existiert nicht: Der einzige Weg,
// auf ein vorhandenes Demo-Konto zu treffen, ist der `force`-Re-Seed nach einem unvollständigen
// Purge — und der Purge entfernt die Demo-Konten (`purgeDemoSeed`, s. u.), sodass sie danach neu
// angelegt werden. Das vorhandene Konto wird weiterhin WIEDERVERWENDET (kein Scheitern an der
// Dublettenprüfung), es wird nur nicht mehr angehoben. Die Demo-INHALTE entstehen davon unberührt:
// sie werden über die Service-Ebene diesem Konto als Urheber zugeschrieben, was keine Freigabe
// braucht.
async function ensureDemoUser(
  services: DemoSeedServices,
  input: { name: string; email: string },
  adminId: string,
  role?: "controller",
): Promise<{ id: string; zugang: DemoZugang | null }> {
  const { auth } = services;
  const existing = (await auth.listUsers()).find((u) => u.email === input.email);
  if (existing) {
    // Wiederverwenden, wie es ist: keine Freigabe, keine Rolle, kein neues Kennwort. Ein
    // vorhandenes Kennwort zu rotieren wäre der zweite mögliche Fehler — es würde eine Anmeldung
    // ungültig machen, die jemand vielleicht gerade benutzt, und das ohne dass er darum gebeten hat.
    return { id: existing.id, zugang: null };
  }
  const kennwort = einmalkennwort();
  const created = await auth.register({ ...input, password: kennwort });
  await auth.approveUser(created.id, adminId);
  if (role) {
    await auth.changeRole(created.id, role, adminId);
  }
  return { id: created.id, zugang: { email: created.email, kennwort } };
}

// Baut den eigentlichen Demo-Bestand über die echten Services — identisch für CLI und Admin-UI.
// AUFTRAG-mega64 Block A: bewusst OHNE `einmalkennwoerter` im Rückgabetyp. Diese Funktion legt keine
// Konten an und weiß deshalb nichts über Zugangsdaten; die beiden Aufrufer setzen sie an. Ein
// `Omit` statt eines optionalen Feldes, damit „vergessen anzusetzen" ein Typfehler ist.
async function buildDemoContent(
  services: DemoSeedServices,
  actors: SeedActors,
  locale: DemoLocale = "de",
): Promise<Omit<SeedResult, "einmalkennwoerter">> {
  const {
    auth,
    ko,
    validation,
    ask,
    conflicts,
    lifecycle,
    objects,
    overlaps,
    overlapSettings,
    reasoner,
  } = services;
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

  // --- AUFTRAG-mega59 BLOCK A: der Bestand für den Vortest ------------------------------------
  // Vier Objekte, die ein Industriebetrieb hat und dieser Bestand nicht hatte (Begründung je Slot
  // in demo-content.ts). Sie tragen drei Vortest-Aufgaben, die vorher unlösbar waren:
  //   1. „Lieferanten" — kam im ganzen Beispielbestand kein einzelnes Mal vor. Zwei Objekte, damit
  //      die Suche BEIDE Zustände zeigt: koLieferantFrei wird unten validiert, koLieferantSchutz
  //      bleibt offen. Das Wort steht in Titel UND Schlagwörtern (nicht nur im Fließtext), damit
  //      die Suche es über Titel-Prefilter und Tag-Treffer sicher findet.
  //   2. Vertraulichkeitsstufen — bis hierher lief JEDES Objekt ohne `confidentiality` und wurde
  //      auf „intern" normalisiert. Ab jetzt kommt jede der drei Stufen mindestens einmal vor.
  //   3. Anhang an einem NICHT-internen Objekt — der einzige bisherige Anhang hing an koValid
  //      („intern"), die Kopplung Vertraulichkeit × Anhang war damit nicht vorführbar.
  // Der Wächter dafür ist tests/app/mega59-vortest-bestand.test.ts; ohne ihn fiele genau das beim
  // nächsten Umbau still wieder heraus.
  const koLieferantFrei = await ko.create({
    demoSeed: true,
    title: t.koLieferantFrei.title,
    statement: t.koLieferantFrei.statement,
    type: "best_practice",
    category: "Einkauf & Lieferanten",
    author: erikId,
    tags: ["lieferanten", "einkauf", "hydraulik", DEMO_TAG],
    conditions: t.koLieferantFrei.conditions ?? [],
    measures: t.koLieferantFrei.measures ?? [],
    confidence: 70,
    neededValidations: 2,
  });
  const koLieferantSchutz = await ko.create({
    demoSeed: true,
    title: t.koLieferantSchutz.title,
    statement: t.koLieferantSchutz.statement,
    type: "technik",
    category: "Einkauf & Lieferanten",
    author: carlaId,
    tags: ["lieferanten", "einkauf", "konditionen", DEMO_TAG],
    confidence: 55,
    neededValidations: 2,
    // Die mittlere Stufe — sichtbar in der Facette, und dieses Objekt trägt zusätzlich den Anhang.
    confidentiality: "vertraulich",
  });
  await ko.create({
    demoSeed: true,
    title: t.koGeheim.title,
    statement: t.koGeheim.statement,
    type: "negativwissen",
    category: "Anlage 4",
    author: adminId,
    tags: ["sicherheit", "vorfall", "analyse", DEMO_TAG],
    confidence: 45,
    neededValidations: 2,
    // Die höchste Stufe — ohne sie hat die Vertraulichkeits-Facette nur zwei von drei Werten.
    confidentiality: "streng_vertraulich",
  });
  const koWartung = await ko.create({
    demoSeed: true,
    title: t.koWartung.title,
    statement: t.koWartung.statement,
    type: "technik",
    category: "Anlage 2",
    author: erikId,
    tags: ["wartung", "förderband", "sichtprüfung", DEMO_TAG],
    conditions: t.koWartung.conditions ?? [],
    measures: t.koWartung.measures ?? [],
    confidence: 75,
    neededValidations: 2,
  });

  // --- SCRUM-487 Proben: Duplikatpaar (reifen), stale-date-Seite, unbelegter Claim ---
  // Alle demoSeed → der chirurgische Purge (KO.demoSeed) erfasst sie samt Folge-Einträgen.
  // Duplikatpaar: zwei sehr ähnliche, eigenständige Aussagen → zwei echte KOs. Die eigentliche
  // Duplikat-KENNZEICHNUNG entsteht unten über die echte Erkennung (nicht vorgeformt).
  const koReifenA = await ko.create({
    demoSeed: true,
    title: t.koReifenA.title,
    statement: t.koReifenA.statement,
    type: "technik",
    category: "Logistik",
    author: erikId,
    tags: ["auslieferung", "reifen", DEMO_TAG],
    confidence: 45,
    neededValidations: 2,
  });
  const koReifenB = await ko.create({
    demoSeed: true,
    title: t.koReifenB.title,
    statement: t.koReifenB.statement,
    type: "technik",
    category: "Logistik",
    author: carlaId,
    tags: ["auslieferung", "reifen", DEMO_TAG],
    confidence: 45,
    neededValidations: 2,
  });
  // stale-date-Seite: Jahres-Token (2019) steht wörtlich in der Aussage → sichtbar veraltet.
  const koStale = await ko.create({
    demoSeed: true,
    title: t.koStale.title,
    statement: t.koStale.statement,
    type: "technik",
    category: "IT-Betrieb",
    author: erikId,
    tags: ["vpn", "veraltet", DEMO_TAG],
    confidence: 40,
    neededValidations: 2,
  });
  // Die Quelle verweist explizit auf den alten Stand (2019) — das Jahres-Token in der Aussage ist
  // das sichtbare, testbare Veralterungs-Signal.
  await ko.addSource(koStale.id, erikId, {
    label: "IT-Runbook (Stand 2019)",
    url: "https://intern.klarwerk/it/vpn-2019",
    excerpt: t.koStale.statement,
    provider: "Intern",
  });
  // Unbelegter Claim: bauchgefuehl, bewusst OHNE Quelle/Beleg (kein addSource).
  await ko.create({
    demoSeed: true,
    title: t.koUnbacked.title,
    statement: t.koUnbacked.statement,
    type: "bauchgefuehl",
    category: "Vertrieb",
    author: adminId,
    tags: ["vertrieb", "unbelegt", DEMO_TAG],
    confidence: 20,
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

  // AUFTRAG-mega59 A: die Suche nach „Lieferanten" muss BEIDE Zustände zeigen — koLieferantFrei
  // wird validiert, koLieferantSchutz bleibt bewusst offen. Und die Wartungsquelle ist validiert,
  // weil „Wartung" das Wort ist, mit dem die Testerin am Freitag anfängt.
  await validation.rate(koLieferantFrei.id, carlaId, "up");
  await validation.rate(koLieferantFrei.id, adminId, "up");
  await validation.rate(koWartung.id, carlaId, "up");
  await validation.rate(koWartung.id, adminId, "up");

  // --- Offene Validierungsaufgabe: koOpen Carla zuweisen (erscheint im Board/MyTasks) ---
  await validation.assign(koOpen.id, [carlaId], adminId);

  // --- Wissenslücke: plausible industrielle Betriebsfrage ohne Token-Überschneidung mit den
  // vorhandenen KOs (Ventil/Überdruck/Pumpe/Filter/Kaltstart/Vorwärmung samt deren Stoppwörtern
  // wie „die"/„dem"). Der deterministische Reasoner-Fallback findet daher keinen Treffer →
  // echte Wissenslücke statt Antwort; danach Priorität wie bisher auf „hoch". ---
  // demoSeed:true markiert die erzeugte Lücke mit stabiler Herkunft → der Purge entfernt sie gezielt
  // über das Flag (kein fragiler Frage-Präfix-Abgleich mehr).
  const asked = await ask.ask(t.gapQuestion, adminId, "de", { demoSeed: true });
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

  // --- SCRUM-487: reifen-Duplikat durch die ECHTE Duplikaterkennung laufen lassen ------------------
  // Anders als der Konflikt (bewusst vorgeformt) wird das Duplikat NICHT gesetzt, sondern über
  // overlaps.detectForSubject(...) → reasoner.judgeDuplicate(...) erkannt. Mit online-Reasoner
  // entsteht ein echter Duplikat-Befund auf /duplikate; ohne Modell liefert judgeDuplicate null
  // (und die Textdeckung liegt unter der deterministischen Schwelle) → ehrlich kein Befund, kein Fake.
  // Modul-rein: detectForSubject kennt kein demoSeed (der K0-3-Ausschluss lebt nur im Routen-Wrapper),
  // hier ist es ein bewusster, paar-genauer Demo-Durchlauf — keine Vermischung mit echten Beiträgen.
  const minConfidence =
    (await overlapSettings.get())?.minConfidence ?? DEFAULT_OVERLAP_SETTINGS.minConfidence;
  await overlaps.detectForSubject(
    toDetectSubject(koReifenA),
    [toDetectSubject(koReifenB)],
    (a, b) => reasoner.judgeDuplicate(a, b),
    { minConfidence, modelLabel: "demo:seed" },
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
  // AUFTRAG-mega20 Block C: Seed-Bestand — als Beispielobjekt deklariert, nicht als Nutzeranhang.
  const ref = await objects.put({
    name: "skizze.png",
    mime: "image/png",
    data: TINY_PNG,
    purpose: "example",
  });
  await ko.addAttachment(koValid.id, erikId, {
    name: "skizze.png",
    mime: "image/png",
    objectId: ref.id,
    thumbnail: TINY_PNG,
    size: ref.size,
  });

  // AUFTRAG-mega59 A: derselbe Weg (Object-Store-`put`, dann `ko.addAttachment`) an einem
  // NICHT-internen Objekt. Vorher hing der einzige Anhang des Bestands an einem „intern"-Objekt —
  // die Kopplung Vertraulichkeit × Anhang ließ sich damit nicht vorführen, obwohl G2 sie als
  // Rückkante bereits entschieden hat (der Anhang wird behandelt wie sein Wissensobjekt).
  const refSchutz = await objects.put({
    name: "preisstaffel.png",
    mime: "image/png",
    data: TINY_PNG,
    purpose: "example",
  });
  await ko.addAttachment(koLieferantSchutz.id, carlaId, {
    name: "preisstaffel.png",
    mime: "image/png",
    objectId: refSchutz.id,
    thumbnail: TINY_PNG,
    size: refSchutz.size,
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
    duplicates: (await overlaps.unresolved()).length,
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
  // SCRUM-487: aus den demoSeed-KOs entstandene Duplikat-Einträge (analog Konflikte über KO-Zugehörigkeit).
  duplicates: number;
  gaps: number;
  users: number;
}

export async function purgeDemoSeed(
  services: Pick<DemoSeedServices, "ko" | "conflicts" | "overlaps" | "ask" | "auth">,
  actor: string,
): Promise<PurgeResult> {
  const { ko, conflicts, overlaps, ask, auth } = services;
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
  // SCRUM-487: aus den demoSeed-KOs entstandene DUPLIKAT-Einträge ebenso schließen (KO-Zugehörigkeit),
  // damit /duplikate + Badges nach dem Entfernen wieder wie vorher sind. Echte Duplikate (ohne
  // demoSeed-KO auf beiden Seiten) bleiben unangetastet.
  let removedDuplicates = 0;
  for (const d of await overlaps.unresolved()) {
    if (demoIds.has(d.koA) || demoIds.has(d.koB)) {
      await overlaps
        .dismiss(d.id, actor, "Demodaten entfernt (Duplikat, beide Seiten verworfen)")
        .catch(() => undefined);
      removedDuplicates += 1;
    }
  }
  for (const k of demoKos) {
    // SCRUM-422: Demo-Daten IMMER endgültig löschen — nie in den Papierkorb
    // (gilt auch für nur per Tag markierte Alt-Demo-KOs ohne demoSeed-Flag).
    await ko.delete(k.id, actor, { hard: true });
  }
  // Pedi 14.07.: Demo-Wissenslücke(n) über die STABILE Herkunfts-Markierung (Gap-Feld `demoSeed`)
  // entfernen — kein fragiler Frage-Präfix-/Titel-Abgleich mehr. So bleiben echte, vom Nutzer
  // erzeugte Lücken garantiert unangetastet, unabhängig von Sprache oder Umformulierung.
  let removedGaps = 0;
  for (const g of await ask.listGaps()) {
    if (g.demoSeed === true) {
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
    duplicates: removedDuplicates,
    gaps: removedGaps,
    users: removedUsers,
  };
}
