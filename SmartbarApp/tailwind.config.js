/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1E40AF",
        secondary: "#14B8A6",
        accent: "#F59E0B",
        dark: "#0F172A",
        muted: "#9CA3AF",
      },
    },
  },
  plugins: [],
};