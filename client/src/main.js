import { createApp } from 'vue'
import '@fontsource/plus-jakarta-sans/300.css'
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'
import './style.css'
import App from './App.vue'
import VueLazyload from 'vue3-lazyload'
import router from './router/index'

import { createPinia } from 'pinia'
const pinia = createPinia()

createApp(App)
  .use(pinia)
  .use(VueLazyload, {
    loading: '/loading.svg',
    error: '/loading.svg',
    observerOptions: {
      rootMargin: '200px',
      threshold: 0.1,
    },
  })
  .use(router)
  .mount('#app')
