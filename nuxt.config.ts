export default defineNuxtConfig({
  compatibilityDate: '2026-07-11',
  devtools: { enabled: true },
  app: {
    head: {
      title: 'The James Brown Breakbeat Generator',
      meta: [
        { name: 'description', content: 'HIT ME! A one-page homage to the Godfather of Soul.' }
      ]
    }
  },
  css: ['~/assets/css/main.css']
})
