import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#241a14",
          900: "#33261d",
          800: "#4a382c",
          700: "#5c4a3c",
        },
        line: {
          DEFAULT: "rgba(64,42,30,0.10)",
          bright: "rgba(64,42,30,0.18)",
        },
        brand: {
          50: "#faf4ec",
          100: "#f1e4d6",
          200: "#e2cdb8",
          300: "#cfb096",
          400: "#b78f6e",
          500: "#9c7350",
          600: "#83593b",
          700: "#6b452e",
          800: "#553726",
          900: "#402a1e",
        },
        cream: {
          DEFAULT: "#fdfbf7",
          dim: "#f8f3eb",
        },
      },
      fontFamily: {
        sans: ["var(--font-host)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(64,42,30,0.04), 0 24px 60px -24px rgba(64,42,30,0.12)",
        glow: "0 4px 20px rgba(107,69,46,0.30)",
        "card-lg": "0 2px 4px rgba(64,42,30,0.05), 0 40px 90px -40px rgba(64,42,30,0.18)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(rgba(64,42,30,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(64,42,30,0.035) 1px, transparent 1px)",
        "radial-glow":
          "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(107,69,46,0.07), transparent 70%)",
        hatch:
          "repeating-linear-gradient(45deg, rgba(64,42,30,0.05) 0 1px, transparent 1px 8px)",
        "hatch-dark":
          "repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 8px)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "blur-in": {
          "0%": { opacity: "0", filter: "blur(12px)", transform: "translateY(12px)" },
          "100%": { opacity: "1", filter: "blur(0)", transform: "translateY(0)" },
        },
        "line-draw": {
          "0%": { "stroke-dashoffset": "300" },
          "100%": { "stroke-dashoffset": "0" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 rgba(107,69,46,0.35)" },
          "50%": { opacity: "0.7", boxShadow: "0 0 0 6px rgba(107,69,46,0)" },
        },
        dash: {
          to: { "stroke-dashoffset": "-10" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        spinSlow: {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        rise: "rise 0.7s cubic-bezier(0.16,1,0.3,1) both",
        "blur-in": "blur-in 0.8s cubic-bezier(0.16,1,0.3,1) both",
        "line-draw": "line-draw 1.2s ease-out forwards",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
        "edge-anim": "dash 1.2s linear infinite",
        shimmer: "shimmer 2.5s linear infinite",
        float: "float 6s ease-in-out infinite",
        "spin-slow": "spinSlow 24s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
