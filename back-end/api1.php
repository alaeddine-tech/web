<?php
// ============================================================
//  Al Shifa — API PHP  (api.php)
//  Place in: C:/xampp/htdocs/cabinet/api.php
// ============================================================

// ── Suppress PHP notices/warnings that corrupt JSON output ──
error_reporting(0);
ini_set('display_errors', '0');

// ── CORS headers — MUST be before any output ────────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

// ── DATABASE ─────────────────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');        // XAMPP default: empty
define('DB_NAME', 'al-shifa'); // your database name

function getDB(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;
    try {
        $pdo = new PDO(
            'mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4',
            DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
             PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
             PDO::ATTR_EMULATE_PREPARES   => false]
        );
    } catch (PDOException $e) {
        respond(['error' => 'DB: '.$e->getMessage()], 500);
    }
    return $pdo;
}

// ── HELPERS ──────────────────────────────────────────────────
function respond($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

function body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}

function uid(): string { return substr(md5(uniqid((string)mt_rand(), true)), 0, 9); }
function today(): string { return date('Y-m-d'); }

// Build SET clause for UPDATE. $nullable = fields where ''  => NULL
function buildUpdate(array $allowed, array $b, array $nullable = []): array {
    $sets = []; $vals = [];
    foreach ($allowed as $f) {
        if (!array_key_exists($f, $b)) continue;
        $sets[] = "$f = ?";
        $v = $b[$f];
        if (in_array($f, $nullable) && ($v === '' || $v === null)) $v = null;
        $vals[] = $v;
    }
    return [$sets, $vals];
}

// ── ROUTE PARSING ─────────────────────────────────────────────
// JS calls: api.php?url=medecins          (list)
//           api.php?url=medecins&id=m001  (single item)
//
// KEY FIX: read id and medecinId directly from $_GET,
//          NOT from inside the url param value.

$resource  = trim($_GET['url']       ?? '');
$id        = trim($_GET['id']        ?? '');   // ← correct
$medecinId = trim($_GET['medecinId'] ?? '');
$method    = $_SERVER['REQUEST_METHOD'];

// Safety: strip stray & in resource
if (strpos($resource, '&') !== false) {
    $resource = explode('&', $resource)[0];
}

