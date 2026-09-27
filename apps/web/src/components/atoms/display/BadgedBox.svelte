<script lang="ts">
/**
 * M3E BadgedBox — 徽标锚定容器（移植自 Compose Material3 BadgedBox）。
 * 锚点内容放默认插槽，徽标放命名插槽，自动定位到右上角。
 * 用法：<BadgedBox><Icon … /><svelte:fragment slot="badge"><Badge content="3" /></svelte:fragment></BadgedBox>
 */
</script>

<span class="m3-badged-box">
    <slot />
    <span class="m3-badged-box__badge"><slot name="badge" /></span>
</span>

<style lang="stylus">
.m3-badged-box
    position: relative
    display: inline-flex

    &__badge
        position: absolute
        top: 0
        right: 0
        transform: translate(50%, -50%)
        display: flex
</style>
