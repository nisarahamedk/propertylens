
import { Property, SearchResult, VideoData } from '../types';

// Reliable fallback sample
const SAMPLE_VIDEO_URL = "https://assets.mixkit.co/videos/preview/mixkit-modern-living-room-interior-shot-3873-large.mp4";

// Using highly reliable, embeddable YouTube IDs for real estate tours
export const MOCK_PROPERTIES: Property[] = [
  {
    id: "p1",
    name: "742 Evergreen Terrace",
    address: "Springfield, IL",
    beds: 4,
    baths: 3,
    sqft: 2400,
    thumbnailUrl: "https://images.unsplash.com/photo-1600596542815-2495db98dada?auto=format&fit=crop&w=800&q=80",
    videoUrl: SAMPLE_VIDEO_URL,
    youtubeId: "T1l0H4-Q6Ag", // Modern House Tour
    description: "A beautiful family home with mature trees and a renovated kitchen."
  },
  {
    id: "p2",
    name: "1842 Oak Avenue",
    address: "Portland, OR",
    beds: 3,
    baths: 2,
    sqft: 1850,
    thumbnailUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
    videoUrl: SAMPLE_VIDEO_URL,
    youtubeId: "V-x5aH9x3m0", // Luxury Tour
    description: "Modern craftsman with open concept living and expansive decks."
  },
  {
    id: "p3",
    name: "The Lofts at 4th",
    address: "Seattle, WA",
    beds: 1,
    baths: 1,
    sqft: 950,
    thumbnailUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80",
    videoUrl: SAMPLE_VIDEO_URL,
    youtubeId: "0xIBqL06bKQ", // Loft Tour
    description: "Industrial chic loft in the heart of downtown with exposed brick."
  },
  {
    id: "p4",
    name: "Lakeside Cottage",
    address: "Lake Tahoe, NV",
    beds: 2,
    baths: 2,
    sqft: 1200,
    thumbnailUrl: "https://images.unsplash.com/photo-1449156493391-d2cfa28e468b?auto=format&fit=crop&w=800&q=80",
    videoUrl: SAMPLE_VIDEO_URL,
    youtubeId: "Lq5w2k1X7L8", // Cottage Tour
    description: "Cozy retreat steps from the water with a stone fireplace."
  }
];

export const MOCK_VIDEO_DATA: Record<string, VideoData> = {
  "p1": {
    propertyId: "p1",
    transcripts: [
      { timestamp: "0:45", timestampSeconds: 45, text: "Moving into the kitchen area, you can see the high-end finishes." },
      { timestamp: "0:52", timestampSeconds: 52, text: "We have these beautiful custom cabinets installed recently." },
      { timestamp: "0:58", timestampSeconds: 58, text: "You'll notice the spacious island, perfect for entertaining guests." },
      { timestamp: "1:10", timestampSeconds: 70, text: "And leading out to the patio, the sliding glass doors let in so much light." },
      { timestamp: "1:25", timestampSeconds: 85, text: "The master suite offers a private retreat with garden views." }
    ],
    moments: [
      { id: "m1", label: "Kitchen", timestamp: "0:45", timestampSeconds: 45 },
      { id: "m2", label: "Patio", timestamp: "1:10", timestampSeconds: 70 },
      { id: "m3", label: "Master Bed", timestamp: "2:00", timestampSeconds: 120 },
    ]
  },
  "p2": {
    propertyId: "p2",
    transcripts: [
      { timestamp: "0:30", timestampSeconds: 30, text: "Here we are in the main living space." },
      { timestamp: "0:38", timestampSeconds: 38, text: "The open floor plan flows seamlessly into the dining area." },
      { timestamp: "0:45", timestampSeconds: 45, text: "It really makes the home feel larger than it is." },
      { timestamp: "1:15", timestampSeconds: 75, text: "Check out this amazing deck space for outdoor living." }
    ],
    moments: [
      { id: "m1", label: "Living Room", timestamp: "0:30", timestampSeconds: 30 },
      { id: "m2", label: "Dining", timestamp: "0:38", timestampSeconds: 38 },
      { id: "m3", label: "Deck", timestamp: "1:15", timestampSeconds: 75 },
    ]
  },
  "p3": {
    propertyId: "p3",
    transcripts: [
      { timestamp: "0:20", timestampSeconds: 20, text: "The exposed brick walls give this place so much character." },
      { timestamp: "0:45", timestampSeconds: 45, text: "Look at these high ceilings and the industrial windows." },
      { timestamp: "1:30", timestampSeconds: 90, text: "The kitchen is compact but fully equipped for a chef." }
    ],
    moments: [
      { id: "m1", label: "Living Area", timestamp: "0:20", timestampSeconds: 20 },
      { id: "m2", label: "Windows", timestamp: "0:45", timestampSeconds: 45 },
      { id: "m3", label: "Kitchen", timestamp: "1:30", timestampSeconds: 90 },
    ]
  },
  "p4": {
    propertyId: "p4",
    transcripts: [
      { timestamp: "0:50", timestampSeconds: 50, text: "This stone fireplace is the heart of the cabin." },
      { timestamp: "1:20", timestampSeconds: 80, text: "Imagine cozying up here after a day on the lake." },
      { timestamp: "3:00", timestampSeconds: 180, text: "The views from this porch are simply breathtaking." }
    ],
    moments: [
      { id: "m1", label: "Fireplace", timestamp: "0:50", timestampSeconds: 50 },
      { id: "m2", label: "Bedroom", timestamp: "2:10", timestampSeconds: 130 },
      { id: "m3", label: "Lake View", timestamp: "3:00", timestampSeconds: 180 },
    ]
  }
};

