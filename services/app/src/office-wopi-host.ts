// ================================================================================================
// OFFICE IM ARTIKEL · DER WOPI-HOSTWEG: ANFRAGE HINEIN, ANTWORT HINAUS.
// ================================================================================================
//
// Auftrag `produkt:20261007:office-machbarkeit`, Nacharbeit 1. Runde 1 lieferte nur die
// Entscheidungen (`office-wopi.ts`); bens Befund: ohne Hostweg und Editor ist die Testbarkeit des
// gewählten Wegs nicht praktisch belegt. Diese Datei ist der Hostweg — die WOPI-Endpunkte aus dem
// Plan (Abschnitt 3.6) als EINE rahmenunabhängige Funktion:
//
//   GET  /wopi/files/:id            CheckFileInfo
//   GET  /wopi/files/:id/contents   GetFile
//   POST /wopi/files/:id/contents   PutFile
//   POST /wopi/files/:id            Lock · RefreshLock · Unlock · UnlockAndRelock · GetLock
//                                   (PutRelativeFile, RenameFile → 501)
//
// Dazu `uebernimm`: der Arbeitsstand einer Editor-Sitzung wird eine Artikelfassung, geprüft gegen
// die SITZUNGSBASIS (`entscheideUebernahme`), nicht gegen die Marke.
//
// WARUM RAHMENUNABHÄNGIG UND (NOCH) NICHT IN `routes/`: Die Integrationsprobe
// (`tests/office-wopi-code/code-probe.integration.test.ts`) fährt GENAU diese Funktion hinter einem
// schlichten `node:http`-Server gegen einen echten Collabora-Editor. Die Verdrahtung in Fastify
// (Umsetzungsschritt U2) ruft dieselbe Funktion; sie bekommt dort zusätzlich die Protokoll-
// schwärzung von `access_token` und die CSP-Erweiterung. Eine Route hier ohne beides wäre ein
// halber Produktweg — deshalb steht sie nicht im Routenverzeichnis.
//
// GRENZEN, ausdrücklich:
//   · Die Sitzungen liegen im Arbeitsspeicher EINES Prozesses (`SpeicherWopiSitzungen`). Mehrere
//     App-Prozesse brauchen die Postgres-Ablage aus U2.
//   · Die Übernahme ruft `WopiArtikelZugriff.uebernimm` — Anhangstausch UND neue Fassung in einem
//     bedingten Schritt. Am Wissensobjektdienst gibt es diese Methode noch nicht (Plan U3); die
//     Probe setzt eine Attrappe mit demselben Vertrag ein.

import { type ObjectStore, decodeDataUrl } from "../../object-store";
import {
  type OfficeRechte,
  type SperrAnfrage,
  type Sperre,
  checkFileInfo,
  entscheidePutFile,
  entscheideSitzungsbeginn,
  entscheideUebernahme,
  officeFormatFuer,
  officeSchreibweg,
  pruefeZugangsmarke,
  wendeSperreAn,
} from "./office-wopi";

/** Ein Anhang, wie der Host ihn braucht — die Felder stammen aus `KoAttachment`. */
export interface WopiAnhang {
  readonly id: string;
  readonly name: string;
  readonly mime: string;
  readonly objectId?: string;
  /**
   * Die SPEICHERGRÖSSE nach der Konvention des Objektspeichers: die Länge der Daten-URL
   * (`ObjectStore.put`, `size = input.data.length`), wie `ko-routes.ts` sie in den Anhang übernimmt.
   * Sie ist NICHT die Dateigröße in Bytes und wird für WOPI nie gelesen — CheckFileInfo misst die
   * Bytes, die GetFile ausliefert (bens Befund, Nacharbeit 2).
   */
  readonly size?: number;
}

/** Der Teil eines Wissensobjekts, den der Host liest. */
export interface WopiArtikel {
  readonly koId: string;
  readonly version: number;
  readonly status: string;
  readonly author: string;
  readonly attachments: readonly WopiAnhang[];
}

export interface WopiArtikelZugriff {
  lies(koId: string): Promise<WopiArtikel | undefined>;
  /**
   * Setzt das Objekt an den Anhang UND erhöht die Fassung — in einem bedingten Schritt gegen
   * `expectedVersion`. Ist die Fassung inzwischen eine andere, wirft er einen Fehler mit
   * `code: "KO_STALE"` (derselbe Code wie `KnowledgeObjectService.revise`).
   */
  uebernimm(args: {
    koId: string;
    anhangId: string;
    objectId: string;
    /** Speichergröße des neuen Objekts (`ObjectRef.size`), dieselbe Konvention wie `WopiAnhang.size`. */
    size: number;
    expectedVersion: number;
    nutzerId: string;
  }): Promise<{ version: number }>;
}