// ── ROUTER ───────────────────────────────────────────────────
switch ($resource) {

    // ═══════════ AUTH ═══════════
    case 'login':
        if ($method !== 'POST') respond(['error' => 'POST only'], 405);
        $b    = body();
        $role = $b['role'] ?? '';
        $user = trim($b['user'] ?? '');
        $pass = trim($b['pass'] ?? '');

        if (!$user || !$pass)
            respond(['success' => false, 'error' => 'Champs obligatoires.'], 400);

        if ($role === 'admin') {
            $s = getDB()->prepare('SELECT id FROM admin WHERE username=? AND password=?');
            $s->execute([$user, $pass]);
            if ($s->fetch()) respond(['success' => true, 'role' => 'admin']);
            respond(['success' => false, 'error' => 'Identifiant ou mot de passe incorrect.'], 401);
        }

        if ($role === 'medecin') {
            $s = getDB()->prepare('SELECT * FROM medecins WHERE user=? AND pass=? AND actif=1');
            $s->execute([$user, $pass]);
            $r = $s->fetch();
            if ($r) respond(['success'=>true,'role'=>'medecin',
                'id'=>$r['id'],'nom'=>$r['nom'],'spec'=>$r['spec'],'color'=>$r['color']]);
            respond(['success' => false, 'error' => 'Identifiant ou mot de passe incorrect.'], 401);
        }

        if ($role === 'patient') {
            $s = getDB()->prepare(
                'SELECT * FROM patients WHERE (email=? OR tel=?) AND pass=?'
            );
            $s->execute([$user, $user, $pass]);
            $r = $s->fetch();
            if ($r) respond(['success' => true, 'role' => 'patient', 'patient' => $r]);
            respond(['success' => false, 'error' => 'Identifiant ou mot de passe incorrect.'], 401);
        }

        respond(['success' => false, 'error' => 'Rôle inconnu.'], 400);
        break;

    // ═══════════ ADMIN PASSWORD ═══════════
    case 'admin':
        if ($method === 'PUT') {
            $b = body();
            if (!empty($b['pass']))
                getDB()->prepare('UPDATE admin SET password=? WHERE username=?')
                       ->execute([$b['pass'], 'admin']);
            respond(['success' => true]);
        }
        respond(['error' => 'Method not allowed'], 405);
        break;

    // ═══════════ DASHBOARD ═══════════
    case 'dashboard':
        $db = getDB(); $t = today();
        $s = $db->prepare('SELECT COUNT(*) FROM rdvs WHERE date=?'); $s->execute([$t]);
        respond([
            'medecins'      => (int)$db->query('SELECT COUNT(*) FROM medecins WHERE actif=1')->fetchColumn(),
            'patients'      => (int)$db->query('SELECT COUNT(*) FROM patients')->fetchColumn(),
            'dem_pending'   => (int)$db->query("SELECT COUNT(*) FROM demandes WHERE statut='En attente'")->fetchColumn(),
            'rdvs_today'    => (int)$s->fetchColumn(),
            'prescriptions' => (int)$db->query('SELECT COUNT(*) FROM prescriptions')->fetchColumn(),
            'consultations' => (int)$db->query('SELECT COUNT(*) FROM consultations')->fetchColumn(),
        ]);
        break;

    // ═══════════ MÉDECINS ═══════════
    case 'medecins':
        $db = getDB();
        if ($method === 'GET') {
            respond($db->query('SELECT * FROM medecins ORDER BY nom')->fetchAll());
        }
        if ($method === 'POST') {
            $b = body(); $nid = !empty($b['id']) ? $b['id'] : uid();
            $db->prepare('INSERT INTO medecins (id,nom,spec,tel,email,user,pass,color,actif) VALUES (?,?,?,?,?,?,?,?,?)')
               ->execute([$nid, $b['nom']??'', $b['spec']??'', $b['tel']??'',
                          $b['email']??'', $b['user']??'', $b['pass']??'',
                          $b['color']??'#16a34a', (int)($b['actif']??1)]);
            respond(['success'=>true,'id'=>$nid]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            [$sets,$vals] = buildUpdate(['nom','spec','tel','email','user','pass','color','actif'], $b);
            if ($sets) { $vals[]=$id; $db->prepare('UPDATE medecins SET '.implode(',',$sets).' WHERE id=?')->execute($vals); }
            respond(['success'=>true]);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM medecins WHERE id=?')->execute([$id]);
            respond(['success'=>true]);
        }
        respond(['error'=>'Bad request'], 400);
        break;

    // ═══════════ PATIENTS ═══════════
    case 'patients':
        $db = getDB();
        if ($method === 'GET') {
            respond($db->query('SELECT * FROM patients ORDER BY nom')->fetchAll());
        }
        if ($method === 'POST') {
            $b = body(); $nid = !empty($b['id']) ? $b['id'] : uid();
            $db->prepare('INSERT INTO patients (id,nom,prenom,nomFamille,sexe,naissance,tel,email,pass,inscrit) VALUES (?,?,?,?,?,?,?,?,?,?)')
               ->execute([$nid, $b['nom']??'', $b['prenom']??'', $b['nomFamille']??'',
                          $b['sexe']??'', ($b['naissance']??'')?:null,
                          $b['tel']??'', $b['email']??'', $b['pass']??'', $b['inscrit']??today()]);
            respond(['success'=>true,'id'=>$nid]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            [$sets,$vals] = buildUpdate(['nom','prenom','nomFamille','sexe','naissance','tel','email','pass','inscrit'], $b, ['naissance']);
            if ($sets) { $vals[]=$id; $db->prepare('UPDATE patients SET '.implode(',',$sets).' WHERE id=?')->execute($vals); }
            respond(['success'=>true]);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM patients WHERE id=?')->execute([$id]);
            respond(['success'=>true]);
        }
        respond(['error'=>'Bad request'], 400);
        break;

    // ═══════════ RENDEZ-VOUS ═══════════
    case 'rdvs':
        $db = getDB();
        if ($method === 'GET') {
            respond($db->query('SELECT * FROM rdvs ORDER BY date DESC, heure ASC')->fetchAll());
        }
        if ($method === 'POST') {
            $b = body(); $nid = !empty($b['id']) ? $b['id'] : uid();
            $db->prepare('INSERT INTO rdvs (id,patientId,medecinId,date,heure,motif,urgence,statut,inscrit) VALUES (?,?,?,?,?,?,?,?,?)')
               ->execute([$nid,
                          ($b['patientId']??'')?:null, ($b['medecinId']??'')?:null,
                          $b['date']??today(), $b['heure']??'09:00',
                          $b['motif']??'', $b['urgence']??'Normal',
                          $b['statut']??'En attente', $b['inscrit']??today()]);
            respond(['success'=>true,'id'=>$nid]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            [$sets,$vals] = buildUpdate(['patientId','medecinId','date','heure','motif','urgence','statut','inscrit'], $b, ['patientId','medecinId']);
            if ($sets) { $vals[]=$id; $db->prepare('UPDATE rdvs SET '.implode(',',$sets).' WHERE id=?')->execute($vals); }
            respond(['success'=>true]);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM rdvs WHERE id=?')->execute([$id]);
            respond(['success'=>true]);
        }
        respond(['error'=>'Bad request'], 400);
        break;

    // ═══════════ CONSULTATIONS ═══════════
    case 'consultations':
        $db = getDB();
        if ($method === 'GET') {
            respond($db->query('SELECT * FROM consultations ORDER BY date DESC')->fetchAll());
        }
        if ($method === 'POST') {
            $b = body(); $nid = !empty($b['id']) ? $b['id'] : uid();
            $db->prepare('INSERT INTO consultations (id,patientId,medecinId,date,motif,diagnostic,traitement) VALUES (?,?,?,?,?,?,?)')
               ->execute([$nid,
                          ($b['patientId']??'')?:null, ($b['medecinId']??'')?:null,
                          $b['date']??today(), $b['motif']??'',
                          $b['diagnostic']??'', $b['traitement']??'']);
            respond(['success'=>true,'id'=>$nid]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            [$sets,$vals] = buildUpdate(['patientId','medecinId','date','motif','diagnostic','traitement'], $b, ['patientId','medecinId']);
            if ($sets) { $vals[]=$id; $db->prepare('UPDATE consultations SET '.implode(',',$sets).' WHERE id=?')->execute($vals); }
            respond(['success'=>true]);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM consultations WHERE id=?')->execute([$id]);
            respond(['success'=>true]);
        }
        respond(['error'=>'Bad request'], 400);
        break;

    // ═══════════ DEMANDES ═══════════
    case 'demandes':
        $db = getDB();
        if ($method === 'GET') {
            respond($db->query('SELECT * FROM demandes ORDER BY inscrit DESC')->fetchAll());
        }
        if ($method === 'POST') {
            $b = body(); $nid = !empty($b['id']) ? $b['id'] : uid();
            $db->prepare('INSERT INTO demandes (id,patientId,nom,tel,email,medecinId,date,motif,urgence,msg,statut,inscrit,noteReponse) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
               ->execute([$nid,
                          ($b['patientId']??'')?:null, $b['nom']??'',
                          $b['tel']??'', $b['email']??'',
                          ($b['medecinId']??'')?:null, ($b['date']??'')?:null,
                          $b['motif']??'', $b['urgence']??'Normal',
                          $b['msg']??'', $b['statut']??'En attente',
                          $b['inscrit']??today(), $b['noteReponse']??'']);
            respond(['success'=>true,'id'=>$nid]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            [$sets,$vals] = buildUpdate(
                ['patientId','nom','tel','email','medecinId','date','motif','urgence','msg','statut','inscrit','noteReponse'],
                $b, ['patientId','medecinId','date']
            );
            if ($sets) { $vals[]=$id; $db->prepare('UPDATE demandes SET '.implode(',',$sets).' WHERE id=?')->execute($vals); }
            respond(['success'=>true]);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM demandes WHERE id=?')->execute([$id]);
            respond(['success'=>true]);
        }
        respond(['error'=>'Bad request'], 400);
        break;

    // ═══════════ PRESCRIPTIONS ═══════════
    case 'prescriptions':
        $db = getDB();
        if ($method === 'GET') {
            respond($db->query('SELECT * FROM prescriptions ORDER BY date DESC')->fetchAll());
        }
        if ($method === 'POST') {
            $b = body(); $nid = !empty($b['id']) ? $b['id'] : uid();
            $db->prepare('INSERT INTO prescriptions (id,patientId,medecinId,date,motif,medicaments,notes) VALUES (?,?,?,?,?,?,?)')
               ->execute([$nid,
                          ($b['patientId']??'')?:null, ($b['medecinId']??'')?:null,
                          $b['date']??today(), $b['motif']??'',
                          $b['medicaments']??'', $b['notes']??'']);
            respond(['success'=>true,'id'=>$nid]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            [$sets,$vals] = buildUpdate(['patientId','medecinId','date','motif','medicaments','notes'], $b, ['patientId','medecinId']);
            if ($sets) { $vals[]=$id; $db->prepare('UPDATE prescriptions SET '.implode(',',$sets).' WHERE id=?')->execute($vals); }
            respond(['success'=>true]);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM prescriptions WHERE id=?')->execute([$id]);
            respond(['success'=>true]);
        }
        respond(['error'=>'Bad request'], 400);
        break;

    // ═══════════ MÉDICAMENTS ═══════════
    case 'medicaments':
        $db = getDB();
        if ($method === 'GET') {
            respond($db->query('SELECT * FROM medicaments ORDER BY nom')->fetchAll());
        }
        if ($method === 'POST') {
            $b = body(); $nid = !empty($b['id']) ? $b['id'] : uid();
            $db->prepare('INSERT INTO medicaments (id,nom,dosage,forme,categorie,description,stock,seuil,prix,fournisseur,actif) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
               ->execute([$nid, $b['nom']??'', $b['dosage']??'', $b['forme']??'',
                          $b['categorie']??'', $b['description']??'',
                          (int)($b['stock']??0), (int)($b['seuil']??20),
                          (float)($b['prix']??0), $b['fournisseur']??'', (int)($b['actif']??1)]);
            respond(['success'=>true,'id'=>$nid]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            [$sets,$vals] = buildUpdate(['nom','dosage','forme','categorie','description','stock','seuil','prix','fournisseur','actif'], $b);
            if ($sets) { $vals[]=$id; $db->prepare('UPDATE medicaments SET '.implode(',',$sets).' WHERE id=?')->execute($vals); }
            respond(['success'=>true]);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM medicaments WHERE id=?')->execute([$id]);
            respond(['success'=>true]);
        }
        respond(['error'=>'Bad request'], 400);
        break;

    // ═══════════ DISPONIBILITÉS ═══════════
    case 'disponibilites':
        $db = getDB();
        if ($method === 'GET') {
            if ($medecinId) {
                $s = $db->prepare('SELECT d.*,m.nom AS medecinNom,m.spec FROM disponibilites d JOIN medecins m ON d.medecinId=m.id WHERE d.medecinId=? ORDER BY FIELD(d.jour,"Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche")');
                $s->execute([$medecinId]);
            } else {
                $s = $db->query('SELECT d.*,m.nom AS medecinNom,m.spec FROM disponibilites d JOIN medecins m ON d.medecinId=m.id WHERE d.actif=1 ORDER BY m.nom, FIELD(d.jour,"Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche")');
            }
            respond($s->fetchAll());
        }
        if ($method === 'POST') {
            $b = body(); $nid = !empty($b['id']) ? $b['id'] : uid();
            $db->prepare('INSERT INTO disponibilites (id,medecinId,jour,heure_debut,heure_fin,actif) VALUES (?,?,?,?,?,?)')
               ->execute([$nid, $b['medecinId']??'', $b['jour']??'', $b['heure_debut']??'08:00', $b['heure_fin']??'17:00', (int)($b['actif']??1)]);
            respond(['success'=>true,'id'=>$nid]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            [$sets,$vals] = buildUpdate(['jour','heure_debut','heure_fin','actif'], $b);
            if ($sets) { $vals[]=$id; $db->prepare('UPDATE disponibilites SET '.implode(',',$sets).' WHERE id=?')->execute($vals); }
            respond(['success'=>true]);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM disponibilites WHERE id=?')->execute([$id]);
            respond(['success'=>true]);
        }
        respond(['error'=>'Bad request'], 400);
        break;

    default:
        respond(['error' => "Unknown endpoint: '$resource'"], 404);
}
