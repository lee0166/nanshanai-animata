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
      animation: {
        shimmerSmooth: 'shimmerSmooth 6s infinite',
      },
      keyframes: {
        shimmerSmooth: {
          '0%': { transform: 'translateX(-150%) skewX(-12deg)', opacity: '0' },
          '10%': { opacity: '1' },
          '45%': { transform: 'translateX(150%) skewX(-12deg)', opacity: '1' },
          '55%': { transform: 'translateX(150%) skewX(-12deg)', opacity: '0' },
          '100%': { transform: 'translateX(150%) skewX(-12deg)', opacity: '0' },
        },
      },
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
      light: {
        colors: {
          background: "#ffffff",
          foreground: "#1f2937",
          primary: {
            50: '#fff7ed',
            100: '#ffedd5',
            200: '#fed7aa',
            300: '#fdba74',
            400: '#fb923c',
            500: '#f97316',
            600: '#ea580c',
            700: '#c2410c',
            800: '#9a3412',
            900: '#7c2d12',
            DEFAULT: "#ea580c",
            foreground: "#FFFFFF",
          },
          secondary: {
            DEFAULT: "#71717a",
            foreground: "#FFFFFF",
          },
          content1: "#f9fafb",
          content2: "#f3f4f6",
          content3: "#e5e7eb",
          content4: "#d1d5db",
          focus: "#f97316",
        }
      },
      dark: {
        colors: {
          background: "#050505",
          foreground: "#ECEDEE",
          primary: {
            50: '#fff7ed',
            100: '#ffedd5',
            200: '#fed7aa',
            300: '#fdba74',
            400: '#fb923c',
            500: '#f97316',
            600: '#ea580c',
            700: '#c2410c',
            800: '#9a3412',
            900: '#7c2d12',
            DEFAULT: "#ea580c",
            foreground: "#FFFFFF",
          },
          secondary: {
            DEFAULT: "#71717a",
            foreground: "#FFFFFF",
          },
          content1: "#18181b",
          content2: "#27272a",
          content3: "#3f3f46",
          content4: "#52525b",
          focus: "#f97316",
        }
      }
    }
  })],
}
