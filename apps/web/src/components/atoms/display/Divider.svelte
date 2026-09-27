<script lang="ts">
/**
 * M3E Divider — M3 分隔线原子（移植自 Compose Material3 Divider）。
 * 默认 1px 水平线（outline-variant）；vertical 为竖线。
 * 用法：<Divider />                    <Divider vertical />
 *      <Divider thickness="2px" color="var(--outline)" />
 */
let {
	vertical = false,
	thickness = "1px",
	color = "var(--outline-variant)",
}: {
	vertical?: boolean;
	thickness?: string;
	color?: string;
} = $props();
</script>

<hr
    class="m3-divider"
    class:m3-divider--vertical={vertical}
    style={`--divider-thickness: ${thickness}; --divider-color: ${color}`}
    aria-hidden="true"
/>

<style lang="stylus">
.m3-divider
    border: none
    height: var(--divider-thickness, 1px)
    background: var(--divider-color, var(--outline-variant))
    margin: 0

    &--vertical
        height: auto
        width: var(--divider-thickness, 1px)
        align-self: stretch
</style>
