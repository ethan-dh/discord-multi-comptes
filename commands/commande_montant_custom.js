const { Events } = require("discord.js");
const { createErrorEmbed } = require("../utils/embedBuilder");
const { MODAL_CUSTOM_PREFIX, enregistrerCommande } = require("./commande");

module.exports = {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction, client) {
    // Vérifier si c'est une soumission de modal et si elle correspond à notre préfixe
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith(MODAL_CUSTOM_PREFIX)) return;

    // Extraire l'ID d'interaction unique
    const interactionId = interaction.customId.replace(MODAL_CUSTOM_PREFIX, "");

    // Récupérer les informations stockées
    if (
      !client.pendingCustomAmounts ||
      !client.pendingCustomAmounts.has(interactionId)
    ) {
      await interaction
        .reply({
          embeds: [
            createErrorEmbed(
              "Erreur",
              "Impossible de traiter cette commande. Veuillez réessayer."
            ),
          ],
          ephemeral: true,
        })
        .catch(console.error);
      return;
    }

    // Récupérer les informations de l'utilisateur cible et de l'interaction d'origine
    const { targetUser, originalInteraction } =
      client.pendingCustomAmounts.get(interactionId);

    // Récupérer le montant saisi
    const montantInput = interaction.fields.getTextInputValue("montant-input");
    const montant = parseFloat(montantInput.replace(",", "."));

    // Vérifier que le montant est valide
    if (isNaN(montant) || montant <= 0) {
      await interaction
        .reply({
          embeds: [
            createErrorEmbed(
              "Erreur",
              "Veuillez entrer un montant valide (nombre positif)."
            ),
          ],
          ephemeral: true,
        })
        .catch((error) => {
          console.error(
            "Erreur lors de la réponse au modal (montant invalide):",
            error
          );
        });
      return;
    }

    try {
      // Récupérer la base de données depuis le client
      const db = client.db;

      // Enregistrer la commande
      await enregistrerCommande(interaction, db, targetUser, montant);

      // Nettoyer les données stockées
      client.pendingCustomAmounts.delete(interactionId);

      // Nettoyer les anciennes entrées après un certain temps
      setTimeout(() => {
        if (client.pendingCustomAmounts) {
          // Supprimer les entrées de plus de 10 minutes
          const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
          for (const [key, value] of client.pendingCustomAmounts.entries()) {
            if (value.timestamp && value.timestamp < tenMinutesAgo) {
              client.pendingCustomAmounts.delete(key);
            }
          }
        }
      }, 15 * 60 * 1000); // Exécuter toutes les 15 minutes
    } catch (error) {
      console.error(
        "Erreur lors du traitement du montant personnalisé:",
        error
      );

      try {
        if (!interaction.replied) {
          await interaction.reply({
            embeds: [
              createErrorEmbed(
                "Erreur",
                `Une erreur s'est produite lors du traitement de la commande: ${error.message}`
              ),
            ],
            ephemeral: true,
          });
        }
      } catch (replyError) {
        console.error("Erreur lors de la réponse d'erreur:", replyError);
      }
    }
  },
};
