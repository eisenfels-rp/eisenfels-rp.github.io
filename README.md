# Eisenfels RP Website – V4

## Enthalten
- Einklappbare Sidebar
- Zurück-Button + Breadcrumbs
- Link-/Textumbruch in Karten
- Gesetzbücher nach Gruppen
- Termine und Ausbildungen pro Fraktion als Sammelseiten
- Logo/Banner/Medien pro Seite möglich
- CMS unter `/MephMK/`
- Fake-404 unter `/admin/`
- robots.txt blockiert `/MephMK/` und `/admin/`

## Website
https://eisengels-rp.github.io

## CMS
https://eisengels-rp.github.io/MephMK/

Standard-Passwort:
Eisenfels2026!

Bitte nach dem ersten Login ändern.

## Wichtig: Speichern
GitHub Pages hat keinen Server. Deshalb speichert das CMS über die GitHub API.
Dafür brauchst du einen GitHub Personal Access Token mit Schreibrechten für dieses Repository.

Der Token wird nur lokal in deinem Browser gespeichert.

## Passwort vergessen
Das Passwort liegt als SHA-256 Hash in:

`MephMK/admin-config.js`

Wenn du es vergisst:
1. Datei im GitHub Repo öffnen
2. Hash ersetzen
3. Oder diese ZIP erneut hochladen, dann gilt wieder das Standard-Passwort

## Upload
ZIP entpacken und alle Inhalte direkt ins Root des Repositories hochladen:

- index.html
- assets/
- content/
- MephMK/
- admin/
- robots.txt
