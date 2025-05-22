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
    .setName("paye_2x")
    .setContexts(0, 1, 2)
    .setType(ApplicationCommandType.User)
    .setIntegrationTypes(1),

  async execute(interaction, db) {
    const targetUser = interaction.targetUser;

    try {
      // Mettre à jour ou créer l'utilisateur dans la base de données
      db.run(
        `INSERT OR REPLACE INTO utilisateurs (id, username, status, paye_2x) 
         VALUES (?, ?, 'paye', 1)`,
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
            `Utilisateur ${targetUser.username} (${targetUser.id}) marqué comme payant 2x`
          );
        }
      );

      // Créer un embed de confirmation
      const confirmEmbed = createSuccessEmbed(
        "Utilisateur marqué comme payant 2x",
        `${targetUser.username} a été marqué comme payant 2x dans la base de données.`,
        [
          { name: "Utilisateur", value: targetUser.username, inline: true },
          { name: "ID", value: targetUser.id, inline: true },
          { name: "Statut", value: "Payant 2x", inline: true },
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
