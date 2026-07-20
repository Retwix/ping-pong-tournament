import { describe, expect, it } from 'vitest'
import { splitOnWinner } from './winnerHighlight'

describe('splitOnWinner', () => {
  it('splits around the winner at the start of the title', () => {
    expect(splitOnWinner('Alice vs Bob', 'Alice')).toEqual({
      before: '',
      winner: 'Alice',
      after: ' vs Bob',
    })
  })

  it('splits around the winner at the end of the title', () => {
    expect(splitOnWinner('Alice vs Bob', 'Bob')).toEqual({
      before: 'Alice vs ',
      winner: 'Bob',
      after: '',
    })
  })

  it('splits around the winner in the middle of a custom title', () => {
    expect(splitOnWinner('Revanche Bob au sommet', 'Bob')).toEqual({
      before: 'Revanche ',
      winner: 'Bob',
      after: ' au sommet',
    })
  })

  it('returns null when the winner does not appear in the title', () => {
    expect(splitOnWinner('Revanche du midi', 'Alice')).toBeNull()
  })

  it('does not match the winner as a prefix of another name', () => {
    expect(splitOnWinner('Alice vs Ali', 'Ali')).toEqual({
      before: 'Alice vs ',
      winner: 'Ali',
      after: '',
    })
  })

  it('does not match the winner as a suffix of another name', () => {
    expect(splitOnWinner('Kate vs Nate', 'ate')).toBeNull()
  })

  it('matches accented names as whole words', () => {
    expect(splitOnWinner('Zoé vs Marc', 'Zoé')).toEqual({
      before: '',
      winner: 'Zoé',
      after: ' vs Marc',
    })
  })

  it('does not match inside an accented name', () => {
    expect(splitOnWinner('Zoé vs Marc', 'Zo')).toBeNull()
  })

  it('treats regex metacharacters in the winner name literally', () => {
    expect(splitOnWinner('a+b vs Bob', 'a+b')).toEqual({
      before: '',
      winner: 'a+b',
      after: ' vs Bob',
    })
  })

  it('returns null for an empty winner name', () => {
    expect(splitOnWinner('Alice vs Bob', '')).toBeNull()
  })
})
