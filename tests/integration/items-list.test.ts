/**
 * Integration tests: GET /api/items
 *
 * Tests:
 * - Returns paginated list for authenticated user
 * - Category filter (single + multiple)
 * - Status filter
 * - Text search (q param)
 * - Pagination (page + limit)
 * - thumbnail_url extracted from extracted_data
 * - processed_at set for done items
 * - 401 for unauthenticated requests
 * - 500 on DB error
 */

import { NextRequest } from "next/server";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

import { GET } from "@/app/api/items/route";
import { createClient } from "@/lib/supabase/server";

const MOCK_USER = { id: "user-123" };

const SAMPLE_ITEMS = [
  {
    id: "item-1",
    source_url: "https://tiktok.com/@user/video/1",
    platform: "tiktok",
    category: "food",
    extracted_data: { thumbnailUrl: "https://cdn.tiktok.com/thumb1.jpg", title: "Spicy noodles recipe" },
    action_taken: null,
    status: "done",
    created_at: "2026-03-01T10:00:00Z",
    updated_at: "2026-03-01T10:05:00Z",
  },
  {
    id: "item-2",
    source_url: "https://instagram.com/p/abc123/",
    platform: "instagram",
    category: "fitness",
    extracted_data: { displayUrl: "https://cdn.instagram.com/thumb2.jpg", caption: "Morning workout" },
    action_taken: "Add to routine",
    status: "done",
    created_at: "2026-03-02T09:00:00Z",
    updated_at: "2026-03-02T09:03:00Z",
  },
  {
    id: "item-3",
    source_url: "https://tiktok.com/@user/video/3",
    platform: "tiktok",
    category: "recipe",
    extracted_data: null,
    action_taken: null,
    status: "pending",
    created_at: "2026-03-03T08:00:00Z",
    updated_at: "2026-03-03T08:00:00Z",
  },
];

function makeSupabaseMock(items: typeof SAMPLE_ITEMS, total: number, error?: string) {
  const countChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    then: jest.fn().mockResolvedValue(error ? { count: null, error } : { count: total, error: null }),
  };
  // Make it awaitable
  Object.defineProperty(countChain, Symbol.toStringTag, { value: "Promise" });

  const dataChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue(error ? { data: null, error } : { data: items, error: null }),
  };

  const fromMock = jest.fn().mockImplementation((_table: string) => {
    // Return count chain for head:true selects, data chain for normal selects
    return {
      select: jest.fn().mockImplementation((_cols: string, opts?: { head?: boolean }) => {
        if (opts?.head) {
          return Object.assign(countChain, { select: jest.fn().mockReturnThis() });
        }
        return dataChain;
      }),
    };
  });

  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
    from: fromMock,
  };
}