/** Die Editor-Sitzung EINES Anhangs. Es gibt höchstens eine je Anhang. */
export interface EditorSitzung {
  readonly sperre: Sperre;
  /** Gegen diese Fassung prüft die nächste Übernahme. Nur eigene Übernahmen ziehen sie nach. */
  readonly basisFassung: number;
  /**
   * Das zuletzt per PutFile angenommene Objekt; `undefined`, solange nichts gespeichert ist.
   * `speichergroesse` ist `ObjectRef.size` (Länge der Daten-URL) — sie geht bei der Übernahme in den
   * Anhang, damit dort dieselbe Konvention gilt wie bei jedem anderen Klarwerk-Anhang.
   */
  readonly arbeitsstand?: { readonly objectId: string; readonly speichergroesse: number };
}

export interface WopiSitzungsablage {
  lies(anhangId: string): Promise<EditorSitzung | undefined>;
  schreibe(anhangId: string, sitzung: EditorSitzung | undefined): Promise<void>;
}

export class SpeicherWopiSitzungen implements WopiSitzungsablage {
  private readonly sitzungen = new Map<string, EditorSitzung>();

  async lies(anhangId: string): Promise<EditorSitzung | undefined> {
    return this.sitzungen.get(anhangId);
  }

  async schreibe(anhangId: string, sitzung: EditorSitzung | undefined): Promise<void> {
    if (sitzung === undefined) {
      this.sitzungen.delete(anhangId);
    } else {
      this.sitzungen.set(anhangId, sitzung);
    }
  }
}

/** Was der Host über sich mitteilt — OHNE Marke, Inhalt oder Kopfzeilen. */
export interface WopiProtokolleintrag {
  readonly vorgang: string;
  readonly anhangId: string;
  readonly status: number;
  readonly objectId?: string;
}

export interface WopiHostDeps {
  /** Serverschlüssel der Zugangsmarke (mindestens 32 Byte). */
  readonly schluessel: Buffer;
  readonly jetzt: () => number;
  readonly objekte: ObjectStore;
  readonly artikel: WopiArtikelZugriff;
  /** Die drei Rechte, frisch aus dem Bestand — bei JEDER Anfrage gerufen. */
  readonly rechte: (nutzerId: string, artikel: WopiArtikel) => Promise<OfficeRechte>;
  readonly nutzerName: (nutzerId: string) => Promise<string>;
  readonly sitzungen: WopiSitzungsablage;
  /** Herkunft der einbettenden Klarwerk-Seite (CheckFileInfo `PostMessageOrigin`). */
  readonly postMessageOrigin?: string;
  readonly protokoll?: (eintrag: WopiProtokolleintrag) => void;
}

export interface WopiAnfrage {
  readonly methode: string;
  /** Pfad OHNE Abfrageteil, z. B. `/wopi/files/anh-1/contents`. */
  readonly pfad: string;
  readonly accessToken: string | undefined;
  /** Kopfzeile nach Namen (Groß-/Kleinschreibung egal). */
  readonly kopf: (name: string) => string | undefined;
  readonly koerper: Buffer;
}

export interface WopiAntwort {
  readonly status: number;
  readonly kopf: Readonly<Record<string, string>>;
  readonly json?: unknown;
  readonly bytes?: Buffer;
}

export type UebernahmeErgebnis =
  | { readonly art: "uebernommen"; readonly version: number }
  | { readonly art: "ohne-sitzung" }
  | { readonly art: "ohne-arbeitsstand" }
  | { readonly art: "nicht-erlaubt" }
  | {
      readonly art: "fremde-aenderung";
      readonly basisFassung: number;
      readonly artikelFassung: number;
    };

const PFAD = /^\/wopi\/files\/([A-Za-z0-9_-]{1,128})(\/contents)?$/;

function antwort(status: number, kopf: Record<string, string> = {}): WopiAntwort {
  return { status, kopf };
}

function sperreWirkt(sitzung: EditorSitzung | undefined, jetzt: number): boolean {
  return sitzung !== undefined && sitzung.sperre.bis > jetzt;
}

