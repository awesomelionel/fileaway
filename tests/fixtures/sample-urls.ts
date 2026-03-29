/**
 * Sample URLs for testing platform detection and scraping
 */

export const SAMPLE_URLS = {
  tiktok: [
    'https://www.tiktok.com/@chef_john/video/1234567890123456789',
    'https://tiktok.com/@fitnessguru/video/9876543210987654321',
    'https://vm.tiktok.com/ZMRkxxxxxxx/',
  ],
  instagram: [
    'https://www.instagram.com/p/ABC123def456/',
    'https://instagram.com/p/XYZ789uvw012/',
    'https://www.instagram.com/reel/ABC123def456/',
  ],
  youtube: [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
  ],
  twitter: [
    'https://twitter.com/user/status/1234567890123456789',
    'https://x.com/user/status/1234567890123456789',
  ],
  other: [
    'https://example.com/blog/recipe',
    'https://github.com/user/repo',
  ],
  invalid: [
    'not-a-url',
    'ftp://invalid-protocol.com',
    '',
  ],
};

export const SAMPLE_SCRAPE_RESULTS = {
  tiktok: {
    platform: 'tiktok' as const,
    title: 'Quick 5-Minute Recipe',
    description: 'Learn how to make this amazing dish in just 5 minutes!',
    videoUrl: 'https://v.tiktok.com/video123',
    thumbnailUrl: 'https://thumb.tiktok.com/123.jpg',
    authorName: 'Chef John',
    authorHandle: 'chef_john',
    likeCount: 5000,
    viewCount: 50000,
    hashtags: ['recipe', 'cooking', 'food'],
    transcript: 'First, gather your ingredients...',
    metadata: {
      videoUrl: 'https://v.tiktok.com/video123',
      authorMeta: { name: 'Chef John', nickName: 'chef_john' },
      diggCount: 5000,
      playCount: 50000,
      hashtags: [{ name: 'recipe' }, { name: 'cooking' }, { name: 'food' }],
    },
  },
  instagram: {
    platform: 'instagram' as const,
    title: 'Morning Yoga Routine',
    description: 'Start your day with this energizing 20-minute yoga session! #yoga #fitness',
    videoUrl: 'https://v.instagram.com/reel123',
    thumbnailUrl: 'https://thumb.instagram.com/123.jpg',
    authorName: 'Yoga Master',
    authorHandle: 'yogamaster',
    likeCount: 2000,
    viewCount: 15000,
    hashtags: ['yoga', 'fitness', 'wellness'],
    metadata: {
      caption: 'Morning Yoga Routine',
      ownerFullName: 'Yoga Master',
      ownerUsername: 'yogamaster',
      likesCount: 2000,
      videoViewCount: 15000,
      hashtags: ['yoga', 'fitness', 'wellness'],
    },
  },
};

export const SAMPLE_CATEGORIES = {
  food: 'food' as const,
  recipe: 'recipe' as const,
  fitness: 'fitness' as const,
  howTo: 'how-to' as const,
  videoAnalysis: 'video-analysis' as const,
  other: 'other' as const,
};

export const SAMPLE_EXTRACTION_RESULTS = {
  food: {
    category: 'food' as const,
    extractedData: {
      name: 'Famous Pizza Place',
      address: '123 Main St, New York, NY',
      cuisine: 'Italian',
      why_visit: 'Authentic wood-fired pizza with fresh ingredients',
      price_range: '$$',
      dishes_mentioned: ['Margherita Pizza', 'Tiramisu'],
    },
    actionTaken: 'Save to Google Maps',
    confidence: 0.95,
  },
  recipe: {
    category: 'recipe' as const,
    extractedData: {
      dish_name: 'Chocolate Chip Cookies',
      ingredients: [
        '2 cups flour',
        '1 cup butter',
        '3/4 cup sugar',
        '2 eggs',
        '1 tsp vanilla',
        '2 cups chocolate chips',
      ],
      steps: [
        'Preheat oven to 375°F',
        'Mix butter and sugar',
        'Add eggs and vanilla',
        'Fold in flour',
        'Add chocolate chips',
        'Bake for 10-12 minutes',
      ],
      prep_time_minutes: 15,
      cook_time_minutes: 12,
      servings: 24,
    },
    actionTaken: 'Export ingredient list',
    confidence: 0.92,
  },
  fitness: {
    category: 'fitness' as const,
    extractedData: {
      workout_name: 'Full Body HIIT',
      exercises: [
        { name: 'Burpees', sets: 3, reps: 10 },
        { name: 'Mountain Climbers', sets: 3, reps: 20 },
        { name: 'Push-ups', sets: 3, reps: 15 },
        { name: 'Squats', sets: 3, reps: 20 },
      ],
      muscle_groups: ['chest', 'legs', 'core', 'shoulders'],
      duration_minutes: 30,
      difficulty: 'intermediate',
    },
    actionTaken: 'Add to my routine',
    confidence: 0.88,
  },
};
