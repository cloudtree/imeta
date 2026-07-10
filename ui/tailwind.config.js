/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        apple: {
          nav: '#333333',
          muted: '#AEAEAE',
          hover: '#ccc9c9',
          bg: '#FBFBFD',
          footer: '#F5F5F7',
          link: '#06c',
          text: '#1d1d1f',
          light: '#f5f5f7',
        },
        brand: {
          50: '#E8F2FC',
          100: '#C7E0F9',
          200: '#8FC3F3',
          300: '#57A5ED',
          400: '#2997FF',
          500: '#0066CC',
          600: '#0077ED',
          700: '#0066CC',
          800: '#004F9E',
          900: '#003366',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Noto Sans KR',
          'Helvetica Neue',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
    },
    screens: {
      sm: '110px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
}
