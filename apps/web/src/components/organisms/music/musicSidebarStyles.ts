export const musicSidebarStylus = `
.music-player
	min-width: 0
	display: flex
	flex-direction: column
	gap: 0.75rem
	color: var(--on-surface)

	&__track
		display: grid
		grid-template-columns: 3.25rem minmax(0, 1fr)
		align-items: center
		gap: 0.75rem
		min-width: 0

	&__cover
		position: relative
		width: 3.25rem
		height: 3.25rem
		display: grid
		place-items: center
		border-radius: var(--shape-corner-full)
		background: var(--secondary-container)
		color: var(--on-secondary-container)
		box-shadow: 0 0 0 1.5px var(--surface-container-lowest), unquote("0 0 0 2.5px color-mix(in oklab, var(--primary) 20%, var(--outline-variant) 80%)"), unquote("0 2px 6px color-mix(in oklab, var(--on-surface) 6%, transparent)")
		transition: box-shadow var(--m3e-duration-medium) var(--m3e-easing-standard)
		animation: music-cover-playing var(--m3e-duration-ambient-extra-long) linear infinite
		animation-play-state: paused

		&::before
			content: ""
			position: absolute
			inset: -2px
			border-radius: var(--shape-corner-full)
			border: 1.5px solid var(--primary)
			opacity: 0
			pointer-events: none
			z-index: 1

		> svg
			width: 1.5rem
			height: 1.5rem

		img
			width: 100%
			height: 100%
			object-fit: cover
			border-radius: var(--shape-corner-full)

		&--playing
			animation-play-state: running
			box-shadow: 0 0 0 1.5px var(--surface-container-lowest), 0 0 0 2.5px var(--primary), unquote("0 3px 10px color-mix(in oklab, var(--primary) 22%, transparent)")

			&::before
				animation: music-cover-ripple 3.2s cubic-bezier(0.1, 0.8, 0.2, 1) infinite

			img
				animation: music-cover-bounce 3.2s ease-in-out infinite

	&__metadata
		min-width: 0
		display: flex
		flex-direction: column
		gap: 0.125rem

		strong,
		span
			overflow: hidden
			text-overflow: ellipsis
			white-space: nowrap

		strong
			font: var(--m3e-type-title-small)

		span
			font: var(--m3e-type-body-small)
			color: var(--on-surface-variant)

	&__submeta
		display: flex
		justify-content: space-between
		align-items: center
		margin-top: 0.125rem
		min-height: 1.25rem

	&__time-display
		display: inline-flex
		align-items: center
		gap: 0.25rem
		font: var(--m3e-type-label-small)
		font-variant-numeric: tabular-nums
		color: var(--on-surface-variant)

	&__time-separator
		opacity: 0.5

	&__volume-inline
		display: flex
		align-items: center
		gap: 0.25rem

		.m3-icon-button
			position: relative
			width: 1.25rem
			height: 1.25rem
			padding: 0
			color: var(--on-surface-variant)

			&::after
				content: ""
				position: absolute
				inset: -0.5rem
				z-index: 1

			&:hover
				color: var(--primary)

			&__icon
				font-size: 1rem

	&__volume-slider-wrap
		position: relative
		width: 3.25rem
		height: 1.25rem
		display: flex
		align-items: center

	&__volume-slider
		appearance: none
		-webkit-appearance: none
		width: 100%
		height: 0.25rem
		margin: 0
		padding: 0
		border: none
		border-radius: var(--shape-corner-full)
		background: linear-gradient(to right, var(--primary) 0%, var(--primary) var(--vol-pct, 70%), var(--surface-container-highest) var(--vol-pct, 70%), var(--surface-container-highest) 100%)
		cursor: pointer
		outline: none

		&::-webkit-slider-runnable-track
			appearance: none
			-webkit-appearance: none
			height: 0.25rem
			border-radius: var(--shape-corner-full)
			background: transparent
			border: none

		&::-webkit-slider-thumb
			appearance: none
			-webkit-appearance: none
			width: 0.5rem
			height: 0.5rem
			margin-top: -0.125rem
			border: none
			border-radius: var(--shape-corner-full)
			background: var(--primary)
			box-shadow: 0 0 0 1px var(--surface-container-lowest)
			transition: transform var(--m3e-duration-short) var(--m3e-easing-standard)

			&:hover
				transform: scale(1.3)

		&::-moz-range-track
			height: 0.25rem
			border-radius: var(--shape-corner-full)
			background: transparent
			border: none

		&::-moz-range-progress
			height: 0.25rem
			border-radius: var(--shape-corner-full)
			background: var(--primary)

		&::-moz-range-thumb
			width: 0.5rem
			height: 0.5rem
			border: none
			border-radius: var(--shape-corner-full)
			background: var(--primary)
			box-shadow: 0 0 0 1px var(--surface-container-lowest)
			transition: transform var(--m3e-duration-short) var(--m3e-easing-standard)

			&:hover
				transform: scale(1.3)

		&:focus-visible
			outline: 2px solid var(--primary)
			outline-offset: 2px

		&:disabled
			cursor: default
			opacity: 0.38

	&__playlist-item time
		font: var(--m3e-type-label-small)
		font-variant-numeric: tabular-nums
		color: var(--on-surface-variant)

	&__progress
		display: flex
		flex-direction: column
		gap: 0.125rem

	&__progress-control
		position: relative
		width: 100%
		height: 1.25rem
		display: flex
		align-items: center
		touch-action: pan-y

		.m3-progress
			position: relative
			z-index: 0
			width: 100%
			max-width: none
			pointer-events: none

		.m3-progress--wavy
			height: 10px
			overflow: visible

			.m3-progress__wavy-track,
			.m3-progress__wavy-active,
			.m3-progress__wavy-wave
				width: 100%

		input
			appearance: none
			-webkit-appearance: none
			position: absolute
			inset: -0.625rem 0
			z-index: 2
			width: 100%
			height: calc(100% + 1.25rem)
			margin: 0
			padding: 0
			border: none
			background: transparent !important
			opacity: 0
			cursor: pointer
			accent-color: transparent

			&::-webkit-slider-runnable-track
				appearance: none
				-webkit-appearance: none
				background: transparent !important
				border: none
				height: 100%

			&::-webkit-slider-thumb
				appearance: none
				-webkit-appearance: none
				opacity: 0
				width: 1.25rem
				height: 1.25rem
				background: transparent !important
				border: none
				box-shadow: none

			&::-moz-range-track
				background: transparent !important
				border: none
				height: 100%

			&::-moz-range-thumb
				opacity: 0
				width: 1.25rem
				height: 1.25rem
				background: transparent !important
				border: none
				box-shadow: none

			&:disabled
				cursor: default

			&:focus-visible
				outline: 2px solid var(--primary)
				outline-offset: 2px
				border-radius: var(--shape-corner-s)

	&__controls
		display: flex
		justify-content: space-between
		align-items: center
		padding: 0 0.25rem

		.m3-icon-button
			color: var(--on-surface-variant)

			&:hover:not(:disabled)
				color: var(--primary)

			&--filled
				color: var(--on-primary)

				&:hover:not(:disabled)
					color: var(--on-primary)

	&__playlist-panel
		overflow: hidden

	&__playlist
		list-style: none
		max-height: 12rem
		display: flex
		flex-direction: column
		gap: 0.125rem
		margin: 0
		padding: 0.25rem 0 0
		overflow-y: auto
		overscroll-behavior: contain
		scrollbar-width: none
		-webkit-mask-image: linear-gradient(to bottom, black calc(100% - 1.5rem), transparent 100%)
		mask-image: linear-gradient(to bottom, black calc(100% - 1.5rem), transparent 100%)

		&::-webkit-scrollbar
			display: none

	&__playlist-item
		width: 100%
		min-height: 2.75rem
		display: grid
		grid-template-columns: 1.5rem minmax(0, 1fr) auto
		align-items: center
		gap: 0.5rem
		padding: 0.375rem 0.5rem
		border: none
		border-radius: var(--shape-corner-s)
		background: transparent
		color: var(--on-surface)
		text-align: left
		cursor: pointer
		--m3e-state-color: var(--on-surface)

		&--current
			background: var(--secondary-container)
			color: var(--on-secondary-container)
			--m3e-state-color: var(--on-secondary-container)

	&__playlist-index
		display: grid
		place-items: center
		font: var(--m3e-type-label-medium)
		font-variant-numeric: tabular-nums
		text-align: center

		> svg
			width: 1.125rem
			height: 1.125rem

	&__playlist-copy
		min-width: 0
		display: flex
		flex-direction: column

		strong,
		span
			overflow: hidden
			text-overflow: ellipsis
			white-space: nowrap

		strong
			font: var(--m3e-type-body-medium)

		span
			font: var(--m3e-type-body-small)
			opacity: 0.75

	&__empty,
	&__error
		margin: 0
		padding: 0.75rem
		border-radius: var(--shape-corner-s)
		font: var(--m3e-type-body-medium)

	&__empty
		background: var(--surface-container)
		color: var(--on-surface-variant)
		text-align: center

	&__error
		background: var(--error-container)
		color: var(--on-error-container)

@media (pointer: coarse)
	.music-player
		&__volume-slider-wrap
			height: 2rem

		&__progress-control
			height: 2.5rem

			input
				inset: 0

		&__controls
			max-width: 22rem
			width: 100%
			margin: 0 auto

@keyframes music-cover-playing
	to
		transform: rotate(360deg)

@keyframes music-cover-ripple
	0%
		transform: scale(1)
		opacity: 0.65
	28%
		transform: scale(1.18)
		opacity: 0
	100%
		transform: scale(1.18)
		opacity: 0

@keyframes music-cover-bounce
	0%, 100%
		transform: scale(1)
	14%
		transform: scale(1.035)
	28%
		transform: scale(1)

html.motion-reduced .music-player__cover,
html.motion-reduced .music-player__cover::before,
html.motion-reduced .music-player__cover img
	animation: none

@media (prefers-reduced-motion: reduce)
	.music-player__cover,
	.music-player__cover::before,
	.music-player__cover img
		animation: none
`;
