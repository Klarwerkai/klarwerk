// ================================================================================================
// JOB 4076 — DER EINE FAHRSTAND FÜR DAS SEITENFENSTER IM OFFICE-DIALOG-FALL
// ================================================================================================
//
// Drei Prüfdateien (S5 Empfang, S6 ehrlicher Ausgang, S7 fallender Schlüssel) fahren DASSELBE
// ausgelieferte Aufgabenfenster (`apps/web/public/word-addin/taskpane.html`) mit DERSELBEN
// Ergänzung: einem Office-Dialog, der eine Nachricht schicken kann, und einem Mitschnitt der
// `Authorization`-Köpfe. Läge das dreimal da, könnten drei Dateien später still gegen verschieden
// gebaute Hosts messen — dieselbe Begründung, die `tests/app/klara-panel-fixture.ts` für sich
// selbst aufschreibt.
//
// KEIN ZWEITER PANEL-AUFBAU: das Fenster kommt aus jener Fixture, unverändert. Dieses Modul setzt
// nur zwei Dinge daneben, die sie nicht kennt (sie stammen aus diesem Auftrag): den `ui`-Teil des
// Office-Fakes und das Mitlesen der Kopfzeilen.
import { type KlaraPanel, createKlaraPanel } from "../app/klara-panel-fixture";

/** Eine Antwort, wie die Fixture sie erwartet. */
export interface FakeAntwort {
  status: number;
  body?: unknown;
}

/** Was ein Abruf an Sitzungsnachweis getragen hat — die Frage von S5/S7. */
export interface Kopfspur {
  url: string;
  methode: string;
  authorization: string | undefined;
  koerper: string | undefined;
}

export interface Dialoglauf {
  panel: KlaraPanel;
  /** Die Adressen, die als Office-Dialog geöffnet wurden — §8.7: es darf genau eine Stelle sein. */
  geoeffnet: string[];
  /** Wie oft der Dialog geschlossen wurde (der Erfolgsweg schliesst ihn). */
  geschlossen: () => number;
  /** Jeder Abruf mit seinem `Authorization`-Kopf, in Reihenfolge. */
  spur: Kopfspur[];
  /** Schickt eine Dialognachricht, wie der Office-Host es täte. `false` = kein Zuhörer da. */
  nachricht: (inhalt: string) => boolean;
  aufraeumen: () => void;
}

interface OfficeFake {
  EventType?: Record<string, string>;
  context: { ui?: unknown };
}

/**
 * Das Fenster laufen lassen — mit Office-Dialog, Kopf-Mitschnitt und steuerbaren Antworten.
 *
 * `routen` beantwortet Pfade per Präfix und bekommt den ECHTEN `init` des Abrufs; darüber liest
 * dieses Modul den `Authorization`-Kopf mit. Die Fixture selbst schreibt nur URL, Methode und
 * Rumpf mit (`panel.calls`) — sie bleibt deshalb unverändert, und der Kopf wird hier gemessen.
 */
export function fahreSeitenfenster(routen: Record<string, () => FakeAntwort>): Dialoglauf {
  const spur: Kopfspur[] = [];
  const geoeffnet: string[] = [];
  let geschlossen = 0;
  let zuhoerer: ((arg: { message: string }) => void) | null = null;

  const gebaut: Record<
    string,
    (url: string, init: Record<string, unknown> | undefined) => unknown
  > = {};
  // JEDER Abruf wird mitgeschrieben, nicht nur die genannten — sonst wäre „kein weiterer Abruf
  // trägt den alten Schlüssel" (S7) eine Aussage über eine Handvoll Pfade statt über den Verkehr
  // des Fensters. Die Fangrouten antworten 404: das ist die Lage, die das Fenster ohnehin kennt
  // (älterer Server), und sie erfindet keinen Zustand, den kein Fall gesetzt hat. Die fünf
  // Grundrouten der Fixture stehen hier als Funktion, weil ihre Objektform länger passt als `/api/`
  // und den Mitschnitt sonst umginge.
  const mitFang: Record<string, () => FakeAntwort> = {
    "/": () => ({ status: 404 }),
    "/api/": () => ({ status: 404 }),
    "/api/reasoner/status": () => ({ status: 404 }),
    "/api/kos/": () => ({ status: 404 }),
    "/api/drafts": () => ({ status: 404 }),
    "/api/ask": () => ({ status: 404 }),
    ...routen,
  };
  for (const [pfad, antwort] of Object.entries(mitFang)) {
    gebaut[pfad] = (url, init) => {
      const koepfe = (init?.headers ?? {}) as Record<string, string>;
      const auth = koepfe.authorization ?? koepfe.Authorization;
      spur.push({
        url,
        methode: typeof init?.method === "string" ? init.method : "GET",
        authorization: typeof auth === "string" ? auth : undefined,
        koerper: typeof init?.body === "string" ? init.body : undefined,
      });
      return antwort();
    };
  }

  const panel = createKlaraPanel({ routes: gebaut as never });

  // Der `ui`-Teil des Office-Fakes. Die Fixture kennt ihn nicht (sie braucht ihn für keinen
  // anderen Fall); ohne ihn fiele der Anmeldeknopf auf `window.open`, und das ist in jsdom nicht
  // implementiert — der Lauf endete dann bei „Popup blockiert" statt im Dialogweg.
  const office = (globalThis as unknown as { Office: OfficeFake }).Office;
  office.EventType = { DialogMessageReceived: "dialogMessageReceived" };
  office.context.ui = {
    displayDialogAsync: (
      url: string,
      _optionen: unknown,
      rueckruf: (r: { status: string; value: unknown }) => void,
    ): void => {
      geoeffnet.push(url);
      rueckruf({
        status: "succeeded",
        value: {
          addEventHandler: (typ: string, fn: (arg: { message: string }) => void): void => {
            if (typ === office.EventType?.DialogMessageReceived) {
              zuhoerer = fn;
            }
          },
          close: (): void => {
            geschlossen += 1;
          },
        },
      });
    },
  };

  return {
    panel,
    geoeffnet,
    geschlossen: () => geschlossen,
    spur,
    nachricht: (inhalt) => {
      if (zuhoerer === null) {
        return false;
      }
      zuhoerer({ message: inhalt });
      return true;
    },
    aufraeumen: () => {
      panel.restore();
    },
  };
}

/** Die Nachricht, die der Anmeldedialog (`anmeldung.html`) wirklich schickt. */
export function uebergabeNachricht(code: string): string {
  return JSON.stringify({ art: "kw-office-handover", code });
}

/** Den Anmeldeknopf wirklich drücken. */
export function anmeldenDruecken(lauf: Dialoglauf): void {
  const knopf = lauf.panel.q("#login-btn");
  if (knopf === null) {
    throw new Error("Seitenfenster: #login-btn existiert nicht");
  }
  knopf.click();
}
