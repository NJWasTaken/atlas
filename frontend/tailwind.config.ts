import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: { colors: { atlas: { bg: "#0B0D12", panel: "#121620", line: "#252B38", muted: "#8992A4", gold: "#D9B779", text: "#F1F0EC" } } } },
  plugins: [],
};
export default config;
