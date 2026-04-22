-- ============================================================
===========================================================


USE `al-shifa`;

-- ─────────────────────────────────────────
--  TABLE : administrateur
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `admin` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `username`   VARCHAR(100) NOT NULL UNIQUE,
  `password`   VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO `admin` (`username`, `password`) VALUES
  ('admin', 'admin123');

-- ─────────────────────────────────────────
--  TABLE : medecins
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `medecins` (
  `id`        VARCHAR(20)  PRIMARY KEY,
  `nom`       VARCHAR(150) NOT NULL,
  `spec`      VARCHAR(100) DEFAULT '',
  `tel`       VARCHAR(30)  DEFAULT '',
  `email`     VARCHAR(150) DEFAULT '',
  `user`      VARCHAR(80)  NOT NULL UNIQUE,
  `pass`      VARCHAR(255) NOT NULL,
  `color`     VARCHAR(20)  DEFAULT '#16a34a',
  `actif`     TINYINT(1)   DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO `medecins` (`id`,`nom`,`spec`,`tel`,`email`,`user`,`pass`,`color`,`actif`) VALUES
  ('m001','Dr. Karim Benali',  'Cardiologie',      '0555 112 233','k.benali@clinic.dz', 'benali', 'medecin123','#16a34a',1),
  ('m002','Dr. Leila Hamidi',  'Pédiatrie',         '0555 445 566','l.hamidi@clinic.dz', 'hamidi', 'medecin123','#0891b2',1),
  ('m003','Dr. Yacine Djebbar','Médecine générale', '0555 778 899','y.djebbar@clinic.dz','djebbar','medecin123','#9333ea',1),
  ('m004','Dr. Samira Aouf',   'Neurologie',        '0555 001 002','s.aouf@clinic.dz',   'aouf',   'medecin123','#db2777',1);

-- ─────────────────────────────────────────
--  TABLE : patients
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `patients` (
  `id`         VARCHAR(20)  PRIMARY KEY,
  `nom`        VARCHAR(150) NOT NULL,
  `prenom`     VARCHAR(80)  DEFAULT '',
  `nomFamille` VARCHAR(80)  DEFAULT '',
  `sexe`       VARCHAR(20)  DEFAULT '',
  `naissance`  DATE         DEFAULT NULL,
  `tel`        VARCHAR(30)  DEFAULT '',
  `email`      VARCHAR(150) DEFAULT '',
  `pass`       VARCHAR(255) DEFAULT '',
  `inscrit`    DATE         DEFAULT (CURRENT_DATE),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO `patients` (`id`,`nom`,`sexe`,`naissance`,`tel`,`email`,`inscrit`) VALUES
  ('p001','Ahmed Bouzidi', 'Masculin','1985-03-12','0661 222 333','a.bouzidi@gmail.com', '2024-01-15'),
  ('p002','Fatima Merzouk','Féminin', '1972-07-25','0661 444 555','f.merzouk@gmail.com', '2024-02-20'),
  ('p003','Omar Chennouf', 'Masculin','1990-11-01','0661 666 777','o.chennouf@yahoo.fr', '2024-03-05');

-- ─────────────────────────────────────────
--  TABLE : rdvs
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `rdvs` (
  `id`         VARCHAR(20)  PRIMARY KEY,
  `patientId`  VARCHAR(20)  DEFAULT NULL,
  `medecinId`  VARCHAR(20)  DEFAULT NULL,
  `date`       DATE         NOT NULL,
  `heure`      TIME         NOT NULL,
  `motif`      VARCHAR(200) DEFAULT '',
  `urgence`    VARCHAR(30)  DEFAULT 'Normal',
  `statut`     VARCHAR(30)  DEFAULT 'En attente',
  `inscrit`    DATE         DEFAULT (CURRENT_DATE),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`medecinId`) REFERENCES `medecins`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO `rdvs` (`id`,`patientId`,`medecinId`,`date`,`heure`,`motif`,`urgence`,`statut`,`inscrit`) VALUES
  ('r001','p001','m001',CURRENT_DATE,'09:30','Contrôle de routine',     'Normal','Confirmé', CURRENT_DATE),
  ('r002','p002','m002',CURRENT_DATE,'11:00','Consultation pédiatrique','Normal','En attente',CURRENT_DATE);

-- ─────────────────────────────────────────
--  TABLE : consultations
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `consultations` (
  `id`          VARCHAR(20)  PRIMARY KEY,
  `patientId`   VARCHAR(20)  DEFAULT NULL,
  `medecinId`   VARCHAR(20)  DEFAULT NULL,
  `date`        DATE         NOT NULL,
  `motif`       VARCHAR(200) DEFAULT '',
  `diagnostic`  TEXT         DEFAULT '',
  `traitement`  TEXT         DEFAULT '',
  `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`medecinId`) REFERENCES `medecins`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO `consultations` (`id`,`patientId`,`medecinId`,`date`,`motif`,`diagnostic`,`traitement`) VALUES
  ('c001','p003','m003',CURRENT_DATE,'Grippe','Infection virale aiguë.','Paracétamol 500mg 3x/j');

-- ─────────────────────────────────────────
--  TABLE : demandes
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `demandes` (
  `id`           VARCHAR(20)  PRIMARY KEY,
  `patientId`    VARCHAR(20)  DEFAULT NULL,
  `nom`          VARCHAR(150) NOT NULL,
  `tel`          VARCHAR(30)  DEFAULT '',
  `email`        VARCHAR(150) DEFAULT '',
  `medecinId`    VARCHAR(20)  DEFAULT NULL,
  `date`         DATE         DEFAULT NULL,
  `motif`        VARCHAR(200) DEFAULT '',
  `urgence`      VARCHAR(30)  DEFAULT 'Normal',
  `msg`          TEXT         DEFAULT '',
  `statut`       VARCHAR(30)  DEFAULT 'En attente',
  `inscrit`      DATE         DEFAULT (CURRENT_DATE),
  `noteReponse`  TEXT         DEFAULT '',
  `created_at`   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`medecinId`) REFERENCES `medecins`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO `demandes` (`id`,`patientId`,`nom`,`tel`,`medecinId`,`date`,`motif`,`urgence`,`msg`,`statut`,`inscrit`) VALUES
  ('d001',NULL,'Nassima Haddad','0770 555 111','m001','2026-03-25','Douleur thoracique','Urgent','Douleurs depuis 3 jours.','En attente',CURRENT_DATE),
  ('d002',NULL,'Bilal Rahmani', '0550 888 222',NULL,  '2026-03-26','Bilan de santé',    'Normal','',                       'En attente',CURRENT_DATE);

-- ─────────────────────────────────────────
--  TABLE : prescriptions
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `prescriptions` (
  `id`           VARCHAR(20)  PRIMARY KEY,
  `patientId`    VARCHAR(20)  DEFAULT NULL,
  `medecinId`    VARCHAR(20)  DEFAULT NULL,
  `date`         DATE         NOT NULL,
  `motif`        VARCHAR(200) DEFAULT '',
  `medicaments`  TEXT         DEFAULT '',
  `notes`        TEXT         DEFAULT '',
  `created_at`   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`medecinId`) REFERENCES `medecins`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO `prescriptions` (`id`,`patientId`,`medecinId`,`date`,`motif`,`medicaments`,`notes`) VALUES
  ('rx01','p001','m001',CURRENT_DATE,'Hypertension',
   'Amlodipine 10mg — 1 comprimé/jour pendant 30 jours\nAspégic 100mg — 1 comprimé/jour (matin)',
   'Contrôle dans 1 mois. Régime sans sel.');

-- ─────────────────────────────────────────
--  TABLE : medicaments
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `medicaments` (
  `id`          VARCHAR(20)  PRIMARY KEY,
  `nom`         VARCHAR(150) NOT NULL,
  `dosage`      VARCHAR(80)  DEFAULT '',
  `forme`       VARCHAR(80)  DEFAULT '',
  `categorie`   VARCHAR(100) DEFAULT '',
  `description` TEXT         DEFAULT '',
  `stock`       INT          DEFAULT 0,
  `seuil`       INT          DEFAULT 20,
  `prix`        DECIMAL(10,2) DEFAULT 0,
  `fournisseur` VARCHAR(150) DEFAULT '',
  `actif`       TINYINT(1)   DEFAULT 1,
  `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO `medicaments` (`id`,`nom`,`dosage`,`forme`,`categorie`,`stock`,`seuil`,`prix`,`fournisseur`,`description`) VALUES
  ('med1','Paracétamol', '500 mg','Comprimé','Analgésique',        250,50,120,'Saidal', 'Antalgique et antipyrétique'),
  ('med2','Amoxicilline','1 g',   'Comprimé','Antibiotique',        80,30,450,'Biopharm','Antibiotique bêta-lactamine'),
  ('med3','Ibuprofène',  '400 mg','Comprimé','Anti-inflammatoire',  15,40,280,'Saidal', 'AINS'),
  ('med4','Amlodipine',  '10 mg', 'Comprimé','Antihypertenseur',     0,20,380,'LPA',    'Inhibiteur calcique'),
  ('med5','Metformine',  '850 mg','Comprimé','Antidiabétique',      120,30,220,'Biopharm','Antidiabétique oral');

-- ─────────────────────────────────────────
--  TABLE : disponibilites (médecins)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `disponibilites` (
  `id`          VARCHAR(20) PRIMARY KEY,
  `medecinId`   VARCHAR(20) NOT NULL,
  `jour`        VARCHAR(20) NOT NULL,
  `heure_debut` TIME        NOT NULL,
  `heure_fin`   TIME        NOT NULL,
  `actif`       TINYINT(1)  DEFAULT 1,
  `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`medecinId`) REFERENCES `medecins`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO `disponibilites` (`id`,`medecinId`,`jour`,`heure_debut`,`heure_fin`,`actif`) VALUES
  ('dsp1','m001','Lundi',   '08:00','12:00',1),
  ('dsp2','m001','Mercredi','14:00','18:00',1),
  ('dsp3','m002','Mardi',   '09:00','13:00',1),
  ('dsp4','m003','Lundi',   '08:00','16:00',1),
  ('dsp5','m003','Jeudi',   '08:00','12:00',1);
