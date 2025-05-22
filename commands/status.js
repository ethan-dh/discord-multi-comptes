const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  EmbedBuilder,
} = require("discord.js");
const { createEmbed } = require("../utils/embedBuilder");
const { isSelfbotActive } = require("../utils/selfbotManager");

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("status")
    .setType(ApplicationCommandType.User)
    .setContexts(0, 1, 2)
    .setIntegrationTypes(1),

  async execute(interaction, db) {
    const targetUser = interaction.targetUser;

    try {
      // Vérifier si l'utilisateur est un selfbot
      const selfbotInfo = await new Promise((resolve, reject) => {
        db.get(
          `SELECT * FROM selfbots WHERE user_id = ?`,
          [targetUser.id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      // Si c'est un selfbot, afficher les informations spécifiques aux selfbots
      if (selfbotInfo) {
        // Récupérer le nombre de messages privés reçus
        const messagesCount = await new Promise((resolve, reject) => {
          db.get(
            `SELECT COUNT(*) as count FROM messages_prives WHERE selfbot_id = ?`,
            [targetUser.id],
            (err, row) => {
              if (err) reject(err);
              else resolve(row ? row.count : 0);
            }
          );
        });

        // Récupérer les statistiques des commandes créées par ce selfbot
        const commandesStats = await new Promise((resolve, reject) => {
          db.get(
            `SELECT 
              COUNT(*) as nb_commandes,
              SUM(montant) as total_genere,
              MIN(date_commande) as premiere_commande,
              MAX(date_commande) as derniere_commande
            FROM commandes 
            WHERE creator_id = ?`,
            [targetUser.id],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });

        // Récupérer les clients du selfbot (utilisateurs pour lesquels il a créé des commandes)
        const clients = await new Promise((resolve, reject) => {
          db.all(
            `SELECT 
              user_id,
              COUNT(*) as nb_commandes,
              SUM(montant) as total_montant
            FROM commandes 
            WHERE creator_id = ?
            GROUP BY user_id
            ORDER BY total_montant DESC
            LIMIT 5`,
            [targetUser.id],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            }
          );
        });

        // Récupérer les statistiques des messages par expéditeur
        const messagesByUser = await new Promise((resolve, reject) => {
          db.all(
            `SELECT sender_id, COUNT(*) as count 
             FROM messages_prives 
             WHERE selfbot_id = ? 
             GROUP BY sender_id 
             ORDER BY count DESC 
             LIMIT 10`,
            [targetUser.id],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            }
          );
        });

        // Récupérer les statistiques des messages par jour
        const messagesByDay = await new Promise((resolve, reject) => {
          db.all(
            `SELECT 
              strftime('%Y-%m-%d', date_reception) as day, 
              COUNT(*) as count 
             FROM messages_prives 
             WHERE selfbot_id = ? 
             GROUP BY day 
             ORDER BY day DESC 
             LIMIT 7`,
            [targetUser.id],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            }
          );
        });

        // Créer l'embed pour le selfbot
        const selfbotEmbed = createEmbed({
          title: `🤖 Status du Selfbot ${targetUser.username}`,
          description: `Informations détaillées sur le selfbot`,
          color: 0x3498db, // Bleu
          thumbnail: targetUser.displayAvatarURL({ dynamic: true }),
          fields: [
            {
              name: "📊 Statut",
              value: isSelfbotActive(selfbotInfo.id)
                ? "🟢 Actif"
                : "🔴 Inactif",
              inline: true,
            },
            {
              name: "📅 Ajouté le",
              value: `<t:${Math.floor(
                new Date(selfbotInfo.date_ajout).getTime() / 1000
              )}:R>`,
              inline: true,
            },
            {
              name: "💬 Messages privés reçus",
              value: `**${messagesCount}** message${
                messagesCount !== 1 ? "s" : ""
              }`,
              inline: true,
            },
            {
              name: "📈 Canal de bump",
              value: `<#${selfbotInfo.bump_channel_id}>`,
              inline: true,
            },
          ],
        });

        // Ajouter les statistiques des commandes si disponibles
        if (commandesStats && commandesStats.nb_commandes > 0) {
          selfbotEmbed.addFields([
            {
              name: "🛒 Commandes créées",
              value: `**${commandesStats.nb_commandes}** commande${
                commandesStats.nb_commandes !== 1 ? "s" : ""
              }`,
              inline: true,
            },
            {
              name: "💰 Argent généré",
              value: `**${
                commandesStats.total_genere
                  ? commandesStats.total_genere.toFixed(2)
                  : "0.00"
              }€**`,
              inline: true,
            },
            {
              name: "📊 Moyenne par commande",
              value:
                commandesStats.nb_commandes > 0
                  ? `**${(
                      commandesStats.total_genere / commandesStats.nb_commandes
                    ).toFixed(2)}€**`
                  : "N/A",
              inline: true,
            },
          ]);

          // Ajouter les dates de première et dernière commande
          if (commandesStats.premiere_commande) {
            selfbotEmbed.addFields([
              {
                name: "🔰 Première commande",
                value: `<t:${Math.floor(
                  new Date(commandesStats.premiere_commande).getTime() / 1000
                )}:R>`,
                inline: true,
              },
              {
                name: "🔄 Dernière commande",
                value: `<t:${Math.floor(
                  new Date(commandesStats.derniere_commande).getTime() / 1000
                )}:R>`,
                inline: true,
              },
            ]);
          }
        }

        // Ajouter les clients principaux si disponibles
        if (clients.length > 0) {
          const clientsText = await Promise.all(
            clients.map(async (client) => {
              try {
                const discordUser = await interaction.client.users.fetch(
                  client.user_id
                );
                return `👤 **${discordUser.username}** : ${
                  client.nb_commandes
                } commande${
                  client.nb_commandes !== 1 ? "s" : ""
                } (**${client.total_montant.toFixed(2)}€**)`;
              } catch (error) {
                return `👤 **${client.user_id}** : ${
                  client.nb_commandes
                } commande${
                  client.nb_commandes !== 1 ? "s" : ""
                } (**${client.total_montant.toFixed(2)}€**)`;
              }
            })
          );

          selfbotEmbed.addFields([
            {
              name: "👥 Top clients",
              value: clientsText.join("\n"),
              inline: false,
            },
          ]);
        }

        // Ajouter les statistiques des messages par jour si disponibles
        if (messagesByDay.length > 0) {
          const messagesByDayText = messagesByDay
            .map(
              (day) =>
                `📆 **${day.day}** : ${day.count} message${
                  day.count !== 1 ? "s" : ""
                }`
            )
            .join("\n");

          selfbotEmbed.addFields([
            {
              name: "📊 Messages par jour (7 derniers jours)",
              value: messagesByDayText,
              inline: false,
            },
          ]);
        }

        // Ajouter les statistiques des messages par expéditeur si disponibles
        if (messagesByUser.length > 0) {
          const messagesByUserText = await Promise.all(
            messagesByUser.map(async (user) => {
              try {
                const discordUser = await interaction.client.users.fetch(
                  user.sender_id
                );
                return `👤 **${discordUser.username}** : ${user.count} message${
                  user.count !== 1 ? "s" : ""
                }`;
              } catch (error) {
                return `👤 **${user.sender_id}** : ${user.count} message${
                  user.count !== 1 ? "s" : ""
                }`;
              }
            })
          );

          selfbotEmbed.addFields([
            {
              name: "👥 Top expéditeurs de messages",
              value: messagesByUserText.join("\n"),
              inline: false,
            },
          ]);
        }

        await interaction.reply({ embeds: [selfbotEmbed], ephemeral: true });
        return;
      }

      // Si ce n'est pas un selfbot, continuer avec le comportement normal
      // Récupérer les informations de l'utilisateur
      const userInfo = await new Promise((resolve, reject) => {
        db.get(
          `SELECT * FROM utilisateurs WHERE id = ?`,
          [targetUser.id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!userInfo) {
        // L'utilisateur n'existe pas dans la base de données
        const noDataEmbed = createEmbed({
          title: `📊 Status de ${targetUser.username}`,
          description: "Aucune information disponible pour cet utilisateur.",
          color: 0x95a5a6,
          thumbnail: targetUser.displayAvatarURL({ dynamic: true }),
          footer: { text: "Aucune donnée" },
        });

        await interaction.reply({ embeds: [noDataEmbed], ephemeral: true });
        return;
      }

      // Récupérer les statistiques d'achat
      const achatsStats = await new Promise((resolve, reject) => {
        db.get(
          `SELECT 
            COUNT(*) as nb_commandes,
            SUM(montant) as total_depense,
            MIN(date_commande) as premiere_commande,
            MAX(date_commande) as derniere_commande
          FROM commandes 
          WHERE user_id = ?`,
          [targetUser.id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      // Récupérer les sexcams de l'utilisateur
      const sexcams = await new Promise((resolve, reject) => {
        db.all(
          `SELECT type, date_ajout FROM sexcams WHERE user_id = ? ORDER BY date_ajout DESC`,
          [targetUser.id],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      // Récupérer les vendeurs qui lui ont vendu
      const vendeurs = await new Promise((resolve, reject) => {
        db.all(
          `SELECT 
            c.creator_id as id,
            COUNT(*) as nb_ventes,
            SUM(montant) as total_montant
          FROM commandes c
          WHERE c.user_id = ?
          GROUP BY c.creator_id
          ORDER BY total_montant DESC`,
          [targetUser.id],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      // Créer l'embed principal avec les informations générales
      const statusEmbed = createEmbed({
        title: `📊 Status de ${targetUser.username}`,
        description: `Informations détaillées sur l'utilisateur`,
        color: getStatusColor(userInfo.status),
        thumbnail: targetUser.displayAvatarURL({ dynamic: true }),
        fields: [
          {
            name: "📈 Statut",
            value:
              getStatusEmoji(userInfo.status) +
              " " +
              formatStatus(userInfo.status),
            inline: true,
          },
          {
            name: "💳 Paiements multiples",
            value: userInfo.paye_2x ? "✅ Oui" : "❌ Non",
            inline: true,
          },
          {
            name: "📅 Membre depuis",
            value: `<t:${Math.floor(
              new Date(userInfo.date_ajout).getTime() / 1000
            )}:R>`,
            inline: true,
          },
          {
            name: "🛒 Commandes",
            value: achatsStats.nb_commandes
              ? `**${achatsStats.nb_commandes}** commande${
                  achatsStats.nb_commandes > 1 ? "s" : ""
                }`
              : "Aucune commande",
            inline: true,
          },
          {
            name: "💰 Total dépensé",
            value: achatsStats.total_depense
              ? `**${achatsStats.total_depense.toFixed(2)}€**`
              : "0.00€",
            inline: true,
          },
          {
            name: "📊 Moyenne par commande",
            value: achatsStats.nb_commandes
              ? `**${(
                  achatsStats.total_depense / achatsStats.nb_commandes
                ).toFixed(2)}€**`
              : "N/A",
            inline: true,
          },
        ],
      });

      // Ajouter les informations sur la première et dernière commande si elles existent
      if (achatsStats.premiere_commande) {
        statusEmbed.addFields([
          {
            name: "🔰 Première commande",
            value: `<t:${Math.floor(
              new Date(achatsStats.premiere_commande).getTime() / 1000
            )}:R>`,
            inline: true,
          },
          {
            name: "🔄 Dernière commande",
            value: `<t:${Math.floor(
              new Date(achatsStats.derniere_commande).getTime() / 1000
            )}:R>`,
            inline: true,
          },
        ]);
      }

      // Ajouter la liste des vendeurs si elle existe
      if (vendeurs.length > 0) {
        const vendeursText = vendeurs
          .map(
            (v) =>
              `<@${v.id}> : **${v.nb_ventes}** commande${
                v.nb_ventes > 1 ? "s" : ""
              } (**${v.total_montant.toFixed(2)}€**)`
          )
          .join("\n");

        statusEmbed.addFields([
          {
            name: "🤝 Achats auprès de",
            value: vendeursText,
            inline: false,
          },
        ]);
      }

      // Ajouter les informations sur les sexcams si elles existent
      if (sexcams.length > 0) {
        const sexcamsText = sexcams
          .map(
            (cam) =>
              `✅ **${cam.type}** - <t:${Math.floor(
                new Date(cam.date_ajout).getTime() / 1000
              )}:R>`
          )
          .join("\n");

        statusEmbed.addFields([
          {
            name: "🎥 Sexcams réalisées",
            value: sexcamsText,
            inline: false,
          },
        ]);
      }

      // Créer des embeds supplémentaires pour les détails des vendeurs
      const vendeursEmbeds = [];

      if (vendeurs.length > 0) {
        // Récupérer les utilisateurs Discord pour obtenir leurs usernames
        const vendeurIds = vendeurs.map((v) => v.id);
        const vendeurUsers = [];

        // Récupérer les informations des utilisateurs
        for (const vendeurId of vendeurIds) {
          try {
            const user = await interaction.client.users.fetch(vendeurId);
            vendeurUsers.push({
              id: vendeurId,
              username: user.username,
              avatar: user.displayAvatarURL({ dynamic: true }),
            });
          } catch (error) {
            console.error(
              `Erreur lors de la récupération de l'utilisateur ${vendeurId}:`,
              error
            );
            vendeurUsers.push({
              id: vendeurId,
              username: "Utilisateur inconnu",
              avatar: null,
            });
          }
        }

        // Créer les embeds pour les vendeurs (maximum 25 champs par embed)
        const MAX_FIELDS_PER_EMBED = 25;
        let currentEmbed = new EmbedBuilder()
          .setTitle(`💰 Détails des achats de ${targetUser.username}`)
          .setColor(0x3498db);

        let fieldCount = 0;

        for (const vendeur of vendeurs) {
          // Trouver les informations de l'utilisateur
          const vendeurUser = vendeurUsers.find((u) => u.id === vendeur.id);

          // Récupérer les commandes de ce vendeur
          const commandes = await new Promise((resolve, reject) => {
            db.all(
              `SELECT montant, date_commande 
               FROM commandes 
               WHERE user_id = ? AND creator_id = ? 
               ORDER BY date_commande DESC`,
              [targetUser.id, vendeur.id],
              (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
              }
            );
          });

          // Créer un champ pour ce vendeur
          const commandesText = commandes
            .map(
              (cmd) =>
                `• **${cmd.montant.toFixed(2)}€** - <t:${Math.floor(
                  new Date(cmd.date_commande).getTime() / 1000
                )}:R>`
            )
            .join("\n");

          // Ajouter le champ à l'embed actuel
          currentEmbed.addFields({
            name: `${vendeurUser.username} (${vendeur.nb_ventes} commande${
              vendeur.nb_ventes > 1 ? "s" : ""
            } - ${vendeur.total_montant.toFixed(2)}€)`,
            value: commandesText,
            inline: false,
          });

          fieldCount++;

          // Si on atteint la limite de champs, créer un nouvel embed
          if (
            fieldCount >= MAX_FIELDS_PER_EMBED &&
            vendeurs.indexOf(vendeur) < vendeurs.length - 1
          ) {
            vendeursEmbeds.push(currentEmbed);
            currentEmbed = new EmbedBuilder()
              .setTitle(
                `💰 Détails des achats de ${targetUser.username} (suite)`
              )
              .setColor(0x3498db);
            fieldCount = 0;
          }
        }

        // Ajouter le dernier embed s'il contient des champs
        if (fieldCount > 0) {
          vendeursEmbeds.push(currentEmbed);
        }
      }

      // Envoyer les embeds
      await interaction.reply({ embeds: [statusEmbed], ephemeral: true });

      // Envoyer les embeds supplémentaires
      for (const embed of vendeursEmbeds) {
        await interaction.followUp({ embeds: [embed], ephemeral: true });
      }
    } catch (error) {
      console.error("Erreur lors de l'exécution de la commande status:", error);
      await interaction.reply({
        content:
          "Une erreur s'est produite lors de l'exécution de la commande.",
        ephemeral: true,
      });
    }
  },
};

// Fonction pour obtenir la couleur en fonction du statut
function getStatusColor(status) {
  switch (status) {
    case "vip":
      return 0xf1c40f; // Jaune
    case "blacklist":
      return 0xe74c3c; // Rouge
    case "normal":
    default:
      return 0x3498db; // Bleu
  }
}

// Fonction pour obtenir l'emoji en fonction du statut
function getStatusEmoji(status) {
  switch (status) {
    case "vip":
      return "⭐";
    case "blacklist":
      return "⛔";
    case "normal":
    default:
      return "👤";
  }
}

// Fonction pour formater le statut
function formatStatus(status) {
  switch (status) {
    case "vip":
      return "VIP";
    case "blacklist":
      return "Blacklisté";
    case "normal":
    default:
      return "Normal";
  }
}