describe("GET /api/items", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 for unauthenticated requests", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const req = new NextRequest("http://localhost:3000/api/items");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns paginated items for authenticated user", async () => {
    const mockClient = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockImplementation((_cols: string, opts?: { head?: boolean; count?: string }) => {
          if (opts?.head) {
            return {
              eq: jest.fn().mockReturnThis(),
              then: undefined,
              // make awaitable via Promise.resolve
              [Symbol.iterator]: undefined,
            };
          }
          return {
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockResolvedValue({ data: SAMPLE_ITEMS, error: null }),
          };
        }),
      }),
    };

    // Simplify: use a cleaner mock
    const countResult = { count: 3, error: null };
    const dataResult = { data: SAMPLE_ITEMS, error: null };

    const countChain = {
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
    };
    const dataChain = {
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue(dataResult),
    };

    // Use promise trick for count
    const countPromise = Object.assign(Promise.resolve(countResult), countChain);

    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockImplementation((_cols: string, opts?: { head?: boolean }) => {
          return opts?.head ? countPromise : dataChain;
        }),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    expect(body.total).toBe(3);
    expect(body.has_more).toBe(false);
    expect(body.items).toHaveLength(3);
  });

  it("extracts thumbnail_url from extracted_data.thumbnailUrl", async () => {
    const singleItem = [SAMPLE_ITEMS[0]];
    const countResult = { count: 1, error: null };
    const dataResult = { data: singleItem, error: null };

    const countChain = { eq: jest.fn().mockReturnThis() };
    const dataChain = {
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue(dataResult),
    };
    const countPromise = Object.assign(Promise.resolve(countResult), countChain);

    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockImplementation((_cols: string, opts?: { head?: boolean }) =>
          opts?.head ? countPromise : dataChain
        ),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items");
    const res = await GET(req);
    const body = await res.json();
    expect(body.items[0].thumbnail_url).toBe("https://cdn.tiktok.com/thumb1.jpg");
  });

  it("extracts thumbnail_url from extracted_data.displayUrl (Instagram)", async () => {
    const singleItem = [SAMPLE_ITEMS[1]];
    const countResult = { count: 1, error: null };
    const dataResult = { data: singleItem, error: null };

    const countChain = { eq: jest.fn().mockReturnThis() };
    const dataChain = {
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue(dataResult),
    };
    const countPromise = Object.assign(Promise.resolve(countResult), countChain);

    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockImplementation((_cols: string, opts?: { head?: boolean }) =>
          opts?.head ? countPromise : dataChain
        ),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items");
    const res = await GET(req);
    const body = await res.json();
    expect(body.items[0].thumbnail_url).toBe("https://cdn.instagram.com/thumb2.jpg");
  });

  it("sets processed_at for done items, null for pending", async () => {
    const items = [SAMPLE_ITEMS[0], SAMPLE_ITEMS[2]]; // done + pending
    const countResult = { count: 2, error: null };
    const dataResult = { data: items, error: null };

    const countChain = { eq: jest.fn().mockReturnThis() };
    const dataChain = {
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue(dataResult),
    };
    const countPromise = Object.assign(Promise.resolve(countResult), countChain);

    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockImplementation((_cols: string, opts?: { head?: boolean }) =>
          opts?.head ? countPromise : dataChain
        ),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items");
    const res = await GET(req);
    const body = await res.json();
    expect(body.items[0].processed_at).toBe("2026-03-01T10:05:00Z");
    expect(body.items[1].processed_at).toBeNull();
  });

  it("applies category filter", async () => {
    const filtered = [SAMPLE_ITEMS[0]];
    const countResult = { count: 1, error: null };
    const dataResult = { data: filtered, error: null };

    const countChain = {
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
    };
    const dataChain = {
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue(dataResult),
    };
    const countPromise = Object.assign(Promise.resolve(countResult), countChain);

    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockImplementation((_cols: string, opts?: { head?: boolean }) =>
          opts?.head ? countPromise : dataChain
        ),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items?category=food");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.items[0].category).toBe("food");
    // eq was called with "category" filter
    expect(dataChain.eq).toHaveBeenCalledWith("category", "food");
  });

  it("applies multiple category filter using in()", async () => {
    const filtered = [SAMPLE_ITEMS[0], SAMPLE_ITEMS[1]];
    const countResult = { count: 2, error: null };
    const dataResult = { data: filtered, error: null };

    const countChain = {
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
    };
    const dataChain = {
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue(dataResult),
    };
    const countPromise = Object.assign(Promise.resolve(countResult), countChain);

    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockImplementation((_cols: string, opts?: { head?: boolean }) =>
          opts?.head ? countPromise : dataChain
        ),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items?category=food,fitness");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.total).toBe(2);
    expect(dataChain.in).toHaveBeenCalledWith("category", ["food", "fitness"]);
  });

  it("applies status filter", async () => {
    const filtered = [SAMPLE_ITEMS[2]];
    const countResult = { count: 1, error: null };
    const dataResult = { data: filtered, error: null };

    const countChain = { eq: jest.fn().mockReturnThis() };
    const dataChain = {
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue(dataResult),
    };
    const countPromise = Object.assign(Promise.resolve(countResult), countChain);

    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockImplementation((_cols: string, opts?: { head?: boolean }) =>
          opts?.head ? countPromise : dataChain
        ),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items?status=pending");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(dataChain.eq).toHaveBeenCalledWith("status", "pending");
  });

  it("applies text search using ilike", async () => {
    const filtered = [SAMPLE_ITEMS[0]];
    const countResult = { count: 1, error: null };
    const dataResult = { data: filtered, error: null };

    const countChain = {
      eq: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
    };
    const dataChain = {
      eq: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue(dataResult),
    };
    const countPromise = Object.assign(Promise.resolve(countResult), countChain);

    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockImplementation((_cols: string, opts?: { head?: boolean }) =>
          opts?.head ? countPromise : dataChain
        ),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items?q=noodles");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(dataChain.ilike).toHaveBeenCalledWith("extracted_data::text", "%noodles%");
  });

  it("respects pagination parameters", async () => {
    const countResult = { count: 50, error: null };
    const dataResult = { data: SAMPLE_ITEMS.slice(0, 2), error: null };

    const countChain = { eq: jest.fn().mockReturnThis() };
    const dataChain = {
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue(dataResult),
    };
    const countPromise = Object.assign(Promise.resolve(countResult), countChain);

    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockImplementation((_cols: string, opts?: { head?: boolean }) =>
          opts?.head ? countPromise : dataChain
        ),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items?page=2&limit=10");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.page).toBe(2);
    expect(body.limit).toBe(10);
    expect(body.total).toBe(50);
    expect(body.has_more).toBe(true);
    // range should be called with offset=10, end=19
    expect(dataChain.range).toHaveBeenCalledWith(10, 19);
  });

  it("returns 500 on DB error", async () => {
    const countResult = { count: null, error: new Error("DB failure") };
    const dataResult = { data: null, error: new Error("DB failure") };

    const countChain = { eq: jest.fn().mockReturnThis() };
    const dataChain = {
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue(dataResult),
    };
    const countPromise = Object.assign(Promise.resolve(countResult), countChain);

    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockImplementation((_cols: string, opts?: { head?: boolean }) =>
          opts?.head ? countPromise : dataChain
        ),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items");
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch items");
  });
});
