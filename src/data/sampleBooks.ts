export interface Sentence {
  id: string;
  text: string;
  type: "narration" | "dialogue" | "description" | "thought";
  emotion?: "contemplative" | "tense" | "joyful" | "melancholic" | "neutral" | "dramatic";
  speaker?: string;
  annotation?: string;
}

export interface Scene {
  id: string;
  title: string;
  sentences: Sentence[];
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  scenes: Scene[];
}

export interface Character {
  id: string;
  name: string;
  description: string;
  color: string;
  appearances: number[];
}

export interface Book {
  id: string;
  title: string;
  author: string;
  year: number;
  coverColor: string;
  chapters: Chapter[];
  characters: Character[];
  themes: string[];
  progress: number;
  totalSentences: number;
}

const gatsbyChapter1: Chapter = {
  id: "gatsby-ch1",
  number: 1,
  title: "Chapter I",
  scenes: [
    {
      id: "gatsby-ch1-s1",
      title: "Nick's Introduction",
      sentences: [
        {
          id: "g1-1",
          text: "In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since.",
          type: "narration",
          emotion: "contemplative",
          annotation: "The novel opens with Nick establishing his role as narrator — already looking back, already processing. The word 'vulnerable' is key: it tells us Nick was changed by what he's about to describe."
        },
        {
          id: "g1-2",
          text: '"Whenever you feel like criticizing anyone," he told me, "just remember that all the people in this world haven\'t had the advantages that you\'ve had."',
          type: "dialogue",
          speaker: "Nick's Father",
          emotion: "contemplative",
          annotation: "Nick's father teaches him to suspend judgment — but the entire novel is Nick's extended judgment of the people around him. This irony is Fitzgerald's central narrative technique."
        },
        {
          id: "g1-3",
          text: "He didn't say any more, but we've always been unusually communicative in a reserved sort of way, and I understood that he meant a great deal more than that.",
          type: "narration",
          emotion: "contemplative",
          annotation: "'Unusually communicative in a reserved sort of way' — this paradox defines Nick's character. He observes everything but holds back. He communicates by what he doesn't say."
        },
        {
          id: "g1-4",
          text: "In consequence, I'm inclined to reserve all judgments, a habit that has opened up many curious natures to me and also made me the victim of not a few veteran bores.",
          type: "narration",
          emotion: "neutral",
          annotation: "Nick claims to withhold judgment, yet the word 'bores' is itself a judgment. Fitzgerald subtly undermines Nick's self-portrait from the very first page."
        },
        {
          id: "g1-5",
          text: "The abnormal mind is quick to detect and attach itself to this quality in normal people, and so it came about that in college I was unjustly accused of being a politician, because I was privy to the secret griefs of wild, unknown men.",
          type: "narration",
          emotion: "contemplative",
          annotation: "Nick positions himself as a confidant to the troubled. This is his passport into Gatsby's world — people tell Nick things because he appears not to judge."
        },
        {
          id: "g1-6",
          text: "Most of the confidences were unsought — frequently I have feigned sleep, preoccupation, or a hostile levity when I realized by some unmistakable sign that an intimate revelation was quivering on the horizon; for the intimate revelations of young men, or at least the terms in which they express them, are usually plagiaristic and marred by obvious suppressions.",
          type: "narration",
          emotion: "neutral",
          annotation: "Nick is already a literary critic — he judges not just people but the quality of their self-expression. This makes him the perfect narrator for a story about performance and authenticity."
        },
        {
          id: "g1-7",
          text: "Reserving judgments is a matter of infinite hope.",
          type: "thought",
          emotion: "contemplative",
          annotation: "Perhaps the novel's thesis in six words. To withhold judgment is to remain open to the possibility that people can be more than they appear — the same hope that defines Gatsby himself."
        },
        {
          id: "g1-8",
          text: "I am still a little afraid of missing something if I forget that, as my father snobbishly suggested, and I snobbishly repeat, a sense of the fundamental decencies is parcelled out unequally at birth.",
          type: "narration",
          emotion: "contemplative",
          annotation: "Nick calls his own father — and himself — 'snobbish.' This startling self-awareness coexists with genuine snobbery throughout the novel. Nick sees clearly but cannot change what he sees."
        },
      ],
    },
    {
      id: "gatsby-ch1-s2",
      title: "West Egg",
      sentences: [
        {
          id: "g1-9",
          text: "And, after boasting this way of my tolerance, I come to the admission that it has a limit.",
          type: "narration",
          emotion: "dramatic",
          annotation: "The pivot. After establishing his tolerant persona, Nick reveals it broke — something in this story was too much. This creates the central tension: what could shatter Nick's carefully maintained detachment?"
        },
        {
          id: "g1-10",
          text: "Conduct may be founded on the hard rock or the wet marshes, but after a certain point I don't care what it's founded on.",
          type: "narration",
          emotion: "tense",
          annotation: "Fitzgerald's geological metaphor: some people build their lives on solid ground, others on shifting marsh. By the end of the novel, we'll see that even 'hard rock' is an illusion in this world."
        },
        {
          id: "g1-11",
          text: "When I came back from the East last autumn I felt that I wanted the world to be in uniform and at a sort of moral attention forever; I wanted no more riotous excursions with privileged glimpses into the human heart.",
          type: "narration",
          emotion: "melancholic",
          annotation: "'Moral attention' — a military metaphor from a WWI veteran. Nick wants order imposed on chaos. The 'riotous excursions' he's fled from are the very story he's about to tell us."
        },
        {
          id: "g1-12",
          text: "Only Gatsby, the man who gives his name to this book, was exempt from my reaction — Gatsby, who represented everything for which I have an unaffected scorn.",
          type: "narration",
          emotion: "dramatic",
          annotation: "The paradox that drives the novel: Nick scorns everything Gatsby stands for, yet exempts Gatsby himself. The man transcends his own vulgarity through the sheer magnitude of his dream."
        },
        {
          id: "g1-13",
          text: "If personality is an unbroken series of successful gestures, then there was something gorgeous about him, some heightened sensitivity to the promises of life, as if he were related to one of those intricate machines that register earthquakes ten thousand miles away.",
          type: "narration",
          emotion: "joyful",
          annotation: "Fitzgerald's most famous characterization: Gatsby as seismograph — exquisitely sensitive to vibrations of possibility that others can't detect. The word 'gorgeous' is Nick's highest praise, reserved for Gatsby alone."
        },
        {
          id: "g1-14",
          text: "This responsiveness had nothing to do with that flabby impressionability which is dignified under the name of the 'creative temperament' — it was an extraordinary gift for hope, a romantic readiness such as I have never found in any other person and which it is not likely I shall ever find again.",
          type: "narration",
          emotion: "melancholic",
          annotation: "Nick distinguishes Gatsby's hope from mere sentimentality. Gatsby's 'romantic readiness' is active, muscular, world-shaping — he doesn't just dream, he builds elaborate architectures to house his dreams."
        },
      ],
    },
  ],
};

