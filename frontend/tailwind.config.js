/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          200: '#b7d8ff',
          300: '#8abfff',
          400: '#569dff',
          500: '#2d7dff',
          600: '#155fe0',
          700: '#114ab6',
          800: '#103f92',
          900: '#113676'
        }
      },
      boxShadow: {
        soft: '0 20px 50px rgba(15, 23, 42, 0.08)'
      }
    }
  },
  plugins: []
};
