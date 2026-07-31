// ================================================================================================
// AUFTRAG-mega80 BLOCK C — DER ALTBESTAND OHNE HOCHLADENDEN: EINE FESTSTELLUNG, KEIN UMBAU.
// ================================================================================================
//
// WORUM ES GEHT. Seit mega78 entscheidet über die Auslieferung eines Anhangs der HOCHLADENDE
// (`ObjectRef.lifecycle.owner`, services/app/src/sichtbarkeit.ts). Ein `ObjectRef` OHNE `lifecycle`
// hat keinen Hochladenden, fällt auf die Rücklage und ist damit nur noch für `ko.validate`
// sichtbar. Neue Uploads setzen die Zuordnung immer (`ObjectStore.put`); ein Bestand, der VOR
// mega78 geladen wurde, bekommt sie nie — es gibt keinen Backfill-Weg, und die Seed-Änderungen
// reparieren nur NEU geschriebene Objekte (seed-demo.ts:199-216 überspringt einen vorhandenen
// Satz, die Beispielpakete überspringen vorhandene Quellanker).
//
// Für einen Betrachter OHNE `ko.validate` verschwinden dann Bilder und Anhänge, während die
// tragenden Wissensobjekte selbst sichtbar bleiben.
//
// WAS DIESES WERKZEUG TUT UND WAS AUSDRÜCKLICH NICHT. Es STELLT FEST und ändert nichts:
//   - Es zählt die `ObjectRef` ohne `lifecycle.owner`.
//   - Es sagt, welche davon von einem TRÄGER referenziert werden — nur die sind für einen
//     Betrachter überhaupt sichtbar.
//   - Es nennt je Fund die Träger.
//
// Es schreibt NICHT, migriert NICHT und legt NICHTS an. Ausschließlich SELECT. Es ist NICHT Teil
// von `tools/check` — dasselbe Muster und dieselbe Begründung wie tools/audit-forensics.sh.
//
// ================================================================================================
// AUFTRAG-mega82 BLOCK B — DAS WERKZEUG MISST NICHT WENIGER, ALS DIE ENTSCHEIDUNG BRAUCHT.
// ================================================================================================
//
// DER BEFUND (ben, sammel79). Bis mega82 las dieses Werkzeug DREI Quellen: aktuelle Wissensobjekte
// (Anhangsliste und Fließtext) und Versions-Schnappschüsse. Die produktive Entscheidung
// `beurteileAnhang` kennt aber VIER Trägerquellen (app/src/sichtbarkeit.ts): dazu kommen die
// append-only BELEGKETTE und die ENTWÜRFE. Das vorhandene Referenzinventar `findObjectReferences`
// (app/src/object-references.ts) nennt dieselbe vollständige Grundmenge längst ausdrücklich.
//
// WARUM DAS ZÄHLT, obwohl niemand die Zahl bisher benutzt hat: eine Zahl, die zu klein ist,
// BERUHIGT FALSCH. Ein Objekt, das nur noch an einem Beleg oder einem Entwurf hängt, wäre als
// „hängt an nichts, nichts zu tun" gemeldet worden — und genau danach wird entschieden. Ein
// Werkzeug für den Betrieb muss stimmen, BEVOR es je jemand benutzt.
//
// DIE GRUNDMENGE AB HIER — dieselbe wie `findObjectReferences`, Route für Route:
//   aktuelles Wissensobjekt: Anhangsliste (`anhang`) · Fließtext (`fliesstext`)
//   Versions-Schnappschuss:  Anhangsliste oder Fließtext (`fassung`)
//   Belegkette:              `ko_evidence.objectId` (`beleg`)
//   Entwurf:                 Fließtext (`entwurf-rumpf`) · `pendingSources` (`entwurf-quelle`) ·
//                            `anchorDocuments` (`entwurf-anker`)
//
// WELCHE FRAGE DIE ZAHL BEANTWORTET — und das gehört zur Zahl dazu:
//
//   1. PAPIERKORB IST EINGESCHLOSSEN. Dieses Werkzeug liest die ROHE Tabelle
//      (`SELECT data FROM kos`), der Anhangs-Lesepfad dagegen `KoService.list()`, das getrashte
//      Objekte herausfiltert (`.filter((k) => !k.deletedAt)`, knowledge-object/src/service.ts:1468).
//      Ein Objekt, das NUR an einem getrashten Wissensobjekt hängt, erscheint hier als Fund, ist
//      für einen Betrachter aber schon heute unsichtbar. Für eine MIGRATIONSINVENTUR ist das
//      richtig herum — ein getrashtes Objekt kann wiederhergestellt werden, und wer den Bestand
//      repariert, will es mitnehmen. Die Zahl beantwortet damit: „wie viele Objekte ohne
//      Hochladenden hängen an irgendeinem Träger, den es im Bestand GIBT" — nicht „wie viele sind
//      HEUTE für jemanden unsichtbar geworden". Letztere Zahl wäre kleiner.
//   2. SICHTBARKEIT WIRD NICHT GERECHNET. Das Werkzeug fragt nicht, ob ein bestimmter Mensch den
//      Träger sehen darf. Es sagt „hier hängt etwas ohne Hochladenden", nicht „hier verliert Person
//      X ein Bild".
//   3. ES IST EINE OBERGRENZE DES SCHADENS, keine Schadensmeldung.
//
// WARUM DER KERN VON DER DATENBANK GETRENNT IST. `stelleFest` ist eine reine Funktion über bereits
// gelesene Zeilen. Nur so ist die Auswertung prüfbar, ohne eine Instanz zu brauchen — der Test
// liegt in tests/security/mega80-altbestand-feststellung.test.ts. Der Datenbankteil darunter tut
// nichts weiter, als fünf SELECTs auszuführen.
import type { ObjectRef } from "../services/object-store/src/types";

