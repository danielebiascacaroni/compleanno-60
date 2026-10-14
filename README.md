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

## Modifiche frequenti (senza toccare il codice)

Dalla pagina organizzatori (link `?a=…`, ruolo `admin`) → **⚙️ Impostazioni festa**: modifica tutti
i valori del foglio `Config` con anteprima di ciò che vede l'invitato. In alternativa, direttamente nel foglio `Config`:

`scadenza`, `max_persone`, `indirizzo`, `info` (note logistiche), `messaggio` (testo WhatsApp:
`{nome}` e `{link}` vengono sostituiti), `telegram` (`si`/`no`).

`info` (come `indirizzo`) arriva solo a chi ha risposto Sì o Forse e compare nella scheda di conferma:
una voce per riga, nel formato `Titolo: testo` (a capo dentro la cella: Ctrl+Invio). Le voci
con titolo tipo *Dress code*, *Parcheggi*, *Regali*, *Taxi*, *Contatti* ricevono un'icona.
`data` deve essere in formato ISO (es. `2026-10-30T18:00:00+01:00`) per il pulsante calendario.

## Organizzatori

Nella pagina `?a=…` gli invitati sono in tre gruppi: chi non ha ancora risposto (Forse compresi),
chi non viene, i confermati. Cliccando sulla risposta (es. *Mancante*, *Sì · 2*) un `admin` la cambia a mano.
La colonna `invitato_da` (N) del foglio `Invitati` registra chi ha segnato l'invito come inviato;
si può correggere da **Modifica → Invitato da**.

Foglio `Organizzatori`: `ruolo` = `admin` o `viewer`, `attivo` = `si`/`no` per revocare.
Per aggiungerne uno serve un nuovo token: chiedere a Claude/Codex di generarlo.

## Dopo la festa

Cancellare il Google Sheet (o almeno le colonne `telefono` e `note`) e disattivare lo scenario Make.
