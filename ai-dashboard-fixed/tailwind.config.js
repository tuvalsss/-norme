/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          100: '#f5f5f5',
          200: '#e0e0e0',
          300: '#cccccc',
          400: '#aaaaaa',
          500: '#999999',
          600: '#777777',
          700: '#555555',
          800: '#333333',
          900: '#111111',
        },
        secondary: {
          100: '#e5e5e5',
          200: '#d0d0d0',
          300: '#bcbcbc',
          400: '#9a9a9a',
          500: '#898989',
          600: '#676767',
          700: '#454545',
          800: '#232323',
          900: '#010101',
        },
        dark: {
          DEFAULT: '#111111',
          50: '#0a0a0a',
          100: '#0f0f0f',
          200: '#1a1a1a',
          300: '#242424',
          400: '#2c2c2c',
          500: '#333333',
          600: '#444444',
          700: '#555555',
          800: '#666666',
          900: '#777777',
        },
        light: {
          DEFAULT: '#e0e0e0',
          50: '#ffffff',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#c4c4c4',
          500: '#b3b3b3',
          600: '#a3a3a3',
          700: '#939393',
          800: '#828282',
          900: '#707070',
        },
        blue: {
          500: '#999999',
          600: '#777777',
          700: '#555555',
          800: '#333333',
          900: '#111111',
        },
        red: {
          500: '#b3b3b3',
          600: '#999999',
          700: '#777777',
          800: '#555555',
          900: '#333333',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fadeIn': 'fadeIn 0.5s ease forwards',
      },
      borderWidth: {
        '1': '1px',
      },
      boxShadow: {
        'inner-light': 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.05)',
        'elegant': '0 4px 20px rgba(0, 0, 0, 0.25)',
        'subtle': '0 2px 6px rgba(0, 0, 0, 0.1)',
        'glow': '0 0 15px rgba(255, 255, 255, 0.1)',
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      const newUtilities = {
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          '&::-webkit-scrollbar': {
            width: '4px',
            height: '4px',
          }
        },
        '.scrollbar-thumb-gray-600::-webkit-scrollbar-thumb': {
          'background': '#4b5563',
          'border-radius': '9999px',
        },
        '.scrollbar-track-gray-900::-webkit-scrollbar-track': {
          'background': '#111827',
          'border-radius': '9999px',
        },
        '.custom-scrollbar': {
          'scrollbar-width': 'thin',
          'scrollbar-color': '#444444 #1a1a1a',
          '&::-webkit-scrollbar': {
            width: '5px',
            height: '5px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#1a1a1a',
            borderRadius: '10px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#444444',
            borderRadius: '10px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#555555',
          },
        },
      }
      addUtilities(newUtilities);
    }
  ],
} 