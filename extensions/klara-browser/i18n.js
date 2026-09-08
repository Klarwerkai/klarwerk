// Local UI copy only. No remote language bundles and no model calls.
/** @type {Record<string, Record<string, string>>} */
globalThis.KLARA_TEXT = {
  de: {
    language: "Sprache",
    pendingCapture:
      "Es ist bereits eine Vorschau offen. Die neue Auswahl wurde nicht übernommen. Zuerst diese Auswahl verwerfen und danach die neue Passage erneut markieren.",
    refresh: "Status erneut prüfen",
    unreviewed: "Browser · Ungeprüfter Entwurf",
    account: "Klarwerk-Anmeldung",
    email: "E-Mail",
    password: "Passwort",
    login: "Anmelden",
    logout: "Abmelden und flüchtige Auswahl löschen",
    preview: "Übernahme prüfen",
    sourceChanged:
      "Der aktive Tab oder die Quellseite hat gewechselt. Diese Vorschau behält die ursprünglich erfasste Quelle.",
    page: "Seite",
    source: "Quellenadresse",
    captured: "Erfasst am",
    sourceHint:
      "Die Adresse nennt die Quellseite. Sie kann privat sein und ist kein unabhängiger Faktenbeleg.",
    title: "Titel (höchstens 90 Zeichen)",
    context: "Kontextnotiz (optional, höchstens 4.000 Zeichen)",
    confidentiality: "Vertraulichkeit",
    open: "Offen · noch nicht eingestuft",
    internal: "Intern",
    confidential: "Vertraulich",
    strict: "Streng vertraulich",
    classificationHint:
      "Offen ist keine Freigabe zur Weitergabe. Die Einstufung gilt im bestehenden Klarwerk-Rechtemodell; berechtigte Administratoren können Entwürfe sehen.",
    original: "Vollständiger Originaltext",
    summaryHint:
      "Klarwerk kürzt die Kernaussage. Der vollständige Originaltext und diese Herkunft bleiben im Entwurfskörper erhalten. Der Quellenauszug enthält nur die ersten 500 Zeichen.",
    confirm:
      "Ich habe Auswahl, Quelle und Vertraulichkeit geprüft und möchte diesen ungeprüften Entwurf in meinem angezeigten Klarwerk-Konto speichern.",
    save: "Bewusst als Entwurf speichern",
    cancel: "Auswahl verwerfen",
    openDraft: "Entwurf in Klarwerk öffnen",
    webSession:
      "Klarwerk im Web benötigt gegebenenfalls eine eigene Anmeldung mit demselben Konto. Der Link enthält kein Sitzungstoken.",
    instructions:
      "Auf einer normalen HTTP(S)-Webseite Text markieren → Rechtsklick „In Klarwerk übernehmen“. Alternativ Erweiterungssymbol oder Alt+Umschalt+K. Eine vorhandene Vorschau zuerst verwerfen, bevor eine neue Auswahl übernommen wird.",
    sessionHint:
      "Bis zur Bestätigung bleibt die Auswahl nur flüchtig in dieser Browsersitzung. Browserneustart, Erweiterungs-Neuladen oder Abmelden löscht sie. Keine automatische Speicherung, kein KI-Aufruf.",
    signedOut: "Nicht angemeldet",
    // JOB 3278 · Pflichtlieferung 4: im Ruhezustand steht GENAU EINE Zeile, höchstens 60 Zeichen.
    // Die ausführliche Anleitung (Schlüssel `instructions`) hängt jetzt an der Vorschau.
    no_selection: "Keine Auswahl. Text markieren, dann Rechtsklick.",
    previewState: "Vorschau bereit. Es wurde noch nichts übermittelt.",
    previewEdited:
      "Vorschau bereit. Änderungen erzeugen beim Speichern einen neuen Vorgang; ein früherer Entwurf bleibt bestehen.",
    saving: "Vorgang läuft. Bitte warten.",
    busy: "Ein Vorgang läuft bereits. Bitte warten und anschließend erneut versuchen.",
    saved: "Als ungeprüfter Entwurf gespeichert; vollständigen Inhalt bestätigt.",
    expired:
      "Sitzung fehlt oder ist abgelaufen. Bitte erneut anmelden. Die Auswahl bleibt flüchtig erhalten.",
    uncertain:
      "Offline oder Antwort unklar. Ein Entwurf kann bereits existieren. Unverändert erneut bestätigen: derselbe Vorgangsschlüssel wird verwendet.",
    server_error:
      "Serverfehler (5xx). Anlage unklar. Unverändert erneut bestätigen; derselbe Vorgangsschlüssel bleibt erhalten.",
    denied:
      "Zugriff abgelehnt (403). Konto-Freigabe oder Berechtigung prüfen. Die Auswahl bleibt erhalten.",
    conflict:
      "Vorgangskonflikt (409). Entwürfe in Klarwerk prüfen. Unveränderter Inhalt behält seinen Schlüssel; Änderungen beginnen einen neuen Vorgang.",
    too_large:
      "Ladung zu groß (Grenze: 5 MiB UTF-8-JSON). Kleinere Auswahl übernehmen; nichts wird still gekürzt.",
    selection_too_large:
      "Auswahl zu groß: höchstens 200.000 Zeichen, Seitentitel/Herkunftsbezeichnung 300 und Quellenadresse 2.048 Zeichen. Bitte eine kleinere Passage wählen.",
    rate_limited:
      "Zu viele Anfragen (429). Bitte später erneut versuchen; der Vorgangsschlüssel bleibt erhalten.",
    rejected: "Server lehnt die Anfrage ab. Angaben prüfen; die Auswahl bleibt erhalten.",
    invalid_form:
      "Bitte Titel (1–90 Zeichen), Kontext (max. 4.000) und Vertraulichkeitswahl prüfen.",
    verify_failed:
      "Entwurf konnte nicht vollständig bestätigt werden. Keine Erfolgsmeldung: bitte in Klarwerk prüfen oder unverändert erneut versuchen.",
    operation_limit:
      "100 Inhaltsvarianten erreicht. Bitte vorhandene Entwürfe prüfen und diese Auswahl anschließend verwerfen.",
    logged_out: "Abgemeldet. Flüchtige Auswahl und Sitzungsdaten gelöscht.",
    logged_out_local:
      "Lokal abgemeldet und Sitzungsdaten gelöscht. Die Serversitzung konnte nicht beendet werden.",
    logout_first: "Für einen Kontowechsel bitte zuerst abmelden. Das löscht die flüchtige Auswahl.",
    account_changed:
      "Anderes Konto angemeldet. Die vorherige Auswahl wurde zum Schutz des Kontos gelöscht. Bitte neu markieren.",
    stale_preview: "Diese Vorschau ist nicht mehr gültig. Erweiterungsansicht neu öffnen.",
    cancelled: "Abgebrochen. Es wurde kein Entwurf angelegt.",
    cancelled_uncertain:
      "Lokale Auswahl verworfen. Ein bereits angelegter oder unbestätigter Entwurf wurde dadurch nicht gelöscht; bitte in Klarwerk prüfen.",
    unsupported:
      "B0 übernimmt markierten Text im Hauptdokument normaler HTTP(S)-Webseiten. Browser-Systemseiten, Dateien und Rahmen werden nicht unterstützt.",
    empty:
      "Keine Textmarkierung gefunden. Bitte eine sichtbare Passage markieren und erneut übernehmen.",
    source_changed: "Die Quellseite hat während der Erfassung gewechselt. Bitte erneut markieren.",
    capture_failed:
      "Auswahl konnte nicht gelesen werden. Auf einer zugänglichen HTTP(S)-Webseite sichtbaren Text markieren und erneut übernehmen; geschützte Seiten oder Sonderdarstellungen können die Erfassung verhindern.",
    storage_error:
      "Flüchtiger Zustand nicht erreichbar. Bitte Erweiterung erneut öffnen; keine Anlage bestätigt.",
    invalid_message: "Unzulässiger Erweiterungsauftrag.",
    forbidden_sender: "Unzulässiger Absender.",
  },
  en: {
    language: "Language",
    pendingCapture:
      "A preview is already open. The new selection was not captured. Discard this selection first, then select the new passage again.",
    refresh: "Check status again",
    unreviewed: "Browser · Unreviewed draft",
    account: "Klarwerk sign-in",
    email: "Email",
    password: "Password",
    login: "Sign in",
    logout: "Sign out and clear temporary selection",
    preview: "Review capture",
    sourceChanged:
      "The active tab or source page has changed. This preview keeps the original captured source.",
    page: "Page",
    source: "Source address",
    captured: "Captured at",
    sourceHint:
      "This address identifies the source page. It may be private and is not independent factual evidence.",
    title: "Title (up to 90 characters)",
    context: "Context note (optional, up to 4,000 characters)",
    confidentiality: "Confidentiality",
    open: "Open · not classified",
    internal: "Internal",
    confidential: "Confidential",
    strict: "Strictly confidential",
    classificationHint:
      "Not classified does not permit sharing. Classification follows Klarwerk’s existing permissions; authorized administrators can see drafts.",
    original: "Complete original text",
    summaryHint:
      "Klarwerk shortens the summary statement. The complete original text and provenance remain in the draft body. The source excerpt contains only the first 500 characters.",
    confirm:
      "I have checked the selection, source and confidentiality and want to save this unreviewed draft to my displayed Klarwerk account.",
    save: "Confirm and save draft",
    cancel: "Discard selection",
    openDraft: "Open draft in Klarwerk",
    webSession:
      "Klarwerk on the web may require a separate sign-in with the same account. The link contains no session token.",
    instructions:
      "Select text on a normal HTTP(S) webpage → right-click “Capture in Klarwerk”. Alternatively use the extension icon or Alt+Shift+K. Discard an existing preview before capturing another selection.",
    sessionHint:
      "Until confirmation, the selection stays temporarily in this browser session. Restarting the browser, reloading the extension or signing out clears it. No automatic saving or AI calls.",
    signedOut: "Not signed in",
    no_selection: "No selection. Select text, then right-click.",
    previewState: "Preview ready. Nothing has been sent yet.",
    previewEdited:
      "Preview ready. Saving changes starts a new operation; any earlier draft remains.",
    saving: "Operation in progress. Please wait.",
    busy: "An operation is already running. Please wait, then try again.",
    saved: "Saved as an unreviewed draft; complete content confirmed.",
    expired:
      "Session missing or expired. Sign in again. Your selection remains temporarily available.",
    uncertain:
      "Offline or response unclear. A draft may already exist. Confirm again without changes to reuse the same operation key.",
    server_error:
      "Server error (5xx). Creation is unclear. Confirm again without changes; the operation key is retained.",
    denied:
      "Access denied (403). Check account approval or permissions. Your selection is retained.",
    conflict:
      "Operation conflict (409). Check drafts in Klarwerk. Unchanged content retains its key; changes start a new operation.",
    too_large:
      "Payload too large (limit: 5 MiB UTF-8 JSON). Capture a smaller selection; nothing is silently truncated.",
    selection_too_large:
      "Selection too large: at most 200,000 characters, page title/source label 300 and source address 2,048. Please select a smaller passage.",
    rate_limited: "Too many requests (429). Try again later; the operation key is retained.",
    rejected: "The server rejected the request. Check your entries; the selection is retained.",
    invalid_form:
      "Check the title (1–90 characters), context (max. 4,000) and confidentiality choice.",
    verify_failed:
      "The draft could not be fully confirmed. No success reported: check in Klarwerk or try again without changes.",
    operation_limit:
      "100 content variants reached. Check existing drafts, then discard this selection.",
    logged_out: "Signed out. Temporary selection and session data cleared.",
    logged_out_local:
      "Signed out locally and cleared session data. The server session could not be ended.",
    logout_first: "Sign out before switching accounts. This clears the temporary selection.",
    account_changed:
      "Signed into another account. The previous selection was cleared to protect the account. Please select text again.",
    stale_preview: "This preview is no longer valid. Reopen the extension view.",
    cancelled: "Cancelled. No draft was created.",
    cancelled_uncertain:
      "Local selection discarded. This does not delete an existing or unconfirmed draft; check in Klarwerk.",
    unsupported:
      "B0 captures selected text in the main document of normal HTTP(S) webpages. Browser system pages, files and frames are not supported.",
    empty: "No text selection found. Select a visible passage and capture again.",
    source_changed: "The source page changed during capture. Please select text again.",
    capture_failed:
      "Could not read selection. Select visible text on an accessible HTTP(S) webpage and capture again; protected pages or special viewers may prevent capture.",
    storage_error: "Temporary state is unavailable. Reopen the extension; no creation confirmed.",
    invalid_message: "Invalid extension operation.",
    forbidden_sender: "Unauthorized sender.",
  },
};
