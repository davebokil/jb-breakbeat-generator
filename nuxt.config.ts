const siteUrl = 'https://breaks.davebokil.com/'
const siteName = 'The Godfather of Soul Breakbeat Generator'
const siteDescription = 'Spin, scratch, and squash classic Godfather of Soul breakbeats right in your browser. A free interactive drum break sampler with reverb, glue compression, tape saturation, and pitch/scratch control - no download, no signup.'
const ogImageUrl = 'https://breaks.davebokil.com/og-image.jpg'

export default defineNuxtConfig({
  compatibilityDate: '2026-07-11',
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: `${siteName} - Funky Drummer Break Sampler & Scratch Turntable`,
      link: [
        { rel: 'canonical', href: siteUrl },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ],
      meta: [
        { name: 'description', content: siteDescription },
        { name: 'keywords', content: 'breakbeat generator, Godfather of Soul breaks, funky drummer, drum break sampler, hip hop breakbeats, DJ scratch simulator, online turntable, drum loop tape saturation, glue compression' },
        { name: 'robots', content: 'index, follow' },
        { name: 'theme-color', content: '#1a1a1a' },

        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: siteUrl },
        { property: 'og:site_name', content: siteName },
        { property: 'og:title', content: `${siteName} - Funky Drummer Break Sampler & Scratch Turntable` },
        { property: 'og:description', content: siteDescription },
        { property: 'og:image', content: ogImageUrl },
        { property: 'og:image:type', content: 'image/jpeg' },
        { property: 'og:image:width', content: '1536' },
        { property: 'og:image:height', content: '1024' },
        { property: 'og:locale', content: 'en_US' },

        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: `${siteName} - Funky Drummer Break Sampler & Scratch Turntable` },
        { name: 'twitter:description', content: siteDescription },
        { name: 'twitter:image', content: ogImageUrl }
      ],
      script: [
        // Google tag (gtag.js)
        { src: 'https://www.googletagmanager.com/gtag/js?id=G-X5FFRMY8Y4', async: true },
        {
          innerHTML: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-X5FFRMY8Y4');`
        },
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: siteName,
            url: siteUrl,
            description: 'A free browser-based breakbeat sampler and scratch turntable, built as a fan homage to the Godfather of Soul\'s classic funk drum breaks.',
            applicationCategory: 'MultimediaApplication',
            operatingSystem: 'Any (runs in a web browser)',
            browserRequirements: 'Requires JavaScript and the Web Audio API',
            isAccessibleForFree: true,
            creator: {
              '@type': 'Person',
              name: 'Dave Bokil',
              url: 'https://davebokil.com/'
            }
          })
        }
      ]
    }
  },
  css: ['~/assets/css/main.css']
})
