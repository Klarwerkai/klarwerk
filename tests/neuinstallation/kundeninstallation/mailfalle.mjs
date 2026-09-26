// Die Mailfalle der Kundeninstallations-Strecke: ein SMTP-Empfaenger, der NICHTS weiterleitet.
//
// Er laeuft als eigener Container im Compose-Netz der Pruefinstanz (Netzname `mailfalle`) und nimmt
// jede Nachricht an, die die Anwendung ueber ihren normalen SMTP-Weg (`SMTP_HOST`) verschickt. Jede
// empfangene Nachricht geht als EINE JSON-Zeile auf stdout — gelesen wird sie ueber `docker logs`.
// Damit laesst sich messen, auf welche Adresse der Kennwort-Link einer Instanz zeigt, ohne dass
// irgendeine echte Mail das Haus verlaesst.
//
// Absichtlich ohne Abhaengigkeiten: das Skript laeuft im Grundabbild `node:20-bookworm-slim`, das der
// Produktbau ohnehin zieht.
import { createServer } from "node:net";

const PORT = Number(process.env.MAILFALLE_PORT ?? 2525);

createServer((sock) => {
  let puffer = "";
  let imRumpf = false;
  let rumpf = [];
  let umschlag = { von: "", an: [] };
  const antworte = (zeile) => sock.write(`${zeile}\r\n`);
  antworte("220 mailfalle ESMTP");
  sock.on("data", (stueck) => {
    puffer += stueck.toString("latin1");
    for (;;) {
      const ende = puffer.indexOf("\r\n");
      if (ende < 0) {
        return;
      }
      const zeile = puffer.slice(0, ende);
      puffer = puffer.slice(ende + 2);
      if (imRumpf) {
        if (zeile === ".") {
          imRumpf = false;
          const roh = Buffer.from(rumpf.join("\r\n"), "latin1").toString("base64");
          process.stdout.write(`${JSON.stringify({ mailfalle: 1, ...umschlag, roh })}\n`);
          rumpf = [];
          umschlag = { von: "", an: [] };
          antworte("250 angenommen");
        } else {
          rumpf.push(zeile.startsWith("..") ? zeile.slice(1) : zeile);
        }
        continue;
      }
      const befehl = zeile.slice(0, 4).toUpperCase();
      if (befehl === "EHLO") {
        antworte("250-mailfalle");
        antworte("250 8BITMIME");
      } else if (befehl === "HELO") {
        antworte("250 mailfalle");
      } else if (befehl === "MAIL") {
        umschlag.von = zeile.slice(10).trim();
        antworte("250 ok");
      } else if (befehl === "RCPT") {
        umschlag.an.push(zeile.slice(8).trim());
        antworte("250 ok");
      } else if (befehl === "DATA") {
        imRumpf = true;
        antworte("354 weiter");
      } else if (befehl === "QUIT") {
        antworte("221 tschuess");
        sock.end();
      } else {
        antworte("250 ok");
      }
    }
  });
  sock.on("error", () => undefined);
}).listen(PORT, "0.0.0.0", () => {
  process.stdout.write(`${JSON.stringify({ mailfalle: 1, bereit: PORT })}\n`);
});
