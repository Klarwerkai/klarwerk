# Klara Browser B0 · 0.1.1

Paketordner: **`extensions/klara-browser/`** (der Ordner mit `manifest.json`). Direkt ladbare lokale Dateien, kein npm-Installieren, Bündeln oder Webserver nötig. Die JavaScript-Dateien werden mit TypeScript `strict` und `checkJs` geprüft. Nur `https://app.klarwerk.ai` ist als Klarwerk-Ziel zugelassen.

**Abnahmestand: TEILWEISE.** Paket-Skripte, DOM-Vorschau und echte lokale Auth-/Entwurfsrouten sind automatisiert geprüft. Tatsächliches Laden in Chrome und die Live-Rundwege auf Perplexity UND zwei technischen Webseiten mit einem freigegebenen Testkonto sind noch nicht abgenommen. Der reproduzierbare Startversuch `node tests/klara-browser/chrome-probe.cjs` scheitert in der Bahn vor dem Laden: `browserType.launchPersistentContext: Target page, context or browser has been closed`, `signal=SIGABRT`. Keine Live-Anlage durchgeführt. Die automatisierten Fälle verwenden synthetische Webseiten, keine besuchten Anbieterinhalte. Das [Konzept](KONZEPT.md) ordnet B0 und den späteren Rückweg ein.

## Installation und Bedienung · Deutsch

1. Chrome ab Version 120 öffnen, `chrome://extensions` aufrufen und den Entwicklermodus aktivieren.
2. **Entpackte Erweiterung laden** wählen und den oben genannten Paketordner auswählen. Angezeigte Version: **0.1.1**, Name: **Klara · Browser**. Unter „Fehler“ darf kein Ladefehler stehen. Erweiterung an die Symbolleiste anheften.
3. In einem normalen Chrome-Fenster eine HTTP(S)-Webseite öffnen, etwa eine Drucker- oder Schnittstellenanleitung; Perplexity ist ein weiteres Beispiel. Nur einen freigegebenen Testtext markieren. Rechtsklick → **In Klarwerk übernehmen**. Alternativ Erweiterungssymbol oder **Alt+Umschalt+K**; bei belegtem Kürzel unter `chrome://extensions/shortcuts` neu zuweisen.
4. Die Vorschau öffnet sich als eigener Erweiterungs-Tab. Die Markierung wird davor im ursprünglichen Tab gelesen. Volltext, Seitentitel, Quellenadresse und UTC-Erfassungszeit prüfen. Titel bearbeiten, optional Kontext ergänzen und Vertraulichkeit bewusst wählen oder erkennbar offen lassen.
5. Im Erweiterungs-Tab am bestehenden Klarwerk-Konto anmelden. Anmeldung und Vorschau erzeugen keinen Entwurf. Das Kontextmenü folgt der Chrome-Sprache; der Umschalter im Erweiterungs-Tab wechselt die Vorschau zwischen Deutsch und Englisch.
6. Bestätigungsfeld ankreuzen und **Bewusst als Entwurf speichern** drücken. Jede Änderung an Titel, Kontext oder Einstufung nimmt die Bestätigung zurück. Enter im Kontextfeld erzeugt einen Zeilenumbruch; Enter im Anmeldeformular meldet nur an.
7. Erst bei bestätigtem Erfolg **Entwurf in Klarwerk öffnen** verwenden. Gegebenenfalls im Web separat **mit demselben Konto** anmelden. Der Link lautet `/capture/frontdoor?draft=<Entwurfskennung>` und enthält kein Token. Keine automatische Veröffentlichung oder KI-Prüfung.
8. Den Entwurf erneut laden bzw. schließen und über denselben Link öffnen. Im Dokumentkörper müssen vollständiger Originaltext, Kontext, Quelle, Zeit und Vertraulichkeit stehen. Eine kürzere Kernaussage ist normal.

**Eine Vorschau zur Zeit:** Eine weitere Übernahme öffnet die vorhandene Vorschau mit Hinweis, dass die neue Auswahl nicht übernommen wurde. Erst die vorhandene Auswahl verwerfen, dann neu markieren. So überschreibt ein anderer Tab keine ungesicherte Auswahl. Für eine bestätigte Anlage bleibt der bestehende Entwurf beim Verwerfen erhalten.

