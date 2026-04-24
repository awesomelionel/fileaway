import { flattenToPoints, type FlattenInput } from "../../convex/places";

const baseItem = (overrides: Partial<FlattenInput[number]>): FlattenInput[number] => ({
  _id: "it_1" as unknown as FlattenInput[number]["_id"],
  sourceUrl: "https://tiktok.com/@x/video/1",
  category: "food",
  status: "done",
  archived: false,
  extractedData: null,
  thumbnailUrl: null,
  ...overrides,
});

test("food: OK place → 1 point with sub_label=cuisine", () => {
  const points = flattenToPoints([
    baseItem({
      category: "food",
      extractedData: {
        name: "Jay Fai",
        cuisine: "Thai street food",
        place: { lat: 13.75, lng: 100.5, geocoder_status: "OK" },
      },
    }),
  ]);
  expect(points).toHaveLength(1);
  expect(points[0]).toMatchObject({
    point_id: "it_1",
    name: "Jay Fai",
    category: "food",
    sub_label: "Thai street food",
    lat: 13.75,
    lng: 100.5,
  });
});

test("food: failed geocoding → 0 points", () => {
  const points = flattenToPoints([
    baseItem({
      category: "food",
      extractedData: {
        name: "X",
        place: { geocoder_status: "ZERO_RESULTS" },
      },
    }),
  ]);
  expect(points).toHaveLength(0);
});

test("travel: multi-stop itinerary emits one point per OK stop with sub_label=type", () => {
  const points = flattenToPoints([
    baseItem({
      _id: "it_2" as unknown as FlattenInput[number]["_id"],
      category: "travel",
      extractedData: {
        title: "Tokyo",
        itinerary: [
          { order: 1, name: "Senso-ji", type: "attraction", place: { lat: 35.7, lng: 139.8, geocoder_status: "OK" } },
          { order: 2, name: "Shibuya", type: "neighborhood", place: { geocoder_status: "ZERO_RESULTS" } },
          { order: 3, name: "Afuri", type: "restaurant", place: { lat: 35.66, lng: 139.71, geocoder_status: "OK" } },
        ],
      },
    }),
  ]);
  expect(points).toHaveLength(2);
  expect(points[0]).toMatchObject({
    point_id: "it_2:1",
    item_id: "it_2",
    name: "Senso-ji",
    category: "travel",
    sub_label: "attraction",
  });
  expect(points[1]).toMatchObject({
    point_id: "it_2:3",
    name: "Afuri",
    sub_label: "restaurant",
  });
});

test("archived items are excluded", () => {
  const points = flattenToPoints([
    baseItem({
      archived: true,
      extractedData: {
        name: "X",
        place: { lat: 1, lng: 2, geocoder_status: "OK" },
      },
    }),
  ]);
  expect(points).toHaveLength(0);
});

test("non-done items are excluded", () => {
  const points = flattenToPoints([
    baseItem({
      status: "processing",
      extractedData: { name: "X", place: { lat: 1, lng: 2, geocoder_status: "OK" } },
    }),
  ]);
  expect(points).toHaveLength(0);
});

test("null extractedData → 0 points", () => {
  const points = flattenToPoints([baseItem({ extractedData: null })]);
  expect(points).toHaveLength(0);
});