/** Ein Wissensobjekt, so weit dieses Werkzeug es überhaupt anfasst. */
export interface KoZeile {
  id: string;
  title?: string | null | undefined;
  attachments?: readonly { objectId?: string | null | undefined }[] | undefined;
  bodyHtml?: string | null | undefined;
}

/** Ein Eintrag der append-only Belegkette (`ko_evidence`) — er überlebt jede Änderung am KO. */
export interface BelegZeile {
  koId: string;
  objectId?: string | null | undefined;
}

/** Ein Entwurf (`drafts`) mit seinen drei Referenzformen — dieselben wie in object-references.ts. */
export interface EntwurfZeile {
  id: string;
  titel?: string | null | undefined;
  bodyHtml?: string | null | undefined;
  pendingSources?: readonly { objectId?: string | null | undefined }[] | undefined;
  anchorDocuments?: readonly { objectId?: string | null | undefined }[] | undefined;
}

/**
 * Auf welchem Weg ein Träger das Objekt nennt. Die Reihenfolge dieser Union ist zugleich die
 * MELDEREIHENFOLGE: je Träger wird der erste zutreffende Weg genannt, nicht alle. Für die Zahl ist
 * das gleichgültig (gezählt werden OBJEKTE), für die Lesbarkeit der Liste nicht.
 */
export type Traegerart =
  | "anhang"
  | "fliesstext"
  | "fassung"
  | "beleg"
  | "entwurf-rumpf"
  | "entwurf-quelle"
  | "entwurf-anker";

export interface Fund {
  objectId: string;
  name: string;
  mime: string;
  createdAt: string;
  /**
   * Die Träger, die dieses Objekt nennen. `traegerId` ist eine KO-Kennung für die vier
   * KO-gebundenen Wege und eine ENTWURFS-Kennung für die drei Entwurfs-Wege — deshalb heißt das
   * Feld nicht mehr `koId`: ein Entwurf ist kein Wissensobjekt, und die Liste soll nicht so tun.
   */
  traeger: { traegerId: string; bezeichnung: string; wie: Traegerart }[];
}

