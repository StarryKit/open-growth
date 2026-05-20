"use client";

import { defaultValueCtx, Editor, rootCtx } from "@milkdown/kit/core";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import "@milkdown/theme-nord/style.css";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

function MilkdownEditor({ value, onChange }: MarkdownEditorProps) {
  useEditor(
    (root) =>
      Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, value);
          ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
            onChange(markdown);
          });
        })
        .use(commonmark)
        .use(listener),
    [value],
  );

  return <Milkdown />;
}

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  return (
    <div className="min-h-64 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-950">
      <MilkdownProvider>
        <MilkdownEditor onChange={onChange} value={value} />
      </MilkdownProvider>
    </div>
  );
}
