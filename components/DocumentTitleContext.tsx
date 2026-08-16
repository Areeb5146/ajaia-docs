"use client";

import { createContext, useContext, useState } from "react";

/**
 * One source of truth for the open document's title.
 *
 * The title is edited inside the editor but also read outside it (the delete
 * confirmation names the document). Passing the server-rendered title to both
 * lets the two copies drift the moment someone renames the document — the
 * confirmation would then name the wrong file, which is the worst possible
 * place for stale data. A tiny context keeps them in step without a server
 * round-trip.
 */
const DocumentTitleContext = createContext<{
  title: string;
  setTitle: (next: string) => void;
} | null>(null);

export function DocumentTitleProvider({
  initialTitle,
  children,
}: {
  initialTitle: string;
  children: React.ReactNode;
}) {
  const [title, setTitle] = useState(initialTitle);
  return (
    <DocumentTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </DocumentTitleContext.Provider>
  );
}

export function useDocumentTitle() {
  const context = useContext(DocumentTitleContext);
  if (!context) {
    throw new Error("useDocumentTitle must be used inside DocumentTitleProvider");
  }
  return context;
}
