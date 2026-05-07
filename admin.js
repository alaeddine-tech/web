
const API = 'http://localhost/cabinet/back-end/api1.php';
 

async function api(endpoint, method = 'GET', data = null) {
  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (data) opts.body = JSON.stringify(data);
    const res = await fetch(`${API}?url=${endpoint}`, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur serveur' }));
      throw new Error(err.error || 'Erreur serveur');
    }
    return await res.json();
  } catch (e) {
    toast(e.message || 'Erreur de connexion', 'danger');
    return null;
  }
}
 
/* ── IN-MEMORY CACHE ────────────────────────────────────── */
let DB = {
  medecins: [], patients: [], rdvs: [],
  consultations: [], demandes: [], prescriptions: [], medicaments: []
};
 
async function loadAll() {
  const [med, pat, rdv, con, rx, dem, meds] = await Promise.all([
    api('medecins'), api('patients'), api('rdvs'),
    api('consultations'), api('prescriptions'), api('demandes'), api('medicaments'),
  ]);
  DB.medecins      = med   || [];
  DB.patients      = pat   || [];
  DB.rdvs          = rdv   || [];
  DB.consultations = con   || [];
  DB.prescriptions = rx    || [];
  DB.demandes      = dem   || [];
  DB.medicaments   = meds  || [];
}
 
async function refresh(store) {
  const d = await api(store);
  if (d) DB[store] = d;
}
 
/* ── i18n ────────────────────────────────────────────────── */
const T = {
  fr:{ nav_dashboard:'Tableau de bord',nav_dem:'Demandes patients',nav_med:'Médecins',
       nav_pat:'Patients',nav_rdv:'Rendez-vous',nav_cons:'Consultations',nav_rx:'Prescriptions',
       nav_profil:'Mon profil',nav_myrdv:'Mes rendez-vous',nav_mydem:'Demandes patients',
       nav_mycons:'Mes consultations',nav_myrx:'Mes prescriptions',nav_meds:'Médicaments',
       nav_pwd:'Mots de passe',today_rdv:'RDV du jour',
       days:['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'],
       months:['janvier','février','mars','avril','mai','juin','juillet','août',
               'septembre','octobre','novembre','décembre'] },
  en:{ nav_dashboard:'Dashboard',nav_dem:'Patient Requests',nav_med:'Doctors',
       nav_pat:'Patients',nav_rdv:'Appointments',nav_cons:'Consultations',nav_rx:'Prescriptions',
       nav_profil:'My Profile',nav_myrdv:'My Appointments',nav_mydem:'Patient Requests',
       nav_mycons:'My Consultations',nav_myrx:'My Prescriptions',nav_meds:'Medicines',
       nav_pwd:'Passwords',today_rdv:"Today's Appts",
       days:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
       months:['January','February','March','April','May','June','July','August',
               'September','October','November','December'] },
  ar:{ nav_dashboard:'لوحة التحكم',nav_dem:'طلبات المرضى',nav_med:'الأطباء',
       nav_pat:'المرضى',nav_rdv:'المواعيد',nav_cons:'الاستشارات',nav_rx:'الوصفات',
       nav_profil:'ملفي',nav_myrdv:'مواعيدي',nav_mydem:'طلبات المرضى',
       nav_mycons:'استشاراتي',nav_myrx:'وصفاتي',nav_meds:'الأدوية',
       nav_pwd:'كلمات المرور',today_rdv:'مواعيد اليوم',
       days:['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'],
       months:['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس',
               'سبتمبر','أكتوبر','نوفمبر','ديسمبر'] }
};
let LANG = 'fr';
let _activePage = 'dashboard'; // ── FIX: track current page for lang switch
 
function t(k) { return T[LANG][k] || T.fr[k] || k; }
 
function setLang(lang, btn) {
  LANG = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('.lp').forEach(b =>
    b.classList.toggle('active', b.textContent.trim().toLowerCase() === lang));
  if (CU) {
    buildNav();
    renderDateStr();
    goPage(_activePage); // ── FIX: re-render active page in new language
  }
}
 
function renderDateStr() {
  const n = new Date(), el = document.getElementById('dw-date');
  if (el) el.textContent =
    `${t('days')[n.getDay()]} ${n.getDate()} ${t('months')[n.getMonth()]} ${n.getFullYear()}`;
}
 
/* ── CONSTANTS ───────────────────────────────────────────── */
const MOTIFS = [
  'Consultation générale','Contrôle de routine','Douleur thoracique',
  'Céphalées / Migraines','Fièvre persistante','Douleurs abdominales',
  'Troubles du sommeil','Suivi diabète','Suivi tension artérielle','Vaccination',
  'Bilan de santé','Consultation psychiatrique','Dermatologie','Problèmes respiratoires',
  'Douleurs articulaires','Consultation pédiatrique','Gynécologie','Ophtalmologie',
  'ORL','Urgence médicale','Renouvellement ordonnance','Autre',
];
const SPECS = [
  'Médecine générale','Cardiologie','Pédiatrie','Gynécologie-Obstétrique',
  'Neurologie','Psychiatrie','Dermatologie','Orthopédie','Ophtalmologie',
  'ORL','Gastro-entérologie','Endocrinologie','Pneumologie','Urologie',
  'Chirurgie générale','Radiologie','Anesthésiologie','Médecine interne',
];
const MED_FORMES = ['Comprimé','Gélule','Sirop','Injectable','Pommade','Crème',
  'Suppositoire','Gouttes','Spray','Patch','Sachet','Ampoule'];
const MED_CATS = ['Analgésique','Antibiotique','Anti-inflammatoire','Antihypertenseur',
  'Antidiabétique','Antihistaminique','Antiviral','Cardiovasculaire','Dermatologie',
  'Gastro-entérologie','Neurologie','Pédiatrie','Vitamines / Suppléments','Autre'];
const COLORS = ['#16a34a','#059669','#0d9488','#0891b2','#6366f1','#9333ea','#c026d3','#db2777'];
 
const uid  = () => Math.random().toString(36).slice(2, 9);
const today= () => new Date().toISOString().slice(0, 10);
const fmt  = d  => {
  if (!d) return '—';
  const locale = LANG === 'ar' ? 'ar-DZ' : LANG === 'en' ? 'en-GB' : 'fr-FR';
  return new Date(d + 'T00:00:00').toLocaleDateString(locale);
};
const san  = s  => String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
 
/* ══════════════════════════════════════════════════════════
   AUTH  ── THE LOGIN BUG FIX IS HERE
   Problem: admin.html previously had ONE doLogin() called
   for both roles.  Now we properly switch roles via
   setLoginRole() and send the correct role to the API.
══════════════════════════════════════════════════════════ */
let selectedRole = 'admin';
let CU = null;
 
function setLoginRole(role, btn) {
  selectedRole = role;
  // Update tabs
  document.querySelectorAll('.lc-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Update icon & label
  const cfg = {
    admin:   { icon: 'reglages.png', label: 'Administration',
               bg: 'linear-gradient(135deg,#16a34a,#166534)' },
    medecin: { icon: '', label: 'Médecin',
               bg: 'linear-gradient(135deg,#16a34a,#0d9488)' },
  }[role];
  const iconEl = document.getElementById('lc-icon');
  iconEl.textContent = cfg.icon;
  iconEl.style.background = cfg.bg;
  document.getElementById('lc-role-lbl').textContent = cfg.label;
  document.getElementById('lc-err').textContent = '';
}
 
async function doLogin() {
  const u    = document.getElementById('l-user').value.trim();
  const p    = document.getElementById('l-pass').value.trim();
  const errEl = document.getElementById('lc-err');
  errEl.textContent = '';
 
  if (!u || !p) {
    errEl.textContent = 'Identifiant et mot de passe requis.';
    return;
  }
 
  // Disable button while logging in
  const btn = document.getElementById('lc-btn');
  btn.disabled = true;
  btn.textContent = 'Connexion…';
 
  const res = await api('login', 'POST', { user: u, pass: p, role: selectedRole });
 
  btn.disabled = false;
  btn.textContent = 'Se connecter';
 
  if (!res || !res.success) {
    errEl.textContent = 'Identifiant ou mot de passe incorrect.';
    return;
  }
 
  if (selectedRole === 'admin') {
    CU = { role: 'admin', nom: 'Administrateur', avatar: '', color: '#16a34a' };
  } else {
    CU = {
      role: 'medecin',
      nom:  res.nom,
      avatar: '',
      color:  res.color || '#16a34a',
      medecinId: res.id,
      spec: res.spec,
    };
  }
 
  await loadAll();
  startApp();
}
 
// Allow Enter key to submit
document.getElementById('l-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});
document.getElementById('l-user').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});
 
