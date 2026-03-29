/**
 * Integration tests: GET /api/items/:id and PATCH /api/items/:id
 *
 * Tests:
 * - GET returns full item for authenticated owner
 * - GET returns 401 for unauthenticated user
 * - GET returns 404 for unknown id or unowned item
 * - PATCH updates category and action_taken
 * - PATCH validates category enum
 * - PATCH requires at least one field
 * - PATCH returns 401 for unauthenticated user
 * - PATCH returns 404 for unknown id
 * - PATCH returns 400 for invalid JSON
 */

import { NextRequest } from "next/server";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

import { GET, PATCH } from "@/app/api/items/[id]/route";
import { createClient } from "@/lib/supabase/server";

const MOCK_USER = { id: "user-123" };

const SAMPLE_ITEM = {
  id: "item-abc",
  source_url: "https://tiktok.com/@user/video/99",
  platform: "tiktok",
  category: "food",
  extracted_data: { thumbnailUrl: "https://cdn.tiktok.com/thumb.jpg", title: "Ramen recipe" },
  action_taken: null,
  status: "done",
  created_at: "2026-03-10T12:00:00Z",
  updated_at: "2026-03-10T12:05:00Z",
};

type RouteContext = { params: Promise<{ id: string }> };

function makeContext(id: string): RouteContext {
  return { params: Promise.resolve({ id }) };
}

// ─── GET tests ───────────────────────────────────────────────────────────────

describe("GET /api/items/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 for unauthenticated requests", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const req = new NextRequest("http://localhost:3000/api/items/item-abc");
    const res = await GET(req, makeContext("item-abc"));
    expect(res.status).toBe(401);
  });

  it("returns the item for authenticated owner", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: SAMPLE_ITEM, error: null }),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items/item-abc");
    const res = await GET(req, makeContext("item-abc"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe("item-abc");
    expect(body.thumbnail_url).toBe("https://cdn.tiktok.com/thumb.jpg");
    expect(body.processed_at).toBe("2026-03-10T12:05:00Z");
    expect(body.action_taken).toBeNull();
  });

  it("returns 404 when item is not found", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items/unknown-id");
    const res = await GET(req, makeContext("unknown-id"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Item not found");
  });

  it("returns 500 on unexpected DB error", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: "XX000", message: "Unexpected" } }),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items/item-abc");
    const res = await GET(req, makeContext("item-abc"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch item");
  });

  it("returns null thumbnail_url when extracted_data is null", async () => {
    const itemNoThumb = { ...SAMPLE_ITEM, extracted_data: null, status: "pending" };
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: itemNoThumb, error: null }),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items/item-abc");
    const res = await GET(req, makeContext("item-abc"));
    const body = await res.json();
    expect(body.thumbnail_url).toBeNull();
    expect(body.processed_at).toBeNull();
  });
});

// ─── PATCH tests ─────────────────────────────────────────────────────────────

describe("PATCH /api/items/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 for unauthenticated requests", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const req = new NextRequest("http://localhost:3000/api/items/item-abc", {
      method: "PATCH",
      body: JSON.stringify({ category: "recipe" }),
    });
    const res = await PATCH(req, makeContext("item-abc"));
    expect(res.status).toBe(401);
  });

  it("updates category and returns updated item", async () => {
    const updatedItem = { ...SAMPLE_ITEM, category: "recipe" };
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: updatedItem, error: null }),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items/item-abc", {
      method: "PATCH",
      body: JSON.stringify({ category: "recipe" }),
    });
    const res = await PATCH(req, makeContext("item-abc"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.category).toBe("recipe");
  });

  it("updates action_taken", async () => {
    const updatedItem = { ...SAMPLE_ITEM, action_taken: "Export ingredients" };
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: updatedItem, error: null }),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items/item-abc", {
      method: "PATCH",
      body: JSON.stringify({ action_taken: "Export ingredients" }),
    });
    const res = await PATCH(req, makeContext("item-abc"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action_taken).toBe("Export ingredients");
  });

  it("updates both category and action_taken", async () => {
    const updatedItem = { ...SAMPLE_ITEM, category: "fitness", action_taken: "Add to plan" };
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: updatedItem, error: null }),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items/item-abc", {
      method: "PATCH",
      body: JSON.stringify({ category: "fitness", action_taken: "Add to plan" }),
    });
    const res = await PATCH(req, makeContext("item-abc"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.category).toBe("fitness");
    expect(body.action_taken).toBe("Add to plan");
  });

  it("returns 400 for invalid category value", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
    });

    const req = new NextRequest("http://localhost:3000/api/items/item-abc", {
      method: "PATCH",
      body: JSON.stringify({ category: "invalid-category" }),
    });
    const res = await PATCH(req, makeContext("item-abc"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid category");
  });

  it("returns 400 when neither field is provided", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
    });

    const req = new NextRequest("http://localhost:3000/api/items/item-abc", {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, makeContext("item-abc"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("At least one of");
  });

  it("returns 400 for invalid JSON", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
    });

    const req = new NextRequest("http://localhost:3000/api/items/item-abc", {
      method: "PATCH",
      body: "not json",
      headers: { "Content-Type": "text/plain" },
    });
    const res = await PATCH(req, makeContext("item-abc"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 404 when item not found", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items/unknown-id", {
      method: "PATCH",
      body: JSON.stringify({ category: "recipe" }),
    });
    const res = await PATCH(req, makeContext("unknown-id"));
    expect(res.status).toBe(404);
  });

  it("returns 500 on unexpected DB error", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      from: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: "XX000", message: "DB crash" } }),
      }),
    });

    const req = new NextRequest("http://localhost:3000/api/items/item-abc", {
      method: "PATCH",
      body: JSON.stringify({ category: "recipe" }),
    });
    const res = await PATCH(req, makeContext("item-abc"));
    expect(res.status).toBe(500);
  });
});
