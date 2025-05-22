const { SlashCommandBuilder } = require("discord.js");
const {
  createSuccessEmbed,
  createErrorEmbed,
} = require("../utils/embedBuilder");
const { Client } = require("discord.js-selfbot-v13");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ajouter-compte")
    .setDescription("Ajoute un compte selfbot")
    .addStringOption((option) =>
      option
        .setName("token")
        .setDescription("Token du compte Discord")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("bump_channel_id")
        .setDescription("ID du canal pour les bumps")
        .setRequired(true)
    ),

  async execute(interaction, db) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const token = interaction.options.getString("token");
      const bumpChannelId = interaction.options.getString("bump_channel_id");

      // Vérifier si le token est valide en se connectant temporairement
      const tempClient = new Client({
        ws: { properties: { $browser: "Discord iOS" } },
        checkUpdate: false,
      });

      try {
        await tempClient.login(token);
        const userId = tempClient.user.id;
        const username = tempClient.user.username;

        // Vérifier si le compte existe déjà dans la base de données
        db.get(
          "SELECT * FROM selfbots WHERE user_id = ?",
          [userId],
          async (err, row) => {
            if (err) {
              console.error("Erreur de base de données:", err.message);
              await interaction.editReply({
                embeds: [
                  createErrorEmbed(
                    "Erreur de base de données",
                    "Une erreur s'est produite lors de la vérification du compte."
                  ),
                ],
              });
              return;
            }

            if (row) {
              await interaction.editReply({
                embeds: [
                  createErrorEmbed(
                    "Compte déjà existant",
                    `Le compte ${username} (${userId}) est déjà enregistré.`
                  ),
                ],
              });
              return;
            }

            // Ajouter le compte à la base de données
            db.run(
              "INSERT INTO selfbots (user_id, token, bump_channel_id, username, status) VALUES (?, ?, ?, ?, ?)",
              [userId, token, bumpChannelId, username, "stopped"],
              async function (err) {
                if (err) {
                  console.error("Erreur d'insertion:", err.message);
                  await interaction.editReply({
                    embeds: [
                      createErrorEmbed(
                        "Erreur d'ajout",
                        "Une erreur s'est produite lors de l'ajout du compte."
                      ),
                    ],
                  });
                  return;
                }

                await interaction.editReply({
                  embeds: [
                    createSuccessEmbed(
                      "Compte ajouté",
                      `Le compte ${username} (${userId}) a été ajouté avec succès.`,
                      [
                        {
                          name: "ID",
                          value: `${this.lastID}`,
                          inline: true,
                        },
                        {
                          name: "Canal de bump",
                          value: bumpChannelId,
                          inline: true,
                        },
                        {
                          name: "Statut",
                          value: "Arrêté",
                          inline: true,
                        },
                      ]
                    ),
                  ],
                });
              }
            );
          }
        );
      } catch (error) {
        console.error("Erreur de connexion:", error.message);
        await interaction.editReply({
          embeds: [
            createErrorEmbed(
              "Token invalide",
              "Impossible de se connecter avec ce token. Veuillez vérifier qu'il est correct."
            ),
          ],
        });
      } finally {
        // Déconnecter le client temporaire
        if (tempClient.isReady()) {
          await tempClient.destroy();
        }
      }
    } catch (error) {
      console.error("Erreur générale:", error.message);
      await interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Erreur",
            "Une erreur s'est produite lors de l'ajout du compte."
          ),
        ],
      });
    }
  },
};
