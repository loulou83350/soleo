'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Image } from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { CitationNode } from './extensions/CitationNode';
import { InsightCallout } from './extensions/InsightCallout';
import { StatHighlight } from './extensions/StatHighlight';
import { uploadFindingImageAction } from '@/app/(dashboard)/dashboard/projects/[id]/sessions/[sessionId]/findings/actions';
import {
  SlashCommand,
  getDefaultCommands,
  filterCommands,
  type SlashCommandItem,
} from './extensions/SlashCommand';
import { SlashCommandMenu, type SlashCommandMenuRef } from './SlashCommandMenu';
import { CitationPicker } from './CitationPicker';
import { BubbleToolbar } from './BubbleToolbar';
import { markdownToHtml, htmlToMarkdown } from './markdown-bridge';
import type { CitationSource } from '@/components/findings/CitationPill';

interface Props {
  /** Markdown source (DB format). Loaded once on mount. */
  initialMarkdown: string;
  /** Citation source map for pill rendering + picker. */
  sources: Map<number, CitationSource>;
  /** Called whenever the editor content changes (debounced upstream). */
  onChange: (markdown: string) => void;
  placeholder?: string;
  /** Session id for image uploads (scopes the asset path) */
  sessionId: number;
}

export function Editor({
  initialMarkdown,
  sources,
  onChange,
  placeholder,
  sessionId,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<{
    insertCitation?: (id: number) => void;
    insertImage?: (url: string) => void;
  }>({});

  // Expose sources to the citation node renderer via window registry
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as unknown as { __soleoCitationSources: Map<number, CitationSource> }).__soleoCitationSources = sources;
    return () => {
      delete (window as unknown as { __soleoCitationSources?: Map<number, CitationSource> }).__soleoCitationSources;
    };
  }, [sources]);

  const openCitationPicker = useCallback(() => setPickerOpen(true), []);

  const openImagePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset so the same file can be re-selected later

    const fd = new FormData();
    fd.append('file', file);
    const res = await uploadFindingImageAction(sessionId, fd);
    if (res.success && res.data) {
      editorRef.current.insertImage?.(res.data.url);
    } else {
      alert(res.success ? 'Erreur upload' : (res.error ?? 'Erreur upload'));
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Use sane defaults; disable the default heading levels we don't want
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder:
          placeholder ??
          'Tapez "/" pour ouvrir le menu de commandes, ou écrivez librement…',
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: 'tiptap-table' },
      }),
      TableRow,
      TableHeader,
      TableCell,
      CitationNode,
      InsightCallout,
      StatHighlight,
      SlashCommand.configure({
        suggestion: {
          items: ({ query }) =>
            filterCommands(
              getDefaultCommands({
                onOpenCitationPicker: openCitationPicker,
                onOpenImagePicker: openImagePicker,
              }),
              query
            ),
          render: () => {
            let component: ReactRenderer<SlashCommandMenuRef> | null = null;
            let popup: HTMLDivElement | null = null;

            return {
              onStart: (props) => {
                component = new ReactRenderer(SlashCommandMenu, {
                  props: {
                    items: props.items,
                    command: (item: SlashCommandItem) => props.command(item),
                  },
                  editor: props.editor,
                });
                popup = document.createElement('div');
                popup.style.position = 'absolute';
                popup.style.zIndex = '40';
                document.body.appendChild(popup);
                popup.appendChild(component.element as Node);
                positionPopup(popup, props.clientRect?.());
              },
              onUpdate: (props) => {
                component?.updateProps({
                  items: props.items,
                  command: (item: SlashCommandItem) => props.command(item),
                });
                if (popup) positionPopup(popup, props.clientRect?.());
              },
              onKeyDown: (props) => {
                if (props.event.key === 'Escape') {
                  popup?.remove();
                  return true;
                }
                return component?.ref?.onKeyDown(props.event) ?? false;
              },
              onExit: () => {
                popup?.remove();
                component?.destroy();
              },
            };
          },
        },
      }),
    ],
    content: markdownToHtml(initialMarkdown),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const md = htmlToMarkdown(html);
      onChange(md);
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm md:prose-base max-w-none focus:outline-none min-h-[60vh] py-2 prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-base prose-p:leading-relaxed',
      },
    },
  });

  // Expose editor ops to outer effects
  useEffect(() => {
    editorRef.current.insertCitation = (responseId: number) => {
      editor?.chain().focus().insertCitation(responseId).run();
    };
    editorRef.current.insertImage = (url: string) => {
      editor?.chain().focus().setImage({ src: url }).run();
    };
  }, [editor]);

  return (
    <>
      <EditorContent editor={editor} />
      <BubbleToolbar editor={editor} />
      <CitationPicker
        open={pickerOpen}
        sources={sources}
        onPick={(responseId) => {
          editorRef.current.insertCitation?.(responseId);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileSelected}
      />
    </>
  );
}

function positionPopup(popup: HTMLDivElement, rect?: DOMRect | null) {
  if (!rect) return;
  const top = rect.bottom + window.scrollY + 6;
  const left = rect.left + window.scrollX;
  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
  // Keep within viewport horizontally
  requestAnimationFrame(() => {
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.right > window.innerWidth - 8) {
      popup.style.left = `${window.innerWidth - popupRect.width - 8}px`;
    }
  });
}
