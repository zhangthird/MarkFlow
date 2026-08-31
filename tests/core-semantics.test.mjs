import test from 'node:test'
import assert from 'node:assert/strict'

import { parseMarkdownBlocks } from '../src/components/editor/markdown/markdown-blocks.ts'
import {
  extractWikiLinks,
  resolveWikiLinkTarget,
  rewriteWikiLinksForFileRename,
} from '../src/lib/wiki-links.ts'
import { basenameOf, isValidEntryName, parentPathOf } from '../src/lib/file-system.ts'
import {
  clampPanelWidth,
  parseStoredBoolean,
  parseStoredPanelWidth,
} from '../src/lib/panel-preferences.ts'

test('Markdown parser keeps semantic multiline blocks intact', () => {
  const source = [
    'first paragraph line',
    'second paragraph line',
    '',
    '- one',
    '- two',
    '',
    '| A | B |',
    '|---|---|',
    '| 1 | 2 |',
    '',
    '```',
    'single line',
    '```',
  ].join('\n')

  const blocks = parseMarkdownBlocks(source)
  assert.deepEqual(
    blocks.filter(block => block.kind !== 'blank').map(block => [block.kind, block.content]),
    [
      ['paragraph', 'first paragraph line\nsecond paragraph line'],
      ['list', '- one\n- two'],
      ['table', '| A | B |\n|---|---|\n| 1 | 2 |'],
      ['code', '```\nsingle line\n```'],
    ]
  )
})

test('Wiki links preserve aliases and report source context', () => {
  const source = 'Intro [[folder/Note|Readable name]]\nSee [[Other.md]]'
  const links = extractWikiLinks(source, '/docs/source.md', 'source.md')

  assert.equal(links.length, 2)
  assert.deepEqual(
    { target: links[0].targetName, alias: links[0].alias, line: links[0].line, context: links[0].context },
    {
      target: 'folder/Note',
      alias: 'Readable name',
      line: 1,
      context: 'Intro [[folder/Note|Readable name]]',
    }
  )
})

test('Wiki link resolution prefers a same-directory duplicate', () => {
  const files = [
    { type: 'file', name: 'Note.md', path: '/one/Note.md' },
    { type: 'file', name: 'Note.md', path: '/two/Note.md' },
  ]

  const resolved = resolveWikiLinkTarget(files, 'Note', '/two/source.md')
  assert.equal(resolved?.path, '/two/Note.md')
})

test('Wiki rename rewrites only links that resolved to the renamed note', () => {
  const files = [
    { type: 'file', name: 'Note.md', path: '/one/Note.md' },
    { type: 'file', name: 'Note.md', path: '/two/Note.md' },
    { type: 'file', name: 'source.md', path: '/two/source.md' },
  ]
  const source = 'Local [[Note]] and explicit [[one/Note|remote]]'

  const result = rewriteWikiLinksForFileRename(
    source,
    '/two/source.md',
    files,
    '/two/Note.md',
    '/two/Renamed.md',
    'Renamed.md'
  )

  assert.equal(result.replacements, 1)
  assert.equal(result.content, 'Local [[Renamed]] and explicit [[one/Note|remote]]')
})

test('Workspace path helpers preserve legal path spaces and validate new names', () => {
  assert.equal(parentPathOf('/ folder /note.md'), '/ folder ')
  assert.equal(basenameOf('/ folder /note.md'), 'note.md')

  assert.equal(isValidEntryName('note.md'), true)
  assert.equal(isValidEntryName('  note.md  '), true)
  assert.equal(isValidEntryName(''), false)
  assert.equal(isValidEntryName('..'), false)
  assert.equal(isValidEntryName('folder/note.md'), false)
  assert.equal(isValidEntryName('folder\\note.md'), false)
})

test('Panel preference helpers clamp corrupt or out-of-range stored values', () => {
  assert.equal(clampPanelWidth(350.4, 200, 420, 260), 350)
  assert.equal(clampPanelWidth(999, 200, 420, 260), 420)
  assert.equal(clampPanelWidth(Number.NaN, 200, 420, 260), 260)

  assert.equal(parseStoredPanelWidth('180', 200, 420, 260), 200)
  assert.equal(parseStoredPanelWidth('380', 200, 420, 260), 380)
  assert.equal(parseStoredPanelWidth('not-a-number', 200, 420, 260), 260)
  assert.equal(parseStoredPanelWidth(null, 200, 420, 260), 260)

  assert.equal(parseStoredBoolean('true', false), true)
  assert.equal(parseStoredBoolean('false', true), false)
  assert.equal(parseStoredBoolean('unknown', true), true)
})
