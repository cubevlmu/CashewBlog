import assert from "node:assert/strict";
import test from "node:test";
import { buildLinearWavePath } from "../src/utils/wavy-progress.ts";

test("buildLinearWavePath() with default startX starts at 0", () => {
	const path = buildLinearWavePath(120, 40, 10, 4, 1);
	assert.ok(path.startsWith("M 0 5"));
	// Should contain periodic Q segments
	assert.ok(path.includes("Q 10 11, 20 5"));
	assert.ok(path.includes("Q 30 -1, 40 5"));
});

test("buildLinearWavePath() with negative startX starts at startX and passes smoothly through x=0", () => {
	const wavelength = 40;
	const pathWithMargin = buildLinearWavePath(
		120,
		wavelength,
		10,
		4,
		1,
		-wavelength,
	);

	// Starts at negative wavelength
	assert.ok(pathWithMargin.startsWith("M -40 5"));

	// Traverses through x=0 with correct phase and height (height / 2 = 5)
	assert.ok(pathWithMargin.includes("Q -10 -1, 0 5"));

	// Beyond x=0, the curve segments strictly match the canonical path segments
	const canonicalPath = buildLinearWavePath(120, wavelength, 10, 4, 1, 0);
	const canonicalSegments = canonicalPath.split("M 0 5 ")[1];
	assert.ok(
		pathWithMargin.includes(`0 5 ${canonicalSegments}`),
		"Segments for x >= 0 must match the canonical 0-origin wave path",
	);
});

test("buildLinearWavePath() respects zero amplitude (flat line)", () => {
	const flat = buildLinearWavePath(80, 40, 10, 4, 0, -40);
	assert.ok(flat.startsWith("M -40 5"));
	// control point Y and anchor Y should all be at height/2 = 5
	assert.ok(flat.includes("Q -30 5, -20 5"));
	assert.ok(flat.includes("Q -10 5, 0 5"));
	assert.ok(flat.includes("Q 10 5, 20 5"));
});
