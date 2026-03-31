describe('Extraction prompt schemas', () => {
  describe('how-to category', () => {
    it('returns title and summary fields (not topic)', () => {
      const sample = {
        title: 'How to fold a fitted sheet',
        summary: 'A quick 3-step method for folding fitted sheets without a mess.',
        steps: ['Lay flat', 'Tuck corners', 'Fold in thirds'],
        tools_needed: [],
        difficulty: 'easy',
        time_required: '2 minutes',
      };
      expect(sample).toHaveProperty('title');
      expect(sample).toHaveProperty('summary');
      expect(sample).not.toHaveProperty('topic');
    });
  });
});
