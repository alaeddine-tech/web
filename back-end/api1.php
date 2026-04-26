<?php
// ============================================================
//  Al Shifa — API PHP  (api1.php)
//  Place in: C:/xampp/htdocs/cabinet/back-end/api1.php
//  PDO replaced with mysqli
// ============================================================

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
define('DB_PASS', '');         // XAMPP default: empty
define('DB_NAME', 'al-shifa'); // your database name

function getDB(): mysqli {
    static $conn = null;
    if ($conn !== null) return $conn;
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_error) {
        respond(['error' => 'DB: ' . $conn->connect_error], 500);
    }
    $conn->set_charset('utf8mb4');
    return $conn;
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

// Fetch all rows from a prepared statement as assoc array
function fetchAll(mysqli_stmt $stmt): array {
    $stmt->execute();
    $result = $stmt->get_result();
    return $result->fetch_all(MYSQLI_ASSOC);
}

// Fetch one row from a prepared statement as assoc array
function fetchOne(mysqli_stmt $stmt): ?array {
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    return $row ?: null;
}

// Build and execute a dynamic UPDATE statement with mysqli
// Returns true on success
function doUpdate(string $table, array $allowed, array $b, string $id, array $nullable = []): bool {
    $db   = getDB();
    $sets = [];
    $vals = [];
    $types = '';

    foreach ($allowed as $f) {
        if (!array_key_exists($f, $b)) continue;
        $sets[] = "`$f` = ?";
        $v = $b[$f];
        if (in_array($f, $nullable) && ($v === '' || $v === null)) {
            $v = null;
            $types .= 's'; // bind null as string type (mysqli handles null regardless of type)
        } else {
            $types .= 's';
        }
        $vals[] = $v;
    }

    if (empty($sets)) return true; // nothing to update

    $types .= 's'; // for the WHERE id
    $vals[] = $id;

    $sql  = "UPDATE `$table` SET " . implode(', ', $sets) . " WHERE id = ?";
    $stmt = $db->prepare($sql);
    if (!$stmt) respond(['error' => $db->error], 500);
    $stmt->bind_param($types, ...$vals);
    return $stmt->execute();
}

