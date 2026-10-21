# FRONTEND-CODEX-ÜBERGABE AN CHATGPT – MINECRAFT-AVATAR-PROXY

FRONTEND STATUS: FERTIG

Stand: 21.10.2026. Frontend: tschanni/mueller-it-mkk.
Ausgangscommit: `94cee9502f1be2e0b93a80093bd47afb9c75bdc8`.
Implementierungscommit: Commit dieser Datei, abrufbar mit `git log -1 --format=%H -- docs/MINECRAFT_AVATAR_PROXY_HANDOFF.md`; vollständige SHA zusätzlich in der Chat-Übergabe.
Backend-Abhängigkeit laut Folgeauftrag: `tschanni/Gameserver_Dashboard`, Commit `11c2889f05c2a4bc155afb46ad183245c204cf1e`, noch nicht produktiv deployed.
Kein Push und kein produktives Deployment durchgeführt.

## Umsetzung und URL-Auflösung

`MinecraftHead` bleibt die einzige Kopf-Avatar-Komponente. Sie wird im verknüpften Minecraft-Profil, in der vollständigen Whitelist und über `MinecraftProfile` in der Gameserver-Übersicht verwendet. Windows-98-Klassen und lokales Profil-Icon bleiben erhalten.

Der zentrale Resolver `minecraftHeadUrl(uuid, apiBase)` erzeugt ausschließlich die dokumentierte öffentliche Route:

`GET {apiBase}/api/v1/public/minecraft/avatars/{uuid}`

Beispiel für `apiBase = https://api.example/games`:
`https://api.example/games/api/v1/public/minecraft/avatars/12345678-1234-1234-1234-123456789abc`.

`MinecraftAccess` reicht seine konfigurierte API-Basis an Profil und Whitelist weiter. Ohne explizite Basis verwendet der Resolver die vorhandene Funktion `minecraftApiBase()`, die `REACT_APP_AUTH_API_BASE_URL` einschließlich Deployment-Präfix und die bestehenden Produktions-/localhost-Defaults auswertet. Keine zusätzliche Produktionsdomain oder neue Umgebungsvariable eingeführt. HTTP bleibt ausschließlich für localhost im Entwicklungsmodus zulässig.

32-stellige und korrekt mit Bindestrichen formatierte hexadezimale UUIDs werden akzeptiert, kleingeschrieben und als kanonische UUID in die URL eingefügt. Ungültige UUIDs, ungültige API-Basen, Benutzerinformationen, Querystrings und Fragmente führen zum lokalen Icon. Die URL bleibt auf der konfigurierten API-Origin; ein Pfad wird nicht gegen die Website-Origin aufgelöst.

API-Felder `avatarUrl` werden bewusst nicht übernommen. Stattdessen wird dieselbe erlaubte Route aus der validierten UUID konstruiert. Damit funktionieren die relativen API-Pfade unabhängig von der Website-Origin, und externe bzw. manipulierte URLs aus Antworten werden ignoriert.

Die Ausgabe ist ein normales `<img>` ohne Queryparameter, Browser-API-Key oder zusätzlichen Better-Auth-Fetch. Die Route ist öffentlich. Der Browser stellt die Bildanfrage selbst; das Backend liefert `image/png`, 64×64 Pixel und die äußere Skin-Ebene. Ein vom Backend mit HTTP 200 geliefertes neutrales Fallback-PNG wird wie jedes erfolgreiche Bild angezeigt. Nur ein tatsächliches Bildlade-/Dekodierungsproblem aktiviert den lokalen Fallback. Kein externer Ersatzabruf und kein automatischer Retry; bei anderer Account-UUID wird deren Bild verwendet.

## Entfernte externe Browser-Anbindungen

- Der direkte öffentliche Renderer-URL-Pfad wurde vollständig aus dem Frontend-Resolver entfernt.
- Ein veralteter Mock-Zweig für den externen Renderer wurde entfernt.
- Im ausführbaren Frontend, `public`, `scripts`, `.github` und `.env.example` finden sich keine Verwendungen von `mc-api.io`, `render/FACE` oder `MC_API_KEY` mehr. Historische Dokumentation bleibt als solche gekennzeichnet erhalten.
- Browser-API-Key-, Profil-Fetch- und Blob-Pfade waren bereits im Ausgangscommit entfernt; sie werden nicht wieder eingeführt. Keine neue Avatar-Konfiguration und keine Secrets erforderlich.
- Andere Website-Profilbilder einschließlich `/me/avatar` bleiben unverändert.
- `REACT_APP_MINECRAFT_LIVE_WHITELIST=false` bleibt Standard. Whitelist-Zustände, Discord-, Auth-, Registrierungs- und Schreibabläufe wurden nicht verändert. Die Avatar-Route selbst benötigt keinen Whitelist-Schalter und muss vor Veröffentlichung dieses Frontends verfügbar sein.

## Geänderte Dateien

