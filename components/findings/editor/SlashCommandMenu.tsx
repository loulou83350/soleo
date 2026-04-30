'use client';

import { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import type { SlashCommandItem } from './extensions/SlashCommand';

export interface SlashCommandMenuRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface Props {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export const SlashCommandMenu = forwardRef<SlashCommandMenuRef, Props>(
  function SlashCommandMenu({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      // Reset selection when items change
      setSelectedIndex(0);
    }, [items]);

    function selectItem(idx: number) {
      const item = items[idx];
      if (item) command(item);
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-border bg-background shadow-lg p-3 text-xs text-muted-foreground w-[280px]">
          Aucune commande ne correspond.
        </div>
      );
    }

    // Group by section while preserving order
    const sections: Array<{ name: string; items: SlashCommandItem[] }> = [];
    for (const item of items) {
      let last = sections[sections.length - 1];
      if (!last || last.name !== item.section) {
        last = { name: item.section, items: [] };
        sections.push(last);
      }
      last.items.push(item);
    }

    return (
      <div className="rounded-lg border border-border bg-background shadow-lg w-[300px] overflow-hidden">
        <div className="max-h-[320px] overflow-y-auto py-1">
          {sections.map((section) => (
            <div key={section.name}>
              <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground/60">
                {section.name}
              </p>
              {section.items.map((item) => {
                const idx = items.indexOf(item);
                const isActive = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => selectItem(idx)}
                    className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 ${
                      isActive ? 'bg-muted' : 'hover:bg-muted/60'
                    }`}
                  >
                    <span className="text-sm font-medium text-foreground">{item.title}</span>
                    {item.description && (
                      <span className="text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }
);
