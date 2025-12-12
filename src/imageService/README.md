# Image Service

This module handles fetching images based on keywords extracted from ChatGPT responses using a cascade approach across multiple image providers.

## Structure

- **`types.ts`** - Type definitions for image service responses and processed articles
- **`api.ts`** - Main API entry point for fetching images
- **`getArticleImage.ts`** - Cascade logic that tries multiple providers in sequence
- **`orchestrator.ts`** - Orchestrates the flow of parsing ChatGPT response, fetching images, and merging results
- **`providers/`** - Individual image provider implementations:
  - `pexels.ts` - Pexels API provider
  - `pixabay.ts` - Pixabay API provider
- **`index.ts`** - Main entry point, exports all public functions and types

## Cascade Flow

The image search uses a simple cascade approach:

1. Try **Pexels** first
2. Fallback to **Pixabay** if Pexels fails

## Environment Variables

Add to your `.env` file:

```env
PEXELS_API_KEY=your_pexels_key_here
PIXABAY_API_KEY=your_pixabay_key_here
```

## Final Object Structure

The processed article will have:

- `title` - From ChatGPT
- `excerpt` - From ChatGPT
- `category` - From original article
- `body` - From ChatGPT
- `imageKeyword` - From ChatGPT
- `image` - ImageResult object containing:
  - `url` - Full-resolution image URL
  - `thumbUrl` - Thumbnail URL
  - `width` / `height` - Image dimensions
  - `authorName` - Photographer/creator name
  - `authorUrl` - Link to creator's profile
  - `source` - Provider name ("pexels" | "pixabay")
  - `sourcePageUrl` - Link to image page on provider site
  - `license` - License information (e.g., "Pexels License", "CC BY 4.0")

## Usage

The image service is automatically called when processing articles through ChatGPT middleware. The orchestrator handles:

1. Parsing ChatGPT JSON response
2. Extracting `imageKeyword`
3. Calling cascade image search
4. Merging image data with article data