export function erstelleWopiHost(deps: WopiHostDeps): {
  bearbeite(anfrage: WopiAnfrage): Promise<WopiAntwort>;
  uebernimm(anhangId: string, koId: string, nutzerId: string): Promise<UebernahmeErgebnis>;
} {
  // Alle Vorgänge an EINEM Anhang laufen nacheinander: Sperre, Speichern und Übernahme lesen und
  // schreiben dieselbe Sitzung, und zwei ineinander verschränkte Vorgänge verlören einen Stand.
  const ketten = new Map<string, Promise<unknown>>();
  function seriell<T>(anhangId: string, vorgang: () => Promise<T>): Promise<T> {
    const vorher = ketten.get(anhangId) ?? Promise.resolve();
    const lauf = vorher.then(vorgang, vorgang);
    const ende = lauf.catch(() => undefined);
    ketten.set(anhangId, ende);
    void ende.then(() => {
      if (ketten.get(anhangId) === ende) {
        ketten.delete(anhangId);
      }
    });
    return lauf;
  }

  async function lieseObjekt(objectId: string): Promise<Buffer | undefined> {
    const gespeichert = await deps.objekte.read(objectId);
    return gespeichert ? decodeDataUrl(gespeichert.data)?.bytes : undefined;
  }

  async function bearbeiteSeriell(
    anfrage: WopiAnfrage,
    anhangId: string,
    inhalt: boolean,
  ): Promise<{ antwort: WopiAntwort; vorgang: string; objectId?: string }> {
    const jetzt = deps.jetzt();
    const markeRoh = anfrage.accessToken ?? "";
    const pruefung = pruefeZugangsmarke(markeRoh, anhangId, deps.schluessel, jetzt);
    if (!pruefung.gueltig) {
      return { antwort: antwort(401), vorgang: "Marke" };
    }
    const marke = pruefung.inhalt;
    const artikel = await deps.artikel.lies(marke.koId);
    const anhang = artikel?.attachments.find((a) => a.id === anhangId);
    const format = anhang ? officeFormatFuer(anhang.name, anhang.mime) : undefined;
    if (!artikel || !anhang?.objectId || !format) {
      return { antwort: antwort(404), vorgang: "Datei" };
    }
    const weg = officeSchreibweg(await deps.rechte(marke.nutzerId, artikel), artikel, format);
    if (weg === "kein-zugang") {
      return { antwort: antwort(404), vorgang: "Datei" };
    }
    // Die Marke sagt, was beim Öffnen galt; die Rechte sagen, was JETZT gilt. Geschrieben wird nur,
    // wenn beide es erlauben — ein entzogenes Recht wirkt ab dieser Anfrage.
    const schreiben = marke.schreiben && weg === "direkt";
    const sitzung = await deps.sitzungen.lies(anhangId);
    const laufend = sperreWirkt(sitzung, jetzt) ? sitzung : undefined;
    // Welches Objekt der Editor gerade sieht: der Arbeitsstand der Sitzung, sonst der Anhang.
    const aktuellesObjekt = { objectId: laufend?.arbeitsstand?.objectId ?? anhang.objectId };

    if (anfrage.methode === "GET" && !inhalt) {
      // WOPI verlangt `Size` in Bytes der Datei. Gemessen wird deshalb an GENAU den Bytes, die
      // GetFile ausliefert — nicht an `anhang.size`: das ist die Länge der Daten-URL (Konvention des
      // Objektspeichers) und fehlt bei Altbestand ganz (bens Befund, Nacharbeit 2).
      const bytes = await lieseObjekt(aktuellesObjekt.objectId);
      if (!bytes) {
        return { antwort: antwort(404), vorgang: "CheckFileInfo" };
      }
      const info = checkFileInfo({
        anhang: { name: anhang.name, objectId: aktuellesObjekt.objectId, size: bytes.length },
        artikel: { author: artikel.author, version: artikel.version },
        nutzer: { id: marke.nutzerId, name: await deps.nutzerName(marke.nutzerId) },
        schreiben,
        ...(deps.postMessageOrigin === undefined
          ? {}
          : { postMessageOrigin: deps.postMessageOrigin }),
      });
      return { antwort: { status: 200, kopf: {}, json: info }, vorgang: "CheckFileInfo" };
    }

    if (anfrage.methode === "GET" && inhalt) {
      const bytes = await lieseObjekt(aktuellesObjekt.objectId);
      if (!bytes) {
        return { antwort: antwort(404), vorgang: "GetFile" };
      }
      return {
        antwort: {
          status: 200,
          kopf: { "X-WOPI-ItemVersion": `${artikel.version}-${aktuellesObjekt.objectId}` },
          bytes,
        },
        vorgang: "GetFile",
        objectId: aktuellesObjekt.objectId,
      };
    }

    if (anfrage.methode === "POST" && inhalt) {
      const entscheidung = entscheidePutFile({
        marke: { ...marke, schreiben },
        sperre: laufend?.sperre,
        xWopiLock: anfrage.kopf("X-WOPI-Lock"),
        groesse: anfrage.koerper.length,
        mime: anhang.mime,
        jetzt,
      });
      if (entscheidung.status !== 200 || !laufend) {
        const kopf: Record<string, string> =
          entscheidung.status === 409 ? { "X-WOPI-Lock": entscheidung.xWopiLock } : {};
        return { antwort: antwort(entscheidung.status, kopf), vorgang: "PutFile" };
      }
      const ref = await deps.objekte.put({
        name: anhang.name,
        mime: anhang.mime,
        data: `data:${anhang.mime};base64,${anfrage.koerper.toString("base64")}`,
        purpose: "attachment",
        owner: marke.nutzerId,
      });
      await deps.sitzungen.schreibe(anhangId, {
        ...laufend,
        arbeitsstand: { objectId: ref.id, speichergroesse: ref.size },
      });
      return {
        antwort: {
          status: 200,
          kopf: { "X-WOPI-ItemVersion": `${artikel.version}-${ref.id}` },
          json: {},
        },
        vorgang: "PutFile",
        objectId: ref.id,
      };
    }

    if (anfrage.methode === "POST" && !inhalt) {
      const override = (anfrage.kopf("X-WOPI-Override") ?? "").toUpperCase();
      const lock = anfrage.kopf("X-WOPI-Lock") ?? "";
      const alterLock = anfrage.kopf("X-WOPI-OldLock");
      let sperrAnfrage: SperrAnfrage;
      if (override === "LOCK" && alterLock !== undefined) {
        sperrAnfrage = { art: "UNLOCK_AND_RELOCK", lock, alterLock };
      } else if (override === "LOCK" || override === "UNLOCK" || override === "REFRESH_LOCK") {
        sperrAnfrage = { art: override, lock };
      } else if (override === "GET_LOCK") {
        sperrAnfrage = { art: "GET_LOCK" };
      } else {
        return { antwort: antwort(501), vorgang: override || "POST" };
      }
      const sperrt = sperrAnfrage.art !== "UNLOCK" && sperrAnfrage.art !== "GET_LOCK";
      if (sperrt && !schreiben) {
        return { antwort: antwort(401), vorgang: sperrAnfrage.art };
      }
      // Eine NEUE Sitzung beginnt nur auf der Fassung, die die Marke geöffnet hat — und nur, wenn
      // das die aktuelle ist. Wer einer laufenden Sitzung beitritt, ändert ihre Basis nicht.
      let basisFassung = laufend?.basisFassung;
      if (sperrAnfrage.art === "LOCK" && !laufend) {
        const beginn = entscheideSitzungsbeginn(marke.fassung, artikel.version);
        if (!beginn.erlaubt) {
          return {
            antwort: antwort(409, {
              "X-WOPI-Lock": "",
              // Nur ASCII: Kopfzeilen tragen kein verlässliches Unicode.
              "X-WOPI-LockFailureReason": `Artikel steht inzwischen auf Fassung ${artikel.version}; neu laden.`,
            }),
            vorgang: "LOCK",
          };
        }
        basisFassung = beginn.basisFassung;
      }
      const ergebnis = wendeSperreAn(laufend?.sperre, sperrAnfrage, jetzt);
      // ENDE DER SITZUNG: ein noch nicht übernommener Arbeitsstand wird jetzt übernommen (Plan 5.1).
      // Scheitert das an einer fremden Änderung, bleibt das Objekt im Speicher; das Protokoll nennt
      // es, damit die Fläche es als Vorschlag anbieten kann (U3). Der Editor bekommt trotzdem 200 —
      // das Entsperren selbst ist gelungen, und WOPI kennt keinen Weg, ihm den Konflikt zu zeigen.
      if (ergebnis.status === 200 && sperrAnfrage.art === "UNLOCK" && laufend?.arbeitsstand) {
        const uebernahme = await uebernimmIntern(
          deps,
          anhangId,
          marke.koId,
          marke.nutzerId,
          laufend,
        );
        deps.protokoll?.({
          vorgang: `Uebernahme beim Ende: ${uebernahme.art}`,
          anhangId,
          status: uebernahme.art === "uebernommen" ? 200 : 409,
          objectId: laufend.arbeitsstand.objectId,
        });
      }
      if (ergebnis.status === 200 && sperrAnfrage.art !== "GET_LOCK") {
        await deps.sitzungen.schreibe(
          anhangId,
          ergebnis.sperre === undefined || basisFassung === undefined
            ? undefined
            : {
                sperre: ergebnis.sperre,
                basisFassung,
                ...(laufend?.arbeitsstand ? { arbeitsstand: laufend.arbeitsstand } : {}),
              },
        );
      }
      const kopf: Record<string, string> =
        ergebnis.xWopiLock === undefined ? {} : { "X-WOPI-Lock": ergebnis.xWopiLock };
      return { antwort: antwort(ergebnis.status, kopf), vorgang: sperrAnfrage.art };
    }

    return { antwort: antwort(501), vorgang: anfrage.methode };
  }

  return {
    async bearbeite(anfrage) {
      const treffer = PFAD.exec(anfrage.pfad);
      if (!treffer) {
        return antwort(404);
      }
      const anhangId = treffer[1] as string;
      const inhalt = treffer[2] !== undefined;
      const {
        antwort: ergebnis,
        vorgang,
        objectId,
      } = await seriell(anhangId, () => bearbeiteSeriell(anfrage, anhangId, inhalt));
      deps.protokoll?.({
        vorgang,
        anhangId,
        status: ergebnis.status,
        ...(objectId === undefined ? {} : { objectId }),
      });
      return ergebnis;
    },

    uebernimm(anhangId, koId, nutzerId) {
      return seriell(anhangId, async () => {
        const sitzung = await deps.sitzungen.lies(anhangId);
        const laufend = sperreWirkt(sitzung, deps.jetzt()) ? sitzung : undefined;
        const ergebnis = await uebernimmIntern(deps, anhangId, koId, nutzerId, laufend);
        if (ergebnis.art === "uebernommen" && laufend) {
          // Die EIGENE Übernahme wird die neue Basis; der Arbeitsstand ist jetzt der Anhang selbst.
          await deps.sitzungen.schreibe(anhangId, {
            sperre: laufend.sperre,
            basisFassung: ergebnis.version,
          });
        }
        return ergebnis;
      });
    },
  };
}

