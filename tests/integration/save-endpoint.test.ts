/**
 * Phase 1 Integration Test: POST /api/save Endpoint
 *
 * Tests:
 * - Valid URL submission and SavedItem creation
 * - Platform detection
 * - Job queue integration
 * - Error handling (invalid JSON, missing URL, invalid URL format, invalid protocol)
 * - HTTP status codes (202 Accepted, 400 Bad Request, 500 Internal Server Error)
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock the dependencies
jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(),
}));

jest.mock('@/lib/queue/boss', () => ({
  getQueue: jest.fn(),
  JOB_NAMES: {
    PROCESS_URL: 'process-url',
  },
}));

jest.mock('@/lib/integrations/apify', () => ({
  detectPlatform: jest.fn(),
}));

import { POST } from '@/app/api/save/route';
import { createServiceClient } from '@/lib/supabase/server';
import { getQueue, JOB_NAMES } from '@/lib/queue/boss';
import { detectPlatform } from '@/lib/integrations/apify';
import { SAMPLE_URLS } from '../fixtures/sample-urls';

describe('POST /api/save', () => {
  const mockSupabaseClient = {
    from: jest.fn(),
  };

  const mockQueue = {
    send: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createServiceClient as jest.Mock).mockReturnValue(mockSupabaseClient);
    (getQueue as jest.Mock).mockResolvedValue(mockQueue);
    (detectPlatform as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('tiktok')) return 'tiktok';
      if (url.includes('instagram')) return 'instagram';
      return 'other';
    });
  });

  describe('Valid requests', () => {
    it('should accept a valid TikTok URL', async () => {
      const url = SAMPLE_URLS.tiktok[0];
      const mockId = '550e8400-e29b-41d4-a716-446655440000';

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: mockId },
              error: null,
            }),
          }),
        }),
      });

      mockQueue.send.mockResolvedValue(mockId);

      const request = new NextRequest('http://localhost:3000/api/save', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });

      const response = await POST(request);
      expect(response.status).toBe(202);

      const data = await response.json();
      expect(data).toEqual({
        jobId: mockId,
        savedItemId: mockId,
        status: 'pending',
      });
      expect(detectPlatform).toHaveBeenCalledWith(url);
    });

    it('should accept a valid Instagram URL', async () => {
      const url = SAMPLE_URLS.instagram[0];
      const mockId = 'abc123-def456-ghi789';

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: mockId },
              error: null,
            }),
          }),
        }),
      });

      mockQueue.send.mockResolvedValue(mockId);

      const request = new NextRequest('http://localhost:3000/api/save', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });

      const response = await POST(request);
      expect(response.status).toBe(202);

      const data = await response.json();
      expect(data.status).toBe('pending');
      expect(detectPlatform).toHaveBeenCalledWith(url);
    });

    it('should create database record with correct platform', async () => {
      const url = SAMPLE_URLS.tiktok[0];
      const mockId = 'mock-uuid';

      const mockInsertChain = {
        insert: jest.fn(),
        select: jest.fn(),
        single: jest.fn(),
      };

      mockInsertChain.insert.mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: mockId },
            error: null,
          }),
        }),
      });

      mockSupabaseClient.from.mockReturnValue(mockInsertChain);
      mockQueue.send.mockResolvedValue(mockId);

      const request = new NextRequest('http://localhost:3000/api/save', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });

      await POST(request);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('saved_items');
      expect(mockInsertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          source_url: url,
          platform: 'tiktok',
          status: 'pending',
        })
      );
    });

    it('should queue a background job', async () => {
      const url = SAMPLE_URLS.tiktok[0];
      const mockId = 'item-123';

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: mockId },
              error: null,
            }),
          }),
        }),
      });

      mockQueue.send.mockResolvedValue(mockId);

      const request = new NextRequest('http://localhost:3000/api/save', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });

      await POST(request);

      expect(mockQueue.send).toHaveBeenCalledWith(
        JOB_NAMES.PROCESS_URL,
        expect.objectContaining({
          savedItemId: mockId,
          url,
        })
      );
    });
  });

  describe('Invalid requests', () => {
    it('should reject non-JSON body', async () => {
      const request = new NextRequest('http://localhost:3000/api/save', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'text/plain',
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Invalid JSON body');
    });

    it('should reject missing URL field', async () => {
      const request = new NextRequest('http://localhost:3000/api/save', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('url is required');
    });

    it('should reject null URL', async () => {
      const request = new NextRequest('http://localhost:3000/api/save', {
        method: 'POST',
        body: JSON.stringify({ url: null }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('url is required');
    });

    it('should reject non-string URL', async () => {
      const request = new NextRequest('http://localhost:3000/api/save', {
        method: 'POST',
        body: JSON.stringify({ url: 12345 }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('url is required');
    });

    it('should reject malformed URL format', async () => {
      const request = new NextRequest('http://localhost:3000/api/save', {
        method: 'POST',
        body: JSON.stringify({ url: 'not a valid url' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Invalid URL format');
    });

    it('should reject non-http/https protocols', async () => {
      const request = new NextRequest('http://localhost:3000/api/save', {
        method: 'POST',
        body: JSON.stringify({ url: 'ftp://example.com/file' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('URL must use http or https');
    });
  });

  describe('Error handling', () => {
    it('should return 500 if database insert fails', async () => {
      const url = SAMPLE_URLS.tiktok[0];

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: 'Database error',
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/save', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Failed to save item');
    });

    it('should still return 202 even if job queue fails', async () => {
      const url = SAMPLE_URLS.tiktok[0];
      const mockId = 'item-123';

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: mockId },
              error: null,
            }),
          }),
        }),
      });

      mockQueue.send.mockRejectedValue(new Error('Queue connection failed'));

      const request = new NextRequest('http://localhost:3000/api/save', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });

      const response = await POST(request);
      // Should still return 202 because item was saved
      expect(response.status).toBe(202);

      const data = await response.json();
      expect(data.status).toBe('pending');
      expect(data.savedItemId).toBe(mockId);
    });
  });
});
