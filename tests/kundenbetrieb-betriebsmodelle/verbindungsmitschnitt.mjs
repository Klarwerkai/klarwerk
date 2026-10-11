// AW-12 / S07 — MITSCHNITT JEDER TCP-VERBINDUNG, DIE DER APP-PROZESS SELBST AUFBAUT.
//
// Wird dem Serverprozess mit `--import` vorgeladen. Jeder Aufruf von `net.Socket#connect` — darüber
// laufen `fetch` (undici), `pg`, SMTP und jeder andere Node-Client — schreibt eine Zeile
// `{"host","port","pfad","zeit"}` in die Datei aus `KLARWERK_S07_MITSCHNITT`. Die Verbindung selbst
// bleibt unverändert.
//
// GRENZE: Erfasst wird, was der Node-Prozess über `net` aufbaut. Namensauflösung (UDP) und
// Verbindungen anderer Prozesse sind nicht darin.
import { appendFileSync } from "node:fs";
import net from "node:net";

const ziel = process.env.KLARWERK_S07_MITSCHNITT;
if (ziel) {
  const original = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function mitgeschnitten(...args) {
    const erstes = args[0];
    let host = null;
    let port = null;
    let pfad = null;
    if (Array.isArray(erstes)) {
      const optionen = erstes[0] ?? {};
      host = optionen.host ?? null;
      port = optionen.port ?? null;
      pfad = optionen.path ?? null;
    } else if (erstes !== null && typeof erstes === "object") {
      host = erstes.host ?? null;
      port = erstes.port ?? null;
      pfad = erstes.path ?? null;
    } else if (typeof erstes === "number" || /^\d+$/.test(String(erstes))) {
      port = Number(erstes);
      host = typeof args[1] === "string" ? args[1] : null;
    } else if (typeof erstes === "string") {
      pfad = erstes;
    }
    try {
      const zeile = { host, port, pfad, zeit: new Date().toISOString() };
      appendFileSync(ziel, `${JSON.stringify(zeile)}\n`);
    } catch {
      // Der Mitschnitt darf die Verbindung nie verhindern.
    }
    return original.apply(this, args);
  };
}
