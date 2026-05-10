<script setup lang="ts">
defineProps<{
  emoji: string
  title: string
  tips: string
}>()
</script>

<template>
  <section class="notice-view" role="status" aria-live="polite">
    <div class="notice-view__inner">
      <div class="notice-view__emoji" aria-hidden="true">{{ emoji }}</div>
      <h1 class="notice-view__title">{{ title }}</h1>
      <p class="notice-view__tips">{{ tips }}</p>
      <div v-if="$slots.default" class="notice-view__actions">
        <slot />
      </div>
    </div>
  </section>
</template>

<style scoped>
.notice-view {
  display: flex;
  min-height: min(520px, 100vh);
  align-items: center;
  justify-content: center;
  padding: 48px 32px;
  text-align: center;
}

.notice-view__inner {
  max-width: 520px;
}

.notice-view__emoji {
  font-size: 64px;
  line-height: 1;
}

.notice-view__title {
  margin: 16px 0 0;
  color: var(--heading);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.35;
}

.notice-view__tips {
  margin: 8px 0 0;
  color: var(--text-soft);
  font-size: 15px;
  line-height: 1.7;
}

.notice-view__actions {
  display: flex;
  justify-content: center;
  margin-top: 18px;
}
</style>
