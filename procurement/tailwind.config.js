/** @type {import('tailwindcss').Config} */
// Workforce Group brand: navy #003170, blue #4087C7 (logo dot), sky #5FBBFF, ink #13120F (wordmark).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        navy: { 950: '#001a3d', 900: '#002454', 800: '#003170', 700: '#0b4387' },
        brand: { 50: '#eef5fc', 100: '#d6e7f7', 300: '#5FBBFF', 400: '#5aa0dc', 500: '#4087C7', 600: '#336fa6', 700: '#285884' },
        ink: { 900: '#13120F', 800: '#1d2026', 700: '#2a2e36', 500: '#5b6270', 300: '#a3aab8', 100: '#f2f5f9' },
      },
    },
  },
  plugins: [],
};
