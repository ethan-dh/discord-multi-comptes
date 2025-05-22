const { SlashCommandBuilder } = require("discord.js");
const { createEmbed, createErrorEmbed } = require("../utils/embedBuilder");
const { isSelfbotActive } = require("../utils/selfbotManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("liste-comptes")
    .setDescription("Affiche la liste des comptes selfbots"),

  async execute(interaction, db) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Récupérer tous les selfbots
      db.all(
        "SELECT * FROM selfbots ORDER BY date_ajout DESC",
        [],
        async (err, selfbots) => {
          if (err) {
            console.error("Erreur de base de données:", err.message);
            await interaction.editReply({
              embeds: [
                createErrorEmbed(
                  "Erreur de base de données",
                  "Une erreur s'est produite lors de la récupération des comptes."
                ),
              ],
            });
            return;
          }

          if (selfbots.length === 0) {
            await interaction.editReply({
              embeds: [
                createEmbed({
                  title: "Aucun compte",
                  description: "Aucun compte selfbot n'a été ajouté.",
                  color: 0xf1c40f, // Jaune
                }),
              ],
            });
            return;
          }

          // Compter les messages privés pour chaque selfbot en utilisant l'ID Discord
          const countPromises = selfbots.map(
            (selfbot) =>
              new Promise((resolve) => {
                db.get(
                  "SELECT COUNT(*) as count FROM messages_prives WHERE selfbot_id = ?",
                  [selfbot.user_id],
                  (err, result) => {
                    if (err) {
                      console.error(
                        "Erreur lors du comptage des messages:",
                        err.message
                      );
                      resolve({ ...selfbot, messageCount: 0 });
                    } else {
                      resolve({
                        ...selfbot,
                        messageCount: result.count,
                        isActive: isSelfbotActive(selfbot.id),
                      });
                    }
                  }
                );
              })
          );

          // Attendre que tous les comptages soient terminés
          const selfbotsWithCounts = await Promise.all(countPromises);

          // Créer l'embed
          const embed = createEmbed({
            title: "Liste des comptes selfbots",
            description: `${selfbots.length} compte(s) trouvé(s)`,
            color: 0x3498db, // Bleu
            fields: selfbotsWithCounts.map((selfbot) => ({
              name: `${selfbot.username} (${selfbot.user_id})`,
              value: `**ID:** ${selfbot.id}\n**Statut:** ${
                selfbot.isActive ? "🟢 Actif" : "🔴 Inactif"
              }\n**Canal de bump:** ${
                selfbot.bump_channel_id
              }\n**Messages privés:** ${
                selfbot.messageCount
              }\n**Ajouté le:** <t:${Math.floor(
                new Date(selfbot.date_ajout).getTime() / 1000
              )}:R>`,
              inline: false,
            })),
            footer: { text: "Utilisez /start ou /stop pour gérer les comptes" },
          });

          await interaction.editReply({
            embeds: [embed],
          });
        }
      );
    } catch (error) {
      console.error("Erreur générale:", error.message);
      await interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Erreur",
            "Une erreur s'est produite lors de l'affichage des comptes."
          ),
        ],
      });
    }
  },
};
