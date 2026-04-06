import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#f4efe7",
        ink: "#122620",
        accent: "#137c63",
        coral: "#e88d67",
        sand: "#e7d9c7",
        panel: "#fffaf4"
      },
      fontFamily: {
        sans: ["var(--font-space-grotesk)"],
        display: ["var(--font-cormorant)"]
      },
      boxShadow: {
        card: "0 20px 60px rgba(18, 38, 32, 0.08)"
      },
      backgroundImage: {
        grain:
          "radial-gradient(circle at 20% 20%, rgba(19, 124, 99, 0.12), transparent 25%), radial-gradient(circle at 80% 0%, rgba(232, 141, 103, 0.18), transparent 25%), linear-gradient(135deg, #f6f1e7 0%, #f1e3ce 100%)"
      }
    }
  },
  plugins: []
};

export default config;
