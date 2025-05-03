/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1E3A8A',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#10B981',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#F59E0B',
          foreground: '#FFFFFF',
        },
        background: {
          light: '#F3F4F6',
          dark: '#1F2937',
        },
        text: {
          main: '#111827',
          muted: '#6B7280',
        },
        border: '#E5E7EB',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        lg: '12px',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        26: '6.5rem',
        30: '7.5rem',
      },
      boxShadow: {
        chat: '0 2px 8px 0 rgba(30,58,138,0.08)',
      },
    },
  },
  plugins: [
    // Loại bỏ plugin tailwindcss-animate
  ],
};
