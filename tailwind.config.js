/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        'artemis': '2rem 0.5rem 2rem 0.5rem',
      }
    }
  },
  plugins: []
};
