# Product brief: Ajaia Docs

Upload this file to see the importer turn Markdown into editable rich text.

## What the converter handles

- Headings, clamped to **H1 to H3** because that is what the editor schema allows
- Bold, *italic*, and <u>underline</u> inline marks
- Bulleted lists like this one
- Blockquotes and code

## Numbered lists work too

1. First item
2. Second item
3. Third item

> Unsupported syntax degrades to plain text rather than throwing an error.

Inline code such as `markdownToDoc()` is preserved, and so are fenced blocks:

```
const doc = markdownToDoc(source);
```

---

The document title above becomes the document's name on import.
