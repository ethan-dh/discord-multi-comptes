const { Client, GatewayIntentBits } = require("discord.js");
const { botToken } = require("./config.json");
const { initDatabase } = require("./utils/database");
const { loadCommands, registerCommands } = require("./handlers/commandHandler");

// Créer un nouveau client Discord
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// Initialiser la base de données
const db = initDatabase();
// Stocker la base de données dans le client pour y accéder depuis les écouteurs d'événements
client.db = db;

// Collection pour stocker les commandes
client.commands = new Map();

// Quand le bot est prêt
client.once("ready", async () => {
  console.log(`Bot connecté en tant que ${client.user.tag}!`);

  // Charger les commandes
  loadCommands(client);

  // Enregistrer les commandes auprès de l'API Discord
  try {
    await registerCommands(client);
    console.log("Commandes enregistrées avec succès!");
  } catch (error) {
    console.error("Erreur lors de l'enregistrement des commandes:", error);
  }
});

// Gérer les interactions avec les commandes
client.on("interactionCreate", async (interaction) => {
  // Gérer l'autocomplétion
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;

    try {
      await command.autocomplete(interaction, db);
    } catch (error) {
      console.error(
        `Erreur lors de l'autocomplétion pour la commande ${interaction.commandName}:`,
        error
      );
    }
    return;
  }

  // Gérer les commandes slash
  if (!interaction.isCommand() && !interaction.isContextMenuCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction, db);
  } catch (error) {
    console.error(
      `Erreur lors de l'exécution de la commande ${interaction.commandName}:`,
      error
    );

    const { createErrorEmbed } = require("./utils/embedBuilder");
    const errorEmbed = createErrorEmbed(
      "Erreur de commande",
      "Une erreur s'est produite lors de l'exécution de cette commande."
    );

    if (interaction.replied || interaction.deferred) {
      await interaction
        .followUp({
          embeds: [errorEmbed],
          ephemeral: true,
        })
        .catch(console.error);
    } else {
      await interaction
        .reply({
          embeds: [errorEmbed],
          ephemeral: true,
        })
        .catch(console.error);
    }
  }
});

// Connexion du bot
client.login(botToken);

// Fermer la connexion à la base de données lorsque le bot se déconnecte
process.on("SIGINT", () => {
  db.close((err) => {
    if (err) {
      console.error(
        "Erreur lors de la fermeture de la base de données:",
        err.message
      );
    } else {
      console.log("Connexion à la base de données fermée");
    }
    process.exit(0);
  });
});
