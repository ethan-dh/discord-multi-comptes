const { EmbedBuilder } = require("discord.js");

/**
 * Crée un embed standard pour le bot
 * @param {Object} options - Options de configuration de l'embed
 * @returns {EmbedBuilder} L'embed créé
 */
function createEmbed(options = {}) {
  const {
    title,
    description,
    color = 0x3498db, // Couleur bleue par défaut
    thumbnail,
    image,
    author,
    footer = { text: "© Bot Discord" },
    timestamp = true,
    fields = [],
  } = options;

  const embed = new EmbedBuilder();

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (color) embed.setColor(color);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
  if (author) embed.setAuthor(author);
  if (footer) embed.setFooter(footer);
  if (timestamp) embed.setTimestamp();

  // Ajouter les champs
  if (fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
}

/**
 * Crée un embed de succès
 * @param {string} title - Titre de l'embed
 * @param {string} description - Description de l'embed
 * @param {Array} fields - Champs additionnels
 * @returns {EmbedBuilder} L'embed de succès
 */
function createSuccessEmbed(title, description, fields = []) {
  return createEmbed({
    title,
    description,
    color: 0x2ecc71, // Vert
    fields,
    footer: { text: "✅ Opération réussie" },
  });
}

/**
 * Crée un embed d'erreur
 * @param {string} title - Titre de l'embed
 * @param {string} description - Description de l'embed
 * @returns {EmbedBuilder} L'embed d'erreur
 */
function createErrorEmbed(title, description) {
  return createEmbed({
    title,
    description,
    color: 0xe74c3c, // Rouge
    footer: { text: "❌ Une erreur est survenue" },
  });
}

/**
 * Crée un embed d'information utilisateur
 * @param {User} user - L'utilisateur Discord
 * @returns {EmbedBuilder} L'embed d'information utilisateur
 */
function createUserEmbed(user) {
  return createEmbed({
    title: `Information sur ${user.username}`,
    thumbnail: user.displayAvatarURL({ dynamic: true }),
    color: 0x9b59b6, // Violet
    fields: [
      { name: "ID", value: user.id, inline: true },
      { name: "Tag", value: user.tag, inline: true },
      {
        name: "Créé le",
        value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
        inline: false,
      },
      {
        name: "Créé il y a",
        value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
        inline: false,
      },
    ],
    footer: { text: "Informations utilisateur" },
  });
}

module.exports = {
  createEmbed,
  createSuccessEmbed,
  createErrorEmbed,
  createUserEmbed,
};