**Fehler und Wiederholung:** Bei offline/unklar, Serverfehler oder Zeitüberschreitung kann der Entwurf schon angelegt sein. Ohne Inhaltsänderung nochmals bewusst bestätigen; der Vorgangsschlüssel bleibt derselbe. Eine geänderte Ladung ist ein neuer Vorgang und kann einen weiteren Entwurf anlegen. „Status erneut prüfen“ liest eine bekannte Entwurfskennung frisch zurück; es startet keinen POST. Während eines anderen Vorgangs gegebenenfalls warten und erneut prüfen. Eine frische 401 verlangt Anmeldung; die Auswahl bleibt für dasselbe Konto erhalten. Ein anderes Konto löscht die alte Auswahl. 403, 409, 413, 429 und 5xx haben eigene Hinweise.

**Flüchtige Daten:** Auswahl, Bearbeitungen und Vorgangsschlüssel leben nur in `chrome.storage.session`; das Token ebenso, ausschließlich für vertrauenswürdige Erweiterungskontexte. Passwort wird nie gespeichert und nach Absenden aus dem Feld entfernt. Abmelden löscht den lokalen Zustand sofort; falls die serverseitige Abmeldung scheitert, steht das ausdrücklich da. Browserneustart, Erweiterungs-Neuladen, Deaktivieren oder Entfernen kann den flüchtigen Zustand löschen. Keine dauerhafte Offline-Warteschlange. Eine vorher bereits erfolgte Anlage wird dadurch nicht gelöscht.

**Grenzen:** Markierter Klartext im Hauptdokument normaler HTTP(S)-Webseiten, ohne Domainbeschränkung; auch HTTP und abweichende Ports sind möglich. Kein Iframe-, Bild-, PDF-, Video- oder Gesamtexport. Browser-Systemseiten (`chrome://`, `about:`), lokale Dateien und URLs mit eingebetteten Zugangsdaten sind ausgeschlossen. Geschützte Webseiten und Sonderdarstellungen können die Markierung unzugänglich machen; dann meldet Klara den fehlgeschlagenen Zugriff. Über Erweiterungssymbol oder Tastenkürzel lässt sich dieser Hinweis auch auf Systemseiten aufrufen. Maximal 200.000 UTF-16-Zeichen Auswahl, 300 Seitentitel bzw. Herkunftsbezeichnung, 2.048 Quellenadresse, 90 Entwurfstitel, 4.000 Kontext. Größere Quellenfelder werden abgelehnt; der vorgeschlagene Entwurfstitel darf auf 90 Zeichen verkürzt sein, der originale Seitentitel steht vollständig im Körper. Der Quellenauszug ist ausdrücklich auf 500 Zeichen begrenzt; er ist kein Volltextspeicher. Zusätzlich wird der vollständige UTF-8-JSON-Rumpf einschließlich HTML-Maskierung und operationId gegen 5 MiB geprüft. Der engere B0-Deckel hält normale Ladungen bereits darunter; die Byteprüfung ist ein zusätzlicher Transportdeckel. Nach 100 Inhaltsvarianten wird kein neuer Vorgang begonnen, bis die Auswahl bewusst verworfen wird.

## Installation and use · English

1. In Chrome 120 or later, open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select **`extensions/klara-browser/`**. Verify **Klara · Browser**, version **0.1.1**, and no loading errors. Pin the extension.
3. Open any normal HTTP(S) webpage in Chrome, such as printer or interface setup instructions; Perplexity is another example. Select approved test text and right-click **Capture in Klarwerk**. Alternatively use the extension icon or **Alt+Shift+K**; configure conflicting shortcuts at `chrome://extensions/shortcuts`.
4. The selection is read before a separate extension tab opens. Review the complete text, page title, source address and UTC capture time. Edit the title, add optional context, and choose confidentiality or explicitly leave it unclassified.
5. Sign into your existing Klarwerk account inside the extension. Sign-in does not create a draft. The context menu follows Chrome’s language; the preview has a German/English switch.
6. Tick the confirmation checkbox and choose **Confirm and save draft**. Editing title, context or classification clears confirmation. Enter in the context box inserts a line break; submitting the sign-in form only signs in.
7. After confirmed success, choose **Open draft in Klarwerk**. The website may require a separate sign-in **with the same account**. The real link is `/capture/frontdoor?draft=<draft ID>`, without a token. The draft remains unreviewed, with no automatic publication or AI call.
8. Reload and reopen that draft. Verify the entire original text, context, source, time and classification in its document body. A shorter summary statement is expected.

Only one preview is retained. Capturing again reopens it and explicitly says the new selection was not captured. Discard the old selection first, then select again. Discarding never deletes a draft already created on the server.

On an unclear response, timeout or server error, repeat confirmation **without changing content** to reuse the same operation key. Content changes start another operation and can create another draft. **Check status again** reads a known draft afresh without creating one. Wait for an in-progress operation if necessary. A 401 requires signing in again; the same account retains the selection, a different account clears it. 403/409/413/429/5xx have distinct messages.

