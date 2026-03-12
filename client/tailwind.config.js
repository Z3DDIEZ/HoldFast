/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'cursive'],
      },
      colors: {
        hud: {
          bg: '#0f0f0f',
          border: '#2a2a2a',
          text: '#e8e8d0',
          'text-secondary': '#888870',
          'text-dim': '#555550',
        },
        accent: {
          food: '#c8a020',
          wood: '#4a8f3f',
          stone: '#909090',
          knowledge: '#6a60c0',
        },
        save: {
          synced: '#4aaf4a',
          pending: '#c8a020',
          error: '#c04040',
        },
      },
    },
  },
  plugins: [],
}
