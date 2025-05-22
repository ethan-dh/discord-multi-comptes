const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { createEmbed, createErrorEmbed } = require("../utils/embedBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("messages-prives")
    .setDescription("Affiche les messages privés reçus par les selfbots")
    .addStringOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("Nom d'utilisateur ou ID du compte (optionnel)")
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("limite")
        .setDescription("Nombre maximum de messages à afficher (défaut: 10)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25)
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

      // Ajouter une option "tous les comptes"
      const options = [{ name: "Tous les comptes", value: "all" }];

      // Ajouter les selfbots filtrés
      filtered.slice(0, 24).forEach((row) => {
        options.push({
          name: `${row.username} (${row.user_id})`,
          value: row.user_id, // Utiliser l'ID Discord du selfbot
        });
      });

      interaction.respond(options);
    });
  },

  async execute(interaction, db) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const selfbotId = interaction.options.getString("utilisateur") || "all";
      const limit = interaction.options.getInteger("limite") || 10;

      let query, params;

      if (selfbotId === "all") {
        // Récupérer les messages de tous les selfbots
        query = `
          SELECT mp.*, s.username as selfbot_username, s.user_id as selfbot_user_id
          FROM messages_prives mp
          JOIN selfbots s ON mp.selfbot_id = s.user_id
          ORDER BY mp.date_reception DESC
          LIMIT ?
        `;
        params = [limit];
      } else {
        // Vérifier si le selfbot existe
        db.get(
          "SELECT * FROM selfbots WHERE user_id = ?",
          [selfbotId],
          (err, selfbot) => {
            if (err || !selfbot) {
              interaction.editReply({
                embeds: [
                  createErrorEmbed(
                    "Compte introuvable",
                    "Le compte spécifié n'existe pas."
                  ),
                ],
              });
              return;
            }
          }
        );

        // Récupérer les messages d'un selfbot spécifique
        query = `
          SELECT mp.*, s.username as selfbot_username, s.user_id as selfbot_user_id
          FROM messages_prives mp
          JOIN selfbots s ON mp.selfbot_id = s.user_id
          WHERE mp.selfbot_id = ?
          ORDER BY mp.date_reception DESC
          LIMIT ?
        `;
        params = [selfbotId, limit];
      }

      // Exécuter la requête
      db.all(query, params, async (err, messages) => {
        if (err) {
          console.error("Erreur de base de données:", err.message);
          await interaction.editReply({
            embeds: [
              createErrorEmbed(
                "Erreur de base de données",
                "Une erreur s'est produite lors de la récupération des messages."
              ),
            ],
          });
          return;
        }

        if (messages.length === 0) {
          await interaction.editReply({
            embeds: [
              createEmbed({
                title: "Aucun message privé",
                description: "Aucun message privé n'a été trouvé.",
                color: 0xf1c40f, // Jaune
              }),
            ],
          });
          return;
        }

        // Créer un embed pour chaque message
        const embeds = messages.map((message) => {
          const embed = new EmbedBuilder()
            .setTitle(`Message privé reçu`)
            .setColor(0x3498db) // Bleu
            .addFields(
              {
                name: "Reçu par",
                value: `${message.selfbot_username} (${message.selfbot_user_id})`,
                inline: true,
              },
              {
                name: "Expéditeur",
                value: message.sender_id,
                inline: true,
              },
              {
                name: "Date",
                value: new Date(message.date_reception).toLocaleString(),
                inline: true,
              }
            )
            .setFooter({
              text: `ID: ${message.id}`,
            })
            .setTimestamp(new Date(message.date_reception));

          // Ajouter le contenu du message s'il existe
          if (message.content) {
            embed.setDescription(message.content);
          }

          // Ajouter des informations sur les fichiers s'il y en a
          if (message.has_files) {
            try {
              const filesData = JSON.parse(message.files_data);
              embed.addFields({
                name: "Fichiers joints",
                value: filesData
                  .map((file) => `[${file.name}](${file.url})`)
                  .join("\n"),
                inline: false,
              });

              // Ajouter la première image comme thumbnail si c'est une image
              const imageFile = filesData.find((file) =>
                file.contentType?.startsWith("image/")
              );
              if (imageFile) {
                embed.setThumbnail(imageFile.url);
              }
            } catch (error) {
              console.error(
                "Erreur lors du parsing des fichiers:",
                error.message
              );
              embed.addFields({
                name: "Fichiers joints",
                value: "Erreur lors de l'affichage des fichiers",
                inline: false,
              });
            }
          }

          // Ajouter des informations sur les stickers s'il y en a
          if (message.has_stickers) {
            try {
              const stickersData = JSON.parse(message.stickers_data);
              embed.addFields({
                name: "Stickers",
                value: stickersData
                  .map((sticker) => sticker.name || "Sticker inconnu")
                  .join(", "),
                inline: false,
              });
            } catch (error) {
              console.error(
                "Erreur lors du parsing des stickers:",
                error.message
              );
              embed.addFields({
                name: "Stickers",
                value: "Erreur lors de l'affichage des stickers",
                inline: false,
              });
            }
          }

          return embed;
        });

        // Envoyer les embeds
        await interaction.editReply({
          content: `${messages.length} message(s) privé(s) trouvé(s)`,
          embeds: embeds.slice(0, 10), // Discord limite à 10 embeds par message
        });

        // Si plus de 10 messages, envoyer les autres en messages séparés
        if (embeds.length > 10) {
          for (let i = 10; i < embeds.length; i += 10) {
            await interaction.followUp({
              embeds: embeds.slice(i, i + 10),
              ephemeral: true,
            });
          }
        }
      });
    } catch (error) {
      console.error("Erreur générale:", error.message);
      await interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Erreur",
            "Une erreur s'est produite lors de l'affichage des messages privés."
          ),
        ],
      });
    }
  },
};
