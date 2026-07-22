import { describe, expect, it } from 'vitest'
import {
	AVATAR_MAX_BYTES,
	AVATAR_SIZE,
	avatarStoragePath,
	coverCrop,
	playerInitials,
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

describe('playerInitials', () => {
	it('takes the first two letters of a single-word name', () => {
		expect(playerInitials('Thibault')).toBe('TH')
	})

	it('keeps accented letters rather than stripping them', () => {
		expect(playerInitials('Léo')).toBe('LÉ')
	})

	it('takes one letter per word when the name has two words', () => {
		expect(playerInitials('Marie Claire')).toBe('MC')
	})

	it('treats a hyphen as a word separator, like a space', () => {
		expect(playerInitials('Jean-Baptiste')).toBe('JB')
		expect(playerInitials('Marie-Claire')).toBe('MC')
	})

	it('uses only the first two words when the name has more', () => {
		expect(playerInitials('Jean Paul Sartre')).toBe('JP')
	})

	it('returns the single letter of a one-character name', () => {
		expect(playerInitials('A')).toBe('A')
	})

	it('uppercases lowercase input', () => {
		expect(playerInitials('thibault')).toBe('TH')
		expect(playerInitials('marie claire')).toBe('MC')
	})

	it('ignores surrounding and repeated whitespace', () => {
		expect(playerInitials('  Marie   Claire  ')).toBe('MC')
		expect(playerInitials('  Léo  ')).toBe('LÉ')
	})

	it('ignores a trailing separator rather than emitting a blank letter', () => {
		expect(playerInitials('Jean-')).toBe('JE')
		expect(playerInitials('Léo ')).toBe('LÉ')
	})

	it('falls back to a placeholder for an empty or whitespace-only name', () => {
		expect(playerInitials('')).toBe('?')
		expect(playerInitials('   ')).toBe('?')
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
