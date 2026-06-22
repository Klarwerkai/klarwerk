# Gitea — Finalisierung & Betrieb

> Status: Gitea ist lokal installiert. Dieses Dokument führt die Installation zu Ende
> (Erstkonfiguration, Repo, Push, Schutzregeln, CI) und dient als Betriebs-Doku.

## ✅ Bereits erledigt (per Browser, 2026-06-22)
- Installation abgeschlossen (Instanz **KLARWERK**, SQLite, `http://localhost:3000`).
- Admin-Konto `klarwerk` von Pedi registriert (erstes Konto = Admin).
- Repo **`klarwerk/klarwerk`** angelegt (privat, uninitialisiert, Default-Branch `main`).
  Push-URL: `http://localhost:3000/klarwerk/klarwerk.git`.
- Branch-Protection-Regel für `main` aktiv: **bootstrap-sicher** — Push erlaubt (kein Force-Push),
  noch **keine** Review-/CI-Pflicht erzwungen (würde sonst ersten Push + fehlenden Runner blockieren).

## ▶ Als Nächstes (durch Pedi)
1. **Ersten Push** vom Mac (Lock vorher entfernen):
   ```bash
   cd ~/Documents/dev_Klarwerk
   rm -f .git/index.lock                      # verwaiste Sandbox-Lock entfernen
   git add -A && git commit -m "docs+specs: Stand 22.06."   # ausstehende Dateien
   git remote add origin http://localhost:3000/klarwerk/klarwerk.git
   git push -u origin main
   ```
2. **act_runner registrieren** (Abschnitt 4) → CI läuft, Status-Check „CI" wird verfügbar.
3. **Protection verschärfen** (Abschnitt 3) erst dann: „Require status checks = CI" + PR-Pflicht
   aktivieren. Volle Schärfe (Review-Pflicht durch Zweitperson) mit den zwei externen Teams
   (siehe `governance-and-teams.md`, Stufe 2).

## 1. Erstkonfiguration abschließen (einmalig)
Im Browser die Gitea-Instanz öffnen (Standard: `http://localhost:3000`).

1. **Installations-Assistent** (falls noch offen): Datenbank (SQLite genügt lokal), `App-URL` und `SSH-Domain` prüfen, **Admin-Konto** anlegen.
2. Anmelden als Admin.
3. **Einstellungen → Authentifizierung:** Self-Registration ggf. deaktivieren (kontrollierter Zugang).
4. **Organisation anlegen:** `klarwerk` (Site → New Organization). Hier leben alle Repos.

## 2. Repo anlegen & verbinden
In Gitea: Organisation `klarwerk` → **New Repository** → Name `klarwerk`, leer lassen (kein README/gitignore — wir pushen das bestehende).

Dann lokal im Projektordner (`~/Documents/dev_Klarwerk`):

```bash
# Repo ist bereits initialisiert und committet (Branch main).
git branch -M main
git remote add origin http://localhost:3000/klarwerk/klarwerk.git
git push -u origin main
```

Bei SSH statt HTTP:
```bash
git remote add origin git@localhost:klarwerk/klarwerk.git
git push -u origin main
```
(SSH-Key vorher unter Gitea → Settings → SSH Keys hinterlegen.)

## 3. Branch-Protection (Sicherheitsnetz)
Gitea → Repo `klarwerk` → **Settings → Branches → Protect `main`:**

- ✅ „Enable Branch Protection"
- ✅ „Require status checks to pass" → Check **CI** auswählen (nach erstem Actions-Lauf sichtbar).
- ✅ „Block merge on rejected reviews" / mindestens 1 Review.
- ✅ Direkte Pushes auf `main` verbieten — nur via Pull Request.

> Damit gilt die nicht-verhandelbare Regel aus `CLAUDE.md`: **Nichts kommt nach `main`, das die Pipeline nicht grün durchläuft.**

## 4. CI: Gitea Actions aktivieren
1. Gitea → **Site Administration → Actions** aktivieren (falls nicht an).
2. **Runner registrieren** (act_runner):
   ```bash
   # auf dem Build-Rechner
   act_runner register --instance http://localhost:3000 --token <RUNNER_TOKEN>
   act_runner daemon
   ```
   Token: Gitea → Repo/Org → Settings → Actions → Runners → „Create new Runner".
3. Workflow ist bereits vorhanden: `.github/workflows/ci.yml` (Gitea Actions liest dieses Verzeichnis kompatibel; alternativ nach `.gitea/workflows/` kopieren).

## 5. Spiegelung (optional)
Wenn später zusätzlich GitHub genutzt wird: Gitea → Repo → Settings → **Mirror** einrichten (Push-Mirror), damit externe Teams wahlweise über GitHub arbeiten können.

## Betriebsnotizen
- Quelle der Wahrheit ist dieses Git-Repo. Jira (Tasks) und Notion (Doku) spiegeln nur.
- Backups: Gitea-Datenverzeichnis + DB regelmäßig sichern.
- Zugänge/Tokens niemals ins Repo (siehe `harness/70-security-and-permissions.md`).
