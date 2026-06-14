/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        deep: {
          900: '#0A0E1A',
          800: '#0F1428',
          700: '#151B36',
          600: '#1C2444',
          500: '#252E52',
        },
        cyber: {
          blue: '#00D4FF',
          purple: '#7B61FF',
          green: '#00E5A0',
          orange: '#FF6B35',
          red: '#FF2D55',
          white: '#E8EDF5',
          dim: '#6B7394',
        },
      },
      fontFamily: {
        orbitron: ['Orbitron', 'monospace'],
        noto: ['Noto Sans SC', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.5s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0, 212, 255, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 212, 255, 0.6)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
