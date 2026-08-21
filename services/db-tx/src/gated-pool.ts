import type { Pool, PoolClient, QueryResult } from "pg";
import { BestandsresetLaeuftError, sperreOderAbweisen } from "./reset-lock";

// ================================================================================================
// JOB 596 — DIE EINE KAPSELUNG.
// ================================================================================================
//
// Die Ownerentscheidung (`00_CONTROL/ENTSCHEIDUNGEN/JOB-596.md`) lautet „zentrale Sperrrichtung"
// statt elf einzeln geänderter Adapter. Diese Datei ist diese eine Stelle: Sie umhüllt den Pool,
// den die Kompositionswurzel an alle Pg-Adapter reicht, und hängt die Reset-Sperre an jede
// Transaktion, die dort entsteht.
//
// DIE FLÄCHE IST GEMESSEN, NICHT ANGENOMMEN. Über die Pg-Adapterdateien des Standes
// `60b951b8` (D8, neu gemessen — die D7-Zahlen „25/143/5" galten für einen älteren Stand und
// stimmten hier nicht mehr; eine Messung im Quelltext verfällt, wenn niemand sie nachzieht):
//
//     grep -rl 'from "pg"' services  →  24 Dateien (ohne Tests, ohne db-tx selbst)
//     darin:  145  pool.query
//               4  pool.connect
//
// Genau diese zwei Wege sind unten gekapselt. Ein dritter Weg in die Datenbank existiert in den
// Adaptern nicht — die Kapselung ist damit vollständig und nicht bloß ausreichend. Wer einen
// dritten Weg hinzufügt, umgeht sie; deshalb steht die Messung hier und nicht nur in der Rückgabe.
//
// DIE SPERRE IST DIE ERSTE ANWEISUNG DER TRANSAKTION. Das ist keine Stilfrage. Eine
// transaktionsgebundene Advisory-Sperre kann sich nur an eine Transaktion binden, die schon offen
// ist, und sie muss stehen, bevor die erste Nutzanweisung Wirkung entfaltet — sonst gibt es ein
// Fenster, in dem der Reset und ein Schreiber gleichzeitig arbeiten.
//
// DER PREIS IST BENANNT: Eine nackte `pool.query` bekommt durch diese Hülle eine
// Transaktionsklammer, die sie vorher nicht hatte. Ohne Klammer gibt es keine Transaktion, an die
// eine transaktionsgebundene Sperre sich binden könnte — der Preis ist der Mechanismus, nicht sein
// Nebeneffekt.
//
// ------------------------------------------------------------------------------------------------
// ENTSCHEIDUNG OV-8 — DIE REICHWEITE DER SPERRE. GETROFFEN IN D8, 21.08.2026.
// ------------------------------------------------------------------------------------------------
//
// DIE FRAGE: Soll ein Bestandsreset das Lesen (a) mit abweisen — ein Vorgang, ein Zustand — oder
// (b) weiterlaufen lassen, sodass die Anwendung während des Resets lesbar bleibt?
//
// DIE ENTSCHEIDUNG: (a). Lesezugriffe werden während eines Bestandsresets MIT abgewiesen. Es gibt
// genau einen Lesevertrag, und er gilt für alle fünf Zugangsformen gleich (`gated-pool.test.ts`,
// Block `LV`).
//
// GRUNDLAGE: BEN D7, Auflage 1 („OV-8 schriftlich entscheiden"), zusammen mit der Ownerentscheidung
// `00_CONTROL/ENTSCHEIDUNGEN/JOB-596.md` und Pedis Satz vom 13.08.2026, der dort zitiert ist:
// „Ich moechte dir mehr Freiheit geben, hier doch in einem groesseren Umfang Selbstfragen zu
// beantworten, damit wir weiterkommen."
//
// WARUM NICHT (b) — und der Grund ist NICHT die Integrität:
//
//   Ein reiner Leser kann einen Reset nicht beschädigen. Er schreibt nichts; PostgreSQL gibt ihm je
//   Anweisung einen konsistenten Schnappschuss. Wer (b) mit „sonst geht der Reset kaputt" begründet,
//   begründet falsch.
//
//   Der tragende Grund ist ein anderer: (b) ist nicht das WEGLASSEN einer Sperre, sondern das
//   HINZUFÜGEN eines Vertrags, den niemand geschrieben hat. Was sieht ein Benutzer, während der
//   Bestand unter ihm verschwindet? Eine Liste, die zwischen Seite 1 und Seite 2 leer wird. Einen
//   Detailaufruf auf ein Objekt, das es beim Klick noch gab. Einen Suchtreffer, der ins Nichts
//   zeigt. Jede dieser Lagen bräuchte eine eigene, geprüfte Antwort — das ist ein größerer Bau als
//   der Reset selbst, und bis er stünde, wäre „lesbar" nur ein anderes Wort für „zeigt Bruchstücke".
//
//   (a) braucht dagegen einen Satz: Während eines Bestandsresets ist die Anwendung nicht verfügbar.
//   Ein Zustand, eine Meldung, ein Testfall. Und der Fehler ist typisiert (`BestandsresetLaeuftError`),
//   sodass die Routen ihn als „gerade nicht möglich" beantworten können statt als Störung.
//
//   Dazu kommt die Dauer: Ein Bestandsreset ist eine Bedienhandlung von Sekunden bis Minuten auf
//   einem System, dessen Bestand ohnehin gerade gelöscht wird. Unverfügbarkeit währenddessen ist
//   kein Rückschritt gegenüber „verfügbar, aber inhaltlich unzuverlässig".
//
// DER PREIS, UNGESCHÖNT UND UNTER TEST: Jeder Lesezugriff trägt dauerhaft eine Transaktionsklammer,
// die er ohne diese Hülle nicht hätte. Ein `SELECT`, das eine Anweisung wäre, sendet vier —
// BEGIN, Sperrabfrage, Nutzanweisung, COMMIT. Bei 145 gemessenen `pool.query`-Stellen ist das kein
// Rundungsfehler. Der Fall `LV-Preis` hält genau diese vier fest, damit der Preis eine Zahl bleibt
// und keine Ahnung: Wer ihn senken will, ändert den Vertrag und bricht den Fall — beabsichtigt.
//
// WAS DIESE ENTSCHEIDUNG NICHT IST: eine Aussage über OV-5 (abweisen gegen warten). Der Vertrag
// hier ist auf ABWEISEN gebaut; das steht in `reset-lock.ts` und bleibt dort unverändert offen.

