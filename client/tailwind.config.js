/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f0ff",
          100: "#e6e1ff",
          300: "#b8a8ff",
          500: "#6c4cff", // primary Chatly purple — original, not IG blue
          600: "#5a3ce0",
          700: "#4930b3",
          900: "#241862",
        },
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