/**
 * Der Kern der Übernahme, OHNE eigene Serialisierung — die Aufrufer stehen schon in `seriell`
 * (die Übernahme beim Entsperren läuft innerhalb von `bearbeiteSeriell`).
 */
async function uebernimmIntern(
  deps: WopiHostDeps,
  anhangId: string,
  koId: string,
  nutzerId: string,
  laufend: EditorSitzung | undefined,
): Promise<UebernahmeErgebnis> {
  const artikel = await deps.artikel.lies(koId);
  const anhang = artikel?.attachments.find((a) => a.id === anhangId);
  const format = anhang ? officeFormatFuer(anhang.name, anhang.mime) : undefined;
  if (!artikel || !format) {
    return { art: "nicht-erlaubt" };
  }
  const weg = officeSchreibweg(await deps.rechte(nutzerId, artikel), artikel, format);
  if (weg !== "direkt") {
    return { art: "nicht-erlaubt" };
  }
  const entscheidung = entscheideUebernahme({
    basisFassung: laufend?.basisFassung,
    artikelFassung: artikel.version,
    hatArbeitsstand: laufend?.arbeitsstand !== undefined,
  });
  if (entscheidung.art !== "uebernehmen") {
    return entscheidung;
  }
  const arbeitsstand = laufend?.arbeitsstand;
  if (!arbeitsstand) {
    return { art: "ohne-arbeitsstand" };
  }
  try {
    const { version } = await deps.artikel.uebernimm({
      koId,
      anhangId,
      objectId: arbeitsstand.objectId,
      size: arbeitsstand.speichergroesse,
      expectedVersion: entscheidung.expectedVersion,
      nutzerId,
    });
    return { art: "uebernommen", version };
  } catch (fehler) {
    const code =
      fehler && typeof fehler === "object" && "code" in fehler
        ? String((fehler as { code: unknown }).code)
        : "";
    if (code !== "KO_STALE") {
      throw fehler;
    }
    // Zwischen Prüfung und CAS hat jemand außerhalb der Sitzung geschrieben.
    const neu = await deps.artikel.lies(koId);
    return {
      art: "fremde-aenderung",
      basisFassung: entscheidung.expectedVersion,
      artikelFassung: neu?.version ?? entscheidung.expectedVersion,
    };
  }
}
