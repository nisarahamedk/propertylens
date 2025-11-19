# PropertyLens

A multi-modal property video search application that enables natural language search across property video walkthroughs. Instead of keyword-based searches, describe what you're looking for (e.g., "modern kitchen with island", "backyard with mature trees") and PropertyLens finds relevant moments in property videos.

## Features

- **Semantic Search** - Natural language queries across video transcripts and visual content
- **Multi-Source Video Player** - Intelligent fallback between Ragie streams, YouTube, and HTML5 video
- **Transcript Sync** - Auto-scrolling transcript with clickable timestamps for navigation
- **AI-Powered Chat** - Follow-up questions with grounded responses from video context
- **Property Index** - Browse recently indexed properties with detailed metadata
- **Neo-Brutalist Design** - Bold, high-contrast UI with custom animations

## Tech Stack

- **Frontend**: React 19, TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS
- **AI/Search**: Ragie SDK (multi-modal search and retrieval)
- **Video**: YouTube IFrame API, HTML5 Video

## Project Structure

```
propertylens/
├── App.tsx                 # Root component with view state management
├── index.tsx               # React entry point
├── types.ts                # TypeScript interfaces
├── views/                  # Page-level components
│   ├── LandingView.tsx     # Home page with search and property grid
│   ├── ResultsView.tsx     # Search results listing
│   └── PlayerView.tsx      # Video player with transcript and chat
├── components/             # Reusable UI components
│   ├── SearchBar.tsx
│   ├── ResultCard.tsx
│   ├── PropertyThumbnail.tsx
│   ├── VideoPlayer.tsx
│   └── ui/                 # Icons and skeleton loaders
└── services/               # Business logic and API integration
    ├── searchService.ts    # Main search orchestrator
    ├── RealRagieClient.ts  # Production Ragie API client
    ├── MockRagieClient.ts  # Mock client for development
    └── mockData.ts         # Sample property data
```

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/nisarahamedk/propertylens.git
cd propertylens

# Install dependencies
npm install
```

### Configuration

Create a `.env.local` file with your API key:

```env
RAGIE_API_KEY=your_ragie_api_key_here
```

### Development

```bash
# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

The app uses a service layer pattern with dependency injection:

- **Views** handle page-level state and layout
- **Components** are reusable UI elements
- **Services** manage API calls and business logic
- **Mock/Real clients** can be swapped via configuration flag

### Data Flow

```
Landing → Search → Results → Player
   ↑                           ↓
   └──── Back Navigation ──────┘
```

## API Integration

PropertyLens integrates with the Ragie platform for:

- **Document indexing** - Store and retrieve property video data
- **Semantic search** - Multi-modal search across transcripts and visuals
- **Grounded generation** - AI responses based on video content

## Design System

- **Colors**: Cream, Charcoal, Terracotta, Olive, Sage
- **Typography**: Space Grotesk (display), Work Sans (body), Space Mono (mono)
- **Style**: Neo-brutalist with hard shadows and bold borders

## License

MIT
