# Daniele 60 — RSVP

Pagina di conferma per la festa del 60° compleanno (venerdì 30 ottobre 2026).
Ogni invitato riceve su WhatsApp un **link personale** (`?i=…`) e risponde Sì / Forse / No
senza scrivere il nome. Gli organizzatori usano il proprio link (`?a=…`) per la dashboard.

## Componenti

- `index.html` — pagina unica (vista invitato + vista organizzatori), pubblicata con GitHub Pages.
- `invito.jpg` — locandina **senza indirizzo**: l'indirizzo lo restituisce il server solo
  a chi ha un link valido e ha risposto Sì o Forse.
- `backend/make-code.js` — copia della logica che gira nel modulo *Code* dello scenario Make.
- Scenario Make **"Daniele 60 — RSVP"** (team "My Team"): webhook → lettura Google Sheet →
  Code (verifica token, permessi, validazione) → scrittura riga → risposta → avviso Telegram
  (gruppo "Boccadasse 2026"). Modalità confidenziale attiva: Make non conserva i dati delle esecuzioni.
- Google Sheet **"Daniele 60 — RSVP"** (Drive dell'account collegato a Make), fogli:
  `Invitati`, `Organizzatori`, `Config`.

## Sicurezza in breve

- Nel foglio ci sono solo gli **hash SHA-256** dei token, mai i token.
- I link degli invitati sono generati nel browser dell'organizzatore (192 bit casuali);
  rigenerare un link disattiva il precedente; "Disattiva" revoca l'invitato.
- I ruoli (`admin` / `viewer`) sono verificati dal backend a ogni richiesta.
- Le celle sono scritte in modalità RAW: niente formule iniettate nel foglio.
- Il webhook Make non ha limitazione di frequenza: un abuso potrebbe consumare operazioni
  del piano, ma senza un token valido non legge né modifica nulla.

## Modifiche frequenti (dal foglio `Config`, senza toccare il codice)

`scadenza`, `max_persone`, `indirizzo`, `info` (note logistiche), `messaggio` (testo WhatsApp:
`{nome}` e `{link}` vengono sostituiti), `telegram` (`si`/`no`).

## Organizzatori

Foglio `Organizzatori`: `ruolo` = `admin` o `viewer`, `attivo` = `si`/`no` per revocare.
Per aggiungerne uno serve un nuovo token: chiedere a Claude/Codex di generarlo.

## Dopo la festa

Cancellare il Google Sheet (o almeno le colonne `telefono` e `note`) e disattivare lo scenario Make.
