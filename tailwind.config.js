import { heroui } from "@heroui/react";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Custom Dark Palette (Mapping Slate to a cleaner, darker Zinc-like scale)
        slate: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a', // Card bg
          850: '#202023', // Intermediate
          900: '#18181b', // Navbar / Lighter bg
          950: '#09090b', // Main bg (Zinc 950)
        },
        // Mapping Indigo to a vibrant Blue to match the "Image" look
        indigo: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb', // Primary Blue
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        }
      }
    },
  },
  plugins: [heroui({
    themes: {
      dark: {
        colors: {
          background: "#050505", // Deep black for global bg
          foreground: "#ECEDEE",
          primary: {
            DEFAULT: "#3870e7ff", // Blue 600
            foreground: "#FFFFFF",
          },
          secondary: {
            DEFAULT: "#71717a",
            foreground: "#FFFFFF",
          },
          content1: "#18181b", // Zinc 900 (Cards)
          content2: "#27272a", // Zinc 800
          content3: "#3f3f46",
          content4: "#52525b",
          focus: "#3b82f6",
        }
      }
    }
  })],
}
