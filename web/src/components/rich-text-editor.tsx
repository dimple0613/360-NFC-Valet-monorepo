"use client";

import { useState } from "react";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { BoldIcon, ItalicIcon, ListIcon, ListOrderedIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A minimal Tiptap-backed WYSIWYG editor that mirrors a hidden input for
 * plain server-action form submission (Next.js Server Actions read FormData,
 * not React state) — the same "sync into a hidden input" approach the rest
 * of this codebase already uses for other client-managed form values (e.g.
 * PermissionPicker's checkboxes).
 */
export function RichTextEditor({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [html, setHtml] = useState(defaultValue ?? "");
  const editor = useEditor({
    extensions: [StarterKit],
    content: defaultValue ?? "",
    immediatelyRender: false,
    // Tiptap manages its own state outside React's render cycle — without this,
    // the hidden input below would never see content typed after the initial
    // render, since nothing would trigger this component to re-render.
    onUpdate: ({ editor: e }) => setHtml(e.getHTML()),
  });

  const editorState = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      isBold: e?.isActive("bold") ?? false,
      isItalic: e?.isActive("italic") ?? false,
      isBulletList: e?.isActive("bulletList") ?? false,
      isOrderedList: e?.isActive("orderedList") ?? false,
    }),
  });

  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-1 border-b p-1.5">
        <ToolbarButton
          active={editorState?.isBold}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          label="Bold"
        >
          <BoldIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editorState?.isItalic}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          label="Italic"
        >
          <ItalicIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editorState?.isBulletList}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          label="Bullet list"
        >
          <ListIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editorState?.isOrderedList}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          label="Numbered list"
        >
          <ListOrderedIcon className="size-4" />
        </ToolbarButton>
      </div>
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-3 py-2 focus-within:outline-none [&_.tiptap]:min-h-40 [&_.tiptap]:outline-none"
      />
      <input type="hidden" name={name} value={html} readOnly />
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(active && "bg-accent text-accent-foreground")}
    >
      {children}
    </Button>
  );
}
