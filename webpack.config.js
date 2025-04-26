const Dotenv = require("dotenv-webpack");
const path = require("path");

module.exports = {
  entry: {
    background: "./src/background.js",
    sidebar: "./src/sidebar.js",
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
  },
  plugins: [
    new Dotenv({
      systemvars: true, // Falls Sie Systemvariablen nutzen wollen
      safe: true, // Prüft .env.example falls vorhanden
    }),
  ],
  mode: "production",
};
