// extension-demo/tagger.js
// Simple client-side tag extractor (no external deps)

const STOP_WORDS = new Set([
  "the","is","in","and","to","of","a","for","on","with","that","this","it","as","are","an","by","be","from",
  "or","at","was","but","not","have","has","had","you","your","i","we","they","their","our"
]);

function normalizeWord(w) {
  return w.replace(/[^a-z0-9\-]/gi, "").toLowerCase();
}

function extractTags(text, maxTags = 6) {
  if (!text) return [];
  const sample = text.slice(0, 2000);
  const tokens = sample.split(/\s+/).map(normalizeWord).filter(Boolean);
  const freqs = {};
  tokens.forEach(t => {
    if (t.length < 2) return;
    if (STOP_WORDS.has(t)) return;
    let key = t.replace(/s$/,''); // naive singularization
    if (key.length < 2) key = t;
    freqs[key] = (freqs[key] || 0) + 1;
  });
  const sorted = Object.keys(freqs)
    .map(k => ({ tag: k, score: freqs[k] }))
    .sort((a,b) => b.score - a.score)
    .slice(0, maxTags)
    .map(x => x.tag);
  return Array.from(new Set(sorted));
}

// expose globally for popup.js to call
if (typeof window !== "undefined") window.extractTags = extractTags;
if (typeof module !== "undefined" && module.exports) module.exports = { extractTags };
