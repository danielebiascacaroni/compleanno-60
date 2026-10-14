// Daniele 60 — logica del backend (modulo Code dello scenario Make).
// Input:  input.p      = JSON inviato dalla pagina ({action, ...dati})
//         input.ranges = valueRanges di Sheets: [Invitati!A2:N, Organizzatori!A2:E, Config!A2:B]
// Output: {resp, write, body, notify, text}
//   resp   = JSON da restituire al browser
//   write  = true se va scritto il foglio; body = corpo per values:batchUpdate
//   notify = true se va mandato l'avviso Telegram; text = testo
const parse = v => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch (e) { return null; } };
const P = parse(input.p) || {};
const vr = parse(input.ranges) || [];
const rowsG = (vr[0] && vr[0].values) || [];
const rowsO = (vr[1] && vr[1].values) || [];
const rowsC = (vr[2] && vr[2].values) || [];
const now = new Date().toISOString();

async function sha(t) {
  t = String(t || '');
  if (!t) return '';
  try { return require('crypto').createHash('sha256').update(t).digest('hex'); }
  catch (e) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  }
}
const NL = String.fromCharCode(10);
const clean = (s, n) => [...String(s ?? '')].map(ch => { const c = ch.charCodeAt(0); return (c < 32 && c !== 10) || c === 127 ? ' ' : ch; }).join('').trim().slice(0, n);
const bool = v => v === true || v === 'true';
const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };

const cfg = {};
rowsC.forEach(r => { if (r[0]) cfg[r[0]] = r[1] ?? ''; });
const maxDef = int(cfg.max_persone, 2);
const COLS = ['id', 'nome', 'telefono', 'token_hash', 'stato', 'persone', 'max_persone', 'note',
  'invitato', 'inviato_il', 'aggiornato_il', 'aggiornato_da', 'attivo', 'invitato_da'];
const guests = rowsG.map((r, i) => { const g = { _row: i + 2 }; COLS.forEach((c, j) => g[c] = r[j] ?? ''); return g; });
const orgs = rowsO.map(r => ({ id: r[0], name: r[1], hash: r[2], role: r[3], active: r[4] }));

const out = { resp: '', write: false, body: '', notify: false, text: '' };
const reply = o => { out.resp = JSON.stringify(o); return out; };
const fail = c => reply({ ok: false, error: c });
const writes = [];
const flush = () => { out.write = true; out.body = JSON.stringify({ valueInputOption: 'RAW', data: writes }); };
const write = g => {
  writes.push({ range: `Invitati!A${g._row}:N${g._row}`, values: [COLS.map(c => String(g[c] ?? ''))] });
  flush();
};
// chiavi del foglio Config modificabili dalla pagina organizzatori
const CFG_KEYS = ['titolo', 'data', 'orario', 'indirizzo', 'info', 'scadenza', 'max_persone', 'messaggio', 'telegram'];
const STATUS = ['yes', 'maybe', 'no'];
const LABEL = { yes: 'Sì', maybe: 'Forse', no: 'No', unanswered: 'Mancante' };
const maxOf = g => int(g.max_persone, 0) || maxDef;
const pubGuest = g => ({ name: g.nome, status: g.stato || 'unanswered', party: int(g.persone, 0), notes: g.note, updatedAt: g.aggiornato_il });
const evFor = g => {
  const e = { title: cfg.titolo, date: cfg.data, time: cfg.orario, deadline: cfg.scadenza, maxParty: maxOf(g) };
  if (g.stato === 'yes' || g.stato === 'maybe') { e.address = cfg.indirizzo; e.info = cfg.info; }
  return e;
};
const isOpen = Date.now() < Date.parse(cfg.scadenza || '2000-01-01');
const A = String(P.action || '');

/* ---------- invitato ---------- */
if (A === 'getOwnRSVP' || A === 'saveOwnRSVP') {
  const h = await sha(P.token);
  const g = h && guests.find(x => x.token_hash === h && x.attivo === 'si');
  if (!g) return fail('invalid');
  if (A === 'getOwnRSVP') return reply({ ok: true, guest: pubGuest(g), editable: isOpen, event: evFor(g) });
  if (!isOpen) return fail('closed');
  if (!STATUS.includes(P.status)) return fail('bad_input');
  g.stato = P.status;
  g.persone = String(P.status === 'yes' ? Math.min(Math.max(int(P.party, 1), 1), maxOf(g)) : 0);
  g.note = clean(P.notes, 300);
  g.aggiornato_il = now; g.aggiornato_da = 'invitato';
  write(g);
  if (cfg.telegram === 'si') {
    out.notify = true;
    out.text = `🎂 Daniele 60 — risposta${NL}${NL}👤 ${g.nome}: ${LABEL[g.stato]}` +
      (g.stato === 'yes' ? ` (${g.persone} ${g.persone === '1' ? 'persona' : 'persone'})` : '') +
      (g.note ? `${NL}📝 ${g.note}` : '');
  }
  return reply({ ok: true, guest: pubGuest(g), event: evFor(g) });
}

