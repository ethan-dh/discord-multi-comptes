const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { createEmbed } = require("../utils/embedBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Affiche les statistiques des commandes")
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("Voir les stats d'un utilisateur spécifique")
        .setRequired(false)
    ),

  async execute(interaction, db) {
    const user = interaction.options.getUser("utilisateur");
    const creatorFilter = user ? `WHERE creator_id = '${user.id}'` : "";

    try {
      // Récupérer les statistiques globales
      const globalStats = await new Promise((resolve, reject) => {
        db.get(
          `
          SELECT 
            COUNT(*) as total_commandes,
            SUM(montant) as montant_total,
            AVG(montant) as montant_moyen,
            COUNT(*) * 1.0 / (
              SELECT CAST(
                (julianday('now', 'localtime') - julianday(MIN(date_commande))) + 1 
                AS INTEGER
              ) FROM commandes ${creatorFilter}
            ) as moyenne_jour_commandes,
            SUM(montant) * 1.0 / (
              SELECT CAST(
                (julianday('now', 'localtime') - julianday(MIN(date_commande))) + 1 
                AS INTEGER
              ) FROM commandes ${creatorFilter}
            ) as moyenne_jour_montant
          FROM commandes
          ${creatorFilter}
        `,
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      // Statistiques par période
      const statsParPeriode = await new Promise((resolve, reject) => {
        db.all(
          `
          WITH RECURSIVE dates(date) AS (
            SELECT date('now', 'localtime', '-30 days')
            UNION ALL
            SELECT date(date, '+1 day')
            FROM dates
            WHERE date < date('now', 'localtime')
          )
          SELECT 
            dates.date,
            COUNT(c.id) as nb_commandes,
            COALESCE(SUM(c.montant), 0) as montant_total
          FROM dates
          LEFT JOIN commandes c ON date(c.date_commande) = dates.date
            ${creatorFilter ? `AND c.${creatorFilter.substring(6)}` : ""}
          GROUP BY dates.date
          ORDER BY dates.date DESC
        `,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      // Statistiques par heure
      const statsParHeure = await new Promise((resolve, reject) => {
        db.all(
          `
          SELECT 
            strftime('%H', date_commande) as heure,
            COUNT(*) as nb_commandes
          FROM commandes
          ${creatorFilter}
          GROUP BY heure
          ORDER BY heure
        `,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      // Statistiques par jour de la semaine
      const statsParJour = await new Promise((resolve, reject) => {
        db.all(
          `
          SELECT 
            strftime('%w', date_commande) as jour,
            COUNT(*) * 1.0 / (
              SELECT CAST(
                (julianday('now', 'localtime') - julianday(MIN(date_commande))) / 7 + 1 
                AS INTEGER
              ) FROM commandes ${creatorFilter}
            ) as moyenne_commandes
          FROM commandes
          ${creatorFilter}
          GROUP BY jour
          ORDER BY jour
        `,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      // Calculer les statistiques pour différentes périodes
      const aujourdhui = statsParPeriode[0];
      const hier = statsParPeriode[1];
      const sept_jours = statsParPeriode.slice(0, 7).reduce(
        (acc, curr) => ({
          nb_commandes: acc.nb_commandes + curr.nb_commandes,
          montant_total: acc.montant_total + curr.montant_total,
        }),
        { nb_commandes: 0, montant_total: 0 }
      );
      const trente_jours = statsParPeriode.reduce(
        (acc, curr) => ({
          nb_commandes: acc.nb_commandes + curr.nb_commandes,
          montant_total: acc.montant_total + curr.montant_total,
        }),
        { nb_commandes: 0, montant_total: 0 }
      );

      // Préparer les données pour les graphiques
      const heures = Array.from({ length: 24 }, (_, i) =>
        i.toString().padStart(2, "0")
      );
      const dataParHeure = heures.map((h) => {
        const stat = statsParHeure.find((s) => s.heure === h);
        return stat ? stat.nb_commandes : 0;
      });

      const joursNoms = [
        "Dimanche",
        "Lundi",
        "Mardi",
        "Mercredi",
        "Jeudi",
        "Vendredi",
        "Samedi",
      ];
      const dataParJour = Array.from({ length: 7 }, (_, i) => {
        const stat = statsParJour.find((s) => s.jour === i.toString());
        return stat ? stat.moyenne_commandes.toFixed(2) : "0.00";
      });

      // Créer les URLs des graphiques
      const graphiqueHeures = `https://quickchart.io/chart?c=${encodeURIComponent(
        JSON.stringify({
          type: "bar",
          data: {
            labels: heures,
            datasets: [
              {
                label: "Nombre de commandes",
                backgroundColor: "rgba(75, 192, 192, 0.5)",
                data: dataParHeure,
              },
            ],
          },
        })
      )}&w=500&h=300&bkg=white`;

      const graphiqueJours = `https://quickchart.io/chart?c=${encodeURIComponent(
        JSON.stringify({
          type: "bar",
          data: {
            labels: joursNoms,
            datasets: [
              {
                label: "Nombre de commandes moyen",
                backgroundColor: "rgba(75, 192, 192, 0.5)",
                borderColor: "rgb(75, 192, 192)",
                borderWidth: 1,
                data: dataParJour,
              },
            ],
          },
        })
      )}&w=800&h=400&bkg=white`;

      // Créer le message de statistiques
      const message = `**Statistiques des commandes${
        user ? ` de ${user.username}` : ""
      }:**

🛒 Total des commandes: **${globalStats.total_commandes}**
💰 Montant total: **${globalStats.montant_total.toFixed(2)}€**
💸 Montant moyen: **${globalStats.montant_moyen.toFixed(2)}€**

📦 Moyenne par jour: **${globalStats.moyenne_jour_commandes.toFixed(
        1
      )}** commandes
〰️ Moyenne par jour: **${globalStats.moyenne_jour_montant.toFixed(2)}€**

**Statistiques par période:**

📅 **Aujourd'hui:**
- Commandes: **${aujourdhui.nb_commandes}**
- Montant: **${aujourdhui.montant_total.toFixed(2)}€**

🗓️ **Hier:**
- Commandes: **${hier.nb_commandes}**
- Montant: **${hier.montant_total.toFixed(2)}€**

📆 **7 derniers jours:**
- Commandes: **${sept_jours.nb_commandes}**
- Montant: **${sept_jours.montant_total.toFixed(2)}€**
- Moyenne par jour: **${(sept_jours.nb_commandes / 7).toFixed(1)}** commandes
- Moyenne par jour: **${(sept_jours.montant_total / 7).toFixed(2)}€**

📆 **30 derniers jours:**
- Commandes: **${trente_jours.nb_commandes}**
- Montant: **${trente_jours.montant_total.toFixed(2)}€**
- Moyenne par jour: **${(trente_jours.nb_commandes / 30).toFixed(1)}** commandes
- Moyenne par jour: **${(trente_jours.montant_total / 30).toFixed(2)}€**

[Graphique des commandes par heure](${graphiqueHeures})
[Graphique des commandes par jour de la semaine](${graphiqueJours})`;

      // Envoyer la réponse
      await interaction.reply({
        content: message,
        ephemeral: true,
      });
    } catch (error) {
      console.error("Erreur lors de la récupération des statistiques:", error);
      await interaction.reply({
        content:
          "Une erreur est survenue lors de la récupération des statistiques.",
        ephemeral: true,
      });
    }
  },
};
