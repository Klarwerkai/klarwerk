# Weitergeleitete Wissens-E-Mails

Der technische Eingang `POST /api/eingang/email` nimmt eine dekodierte weitergeleitete Nachricht
als **privaten Entwurf** in den vorhandenen Erfassen-Weg auf. Die zuständige Person öffnet ihn
in ihrer bestehenden Entwurfsliste. Wissensart, Kategorie und Vertraulichkeit wählt sie selbst;
Einreichen und fachliche Validierung folgen den bestehenden Regeln. Die Mail erzeugt keine
fachliche Freigabe, keine automatische Veröffentlichung und keine Poolfreigabe.

## Bindung an die Organisation

Eine Firma je Instanz bleibt bestehen (`APP_BASE_URL` und die vorhandene Instanzbindung).
`KLARWERK_EMAIL_EINGANG` enthält ein JSON-Objekt, zum Beispiel ausschließlich mit fiktiven Werten:

```json
{
  "adresse": "wissen@firma.example",
  "anlage": "wissen.firma.example",
  "dienstId": "mailadapter",
  "eigentuemerId": "bestehende-nutzer-id"
}
```

`anlage` muss exakt dem Host von `APP_BASE_URL` entsprechen. Der SMTP-Envelope-Empfänger muss
der konfigurierten Adresse entsprechen (Groß-/Kleinschreibung wird vereinheitlicht). Kein
Nachrichtenfeld kann Firma, Eigentümer oder Rechte ändern. Der Eigentümer ist ein bestehendes,
freigegebenes, nicht abgelaufenes Konto mit `ko.create`; das wird bei jeder Zustellung neu geprüft.
Er erhält den privaten Entwurf zur Sichtung. Der tatsächlich liefernde Dienst steht im Audit.

Der vorhandene Dienstschlüsselweg (`KLARWERK_SERVICE_KEYS`, Kopf
`x-klarwerk-service-key`) braucht das gezielte Recht **`mail.entwurf`** und die konfigurierte
`dienstId`. Vorhandene Dienstbremse, Schlüsselsperre und Schlüsselwechsel gelten unverändert.
`import.kandidaten`, Add-in-Zugang und Personenanmeldung öffnen diese Route nicht. Konfiguration
fehlt oder passt nicht: Eingang geschlossen. Hier wurden keine Betriebszugänge angelegt.

## Vertrag zum externen Mailadapter

```json
{
  "recipient": "wissen@firma.example",
  "messageId": "<weiterleitung-4711@firma.example>",
  "from": "Kollegin <kollegin@firma.example>",
  "subject": "WG: Erfahrung mit einer Pumpe",
  "sentAt": "2026-10-20T14:00:00Z",
  "text": "Vor der Wartung den Druck ablassen.",
  "attachments": []
}
```

Der Adapter liefert den wirklichen Envelope-Empfänger, die stabile Message-ID der zugestellten
Weiterleitung und vollständig dekodierten Klartext. `from` und `sentAt` sind unbestätigte
Nachrichtenkopfzeilen; aus ihnen wird weder ein Nutzerkonto noch ein Leserecht abgeleitet.
Der weitergeleitete Originaltext bleibt im Rumpf, einschließlich dort genannter früherer Autoren.
Die Anwendung ruft keine Adresse ab und führt keine Inhalte aus.

Grenzen: 1 MiB HTTP-Rumpf, 100.000 Zeichen Klartext, Betreff/Absender je 200 Zeichen,
Message-ID 180 Zeichen. Ein Datum mit Zeitzone und nichtleere Felder sind erforderlich.
Anhänge werden mit `422 EMAIL_ANHAENGE` abgewiesen; reine HTML-Nachrichten, zusätzliche Felder,
Steuerzeichen in Kopfzeilen und ungültige Inhalte mit 400. Kein Inhalt wird still abgeschnitten.
Ein externer Adapter darf Anhänge nicht entfernen, um eine eigentlich abgewiesene Nachricht als
vollständig angenommen auszugeben. MIME-Dekodierung und Behandlung solcher Zustellfehler liegen
an der noch einzurichtenden externen Mailanbindung.

## Herkunft und Wiederholung

Der vorhandene ObjectStore sichert den vollständigen akzeptierten **dekodierten JSON-Inhalt**
als `weitergeleitete-email.json`, mit Eigentümer, Entwurfsbezug und normalem Ankerlebenszyklus.
Das ist kein archiviertes RFC-822-/MIME-Original. Die bestehende Quellen-Warteliste bindet dieses
Objekt; die normalen Anker-, Rechte- und Einreichprüfungen bleiben wirksam. Quelle und Rumpf
benennen Message-ID und SHA256 dieser Nachrichtenfassung. Der Hash bestätigt keine Absenderidentität
und keine fachliche Richtigkeit. Nach menschlichem Einreichen bleibt `peerValidated: false`.

Erste vollständige Aufnahme: 201 mit `{ "entwurfId": "…", "neu": true }`. Wiederholung derselben
Fassung: 200, `neu: false`. Dieselbe Message-ID mit anderem Inhalt: 409. Der bestehende atomare
Entwurfs-Vorgangsweg schützt parallele Eingänge. Ein inhaltfreier Annahmebeleg im bestehenden Audit
verhindert Wiederanlage auch nach Verbrauch/Löschung des Entwurfs. Ein solcher 200-Beleg bestätigt
die frühere Annahme, nicht die heutige Existenz oder einen Prüfstatus des Entwurfs.

Ein Speicherfehler bleibt 500/503; kein Annahmeerfolg vor gesicherter Originalbindung und
Auditbeleg. Wiederholung vervollständigt fehlende Schritte. Bei ungewissem Schreibausgang bleiben
Originalobjekte erhalten; mögliche unreferenzierte Uploads folgen dem vorhandenen Aufräumweg.
Fehlende Originale blockiert weiterhin die bestehende Ankerprüfung.

## Liefergrenze und Originalvertrag

Dieser Schnitt richtet keine erreichbare E-Mail-Adresse, Mailbox, Weiterleitungsregel, DNS-/MX-
Einträge oder Anbieter-Webhooks ein. Für einen realen Eingang fehlen die konkrete externe
Adress-/Gatewaykonfiguration, dessen berechtigter Zugang, MIME-zu-JSON-Zuordnung und ein belegter
Zustellversuch. Kein echter Versand oder fremdes Postfach wurde verwendet.

Original: `aufnahme:20260922:gesamt-email-eingang`, Revision 2, R-1652. Die historische Roadmap
nennt `wissen@klarwerk.firma.de`; die konkrete Betriebsadresse wird instanzgebunden konfiguriert.
R-2193 und frühere Empfehlungen hielten Mail außerhalb v1. Der konkrete Auftrag vom 20.10.2026
beauftragt diesen technischen Anschluss; andere dort genannte Ausbauvorhaben bleiben gesondert.
Die Quellenakte ist kein Produktpfad und kein Abschlussbeleg. Der unveränderte Vollvertrag samt
History und die aufgelösten Quellen liegen im zugeordneten L-Übergabepaket. Eine unabhängige Prüfung,
Integration, Veröffentlichung und ein Originalgesamtabschluss sind durch diese Implementierung
noch nicht nachgewiesen. Es gibt keine neue Hauptnavigation oder zweite Wissensablage.
