/** Square avatar output size (px) — small files, crisp at every render size. */
export const AVATAR_SIZE = 256
/** Max accepted source file size before processing. */
export const AVATAR_MAX_BYTES = 10 * 1024 * 1024

export interface CropRect {
	sx: number
	sy: number
	size: number
}

/** Centered square crop of a source image (cover semantics). */
export function coverCrop(width: number, height: number): CropRect {
	const size = Math.min(width, height)
	return { sx: (width - size) / 2, sy: (height - size) / 2, size }
}

export type AvatarFileCheck = { ok: true } | { ok: false; error: string }

/** Pre-flight check on the picked file, before any decoding happens. */
export function validateAvatarFile(file: { type: string; size: number }): AvatarFileCheck {
	if (!file.type.startsWith('image/')) return { ok: false, error: 'Choisis un fichier image.' }
	if (file.size > AVATAR_MAX_BYTES) return { ok: false, error: 'Image trop lourde (10 Mo max).' }
	return { ok: true }
}

/**
 * The storage path is stable per player (uploads overwrite), so the stored URL
 * carries a version to defeat browser/CDN caching when a photo is replaced.
 */
export function withCacheBuster(url: string, version: number): string {
	return `${url}?v=${version}`
}

/**
 * Decode, center-crop and downscale the picked file to a 256px WebP blob.
 * Browser-only (canvas); the pure geometry lives in coverCrop above.
 */
export async function processAvatarFile(file: File): Promise<Blob> {
	const bitmap = await createImageBitmap(file)
	const { sx, sy, size } = coverCrop(bitmap.width, bitmap.height)
	const canvas = document.createElement('canvas')
	canvas.width = AVATAR_SIZE
	canvas.height = AVATAR_SIZE
	const ctx = canvas.getContext('2d')
	if (!ctx) throw new Error('Canvas non disponible.')
	ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
	bitmap.close()
	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, 'image/webp', 0.85),
	)
	if (!blob) throw new Error("L'image n'a pas pu être convertie.")
	return blob
}
