import fs from "node:fs";

function parseTTF(buffer) {
	const numTables = buffer.readUInt16BE(4);
	const tables = {};

	for (let i = 0; i < numTables; i++) {
		const offset = 12 + i * 16;
		const tag = buffer.toString("ascii", offset, offset + 4);
		const tableOffset = buffer.readUInt32BE(offset + 8);
		const length = buffer.readUInt32BE(offset + 12);
		tables[tag] = { offset: tableOffset, length };
	}

	// Parse 'name' table
	const names = {};
	if (tables.name) {
		const nameOffset = tables.name.offset;
		const count = buffer.readUInt16BE(nameOffset + 2);
		const stringOffset = nameOffset + buffer.readUInt16BE(nameOffset + 4);

		for (let i = 0; i < count; i++) {
			const recordOffset = nameOffset + 6 + i * 12;
			const platformID = buffer.readUInt16BE(recordOffset);
			const encodingID = buffer.readUInt16BE(recordOffset + 2);
			const languageID = buffer.readUInt16BE(recordOffset + 4);
			const nameID = buffer.readUInt16BE(recordOffset + 6);
			const length = buffer.readUInt16BE(recordOffset + 8);
			const strOffset = buffer.readUInt16BE(recordOffset + 10);

			let val = "";
			const slice = buffer.subarray(
				stringOffset + strOffset,
				stringOffset + strOffset + length,
			);

			if (
				platformID === 0 ||
				platformID === 3 ||
				(platformID === 2 && encodingID === 1)
			) {
				// UTF-16BE
				val = slice.swap16().toString("utf16le");
			} else {
				val = slice.toString("utf8");
			}

			if (!names[nameID]) names[nameID] = [];
			names[nameID].push({ platformID, languageID, val });
		}
	}

	// Parse 'OS/2' table
	const os2 = {};
	if (tables["OS/2"]) {
		const o = tables["OS/2"].offset;
		os2.usWeightClass = buffer.readUInt16BE(o + 4);
		os2.sTypoAscender = buffer.readInt16BE(o + 68);
		os2.sTypoDescender = buffer.readInt16BE(o + 70);
		os2.sTypoLineGap = buffer.readInt16BE(o + 72);
	}

	// Parse 'cmap' table
	const unicodes = new Set();
	if (tables.cmap) {
		const cmapOffset = tables.cmap.offset;
		const numSubtables = buffer.readUInt16BE(cmapOffset + 2);

		for (let i = 0; i < numSubtables; i++) {
			const subOffset = cmapOffset + 4 + i * 8;
			const subtableOffset = cmapOffset + buffer.readUInt32BE(subOffset + 4);
			const format = buffer.readUInt16BE(subtableOffset);

			if (format === 4) {
				const segCountX2 = buffer.readUInt16BE(subtableOffset + 6);
				const segCount = segCountX2 / 2;
				const endCodeOffset = subtableOffset + 14;
				const startCodeOffset = endCodeOffset + segCountX2 + 2;
				const idDeltaOffset = startCodeOffset + segCountX2;
				const idRangeOffset = idDeltaOffset + segCountX2;

				for (let s = 0; s < segCount - 1; s++) {
					const endCode = buffer.readUInt16BE(endCodeOffset + s * 2);
					const startCode = buffer.readUInt16BE(startCodeOffset + s * 2);
					const idDelta = buffer.readInt16BE(idDeltaOffset + s * 2);
					const idRangeOff = buffer.readUInt16BE(idRangeOffset + s * 2);

					for (let c = startCode; c <= endCode; c++) {
						if (idRangeOff === 0) {
							const glyphId = (c + idDelta) & 0xffff;
							if (glyphId !== 0) unicodes.add(c);
						} else {
							const glyphOffset =
								idRangeOffset + s * 2 + idRangeOff + (c - startCode) * 2;
							if (glyphOffset < buffer.length - 2) {
								const glyphId = buffer.readUInt16BE(glyphOffset);
								if (glyphId !== 0) unicodes.add(c);
							}
						}
					}
				}
			} else if (format === 12) {
				const nGroups = buffer.readUInt32BE(subtableOffset + 12);
				for (let g = 0; g < nGroups; g++) {
					const groupOffset = subtableOffset + 16 + g * 12;
					const startCharCode = buffer.readUInt32BE(groupOffset);
					const endCharCode = buffer.readUInt32BE(groupOffset + 4);
					for (let c = startCharCode; c <= endCharCode; c++) {
						unicodes.add(c);
					}
				}
			}
		}
	}

	return {
		tables,
		names,
		os2,
		unicodes: Array.from(unicodes).sort((a, b) => a - b),
	};
}

const fontBuf = fs.readFileSync("zk.ttf");
const res = parseTTF(fontBuf);

console.log("=== NAME RECORDS ===");
const nameKeyMap = {
	0: "Copyright",
	1: "Font Family",
	2: "Font Subfamily",
	3: "Unique ID",
	4: "Full Font Name",
	5: "Version",
	6: "PostScript Name",
	7: "Trademark",
	8: "Manufacturer",
	9: "Designer",
	13: "License",
};
for (const [id, recs] of Object.entries(res.names)) {
	const label = nameKeyMap[id] || `NameID ${id}`;
	console.log(`[${label} (${id})]:`, recs.map((r) => r.val).filter(Boolean));
}

console.log("\n=== OS/2 INFO ===");
console.log("Weight Class:", res.os2.usWeightClass);
console.log(
	"Ascender / Descender:",
	res.os2.sTypoAscender,
	res.os2.sTypoDescender,
);

console.log("\n=== GLYPH / UNICODE COVERAGE ===");
console.log("Total unique mapped Unicode characters:", res.unicodes.length);

// Check specific ranges
function countInRange(start, end) {
	return res.unicodes.filter((c) => c >= start && c <= end).length;
}

const ascii = countInRange(0x0020, 0x007e);
const hiragana = countInRange(0x3040, 0x309f);
const katakana = countInRange(0x30a0, 0x30ff);
const cjkPunct = countInRange(0x3000, 0x303f) + countInRange(0xff00, 0xffef);
const cjkUnified = countInRange(0x4e00, 0x9fff);
const cjkExtA = countInRange(0x3400, 0x4dbf);
const cjkExtB = countInRange(0x20000, 0x2a6df);

console.log(
	`ASCII (0x0020-0x007E): ${ascii} / 95 (${((ascii / 95) * 100).toFixed(1)}%)`,
);
console.log(
	`Hiragana (0x3040-0x309F): ${hiragana} / 96 (${((hiragana / 96) * 100).toFixed(1)}%)`,
);
console.log(
	`Katakana (0x30A0-0x30FF): ${katakana} / 96 (${((katakana / 96) * 100).toFixed(1)}%)`,
);
console.log(`CJK Punctuation & Fullwidth: ${cjkPunct}`);
console.log(
	`CJK Unified Ideographs (0x4E00-0x9FFF): ${cjkUnified} / 20992 (${((cjkUnified / 20992) * 100).toFixed(1)}%)`,
);
console.log(`CJK Ext A: ${cjkExtA}`);
console.log(`CJK Ext B: ${cjkExtB}`);
