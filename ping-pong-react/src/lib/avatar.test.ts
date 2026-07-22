import { describe, expect, it } from 'vitest'
import {
	AVATAR_MAX_BYTES,
	AVATAR_SIZE,
	avatarStoragePath,
	coverCrop,
	validateAvatarFile,
	withCacheBuster,
} from './avatar'

describe('avatarStoragePath', () => {
	it('is stable per player so uploads overwrite and removal targets the same object', () => {
		expect(avatarStoragePath('3f2a-uuid')).toBe('players/3f2a-uuid.webp')
	})
})

describe('coverCrop', () => {
	it('crops a landscape image to a horizontally centered square', () => {
		expect(coverCrop(400, 300)).toEqual({ sx: 50, sy: 0, size: 300 })
	})

	it('crops a portrait image to a vertically centered square', () => {
		expect(coverCrop(300, 500)).toEqual({ sx: 0, sy: 100, size: 300 })
	})

	it('keeps a square image whole', () => {
		expect(coverCrop(256, 256)).toEqual({ sx: 0, sy: 0, size: 256 })
	})
})

describe('validateAvatarFile', () => {
	it('accepts common image types', () => {
		expect(validateAvatarFile({ type: 'image/png', size: 1024 })).toEqual({ ok: true })
		expect(validateAvatarFile({ type: 'image/webp', size: 1024 })).toEqual({ ok: true })
	})

	it('rejects non-image files with a French error', () => {
		const result = validateAvatarFile({ type: 'application/pdf', size: 1024 })
		expect(result).toEqual({ ok: false, error: 'Choisis un fichier image.' })
	})

	it('accepts a file exactly at the size limit', () => {
		expect(validateAvatarFile({ type: 'image/jpeg', size: AVATAR_MAX_BYTES })).toEqual({
			ok: true,
		})
	})

	it('rejects a file just over the size limit', () => {
		const result = validateAvatarFile({ type: 'image/jpeg', size: AVATAR_MAX_BYTES + 1 })
		expect(result).toEqual({ ok: false, error: 'Image trop lourde (10 Mo max).' })
	})
})

describe('withCacheBuster', () => {
	it('appends a version to a public URL so replacements show immediately', () => {
		expect(withCacheBuster('https://x.supabase.co/avatars/players/p1.webp', 1721400000000)).toBe(
			'https://x.supabase.co/avatars/players/p1.webp?v=1721400000000',
		)
	})
})

describe('avatar constants', () => {
	it('targets a 256px square output', () => {
		expect(AVATAR_SIZE).toBe(256)
	})

	it('caps uploads at 10 Mo', () => {
		expect(AVATAR_MAX_BYTES).toBe(10 * 1024 * 1024)
	})
})
