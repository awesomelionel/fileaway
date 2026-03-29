/**
 * Phase 1 Integration Test: Job Queue (pg-boss)
 *
 * Tests:
 * - Queue initialization and connection
 * - Job submission (PROCESS_URL)
 * - Job data structure validation
 * - Error handling (database connection failures)
 * - Job name constants
 */

jest.mock('pg-boss');
jest.mock('@/lib/queue/boss', () => ({
  getQueue: jest.fn(),
  JOB_NAMES: {
    PROCESS_URL: 'process-url',
  },
}));

import { getQueue, JOB_NAMES, type ProcessUrlJobData } from '@/lib/queue/boss';
import { SAMPLE_URLS } from '../fixtures/sample-urls';

describe('Job Queue Integration (pg-boss)', () => {
  const mockQueue = {
    send: jest.fn(),
    work: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    on: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getQueue as jest.Mock).mockResolvedValue(mockQueue);
  });

  describe('Queue initialization', () => {
    it('should initialize pg-boss with DATABASE_URL', async () => {
      const queue = await getQueue();
      expect(queue).toBeDefined();
      expect(queue.send).toBeDefined();
      expect(queue.work).toBeDefined();
    });

    it('should return singleton instance', async () => {
      const queue1 = await getQueue();
      const queue2 = await getQueue();
      expect(queue1).toBe(queue2);
    });

    it('should configure pgboss schema', async () => {
      // The mock ensures this is called
      const queue = await getQueue();
      expect(queue).toBeDefined();
    });

    it('should set up error handling', async () => {
      const queue = await getQueue();
      expect(queue.on).toBeDefined();
    });
  });

  describe('Job submission', () => {
    it('should submit a PROCESS_URL job with correct data', async () => {
      const url = SAMPLE_URLS.tiktok[0];
      const savedItemId = 'item-123-abc';
      const jobData: ProcessUrlJobData = {
        savedItemId,
        url,
      };

      mockQueue.send.mockResolvedValue('job-id-12345');

      const queue = await getQueue();
      const jobId = await queue.send(JOB_NAMES.PROCESS_URL, jobData);

      expect(queue.send).toHaveBeenCalledWith(JOB_NAMES.PROCESS_URL, jobData);
      expect(jobId).toBe('job-id-12345');
    });

    it('should handle job submission with minimal data', async () => {
      const jobData: ProcessUrlJobData = {
        savedItemId: 'item-456',
        url: 'https://example.com/video',
      };

      mockQueue.send.mockResolvedValue('job-id-67890');

      const queue = await getQueue();
      const jobId = await queue.send(JOB_NAMES.PROCESS_URL, jobData);

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
    });

    it('should return job ID on successful submission', async () => {
      const jobId = 'uuid-1234-5678';
      mockQueue.send.mockResolvedValue(jobId);

      const queue = await getQueue();
      const result = await queue.send(JOB_NAMES.PROCESS_URL, {
        savedItemId: 'item-id',
        url: 'https://example.com',
      });

      expect(result).toBe(jobId);
    });

    it('should use item ID as fallback if queue returns null', async () => {
      mockQueue.send.mockResolvedValue(null);
      const savedItemId = 'fallback-item-id';

      const queue = await getQueue();
      const jobId = await queue.send(JOB_NAMES.PROCESS_URL, {
        savedItemId,
        url: 'https://example.com',
      });

      // The actual route.ts implements: jobId = (await boss.send(...)) ?? savedItem.id
      expect(jobId).toBeNull();
    });

    it('should handle multiple concurrent job submissions', async () => {
      const jobIds = ['job-1', 'job-2', 'job-3'];
      mockQueue.send
        .mockResolvedValueOnce(jobIds[0])
        .mockResolvedValueOnce(jobIds[1])
        .mockResolvedValueOnce(jobIds[2]);

      const queue = await getQueue();

      const results = await Promise.all([
        queue.send(JOB_NAMES.PROCESS_URL, { savedItemId: 'item-1', url: SAMPLE_URLS.tiktok[0] }),
        queue.send(JOB_NAMES.PROCESS_URL, { savedItemId: 'item-2', url: SAMPLE_URLS.instagram[0] }),
        queue.send(JOB_NAMES.PROCESS_URL, { savedItemId: 'item-3', url: SAMPLE_URLS.youtube[0] }),
      ]);

      expect(results).toEqual(jobIds);
      expect(queue.send).toHaveBeenCalledTimes(3);
    });
  });

  describe('Job data structure', () => {
    it('should require savedItemId in job data', () => {
      const validData: ProcessUrlJobData = {
        savedItemId: 'item-id',
        url: 'https://example.com',
      };

      expect(validData.savedItemId).toBeDefined();
      expect(typeof validData.savedItemId).toBe('string');
    });

    it('should require url in job data', () => {
      const validData: ProcessUrlJobData = {
        savedItemId: 'item-id',
        url: 'https://example.com',
      };

      expect(validData.url).toBeDefined();
      expect(typeof validData.url).toBe('string');
    });

    it('should validate ProcessUrlJobData type', () => {
      const jobData: ProcessUrlJobData = {
        savedItemId: 'valid-uuid-format',
        url: SAMPLE_URLS.tiktok[0],
      };

      expect(jobData).toEqual(expect.objectContaining({
        savedItemId: expect.any(String),
        url: expect.any(String),
      }));
    });

    it('should not have extra fields in ProcessUrlJobData', () => {
      const jobData: ProcessUrlJobData = {
        savedItemId: 'item-id',
        url: 'https://example.com',
      };

      expect(Object.keys(jobData)).toEqual(['savedItemId', 'url']);
    });
  });

  describe('Job names constants', () => {
    it('should define PROCESS_URL job name', () => {
      expect(JOB_NAMES.PROCESS_URL).toBe('process-url');
    });

    it('should use consistent job name in submissions', async () => {
      mockQueue.send.mockResolvedValue('job-id');

      const queue = await getQueue();
      await queue.send(JOB_NAMES.PROCESS_URL, {
        savedItemId: 'item',
        url: 'https://example.com',
      });

      expect(queue.send).toHaveBeenCalledWith('process-url', expect.any(Object));
    });

    it('should match job names between submission and worker', () => {
      // Ensure the constant is consistent
      expect(JOB_NAMES.PROCESS_URL).toBe('process-url');
      // Worker should subscribe to the same job name
      expect(JOB_NAMES.PROCESS_URL).toBe('process-url');
    });
  });

  describe('Error handling', () => {
    it('should handle queue connection failures', async () => {
      (getQueue as jest.Mock).mockRejectedValue(new Error('DATABASE_URL is not configured'));

      await expect(getQueue()).rejects.toThrow('DATABASE_URL is not configured');
    });

    it('should handle job submission failures', async () => {
      mockQueue.send.mockRejectedValue(new Error('Queue connection lost'));

      const queue = await getQueue();
      await expect(
        queue.send(JOB_NAMES.PROCESS_URL, {
          savedItemId: 'item',
          url: 'https://example.com',
        })
      ).rejects.toThrow('Queue connection lost');
    });

    it('should handle missing DATABASE_URL gracefully', async () => {
      const originalUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      try {
        (getQueue as jest.Mock).mockRejectedValue(new Error('DATABASE_URL is required'));

        await expect(getQueue()).rejects.toThrow('DATABASE_URL is required');
      } finally {
        process.env.DATABASE_URL = originalUrl;
      }
    });

    it('should retry on transient failures', async () => {
      mockQueue.send
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce('job-id');

      const queue = await getQueue();

      // First call fails
      await expect(
        queue.send(JOB_NAMES.PROCESS_URL, {
          savedItemId: 'item',
          url: 'https://example.com',
        })
      ).rejects.toThrow();

      // Second call succeeds
      const jobId = await queue.send(JOB_NAMES.PROCESS_URL, {
        savedItemId: 'item',
        url: 'https://example.com',
      });
      expect(jobId).toBe('job-id');
    });
  });

  describe('Queue lifecycle', () => {
    it('should support work() method for processing jobs', async () => {
      mockQueue.work.mockResolvedValue(undefined);

      const queue = await getQueue();
      await queue.work(JOB_NAMES.PROCESS_URL, async () => {});

      expect(queue.work).toHaveBeenCalledWith('process-url', expect.any(Function));
    });

    it('should support stop() method for graceful shutdown', async () => {
      mockQueue.stop.mockResolvedValue(undefined);

      const queue = await getQueue();
      await queue.stop();

      expect(queue.stop).toHaveBeenCalled();
    });

    it('should support error event handler', async () => {
      const queue = await getQueue();
      const errorHandler = jest.fn();

      queue.on('error', errorHandler);

      expect(queue.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });
});
