import type { Role } from "../../auth";

// Rechtematrix (Pflichtenheft §3.2 / Technischer Anhang §4). rbac baut auf dem
// Rollenmodell des auth-Moduls auf (Import nur über dessen öffentliche index.ts).
export type Permission =
  | "ko.read"
  | "ko.create"
  | "ko.validate"
  | "ko.assign"
  | "conflict.resolve"
  | "users.manage";

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  viewer: ["ko.read"],
  experte: ["ko.read", "ko.create"],
  controller: ["ko.read", "ko.create", "ko.validate", "ko.assign", "conflict.resolve"],
  admin: ["ko.read", "ko.create", "ko.validate", "ko.assign", "conflict.resolve", "users.manage"],
};

// FR-RBAC-01: Aktionen exakt gemäß Matrix.
//
// ================================================================================================
// JOB 4015 — EIN ROLLENNAME AUSSERHALB DER MATRIX SPERRT. DIE RICHTUNG IST GEWÄHLT, NICHT ZUFÄLLIG.
// ================================================================================================
//
// `ROLE_PERMISSIONS[role]` war bis hierher ein ungeprüfter Griff in die Tabelle. `Role` ist eine
// Union über vier Namen, aber der Wert kommt nicht aus dem Code, sondern aus der ABLAGE (Altbestand,
// Migration, von Hand gesetzte Zeile) — und für einen fünften Namen ist der Eintrag `undefined`,
// worauf `.includes` einen TypeError WIRFT. Der Wurf geschieht innerhalb von `requirePermission`
// (`services/app/src/http.ts:194`) und läuft deshalb nicht durch `sendError`, sondern über Fastifys
// Standardweg: der Aufrufer bekam 500 statt der Sperre.
//
// DIE RICHTUNG IST „IM ZWEIFEL NEIN" — dieselbe, die `build-app.ts:529-536` für eine fremde
// Objektkennung ausschreibt. Sie ist nicht symmetrisch: ein falsch-negatives Nein kostet eine
// Abweisung, die ein Mensch sieht und melden kann; ein falsch-positives Ja öffnet eine Tür, die
// niemand sieht. Und ein Tor, das WIRFT statt zu entscheiden, ist an jeder Stelle, an der jemand
// den Wurf fängt und weiterläuft, überhaupt keine Sperre mehr.
//
// RUNDE 2 — WARUM HIER `Object.hasOwn` STEHT UND NICHT `?? []`.
// Runde 1 schrieb `(ROLE_PERMISSIONS[role] ?? []).includes(permission)`. Das deckte „gast" ab und
// liess eine ganze Namensklasse offen, gemessen vom Prüfer am Draht:
//   gespeicherte Rolle „constructor" → GET /api/kos → 500
//   {"statusCode":500,"error":"Internal Server Error",
//    "message":"(ROLE_PERMISSIONS[role] ?? []).includes is not a function"}
// Der Grund ist die Prototypenkette: dieses Objektliteral erbt von `Object.prototype`, also ist
// `ROLE_PERMISSIONS["constructor"]` nicht `undefined`, sondern die geerbte Funktion `Object` —
// `??` springt nur bei `null`/`undefined` ein und greift daneben. Dasselbe gilt für `toString`,
// `valueOf`, `hasOwnProperty` und für `__proto__`, das über einen Getter das Prototyp-Objekt
// liefert. Der TypeError stand damit wieder da, wo er vorher stand.
//
// `Object.hasOwn` fragt nach dem EIGENEN Eintrag und kennt die geerbten Namen deshalb gar nicht
// erst. Es ist nicht die zweite Abfangstelle hinter der ersten, sondern die einzige: der
// Tabellengriff darunter läuft nur noch für die vier Namen, die oben wirklich stehen. Jeder andere
// Wert — und er kann nur aus der ABLAGE stammen, nicht aus dem Produkt — endet im `false`.
//
// KEIN NEUER ROLLENNAME UND KEIN NEUES RECHT: die Matrix oben bleibt Zeichen für Zeichen dieselbe.
// Ein unbekannter Name bekommt keine eigene Zeile, sondern gar keine.
export function can(role: Role, permission: Permission): boolean {
  if (!Object.hasOwn(ROLE_PERMISSIONS, role)) {
    return false;
  }
  return ROLE_PERMISSIONS[role].includes(permission);
}

// FR-RBAC-02: nur Admin verwaltet Nutzer.
//
// JOB 4015: Der Schutz gegen unbekannte Rollennamen steht NICHT ein zweites Mal hier, sondern wirkt
// durch `can` hindurch — diese Funktion und `canChangeRole` darunter fragen ausschliesslich über
// `can` in die Matrix. Eine eigene Prüfung an dieser Stelle wäre eine zweite Wahrheit darüber, was
// ein unbekannter Name darf, und die zweite ist die, die eines Tages auseinanderläuft. Gemessen
// wird der Durchgriff trotzdem EINZELN (`tests/beta-rollenabnahme/unbekannte-rolle-sperrt.test.ts`,
// R2 und R3): dass er heute delegiert, ist eine Bauweise und keine Zusicherung.
export function canManageUsers(role: Role): boolean {
  return can(role, "users.manage");
}

// FR-RBAC-03: Admin kann sich nicht selbst die Admin-Rolle entziehen.
export function canChangeRole(
  actor: { id: string; role: Role },
  targetUserId: string,
  newRole: Role,
): boolean {
  if (!canManageUsers(actor.role)) {
    return false;
  }
  if (actor.id === targetUserId && newRole !== "admin") {
    return false;
  }
  return true;
}
