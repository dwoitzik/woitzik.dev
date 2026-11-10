import defaultTheme from "tailwindcss/defaultTheme";
import colors from "tailwindcss/colors";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      // One accent and one grey scale for the whole site. Components were
      // written against `sky` and `neutral`; remapping those two names here
      // moves every existing link, hover, border and card onto the same
      // palette without touching each component.
      colors: {
        sky: colors.teal,
        neutral: colors.zinc,
        stone: colors.zinc,
      },
      fontFamily: {
        sans: ["Inter", ...defaultTheme.fontFamily.sans],
        mono: ["JetBrains Mono", ...defaultTheme.fontFamily.mono],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
