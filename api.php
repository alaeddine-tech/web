<?php
// ============================================================
//  Al Shifa — API PHP (backend/api.php)
//  Place in: C:/xampp/htdocs/alshifa/backend/api.php
// ============================================================

// ── CORS (allow frontend to call this API) ──────────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=UTF-8');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ── DATABASE CONNECTION ──────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_USER', 'root');       // XAMPP default
define('DB_PASS', '');           // XAMPP default (empty)
define('DB_NAME', 'al-shifa');

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO(
                'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
                DB_USER, DB_PASS,
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]
            );
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
            exit();
        }
    }
    return $pdo;
}

// ── HELPERS ──────────────────────────────────────────────────
function respond($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

function uid(): string {
    return substr(md5(uniqid((string)mt_rand(), true)), 0, 9);
}

function body(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

function today(): string {
    return date('Y-m-d');
}

// ── ROUTER ───────────────────────────────────────────────────
$url    = $_GET['url']    ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Parse: e.g. "medecins&id=abc" → resource=medecins, id=abc
$parts = explode('&', $url, 2);
$resource = $parts[0];
// Parse extra query params if present
$extra = [];
if (isset($parts[1])) {
    parse_str($parts[1], $extra);
}
$id = $extra['id'] ?? null;

switch ($resource) {

    // ── AUTH ────────────────────────────────────────────────
    case 'login':
        if ($method !== 'POST') respond(['error' => 'POST only'], 405);
        $b    = body();
        $role = $b['role'] ?? '';
        $user = trim($b['user'] ?? '');
        $pass = trim($b['pass'] ?? '');

        if ($role === 'admin') {
            $stmt = getDB()->prepare('SELECT * FROM admin WHERE username = ? AND password = ?');
            $stmt->execute([$user, $pass]);
            $row = $stmt->fetch();
            if ($row) {
                respond(['success' => true, 'role' => 'admin']);
            }
        } elseif ($role === 'medecin') {
            $stmt = getDB()->prepare('SELECT * FROM medecins WHERE user = ? AND pass = ? AND actif = 1');
            $stmt->execute([$user, $pass]);
            $row = $stmt->fetch();
            if ($row) {
                respond(['success' => true, 'role' => 'medecin',
                    'id'    => $row['id'],
                    'nom'   => $row['nom'],
                    'spec'  => $row['spec'],
                    'color' => $row['color'],
                ]);
            }
        } elseif ($role === 'patient') {
            // Patient login by email or tel + password
            $stmt = getDB()->prepare(
                'SELECT * FROM patients WHERE (email = ? OR tel = ?) AND pass = ?'
            );
            $stmt->execute([$user, $user, $pass]);
            $row = $stmt->fetch();
            if ($row) {
                respond(['success' => true, 'role' => 'patient', 'patient' => $row]);
            }
        }
        respond(['success' => false, 'error' => 'Identifiant ou mot de passe incorrect.'], 401);
        break;

    // ── DASHBOARD ───────────────────────────────────────────
    case 'dashboard':
        $db    = getDB();
        $today = today();
        $stmt  = $db->prepare('SELECT COUNT(*) FROM rdvs WHERE date = ?');
        $stmt->execute([$today]);
        respond([
            'medecins'      => (int)$db->query('SELECT COUNT(*) FROM medecins WHERE actif=1')->fetchColumn(),
            'patients'      => (int)$db->query('SELECT COUNT(*) FROM patients')->fetchColumn(),
            'dem_pending'   => (int)$db->query("SELECT COUNT(*) FROM demandes WHERE statut='En attente'")->fetchColumn(),
            'rdvs_today'    => (int)$stmt->fetchColumn(),
            'prescriptions' => (int)$db->query('SELECT COUNT(*) FROM prescriptions')->fetchColumn(),
            'consultations' => (int)$db->query('SELECT COUNT(*) FROM consultations')->fetchColumn(),
        ]);
        break;

    // ── MÉDECINS ─────────────────────────────────────────────
    case 'medecins':
        $db = getDB();
        if ($method === 'GET') {
            respond($db->query('SELECT * FROM medecins ORDER BY nom')->fetchAll());
        }
        if ($method === 'POST') {
            $b = body();
            $newId = $b['id'] ?? uid();
            $stmt = $db->prepare(
                'INSERT INTO medecins (id,nom,spec,tel,email,user,pass,color,actif)
                 VALUES (?,?,?,?,?,?,?,?,?)'
            );
            $stmt->execute([
                $newId,
                $b['nom'] ?? '', $b['spec'] ?? '', $b['tel'] ?? '',
                $b['email'] ?? '', $b['user'] ?? '', $b['pass'] ?? '',
                $b['color'] ?? '#16a34a', $b['actif'] ?? 1,
            ]);
            respond(['success' => true, 'id' => $newId]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            // Build dynamic UPDATE
            $sets = []; $vals = [];
            $allowed = ['nom','spec','tel','email','user','pass','color','actif'];
            foreach ($allowed as $f) {
                if (array_key_exists($f, $b)) {
                    $sets[] = "$f = ?";
                    $vals[] = $b[$f];
                }
            }
            if (empty($sets)) respond(['success' => true]);
            $vals[] = $id;
            $db->prepare('UPDATE medecins SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
            respond(['success' => true]);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM medecins WHERE id = ?')->execute([$id]);
            respond(['success' => true]);
        }
        break;

    // ── PATIENTS ─────────────────────────────────────────────
    case 'patients':
        $db = getDB();
        if ($method === 'GET') {
            respond($db->query('SELECT * FROM patients ORDER BY nom')->fetchAll());
        }
        if ($method === 'POST') {
            $b = body();
            $newId = $b['id'] ?? uid();
            $stmt = $db->prepare(
                'INSERT INTO patients (id,nom,prenom,nomFamille,sexe,naissance,tel,email,pass,inscrit)
                 VALUES (?,?,?,?,?,?,?,?,?,?)'
            );
            $stmt->execute([
                $newId,
                $b['nom']        ?? '',
                $b['prenom']     ?? '',
                $b['nomFamille'] ?? '',
                $b['sexe']       ?? '',
                $b['naissance']  ?: null,
                $b['tel']        ?? '',
                $b['email']      ?? '',
                $b['pass']       ?? '',
                $b['inscrit']    ?? today(),
            ]);
            respond(['success' => true, 'id' => $newId]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            $allowed = ['nom','prenom','nomFamille','sexe','naissance','tel','email','pass','inscrit'];
            $sets = []; $vals = [];
            foreach ($allowed as $f) {
                if (array_key_exists($f, $b)) {
                    $sets[] = "$f = ?";
                    $vals[] = ($f === 'naissance' && $b[$f] === '') ? null : $b[$f];
                }
            }
            if ($sets) {
                $vals[] = $id;
                $db->prepare('UPDATE patients SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
            }
            respond(['success' => true]);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM patients WHERE id = ?')->execute([$id]);
            respond(['success' => true]);
        }
        break;

    // ── RDVs ─────────────────────────────────────────────────
    case 'rdvs':
        $db = getDB();
        if ($method === 'GET') {
            respond($db->query('SELECT * FROM rdvs ORDER BY date DESC, heure ASC')->fetchAll());
        }
        if ($method === 'POST') {
            $b = body();
            $newId = $b['id'] ?? uid();
            $stmt = $db->prepare(
                'INSERT INTO rdvs (id,patientId,medecinId,date,heure,motif,urgence,statut,inscrit)
                 VALUES (?,?,?,?,?,?,?,?,?)'
            );
            $stmt->execute([
                $newId,
                $b['patientId'] ?: null, $b['medecinId'] ?: null,
                $b['date'], $b['heure'],
                $b['motif']   ?? '', $b['urgence'] ?? 'Normal',
                $b['statut']  ?? 'En attente', $b['inscrit'] ?? today(),
            ]);
            respond(['success' => true, 'id' => $newId]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            $allowed = ['patientId','medecinId','date','heure','motif','urgence','statut','inscrit'];
            $sets = []; $vals = [];
            foreach ($allowed as $f) {
                if (array_key_exists($f, $b)) {
                    $sets[] = "$f = ?";
                    $vals[] = ($b[$f] === '') ? null : $b[$f];
                }
            }
            if ($sets) {
                $vals[] = $id;
                $db->prepare('UPDATE rdvs SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
            }
            respond(['success' => true]);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM rdvs WHERE id = ?')->execute([$id]);
            respond(['success' => true]);
        }
        break;

    // ── CONSULTATIONS ────────────────────────────────────────
    case 'consultations':
        $db = getDB();
        if ($method === 'GET') {
            respond($db->query('SELECT * FROM consultations ORDER BY date DESC')->fetchAll());
        }
        if ($method === 'POST') {
            $b = body();
            $newId = $b['id'] ?? uid();
            $stmt = $db->prepare(
                'INSERT INTO consultations (id,patientId,medecinId,date,motif,diagnostic,traitement)
                 VALUES (?,?,?,?,?,?,?)'
            );
            $stmt->execute([
                $newId,
                $b['patientId'] ?: null, $b['medecinId'] ?: null,
                $b['date'], $b['motif'] ?? '',
                $b['diagnostic'] ?? '', $b['traitement'] ?? '',
            ]);
            respond(['success' => true, 'id' => $newId]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            $allowed = ['patientId','medecinId','date','motif','diagnostic','traitement'];
            $sets = []; $vals = [];
            foreach ($allowed as $f) {
                if (array_key_exists($f, $b)) {
                    $sets[] = "$f = ?";
                    $vals[] = ($b[$f] === '') ? null : $b[$f];
                }
            }
            if ($sets) {
                $vals[] = $id;
                $db->prepare('UPDATE consultations SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
            }
            respond(['success' => true]);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM consultations WHERE id = ?')->execute([$id]);
            respond(['success' => true]);
        }
        break;

    // ── DEMANDES ─────────────────────────────────────────────
    case 'demandes':
        $db = getDB();
        if ($method === 'GET') {
            respond($db->query('SELECT * FROM demandes ORDER BY inscrit DESC')->fetchAll());
        }
        if ($method === 'POST') {
            $b = body();
            $newId = $b['id'] ?? uid();
            $stmt = $db->prepare(
                'INSERT INTO demandes (id,patientId,nom,tel,email,medecinId,date,motif,urgence,msg,statut,inscrit,noteReponse)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
            );
            $stmt->execute([
                $newId,
                $b['patientId'] ?: null, $b['nom'] ?? '',
                $b['tel'] ?? '', $b['email'] ?? '',
                $b['medecinId'] ?: null, $b['date'] ?: null,
                $b['motif'] ?? '', $b['urgence'] ?? 'Normal',
                $b['msg'] ?? '', $b['statut'] ?? 'En attente',
                $b['inscrit'] ?? today(), $b['noteReponse'] ?? '',
            ]);
            respond(['success' => true, 'id' => $newId]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            $allowed = ['patientId','nom','tel','email','medecinId','date','motif','urgence','msg','statut','inscrit','noteReponse'];
            $sets = []; $vals = [];
            foreach ($allowed as $f) {
                if (array_key_exists($f, $b)) {
                    $sets[] = "$f = ?";
                    $vals[] = ($b[$f] === '') ? null : $b[$f];
                }
            }
            if ($sets) {
                $vals[] = $id;
                $db->prepare('UPDATE demandes SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
            }
            respond(['success' => true]);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM demandes WHERE id = ?')->execute([$id]);
            respond(['success' => true]);
        }
        break;

    // ── PRESCRIPTIONS ────────────────────────────────────────
    case 'prescriptions':
        $db = getDB();
        if ($method === 'GET') {
            respond($db->query('SELECT * FROM prescriptions ORDER BY date DESC')->fetchAll());
        }
        if ($method === 'POST') {
            $b = body();
            $newId = $b['id'] ?? uid();
            $stmt = $db->prepare(
                'INSERT INTO prescriptions (id,patientId,medecinId,date,motif,medicaments,notes)
                 VALUES (?,?,?,?,?,?,?)'
            );
            $stmt->execute([
                $newId,
                $b['patientId'] ?: null, $b['medecinId'] ?: null,
                $b['date'], $b['motif'] ?? '',
                $b['medicaments'] ?? '', $b['notes'] ?? '',
            ]);
            respond(['success' => true, 'id' => $newId]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            $allowed = ['patientId','medecinId','date','motif','medicaments','notes'];
            $sets = []; $vals = [];
            foreach ($allowed as $f) {
                if (array_key_exists($f, $b)) {
                    $sets[] = "$f = ?";
                    $vals[] = ($b[$f] === '') ? null : $b[$f];
                }
            }
            if ($sets) {
                $vals[] = $id;
                $db->prepare('UPDATE prescriptions SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
            }
            respond(['success' => true]);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM prescriptions WHERE id = ?')->execute([$id]);
            respond(['success' => true]);
        }
        break;

    // ── MÉDICAMENTS ──────────────────────────────────────────
    case 'medicaments':
        $db = getDB();
        if ($method === 'GET') {
            respond($db->query('SELECT * FROM medicaments ORDER BY nom')->fetchAll());
        }
        if ($method === 'POST') {
            $b = body();
            $newId = $b['id'] ?? uid();
            $stmt = $db->prepare(
                'INSERT INTO medicaments (id,nom,dosage,forme,categorie,description,stock,seuil,prix,fournisseur,actif)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)'
            );
            $stmt->execute([
                $newId,
                $b['nom'] ?? '', $b['dosage'] ?? '', $b['forme'] ?? '',
                $b['categorie'] ?? '', $b['description'] ?? '',
                $b['stock'] ?? 0, $b['seuil'] ?? 20, $b['prix'] ?? 0,
                $b['fournisseur'] ?? '', $b['actif'] ?? 1,
            ]);
            respond(['success' => true, 'id' => $newId]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            $allowed = ['nom','dosage','forme','categorie','description','stock','seuil','prix','fournisseur','actif'];
            $sets = []; $vals = [];
            foreach ($allowed as $f) {
                if (array_key_exists($f, $b)) {
                    $sets[] = "$f = ?";
                    $vals[] = $b[$f];
                }
            }
            if ($sets) {
                $vals[] = $id;
                $db->prepare('UPDATE medicaments SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
            }
            respond(['success' => true]);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM medicaments WHERE id = ?')->execute([$id]);
            respond(['success' => true]);
        }
        break;

    // ── DISPONIBILITÉS ───────────────────────────────────────
    case 'disponibilites':
        $db = getDB();
        $medecinId = $extra['medecinId'] ?? null;

        if ($method === 'GET') {
            if ($medecinId) {
                $stmt = $db->prepare(
                    'SELECT d.*, m.nom AS medecinNom, m.spec
                     FROM disponibilites d
                     JOIN medecins m ON d.medecinId = m.id
                     WHERE d.medecinId = ?
                     ORDER BY FIELD(d.jour,"Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche")'
                );
                $stmt->execute([$medecinId]);
            } else {
                $stmt = $db->query(
                    'SELECT d.*, m.nom AS medecinNom, m.spec
                     FROM disponibilites d
                     JOIN medecins m ON d.medecinId = m.id
                     WHERE d.actif = 1
                     ORDER BY m.nom, FIELD(d.jour,"Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche")'
                );
            }
            respond($stmt->fetchAll());
        }
        if ($method === 'POST') {
            $b = body();
            $newId = $b['id'] ?? uid();
            $stmt = $db->prepare(
                'INSERT INTO disponibilites (id,medecinId,jour,heure_debut,heure_fin,actif)
                 VALUES (?,?,?,?,?,?)'
            );
            $stmt->execute([
                $newId, $b['medecinId'], $b['jour'],
                $b['heure_debut'], $b['heure_fin'], $b['actif'] ?? 1,
            ]);
            respond(['success' => true, 'id' => $newId]);
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            $allowed = ['jour','heure_debut','heure_fin','actif'];
            $sets = []; $vals = [];
            foreach ($allowed as $f) {
                if (array_key_exists($f, $b)) {
                    $sets[] = "$f = ?";
                    $vals[] = $b[$f];
                }
            }
            if ($sets) {
                $vals[] = $id;
                $db->prepare('UPDATE disponibilites SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
            }
            respond(['success' => true]);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM disponibilites WHERE id = ?')->execute([$id]);
            respond(['success' => true]);
        }
        break;

    // ── DASHBOARD STATS (recalculate properly) ───────────────
    default:
        respond(['error' => "Unknown endpoint: $resource"], 404);
}
