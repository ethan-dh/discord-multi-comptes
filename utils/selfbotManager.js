const { Client } = require("discord.js-selfbot-v13");

// Map pour stocker les instances de selfbots actifs
const activeSelfbots = new Map();

/**
 * Initialise un selfbot et le connecte à Discord
 * @param {Object} selfbotData - Les données du selfbot
 * @param {Database} db - L'instance de la base de données
 * @returns {Promise<Object>} - Résultat de l'opération
 */
async function startSelfbot(selfbotData, db) {
  try {
    // Vérifier si le selfbot est déjà actif
    if (activeSelfbots.has(selfbotData.id)) {
      return { success: false, message: "Ce selfbot est déjà actif" };
    }

    // Initialiser le client Discord
    const client = new Client({
      ws: { properties: { $browser: "Discord iOS" } },
      checkUpdate: false,
    });

    // Fonction pour enregistrer les logs avec horodatage
    const logWithTimestamp = (message) => {
      const timestamp = new Date().toLocaleString();
      console.log(
        `[${timestamp}] [Selfbot ${selfbotData.username}] ${message}`
      );
    };

    // Fonction pour envoyer un bump
    const bump = async () => {
      try {
        const channel = client.channels.cache.get(selfbotData.bump_channel_id);
        if (!channel) {
          logWithTimestamp(
            `Canal de bump non trouvé: ${selfbotData.bump_channel_id}`
          );
          return;
        }

        await channel.sendSlash("302050872383242240", "bump");
        logWithTimestamp("Bump envoyé");
      } catch (error) {
        logWithTimestamp(`Erreur lors de l'envoi du bump: ${error.message}`);
      }
    };

    // Événement de connexion
    client.once("ready", async () => {
      try {
        // Définir le statut
        client.user.setStatus("online");
        logWithTimestamp(`Connecté: ${client.user.username}`);

        // Mettre à jour le statut dans la base de données
        db.run(
          "UPDATE selfbots SET status = ?, username = ? WHERE id = ?",
          ["active", client.user.username, selfbotData.id],
          (err) => {
            if (err) {
              logWithTimestamp(
                `Erreur lors de la mise à jour du statut: ${err.message}`
              );
            }
          }
        );

        // Démarrer les bumps programmés
        bump()
          .then(() => {
            // Programmer les bumps toutes les 2 heures + un délai aléatoire (0-15 minutes)
            const bumpInterval = setInterval(async () => {
              try {
                await bump();
              } catch (error) {
                logWithTimestamp(
                  `Erreur lors de l'exécution du bump programmé: ${error.message}`
                );
              }
            }, 1000 * 60 * (120 + Math.floor(Math.random() * 16)));

            // Stocker l'intervalle pour pouvoir l'arrêter plus tard
            client.bumpInterval = bumpInterval;
          })
          .catch((error) => {
            logWithTimestamp(
              `Erreur lors de l'initialisation du bump: ${error.message}`
            );
          });
      } catch (error) {
        logWithTimestamp(
          `Erreur lors de la configuration initiale: ${error.message}`
        );
      }
    });

    // Événement de réception de message
    client.on("messageCreate", async (message) => {
      try {
        // Traiter uniquement les messages privés
        if (!message.guild && message.author.id !== client.user.id) {
          logWithTimestamp(`Message privé reçu de ${message.author.tag}`);

          // Préparer les données des fichiers s'il y en a
          let hasFiles = false;
          let filesData = null;
          if (message.attachments.size > 0) {
            hasFiles = true;
            filesData = JSON.stringify(
              Array.from(message.attachments.values())
            );
          }

          // Préparer les données des stickers s'il y en a
          let hasStickers = false;
          let stickersData = null;
          if (message.stickers && message.stickers.size > 0) {
            hasStickers = true;
            stickersData = JSON.stringify(
              Array.from(message.stickers.values())
            );
          }

          // Enregistrer le message dans la base de données avec l'ID Discord du selfbot
          db.run(
            `INSERT INTO messages_prives 
            (selfbot_id, sender_id, content, has_files, files_data, has_stickers, stickers_data) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              selfbotData.user_id, // Utiliser l'ID Discord du selfbot au lieu de l'ID de la base de données
              message.author.id,
              message.content || null,
              hasFiles ? 1 : 0,
              filesData,
              hasStickers ? 1 : 0,
              stickersData,
            ],
            (err) => {
              if (err) {
                logWithTimestamp(
                  `Erreur lors de l'enregistrement du message: ${err.message}`
                );
              }
            }
          );
        }
      } catch (error) {
        logWithTimestamp(
          `Erreur lors du traitement du message: ${error.message}`
        );
      }
    });

    // Se connecter à Discord
    await client.login(selfbotData.token);

    // Stocker l'instance du client
    activeSelfbots.set(selfbotData.id, client);

    return {
      success: true,
      message: `Selfbot ${client.user.username} démarré avec succès`,
    };
  } catch (error) {
    console.error(`Erreur lors du démarrage du selfbot: ${error.message}`);
    return { success: false, message: `Erreur: ${error.message}` };
  }
}

/**
 * Arrête un selfbot actif
 * @param {number} selfbotId - L'ID du selfbot à arrêter
 * @param {Database} db - L'instance de la base de données
 * @returns {Object} - Résultat de l'opération
 */
async function stopSelfbot(selfbotId, db) {
  try {
    // Vérifier si le selfbot est actif
    if (!activeSelfbots.has(selfbotId)) {
      return { success: false, message: "Ce selfbot n'est pas actif" };
    }

    const client = activeSelfbots.get(selfbotId);
    const username = client.user.username;

    // Arrêter l'intervalle de bump s'il existe
    if (client.bumpInterval) {
      clearInterval(client.bumpInterval);
    }

    // Déconnecter le client
    await client.destroy();

    // Retirer de la map des selfbots actifs
    activeSelfbots.delete(selfbotId);

    // Mettre à jour le statut dans la base de données
    db.run(
      "UPDATE selfbots SET status = ? WHERE id = ?",
      ["stopped", selfbotId],
      (err) => {
        if (err) {
          console.error(
            `Erreur lors de la mise à jour du statut: ${err.message}`
          );
        }
      }
    );

    return { success: true, message: `Selfbot ${username} arrêté avec succès` };
  } catch (error) {
    console.error(`Erreur lors de l'arrêt du selfbot: ${error.message}`);
    return { success: false, message: `Erreur: ${error.message}` };
  }
}

/**
 * Vérifie si un selfbot est actif
 * @param {number} selfbotId - L'ID du selfbot à vérifier
 * @returns {boolean} - True si le selfbot est actif, false sinon
 */
function isSelfbotActive(selfbotId) {
  return activeSelfbots.has(selfbotId);
}

/**
 * Récupère tous les selfbots actifs
 * @returns {Map} - Map des selfbots actifs
 */
function getActiveSelfbots() {
  return activeSelfbots;
}

module.exports = {
  startSelfbot,
  stopSelfbot,
  isSelfbotActive,
  getActiveSelfbots,
};
