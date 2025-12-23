/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    fontFamily: {
      sans: [
        "Noto Sans JP",
        "system-ui",
        "-apple-system",
        "BlinkMacSystemFont",
        '"Segoe UI"',
        "Roboto",
        '"Hiragino Kaku Gothic ProN"',
        '"Hiragino Sans"',
        '"Noto Sans"',
        '"Yu Gothic"',
        "Meiryo",
        "sans-serif",
      ],
    },
    extend: {},
  },
  plugins: [],
};
