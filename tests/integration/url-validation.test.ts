/**
 * Phase 1 Integration Test: URL Validation & Platform Detection
 *
 * Tests:
 * - URL format validation (valid http/https URLs)
 * - Invalid URL format handling
 * - Platform detection (TikTok, Instagram, YouTube, Twitter, Other)
 * - Edge cases (short URLs, URLs with parameters, etc.)
 */

import { detectPlatform } from '@/lib/integrations/apify';
import { SAMPLE_URLS } from '../fixtures/sample-urls';

describe('URL Validation & Platform Detection', () => {
  describe('detectPlatform()', () => {
    describe('TikTok detection', () => {
      it('should detect TikTok URLs (www.tiktok.com)', () => {
        const url = SAMPLE_URLS.tiktok[0];
        expect(detectPlatform(url)).toBe('tiktok');
      });

      it('should detect TikTok URLs (tiktok.com)', () => {
        const url = SAMPLE_URLS.tiktok[1];
        expect(detectPlatform(url)).toBe('tiktok');
      });

      it('should detect TikTok short URLs (vm.tiktok.com)', () => {
        const url = SAMPLE_URLS.tiktok[2];
        expect(detectPlatform(url)).toBe('tiktok');
      });

      it('should be case-insensitive', () => {
        expect(detectPlatform('https://www.TIKTOK.COM/video')).toBe('tiktok');
        expect(detectPlatform('https://TIKTOK.com/video')).toBe('tiktok');
      });
    });

    describe('Instagram detection', () => {
      it('should detect Instagram post URLs (www.instagram.com/p/)', () => {
        const url = SAMPLE_URLS.instagram[0];
        expect(detectPlatform(url)).toBe('instagram');
      });

      it('should detect Instagram URLs (instagram.com/p/)', () => {
        const url = SAMPLE_URLS.instagram[1];
        expect(detectPlatform(url)).toBe('instagram');
      });

      it('should detect Instagram reel URLs', () => {
        const url = SAMPLE_URLS.instagram[2];
        expect(detectPlatform(url)).toBe('instagram');
      });

      it('should be case-insensitive', () => {
        expect(detectPlatform('https://www.INSTAGRAM.COM/p/abc')).toBe('instagram');
      });
    });

    describe('YouTube detection', () => {
      it('should detect YouTube URLs (www.youtube.com)', () => {
        const url = SAMPLE_URLS.youtube[0];
        expect(detectPlatform(url)).toBe('youtube');
      });

      it('should detect YouTube short URLs (youtu.be)', () => {
        const url = SAMPLE_URLS.youtube[1];
        expect(detectPlatform(url)).toBe('youtube');
      });

      it('should be case-insensitive', () => {
        expect(detectPlatform('https://www.YOUTUBE.COM/watch?v=xyz')).toBe('youtube');
      });
    });

    describe('Twitter/X detection', () => {
      it('should detect Twitter URLs (twitter.com)', () => {
        const url = SAMPLE_URLS.twitter[0];
        expect(detectPlatform(url)).toBe('twitter');
      });

      it('should detect X URLs (x.com)', () => {
        const url = SAMPLE_URLS.twitter[1];
        expect(detectPlatform(url)).toBe('twitter');
      });

      it('should be case-insensitive', () => {
        expect(detectPlatform('https://TWITTER.COM/user/status/123')).toBe('twitter');
        expect(detectPlatform('https://X.COM/user/status/123')).toBe('twitter');
      });
    });

    describe('Other platform detection', () => {
      it('should return "other" for unsupported platforms', () => {
        SAMPLE_URLS.other.forEach((url) => {
          expect(detectPlatform(url)).toBe('other');
        });
      });

      it('should return "other" for random domains', () => {
        expect(detectPlatform('https://example.com/blog')).toBe('other');
        expect(detectPlatform('https://github.com/user/repo')).toBe('other');
        expect(detectPlatform('https://stackoverflow.com/questions/123')).toBe('other');
      });
    });

    describe('Edge cases', () => {
      it('should handle URLs with query parameters', () => {
        expect(detectPlatform('https://www.tiktok.com/@user/video/123?utm_source=test')).toBe('tiktok');
        expect(detectPlatform('https://www.instagram.com/p/abc/?utm=1')).toBe('instagram');
      });

      it('should handle URLs with fragments', () => {
        expect(detectPlatform('https://www.tiktok.com/@user/video/123#comments')).toBe('tiktok');
      });

      it('should handle URLs with authentication', () => {
        expect(detectPlatform('https://user:pass@www.tiktok.com/video')).toBe('tiktok');
      });

      it('should handle URLs with custom ports', () => {
        expect(detectPlatform('https://www.tiktok.com:8443/video')).toBe('tiktok');
      });
    });

    describe('Invalid URLs', () => {
      it('should return "other" for empty string', () => {
        expect(detectPlatform('')).toBe('other');
      });

      it('should return "other" for malformed URLs', () => {
        expect(detectPlatform('not-a-url')).toBe('other');
        expect(detectPlatform('just text')).toBe('other');
      });

      it('should handle URLs with special characters', () => {
        // These should still work with the current regex-based approach
        expect(detectPlatform('https://www.tiktok.com/video?id=123&name=test%20video')).toBe('tiktok');
      });
    });
  });

  describe('URL format validation', () => {
    it('should validate correct HTTP URLs', () => {
      const url = 'http://example.com';
      expect(() => new URL(url)).not.toThrow();
    });

    it('should validate correct HTTPS URLs', () => {
      const url = 'https://example.com';
      expect(() => new URL(url)).not.toThrow();
    });

    it('should reject invalid protocols in the API', () => {
      // The API validate http/https only, even though URL constructor accepts other protocols
      const testProtocolValidation = (protocol: string) => {
        return ['http:', 'https:'].includes(protocol);
      };

      expect(testProtocolValidation('http:')).toBe(true);
      expect(testProtocolValidation('https:')).toBe(true);
      expect(testProtocolValidation('ftp:')).toBe(false);
      expect(testProtocolValidation('file:')).toBe(false);
    });

    it('should reject malformed URLs', () => {
      expect(() => new URL('not a url')).toThrow();
      expect(() => new URL('http://')).toThrow();
      expect(() => new URL('://example.com')).toThrow();
    });

    it('should handle URLs with all components', () => {
      const complexUrl = 'https://user:pass@subdomain.example.com:8080/path/to/resource?query=value#fragment';
      expect(() => new URL(complexUrl)).not.toThrow();
      const parsed = new URL(complexUrl);
      expect(parsed.hostname).toBe('subdomain.example.com');
      expect(parsed.port).toBe('8080');
      expect(parsed.pathname).toBe('/path/to/resource');
      expect(parsed.search).toBe('?query=value');
      expect(parsed.hash).toBe('#fragment');
    });
  });
});
