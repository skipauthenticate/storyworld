## Plan: Fix EPUB Front-Matter Filtering

### Problem

The copyright/title page is slipping through because:

1. The `isNavContent` content check only applies to pages under 500 characters
2. There's no content-based detection for copyright text (`Copyright ©`, `All Rights Reserved`, `epubBooks`)
3. The href might not contain "copyright" for this particular EPUB

### Change

`**src/lib/epub-parser.ts**` — Add a broader content-based front-matter detector that works regardless of text length:

After the existing `isNavContent` check, add a new `isCopyrightOrTitle` check:

- Matches text containing `copyright ©` or `all rights reserved` or `rights? (of|to) .* reproduc` patterns
- Also detect title pages: short sections (< 1000 chars) where the book's own title and author both appear and there's little other narrative content
- Skip any page where the first ~500 characters contain copyright language, even if the page is long (some EPUBs embed copyright at the start of a content page — in that case, strip the copyright block rather than skipping the whole page)

Additionally, as a safety net: strip leading paragraphs that match copyright patterns from any chapter's extracted text before sentence splitting.

### Files

- `src/lib/epub-parser.ts` — enhanced filtering logic  
  

  Additional issue: Should be able to delete books and do other standard things in library
- &nbsp;