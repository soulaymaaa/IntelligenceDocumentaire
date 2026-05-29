/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/providers/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
    './src/types/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand (cyan-teal palette)
        brand: {
          50:  '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          650: '#07809d',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          950: '#083243',
        },
        // Slate extended shades (missing from default)
        slate: {
          350: '#b2c0cc',
          450: '#73838f',
          550: '#52616e',
          650: '#3c4852',
          750: '#2a343d',
          850: '#16191e',
          925: '#0c1117',
          950: '#07090e',
        },
        // Semantic surface tokens (using CSS variables)
        surface: {
          DEFAULT: 'rgb(var(--bg-base) / <alpha-value>)',
          50:  'rgb(var(--text-main) / 0.02)',
          100: 'rgb(var(--text-main) / 0.04)',
          150: 'rgb(var(--text-main) / 0.05)',
          200: 'rgb(var(--border-base) / <alpha-value>)',
          300: 'rgb(var(--border-base) / 0.8)',
          400: 'rgb(var(--border-muted) / <alpha-value>)',
          500: 'rgb(var(--text-main) / 0.08)',
        },
        // Card surface tokens
        card: {
          DEFAULT: 'rgb(var(--bg-card) / <alpha-value>)',
          hover:   'rgb(var(--bg-card-hover) / <alpha-value>)',
        },
        // Emerald / violet / indigo extended shades used in portal
        emerald: {
          650: '#059669',
        },
        violet: {
          650: '#7c3aed',
        },
        indigo: {
          650: '#4338ca',
        },
        red: {
          650: '#dc2626',
        },
        amber: {
          350: '#fcd34d',
        },
      },

      backgroundImage: {
        'brand-gradient':
          'linear-gradient(135deg, #0f766e 0%, #0891b2 52%, #22c55e 100%)',
        'brand-radial':
          'radial-gradient(ellipse at 50% 0%, rgba(6,182,212,0.2) 0%, transparent 60%)',
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },

      animation: {
        'fade-in':    'fadeIn 0.25s ease-out',
        'slide-up':   'slideUp 0.28s cubic-bezier(0.16,1,0.3,1)',
        'slide-down': 'slideDown 0.28s cubic-bezier(0.16,1,0.3,1)',
        'spin-slow':  'spin 3s linear infinite',
      },

      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0)   scale(1)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },

      boxShadow: {
        card:           '0 2px 12px -2px rgba(6,78,59,0.08), 0 4px 10px -3px rgba(8,145,178,0.05)',
        'card-hover':   '0 14px 28px -8px rgba(8,145,178,0.16), 0 10px 16px -8px rgba(15,118,110,0.08)',
        'brand-sm':     '0 2px 12px -2px rgba(8,145,178,0.25)',
        'brand-md':     '0 8px 24px -6px rgba(8,145,178,0.3)',
      },

      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