/**
 * Die gelesenen Zeilen — benannt statt positionell, damit eine weitere Quelle den Aufruf nicht
 * still verschiebt. Fehlt eine Quelle, ist sie leer; das ist eine ehrliche Teilmenge, keine Null.
 */
export interface Bestandszeilen {
  objekte: readonly ObjectRef[];
  kos: readonly KoZeile[];
  fassungen: readonly { koId: string; stand: KoZeile }[];
  belege: readonly BelegZeile[];
  entwuerfe: readonly EntwurfZeile[];
}

export interface Feststellung {
  /** Alle `ObjectRef` im Bestand. */
  objekteGesamt: number;
  /** Davon ohne `lifecycle.owner` — die eigentliche Zahl. */
  ohneHochladenden: number;
  /** Davon von mindestens einem Wissensobjekt referenziert. NUR diese sind für jemanden sichtbar. */
  ohneHochladendenUndReferenziert: number;
  /** Die referenzierten Fälle im Einzelnen, nach Objektkennung sortiert (reproduzierbarer Lauf). */
  funde: Fund[];
}

function hatHochladenden(ref: ObjectRef): boolean {
  const owner = ref.lifecycle?.owner;
  return typeof owner === "string" && owner.length > 0;
}

function nenntImText(bodyHtml: string | null | undefined, objectId: string): boolean {
  return typeof bodyHtml === "string" && bodyHtml.includes(objectId);
}

/**
 * Die AUSWERTUNG — rein, ohne Datenbank, ohne Uhr, ohne Zufall.
 *
 * Die Grundmenge ist dieselbe wie in `findObjectReferences` (app/src/object-references.ts) und
 * dieselbe, die `beurteileAnhang` produktiv befragt (app/src/sichtbarkeit.ts) — s. den Kopf dieser
 * Datei. Sie wird hier GESPIEGELT und nicht importiert: das Werkzeug liest rohe Datenbankzeilen und
 * hat weder `KnowledgeObject` noch `Draft` in vollständiger Form vor sich; ein Import zwänge zu
 * einer Attrappe, die die Spiegelung nur versteckte. Der Test hält die Deckung fest.
 */
