
# Progressive Chapter-by-Chapter Enrichment System

## Context Analysis

Current enrichment system processes entire books synchronously in a single pipeline (characters → themes → annotations), blocking the UI and providing all-or-nothing results. Users must wait for complete processing before seeing any intelligence data, and there's no resumability if the process fails.

## Research-Backed Approach

Based on modern web app background processing patterns, the solution requires:
- **Queue-based architecture** with priority separation 
- **Progressive availability** showing results as individual chapters complete
- **Resilient persistence** using IndexedDB for queue and partial state management
- **Graceful degradation** where reading works with partial enrichment
- **Chunk-based processing** to prevent memory pressure and allow cancellation/resumption

## Architecture Design

### 1. Enhanced Data Model
```typescript
interface ChapterEnrichmentStatus {
  chapterId: string;
  characters: Character[] | null;
  themes: string[] | null; 
  annotationProgress: number; // 0-100, sentences annotated
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

interface EnrichmentQueue {
  bookId: string;
  chapters: ChapterEnrichmentStatus[];
  globalCharacters: Character[];
  globalThemes: string[];
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  currentChapterIndex: number;
}
```

### 2. Queue Management System
- **`useEnrichmentQueue`**: Main hook managing background processing state
- **`EnrichmentWorker`**: Web worker for non-blocking LLM operations
- **`IndexedDBQueue`**: Persistent storage for queue state and partial results
- **Priority queues**: Separate high-priority (current chapter) from background processing

### 3. Processing Strategy

**Phase 1: Book-Level Analysis** (Priority: High)
- Extract global characters from first 3 chapters
- Identify overarching themes from book sample
- Store as `globalCharacters` and `globalThemes`
- Updates UI immediately when complete

**Phase 2: Progressive Chapter Processing** (Priority: Background)
```typescript
async function processChapter(chapterId: string) {
  // 1. Sentence-by-sentence annotation (progressive updates)
  // 2. Chapter-specific character appearances 
  // 3. Chapter-specific theme manifestations
  // 4. Update UI as each sentence completes
}
```

**Phase 3: Intelligent Scheduling**
- Process current reading chapter with high priority
- Process adjacent chapters next
- Background process remaining chapters in order
- Pause processing during active reading sessions

### 4. Progressive UI Updates

**Intelligence Panel Enhancements:**
- Show global characters/themes as soon as Phase 1 completes
- Display per-chapter enrichment progress bars
- Real-time sentence annotation updates during reading
- "Enhancing in background" indicator with option to prioritize current chapter

**Reading Experience:**
- Sentences show annotations immediately when available
- Chapter progress indicators show enrichment status
- Graceful handling of partial data (some annotated, some not)

### 5. Resilience & Performance

**Queue Persistence:**
- All queue state stored in IndexedDB
- Resumable after browser restart or tab close
- Atomic updates prevent corruption during failures

**Memory Management:**
- Process maximum 50 sentences per batch
- Release intermediate results from memory
- Streaming updates to UI prevent accumulation

**Error Handling:**
- Individual chapter failures don't stop queue
- Exponential backoff for failed chapters
- User option to retry specific chapters or entire queue

## Implementation Plan

### Phase A: Core Infrastructure (2-3 files)
1. **`useEnrichmentQueue.ts`** - Main queue management hook
2. **`enrichment-worker.ts`** - Web worker for background processing  
3. **`enrichmentStorage.ts`** - IndexedDB wrapper for persistence

### Phase B: Enhanced Processing (2 files)  
4. **Update `useEnrichment.ts`** - Integrate with queue system
5. **Update `IntelligencePanel.tsx`** - Progressive UI with chapter status

### Phase C: Reading Experience (2 files)
6. **Update `ReadingPanel.tsx`** - Show real-time enrichment progress  
7. **Update `SentenceRenderer.tsx`** - Handle progressive annotation availability

### Phase D: Smart Scheduling (1 file)
8. **`enrichmentScheduler.ts`** - Intelligent chapter prioritization based on reading position

## Technical Implementation Details

**Queue Processing Loop:**
```typescript
const processQueue = async () => {
  while (queue.chapters.some(ch => ch.status === 'pending')) {
    const nextChapter = getNextChapterByPriority();
    await processChapter(nextChapter);
    await saveQueueState(); // Atomic persistence
    updateUI(); // Real-time updates
  }
};
```

**Progressive Annotation Strategy:**
- Annotate sentences in batches of 5-8
- Update UI after each batch completes
- User can read newly annotated content immediately
- Background continues processing remaining sentences

**Priority Calculation:**
```typescript
const getPriority = (chapterId: string) => {
  if (chapterId === currentReadingChapter) return 'high';
  if (isAdjacentChapter(chapterId)) return 'medium';  
  return 'low';
};
```

## User Experience Flow

1. **Import EPUB** → Book appears in library immediately
2. **Open book** → Reading starts with no enrichment
3. **Auto-enrichment begins** → Global characters/themes appear within 30s
4. **Progressive annotations** → Current chapter sentences gain annotations in real-time
5. **Background processing** → Other chapters enrich silently while reading
6. **Resume anywhere** → Queue persists across sessions, picks up where it left off

This creates a Netflix-like experience where content is immediately usable but continuously improves in the background, with intelligence appearing progressively as the user reads.
