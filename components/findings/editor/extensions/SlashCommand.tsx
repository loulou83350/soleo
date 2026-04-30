'use client';

import { Extension, type Editor, type Range } from '@tiptap/core';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';

export interface SlashCommandItem {
  /** Stable identifier */
  id: string;
  /** Displayed label */
  title: string;
  /** Optional secondary line (description) */
  description?: string;
  /** Search aliases */
  aliases?: string[];
  /** Section header */
  section: 'Texte' | 'Listes' | 'Soleo' | 'Médias';
  /** Action when chosen */
  command: (args: { editor: Editor; range: Range }) => void;
}

export interface SlashCommandOptions {
  suggestion: Omit<SuggestionOptions, 'editor'>;
}

/**
 * Tiptap extension that triggers a slash menu when the user types "/".
 * The actual menu UI is rendered by the parent component via `render()`.
 */
export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        command: ({ editor, range, props }) => {
          const item = props as SlashCommandItem;
          item.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

// ─── Default command list (text + lists + Soleo) ─────────────────────────────

export function getDefaultCommands({
  onOpenCitationPicker,
}: {
  onOpenCitationPicker: () => void;
}): SlashCommandItem[] {
  return [
    {
      id: 'h1',
      section: 'Texte',
      title: 'Titre 1',
      description: 'Gros titre de section',
      aliases: ['heading', 'h1', 'titre'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
      },
    },
    {
      id: 'h2',
      section: 'Texte',
      title: 'Titre 2',
      description: 'Sous-titre',
      aliases: ['heading2', 'h2'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
      },
    },
    {
      id: 'h3',
      section: 'Texte',
      title: 'Titre 3',
      description: 'Sous-section',
      aliases: ['heading3', 'h3'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
      },
    },
    {
      id: 'paragraph',
      section: 'Texte',
      title: 'Paragraphe',
      description: 'Texte courant',
      aliases: ['p', 'text'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('paragraph').run();
      },
    },
    {
      id: 'blockquote',
      section: 'Texte',
      title: 'Citation',
      description: 'Bloc de citation visuel',
      aliases: ['quote', 'blockquote'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      id: 'code',
      section: 'Texte',
      title: 'Bloc de code',
      description: 'Pour du code monospace',
      aliases: ['code', 'pre'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      id: 'bullet',
      section: 'Listes',
      title: 'Liste à puces',
      description: 'Liste non ordonnée',
      aliases: ['list', 'ul'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      id: 'ordered',
      section: 'Listes',
      title: 'Liste numérotée',
      description: 'Liste ordonnée 1. 2. 3.',
      aliases: ['ol', 'numbered'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      id: 'hr',
      section: 'Texte',
      title: 'Séparateur',
      description: 'Une ligne horizontale',
      aliases: ['divider', 'hr', '---'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      id: 'citation',
      section: 'Soleo',
      title: 'Citer une réponse',
      description: 'Insère une référence cliquable vers un participant',
      aliases: ['citer', 'cite', 'quote', 'ref', 'source'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        onOpenCitationPicker();
      },
    },
  ];
}

export function filterCommands(
  items: SlashCommandItem[],
  query: string
): SlashCommandItem[] {
  if (!query) return items;
  const q = query.toLowerCase();
  return items.filter((item) => {
    if (item.title.toLowerCase().includes(q)) return true;
    if (item.description?.toLowerCase().includes(q)) return true;
    if (item.aliases?.some((a) => a.toLowerCase().includes(q))) return true;
    return false;
  });
}
