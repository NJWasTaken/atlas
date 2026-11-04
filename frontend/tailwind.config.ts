import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        atlas: {
          bg: "#08111F",
          panel: "#111F31",
          line: "rgba(200, 170, 114, 0.19)",
          muted: "#9BA9B9",
          gold: "#C8AA72",
          text: "#F2ECDF",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "Avenir Next", "Avenir", "Segoe UI", "sans-serif"],
        display: ["Cormorant Garamond", "Iowan Old Style", "Palatino Linotype", "Georgia", "serif"],
      },
      boxShadow: {
        "atlas-soft": "0 18px 60px rgba(0, 0, 0, 0.22)",
        "atlas-gold": "0 0 32px rgba(200, 170, 114, 0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
