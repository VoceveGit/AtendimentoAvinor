/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        avinor: {
          DEFAULT: "#C83818",
          50: "#FDF3F0",
          100: "#FADFD7",
          500: "#C83818",
          600: "#B33114",
          700: "#8F2710",
        },
        solar: "#E67E22",
        night: "#0F172A",
        paper: "#F8FAFC",
      },
      fontFamily: {
        sans: ['"Nunito"', "system-ui", "sans-serif"],
        display: ['"Nunito"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 10px 30px -18px rgba(15, 23, 42, 0.25)",
        lift: "0 18px 40px -16px rgba(200, 56, 24, 0.28)",
      },
    },
  },
  plugins: [],
};
