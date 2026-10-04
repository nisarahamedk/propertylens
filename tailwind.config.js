import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './App.tsx', './{components,views,lib}/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F5F1EB',
        olive: '#3D4A3C',
        terracotta: '#C67B5C',
        sage: '#8B9A82',
        clay: '#D4C4B5',
        sand: '#E8E0D5',
        charcoal: '#1A261B', // Darkened slightly for better contrast
        warmWhite: '#FDFCFA',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"Work Sans"', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s infinite linear',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        }
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(61, 74, 60, 0.08)',
        'neobrutal': '4px 4px 0 0 #1A261B',
        'neobrutal-sm': '2px 2px 0 0 #1A261B',
        'neobrutal-lg': '8px 8px 0 0 #1A261B',
        'neobrutal-hover': '6px 6px 0 0 #C67B5C',
      }
    }
  },
  plugins: [typography],
};
