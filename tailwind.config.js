/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // 이 부분이 중요합니다.
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}