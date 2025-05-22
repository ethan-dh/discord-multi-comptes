const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
} = require("discord.js");
const {
  createSuccessEmbed,
  createErrorEmbed,
} = require("../utils/embedBuilder");

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("perte_temps")
    .setContexts(0, 1, 2)
    .setType(ApplicationCommandType.User)
    .setIntegrationTypes(1),

  async execute(interaction, db) {
    const targetUser = interaction.targetUser;

    try {
      // Mettre à jour ou créer l'utilisateur dans la base de données
      db.run(
        `INSERT OR REPLACE INTO utilisateurs (id, username, status) 
         VALUES (?, ?, 'perte_temps')`,
        [targetUser.id, targetUser.username],
        function (err) {
          if (err) {
            console.error(
              "Erreur lors de la mise à jour de l'utilisateur:",
              err.message
            );
            throw err;
          }

          console.log(
            `Utilisateur ${targetUser.username} (${targetUser.id}) marqué comme perte de temps`
          );
        }
      );

      // Créer un embed de confirmation
      const confirmEmbed = createSuccessEmbed(
        "Utilisateur marqué comme perte de temps",
        `${targetUser.username} a été marqué comme perte de temps dans la base de données.`,
        [
          { name: "Utilisateur", value: targetUser.username, inline: true },
          { name: "ID", value: targetUser.id, inline: true },
          { name: "Statut", value: "Perte de temps", inline: true },
          {
            name: "Date",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true,
          },
        ]
      );

      await interaction.reply({
        embeds: [confirmEmbed],
        ephemeral: true,
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'utilisateur:", error);

      const errorEmbed = createErrorEmbed(
        "Erreur",
        `Une erreur s'est produite lors de la mise à jour de l'utilisateur: ${error.message}`
      );

      await interaction.reply({
        embeds: [errorEmbed],
        ephemeral: true,
      });
    }
  },
};
