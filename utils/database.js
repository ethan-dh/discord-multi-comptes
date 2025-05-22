const sqlite3 = require("sqlite3").verbose();

/**
 * Initialise la connexion à la base de données et crée les tables nécessaires
 * @returns {Database} L'instance de la base de données
 */
function initDatabase() {
  const db = new sqlite3.Database("./bot_database.sqlite", (err) => {
    if (err) {
      console.error(
        "Erreur lors de la connexion à la base de données:",
        err.message
      );
    } else {
      console.log("Connecté à la base de données SQLite");
    }
  });

  // Créer la table utilisateurs si elle n'existe pas
  db.run(
    `CREATE TABLE IF NOT EXISTS utilisateurs (
      id TEXT PRIMARY KEY,
      username TEXT,
      status TEXT DEFAULT 'normal',
      paye_2x BOOLEAN DEFAULT 0,
      date_ajout TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) {
        console.error(
          "Erreur lors de la création de la table utilisateurs:",
          err.message
        );
      } else {
        console.log("Table utilisateurs prête");
      }
    }
  );

  // Créer la table commandes si elle n'existe pas
  db.run(
    `CREATE TABLE IF NOT EXISTS commandes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      creator_id TEXT,
      montant REAL NOT NULL,
      date_commande TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES utilisateurs (id),
      FOREIGN KEY (creator_id) REFERENCES utilisateurs (id)
    )`,
    (err) => {
      if (err) {
        console.error(
          "Erreur lors de la création de la table commandes:",
          err.message
        );
      } else {
        console.log("Table commandes prête");
      }
    }
  );

  // Créer la table sexcams si elle n'existe pas
  db.run(
    `CREATE TABLE IF NOT EXISTS sexcams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      type TEXT NOT NULL,
      date_ajout TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES utilisateurs (id)
    )`,
    (err) => {
      if (err) {
        console.error(
          "Erreur lors de la création de la table sexcams:",
          err.message
        );
      } else {
        console.log("Table sexcams prête");
      }
    }
  );

  // Créer la table selfbots si elle n'existe pas
  db.run(
    `CREATE TABLE IF NOT EXISTS selfbots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      bump_channel_id TEXT NOT NULL,
      username TEXT,
      status TEXT DEFAULT 'stopped',
      date_ajout TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) {
        console.error(
          "Erreur lors de la création de la table selfbots:",
          err.message
        );
      } else {
        console.log("Table selfbots prête");
      }
    }
  );

  // Créer la table messages_prives pour stocker les messages reçus par les selfbots
  db.run(
    `CREATE TABLE IF NOT EXISTS messages_prives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      selfbot_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT,
      has_files BOOLEAN DEFAULT 0,
      files_data TEXT,
      has_stickers BOOLEAN DEFAULT 0,
      stickers_data TEXT,
      date_reception TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) {
        console.error(
          "Erreur lors de la création de la table messages_prives:",
          err.message
        );
      } else {
        console.log("Table messages_prives prête");
      }
    }
  );

  return db;
}

module.exports = { initDatabase };