Selections, edits, operation keys and authentication are temporary for this browser session. The token stays in trusted-context-only `chrome.storage.session`; passwords are not persisted. Signing out clears local data immediately and reports any failure to end the server session. Restarting Chrome or reloading/disabling/removing the extension can clear temporary data. There is no persistent offline queue; existing server drafts remain.

B0 captures selected plain text in the main document of normal HTTP(S) webpages without a domain restriction, including HTTP and non-default ports. No frames, images, PDFs, videos or automatic conversation archive. Browser system pages (`chrome://`, `about:`), local files and URLs with embedded credentials are excluded. Protected pages or special viewers may prevent capture; Klara reports that failure. Use the extension icon or shortcut to see the unsupported-page message on system pages. Limits: 200,000 UTF-16 characters selected, page title/source label 300, URL 2,048, editable title 90, context 4,000; source excerpt 500, with the complete original in the draft body. The suggested title may be shortened, but the original page title is retained in the body. Oversize input is rejected, not silently cut. The complete UTF-8 JSON request also has a 5 MiB ceiling. At most 100 content variants per temporary selection.

## Noch ausstehende echte Abnahme / Required live acceptance

Der unabhängige Prüfer führt die folgenden Schritte am tatsächlich geladenen Paket aus. Nur Testtexte und Ergebnisangaben dokumentieren; keine privaten Chats, Zugangsdaten oder Tokens in Berichte übernehmen.

| Schritt / Step | Nachweis / Evidence |
| --- | --- |
| Lokale Installation / Local installation | Chrome-Version, Erweiterung 0.1.1, Paketpfad, keine Ladefehler; tatsächliche Anzeige der Vorschau |
| Perplexity, DE und EN / both languages | Freigegebener Testchat; Markierung per Maus und Tastatur; kein unbeabsichtigtes Absenden im Chat |
| Technische Webseite A / Technical page A | Technische Erläuterung zur Druckereinrichtung; tatsächliche URL und Titel protokollieren; DE/EN, nur markierter Text |
| Technische Webseite B / Technical page B | Anders aufgebaute Schnittstellenanleitung mit Absätzen, Nummerierung oder Codeblock; echte URL protokollieren; DE/EN, Einrückungen/Zeilenumbrüche prüfen |
| Alle drei Quellen / All three sources | Für JEDE Quelle speichern und über den echten Link zweimal öffnen; vollständigen Text, Kontext, tatsächliche Domain/Titel/URL, Erfassungszeit und Einstufung vergleichen |
| Systemseite / System page | `chrome://settings` über Symbol/Kürzel: ehrliche Ablehnung; keine Erfassung und kein POST |
| Testtext | Mindestens 2.000 Zeichen mit Umlauten, mehreren Zeilen und wörtlichem `<script>Test</script>`; nur ausgewählte Passage erfasst |
| Quelle wechseln / Change tab or source | ursprüngliche Quelle und Zeit bleiben dem Text zugeordnet; zweiter Capture überschreibt nicht |
| Abbrechen / Cancel | vor erster Speicherung kein neuer Entwurf |
| Anmeldung / Sign-in | echte Bearer-Anmeldung an app.klarwerk.ai; nach Abmeldung kein Zugriff auf die alte flüchtige Auswahl |
| Bestätigen / Confirm | Titel, Kontext, Wahl „vertraulich“; genau ein ungeprüfter Entwurf nach Doppelklick |
| Antwortverlust / Lost response | bei unterbrochener Antwort unverändert wiederholen; gleiche Vorgangskennung, kein zweiter Entwurf |
| Erneutes Öffnen / Reopen | echter Frontdoor-Link, getrennte Webanmeldung falls nötig; Volltext, Kontext, Quelle, Zeit und Einstufung wieder sichtbar |
| Offen / Unclassified | zweiter Test mit offener Einstufung: offen erkennbar, keine behauptete Weitergabefreigabe |
| Panel und Worker / View and worker restart | View schließen, Worker beenden, erneut öffnen: kein bloßer Cache-Erfolg; Browserneustart verliert flüchtige Auswahl wie erklärt |

Status dieses Protokolls: **nicht durchgeführt / not performed**. Die automatisierten Prüfungen sind kein Ersatz. Verantwortlich für den manuellen Abschluss: unabhängiger Prüfer bzw. gezielte Abnahme durch die Steuerung; nötig sind ein ausführbarer Chrome und ein freigegebenes Testkonto.

