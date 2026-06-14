/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6A68DF',
        accent: '#EFB995',
        charcoal: '#2E2C2D',
        'card-light': '#FEFEFE',
        'bg-light': '#F4F5F7',
        'text-secondary': '#77777A',
        'text-muted': '#9A9AA0',
        'card-dark': '#1E1E22',
        'bg-dark': '#141416',
        'elevated-dark': '#26262B',
      },
      borderRadius: {
        'xl': '20px',
        '2xl': '24px',
        '3xl': '32px',
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 24px rgba(106, 104, 223, 0.08)',
        'card': '0 2px 16px rgba(46, 44, 45, 0.06)',
        'card-dark': '0 2px 16px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
};
