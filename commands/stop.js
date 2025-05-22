const { SlashCommandBuilder } = require("discord.js");
const {
  createSuccessEmbed,
  createErrorEmbed,
} = require("../utils/embedBuilder");
const { stopSelfbot, isSelfbotActive } = require("../utils/selfbotManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Arrête un compte selfbot")
    .addStringOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("Nom d'utilisateur ou ID du compte à arrêter")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction, db) {
    const focusedValue = interaction.options.getFocused().toLowerCase();

    // Récupérer tous les selfbots
    db.all("SELECT id, user_id, username FROM selfbots", [], (err, rows) => {
      if (err) {
        console.error(
          "Erreur lors de la récupération des selfbots:",
          err.message
        );
        return interaction.respond([]);
      }

      // Filtrer les résultats en fonction de la saisie
      const filtered = rows.filter(
        (row) =>
          row.username.toLowerCase().includes(focusedValue) ||
          row.user_id.includes(focusedValue) ||
          row.id.toString().includes(focusedValue)
      );

      // Limiter à 25 résultats (limite Discord)
      const options = filtered.slice(0, 25).map((row) => ({
        name: `${row.username} (${row.user_id})`,
        value: row.id.toString(),
      }));

      interaction.respond(options);
    });
  },

  async execute(interaction, db) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const selfbotId = interaction.options.getString("utilisateur");

      // Vérifier si le selfbot existe
      db.get(
        "SELECT * FROM selfbots WHERE id = ?",
        [selfbotId],
        async (err, selfbot) => {
          if (err) {
            console.error("Erreur de base de données:", err.message);
            await interaction.editReply({
              embeds: [
                createErrorEmbed(
                  "Erreur de base de données",
                  "Une erreur s'est produite lors de la recherche du compte."
                ),
              ],
            });
            return;
          }

          if (!selfbot) {
            await interaction.editReply({
              embeds: [
                createErrorEmbed(
                  "Compte introuvable",
                  "Le compte spécifié n'existe pas."
                ),
              ],
            });
            return;
          }

          // Vérifier si le selfbot est actif
          if (!isSelfbotActive(selfbot.id)) {
            await interaction.editReply({
              embeds: [
                createErrorEmbed(
                  "Compte inactif",
                  `Le compte ${selfbot.username} n'est pas actif.`
                ),
              ],
            });
            return;
          }

          // Arrêter le selfbot
          const result = await stopSelfbot(selfbot.id, db);

          if (result.success) {
            await interaction.editReply({
              embeds: [
                createSuccessEmbed("Compte arrêté", result.message, [
                  {
                    name: "ID",
                    value: selfbot.id.toString(),
                    inline: true,
                  },
                  {
                    name: "Utilisateur",
                    value: selfbot.username,
                    inline: true,
                  },
                ]),
              ],
            });
          } else {
            await interaction.editReply({
              embeds: [createErrorEmbed("Erreur d'arrêt", result.message)],
            });
          }
        }
      );
    } catch (error) {
      console.error("Erreur générale:", error.message);
      await interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Erreur",
            "Une erreur s'est produite lors de l'arrêt du compte."
          ),
        ],
      });
    }
  },
};
