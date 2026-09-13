/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0508",         // near-black background
        paper: "#F3ECE4",       // warm cream text
        muted: "#A99089",       // muted warm gray
        panel: "#160B0F",       // maroon-black card surface
        line: "rgba(201,162,39,0.18)",  // gold-tinted hairline border
        primary: "#7A1330",     // deep maroon — primary accent
        primaryDim: "#3E0A18",
        gold: "#C9A227",        // premium accent
        mint: "#3FA66B",
        amber: "#D99A2B",
        red: "#C8412F"
      },
      fontFamily: {
        display: ["'Playfair Display'", "serif"],
        sans: ["'Space Grotesk'", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