interface GateZustand {
  transaktionOffen: boolean;
}

const LEERES_ERGEBNIS: QueryResult = {
  command: "",
  rowCount: 0,
  oid: 0,
  rows: [],
  fields: [],
};

// Erkennt die Transaktions-Steueranweisungen im Anweisungstext. Bewusst eng: nur ein Text, der
// GENAU aus dem Schlüsselwort besteht (Groß-/Kleinschreibung und Randraum egal), zählt. Ein
// `BEGIN` innerhalb eines größeren Anweisungstextes — etwa in einem `DO $$ BEGIN … END $$` — ist
// keine Transaktionseröffnung und darf hier nicht als eine gelten.
function steueranweisung(text: string): "BEGIN" | "COMMIT" | "ROLLBACK" | undefined {
  const wort = text.trim().replace(/;$/, "").trim().toUpperCase();
  if (wort === "BEGIN" || wort === "START TRANSACTION") {
    return "BEGIN";
  }
  if (wort === "COMMIT" || wort === "END") {
    return "COMMIT";
  }
  if (wort === "ROLLBACK") {
    return "ROLLBACK";
  }
  return undefined;
}

// ================================================================================================
// DER ANWEISUNGSTEXT — AUS BEIDER AUFRUFFORMEN, MIT DERSELBEN ANTWORT (BEN D7, Prüflücke 1).
// ================================================================================================
//
// `query()` nimmt in pg zwei gültige Formen: einen Text (`query("UPDATE …", werte)`) und ein
// Konfigurationsobjekt (`query({ text: "UPDATE …", values })`). Bis D7 kannte die Hülle nur die
// erste; die zweite ging ungeprüft durch — neben der gesperrten Fläche stand ein offener Weg in
// dieselbe Datenbank. Gemessen an diesem Stand benutzt sie kein Adapter (`grep -rn "\.query({"`
// über `services` ohne Treffer), und genau das war das trügerische daran: Die Lücke kostete nichts,
// bis sie jemand benutzt hätte.
//
// EINE KAPSELUNG, DIE NUR HÄLT, SOLANGE NIEMAND EINE ZWEITE GÜLTIGE FORM BENUTZT, IST KEINE
// KAPSELUNG, SONDERN EINE VERABREDUNG. Deshalb wird der Text jetzt aus beiden Formen gewonnen und
// beide Formen laufen anschließend durch dieselben Zweige.
function anweisungstext(wert: unknown): string | undefined {
  if (typeof wert === "string") {
    return wert;
  }
  if (typeof wert === "object" && wert !== null && "text" in wert) {
    const text = (wert as { text: unknown }).text;
    return typeof text === "string" ? text : undefined;
  }
  return undefined;
}