/* ---------- organizzatori ---------- */
const ah = await sha(P.adminToken);
const me = ah && orgs.find(o => o.hash === ah && o.active === 'si');
if (!me) return fail('unauthorized');

if (A === 'adminDashboard') {
  return reply({ ok: true, me: { name: me.name, role: me.role },
    organizers: orgs.filter(o => o.role === 'admin' && o.active === 'si').map(o => o.name),
    event: { ...evFor({ stato: 'yes' }), maxParty: maxDef, message: cfg.messaggio },
    config: Object.fromEntries(CFG_KEYS.map(k => [k, cfg[k] ?? ''])),
    guests: guests.filter(g => g.id).map(g => ({
      id: g.id, name: g.nome, phone: g.telefono, status: g.stato || 'unanswered', party: int(g.persone, 0),
      maxParty: int(g.max_persone, 0), notes: g.note, sent: g.invitato === 'si', sentAt: g.inviato_il, invitedBy: g.invitato_da,
      hasLink: !!g.token_hash, updatedAt: g.aggiornato_il, updatedBy: g.aggiornato_da, active: g.attivo === 'si' })) });
}
if (me.role !== 'admin') return fail('forbidden');

if (A === 'adminUpsertGuest') {
  let g;
  if (P.guestId) {
    g = guests.find(x => x.id === P.guestId);
    if (!g) return fail('notfound');
  } else {
    if (!clean(P.name, 60)) return fail('bad_input');
    g = { _row: guests.length + 2 };
    COLS.forEach(c => g[c] = '');
    g.id = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    g.stato = 'unanswered'; g.persone = '0'; g.invitato = 'no'; g.attivo = 'si';
  }
  if (P.name !== undefined && clean(P.name, 60)) g.nome = clean(P.name, 60);
  if (P.phone !== undefined) g.telefono = [...clean(P.phone, 20)].filter(ch => '0123456789+ '.includes(ch)).join('');
  if (P.maxParty !== undefined) g.max_persone = String(Math.min(Math.max(int(P.maxParty, maxDef), 1), 10));
  if (P.notes !== undefined) g.note = clean(P.notes, 300);
  if (P.active !== undefined) g.attivo = bool(P.active) ? 'si' : 'no';
  if (P.sent !== undefined) {
    if (!bool(P.sent)) { g.invitato = 'no'; g.inviato_il = ''; g.invitato_da = ''; }
    else { if (g.invitato !== 'si' || !g.invitato_da) g.invitato_da = me.name; g.invitato = 'si'; g.inviato_il = now; }
  }
  if (P.invitedBy !== undefined) {
    const by = clean(P.invitedBy, 60);
    if (by && !orgs.some(o => o.name === by)) return fail('bad_input');
    g.invitato_da = by;
  }
  if (P.status !== undefined) {
    if (![...STATUS, 'unanswered'].includes(P.status)) return fail('bad_input');
    g.stato = P.status;
    g.persone = String(P.status === 'yes' ? Math.min(Math.max(int(P.party, 1), 1), maxOf(g)) : 0);
    g.aggiornato_il = now; g.aggiornato_da = me.name;
  }
  write(g);
  return reply({ ok: true, guestId: g.id });
}

if (A === 'adminSaveConfig') {
  const C = (P.config && typeof P.config === 'object') ? P.config : {};
  let next = rowsC.length + 2;
  for (const k of CFG_KEYS) {
    if (C[k] === undefined) continue;
    let v = clean(C[k], k === 'info' || k === 'messaggio' ? 1500 : 200);
    if ((k === 'data' || k === 'scadenza') && isNaN(Date.parse(v))) return fail('bad_input');
    if (k === 'max_persone') v = String(Math.min(Math.max(int(v, maxDef), 1), 10));
    if (k === 'telegram') v = v === 'si' ? 'si' : 'no';
    const i = rowsC.findIndex(r => r[0] === k);
    const row = i >= 0 ? i + 2 : next++;
    writes.push({ range: `Config!A${row}:B${row}`, values: [[k, v]] });
  }
  if (writes.length) flush();
  return reply({ ok: true });
}

if (A === 'adminSetToken') {
  const g = guests.find(x => x.id === P.guestId);
  if (!g) return fail('notfound');
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(String(P.newToken || ''))) return fail('bad_input');
  g.token_hash = await sha(P.newToken);
  write(g);
  return reply({ ok: true });
}

return fail('unknown');
