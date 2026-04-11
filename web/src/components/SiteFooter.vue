<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { loadFooterConfig } from '@/controllers/publicController'

const footerText = ref('')
const footerExtraHtml = ref('')

onMounted(async () => {
  try {
    const footer = await loadFooterConfig()
    footerText.value = footer.text
    footerExtraHtml.value = footer.extraHtml
  } catch {
    footerText.value = 'Powered by Cashew Blog. Copyright Cubevlmu 2026.'
    footerExtraHtml.value = ''
  }
})
</script>

<template>
  <footer class="site-footer">
    <div class="container site-footer__inner">
      <p>{{ footerText }}</p>
      <div v-if="footerExtraHtml.trim()" v-html="footerExtraHtml" />
    </div>
  </footer>
</template>