// ================================================================================================
// DER MEHRQUERY-WEG — UND DIE KORREKTUR, DIE IHN ERST BENUTZBAR MACHT (BEN D5, Auflage 2).
// ================================================================================================
//
// Wer `connect()` nimmt und `BEGIN` selbst absetzt, bekommt die Sperrabfrage unmittelbar an sein
// `BEGIN` gehängt — er muss davon nichts wissen und nichts ändern. So weit D5.
//
// WAS D5 DABEI ÜBERSAH: Wird die Sperre beim `BEGIN` verweigert, muss die Hülle die eben
// geöffnete Transaktion selbst zurückrollen — sonst bliebe sie offen. Dann aber läuft der `catch`
// des Aufrufers, und der sendet SEIN EIGENES `ROLLBACK`. Das ist kein konstruierter Fall: er ist
// in diesem Stand viermal real vorhanden, wörtlich so —
//
//     services/reasoner/src/presets.ts:111-129 (PgAssistPresetRepo.replaceAll)
//       const client = await this.pool.connect();
//       try   { await client.query("BEGIN"); … await client.query("COMMIT"); }
//       catch { await client.query("ROLLBACK"); throw error; }
//
// — dazu `klara-policy-store.ts:640` und zweimal `search-projection-repo-pg.ts`. Das zweite
// `ROLLBACK` erreicht dann eine Verbindung, auf der keine Transaktion mehr offen ist. Postgres
// quittiert das mit einer Warnung statt mit einem Fehler, und genau das ist das Tückische daran:
// Es fällt nicht auf. Zurück bleiben zwei Stellen, die sich beide für die aufräumende halten.
//
// DIE KORREKTUR IST EIN ZUSTAND, KEINE ZWEITE PRÜFUNG. Die Hülle führt je Verbindung mit, ob eine
// Transaktion offen ist. Hat sie selbst aufgeräumt, sind `ROLLBACK` und `COMMIT` des Aufrufers
// wirkungslos, bis ein neues `BEGIN` kommt. Der Aufrufer darf seinen Fang unverändert behalten —
// sein Vertrag bleibt gültig —, und die Datenbank sieht trotzdem genau ein `ROLLBACK`.
function gatedClient(client: PoolClient): PoolClient {
  const zustand: GateZustand = { transaktionOffen: false };

  const gateQuery = async (...args: unknown[]): Promise<unknown> => {
    const [erstes] = args;

    const text = anweisungstext(erstes);

    // FAIL-CLOSED FÜR ALLES ÜBRIGE. Liefert die Textgewinnung nichts — pg kennt daneben noch die
    // Submittable-Form (Cursor, QueryStream) —, bleibt `steuerung` undefiniert, und der Aufruf
    // fällt unten in den Zweig der NUTZANWEISUNG: geklammert und gesperrt. Das ist die sichere
    // Richtung. Sie ist an diesem Stand ohne Wirkung (`grep` über `services` findet weder
    // `pg-cursor` noch `QueryStream` noch `submit(`), und falls doch einmal ein Cursor dazukommt,
    // fällt er durch die Klammer auf und wird gesehen — statt still ungesperrt durchzulaufen.
    const steuerung = text === undefined ? undefined : steueranweisung(text);

    if (steuerung === "BEGIN") {
      const ergebnis = await (client.query as (...a: unknown[]) => Promise<unknown>)(...args);
      zustand.transaktionOffen = true;
      try {
        await sperreOderAbweisen(client);
      } catch (fehler) {
        // Die Hülle hat die Transaktion geöffnet, also räumt die Hülle sie ab — und merkt sich das.
        await client.query("ROLLBACK");
        zustand.transaktionOffen = false;
        throw fehler;
      }
      return ergebnis;
    }

    if (steuerung === "COMMIT" || steuerung === "ROLLBACK") {
      if (!zustand.transaktionOffen) {
        // Bereits abgeräumt (oder nie eröffnet). Die Anweisung erreicht die Datenbank NICHT.
        return LEERES_ERGEBNIS;
      }
      zustand.transaktionOffen = false;
      return (client.query as (...a: unknown[]) => Promise<unknown>)(...args);
    }

    // ============================================================================================
    // EINE NUTZANWEISUNG OHNE OFFENE TRANSAKTION — BEN D6, Auflage 4 / PRÜFLÜCKE 1.
    // ============================================================================================
    //
    // `connect()` verpflichtet zu nichts. Ein Aufrufer darf sich eine Verbindung holen und darauf
    // eine EINZELNE Anweisung absetzen; Postgres führt sie dann im Autocommit aus. Bis hierher
    // hatte dieser Weg keinen Zweig: `steueranweisung()` liefert `undefined`, und die Anweisung
    // ging unbesehen durch. Neben der gekapselten Fläche stand damit ein offener Weg in dieselbe
    // Datenbank — genau das, was die Ownerentscheidung „zentrale Sperrrichtung" ausschließt.
    //
    // WARUM EINE EIGENE KLAMMER UND NICHT NUR EINE SPERRABFRAGE: Die Sperre ist
    // transaktionsgebunden (`pg_try_advisory_xact_lock_shared`). Ohne offene Transaktion gäbe es
    // nichts, woran sie sich binden könnte — sie wäre im selben Atemzug wieder frei. Der Preis ist
    // derselbe wie beim Einzelquery-Weg unten und aus demselben Grund: der Mechanismus, nicht sein
    // Nebeneffekt.
    //
    // Der Weg MIT eigenem `BEGIN` bleibt unberührt: dort ist `transaktionOffen` gesetzt, und die
    // Anweisung läuft in der Klammer des Aufrufers weiter (Fall P4).
    if (zustand.transaktionOffen) {
      return (client.query as (...a: unknown[]) => Promise<unknown>)(...args);
    }

    await client.query("BEGIN");
    try {
      await sperreOderAbweisen(client);
      const ergebnis = await (client.query as (...a: unknown[]) => Promise<unknown>)(...args);
      await client.query("COMMIT");
      return ergebnis;
    } catch (fehler) {
      // Aufgeräumt wird an genau einer Stelle — dieselbe Regel wie im Einzelquery-Weg. Der Zustand
      // bleibt `false`, ein späteres `ROLLBACK` des Aufrufers erreicht die Datenbank deshalb nicht
      // (Fall M5).
      await client.query("ROLLBACK").catch(() => undefined);
      throw fehler;
    }
  };

  // Ein Proxy statt einer nachgebauten Klasse: Alles, was ein `PoolClient` sonst kann — `release`,
  // die Ereignisse, `escapeIdentifier` —, bleibt unverändert erreichbar und an den echten Client
  // gebunden. Nur `query` läuft durch das Gate. Ein handgeschriebener Ersatz müsste jede dieser
  // Fähigkeiten kennen und würde beim nächsten pg-Update still eine davon verlieren.
  return new Proxy(client, {
    get(ziel, eigenschaft, _empfaenger) {
      if (eigenschaft === "query") {
        return gateQuery;
      }
      const wert = Reflect.get(ziel, eigenschaft, ziel);
      return typeof wert === "function" ? (wert as (...a: unknown[]) => unknown).bind(ziel) : wert;
    },
  });
}

