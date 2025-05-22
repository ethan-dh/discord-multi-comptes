const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const { createEmbed } = require("../utils/embedBuilder");

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("Sexcam")
    .setType(ApplicationCommandType.User)
    .setContexts(0, 1, 2)
    .setIntegrationTypes(1),

  async execute(interaction, db) {
    const targetUser = interaction.targetUser;

    try {
      // Vérifier si l'utilisateur existe dans la base de données
      const userExists = await new Promise((resolve, reject) => {
        db.get(
          `SELECT id FROM utilisateurs WHERE id = ?`,
          [targetUser.id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      // Si l'utilisateur n'existe pas, l'ajouter
      if (!userExists) {
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO utilisateurs (id, username) VALUES (?, ?)`,
            [targetUser.id, targetUser.username],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Récupérer les cams déjà faites par l'utilisateur
      const existingCams = await new Promise((resolve, reject) => {
        db.all(
          `SELECT type FROM sexcams WHERE user_id = ?`,
          [targetUser.id],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map((row) => row.type));
          }
        );
      });

      // Créer l'embed
      const sexcamEmbed = createEmbed({
        title: `🎥 Sexcam - ${targetUser.username}`,
        description: `Sélectionnez le type de cam réalisé par ${targetUser.username}`,
        color: 0xe91e63,
        thumbnail: targetUser.displayAvatarURL({ dynamic: true }),
        fields: [
          {
            name: "Cams déjà réalisées",
            value:
              existingCams.length > 0
                ? existingCams.map((type) => `✅ ${type}`).join("\n")
                : "Aucune cam enregistrée",
          },
        ],
        footer: {
          text: "Cliquez sur un bouton pour enregistrer une nouvelle cam",
        },
      });

      // Créer les boutons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`sexcam_rose_${targetUser.id}`)
          .setLabel("Rose 13m")
          .setStyle(
            existingCams.includes("Rose 13m")
              ? ButtonStyle.Success
              : ButtonStyle.Primary
          )
          .setEmoji("🌹"),
        new ButtonBuilder()
          .setCustomId(`sexcam_blanc_${targetUser.id}`)
          .setLabel("Blanc 7m")
          .setStyle(
            existingCams.includes("Blanc 7m")
              ? ButtonStyle.Success
              : ButtonStyle.Primary
          )
          .setEmoji("⚪"),
        new ButtonBuilder()
          .setCustomId(`sexcam_ck_${targetUser.id}`)
          .setLabel("CK 3m")
          .setStyle(
            existingCams.includes("CK 3m")
              ? ButtonStyle.Success
              : ButtonStyle.Primary
          )
          .setEmoji("🔵")
      );

      // Envoyer le message avec les boutons
      const response = await interaction.reply({
        embeds: [sexcamEmbed],
        components: [row],
        ephemeral: true,
      });

      // Créer un collecteur pour les interactions avec les boutons
      const collector = response.createMessageComponentCollector({
        time: 60000, // 1 minute
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({
            content: "Vous ne pouvez pas utiliser ces boutons.",
            ephemeral: true,
          });
          return;
        }

        const [_, camType, userId] = i.customId.split("_");
        let camName;

        switch (camType) {
          case "rose":
            camName = "Rose 13m";
            break;
          case "blanc":
            camName = "Blanc 7m";
            break;
          case "ck":
            camName = "CK 3m";
            break;
          default:
            return;
        }

        // Vérifier si cette cam a déjà été enregistrée
        const camExists = existingCams.includes(camName);

        if (camExists) {
          // Supprimer la cam
          await new Promise((resolve, reject) => {
            db.run(
              `DELETE FROM sexcams WHERE user_id = ? AND type = ?`,
              [userId, camName],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });

          // Mettre à jour la liste des cams existantes
          const index = existingCams.indexOf(camName);
          if (index > -1) {
            existingCams.splice(index, 1);
          }

          await i.reply({
            content: `La cam ${camName} a été supprimée pour ${targetUser.username}.`,
            ephemeral: true,
          });
        } else {
          // Ajouter la cam
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO sexcams (user_id, type) VALUES (?, ?)`,
              [userId, camName],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });

          // Mettre à jour la liste des cams existantes
          existingCams.push(camName);

          await i.reply({
            content: `La cam ${camName} a été enregistrée pour ${targetUser.username}.`,
            ephemeral: true,
          });
        }

        // Mettre à jour l'embed et les boutons
        const updatedEmbed = createEmbed({
          title: `🎥 Sexcam - ${targetUser.username}`,
          description: `Sélectionnez le type de cam réalisé par ${targetUser.username}`,
          color: 0xe91e63,
          thumbnail: targetUser.displayAvatarURL({ dynamic: true }),
          fields: [
            {
              name: "Cams déjà réalisées",
              value:
                existingCams.length > 0
                  ? existingCams.map((type) => `✅ ${type}`).join("\n")
                  : "Aucune cam enregistrée",
            },
          ],
          footer: {
            text: "Cliquez sur un bouton pour enregistrer une nouvelle cam",
          },
        });

        const updatedRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`sexcam_rose_${targetUser.id}`)
            .setLabel("Rose 13m")
            .setStyle(
              existingCams.includes("Rose 13m")
                ? ButtonStyle.Success
                : ButtonStyle.Primary
            )
            .setEmoji("🌹"),
          new ButtonBuilder()
            .setCustomId(`sexcam_blanc_${targetUser.id}`)
            .setLabel("Blanc 7m")
            .setStyle(
              existingCams.includes("Blanc 7m")
                ? ButtonStyle.Success
                : ButtonStyle.Primary
            )
            .setEmoji("⚪"),
          new ButtonBuilder()
            .setCustomId(`sexcam_ck_${targetUser.id}`)
            .setLabel("CK 3m")
            .setStyle(
              existingCams.includes("CK 3m")
                ? ButtonStyle.Success
                : ButtonStyle.Primary
            )
            .setEmoji("🔵")
        );

        await interaction.editReply({
          embeds: [updatedEmbed],
          components: [updatedRow],
        });
      });

      collector.on("end", async () => {
        // Désactiver les boutons après expiration
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`sexcam_rose_${targetUser.id}`)
            .setLabel("Rose 13m")
            .setStyle(
              existingCams.includes("Rose 13m")
                ? ButtonStyle.Success
                : ButtonStyle.Secondary
            )
            .setEmoji("🌹")
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`sexcam_blanc_${targetUser.id}`)
            .setLabel("Blanc 7m")
            .setStyle(
              existingCams.includes("Blanc 7m")
                ? ButtonStyle.Success
                : ButtonStyle.Secondary
            )
            .setEmoji("⚪")
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`sexcam_ck_${targetUser.id}`)
            .setLabel("CK 3m")
            .setStyle(
              existingCams.includes("CK 3m")
                ? ButtonStyle.Success
                : ButtonStyle.Secondary
            )
            .setEmoji("🔵")
            .setDisabled(true)
        );

        await interaction.editReply({
          components: [disabledRow],
        });
      });
    } catch (error) {
      console.error("Erreur lors de l'exécution de la commande Sexcam:", error);
      await interaction.reply({
        content:
          "Une erreur s'est produite lors de l'exécution de cette commande.",
        ephemeral: true,
      });
    }
  },
};
