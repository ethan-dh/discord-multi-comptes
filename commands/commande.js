const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const {
  createEmbed,
  createSuccessEmbed,
  createErrorEmbed,
} = require("../utils/embedBuilder");

// Identifiant unique pour les modals de montant personnalisé
const MODAL_CUSTOM_PREFIX = "montant-modal-custom-";

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("commande")
    .setContexts(0, 1, 2)
    .setType(ApplicationCommandType.User)
    .setIntegrationTypes(1),

  async execute(interaction, db) {
    const targetUser = interaction.targetUser;

    // Créer un embed pour la commande
    const commandeEmbed = createEmbed({
      title: "Nouvelle commande",
      description: `Vous êtes sur le point de créer une commande pour ${targetUser.username}.`,
      color: 0x3498db,
      thumbnail: targetUser.displayAvatarURL({ dynamic: true }),
      fields: [
        { name: "ID Utilisateur", value: targetUser.id, inline: true },
        { name: "Nom d'utilisateur", value: targetUser.username, inline: true },
      ],
      footer: { text: "💰 Sélectionnez un montant ou annulez" },
    });

    // Créer les boutons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("cancel")
        .setLabel("Annuler")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🗑️"),
      new ButtonBuilder()
        .setCustomId("10")
        .setLabel("10€")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("25")
        .setLabel("25€")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("50")
        .setLabel("50€")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("custom")
        .setLabel("Montant personnalisé")
        .setStyle(ButtonStyle.Secondary)
    );

    // Envoyer l'embed avec les boutons
    await interaction.reply({
      embeds: [commandeEmbed],
      components: [row],
      ephemeral: true,
    });

    // Récupérer la réponse avec la nouvelle méthode
    const response = await interaction.fetchReply();

    // Créer un collecteur pour les interactions avec les boutons
    const filter = (i) => i.user.id === interaction.user.id;
    const collector = response.createMessageComponentCollector({
      filter,
      time: 60000,
    });

    // Créer un identifiant unique pour cette interaction
    const interactionId = `${interaction.id}-${targetUser.id}`;

    collector.on("collect", async (i) => {
      // Annuler la commande
      if (i.customId === "cancel") {
        const cancelEmbed = createEmbed({
          title: "Commande annulée",
          description: "La commande a été annulée.",
          color: 0xe74c3c,
          footer: { text: "❌ Annulé" },
        });

        await i.update({
          embeds: [cancelEmbed],
          components: [],
        });

        collector.stop();
        return;
      }

      // Montant personnalisé
      if (i.customId === "custom") {
        // Créer un modal pour le montant personnalisé
        const modal = new ModalBuilder()
          .setCustomId(`${MODAL_CUSTOM_PREFIX}${interactionId}`)
          .setTitle("Montant personnalisé");

        const montantInput = new TextInputBuilder()
          .setCustomId("montant-input")
          .setLabel("Montant en euros (€)")
          .setPlaceholder("Exemple: 42.50")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const actionRow = new ActionRowBuilder().addComponents(montantInput);
        modal.addComponents(actionRow);

        // Stocker les informations nécessaires pour le traitement ultérieur
        if (!interaction.client.pendingCustomAmounts) {
          interaction.client.pendingCustomAmounts = new Map();
        }

        // Stocker les informations de l'utilisateur cible pour le traitement ultérieur
        interaction.client.pendingCustomAmounts.set(interactionId, {
          targetUser,
          originalInteraction: interaction,
          timestamp: Date.now(),
        });

        await i.showModal(modal);
        collector.stop();
        return;
      }

      // Montants prédéfinis (10, 25, 50)
      const montant = parseFloat(i.customId);
      await enregistrerCommande(i, db, targetUser, montant);
      collector.stop();
    });

    collector.on("end", () => {
      if (response.editable) {
        interaction
          .editReply({
            components: [],
          })
          .catch((error) => {
            console.error(
              "Erreur lors de la mise à jour de l'interaction:",
              error
            );
          });
      }
    });
  },

  // Exporter les constantes et fonctions utiles
  MODAL_CUSTOM_PREFIX,
  enregistrerCommande,
};

/**
 * Enregistre une commande dans la base de données
 * @param {Interaction} interaction - L'interaction Discord
 * @param {Database} db - La base de données
 * @param {User} targetUser - L'utilisateur cible
 * @param {number} montant - Le montant de la commande
 */
async function enregistrerCommande(interaction, db, targetUser, montant) {
  try {
    // Récupérer l'ID de l'utilisateur qui a initié la commande
    const creatorId = interaction.user.id;

    // Mettre à jour ou créer l'utilisateur dans la base de données
    db.run(
      `INSERT OR REPLACE INTO utilisateurs (id, username, status) 
       VALUES (?, ?, 'paye')`,
      [targetUser.id, targetUser.username],
      function (err) {
        if (err) {
          console.error(
            "Erreur lors de la mise à jour de l'utilisateur:",
            err.message
          );
          throw err;
        }

        // Ajouter la commande dans la base de données
        db.run(
          `INSERT INTO commandes (user_id, creator_id, montant) VALUES (?, ?, ?)`,
          [targetUser.id, creatorId, montant],
          function (err) {
            if (err) {
              console.error(
                "Erreur lors de l'ajout de la commande:",
                err.message
              );
              throw err;
            }

            const commandeId = this.lastID;
            console.log(
              `Commande #${commandeId} créée par ${interaction.user.username} (${creatorId}) pour ${targetUser.username} (${targetUser.id}) - Montant: ${montant}€`
            );
          }
        );
      }
    );

    // Créer un embed de confirmation
    const confirmEmbed = createSuccessEmbed(
      "Commande enregistrée",
      `Une commande de **${montant}€** a été enregistrée pour ${targetUser.username}.`,
      [
        { name: "Utilisateur", value: targetUser.username, inline: true },
        { name: "ID", value: targetUser.id, inline: true },
        { name: "Créateur", value: interaction.user.username, inline: true },
        { name: "Montant", value: `${montant}€`, inline: true },
        { name: "Statut", value: "Payé", inline: true },
        {
          name: "Date",
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        },
      ]
    );

    // Mettre à jour le message ou répondre
    if (interaction.isModalSubmit()) {
      await interaction
        .reply({
          embeds: [confirmEmbed],
          ephemeral: true,
        })
        .catch((error) => {
          console.error("Erreur lors de la réponse au modal:", error);
        });
    } else {
      await interaction
        .update({
          embeds: [confirmEmbed],
          components: [],
        })
        .catch((error) => {
          console.error(
            "Erreur lors de la mise à jour de l'interaction:",
            error
          );
        });
    }
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de la commande:", error);

    const errorEmbed = createErrorEmbed(
      "Erreur",
      `Une erreur s'est produite lors de l'enregistrement de la commande: ${error.message}`
    );

    try {
      if (interaction.isModalSubmit()) {
        if (!interaction.replied) {
          await interaction.reply({
            embeds: [errorEmbed],
            ephemeral: true,
          });
        }
      } else {
        await interaction.update({
          embeds: [errorEmbed],
          components: [],
        });
      }
    } catch (replyError) {
      console.error("Erreur lors de la réponse d'erreur:", replyError);
    }
  }
}
