# Textvorschlag für die Leitinstanz: Lehre aus dem 03.07. (manueller GPU-Deploy)

> [Cloud-Worker], 03.07.2026 · Per Leitinstanz-Freigabe 4c: „Textvorschlag als Datei + Jira-Hinweis".
> Anlass: Heute Morgen wurde der GPU-Server manuell über das Hub-Formular erstellt (Default-Name,
> 50 GB statt 200 GB) — die One-Click-App hätte ihn nicht erkannt und einen zweiten gebaut.
> Gelöst durch Umbenennen; die Regel-Lücke sollte geschlossen werden. Einbau macht die Boss-Session
> (Commit-Weg a). Zwei kleine Einfügungen:

## 1 · `PROJECT_CONTEXT/08_RUNBOOK_LLM_SERVER.md` — Abschnitt „Vorher wissen" ergänzen:

```
- **Server NUR über die App „KLARWERK LLM" erstellen — NIE über das Hub-Deploy-Formular.**
  Die App erkennt ihren Server am Namen `klarwerk-llm-eval`; ein manuell erstellter Server
  (Default-Name, abweichender Storage) wird nicht erkannt → Gefahr eines zweiten Servers
  bzw. GPU-Limit-Fehler. Falls doch manuell erstellt (Vorfall 03.07.): im Hub auf exakt
  `klarwerk-llm-eval` umbenennen, Storage-Größe prüfen (Soll: 200 GB), dann erst „Starten".
```

## 2 · `PROJECT_CONTEXT/04_AKTUELLER_STAND.md` — unter „Bekannte Stolpersteine":

```
- GPU-Server nie über das UpCloud-Hub-Formular anlegen — nur per „KLARWERK LLM"-App
  (Namens-Erkennung `klarwerk-llm-eval`; Vorfall 03.07.: manueller Deploy mit 50 GB/Default-Name).
```

Optional (Entscheidung Leitinstanz): denselben Stolperstein in `09_ENTSCHEIDUNGEN.md` als
Zeile „03.07.2026 · GPU-Deploy nur über die One-Click-App" aufnehmen — dann ist das Warum
(App-Namens-Discovery) dauerhaft dokumentiert.
