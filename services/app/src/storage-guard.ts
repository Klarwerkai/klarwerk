// SCRUM (Betriebssicherheit, 06.07. / SCRUM-498 B3): Verhindert, dass ein FEHLKONFIGURIERTES
// Prod-Deployment still auf nicht-dauerhaftem, nicht quell-gebundenem In-Memory-/Journal-Speicher läuft.
// In Produktion (NODE_ENV=production, so setzt es das Dockerfile) MUSS DATABASE_URL gesetzt sein →
// PgKoRepo (dauerhaft + quell-gebundenes SQL LIMIT). Fehlt sie, fiele der Code auf InMemory/Journal
// zurück (Datenverlust bei jedem Neustart/Deploy, KO-Bestand nicht quell-gebunden) — der Start bricht
// dann FAIL-CLOSED laut ab. Ein expliziter Override (KLARWERK_ALLOW_INMEMORY_PROD=1) erlaubt den
// In-Memory-Pfad bewusst (z. B. für einen künftigen, noch NICHT implementierten Insel-/sqlite-vec-Modus),
// dann nur mit lauter Warnung. Rein und testbar — keine Prozess-/Env-Nebenwirkungen hier.

// Eine Quelle der Wahrheit für Env-Strings am Bootstrap-Rand: trimmen; leerer/whitespace-only String →
// undefined. So können Guard-Entscheidung und die tatsächliche Pg-/InMemory-Verzweigung in server.ts
// NIE auseinanderlaufen (ben-Review ROT-1: "   " wäre roh truthy → pgServices, aber getrimmt leer).
export function normalizeEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export interface StorageEnv {
  databaseUrl: string | undefined;
  nodeEnv: string | undefined;
  // KLARWERK_ALLOW_INMEMORY_PROD=1: bewusster Override, um in Produktion OHNE DATABASE_URL zu starten.
  allowInMemoryProd: string | undefined;
  // NUR für die Formulierung der Override-Warnung (der Persistenz-ENTSCHEID bleibt journal-unabhängig —
  // ein Journal rettet Produktion nie): ist der Dev-Persistenz-Journal-Pfad aktiv (KLARWERK_DEV_PERSIST)?
  journalActive: boolean;
}

// Ergebnis der Prüfung: nichts zu sagen (leer) — oder eine laute Warnung, weil Produktion ohne
// DATABASE_URL läuft.
//
// JOB 3776 RUNDE 2: Hier stand bis dahin „Fail-closed → Wurf (StoragePersistenceError)". Die
// Fehlerklasse und der Wurf sind entfernt; diese Funktion verweigert keinen Start mehr. Wer den
// Start verweigert, ist der Startvertrag (`pruefeStartvertrag`) — siehe die Begründung an
// `assertPersistentStore`.
export interface StorageGuardDecision {
  warning?: string;
}