1. `src/apps/GameserverManager/MinecraftHead.tsx`: zentraler Backend-URL-Resolver, UUID-/Basisvalidierung, bestehender lokaler Fallback.
2. `src/apps/GameserverManager/MinecraftProfile.tsx`: API-Basis an gemeinsame Komponente weitergeben.
3. `src/apps/GameserverManager/MinecraftWhitelist.tsx`: API-Basis an gemeinsame Komponente weitergeben.
4. `src/apps/GameserverManager/MinecraftAccess.tsx`: vorhandene API-Basis an beide Ansichten durchreichen.
5. `src/apps/GameserverManager/MinecraftProfile.test.tsx`: Proxy-, Konfigurations-, UUID-, Bildfehler-, Backend-Fallback- und Accountwechseltests.
6. `src/apps/GameserverManager/MinecraftWhitelist.test.tsx`: tatsächliche Proxy-Bildadresse eines manuellen Spielers prüfen.
7. `src/apps/GameserverManager/MinecraftOverviewAccess.test.tsx`: alten externen Mock entfernen, Backend-Avatar und Entfernung bei Logout prüfen.
8. `docs/MINECRAFT_WHITELIST_HANDOFF.md`: historischen Avatar-Abschnitt als abgelöst kennzeichnen.
9. `docs/MINECRAFT_AVATAR_PROXY_HANDOFF.md`: diese Übergabe.

## Testergebnisse

- `npm.cmd run typecheck`: erfolgreich.
- `npm.cmd run lint`: erfolgreich, keine Fehler/Warnungen.
- `npm.cmd run test:ci -- --silent`: 219 Tests in 12 Suites erfolgreich.
- `npm.cmd run build`: Produktionsbuild und fünf statische Auth-Einstiegsseiten erfolgreich.
- `git diff --check`: erfolgreich.

Abgedeckt sind verknüpftes Profil, vollständige Whitelist, manuelle Spieler, API-Origin/Deployment-Präfix, kompakte/großgeschriebene UUIDs, ungültige UUIDs/Basen, keine zusätzlichen Profil-/Key-Fetches, Ignorieren externer `avatarUrl`, erfolgreiches neutrales Backend-PNG, tatsächlicher Bildfehler ohne Reload-Schleife, Accountwechsel und Logout. Die vollständige bestehende Whitelist-, Session-, Auth- und Discord-Testsuite bleibt grün.

Bild-Load/Error-Ereignisse sind in Jest simuliert. Kein Zugriff auf den noch nicht produktiv bereitstehenden Proxy, keine Prüfung echter PNG-Bytes/äußerer Skin-Ebene und keine visuelle Staging-Abnahme durchgeführt. Bekannte, nicht blockierende Tool-Hinweise: veraltete Browserslist-Daten, Node-punycode-Deprecation sowie ein bestehender Fake-Timer-Hinweis aus Auth-Tests.

## Offene Caddy-/CSP-Anforderungen

Vor Deployment öffentliches GET auf `/games/api/v1/public/minecraft/avatars/:uuid` gezielt in der vorhandenen Caddy-Allowlist freigeben. Das Deployment-Präfix muss bis NestJS erhalten bleiben. Kein Auth-Gateway oder Login-Redirect vor die Bildroute setzen; `Content-Type: image/png`, erfolgreiche neutrale Fallbacks und bestehende Cache-Header durchreichen. Keine pauschale Freigabe anderer API-Pfade. Hier wurde keine Caddy-Konfiguration geändert.

Die Website-CSP muss unter `img-src` die konfigurierte API-Origin erlauben, auch wenn diese von der Website-Origin abweicht. Etwaige bisherige Renderer-Freigaben können nach Prüfung anderer Nutzer entfernt werden. Ein bloßes `connect-src` reicht für `<img>` nicht. Für das normale Bild ohne Canvas ist kein Fetch-CORS erforderlich; dennoch dürfen CORP/COEP oder sonstige Response-Policies das beabsichtigte Cross-Origin-Einbetten nicht blockieren. Tatsächliche Header in Staging prüfen. Keine CSP- oder Infrastrukturkonfiguration geändert.

## Abhängigkeiten und Deployment-Reihenfolge

1. Backend-Commit `11c2889f05c2a4bc155afb46ad183245c204cf1e` im Zielsystem bereitstellen; URL, PNG-MIME, 64×64, äußere Skin-Ebene, Cache und neutrales Fallback prüfen.
2. Caddy-Allowlist und Website-CSP für die konfigurierte API-Origin prüfen/freigeben; keine Veröffentlichung des Frontends vor erreichbarer Avatar-Route.
3. Staging mit echtem Profil, Whitelist, fehlendem Skin, Server-/Bildfehler, Accountwechsel und Logout abnehmen; Netzwerk prüfen: ausschließlich interne Avatar-Route, kein Renderer-/Key-Zugriff im Browser.
4. Frontend und Backend koordiniert freigeben. Der Whitelist-Rollout-Schalter bleibt deaktiviert, bis auch die neuen Whitelist-Lese-Endpunkte separat freigegeben sind.
5. Erst nach separater Freigabe pushen und produktiv deployen.

Die Frontend-Implementierung ist fertig; die produktive Verfügbarkeit hängt vom noch ausstehenden Backend-/Infrastruktur-Deployment und der Staging-Abnahme ab.
