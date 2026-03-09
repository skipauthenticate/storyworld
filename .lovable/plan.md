

## Enhance AI Chat with On-Screen Context

### What Changes

Pass the current chapter text and reading position into the AI chat's system prompt so the model knows exactly what the reader is looking at.

### How

**`src/pages/Index.tsx`**
- Pass `activeChapter` and `activeSentenceIndex` as new props to `IntelligencePanel` (both desktop and mobile instances).

**`src/components/storyworld/IntelligencePanel.tsx`**
- Add `currentChapter` and `activeSentenceIndex` to `IntelligencePanelProps`.
- Forward them to `PersistentChat`.
- In `PersistentChat`, build a richer system prompt that includes:
  - The current chapter title.
  - A window of ~10 sentences around the reading position (5 before, current, 4 after) so the AI knows the visible passage without exceeding token limits.
  - The selected sentence (if any), as it does today.
  - Characters and themes, as it does today.

### System Prompt Structure

```text
You are a literary analysis AI in Storyworld.
Book: "{title}" by {author}
Current chapter: "{chapterTitle}"

The reader is currently seeing this passage:
---
[~10 sentences around activeSentenceIndex]
---

[If selected sentence exists:]
The reader has highlighted: "{selectedSentence.text}"

Characters: ...
Themes: ...

Provide concise literary analysis. Keep responses under 150 words.
```

This gives the AI full awareness of on-screen content without sending the entire chapter (which would blow token limits on the local model).

