<script setup lang="ts">
withDefaults(defineProps<{
  src?: string
  alt?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  shape?: 'circle' | 'rounded'
}>(), {
  src: '/placeholder-avatar.svg',
  alt: '用户头像',
  size: 'md',
  shape: 'circle',
})
</script>

<template>
  <img
    :class="['user-avatar', `user-avatar--${size}`, `user-avatar--${shape}`]"
    :src="src || '/placeholder-avatar.svg'"
    :alt="alt"
  />
</template>