## Verträge und technische Prüfungen

Die Erweiterung nutzt nur vier fest benannte API-Vorgänge: Login, Logout, Entwurf anlegen und eigenen bestätigten Entwurf lesen. Keine API-URL kommt aus Seiteninhalt oder einer Nachricht. Weiterleitungen sind gesperrt, Cookies werden mit `credentials: omit` ausgeschlossen. Eine Seitennachricht kann keine privilegierte Aktion auslösen: der Worker akzeptiert nur die eigene Erweiterungs-ID und die exakte `panel.html`-Adresse. `selection.js` wird nur per `activeTab` nach Nutzerhandlung im isolierten Kontext injiziert und liest allein Markierung, Titel und URL. Es besitzt keinen Netz- oder Nachrichtenweg. Die Kontextmenümuster `http://*/*` und `https://*/*` bestimmen nur, wo das Menü sichtbar ist; sie erteilen keine dauerhafte Leseberechtigung. Im Manifest bleibt ausschließlich der HTTPS-Klarwerk-Host unter `host_permissions`; es gibt weder `<all_urls>` noch dauerhaft registrierte Inhaltsskripte. Firmenwissen wird weder gelesen, um es an externe Chats weiterzugeben, noch in den Chat eingefügt.

`origin` bleibt weg, weil das Backend keine Browser-Herkunft kennt. `pendingSources.label` benennt „Browser / <tatsächliche Domain>“, `sourceProvider` den Erfassungsweg „Browser“ (maximal 100 Zeichen im Backend), und `bodyHtml` enthält die gesamte Herkunft, Kontextnotiz und vollständige Auswahl als maskierten Text. `operationId` wird vor dem POST in der Sitzung abgelegt; ein SHA-256-Abdruck der Ladung und die Konto-ID wählen den gleichen Vorgang erneut. Nachgelagerte Änderungen in Klarwerk können bei erneuter Bestätigung einen 409 bzw. eine fehlgeschlagene Inhaltsbestätigung ergeben; vorhandene Entwürfe werden durch die Erweiterung nicht überschrieben.

Lokale Prüfungen aus der Repository-Wurzel:

```sh
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.tests-tsx.json
npx tsc -p extensions/klara-browser/tsconfig.json
npx biome check extensions/klara-browser tests/klara-browser
KLARWERK_SKIP_KEYCHAIN=1 npx vitest run --poolOptions.threads.maxThreads=4 --maxWorkers=4 tests/klara-browser
```

Die beiden vorhandenen Testdateien decken nun drei synthetische Quellseiten aus `tests/klara-browser/fixtures.ts` ab: Perplexity-Beispiel, technische Erläuterung (Artikel/Absatz) und strukturierte Schnittstellenanleitung (Nummerierung/Codeblock, HTTP mit Port). `panel.test.tsx` führt das echte `selection.js` auf DOM-Markierungen aus; `package.test.ts` führt den ausgelieferten Worker mit Chrome-API-Attrappen gegen die echten lokalen Fastify-Login-/POST-/GET-Routen aus und vergleicht den vollständigen zurückgelesenen Originaltext. Quelle und Zeitpunkt bleiben beim Tabwechsel erhalten. Dies belegt weder echte Browser-Layout-Extraktion noch eine Live-Installation.

`node tests/klara-browser/chrome-probe.cjs` versucht zusätzlich die echte Paketinstallation und das Öffnen der leeren Vorschau in einem isolierten Chromium-Profil. Es meldet keinen Login- oder Speichererfolg und ersetzt die drei Live-Rundwege nicht. Profil und temporäre Dateien werden im Arbeitsbaum angelegt und danach entfernt.

Das vorhandene Vitest-Muster erfasst die Tests bereits. Kein neuer package.json-/tools-Anschluss. Das globale Klara-Inventar enthält bereits seit der Vorrunde beide Testdateien; in Runde 2 war keine Pinänderung erforderlich. Kein neuer CSS-Wächter, daher kein neuer Eintrag im Theme-Deckungsregister. Der vollständige Torlauf erfolgt außerhalb der Bahn durch den Taktgeber.

Gelesene offizielle Chrome-Quellen: [Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3), [contextMenus](https://developer.chrome.com/docs/extensions/reference/api/contextMenus), [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [Service Worker](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics), [storage.session](https://developer.chrome.com/docs/extensions/reference/api/storage), [sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel). Die bewusste Wahl eines eigenen Erweiterungs-Tabs vermeidet ein zusätzliches `sidePanel`-Recht und bewahrt den Auswahltext vor dem Ansichtswechsel.
