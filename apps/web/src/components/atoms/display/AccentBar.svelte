<script lang="ts">
/**
 * M3E AccentBar — 标题左侧竖线装饰原子。
 * 原始站点设计：4px 圆角竖线（primary），置于标题左侧作强调。
 * 纯装饰（aria-hidden），尺寸 small/medium/large，颜色 / 圆角可用 token 覆盖。
 * 定位由调用方负责（absolute / flex 首项均可）。
 */
let {
	/** 高度：small 16 / medium 20 / large 24 */
	size = "medium",
	/** 覆盖颜色（token 或色值），默认 var(--primary) */
	color = "",
	/** 覆盖圆角（默认 6px） */
	radius = "",
	class: className = "",
}: {
	size?: "small" | "medium" | "large";
	color?: string;
	radius?: string;
	class?: string;
} = $props();

const style = [
	color ? `--m3e-accent-bar-color: ${color}` : "",
	radius ? `--m3e-accent-bar-radius: ${radius}` : "",
]
	.filter(Boolean)
	.join(";");
</script>

<span
	class="m3-accent-bar m3-accent-bar--{size} {className}"
	style={style || undefined}
	aria-hidden="true"
></span>

<style lang="stylus">
.m3-accent-bar
	display: inline-block
	flex-shrink: 0
	width: 0.25rem
	height: 1.25rem
	border-radius: var(--m3e-accent-bar-radius, 0.375rem)
	background: var(--m3e-accent-bar-color, var(--primary))
	vertical-align: middle

	&--small
		height: 1rem

	&--large
		height: 1.5rem
</style>