// ── ROUTE PARSING ─────────────────────────────────────────────
$resource  = trim($_GET['url']       ?? '');
$id        = trim($_GET['id']        ?? '');
$medecinId = trim($_GET['medecinId'] ?? '');
$method    = $_SERVER['REQUEST_METHOD'];

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

        $db = getDB();

        if ($role === 'admin') {
            $stmt = $db->prepare('SELECT id FROM admin WHERE username = ? AND password = ?');
            $stmt->bind_param('ss', $user, $pass);
            $row = fetchOne($stmt);
            if ($row) respond(['success' => true, 'role' => 'admin']);
            respond(['success' => false, 'error' => 'Identifiant ou mot de passe incorrect.'], 401);
        }

        if ($role === 'medecin') {
            $stmt = $db->prepare('SELECT * FROM medecins WHERE user = ? AND pass = ? AND actif = 1');
            $stmt->bind_param('ss', $user, $pass);
            $r = fetchOne($stmt);
            if ($r) respond(['success' => true, 'role' => 'medecin',
                'id' => $r['id'], 'nom' => $r['nom'], 'spec' => $r['spec'], 'color' => $r['color']]);
            respond(['success' => false, 'error' => 'Identifiant ou mot de passe incorrect.'], 401);
        }

        if ($role === 'patient') {
            $stmt = $db->prepare('SELECT * FROM patients WHERE (email = ? OR tel = ?) AND pass = ?');
            $stmt->bind_param('sss', $user, $user, $pass);
            $r = fetchOne($stmt);
            if ($r) respond(['success' => true, 'role' => 'patient', 'patient' => $r]);
            respond(['success' => false, 'error' => 'Identifiant ou mot de passe incorrect.'], 401);
        }

        respond(['success' => false, 'error' => 'Rôle inconnu.'], 400);
        break;

    // ═══════════ ADMIN PASSWORD ═══════════
    case 'admin':
        if ($method === 'PUT') {
            $b = body();
            if (!empty($b['pass'])) {
                $db   = getDB();
                $stmt = $db->prepare('UPDATE admin SET password = ? WHERE username = ?');
                $adm  = 'admin';
                $stmt->bind_param('ss', $b['pass'], $adm);
                $stmt->execute();
            }
            respond(['success' => true]);
        }
        respond(['error' => 'Method not allowed'], 405);
        break;

    // ═══════════ DASHBOARD ═══════════
    case 'dashboard':
        $db = getDB();
        $t  = today();

        $stmt = $db->prepare('SELECT COUNT(*) AS cnt FROM rdvs WHERE date = ?');
        $stmt->bind_param('s', $t);
        $stmt->execute();
        $rdvToday = (int)$stmt->get_result()->fetch_assoc()['cnt'];

        $q = fn(string $sql) => (int)$db->query($sql)->fetch_assoc()['cnt'];

        respond([
            'medecins'      => $q("SELECT COUNT(*) AS cnt FROM medecins WHERE actif = 1"),
            'patients'      => $q("SELECT COUNT(*) AS cnt FROM patients"),
            'dem_pending'   => $q("SELECT COUNT(*) AS cnt FROM demandes WHERE statut = 'En attente'"),
            'rdvs_today'    => $rdvToday,
            'prescriptions' => $q("SELECT COUNT(*) AS cnt FROM prescriptions"),
            'consultations' => $q("SELECT COUNT(*) AS cnt FROM consultations"),
        ]);
        break;

    // ═══════════ MÉDECINS ═══════════
    case 'medecins':
        $db = getDB();
        if ($method === 'GET') {
            $result = $db->query('SELECT * FROM medecins ORDER BY nom');
            respond($result->fetch_all(MYSQLI_ASSOC));
        }
        if ($method === 'POST') {
            $b   = body();
            $nid = !empty($b['id']) ? $b['id'] : uid();
            $nom   = $b['nom']   ?? '';
            $spec  = $b['spec']  ?? '';
            $tel   = $b['tel']   ?? '';
            $email = $b['email'] ?? '';
            $usr   = $b['user']  ?? '';
            $pas   = $b['pass']  ?? '';
            $col   = $b['color'] ?? '#16a34a';
            $act   = (int)($b['actif'] ?? 1);
            $stmt  = $db->prepare('INSERT INTO medecins (id,nom,spec,tel,email,user,pass,color,actif) VALUES (?,?,?,?,?,?,?,?,?)');
            $stmt->bind_param('ssssssss i', $nid, $nom, $spec, $tel, $email, $usr, $pas, $col, $act);
            // Fix: use correct types
            $stmt2 = $db->prepare('INSERT INTO medecins (id,nom,spec,tel,email,user,pass,color,actif) VALUES (?,?,?,?,?,?,?,?,?)');
            $stmt2->bind_param('ssssssssi', $nid, $nom, $spec, $tel, $email, $usr, $pas, $col, $act);
            $stmt2->execute();
            respond(['success' => true, 'id' => $nid]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            doUpdate('medecins', ['nom','spec','tel','email','user','pass','color','actif'], $b, $id);
            respond(['success' => true]);
        }
        if ($method === 'DELETE' && $id) {
            $stmt = $db->prepare('DELETE FROM medecins WHERE id = ?');
            $stmt->bind_param('s', $id);
            $stmt->execute();
            respond(['success' => true]);
        }
        respond(['error' => 'Bad request'], 400);
        break;

    // ═══════════ PATIENTS ═══════════
    case 'patients':
        $db = getDB();
        if ($method === 'GET') {
            $result = $db->query('SELECT * FROM patients ORDER BY nom');
            respond($result->fetch_all(MYSQLI_ASSOC));
        }
        if ($method === 'POST') {
            $b        = body();
            $nid      = !empty($b['id']) ? $b['id'] : uid();
            $nom      = $b['nom']        ?? '';
            $prenom   = $b['prenom']     ?? '';
            $nomFam   = $b['nomFamille'] ?? '';
            $sexe     = $b['sexe']       ?? '';
            $naiss    = ($b['naissance'] ?? '') ?: null;
            $tel      = $b['tel']        ?? '';
            $email    = $b['email']      ?? '';
            $pas      = $b['pass']       ?? '';
            $inscrit  = $b['inscrit']    ?? today();
            $stmt = $db->prepare('INSERT INTO patients (id,nom,prenom,nomFamille,sexe,naissance,tel,email,pass,inscrit) VALUES (?,?,?,?,?,?,?,?,?,?)');
            $stmt->bind_param('ssssssssss', $nid, $nom, $prenom, $nomFam, $sexe, $naiss, $tel, $email, $pas, $inscrit);
            $stmt->execute();
            respond(['success' => true, 'id' => $nid]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            doUpdate('patients', ['nom','prenom','nomFamille','sexe','naissance','tel','email','pass','inscrit'], $b, $id, ['naissance']);
            respond(['success' => true]);
        }
        if ($method === 'DELETE' && $id) {
            $stmt = $db->prepare('DELETE FROM patients WHERE id = ?');
            $stmt->bind_param('s', $id);
            $stmt->execute();
            respond(['success' => true]);
        }
        respond(['error' => 'Bad request'], 400);
        break;

    // ═══════════ RENDEZ-VOUS ═══════════
    case 'rdvs':
        $db = getDB();
        if ($method === 'GET') {
            $result = $db->query('SELECT * FROM rdvs ORDER BY date DESC, heure ASC');
            respond($result->fetch_all(MYSQLI_ASSOC));
        }
        if ($method === 'POST') {
            $b         = body();
            $nid       = !empty($b['id']) ? $b['id'] : uid();
            $patId     = ($b['patientId']  ?? '') ?: null;
            $medId     = ($b['medecinId']  ?? '') ?: null;
            $date      = $b['date']    ?? today();
            $heure     = $b['heure']   ?? '09:00';
            $motif     = $b['motif']   ?? '';
            $urgence   = $b['urgence'] ?? 'Normal';
            $statut    = $b['statut']  ?? 'En attente';
            $inscrit   = $b['inscrit'] ?? today();
            $stmt = $db->prepare('INSERT INTO rdvs (id,patientId,medecinId,date,heure,motif,urgence,statut,inscrit) VALUES (?,?,?,?,?,?,?,?,?)');
            $stmt->bind_param('sssssssss', $nid, $patId, $medId, $date, $heure, $motif, $urgence, $statut, $inscrit);
            $stmt->execute();
            respond(['success' => true, 'id' => $nid]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            doUpdate('rdvs', ['patientId','medecinId','date','heure','motif','urgence','statut','inscrit'], $b, $id, ['patientId','medecinId']);
            respond(['success' => true]);
        }
        if ($method === 'DELETE' && $id) {
            $stmt = $db->prepare('DELETE FROM rdvs WHERE id = ?');
            $stmt->bind_param('s', $id);
            $stmt->execute();
            respond(['success' => true]);
        }
        respond(['error' => 'Bad request'], 400);
        break;

    // ═══════════ CONSULTATIONS ═══════════
    case 'consultations':
        $db = getDB();
        if ($method === 'GET') {
            $result = $db->query('SELECT * FROM consultations ORDER BY date DESC');
            respond($result->fetch_all(MYSQLI_ASSOC));
        }
        if ($method === 'POST') {
            $b       = body();
            $nid     = !empty($b['id']) ? $b['id'] : uid();
            $patId   = ($b['patientId']  ?? '') ?: null;
            $medId   = ($b['medecinId']  ?? '') ?: null;
            $date    = $b['date']        ?? today();
            $motif   = $b['motif']       ?? '';
            $diag    = $b['diagnostic']  ?? '';
            $trait   = $b['traitement']  ?? '';
            $stmt = $db->prepare('INSERT INTO consultations (id,patientId,medecinId,date,motif,diagnostic,traitement) VALUES (?,?,?,?,?,?,?)');
            $stmt->bind_param('sssssss', $nid, $patId, $medId, $date, $motif, $diag, $trait);
            $stmt->execute();
            respond(['success' => true, 'id' => $nid]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            doUpdate('consultations', ['patientId','medecinId','date','motif','diagnostic','traitement'], $b, $id, ['patientId','medecinId']);
            respond(['success' => true]);
        }
        if ($method === 'DELETE' && $id) {
            $stmt = $db->prepare('DELETE FROM consultations WHERE id = ?');
            $stmt->bind_param('s', $id);
            $stmt->execute();
            respond(['success' => true]);
        }
        respond(['error' => 'Bad request'], 400);
        break;

    // ═══════════ DEMANDES ═══════════
    case 'demandes':
        $db = getDB();
        if ($method === 'GET') {
            $result = $db->query('SELECT * FROM demandes ORDER BY inscrit DESC');
            respond($result->fetch_all(MYSQLI_ASSOC));
        }
        if ($method === 'POST') {
            $b       = body();
            $nid     = !empty($b['id']) ? $b['id'] : uid();
            $patId   = ($b['patientId']  ?? '') ?: null;
            $nom     = $b['nom']         ?? '';
            $tel     = $b['tel']         ?? '';
            $email   = $b['email']       ?? '';
            $medId   = ($b['medecinId']  ?? '') ?: null;
            $date    = ($b['date']       ?? '') ?: null;
            $motif   = $b['motif']       ?? '';
            $urgence = $b['urgence']     ?? 'Normal';
            $msg     = $b['msg']         ?? '';
            $statut  = $b['statut']      ?? 'En attente';
            $inscrit = $b['inscrit']     ?? today();
            $note    = $b['noteReponse'] ?? '';
            $stmt = $db->prepare('INSERT INTO demandes (id,patientId,nom,tel,email,medecinId,date,motif,urgence,msg,statut,inscrit,noteReponse) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
            $stmt->bind_param('sssssssssssss', $nid, $patId, $nom, $tel, $email, $medId, $date, $motif, $urgence, $msg, $statut, $inscrit, $note);
            $stmt->execute();
            respond(['success' => true, 'id' => $nid]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            doUpdate('demandes', ['patientId','nom','tel','email','medecinId','date','motif','urgence','msg','statut','inscrit','noteReponse'], $b, $id, ['patientId','medecinId','date']);
            respond(['success' => true]);
        }
        if ($method === 'DELETE' && $id) {
            $stmt = $db->prepare('DELETE FROM demandes WHERE id = ?');
            $stmt->bind_param('s', $id);
            $stmt->execute();
            respond(['success' => true]);
        }
        respond(['error' => 'Bad request'], 400);
        break;

    // ═══════════ PRESCRIPTIONS ═══════════
    case 'prescriptions':
        $db = getDB();
        if ($method === 'GET') {
            $result = $db->query('SELECT * FROM prescriptions ORDER BY date DESC');
            respond($result->fetch_all(MYSQLI_ASSOC));
        }
        if ($method === 'POST') {
            $b     = body();
            $nid   = !empty($b['id']) ? $b['id'] : uid();
            $patId = ($b['patientId']  ?? '') ?: null;
            $medId = ($b['medecinId']  ?? '') ?: null;
            $date  = $b['date']        ?? today();
            $motif = $b['motif']       ?? '';
            $meds  = $b['medicaments'] ?? '';
            $notes = $b['notes']       ?? '';
            $stmt = $db->prepare('INSERT INTO prescriptions (id,patientId,medecinId,date,motif,medicaments,notes) VALUES (?,?,?,?,?,?,?)');
            $stmt->bind_param('sssssss', $nid, $patId, $medId, $date, $motif, $meds, $notes);
            $stmt->execute();
            respond(['success' => true, 'id' => $nid]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            doUpdate('prescriptions', ['patientId','medecinId','date','motif','medicaments','notes'], $b, $id, ['patientId','medecinId']);
            respond(['success' => true]);
        }
        if ($method === 'DELETE' && $id) {
            $stmt = $db->prepare('DELETE FROM prescriptions WHERE id = ?');
            $stmt->bind_param('s', $id);
            $stmt->execute();
            respond(['success' => true]);
        }
        respond(['error' => 'Bad request'], 400);
        break;

    // ═══════════ MÉDICAMENTS ═══════════
    case 'medicaments':
        $db = getDB();
        if ($method === 'GET') {
            $result = $db->query('SELECT * FROM medicaments ORDER BY nom');
            respond($result->fetch_all(MYSQLI_ASSOC));
        }
        if ($method === 'POST') {
            $b     = body();
            $nid   = !empty($b['id']) ? $b['id'] : uid();
            $nom   = $b['nom']         ?? '';
            $dos   = $b['dosage']      ?? '';
            $frm   = $b['forme']       ?? '';
            $cat   = $b['categorie']   ?? '';
            $desc  = $b['description'] ?? '';
            $stk   = (int)($b['stock']  ?? 0);
            $seuil = (int)($b['seuil']  ?? 20);
            $prix  = (float)($b['prix'] ?? 0);
            $four  = $b['fournisseur']  ?? '';
            $act   = (int)($b['actif']  ?? 1);
            $stmt = $db->prepare('INSERT INTO medicaments (id,nom,dosage,forme,categorie,description,stock,seuil,prix,fournisseur,actif) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
            $stmt->bind_param('ssssssiidsi', $nid, $nom, $dos, $frm, $cat, $desc, $stk, $seuil, $prix, $four, $act);
            $stmt->execute();
            respond(['success' => true, 'id' => $nid]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            doUpdate('medicaments', ['nom','dosage','forme','categorie','description','stock','seuil','prix','fournisseur','actif'], $b, $id);
            respond(['success' => true]);
        }
        if ($method === 'DELETE' && $id) {
            $stmt = $db->prepare('DELETE FROM medicaments WHERE id = ?');
            $stmt->bind_param('s', $id);
            $stmt->execute();
            respond(['success' => true]);
        }
        respond(['error' => 'Bad request'], 400);
        break;

    // ═══════════ DISPONIBILITÉS ═══════════
    case 'disponibilites':
        $db = getDB();
        if ($method === 'GET') {
            if ($medecinId) {
                $stmt = $db->prepare(
                    'SELECT d.*, m.nom AS medecinNom, m.spec
                     FROM disponibilites d
                     JOIN medecins m ON d.medecinId = m.id
                     WHERE d.medecinId = ?
                     ORDER BY FIELD(d.jour,"Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche")'
                );
                $stmt->bind_param('s', $medecinId);
                respond(fetchAll($stmt));
            } else {
                $result = $db->query(
                    'SELECT d.*, m.nom AS medecinNom, m.spec
                     FROM disponibilites d
                     JOIN medecins m ON d.medecinId = m.id
                     WHERE d.actif = 1
                     ORDER BY m.nom, FIELD(d.jour,"Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche")'
                );
                respond($result->fetch_all(MYSQLI_ASSOC));
            }
        }
        if ($method === 'POST') {
            $b    = body();
            $nid  = !empty($b['id']) ? $b['id'] : uid();
            $mId  = $b['medecinId']    ?? '';
            $jour = $b['jour']         ?? '';
            $hd   = $b['heure_debut']  ?? '08:00';
            $hf   = $b['heure_fin']    ?? '17:00';
            $act  = (int)($b['actif']  ?? 1);
            $stmt = $db->prepare('INSERT INTO disponibilites (id,medecinId,jour,heure_debut,heure_fin,actif) VALUES (?,?,?,?,?,?)');
            $stmt->bind_param('sssssi', $nid, $mId, $jour, $hd, $hf, $act);
            $stmt->execute();
            respond(['success' => true, 'id' => $nid]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            doUpdate('disponibilites', ['jour','heure_debut','heure_fin','actif'], $b, $id);
            respond(['success' => true]);
        }
        if ($method === 'DELETE' && $id) {
            $stmt = $db->prepare('DELETE FROM disponibilites WHERE id = ?');
            $stmt->bind_param('s', $id);
            $stmt->execute();
            respond(['success' => true]);
        }
        respond(['error' => 'Bad request'], 400);
        break;

    default:
        respond(['error' => "Unknown endpoint: '$resource'"], 404);
}
