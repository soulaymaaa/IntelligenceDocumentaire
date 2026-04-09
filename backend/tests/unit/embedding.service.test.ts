import { chunkText } from '../../src/modules/embeddings/embedding.service';
import { cosineSimilarity } from '../../src/utils/helpers';

describe('Text Chunking', () => {
  it('should split short text into a single chunk', () => {
    const text = 'This is a short document.';
    const chunks = chunkText(text);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain('This is a short document.');
  });

  it('should split long text into multiple chunks', () => {
    const paragraph = 'Lorem ipsum dolor sit amet consectetur adipiscing elit. ';
    const text = paragraph.repeat(100);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should not produce empty chunks', () => {
    const text = '\n\n\nSome text.\n\n\nMore text.\n\n\n';
    const chunks = chunkText(text);
    chunks.forEach((c) => expect(c.trim().length).toBeGreaterThan(0));
  });
});

describe('Cosine Similarity', () => {
  it('should return 1 for identical vectors', () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it('should return 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('should return 0 for vectors of different lengths', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });
});