export const generateMockResults = (query: string): SearchResult[] => {
  const q = query.toLowerCase();
  
  if (q.includes("kitchen") || q.includes("island") || q.includes("cooking")) {
    return [
      {
        id: "r1",
        property: MOCK_PROPERTIES[0],
        timestamp: "0:58",
        timestampSeconds: 58,
        transcriptSnippet: "...spacious island, perfect for entertaining guests...",
        visualMatchReason: "Kitchen island visible in frame",
        thumbnailUrl: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80"
      },
      {
        id: "r2",
        property: MOCK_PROPERTIES[2],
        timestamp: "1:30",
        timestampSeconds: 90,
        transcriptSnippet: "...kitchen is compact but fully equipped for a chef...",
        visualMatchReason: "Modern kitchen appliances detected",
        thumbnailUrl: "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=600&q=80"
      }
    ];
  }
  
  if (q.includes("yard") || q.includes("garden") || q.includes("tree") || q.includes("outside")) {
    return [
      {
        id: "r3",
        property: MOCK_PROPERTIES[0],
        timestamp: "1:10",
        timestampSeconds: 70,
        transcriptSnippet: "...leading out to the patio, sliding glass doors...",
        visualMatchReason: "Garden access and mature trees identified",
        thumbnailUrl: "https://images.unsplash.com/photo-1558036117-15db59cc3b92?auto=format&fit=crop&w=600&q=80"
      }
    ];
  }

  if (q.includes("modern") || q.includes("living") || q.includes("open")) {
      return [
        {
          id: "r4",
          property: MOCK_PROPERTIES[1],
          timestamp: "0:30",
          timestampSeconds: 30,
          transcriptSnippet: "...open floor plan flows seamlessly...",
          visualMatchReason: "Open concept architecture",
          thumbnailUrl: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=600&q=80"
        }
      ]
  }
  
  return [
    {
      id: "r1",
      property: MOCK_PROPERTIES[0],
      timestamp: "0:58",
      timestampSeconds: 58,
      transcriptSnippet: "...spacious island, perfect for entertaining guests...",
      visualMatchReason: "Kitchen island visible in frame",
      thumbnailUrl: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80"
    },
    {
      id: "r3",
      property: MOCK_PROPERTIES[3],
      timestamp: "3:00",
      timestampSeconds: 180,
      transcriptSnippet: "...views from this porch are simply breathtaking...",
      visualMatchReason: "Scenic exterior view identified",
      thumbnailUrl: "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=600&q=80"
    }
  ];
};