export function stelleFest(zeilen: Bestandszeilen): Feststellung {
  const { objekte, kos, fassungen, belege, entwuerfe } = zeilen;
  const ohne = objekte.filter((ref) => !hatHochladenden(ref));
  const titelVon = new Map(kos.map((ko) => [ko.id, ko.title ?? ""]));

  const funde: Fund[] = [];
  for (const ref of [...ohne].sort((a, b) => a.id.localeCompare(b.id))) {
    const traeger: Fund["traeger"] = [];
    // JE TRÄGER GENAU EIN EINTRAG. Der erste zutreffende Weg gewinnt; die Reihenfolge unten ist die
    // der `Traegerart`-Union. Sonst stünde ein Wissensobjekt, das den Anhang führt UND in einer
    // alten Fassung nennt UND einen Beleg dazu hat, dreimal in derselben Liste.
    const schonGenannt = new Set<string>();
    const nimm = (traegerId: string, bezeichnung: string, wie: Traegerart): void => {
      if (schonGenannt.has(traegerId)) {
        return;
      }
      schonGenannt.add(traegerId);
      traeger.push({ traegerId, bezeichnung, wie });
    };

    for (const ko of kos) {
      if ((ko.attachments ?? []).some((a) => a.objectId === ref.id)) {
        nimm(ko.id, ko.title ?? "", "anhang");
      } else if (nenntImText(ko.bodyHtml, ref.id)) {
        nimm(ko.id, ko.title ?? "", "fliesstext");
      }
    }
    for (const { koId, stand } of fassungen) {
      const genannt =
        (stand.attachments ?? []).some((a) => a.objectId === ref.id) ||
        nenntImText(stand.bodyHtml, ref.id);
      if (genannt) {
        nimm(koId, titelVon.get(koId) ?? "", "fassung");
      }
    }
    // Die Belegkette ist append-only und überlebt jede Änderung am Wissensobjekt — sie ist die
    // letzte Spur eines Trägers und die Quelle, die dem Werkzeug bis mega82 ganz fehlte.
    for (const beleg of belege) {
      if (beleg.objectId === ref.id) {
        nimm(beleg.koId, titelVon.get(beleg.koId) ?? "", "beleg");
      }
    }
    for (const entwurf of entwuerfe) {
      const bezeichnung = entwurf.titel ?? "";
      if (nenntImText(entwurf.bodyHtml, ref.id)) {
        nimm(entwurf.id, bezeichnung, "entwurf-rumpf");
      } else if ((entwurf.pendingSources ?? []).some((q) => q.objectId === ref.id)) {
        nimm(entwurf.id, bezeichnung, "entwurf-quelle");
      } else if ((entwurf.anchorDocuments ?? []).some((d) => d.objectId === ref.id)) {
        nimm(entwurf.id, bezeichnung, "entwurf-anker");
      }
    }

    if (traeger.length > 0) {
      funde.push({
        objectId: ref.id,
        name: ref.name,
        mime: ref.mime,
        createdAt: ref.createdAt,
        traeger,
      });
    }
  }

  return {
    objekteGesamt: objekte.length,
    ohneHochladenden: ohne.length,
    ohneHochladendenUndReferenziert: funde.length,
    funde,
  };
}

/**
 * Der Bericht als Text — eine Zahl oben, die Einzelfälle darunter.
 *
 * AUFTRAG-mega82 Block B: die Zahl steht NICHT mehr allein da. Darunter steht in zwei Zeilen, welche
 * Frage sie beantwortet — welche Träger sie zählt und dass der Papierkorb eingeschlossen ist. Eine
 * Zahl ohne ihre Frage wird gelesen wie die Antwort auf die Frage, die der Leser gerade im Kopf hat.
 */
export function alsBericht(f: Feststellung): string {
  const zeilen: string[] = [
    "KLARWERK — Feststellung: Altbestand ohne Hochladenden (mega80 Block C, READ-ONLY)",
    "",
    `Objekte im Bestand insgesamt:            ${f.objekteGesamt}`,
    `davon OHNE lifecycle.owner:              ${f.ohneHochladenden}`,
    `davon von einem Träger genannt:          ${f.ohneHochladendenUndReferenziert}`,
    "",
    "WAS DIE LETZTE ZAHL BEANTWORTET: wie viele davon an IRGENDEINEM Träger hängen, den es im",
    "Bestand gibt — aktuelles Wissensobjekt (Anhang/Fließtext), Versions-Schnappschuss, Belegkette",
    "oder Entwurf (Rumpf/Quelle/Ankerdokument). GETRASHTE Wissensobjekte sind EINGESCHLOSSEN (der",
    "Lesepfad sieht sie nicht, eine Migration nimmt sie mit). Die Zahl ist damit eine Obergrenze,",
    "keine Schadensmeldung: wie viele Anhänge ein bestimmter Mensch heute verliert, sagt sie nicht.",
    "",
  ];
  if (f.ohneHochladendenUndReferenziert === 0) {
    zeilen.push(
      f.ohneHochladenden === 0
        ? "BEFUND: kein Altbestand ohne Hochladenden. Nichts zu tun."
        : "BEFUND: es gibt Objekte ohne Hochladenden, aber KEINES wird von einem Träger" +
            " genannt. Für Betrachter ändert sich dadurch nichts.",
    );
    return `${zeilen.join("\n")}\n`;
  }
  zeilen.push(
    "BEFUND: die folgenden Objekte hängen an einem Träger, haben aber keinen Hochladenden.",
    "Für Betrachter OHNE ko.validate sind sie heute nicht abrufbar.",
    "",
  );
  for (const fund of f.funde) {
    zeilen.push(`- ${fund.objectId}  ${fund.name} (${fund.mime}, ${fund.createdAt})`);
    for (const t of fund.traeger) {
      zeilen.push(`    ← ${t.wie.padEnd(14)} ${t.traegerId}  ${t.bezeichnung}`);
    }
  }
  return `${zeilen.join("\n")}\n`;
}

