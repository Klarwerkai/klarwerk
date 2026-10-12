import type { AuthService } from "../../auth";
import type { Mailer, PushAboRepo, PushSender } from "../../notifications";
import type { SpaceLesbarQuelle } from "./http";
import { type SichtbarkeitsFakten, darfSehen } from "./sichtbarkeit";

// FR-VAL-07: Benachrichtigung bei Validierungs-Zuweisung. Orchestriert auth (E-Mail-Lookup)
// und den Mailer — App-Aufgabe, da modulübergreifend.
export type AssignmentNotifier = (koId: string, userIds: readonly string[]) => Promise<void>;

// R-0679 / R-2156: der zweite Versandweg außerhalb der Anwendung — Push auf die Geräte, die die
// Person selbst angemeldet hat. Austauschbar wie der Mailer: `sender` ist eine Schnittstelle, die
// Abos liegen in einer eigenen Ablage. Fehlt die Push-Konfiguration, wird nichts davon übergeben,
// und es bleibt bei E-Mail (bzw. dem Protokoll-Ersatz ohne Mailserver).
export interface PushZustellung {
  abos: PushAboRepo;
  sender: PushSender;
  /** Ein gescheiterter Push-Anstoß, ohne Inhalt und ohne Endpunkt (der trägt eine Gerätekennung). */
  fehler?: (art: "abgelehnt" | "ausfall") => void;
}

/**
 * aufnahme:20260922:gesamt-leserechte (R-0610, E-Mail-Nebenweg) — DIE NACHRICHT NENNT DAS OBJEKT,
 * ALSO GILT FÜR SIE DIE LESEPOLICY DES EMPFÄNGERS.
 *
 * Bis hierher ging die Zuweisungsmail mit der Objektkennung an jede genannte Person — eine
 * Zuweisung erteilt nach `darfSehen` aber weder Vertraulichkeits- noch Space-Leserecht. Ein
 * Prüfer ausserhalb des führenden Spaces erfuhr so per E-Mail, dass es das Objekt gibt.
 *
 * Jetzt wird je Empfänger die EINE Regel aus `sichtbarkeit.ts` gefragt — mit seiner Rolle, seiner
 * Kennung (Autorschaft) und seinen lesbaren Spaces, frisch je Versand. Beide Zugänge sind PFLICHT
 * (mega76 Block A): fehlt einer, ist er keine Funktion oder lässt sich das Objekt nicht auflösen,
 * geht keine objektbezogene Nachricht hinaus.
 */
export interface AssignmentNotifierSichtbarkeit {
  /** Das Objekt frisch gelesen — `undefined`, wenn es fehlt oder im Papierkorb liegt. */
  ko: (koId: string) => Promise<SichtbarkeitsFakten | undefined>;
  /** Die lesbaren Spaces eines Kontos — dieselbe Quelle wie `makeGuards`. */
  spaceLesbar: SpaceLesbarQuelle;
}

// Push geht wie die E-Mail NUR an Empfänger, die das Objekt nach `darfSehen` lesen dürfen — der
// Hinweis trägt zwar keinen Inhalt, sagt aber, DASS eine Prüfung anliegt.
export function makeAssignmentNotifier(
  auth: AuthService,
  mailer: Mailer,
  sichtbarkeit: AssignmentNotifierSichtbarkeit,
  push?: PushZustellung,
): AssignmentNotifier {
  return async (koId, userIds) => {
    if (userIds.length === 0) {
      return;
    }
    if (typeof sichtbarkeit?.ko !== "function" || typeof sichtbarkeit?.spaceLesbar !== "function") {
      return;
    }
    const ko = await sichtbarkeit.ko(koId);
    if (!ko) {
      return;
    }
    const users = await auth.listUsers();
    const byId = new Map(users.map((u) => [u.id, u]));
    for (const id of userIds) {
      const user = byId.get(id);
      if (!user) {
        continue;
      }
      const empfaenger = {
        id: user.id,
        role: user.role,
        spaceLesbar: await sichtbarkeit.spaceLesbar({ id: user.id, role: user.role }),
      };
      if (!darfSehen(empfaenger, ko)) {
        continue;
      }
      await mailer.send({
        to: user.email,
        subject: "KLARWERK: Wissensobjekt zur Validierung zugewiesen",
        text: `Hallo ${user.name},\n\ndir wurde ein Wissensobjekt (${koId}) zur Validierung zugewiesen.\nBitte prüfe es im Validierungs-Board.\n\n— KLARWERK`,
      });
      if (push) {
        await pushAnGeraete(push, id);
      }
    }
  };
}

// Der Push ist ein ZUSATZ zur E-Mail: scheitert er, ist die Zuweisung trotzdem zugestellt. Ein
// abgelaufenes Abo (404/410 vom Push-Dienst) wird entfernt, damit es nicht bei jeder Zuweisung
// erneut angefragt wird.
async function pushAnGeraete(push: PushZustellung, userId: string): Promise<void> {
  for (const abo of await push.abos.fuer(userId)) {
    try {
      const ergebnis = await push.sender.send(abo);
      if (ergebnis === "abgelaufen") {
        await push.abos.entfernen(abo.userId, abo.endpoint);
      } else if (ergebnis === "abgelehnt") {
        push.fehler?.("abgelehnt");
      }
    } catch {
      push.fehler?.("ausfall");
    }
  }
}
