'use client';

import { BubbleMenu } from '@tiptap/react/menus';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  Quote,
  type LucideIcon,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';

interface Props {
  editor: Editor | null;
}

export function BubbleToolbar({ editor }: Props) {
  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: 'top',
        // Generous gap so the toolbar doesn't visually clip the line above
        // the selection. Auto-flips below when there's not enough room above.
        offset: 16,
      }}
      shouldShow={({ editor: ed, from, to }) => {
        // Hide when nothing is selected
        if (from === to) return false;
        // Hide inside code blocks (formatting buttons don't apply there)
        if (ed.isActive('codeBlock')) return false;
        return true;
      }}
    >
      <div className="z-40 flex items-center gap-0.5 rounded-lg border border-border bg-background shadow-md p-1">
        {/* Inline formatting */}
        <ToolButton
          editor={editor}
          icon={Bold}
          label="Gras"
          isActive={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          shortcut="⌘B"
        />
        <ToolButton
          editor={editor}
          icon={Italic}
          label="Italique"
          isActive={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          shortcut="⌘I"
        />
        <ToolButton
          editor={editor}
          icon={Strikethrough}
          label="Barré"
          isActive={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <ToolButton
          editor={editor}
          icon={Code}
          label="Code"
          isActive={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />

        <Divider />

        {/* Block transforms */}
        <ToolButton
          editor={editor}
          icon={Heading1}
          label="Titre 1"
          isActive={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <ToolButton
          editor={editor}
          icon={Heading2}
          label="Titre 2"
          isActive={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolButton
          editor={editor}
          icon={Heading3}
          label="Titre 3"
          isActive={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <ToolButton
          editor={editor}
          icon={Pilcrow}
          label="Paragraphe"
          isActive={editor.isActive('paragraph') && !editor.isActive('heading')}
          onClick={() => editor.chain().focus().setParagraph().run()}
        />

        <Divider />

        {/* Lists & Quote */}
        <ToolButton
          editor={editor}
          icon={List}
          label="Liste à puces"
          isActive={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolButton
          editor={editor}
          icon={ListOrdered}
          label="Liste numérotée"
          isActive={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolButton
          editor={editor}
          icon={Quote}
          label="Citation"
          isActive={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
      </div>
    </BubbleMenu>
  );
}

// ─── Internal ────────────────────────────────────────────────────────────────

interface ToolButtonProps {
  editor: Editor;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
  shortcut?: string;
}

function ToolButton({ icon: Icon, label, isActive, onClick, shortcut }: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={isActive}
      className={`h-7 w-7 inline-flex items-center justify-center rounded transition-colors ${
        isActive
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function Divider() {
  return <span className="h-5 w-px bg-border mx-0.5" aria-hidden />;
}