const gatsbyChapter2: Chapter = {
  id: "gatsby-ch2",
  number: 2,
  title: "Chapter II",
  scenes: [
    {
      id: "gatsby-ch2-s1",
      title: "The Valley of Ashes",
      sentences: [
        {
          id: "g2-1",
          text: "About half way between West Egg and New York the motor road hastily joins the railroad and runs beside it for a quarter of a mile, so as to shrink away from a certain desolate area of land.",
          type: "description",
          emotion: "melancholic",
          annotation: "Even the road 'shrinks away' — Fitzgerald personifies infrastructure to express revulsion. The valley of ashes is so bleak that even inanimate things recoil from it."
        },
        {
          id: "g2-2",
          text: "This is a valley of ashes — a fantastic farm where ashes grow like wheat into ridges and hills and grotesque gardens; where ashes take the forms of houses and chimneys and rising smoke and, finally, with a transcendent effort, of men who move dimly and already crumbling through the powdery air.",
          type: "description",
          emotion: "melancholic",
          annotation: "The valley is an anti-Eden: a 'fantastic farm' that produces death instead of life. The men are already 'crumbling' — they're becoming the ash they produce. This is the hidden cost of the wealth on display in East and West Egg."
        },
        {
          id: "g2-3",
          text: "Occasionally a line of gray cars crawls along an invisible track, gives out a ghastly creak, and comes to rest, and immediately the ash-gray men swarm up with leaden spades and stir up an impenetrable cloud, which screens their obscure operations from your sight.",
          type: "description",
          emotion: "tense",
          annotation: "'Screens their obscure operations from your sight' — the wealthy literally cannot see the labor that sustains them. The cloud of ash is both physical and metaphorical blindness."
        },
        {
          id: "g2-4",
          text: "But above the gray land and the spasms of bleak dust which drift endlessly over it, you perceive, after a moment, the eyes of Doctor T. J. Eckleburg.",
          type: "description",
          emotion: "dramatic",
          annotation: "The novel's most famous symbol appears. Eckleburg's eyes — a faded billboard — become the closest thing to God in this godless landscape. They see everything and judge nothing."
        },
        {
          id: "g2-5",
          text: "The eyes of Doctor T. J. Eckleburg are blue and gigantic — their retinas are one yard high.",
          type: "description",
          emotion: "dramatic",
          annotation: "The grotesque scale transforms a commercial artifact into something numinous. These eyes will watch over the novel's moral wasteland, a deity of advertising presiding over a civilization of consumption."
        },
      ],
    },
  ],
};

export const sampleBooks: Book[] = [
  {
    id: "gatsby",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    year: 1925,
    coverColor: "hsl(40, 55%, 48%)",
    chapters: [gatsbyChapter1, gatsbyChapter2],
    characters: [
      {
        id: "nick",
        name: "Nick Carraway",
        description: "The narrator. A Yale graduate from Minnesota who moves to West Egg, Long Island. Reserved, observant, and increasingly disillusioned.",
        color: "hsl(210, 30%, 55%)",
        appearances: [1, 2],
      },
      {
        id: "gatsby",
        name: "Jay Gatsby",
        description: "A mysterious millionaire who throws extravagant parties at his West Egg mansion. Born James Gatz in North Dakota. Driven by an extraordinary capacity for hope.",
        color: "hsl(40, 60%, 50%)",
        appearances: [1],
      },
      {
        id: "daisy",
        name: "Daisy Buchanan",
        description: "Nick's cousin. Beautiful, charming, and careless. Married to Tom Buchanan. The object of Gatsby's five-year dream.",
        color: "hsl(120, 20%, 60%)",
        appearances: [],
      },
      {
        id: "tom",
        name: "Tom Buchanan",
        description: "Daisy's husband. A former Yale football player. Wealthy, physically imposing, and brutally domineering.",
        color: "hsl(0, 35%, 50%)",
        appearances: [2],
      },
    ],
    themes: [
      "The American Dream",
      "Old Money vs. New Money",
      "The Corruption of Idealism",
      "Time and the Past",
      "Performance and Authenticity",
      "Class and Social Mobility",
    ],
    progress: 0,
    totalSentences: 19,
  },
];
