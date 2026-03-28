import { heroui } from '@heroui/react';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './components/**/*.{js,ts,jsx,tsx}',
    './views/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './App.tsx',
    './index.tsx',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        shimmerSmooth: 'shimmerSmooth 6s ease-in-out infinite',
        fadeIn: 'fadeIn 0.3s ease-out',
        slideIn: 'slideIn 0.3s ease-out',
        pulseSoft: 'pulseSoft 2s ease-in-out infinite',
        scaleIn: 'scaleIn 0.2s ease-out',
        scaleOut: 'scaleOut 0.2s ease-in',
      },
      keyframes: {
        shimmerSmooth: {
          '0%': { transform: 'translateX(-150%) skewX(-12deg)', opacity: '0' },
          '10%': { opacity: '1' },
          '45%': { transform: 'translateX(150%) skewX(-12deg)', opacity: '1' },
          '55%': { transform: 'translateX(150%) skewX(-12deg)', opacity: '0' },
          '100%': { transform: 'translateX(150%) skewX(-12deg)', opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scaleOut: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.95)', opacity: '0' },
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
        // Primary brand color - vibrant blue (keep for backward compatibility)
        primary: {
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
        },
        // Secondary brand color - orange accent (keep for backward compatibility)
        secondary: {
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
        },
        // NEW: Lime accent color (from reference design)
        lime: {
          50: '#f7fee7',
          100: '#ecfccb',
          200: '#d9f99d',
          300: '#bef264',
          400: '#a3e635',
          500: '#84cc16',
          600: '#65a30d',
          700: '#4d7c0f',
          800: '#3f6212',
          900: '#365314',
          950: '#1a2e05',
        },
        // Utility colors for better contrast in dark mode
        utility: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
      },
      spacing: {
        18: '4.5rem',
        88: '22rem',
        128: '32rem',
      },
      borderRadius: {
        '2xl': '1.5rem',
        '3xl': '1.875rem',
      },
      boxShadow: {
        soft: '0 2px 15px 0 rgba(0, 0, 0, 0.05)',
        hover: '0 8px 30px 0 rgba(0, 0, 0, 0.12)',
        primary: '0 4px 20px 0 rgba(37, 99, 235, 0.3)',
      },
      transitionProperty: {
        height: 'height',
        spacing: 'margin, padding',
      },
    },
  },
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            background: '#ffffff',
            foreground: '#1f2937',
            primary: {
              50: '#f7fee7',
              100: '#ecfccb',
              200: '#d9f99d',
              300: '#bef264',
              400: '#a3e635',
              500: '#84cc16',
              600: '#65a30d',
              700: '#4d7c0f',
              800: '#3f6212',
              900: '#365314',
              950: '#1a2e05',
              DEFAULT: '#84cc16',
              foreground: '#000000',
            },
            secondary: {
              50: '#eff6ff',
              100: '#dbeafe',
              200: '#bfdbfe',
              300: '#93c5fd',
              400: '#60a5fa',
              500: '#3b82f6',
              600: '#2563eb',
              700: '#1d4ed8',
              800: '#1e40af',
              900: '#1e3a8a',
              950: '#172554',
              DEFAULT: '#2563eb',
              foreground: '#FFFFFF',
            },
            content1: '#f9fafb',
            content2: '#f3f4f6',
            content3: '#e5e7eb',
            content4: '#d1d5db',
            focus: '#84cc16',
          },
        },
        dark: {
          colors: {
            background: '#09090b',
            foreground: '#F8FAFC',
            primary: {
              50: '#f7fee7',
              100: '#ecfccb',
              200: '#d9f99d',
              300: '#bef264',
              400: '#a3e635',
              500: '#84cc16',
              600: '#65a30d',
              700: '#4d7c0f',
              800: '#3f6212',
              900: '#365314',
              950: '#1a2e05',
              DEFAULT: '#84cc16',
              foreground: '#000000',
            },
            secondary: {
              50: '#eff6ff',
              100: '#dbeafe',
              200: '#bfdbfe',
              300: '#93c5fd',
              400: '#60a5fa',
              500: '#3b82f6',
              600: '#2563eb',
              700: '#1d4ed8',
              800: '#1e40af',
              900: '#1e3a8a',
              950: '#172554',
              DEFAULT: '#2563eb',
              foreground: '#FFFFFF',
            },
            content1: '#18181b',
            content2: '#27272a',
            content3: '#3f3f46',
            content4: '#52525b',
            focus: '#84cc16',
          },
        },
      },
    }),
  ],
};