// ------------------------------------------------------------------------------------------------
// DER DATENBANKTEIL. Fünf SELECTs, sonst nichts.
//
// Alle fünf lesen die ROHEN Tabellen — ohne `deletedAt`-Ausschluss, ohne Sichtbarkeitsfilter. Das
// ist die im Kopf dieser Datei benannte Papierkorb-Semantik und für eine Migrationsinventur die
// richtige Richtung. Wer den Lesepfad nachbilden wollte, müsste `kos` um `NOT (data ? 'deletedAt')`
// beschneiden — dann beantwortete die Zahl aber eine andere Frage und der Bericht oben löge.
// ------------------------------------------------------------------------------------------------
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    process.stderr.write(
      "DATABASE_URL fehlt. Aufruf:\n  DATABASE_URL='postgres://…' tools/anhang-herkunft-feststellen.sh\n",
    );
    process.exitCode = 2;
    return;
  }
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url });
  try {
    const objekte = await pool.query<{ ref: ObjectRef }>("SELECT ref FROM objects ORDER BY id");
    // `data` trägt das ganze KO-JSON; hier werden nur id/title/attachments/bodyHtml gelesen.
    const kos = await pool.query<{ data: KoZeile }>("SELECT data FROM kos ORDER BY id");
    const fassungen = await pool.query<{ ko_id: string; snapshot: KoZeile }>(
      "SELECT ko_id, snapshot FROM ko_versions ORDER BY ko_id, version",
    );
    // AUFTRAG-mega82 Block B: die beiden Quellen, die bis mega82 fehlten. `data` trägt den ganzen
    // EvidenceRecord bzw. Draft; gelesen wird nur, was oben im Typ steht.
    const belege = await pool.query<{ ko_id: string; data: { objectId?: string | null } }>(
      "SELECT ko_id, data FROM ko_evidence ORDER BY created_at, id",
    );
    const entwuerfe = await pool.query<{
      data: {
        id: string;
        payload?: {
          title?: string | null;
          bodyHtml?: string | null;
          pendingSources?: { objectId?: string | null }[];
          anchorDocuments?: { objectId?: string | null }[];
        };
      };
    }>("SELECT data FROM drafts ORDER BY id");
    const feststellung = stelleFest({
      objekte: objekte.rows.map((r) => r.ref),
      kos: kos.rows.map((r) => r.data),
      fassungen: fassungen.rows.map((r) => ({ koId: r.ko_id, stand: r.snapshot })),
      belege: belege.rows.map((r) => ({ koId: r.ko_id, objectId: r.data?.objectId })),
      entwuerfe: entwuerfe.rows.map((r) => ({
        id: r.data.id,
        titel: r.data.payload?.title,
        bodyHtml: r.data.payload?.bodyHtml,
        pendingSources: r.data.payload?.pendingSources,
        anchorDocuments: r.data.payload?.anchorDocuments,
      })),
    });
    process.stdout.write(alsBericht(feststellung));
    if (process.env.KLARWERK_FESTSTELLUNG_JSON === "1") {
      process.stdout.write(`${JSON.stringify(feststellung, null, 2)}\n`);
    }
  } finally {
    await pool.end();
  }
}

// Nur ausführen, wenn direkt gestartet — der Test importiert die reinen Funktionen.
if (process.argv[1]?.endsWith("anhang-herkunft-feststellen.ts")) {
  void main();
}
