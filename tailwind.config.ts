import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#f4efe6",
        charcoal: "#12100d",
        ink: "#0b0a08",
        gold: "#b98a4a",
        rust: "#a8532e",
        sage: "#5c6b52",
      },
      fontFamily: {
        heebo: ["var(--font-heebo)", "sans-serif"],
      },
      backgroundImage: {
        "grain": "url('/grain.png')",
      },
    },
  },
  plugins: [],
};

export default config;