function doLogout() {
  CU = null;
  document.getElementById('app').classList.remove('show');
  document.getElementById('login-screen').classList.add('show');
  document.getElementById('l-user').value = '';
  document.getElementById('l-pass').value = '';
  document.getElementById('lc-err').textContent = '';
}
 
/* ── APP START ───────────────────────────────────────────── */
function startApp() {
  document.getElementById('login-screen').classList.remove('show');
  document.getElementById('app').classList.add('show');
  document.getElementById('sb-av').textContent = '';
  document.getElementById('sb-av').style.background = 'none';
  document.getElementById('sb-name').textContent = CU.nom;
  document.getElementById('sb-role-txt').textContent =
    CU.role === 'admin' ? 'Administrateur' : 'Médecin – ' + CU.spec;
  const b = document.getElementById('sb-bdg');
  b.textContent = CU.role === 'admin' ? 'Admin' : 'Médecin';
  b.style.cssText = 'background:rgba(34,197,94,.2);color:#86efac';
  buildNav();
  goPage('dashboard');
  setInterval(() => {
    const c = document.getElementById('tb-clock');
    if (c) c.textContent = new Date().toLocaleTimeString('fr-FR',
      { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, 1000);
}
 
function buildNav() {
  const pend   = DB.demandes.filter(d => d.statut === 'En attente').length;
  const myPend = CU.role === 'medecin'
    ? DB.demandes.filter(d =>
        (d.medecinId === CU.medecinId || !d.medecinId) &&
        d.statut === 'En attente').length
    : 0;
 
  const adminN = [
    { id: 'dashboard',     icon: '', k: 'nav_dashboard' },
    { id: 'demandes',      icon: '', k: 'nav_dem',   badge: pend },
    { id: 'medecins',      icon: '', k: 'nav_med' },
    { id: 'patients',      icon: '', k: 'nav_pat' },
    { id: 'rdv',           icon: '', k: 'nav_rdv' },
    { id: 'consultations', icon: '', k: 'nav_cons' },
    { id: 'prescriptions', icon: '', k: 'nav_rx' },
    { id: 'medicaments',   icon: '', k: 'nav_meds' },
    { id: 'passwords',     icon: '', k: 'nav_pwd' },
  ];
  const medN = [
    { id: 'dashboard',        icon: '', k: 'nav_dashboard' },
    { id: 'mesdemandes',      icon: '', k: 'nav_mydem', badge: myPend },
    { id: 'monprofil',        icon: '', k: 'nav_profil' },
    { id: 'mesrdv',           icon: '', k: 'nav_myrdv' },
    { id: 'mesconsult',       icon: '', k: 'nav_mycons' },
    { id: 'mesprescriptions', icon: '', k: 'nav_myrx' },
    { id: 'patients',         icon: '', k: 'nav_pat' },
  ];
 
  const pages = CU.role === 'admin' ? adminN : medN;
  document.getElementById('sb-nav').innerHTML = pages.map(p => `
    <button class="nav-btn" data-page="${p.id}" onclick="goPage('${p.id}')">
      <span class="nav-ic">${p.icon}</span>
      <span>${t(p.k)}</span>
      ${p.badge ? `<span class="notif-dot">${p.badge}</span>` : ''}
    </button>`).join('');
}
 
function goPage(id) {
  _activePage = id; // ── FIX: track so setLang can re-render
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('pg-' + id)?.classList.add('active');
  const btn = document.querySelector(`[data-page="${id}"]`);
  if (btn) {
    btn.classList.add('active');
    document.getElementById('tb-title').textContent =
      btn.querySelector('span:last-of-type')?.textContent || '';
  }
  document.getElementById('sidebar').classList.remove('open');
  const map = {
    dashboard:        renderDash,
    demandes:         renderDemandes,
    mesdemandes:      renderMesDemandes,
    medecins:         () => renderTbl('medecin'),
    patients:         () => renderTbl('patient'),
    rdv:              () => renderTbl('rdv'),
    consultations:    () => renderTbl('consultation'),
    prescriptions:    () => renderRx(false),
    monprofil:        renderMonProfil,
    mesrdv:           () => renderTbl('mesrdv'),
    mesconsult:       () => renderTbl('mesconsult'),
    mesprescriptions: () => renderRx(true),
    medicaments:      renderMeds,
    passwords:        renderPasswords,
  };
  (map[id] || (() => {}))();
}
 
/* ── DASHBOARD ───────────────────────────────────────────── */
async function renderDash() {
  renderDateStr();
  document.getElementById('dw-title').textContent =
    'Bonjour, ' + CU.nom.split(' ')[0] + ' !';
 
  const stats   = await api('dashboard') || {};
  const todayStr = today();
  const myRdvs  = CU.role === 'admin'
    ? DB.rdvs
    : DB.rdvs.filter(r => r.medecinId === CU.medecinId);
 
  const kpis = CU.role === 'admin' ? [
    { icon:'', val: stats.medecins,      lbl: t('nav_med'),   color:'var(--g600)', page:'medecins' },
    { icon:'', val: stats.patients,      lbl: t('nav_pat'),   color:'#0891b2',     page:'patients' },
    { icon:'', val: stats.dem_pending,   lbl: t('nav_dem'),   color:'#d97706',     page:'demandes' },
    { icon:'', val: stats.rdvs_today,    lbl: t('today_rdv'), color:'#9333ea',     page:'rdv' },
    { icon:'', val: stats.prescriptions, lbl: t('nav_rx'),    color:'#db2777',     page:'prescriptions' },
  ] : [
    { icon:'', val: DB.demandes.filter(d=>(d.medecinId===CU.medecinId||!d.medecinId)&&d.statut==='En attente').length,
      lbl:t('nav_mydem'), color:'#d97706', page:'mesdemandes' },
    { icon:'', val: myRdvs.filter(r=>r.date===todayStr).length,
      lbl:t('today_rdv'), color:'var(--g600)', page:'mesrdv' },
    { icon:'', val: DB.consultations.filter(c=>c.medecinId===CU.medecinId).length,
      lbl:t('nav_mycons'), color:'#0891b2', page:'mesconsult' },
    { icon:'', val: DB.prescriptions.filter(p=>p.medecinId===CU.medecinId).length,
      lbl:t('nav_myrx'), color:'#9333ea', page:'mesprescriptions' },
  ];
 
  document.getElementById('kpi-grid').innerHTML = kpis.map(k =>
    `<div class="kpi" onclick="goPage('${k.page}')">
      <div class="kpi-ic">${k.icon}</div>
      <div class="kpi-v" style="color:${k.color}">${k.val ?? 0}</div>
      <div class="kpi-l">${k.lbl}</div>
      <div class="kpi-bar" style="background:${k.color}"></div>
    </div>`
  ).join('');
 
  const tr = myRdvs.filter(r => r.date === todayStr);
  document.getElementById('rdv-today').innerHTML = tr.length
    ? tr.slice(0, 5).map(r => {
        const p = getP(r.patientId), m = getM(r.medecinId);
        return `<div class="rdv-r">
          <div class="rdv-t">${r.heure?.slice(0,5)}</div>
          <div style="flex:1">
            <div class="rdv-n">${san(p.nom)}</div>
            <div class="rdv-s">${san(r.motif)}${CU.role==='admin'?' · '+san(m.nom):''}</div>
          </div>
          ${statBadge(r.statut)}
        </div>`;
      }).join('')
    : `<div style="text-align:center;padding:20px;color:var(--gray300);font-size:13px">—</div>`;
 
  const rd = DB.demandes.filter(d => d.statut === 'En attente').slice(-4);
  document.getElementById('dem-recent').innerHTML = rd.length
    ? rd.map(d =>
        `<div class="act-r">
          <div class="act-d" style="background:var(--warn)"></div>
          <div>
            <div class="act-t">${san(d.nom)} — ${san(d.motif)}</div>
            <div class="act-m">${fmt(d.inscrit)} · ${statBadge(d.statut)}</div>
          </div>
        </div>`
      ).join('')
    : `<div style="color:var(--gray300);font-size:13px;text-align:center;padding:20px">—</div>`;
}
 
/* ── HELPERS ─────────────────────────────────────────────── */
const getP = id => DB.patients.find(p => p.id === id) || { nom: '—', sexe: '' };
const getM = id => DB.medecins.find(m => m.id === id) || { nom: '—', color: '#888' };
 
function av(name, color, sz = 30) {
  return '';
}
function urgBadge(u) {
  if (u === 'Urgent')     return '<span class="badge b-red">🔴 Urgent</span>';
  if (u === 'Très urgent')return '<span class="badge b-red">🚨 Très urgent</span>';
  return '<span class="badge b-gray">⚪ Normal</span>';
}
function statBadge(s) {
  const m = { Confirmé:'b-green','En attente':'b-warn', Annulé:'b-red', Terminé:'b-blue' };
  return `<span class="badge ${m[s]||'b-gray'}">${s}</span>`;
}
 
/* ── DEMANDES ────────────────────────────────────────────── */
async function renderDemandes() {
  await refresh('demandes');
  renderDemList('dem-list', DB.demandes,
    document.getElementById('f-dem-s')?.value || '');
}
async function renderMesDemandes() {
  await refresh('demandes');
  renderDemList(
    'mes-dem-list',
    DB.demandes.filter(d => d.medecinId === CU.medecinId || !d.medecinId),
    document.getElementById('f-md-s')?.value || ''
  );
}
function renderDemList(cid, dems, fs) {
  const list = document.getElementById(cid);
  const ord  = { 'En attente': 0, 'Accepté': 1, 'Refusé': 2 };
  let filtered = (fs ? dems.filter(d => d.statut === fs) : dems)
    .sort((a, b) => (ord[a.statut] ?? 1) - (ord[b.statut] ?? 1));
  if (!filtered.length) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--gray300)">—</div>`;
    return;
  }
  list.innerHTML = filtered.map(d => {
    const rc  = COLORS[Math.abs((d.nom.charCodeAt(0)||0)+(d.nom.charCodeAt(1)||0)) % COLORS.length];
    const med = d.medecinId ? DB.medecins.find(m => m.id === d.medecinId) : null;
    return `<div class="dem-card ${d.statut==='En attente'?'pending':d.statut==='Accepté'?'accepted':'rejected'}">
      <div style="flex:1;min-width:0">
        <div class="dem-name">${san(d.nom)}</div>
        <div class="dem-detail">
          📞 ${san(d.tel||'—')} &nbsp;·&nbsp;  <strong>${fmt(d.date)}</strong>
          &nbsp;·&nbsp; ${urgBadge(d.urgence)}<br/>
          ${med ? `👨‍⚕️ ${san(med.nom)} – ${san(med.spec)}` : ' Indifférent'}
        </div>
        <div class="dem-mtag">${san(d.motif)}</div>
        ${d.msg ? `<div style="font-size:12px;color:var(--gray400);margin-top:5px;font-style:italic">"${san(d.msg)}"</div>` : ''}
        ${d.noteReponse && d.statut !== 'En attente'
          ? `<div style="font-size:12px;color:var(--gray500);margin-top:5px">💬 ${san(d.noteReponse)}</div>` : ''}
        <div style="font-size:11px;color:var(--gray300);margin-top:5px">📝 ${fmt(d.inscrit)}</div>
      </div>
      <div class="dem-actions">
        ${d.statut === 'En attente'
          ? `<button class="btn btn-success btn-sm" onclick="handleDem('${d.id}','Accepté')"> Accepter</button>
             <button class="btn btn-danger  btn-sm" onclick="handleDem('${d.id}','Refusé')"> Refuser</button>`
          : `<span class="badge ${d.statut==='Accepté'?'b-green':'b-red'}">
               ${d.statut==='Accepté'?'✅':'❌'} ${d.statut}
             </span>`}
      </div>
    </div>`;
  }).join('');
}
 
async function handleDem(id, action) {
  const d = DB.demandes.find(x => x.id === id);
  if (!d) return;
  const note = action === 'Accepté'
    ? (prompt(`Note pour ${d.nom} :`) || 'Votre rendez-vous a été confirmé.')
    : (prompt('Raison du refus :')    || 'Nous ne pouvons pas honorer cette demande.');
  const r = await api(`demandes&id=${id}`, 'PUT', { statut: action, noteReponse: note });
  if (!r) return;
  if (action === 'Accepté') {
    const pat = DB.patients.find(p => p.id === d.patientId);
    if (pat) {
      await api('rdvs', 'POST', {
        id: uid(), patientId: pat.id,
        medecinId: d.medecinId || DB.medecins[0]?.id,
        date: d.date, heure: '09:00',
        motif: d.motif, urgence: d.urgence,
        statut: 'Confirmé', inscrit: today(),
      });
      await refresh('rdvs');
    }
  }
  await refresh('demandes');
  buildNav();
  CU.role === 'admin' ? renderDemandes() : renderMesDemandes();
  toast(action === 'Accepté' ? 'Accepté – RDV créé !' : 'Refusé.',
        action === 'Accepté' ? 'success' : 'warn');
}
 
/* ── TABLES ──────────────────────────────────────────────── */
async function renderTbl(type) {
  const storeMap = {
    medecin:'medecins', patient:'patients',
    rdv:'rdvs', mesrdv:'rdvs',
    consultation:'consultations', mesconsult:'consultations',
  };
  if (storeMap[type]) await refresh(storeMap[type]);
  const q = id => (document.getElementById('s-' + id)?.value || '').toLowerCase();
 
  if (type === 'medecin') {
    const rows = DB.medecins.filter(m =>
      !q('medecin') || (m.nom + m.spec + m.email).toLowerCase().includes(q('medecin')));
    document.getElementById('tb-medecin').innerHTML = rows.length
      ? rows.map(m => `<tr>
          <td><div class="cell-av">${av(m.nom, m.color)}
            <div><div style="font-weight:600">${san(m.nom)}</div>
            <div style="font-size:11px;color:var(--gray400)">${m.user}</div></div>
          </div></td>
          <td><span class="badge b-green">${san(m.spec)}</span></td>
          <td>${m.tel||'—'}</td>
          <td style="font-size:12px;color:var(--gray400)">${m.email||'—'}</td>
          <td><code style="font-size:11px;background:var(--g50);padding:3px 8px;border-radius:6px;color:var(--g700);border:1px solid var(--g200)">${m.user}</code></td>
          <td>${m.actif==1?'<span class="badge b-green">Actif</span>':'<span class="badge b-red">Inactif</span>'}</td>
          <td><div class="td-actions">
            <button class="btn btn-warn btn-sm"   onclick="openModal('medecin','${m.id}')">✏</button>
            <button class="btn btn-danger btn-sm" onclick="delRow('medecin','${m.id}')">✕</button>
          </div></td>
        </tr>`).join('')
      : `<tr><td class="empty-td" colspan="7">—</td></tr>`;
  }
  else if (type === 'patient') {
    const fs   = document.getElementById('f-p-sex')?.value || '';
    const rows = DB.patients.filter(p =>
      (!q('patient') || (p.nom + p.tel).toLowerCase().includes(q('patient'))) &&
      (!fs || p.sexe === fs));
    document.getElementById('tb-patient').innerHTML = rows.length
      ? rows.map(p => `<tr>
          <td><div class="cell-av">${av(p.nom, p.sexe==='Féminin'?'#db2777':'#16a34a')}
            <span style="font-weight:600">${san(p.nom)}</span>
          </div></td>
          <td><span class="badge ${p.sexe==='Féminin'?'b-purple':'b-green'}">${p.sexe||'—'}</span></td>
          <td>${fmt(p.naissance)}</td>
          <td>${p.tel||'—'}</td>
          <td style="font-size:12px;color:var(--gray400)">${p.email||'—'}</td>
          <td><span class="badge b-gray">📅 ${fmt(p.inscrit)}</span></td>
          <td><div class="td-actions">
            <button class="btn btn-warn btn-sm"   onclick="openModal('patient','${p.id}')">✏</button>
            <button class="btn btn-danger btn-sm" onclick="delRow('patient','${p.id}')">✕</button>
          </div></td>
        </tr>`).join('')
      : `<tr><td class="empty-td" colspan="7">—</td></tr>`;
  }
  else if (type === 'rdv' || type === 'mesrdv') {
    const isMe = type === 'mesrdv';
    const fs   = document.getElementById('f-rdv-s')?.value || '';
    const rows = (isMe ? DB.rdvs.filter(r => r.medecinId === CU.medecinId) : DB.rdvs)
      .filter(r => {
        const p = getP(r.patientId), m = getM(r.medecinId);
        return (!q(type) || (p.nom + m.nom + r.motif).toLowerCase().includes(q(type)))
            && (!fs || r.statut === fs);
      });
    document.getElementById('tb-' + type).innerHTML = rows.length
      ? rows.map(r => {
          const p = getP(r.patientId), m = getM(r.medecinId);
          return `<tr>
            <td><div class="cell-av">${av(p.nom, p.sexe==='Féminin'?'#db2777':'#16a34a')}
              <span style="font-weight:600">${san(p.nom)}</span>
            </div></td>
            ${!isMe ? `<td><div class="cell-av">${av(m.nom, m.color)}<span>${san(m.nom)}</span></div></td>` : ''}
            <td><strong>${fmt(r.date)}</strong></td>
            <td><span class="badge b-green">🕐 ${r.heure?.slice(0,5)}</span></td>
            <td style="font-size:13px">${san(r.motif||'—')}</td>
            <td>${urgBadge(r.urgence)}</td>
            <td>${statBadge(r.statut)}</td>
            <td style="font-size:11px;color:var(--gray300)">📝 ${fmt(r.inscrit)}</td>
            <td><div class="td-actions">
              ${isMe ? `<button class="btn btn-success btn-sm" onclick="markDone('${r.id}')">✔</button>` : ''}
              <button class="btn btn-warn btn-sm"   onclick="openModal('rdv','${r.id}')">✏</button>
              <button class="btn btn-danger btn-sm" onclick="delRow('rdv','${r.id}')">✕</button>
            </div></td>
          </tr>`;
        }).join('')
      : `<tr><td class="empty-td" colspan="${isMe ? 8 : 9}">—</td></tr>`;
  }
  else if (type === 'consultation' || type === 'mesconsult') {
    const isMe = type === 'mesconsult';
    const rows = (isMe
      ? DB.consultations.filter(c => c.medecinId === CU.medecinId)
      : DB.consultations
    ).filter(c => {
      const p = getP(c.patientId);
      return !q(type) || (p.nom + (c.diagnostic || '')).toLowerCase().includes(q(type));
    });
    document.getElementById('tb-' + type).innerHTML = rows.length
      ? rows.map(c => {
          const p = getP(c.patientId), m = getM(c.medecinId);
          return `<tr>
            <td><div class="cell-av">${av(p.nom, '#16a34a')}
              <span style="font-weight:600">${san(p.nom)}</span>
            </div></td>
            ${!isMe ? `<td><div class="cell-av">${av(m.nom, m.color)}<span>${san(m.nom)}</span></div></td>` : ''}
            <td><strong>${fmt(c.date)}</strong></td>
            <td>${san(c.motif||'—')}</td>
            <td style="max-width:160px">${san(c.diagnostic||'—')}</td>
            <td style="color:var(--g700)">${san(c.traitement||'—')}</td>
            <td><div class="td-actions">
              <button class="btn btn-warn btn-sm"   onclick="openModal('consultation','${c.id}')">✏</button>
              <button class="btn btn-danger btn-sm" onclick="delRow('consultation','${c.id}')">✕</button>
            </div></td>
          </tr>`;
        }).join('')
      : `<tr><td class="empty-td" colspan="${isMe ? 6 : 7}">—</td></tr>`;
  }
}
 
async function markDone(id) {
  const r = await api(`rdvs&id=${id}`, 'PUT', { statut: 'Terminé' });
  if (r) { await refresh('rdvs'); renderTbl('mesrdv'); toast('RDV terminé ✓', 'success'); }
}
 
/* ── PRESCRIPTIONS ───────────────────────────────────────── */
async function renderRx(onlyMine) {
  await refresh('prescriptions');
  const cid = onlyMine ? 'mes-rx-list' : 'rx-list';
  const q   = (document.getElementById(onlyMine ? 's-mesprescriptions' : 's-prescription')?.value || '').toLowerCase();
  const rows = (onlyMine
    ? DB.prescriptions.filter(p => p.medecinId === CU.medecinId)
    : DB.prescriptions
  ).filter(rx => {
    const p = getP(rx.patientId);
    return !q || (p.nom + rx.motif + rx.medicaments).toLowerCase().includes(q);
  });
  document.getElementById(cid).innerHTML = rows.length
    ? rows.map(rx => {
        const p = getP(rx.patientId), m = getM(rx.medecinId);
        return `<div class="rx-card">
          <div class="rx-icon">💊</div>
          <div class="rx-info">
            <div class="rx-title">${san(p.nom)}
              <span style="font-weight:400;color:var(--gray400);font-size:12px">— ${san(m.nom)}</span>
            </div>
            <div class="rx-meta">📅 ${fmt(rx.date)} · ${san(rx.motif||'—')}</div>
            <div class="rx-drugs">${san(rx.medicaments||'—')}</div>
            ${rx.notes ? `<div style="font-size:12px;color:var(--gray400);margin-top:6px;font-style:italic">📝 ${san(rx.notes)}</div>` : ''}
          </div>
          <div class="rx-acts">
            <button class="btn btn-print btn-sm" onclick="printRx('${rx.id}')">🖨 Imprimer</button>
            <button class="btn btn-warn btn-sm"  onclick="openModal('prescription','${rx.id}')">✏</button>
            <button class="btn btn-danger btn-sm" onclick="delRow('prescription','${rx.id}')">✕</button>
          </div>
        </div>`;
      }).join('')
    : `<div style="text-align:center;padding:40px;color:var(--gray300)">Aucune prescription.</div>`;
}
 
function printRx(id) {
  const rx = DB.prescriptions.find(x => x.id === id);
  if (!rx) return;
  const p = getP(rx.patientId), m = getM(rx.medecinId);
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>Ordonnance</title>
  <style>body{font-family:Georgia,serif;padding:48px 56px;color:#111}
  h1{color:#14532d;border-bottom:3px solid #16a34a;padding-bottom:14px;margin-bottom:28px}
  .rx{font-size:28px;font-weight:700;letter-spacing:4px;color:#14532d;text-align:center;margin:24px 0}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  td{padding:8px;border-bottom:1px solid #d1fae5}
  .drug{margin:16px 0;padding-left:20px;border-left:3px solid #16a34a}
  .sig{margin-top:60px;text-align:right;border-top:1px solid #d1fae5;padding-top:20px}
  @media print{@page{margin:15mm}}</style></head><body>
  <h1>⚕ Al Shifa — ${san(m.nom)} (${san(m.spec)})</h1>
  <div class="rx">R X</div>
  <table>
    <tr><td><strong>Patient :</strong> ${san(p.nom)}</td><td><strong>Date :</strong> ${fmt(rx.date)}</td></tr>
    ${rx.motif ? `<tr><td colspan="2"><strong>Motif :</strong> ${san(rx.motif)}</td></tr>` : ''}
  </table>
  ${(rx.medicaments||'').split('\n').filter(l=>l.trim())
    .map((l,i)=>`<div class="drug"><strong>${i+1}.</strong> ${san(l)}</div>`).join('')}
  ${rx.notes ? `<div style="margin-top:20px;padding:14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px">
    <strong>⚠ Instructions :</strong> ${san(rx.notes)}</div>` : ''}
  <div class="sig">
    <p>Ouargla, le ${fmt(rx.date)}</p>
    <p style="margin-top:40px;border-top:2px solid #16a34a;padding-top:8px;display:inline-block;min-width:200px">Signature et cachet</p>
  </div>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}
 
/* ── MON PROFIL ──────────────────────────────────────────── */
async function renderMonProfil() {
  await refresh('medecins');
  const m = DB.medecins.find(x => x.id === CU.medecinId);
  if (!m) return;
  const mr = DB.rdvs.filter(r => r.medecinId === m.id);
  const mc = DB.consultations.filter(c => c.medecinId === m.id);
  const mp = DB.prescriptions.filter(p => p.medecinId === m.id);
  document.getElementById('profil-content').innerHTML = `
    <div style="background:linear-gradient(135deg,${m.color},${m.color}88);border-radius:16px;padding:24px 28px;color:#fff;margin-bottom:24px;display:flex;align-items:center;gap:18px">
      ${av(m.nom, m.color, 56)}
      <div>
        <div style="font-size:20px;font-weight:700">${san(m.nom)}</div>
        <div style="font-size:13px;opacity:.75">${san(m.spec)} · ${m.tel||''} ${m.email?'· '+m.email:''}</div>
      </div>
    </div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-ic">📅</div><div class="kpi-v" style="color:var(--g600)">${mr.length}</div><div class="kpi-l">RDV</div></div>
      <div class="kpi"><div class="kpi-ic">📋</div><div class="kpi-v" style="color:#0891b2">${mc.length}</div><div class="kpi-l">Consultations</div></div>
      <div class="kpi"><div class="kpi-ic">💊</div><div class="kpi-v" style="color:#9333ea">${mp.length}</div><div class="kpi-l">Prescriptions</div></div>
      <div class="kpi"><div class="kpi-ic">✅</div><div class="kpi-v" style="color:var(--g600)">${mr.filter(r=>r.statut==='Terminé').length}</div><div class="kpi-l">Terminés</div></div>
    </div>
    <div style="margin-top:16px">
      <button class="btn btn-warn" onclick="openModal('editProfil','${m.id}')">✏ Modifier mon profil</button>
    </div>`;
}
 
/* ── MÉDICAMENTS ─────────────────────────────────────────── */
async function renderMeds() {
  await refresh('medicaments');
  const q      = (document.getElementById('s-medicament')?.value || '').toLowerCase();
  const cat    = document.getElementById('f-med-cat')?.value  || '';
  const stockF = document.getElementById('f-med-stock')?.value || '';
  const rows   = DB.medicaments.filter(m => {
    const qMatch = !q || (m.nom + m.dosage + m.categorie + m.fournisseur).toLowerCase().includes(q);
    const cMatch = !cat    || m.categorie === cat;
    const sMatch = !stockF
      || (stockF === 'ok'  && m.stock > m.seuil)
      || (stockF === 'low' && m.stock > 0 && m.stock <= m.seuil)
      || (stockF === 'out' && m.stock == 0);
    return qMatch && cMatch && sMatch;
  });
  const all    = DB.medicaments;
  const total  = all.length;
  const inStock= all.filter(m => m.stock >  m.seuil).length;
  const low    = all.filter(m => m.stock >  0 && m.stock <= m.seuil).length;
  const out    = all.filter(m => m.stock == 0).length;
 
  document.getElementById('meds-summary').innerHTML = `
    <div class="med-sum-card"><div class="med-sum-val">${total}</div><div class="med-sum-lbl">Total</div></div>
    <div class="med-sum-card" style="border-color:var(--g200)"><div class="med-sum-val" style="color:var(--g600)">${inStock}</div><div class="med-sum-lbl">En stock</div></div>
    <div class="med-sum-card" style="border-color:#fde68a"><div class="med-sum-val" style="color:#b45309">${low}</div><div class="med-sum-lbl">Stock faible</div></div>
    <div class="med-sum-card" style="border-color:#fecaca"><div class="med-sum-val" style="color:var(--danger)">${out}</div><div class="med-sum-lbl">Épuisés</div></div>`;
 
  const tb = document.getElementById('tb-medicaments');
  if (!rows.length) { tb.innerHTML = `<tr><td class="empty-td" colspan="9">Aucun médicament.</td></tr>`; return; }
 
  tb.innerHTML = rows.map(m => {
    const sc  = m.stock == 0 ? 'stock-out' : m.stock <= m.seuil ? 'stock-low' : 'stock-ok';
    const slb = m.stock == 0 ? '⛔ Épuisé'  : m.stock <= m.seuil ? `⚠ ${m.stock}` : m.stock;
    return `<tr>
      <td><div style="font-weight:600">${san(m.nom)}</div>
          <div style="font-size:11px;color:var(--gray400)">${san(m.description||'')}</div></td>
      <td><span class="badge b-green">${san(m.categorie)}</span></td>
      <td><code style="font-size:12px;background:var(--g50);padding:2px 8px;border-radius:5px;color:var(--g700);border:1px solid var(--g200)">${san(m.dosage)}</code></td>
      <td><span class="badge b-gray">${san(m.forme)}</span></td>
      <td><span class="badge ${sc}">${slb}</span></td>
      <td>${m.seuil}</td>
      <td style="font-weight:600;color:var(--g700)">${m.prix ? m.prix + ' DA' : '—'}</td>
      <td style="font-size:12px;color:var(--gray400)">${san(m.fournisseur||'—')}</td>
      <td><div class="td-actions">
        <button class="btn btn-success btn-sm" onclick="openModal('ajustStock','${m.id}')" title="Stock">📦</button>
        <button class="btn btn-warn btn-sm"    onclick="openModal('medicament','${m.id}')">✏</button>
        <button class="btn btn-danger btn-sm"  onclick="delMed('${m.id}')">✕</button>
      </div></td>
    </tr>`;
  }).join('');
}
 
async function delMed(id) {
  if (!confirm('Supprimer ce médicament ?')) return;
  const r = await api(`medicaments&id=${id}`, 'DELETE');
  if (r) { await refresh('medicaments'); renderMeds(); toast('Supprimé', 'danger'); }
}
 
function printMeds() {
  if (!DB.medicaments.length) { toast('Aucun médicament', 'warn'); return; }
  const now = new Date().toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const b   = DB.medicaments.map((m, i) =>
    `<tr><td>${i+1}</td><td><strong>${m.nom}</strong></td><td>${m.dosage}</td>
     <td>${m.forme}</td><td>${m.categorie}</td>
     <td>${m.stock==0?'<span style="color:red">Épuisé</span>':m.stock<=m.seuil?`<span style="color:#b45309">${m.stock} ⚠</span>`:m.stock}</td>
     <td>${m.prix||'—'} DA</td></tr>`
  ).join('');
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Médicaments</title>
  <style>body{font-family:sans-serif;padding:30px}table{width:100%;border-collapse:collapse;font-size:13px}
  th{background:#14532d;color:#fff;padding:10px;text-align:left;font-size:11px;text-transform:uppercase}
  td{padding:9px 10px;border-bottom:1px solid #d1fae5}tr:nth-child(even){background:#f0fdf4}</style></head>
  <body><h2 style="color:#14532d;border-bottom:3px solid #16a34a;padding-bottom:10px">
  Al Shifa — Catalogue Médicaments · ${now}</h2>
  <table><thead><tr><th>#</th><th>Médicament</th><th>Dosage</th><th>Forme</th>
  <th>Catégorie</th><th>Stock</th><th>Prix</th></tr></thead><tbody>${b}</tbody></table></body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}
 
/* ── PASSWORDS ───────────────────────────────────────────── */
async function renderPasswords() {
  await refresh('medecins');
  const list = document.getElementById('pwd-medecins-list');
  if (!list) return;
  list.innerHTML = DB.medecins.map(m => `
    <div class="pwd-card">
      <div style="flex:1">
        <div class="pwd-name">${san(m.nom)}</div>
        <div class="pwd-meta">Identifiant : <code>${san(m.user)}</code> · ${san(m.spec)}</div>
      </div>
      <button class="btn btn-warn btn-sm" onclick="openModal('changePass','${m.id}')">🔑 Changer</button>
    </div>`).join('');
}
 
/* ── MODAL ───────────────────────────────────────────────── */
let _mT = null, _mI = null;
 
function openModal(type, id = null) {
  _mT = type; _mI = id;
  document.getElementById('modal-ov').classList.add('open');
 
  const pO   = DB.patients.map(p  => `<option value="${p.id}">${san(p.nom)}</option>`).join('');
  const mO   = DB.medecins.map(m  => `<option value="${m.id}">${san(m.nom)} – ${san(m.spec)}</option>`).join('');
  const motO = MOTIFS.map(m       => `<option>${m}</option>`).join('');
  const spO  = SPECS.map(s        => `<option>${s}</option>`).join('');
  const catO = MED_CATS.map(c     => `<option>${c}</option>`).join('');
  const frmO = MED_FORMES.map(f   => `<option>${f}</option>`).join('');
 
  const set  = (title, sub = '') => {
    document.getElementById('m-title').textContent = title;
    document.getElementById('m-sub').textContent   = sub;
  };
  const v = i => document.getElementById(i)?.value?.trim() || '';
 
  /* ── médecin ── */
  if (type === 'medecin') {
    const m = id ? DB.medecins.find(x => x.id === id) : {};
    set(id ? 'Modifier le médecin' : 'Nouveau médecin', id ? m?.nom : '');
    document.getElementById('m-body').innerHTML = `
      <div class="msec">Informations</div>
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Nom *</label>
          <input class="form-inp" id="f-nom" value="${san(m?.nom||'')}"/></div>
        <div class="form-grp"><label class="form-lbl">Spécialité</label>
          <select class="form-sel" id="f-spec"><option value="">—</option>${spO}</select></div>
      </div>
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Téléphone</label>
          <input class="form-inp" id="f-tel" value="${san(m?.tel||'')}"/></div>
        <div class="form-grp"><label class="form-lbl">Email</label>
          <input class="form-inp" type="email" id="f-email" value="${san(m?.email||'')}"/></div>
      </div>
      <div class="msec">Compte</div>
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Identifiant *</label>
          <input class="form-inp" id="f-user" value="${san(m?.user||'')}"/></div>
        <div class="form-grp"><label class="form-lbl">Mot de passe${id?' (vide=inchangé)':' *'}</label>
          <input class="form-inp" type="password" id="f-pass"/></div>
      </div>`;
    if (id) setTimeout(() => {
      const s = document.getElementById('f-spec');
      for (const o of s.options) if (o.text === m?.spec) o.selected = true;
    }, 0);
  }
  /* ── patient ── */
  else if (type === 'patient') {
    const p = id ? DB.patients.find(x => x.id === id) : {};
    set(id ? 'Modifier le patient' : 'Nouveau patient');
    document.getElementById('m-body').innerHTML = `
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Nom *</label>
          <input class="form-inp" id="f-nom" value="${san(p?.nom||'')}"/></div>
        <div class="form-grp"><label class="form-lbl">Sexe</label>
          <select class="form-sel" id="f-sexe"><option value="">—</option>
            <option ${p?.sexe==='Masculin'?'selected':''}>Masculin</option>
            <option ${p?.sexe==='Féminin'?'selected':''}>Féminin</option></select></div>
      </div>
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Date naissance</label>
          <input class="form-inp" type="date" id="f-naiss" value="${p?.naissance||''}"/></div>
        <div class="form-grp"><label class="form-lbl">Téléphone</label>
          <input class="form-inp" id="f-tel" value="${san(p?.tel||'')}"/></div>
      </div>
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Email</label>
          <input class="form-inp" type="email" id="f-email" value="${san(p?.email||'')}"/></div>
        <div class="form-grp"><label class="form-lbl">Date inscription</label>
          <input class="form-inp" type="date" id="f-inscrit" value="${p?.inscrit||today()}"/></div>
      </div>`;
  }
  /* ── rdv ── */
  else if (type === 'rdv') {
    const r = id ? DB.rdvs.find(x => x.id === id) : {};
    set(id ? 'Modifier le RDV' : 'Nouveau rendez-vous');
    document.getElementById('m-body').innerHTML = `
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Patient *</label>
          <select class="form-sel" id="f-pat"><option value="">—</option>${pO}</select></div>
        <div class="form-grp"><label class="form-lbl">Médecin *</label>
          <select class="form-sel" id="f-med"><option value="">—</option>${mO}</select></div>
      </div>
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Date *</label>
          <input class="form-inp" type="date" id="f-date" value="${r?.date||today()}"/></div>
        <div class="form-grp"><label class="form-lbl">Heure *</label>
          <input class="form-inp" type="time" id="f-heure" value="${r?.heure||'09:00'}"/></div>
      </div>
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Motif</label>
          <select class="form-sel" id="f-motif"><option value="">—</option>${motO}</select></div>
        <div class="form-grp"><label class="form-lbl">Urgence</label>
          <select class="form-sel" id="f-urgence"><option>Normal</option><option>Urgent</option><option>Très urgent</option></select></div>
      </div>
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Statut</label>
          <select class="form-sel" id="f-stat"><option>En attente</option><option>Confirmé</option><option>Annulé</option><option>Terminé</option></select></div>
        <div class="form-grp"><label class="form-lbl">Date inscription</label>
          <input class="form-inp" type="date" id="f-inscrit" value="${r?.inscrit||today()}"/></div>
      </div>`;
    if (id) setTimeout(() => {
      document.getElementById('f-pat').value    = r.patientId;
      document.getElementById('f-med').value    = r.medecinId;
      document.getElementById('f-motif').value  = r.motif   || '';
      document.getElementById('f-urgence').value= r.urgence || 'Normal';
      document.getElementById('f-stat').value   = r.statut  || 'En attente';
    }, 0);
    if (!id && CU.medecinId) setTimeout(() => {
      document.getElementById('f-med').value = CU.medecinId;
    }, 0);
  }
  /* ── consultation ── */
  else if (type === 'consultation') {
    const c = id ? DB.consultations.find(x => x.id === id) : {};
    set(id ? 'Modifier' : 'Nouvelle consultation');
    document.getElementById('m-body').innerHTML = `
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Patient *</label>
          <select class="form-sel" id="f-pat"><option value="">—</option>${pO}</select></div>
        <div class="form-grp"><label class="form-lbl">Médecin *</label>
          <select class="form-sel" id="f-med"><option value="">—</option>${mO}</select></div>
      </div>
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Date *</label>
          <input class="form-inp" type="date" id="f-date" value="${c?.date||today()}"/></div>
        <div class="form-grp"><label class="form-lbl">Motif</label>
          <select class="form-sel" id="f-motif"><option value="">—</option>${motO}</select></div>
      </div>
      <div class="form-grp"><label class="form-lbl">Diagnostic</label>
        <textarea class="form-ta" id="f-diag">${san(c?.diagnostic||'')}</textarea></div>
      <div class="form-grp"><label class="form-lbl">Traitement</label>
        <textarea class="form-ta" id="f-trait">${san(c?.traitement||'')}</textarea></div>`;
    if (id) setTimeout(() => {
      document.getElementById('f-pat').value   = c.patientId;
      document.getElementById('f-med').value   = c.medecinId;
      document.getElementById('f-motif').value = c.motif || '';
    }, 0);
    if (!id && CU.medecinId) setTimeout(() => {
      document.getElementById('f-med').value = CU.medecinId;
    }, 0);
  }
  /* ── prescription ── */
  else if (type === 'prescription') {
    const rx = id ? DB.prescriptions.find(x => x.id === id) : {};
    set(id ? "Modifier l'ordonnance" : 'Nouvelle ordonnance');
    document.getElementById('m-body').innerHTML = `
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Patient *</label>
          <select class="form-sel" id="f-pat"><option value="">—</option>${pO}</select></div>
        <div class="form-grp"><label class="form-lbl">Médecin *</label>
          <select class="form-sel" id="f-med"><option value="">—</option>${mO}</select></div>
      </div>
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Date *</label>
          <input class="form-inp" type="date" id="f-date" value="${rx?.date||today()}"/></div>
        <div class="form-grp"><label class="form-lbl">Motif</label>
          <select class="form-sel" id="f-motif"><option value="">—</option>${motO}</select></div>
      </div>
      <div class="form-grp"><label class="form-lbl">Médicaments *</label>
        <textarea class="form-ta" id="f-meds" style="min-height:120px"
          placeholder="Paracétamol 500mg — 1 comprimé 3x/jour&#10;Amoxicilline 1g — 2x/jour 7 jours">${san(rx?.medicaments||'')}</textarea>
        <div style="font-size:11px;color:var(--gray400);margin-top:4px">Un médicament par ligne</div>
      </div>
      <div class="form-grp"><label class="form-lbl">Notes</label>
        <textarea class="form-ta" id="f-notes">${san(rx?.notes||'')}</textarea></div>`;
    if (id) setTimeout(() => {
      document.getElementById('f-pat').value   = rx.patientId;
      document.getElementById('f-med').value   = rx.medecinId;
      document.getElementById('f-motif').value = rx.motif || '';
    }, 0);
    if (!id && CU.medecinId) setTimeout(() => {
      document.getElementById('f-med').value = CU.medecinId;
    }, 0);
  }
  /* ── editProfil ── */
  else if (type === 'editProfil') {
    const m = DB.medecins.find(x => x.id === id) || {};
    set('Modifier mon profil');
    document.getElementById('m-body').innerHTML = `
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Téléphone</label>
          <input class="form-inp" id="f-tel" value="${san(m?.tel||'')}"/></div>
        <div class="form-grp"><label class="form-lbl">Email</label>
          <input class="form-inp" type="email" id="f-email" value="${san(m?.email||'')}"/></div>
      </div>
      <div class="form-grp"><label class="form-lbl">Nouveau mot de passe (vide = inchangé)</label>
        <input class="form-inp" type="password" id="f-pass" placeholder="Laisser vide = inchangé"/></div>`;
  }
  /* ── medicament ── */
  else if (type === 'medicament') {
    const m = id ? DB.medicaments.find(x => x.id === id) : {};
    set(id ? 'Modifier le médicament' : 'Nouveau médicament');
    document.getElementById('m-body').innerHTML = `
      <div class="msec">Identification</div>
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Nom *</label>
          <input class="form-inp" id="f-nom" value="${san(m?.nom||'')}"/></div>
        <div class="form-grp"><label class="form-lbl">Dosage *</label>
          <input class="form-inp" id="f-dosage" value="${san(m?.dosage||'')}" placeholder="500 mg"/></div>
      </div>
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Forme</label>
          <select class="form-sel" id="f-forme"><option value="">—</option>
            ${MED_FORMES.map(f=>`<option ${m?.forme===f?'selected':''}>${f}</option>`).join('')}
          </select></div>
        <div class="form-grp"><label class="form-lbl">Catégorie</label>
          <select class="form-sel" id="f-cat"><option value="">—</option>
            ${MED_CATS.map(c=>`<option ${m?.categorie===c?'selected':''}>${c}</option>`).join('')}
          </select></div>
      </div>
      <div class="form-grp"><label class="form-lbl">Description</label>
        <input class="form-inp" id="f-desc" value="${san(m?.description||'')}"/></div>
      <div class="msec">Stock & Prix</div>
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Stock</label>
          <input class="form-inp" type="number" min="0" id="f-stock" value="${m?.stock??0}"/></div>
        <div class="form-grp"><label class="form-lbl">Seuil alerte</label>
          <input class="form-inp" type="number" min="0" id="f-seuil" value="${m?.seuil??20}"/></div>
      </div>
      <div class="form-row">
        <div class="form-grp"><label class="form-lbl">Prix (DA)</label>
          <input class="form-inp" type="number" min="0" id="f-prix" value="${m?.prix||''}"/></div>
        <div class="form-grp"><label class="form-lbl">Fournisseur</label>
          <input class="form-inp" id="f-fournisseur" value="${san(m?.fournisseur||'')}"/></div>
      </div>`;
  }
  /* ── ajustStock ── */
  else if (type === 'ajustStock') {
    const m = DB.medicaments.find(x => x.id === id) || {};
    set('Ajustement de stock', 'Médicament : ' + san(m.nom || ''));
    document.getElementById('m-body').innerHTML = `
      <div style="text-align:center;padding:12px;background:var(--g50);border-radius:10px;margin-bottom:16px">
        <div style="font-size:13px;color:var(--gray500)">Stock actuel</div>
        <div style="font-size:36px;font-weight:700;color:var(--g700)">${m.stock}</div>
        <div style="font-size:12px;color:var(--gray400)">Seuil : ${m.seuil}</div>
      </div>
      <div class="form-grp"><label class="form-lbl">Opération</label>
        <select class="form-sel" id="f-op">
          <option value="add">➕ Entrée (ajouter)</option>
          <option value="remove">➖ Sortie (retirer)</option>
          <option value="set">🔄 Définir quantité exacte</option>
        </select></div>
      <div class="form-grp"><label class="form-lbl">Quantité *</label>
        <input class="form-inp" type="number" min="0" id="f-qty" value="0"/></div>`;
  }
  /* ── changePass ── */
  else if (type === 'changePass') {
    const isAdmin = id === '__admin__';
    const m = isAdmin ? { nom:'Administrateur', user:'admin' }
                      : (DB.medecins.find(x => x.id === id) || {});
    set('Changer le mot de passe', san(m.nom || ''));
    document.getElementById('m-body').innerHTML = `
      <div style="background:var(--g50);border:1px solid var(--g200);border-radius:10px;
           padding:14px 18px;margin-bottom:16px;font-size:13px;color:var(--g700)">
        👤 <strong>${san(m.nom)}</strong> · Identifiant :
        <code style="background:var(--g100);padding:2px 8px;border-radius:5px">${san(m.user||'admin')}</code>
      </div>
      <div class="form-grp"><label class="form-lbl">Nouveau mot de passe *</label>
        <input class="form-inp" type="password" id="f-new-pass" placeholder="Min. 6 caractères"/></div>
      <div class="form-grp"><label class="form-lbl">Confirmer *</label>
        <input class="form-inp" type="password" id="f-conf-pass" placeholder="Répéter"/></div>`;
  }
}
 
function closeModal() {
  document.getElementById('modal-ov').classList.remove('open');
  _mT = null; _mI = null;
}
 
async function submitModal() {
  const type = _mT, id = _mI;
  const v = i => document.getElementById(i)?.value?.trim() || '';
 
  if (type === 'medecin') {
    if (!v('f-nom') || !v('f-user')) { toast('Nom et identifiant obligatoires', 'danger'); return; }
    if (!id && !v('f-pass'))          { toast('Mot de passe obligatoire', 'danger');         return; }
    const payload = { nom:v('f-nom'), spec:v('f-spec'), tel:v('f-tel'), email:v('f-email'),
                      user:v('f-user'), color:COLORS[DB.medecins.length % COLORS.length], actif:1 };
    if (v('f-pass')) payload.pass = v('f-pass');
    const r = id
      ? await api(`medecins&id=${id}`, 'PUT', payload)
      : await api('medecins', 'POST', { id: uid(), ...payload });
    if (r) { await refresh('medecins'); renderTbl('medecin'); }
  }
  else if (type === 'patient') {
    if (!v('f-nom')) { toast('Nom obligatoire', 'danger'); return; }
    const payload = { nom:v('f-nom'), sexe:v('f-sexe'), naissance:v('f-naiss'),
                      tel:v('f-tel'), email:v('f-email'), inscrit:v('f-inscrit') || today() };
    const r = id
      ? await api(`patients&id=${id}`, 'PUT', payload)
      : await api('patients', 'POST', { id: uid(), ...payload });
    if (r) { await refresh('patients'); renderTbl('patient'); }
  }
  else if (type === 'rdv') {
    if (!v('f-pat') || !v('f-med') || !v('f-date') || !v('f-heure')) {
      toast('Champs obligatoires', 'danger'); return;
    }
    const payload = { patientId:v('f-pat'), medecinId:v('f-med'), date:v('f-date'),
                      heure:v('f-heure'), motif:v('f-motif'), urgence:v('f-urgence')||'Normal',
                      statut:v('f-stat')||'En attente', inscrit:v('f-inscrit')||today() };
    const r = id
      ? await api(`rdvs&id=${id}`, 'PUT', payload)
      : await api('rdvs', 'POST', { id: uid(), ...payload });
    if (r) { await refresh('rdvs'); renderTbl('rdv'); renderTbl('mesrdv'); }
  }
  else if (type === 'consultation') {
    if (!v('f-pat') || !v('f-med') || !v('f-date')) { toast('Champs obligatoires', 'danger'); return; }
    const payload = { patientId:v('f-pat'), medecinId:v('f-med'), date:v('f-date'),
                      motif:v('f-motif'), diagnostic:v('f-diag'), traitement:v('f-trait') };
    const r = id
      ? await api(`consultations&id=${id}`, 'PUT', payload)
      : await api('consultations', 'POST', { id: uid(), ...payload });
    if (r) { await refresh('consultations'); renderTbl('consultation'); renderTbl('mesconsult'); }
  }
  else if (type === 'prescription') {
    if (!v('f-pat') || !v('f-med') || !v('f-date') || !v('f-meds')) {
      toast('Champs obligatoires', 'danger'); return;
    }
    const payload = { patientId:v('f-pat'), medecinId:v('f-med'), date:v('f-date'),
                      motif:v('f-motif'), medicaments:v('f-meds'), notes:v('f-notes') };
    const r = id
      ? await api(`prescriptions&id=${id}`, 'PUT', payload)
      : await api('prescriptions', 'POST', { id: uid(), ...payload });
    if (r) { await refresh('prescriptions'); renderRx(CU.role === 'medecin'); }
  }
  else if (type === 'editProfil') {
    const payload = { tel:v('f-tel'), email:v('f-email') };
    if (v('f-pass')) payload.pass = v('f-pass');
    const r = await api(`medecins&id=${id}`, 'PUT', payload);
    if (r) { await refresh('medecins'); renderMonProfil(); }
  }
  else if (type === 'medicament') {
    if (!v('f-nom') || !v('f-dosage')) { toast('Nom et dosage obligatoires', 'danger'); return; }
    const payload = {
      nom:v('f-nom'), dosage:v('f-dosage'), forme:v('f-forme'), categorie:v('f-cat'),
      description:v('f-desc'),
      stock:  parseInt(document.getElementById('f-stock')?.value)  || 0,
      seuil:  parseInt(document.getElementById('f-seuil')?.value)  || 20,
      prix:   parseFloat(document.getElementById('f-prix')?.value) || 0,
      fournisseur:v('f-fournisseur'), actif:1,
    };
    const r = id
      ? await api(`medicaments&id=${id}`, 'PUT', payload)
      : await api('medicaments', 'POST', { id: uid(), ...payload });
    if (r) { await refresh('medicaments'); renderMeds(); }
  }
  else if (type === 'ajustStock') {
    const m   = DB.medicaments.find(x => x.id === id);
    if (!m) return;
    const op  = document.getElementById('f-op')?.value;
    const qty = parseInt(document.getElementById('f-qty')?.value) || 0;
    let newStock = m.stock;
    if      (op === 'add')    newStock = parseInt(m.stock) + qty;
    else if (op === 'remove') { if (qty > m.stock) { toast('Quantité > stock', 'danger'); return; } newStock = parseInt(m.stock) - qty; }
    else if (op === 'set')    newStock = qty;
    const r = await api(`medicaments&id=${id}`, 'PUT', { stock: newStock });
    if (r) { await refresh('medicaments'); renderMeds(); }
  }
  else if (type === 'changePass') {
    const isAdmin = id === '__admin__';
    const np = document.getElementById('f-new-pass')?.value || '';
    const cp = document.getElementById('f-conf-pass')?.value || '';
    if (!np)       { toast('Mot de passe obligatoire', 'danger'); return; }
    if (np.length < 6) { toast('Minimum 6 caractères', 'danger'); return; }
    if (np !== cp) { toast('Les mots de passe ne correspondent pas', 'danger'); return; }
    if (isAdmin) {
      const r = await api('admin', 'PUT', { pass: np });
      if (!r) { toast('Impossible de changer le mot de passe admin via API — mettez à jour manuellement en BDD.', 'warn'); closeModal(); return; }
    } else {
      const r = await api(`medecins&id=${id}`, 'PUT', { pass: np });
      if (r) { await refresh('medecins'); renderPasswords(); renderTbl('medecin'); }
    }
  }
 
  toast(id ? 'Mis à jour ✓' : 'Ajouté ✓', 'success');
  closeModal();
}
 
/* ── DELETE & PRINT ──────────────────────────────────────── */
async function delRow(type, id) {
  if (!confirm('Supprimer cet enregistrement ?')) return;
  const map = { medecin:'medecins', patient:'patients', rdv:'rdvs',
                consultation:'consultations', prescription:'prescriptions' };
  const store = map[type];
  const r = await api(`${store}&id=${id}`, 'DELETE');
  if (!r) return;
  await refresh(store);
  type === 'prescription' ? renderRx(CU.role === 'medecin') : renderTbl(type);
  toast('Supprimé', 'danger');
}
 
function printPage(type) {
  const map = { medecin:DB.medecins, patient:DB.patients, rdv:DB.rdvs, consultation:DB.consultations };
  const rows = map[type] || [];
  const titles = { medecin:'Médecins', patient:'Patients', rdv:'Rendez-vous', consultation:'Consultations' };
  const now = new Date().toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  let h = '', b = '';
  if (type === 'medecin') {
    h = '<tr><th>#</th><th>Nom</th><th>Spécialité</th><th>Téléphone</th><th>Email</th></tr>';
    b = rows.map((m, i) => `<tr><td>${i+1}</td><td>${m.nom}</td><td>${m.spec}</td><td>${m.tel||'—'}</td><td>${m.email||'—'}</td></tr>`).join('');
  } else if (type === 'patient') {
    h = '<tr><th>#</th><th>Nom</th><th>Sexe</th><th>Naissance</th><th>Téléphone</th><th>Email</th></tr>';
    b = rows.map((p, i) => `<tr><td>${i+1}</td><td>${p.nom}</td><td>${p.sexe||'—'}</td><td>${fmt(p.naissance)}</td><td>${p.tel||'—'}</td><td>${p.email||'—'}</td></tr>`).join('');
  } else if (type === 'rdv') {
    h = '<tr><th>#</th><th>Patient</th><th>Médecin</th><th>Date</th><th>Heure</th><th>Motif</th><th>Statut</th></tr>';
    b = rows.map((r, i) => { const p=getP(r.patientId),m=getM(r.medecinId); return `<tr><td>${i+1}</td><td>${p.nom}</td><td>${m.nom}</td><td>${fmt(r.date)}</td><td>${r.heure}</td><td>${r.motif}</td><td>${r.statut}</td></tr>`; }).join('');
  } else if (type === 'consultation') {
    h = '<tr><th>#</th><th>Patient</th><th>Médecin</th><th>Date</th><th>Diagnostic</th><th>Traitement</th></tr>';
    b = rows.map((c, i) => { const p=getP(c.patientId),m=getM(c.medecinId); return `<tr><td>${i+1}</td><td>${p.nom}</td><td>${m.nom}</td><td>${fmt(c.date)}</td><td>${c.diagnostic||'—'}</td><td>${c.traitement||'—'}</td></tr>`; }).join('');
  }
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Al Shifa – ${titles[type]}</title>
  <style>body{font-family:sans-serif;padding:30px;color:#111}
  .hd{display:flex;justify-content:space-between;padding-bottom:14px;border-bottom:3px solid #16a34a;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{text-align:left;padding:10px 12px;background:#14532d;color:rgba(255,255,255,.8);font-size:10px;text-transform:uppercase}
  td{padding:10px 12px;border-bottom:1px solid #d1fae5}tr:nth-child(even){background:#f0fdf4}</style></head>
  <body><div class="hd"><div><strong style="font-size:18px;color:#14532d">Al Shifa</strong></div>
  <div style="text-align:right"><div style="font-weight:700">Liste des ${titles[type]}</div>
  <div style="font-size:12px;color:#6b7280">${now}</div></div></div>
  <table><thead>${h}</thead><tbody>${b}</tbody></table></body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}
 
/* ── TOAST ───────────────────────────────────────────────── */
function toast(msg, type = 'success') {
  const icons  = { success:'✓', danger:'✕', warn:'⚠', info:'ℹ' };
  const colors = { success:'var(--g500)', danger:'var(--danger)', warn:'var(--warn)', info:'#0891b2' };
  const el = document.createElement('div');
  el.className = `t-item ${type}`;
  el.innerHTML = `<span style="font-size:16px;color:${colors[type]||colors.info}">${icons[type]||'ℹ'}</span>${msg}`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => {
    el.style.cssText = 'opacity:0;transform:translateX(16px);transition:all .3s';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}
 
/* ── KEYBOARD SHORTCUTS ──────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape')          closeModal();
  if (e.ctrlKey && e.key === 'Enter') submitModal();
});
 
/* ── URL param: pre-select role ──────────────────────────── */
const urlRole = new URLSearchParams(window.location.search).get('role');
if (urlRole === 'medecin') {
  setLoginRole('medecin', document.getElementById('lt-med'));
}
 

