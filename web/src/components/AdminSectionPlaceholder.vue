<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  description: string
  points: string[]
}>()
</script>

<template>
  <section class="admin-section">
    <header class="panel admin-section__hero">
      <div>
        <p class="panel__label">{{ eyebrow }}</p>
        <h2>{{ title }}</h2>
        <p class="panel__text">{{ description }}</p>
      </div>
    </header>

    <section class="admin-grid">
      <article v-for="point in points" :key="point" class="panel admin-card">
        <p class="panel__label">规划项</p>
        <p class="panel__text">{{ point }}</p>
      </article>
    </section>
  </section>
</template>
