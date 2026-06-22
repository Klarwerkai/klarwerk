# Modul: rbac — Rollen & Rechte

> Quelle: Pflichtenheft §3.2 (FR-RBAC-01…04), NFR-SEC-03. Jira-Epic: KW-RBAC.

## Ziel
Serverseitig erzwungene Rechtematrix für die Rollen Viewer / Experte / Controller / Admin.
Sicherheit nicht nur im UI, sondern bei jeder schützenswerten Operation.

## User Stories & Akzeptanzkriterien

### FR-RBAC-01 · Rollenmatrix (MUSS)
- [ ] **Gegeben** eine Rolle, **dann** sind Aktionen exakt gemäß Rechtematrix (Technischer Anhang §4) sichtbar/ausführbar.

### FR-RBAC-02 · Nutzerverwaltung durch Admin (MUSS)
- [ ] **Gegeben** Admin-Bereich, **dann** kann Admin Nutzer anlegen, freigeben, Rolle ändern, Passwort zurücksetzen, löschen — je Aktion ein Audit-Eintrag.

### FR-RBAC-03 · Selbstschutz Admin (MUSS)
- [ ] **Gegeben** ein Admin, **wenn** er sich selbst die Admin-Rolle entziehen will, **dann** wird das abgewiesen.

### FR-RBAC-04 · Serverseitige Rechteprüfung (MUSS, NFR-SEC-03)
- [ ] **Gegeben** ein direkter API-Aufruf ohne Recht, **dann** Antwort 403 — unabhängig vom UI-Zustand.

## API / Schnittstellen (Entwurf)
`GET/POST/PATCH/DELETE /api/users` (admin) · Middleware `requireRole(...)` vor jeder geschützten Route · jede Mutation erzeugt Audit-Event.

## Datenmodell (Auszug)
`users.role ∈ {viewer, experte, controller, admin}` · Rechtematrix als Code-Konstante/Policy. Referenz: Technischer Anhang §4.

## Nicht-Ziele (v1)
Frei definierbare Custom-Rollen, feingranulare Objekt-ACLs (Roadmap).

## Offene Fragen
Exakte Matrix-Zeilen je Aktion gegen Technischer Anhang §4 verifizieren · Mandanten-Scoping der Rollen (NFR-MNT-03).
