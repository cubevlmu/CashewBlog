<script setup lang="ts">
import type { AdminConfigLink } from '@/types/admin'

const model = defineModel<AdminConfigLink[]>({ required: true })

defineProps<{
  title: string
  label: string
  addText: string
  namePlaceholder: string
  linkPlaceholder: string
  iconPlaceholder?: string
  hint?: string
  showIcon?: boolean
}>()

function addLink(showIcon: boolean) {
  model.value.push(showIcon ? { text: '', link: '', icon: '' } : { text: '', link: '' })
}

function removeLink(index: number) {
  model.value.splice(index, 1)
}
</script>

<template>
  <div class="admin-profile-editor__section admin-home-config-editor__section">
    <div class="admin-config-links__header">
      <div>
        <p class="panel__label">{{ label }}</p>
        <h3>{{ title }}</h3>
      </div>
      <button class="button button--ghost" type="button" @click="addLink(Boolean(showIcon))">{{ addText }}</button>
    </div>
    <div class="admin-config-links">
      <div
        v-for="(link, index) in model"
        :key="`${label}-${index}`"
        :class="showIcon ? 'admin-config-links__row' : 'admin-home-config-editor__link-row'"
      >
        <input v-model="link.text" class="admin-input" type="text" :placeholder="namePlaceholder" />
        <input v-if="showIcon" v-model="link.icon" class="admin-input" type="text" :placeholder="iconPlaceholder" />
        <input v-model="link.link" class="admin-input" type="text" :placeholder="linkPlaceholder" />
        <button class="button button--ghost" type="button" @click="removeLink(index)">删除</button>
      </div>
    </div>
    <p v-if="hint" class="panel__text">{{ hint }}</p>
  </div>
</template>