// Warnt laut, wenn Produktion ohne DATABASE_URL läuft. Das Journal (KLARWERK_DEV_PERSIST) zählt
// bewusst NICHT als prod-tauglich: es persistiert zwar den InMemory-Stand, die Datenhaltung bleibt
// aber InMemoryKoRepo (nicht quell-gebunden). In Nicht-Produktion (lokale Entwicklung/Tests) ist
// In-Memory/Journal unverändert erlaubt und still.
//
// ================================================================================================
// JOB 3776 RUNDE 2 — HIER STAND EIN ZWEITER WEG ZUR SELBEN ABSAGE. ER IST WEG. WOHIN SIE GEZOGEN IST.
// ================================================================================================
//
// BIS JOB 3776 warf diese Funktion am Ende eine `StoragePersistenceError` („Default: fail-closed")
// und brach damit den Start ab. Das war seit SCRUM-498 B3 richtig und der einzige Riegel.
//
// SEIT JOB 3776 ruft `server.ts` den Startvertrag als ERSTE Anweisung von `start()`, und der führt
// `DATABASE_URL` als Pflichtwert in Produktion — mit EXAKT derselben Ausnahme
// (`KLARWERK_ALLOW_INMEMORY_PROD=1`). Die Bedingung des Wurfs war damit eine Teilmenge der
// Vertragsbedingung: GEMESSEN über acht Umgebungen am echten Prozess (`NODE_ENV=production`,
// `DATABASE_URL` leer, `KLARWERK_ALLOW_INMEMORY_PROD` in {nicht gesetzt, "0", "ja", "true"}, je mit
// und ohne `APP_BASE_URL`) brach in ALLEN acht der Vertrag zuerst ab, wörtlich mit
// „Serverstart fehlgeschlagen: StartvertragError: … fehlen — DATABASE_URL". Der Wurf wurde nie mehr
// erreicht. Zwei Wege zur selben Absage sind genau das, was Prüfpunkt 7 verbietet — deshalb ist der
// tote Weg samt `StoragePersistenceError` entfernt (BEN, Runde 1, Korrekturpflicht 2).
//
// DIE ABSAGE IST NICHT VERSCHWUNDEN, SIE IST UMGEZOGEN — und das ist der Satz, auf den es ankommt.
// Fehlt `DATABASE_URL` in Produktion, bricht der Start weiterhin ab; nur eben am Vertrag und mit
// EINER lesbaren Zeile statt zweier Meldungen aus zwei Quellen. Gepinnt ist das doppelt:
//   · `tests/demo-zugang-start/startvertrag-pflicht.test.ts` A7 — der Wächter wirft in KEINER der
//     vier Lagen mehr, UND der Vertrag verweigert genau die Lage, in der früher der Wurf stand.
//   · `tests/app/storage-guard.test.ts` — derselbe Doppelgriff aus Sicht dieser Datei.
// Liesse jemand `DATABASE_URL` aus dem Vertrag fallen, würden beide rot. Das ist der Ersatz für den
// Riegel, den diese Funktion nicht mehr stellt.
//
// WAS DIESE FUNKTION STATTDESSEN TUT: Sie WARNT, und zwar in beiden Lagen, in denen Produktion ohne
// DATABASE_URL läuft — nie still. Der bewusste Override behält seinen bisherigen Wortlaut
// unverändert (er ist der einzige laute Hinweis in diesem Fall und wurde gemessen: die Warnzeile ist
// die ERSTE Zeile der Prozessausgabe). Die zweite Lage — Produktion, kein DATABASE_URL, KEIN
// Override — kann nur eintreten, wenn der Vertrag umgangen wurde; sie bekommt deshalb einen eigenen,
// ehrlichen Satz statt eines stillen `return {}`. Ein stiller Durchlass wäre hier der eigentliche
// Schaden gewesen: Produktion käme auf In-Memory hoch, ohne dass irgendwo etwas steht.
export function assertPersistentStore(env: StorageEnv): StorageGuardDecision {
  // Nicht-Produktion: In-Memory/Journal bewusst erlaubt (Verhalten unverändert).
  if (env.nodeEnv !== "production") {
    return {};
  }
  // Produktion MIT DATABASE_URL → PgKoRepo (dauerhaft, quell-gebunden). Live-Pfad, unverändert.
  if (env.databaseUrl?.trim()) {
    return {};
  }
  // Ab hier: Produktion OHNE DATABASE_URL — der Code fällt auf InMemory/Journal zurück.
  const bewussterOverride = env.allowInMemoryProd?.trim() === "1";
  const prefix = bewussterOverride
    ? "KLARWERK WARN: NODE_ENV=production, KLARWERK_ALLOW_INMEMORY_PROD=1, kein DATABASE_URL → "
    : "KLARWERK WARN: NODE_ENV=production, kein DATABASE_URL und KEIN bewusster Override (KLARWERK_ALLOW_INMEMORY_PROD=1) — diesen Start weist der Startvertrag ab (pruefeStartvertrag, erste Anweisung von start() in server.ts). Erscheint diese Zeile trotzdem, ist der Vertrag umgangen worden → ";
  const journalWarning = `${prefix}Journal-Speicher (KLARWERK_DEV_PERSIST): übersteht Prozess-Neustarts, ist aber NICHT prod-tauglich — nicht quell-gebunden, monoton wachsend, ohne Volume/Backup gefährdet. Für Produktion DATABASE_URL (PgKoRepo) setzen.`;
  const inMemoryWarning = `${prefix}In-Memory-Speicher: Zustand geht bei Neustart/Deploy verloren. NICHT prod-tauglich. Für Produktion DATABASE_URL (PgKoRepo) setzen.`;
  return { warning: env.journalActive ? journalWarning : inMemoryWarning };
}