// ================================================================================================
// DER EINZELQUERY-WEG.
// ================================================================================================
//
// `pool.query(...)` nimmt sich je Aufruf eine BELIEBIGE freie Verbindung. Eine Sperre auf
// Verbindung A schützt eine Mutation auf Verbindung B in keiner Weise — deshalb holt die Hülle
// sich den Client selbst und hält Sperre und Nutzanweisung auf derselben Verbindung zusammen.
//
// AUFGERÄUMT WIRD AN GENAU EINER STELLE. Der Fang unten ist die einzige, und `sperreOderAbweisen`
// stellt nur fest (s. reset-lock.ts). Zwei Aufräumer wären zwei `ROLLBACK` — derselbe Fehler, den
// der Mehrquery-Weg oben mit dem Zustand vermeidet.
export function gatedPool(rohPool: Pool): Pool {
  const gateQuery = async (...args: unknown[]): Promise<unknown> => {
    const client = await rohPool.connect();
    try {
      await client.query("BEGIN");
      await sperreOderAbweisen(client);
      const ergebnis = await (client.query as (...a: unknown[]) => Promise<unknown>)(...args);
      await client.query("COMMIT");
      return ergebnis;
    } catch (fehler) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw fehler;
    } finally {
      client.release();
    }
  };

  const gateConnect = async (...args: unknown[]): Promise<PoolClient> => {
    const client = await (rohPool.connect as (...a: unknown[]) => Promise<PoolClient>)(...args);
    return gatedClient(client);
  };

  return new Proxy(rohPool, {
    get(ziel, eigenschaft, _empfaenger) {
      if (eigenschaft === "query") {
        return gateQuery;
      }
      if (eigenschaft === "connect") {
        return gateConnect;
      }
      const wert = Reflect.get(ziel, eigenschaft, ziel);
      return typeof wert === "function" ? (wert as (...a: unknown[]) => unknown).bind(ziel) : wert;
    },
  });
}

export { BestandsresetLaeuftError };
