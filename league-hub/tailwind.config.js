/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ice: "#F3F6FA",
        "ice-panel": "#E6ECF3",
        "ice-line": "#CBD6E2",
        rink: {
          DEFAULT: "#123A61",
          bright: "#2B6CB5",
          deep: "#0C2740",
        },
        center: {
          red: "#C41E3A",
          "red-dim": "#8F1729",
        },
        board: "#14181D",
        muted: "#5B6672",
        gold: "#D9A441",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      maxWidth: {
        content: "72rem",
      },
    },
  },
  plugins: [],
};
