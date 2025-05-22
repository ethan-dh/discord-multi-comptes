const fs = require("fs");
const path = require("path");

/**
 * Charge toutes les commandes depuis le dossier commands
 * @param {Client} client - Le client Discord
 */
function loadCommands(client) {
  const commandsPath = path.join(__dirname, "..", "commands");
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    // Vérifier si c'est une commande ou un écouteur d'événements
    if ("data" in command && "execute" in command) {
      // C'est une commande
      client.commands.set(command.data.name, command);
      console.log(`Commande chargée: ${command.data.name}`);
    } else if ("name" in command && "execute" in command) {
      // C'est un écouteur d'événements
      if (command.once) {
        client.once(command.name, (...args) =>
          command.execute(...args, client)
        );
      } else {
        client.on(command.name, (...args) => command.execute(...args, client));
      }
      console.log(`Écouteur d'événements chargé: ${command.name}`);
    } else {
      console.warn(
        `Le module dans ${filePath} n'est ni une commande ni un écouteur d'événements valide`
      );
    }
  }
}

/**
 * Enregistre les commandes auprès de l'API Discord
 * @param {Client} client - Le client Discord
 */
async function registerCommands(client) {
  const commands = Array.from(client.commands.values())
    .filter((command) => "data" in command) // Ne prendre que les commandes, pas les écouteurs
    .map((command) => command.data);

  await client.application.commands.set(commands);
}

module.exports = { loadCommands, registerCommands };
