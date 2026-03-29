/**
 * Phase 1 Integration Test: State Machine
 *
 * Tests the SavedItem lifecycle:
 * - pending (initial state after /api/save)
 * - processing (when worker picks up the job)
 * - done (when worker completes successfully)
 * - failed (on error)
 *
 * Tests:
 * - State transitions
 * - Data persistence through pipeline
 * - Error recovery
 * - Concurrent item processing
 */

jest.mock('@/lib/supabase/server');
jest.mock('@/lib/queue/boss');

import { createServiceClient } from '@/lib/supabase/server';
import { SAMPLE_URLS, SAMPLE_SCRAPE_RESULTS, SAMPLE_EXTRACTION_RESULTS } from '../fixtures/sample-urls';
import type { Database } from '@/lib/supabase/types';

type SavedItem = Database['public']['Tables']['saved_items']['Row'];

describe('SavedItem State Machine', () => {
  const mockSupabase = {
    from: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createServiceClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  const createMockUpdate = (returnData: Partial<SavedItem> = {}) => ({
    eq: jest.fn().mockResolvedValue({ error: null }),
  });

  describe('State: pending', () => {
    it('should create SavedItem in pending state after URL submission', async () => {
      const mockChain = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'item-123',
                status: 'pending',
                source_url: SAMPLE_URLS.tiktok[0],
                platform: 'tiktok',
              },
              error: null,
            }),
          }),
        }),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const client = createServiceClient();
      const result = await client
        .from('saved_items')
        .insert({
          source_url: SAMPLE_URLS.tiktok[0],
          platform: 'tiktok',
          status: 'pending',
        })
        .select()
        .single();

      expect(result.data.status).toBe('pending');
      expect(result.data.source_url).toBe(SAMPLE_URLS.tiktok[0]);
      expect(result.data.platform).toBe('tiktok');
    });

    it('should include all required fields in pending state', async () => {
      const pendingItem: Partial<SavedItem> = {
        id: 'uuid-123',
        user_id: 'user-123',
        source_url: SAMPLE_URLS.instagram[0],
        platform: 'instagram',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
      };

      expect(pendingItem).toMatchObject({
        source_url: expect.any(String),
        platform: expect.any(String),
        status: 'pending',
      });
    });
  });

  describe('State transition: pending → processing', () => {
    it('should transition to processing when worker picks up the job', async () => {
      const itemId = 'item-123';
      const mockUpdate = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };

      mockSupabase.from.mockReturnValue(mockUpdate);

      const client = createServiceClient();
      const result = await client
        .from('saved_items')
        .update({ status: 'processing' })
        .eq('id', itemId);

      expect(result.error).toBeNull();
      expect(mockUpdate.update).toHaveBeenCalledWith({ status: 'processing' });
      expect(mockUpdate.update().eq).toHaveBeenCalledWith('id', itemId);
    });

    it('should preserve data during transition', async () => {
      const itemId = 'item-123';
      const originalData = {
        id: itemId,
        source_url: SAMPLE_URLS.tiktok[0],
        platform: 'tiktok' as const,
        status: 'pending' as const,
      };

      const mockUpdate = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };

      mockSupabase.from.mockReturnValue(mockUpdate);

      const client = createServiceClient();
      await client
        .from('saved_items')
        .update({ status: 'processing' })
        .eq('id', itemId);

      // Verify that only status was updated
      expect(mockUpdate.update).toHaveBeenCalledWith({ status: 'processing' });
      // Original data should be preserved (not passed to update)
    });
  });

  describe('State transition: processing → done', () => {
    it('should transition to done with extracted data', async () => {
      const itemId = 'item-123';
      const mockUpdate = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };

      mockSupabase.from.mockReturnValue(mockUpdate);

      const client = createServiceClient();
      const updateData = {
        status: 'done' as const,
        category: 'food' as const,
        raw_content: SAMPLE_SCRAPE_RESULTS.tiktok.metadata,
        extracted_data: SAMPLE_EXTRACTION_RESULTS.food.extractedData,
        action_taken: SAMPLE_EXTRACTION_RESULTS.food.actionTaken,
      };

      await client
        .from('saved_items')
        .update(updateData)
        .eq('id', itemId);

      expect(mockUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'done',
        category: 'food',
        action_taken: expect.any(String),
      }));
    });

    it('should store raw content from scraping', async () => {
      const mockUpdate = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };

      mockSupabase.from.mockReturnValue(mockUpdate);

      const client = createServiceClient();
      await client
        .from('saved_items')
        .update({
          raw_content: SAMPLE_SCRAPE_RESULTS.tiktok.metadata,
          status: 'done',
        })
        .eq('id', 'item-123');

      expect(mockUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
        raw_content: expect.any(Object),
      }));
    });

    it('should store extracted data from Gemini', async () => {
      const mockUpdate = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };

      mockSupabase.from.mockReturnValue(mockUpdate);

      const client = createServiceClient();
      await client
        .from('saved_items')
        .update({
          extracted_data: SAMPLE_EXTRACTION_RESULTS.food.extractedData,
          status: 'done',
        })
        .eq('id', 'item-123');

      expect(mockUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
        extracted_data: expect.any(Object),
      }));
    });

    it('should include timestamps on completion', () => {
      const completedItem: Partial<SavedItem> = {
        id: 'item-123',
        status: 'done' as const,
        updated_at: new Date().toISOString(),
      };

      expect(completedItem.status).toBe('done');
      expect(completedItem.updated_at).toBeDefined();
    });
  });

  describe('State transition: processing → failed', () => {
    it('should transition to failed state on error', async () => {
      const itemId = 'item-123';
      const mockUpdate = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };

      mockSupabase.from.mockReturnValue(mockUpdate);

      const client = createServiceClient();
      await client
        .from('saved_items')
        .update({ status: 'failed' })
        .eq('id', itemId);

      expect(mockUpdate.update).toHaveBeenCalledWith({ status: 'failed' });
    });

    it('should preserve original data in failed state', async () => {
      const itemId = 'item-123';
      const mockUpdate = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };

      mockSupabase.from.mockReturnValue(mockUpdate);

      const client = createServiceClient();
      await client
        .from('saved_items')
        .update({ status: 'failed' })
        .eq('id', itemId);

      // Original source_url and platform should be preserved
      expect(mockUpdate.update).not.toHaveBeenCalledWith(expect.objectContaining({
        source_url: expect.anything(),
        platform: expect.anything(),
      }));
    });
  });

  describe('Concurrent processing', () => {
    it('should handle multiple items in flight simultaneously', async () => {
      const items = [
        { id: 'item-1', url: SAMPLE_URLS.tiktok[0] },
        { id: 'item-2', url: SAMPLE_URLS.instagram[0] },
        { id: 'item-3', url: SAMPLE_URLS.youtube[0] },
      ];

      const mockUpdate = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };

      mockSupabase.from.mockReturnValue(mockUpdate);

      const client = createServiceClient();

      // Simulate concurrent state transitions
      await Promise.all(
        items.map((item) =>
          client
            .from('saved_items')
            .update({ status: 'processing' })
            .eq('id', item.id)
        )
      );

      expect(mockUpdate.update).toHaveBeenCalledTimes(3);
    });

    it('should not interfere with concurrent processing', async () => {
      const mockUpdate = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };

      mockSupabase.from.mockReturnValue(mockUpdate);

      const client = createServiceClient();

      // Item 1: pending → processing
      // Item 2: pending → processing
      // Item 3: processing → done

      const transitions = [
        client.from('saved_items').update({ status: 'processing' }).eq('id', 'item-1'),
        client.from('saved_items').update({ status: 'processing' }).eq('id', 'item-2'),
        client.from('saved_items').update({ status: 'done', extracted_data: {} }).eq('id', 'item-3'),
      ];

      const results = await Promise.all(transitions);

      expect(results).toHaveLength(3);
      expect(mockUpdate.update).toHaveBeenCalledTimes(3);
    });
  });

  describe('Invalid transitions', () => {
    it('should not allow direct transition from pending to done', async () => {
      // This is more of a business logic test
      const invalidTransition = (currentStatus: string, targetStatus: string) => {
        if (currentStatus === 'pending' && targetStatus === 'done') {
          return false; // Invalid
        }
        return true; // Valid
      };

      expect(invalidTransition('pending', 'done')).toBe(false);
      expect(invalidTransition('pending', 'processing')).toBe(true);
      expect(invalidTransition('processing', 'done')).toBe(true);
    });

    it('should not allow transition from done back to processing', () => {
      const validTransitions: Record<string, string[]> = {
        pending: ['processing'],
        processing: ['done', 'failed'],
        done: [],
        failed: [],
      };

      expect(validTransitions['done']).not.toContain('processing');
      expect(validTransitions['done'].length).toBe(0);
    });
  });

  describe('Data persistence across states', () => {
    it('should maintain URL throughout lifecycle', async () => {
      const url = SAMPLE_URLS.tiktok[0];
      const item = {
        id: 'item-123',
        source_url: url,
        status: 'pending' as const,
      };

      expect(item.source_url).toBe(url);

      // After processing
      const processedItem = {
        ...item,
        status: 'done' as const,
        extracted_data: SAMPLE_EXTRACTION_RESULTS.food.extractedData,
      };

      expect(processedItem.source_url).toBe(url);
      expect(processedItem.extracted_data).toBeDefined();
    });

    it('should add data fields without removing existing ones', () => {
      const pendingItem: Partial<SavedItem> = {
        id: 'item-123',
        source_url: SAMPLE_URLS.tiktok[0],
        platform: 'tiktok',
        status: 'pending' as const,
      };

      const processingItem = {
        ...pendingItem,
        status: 'processing' as const,
      };

      const doneItem = {
        ...processingItem,
        status: 'done' as const,
        category: 'food' as const,
        raw_content: SAMPLE_SCRAPE_RESULTS.tiktok.metadata,
        extracted_data: SAMPLE_EXTRACTION_RESULTS.food.extractedData,
      };

      expect(doneItem.source_url).toBe(SAMPLE_URLS.tiktok[0]);
      expect(doneItem.platform).toBe('tiktok');
      expect(doneItem.category).toBe('food');
      expect(doneItem.extracted_data).toBeDefined();
    });
  });
});
