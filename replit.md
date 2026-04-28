# Theme Customizer - Visual SCSS Editor

## Overview

A visual SCSS theme customizer application that allows users to create and customize CSS themes through an interactive interface. The application provides a split-screen layout with variable controls on the left and a live preview pane on the right, enabling rapid theme iteration with real-time feedback. Users can modify 200+ CSS variables including colors, fonts, sizes, and spacing, then export the generated CSS for use in their projects.

The themes the customizer produces and consumes follow the `beru-org/Assets`
baseStyles conventions. The authoritative rules — V6 vs V5 vs pre-V5 layouts,
variable taxonomy, `styles.xml` contract, V5→V6 migration steps, and what the
customizer must enforce — are captured in [`docs/theme-source-conventions.md`](docs/theme-source-conventions.md).
That document is the contract; when adding parsing, validation, export, or
conversion features, read it first.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: React Query (@tanstack/react-query) for server state, React useState/useCallback for local UI state
- **UI Components**: shadcn/ui component library built on Radix UI primitives with Tailwind CSS
- **Styling**: Tailwind CSS with CSS variables for theming, following a Material/Fluent Design hybrid approach

**Component Organization**:
- `/components/ui/` - Reusable shadcn/ui base components
- `/components/theme-customizer/` - Feature-specific components for the theme editor
- `/components/examples/` - Example usage components for documentation
- `/pages/` - Route-level page components

**Key Theme Customizer Components**:
- `ControlPanel` - Left panel with categorized variable controls and search
- `PreviewPane` - Right panel with live preview and device/zoom controls
- `ColorPicker` - Hex color picker using react-colorful
- `FontPicker`, `SizeInput`, `NumberInput`, `StringInput` - Type-specific input controls
- `ExportModal` - CSS export with copy/download functionality
- `ActionBar` - Reset and export action buttons with modification counter
- `CustomCssManager` - Manages user-supplied SCSS files. Each file has an
  optional `enabled` flag (treated as `true` when undefined). When set to
  `false`, the file is still written to `theme/custom/` in the export but
  its `@import` line in `theme.scss` is emitted as a comment (`// @import …`)
  and the live preview skips its content. V5 → V6 conversions default
  imported custom CSS files to `enabled: false`; the per-file toggle in the
  panel re-enables them. The V6 re-import path parses commented custom
  imports out of `theme.scss` so the disabled state round-trips.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints under `/api/` prefix
- **SCSS Processing**: Server-side SCSS parsing and compilation using the `sass` package

**Key API Endpoints** (defined in routes.ts):
- `POST /api/parse-scss` - Parse SCSS content and extract CSS variables
- `POST /api/compile-theme` - Compile modified variables back to CSS
- `GET /api/sample-scss` - Fetch sample SCSS files

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `/shared/schema.ts` - Shared between client and server
- **Current Schema**: Basic users table (id, username, password)
- **Storage Pattern**: Abstract `IStorage` interface with `MemStorage` in-memory implementation for development

### Build System
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: 
  - Client: Vite builds to `/dist/public`
  - Server: esbuild bundles server code to `/dist/index.cjs`
- **Build Script**: Custom `/script/build.ts` handles both builds with selective dependency bundling for cold start optimization

### Path Aliases
- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`
- `@assets/*` → `./attached_assets/*`

## External Dependencies

### Database
- **PostgreSQL**: Primary database (configured via `DATABASE_URL` environment variable)
- **Drizzle Kit**: Database migrations in `/migrations` directory
- **connect-pg-simple**: Session storage for Express (available but not currently used)

### UI/UX Libraries
- **Radix UI**: Full suite of accessible UI primitives (dialog, popover, accordion, tabs, etc.)
- **react-colorful**: Color picker component for theme color selection
- **react-resizable-panels**: Resizable split-screen layout
- **embla-carousel-react**: Carousel component
- **cmdk**: Command palette component
- **vaul**: Drawer component
- **react-day-picker**: Calendar/date picker

### Styling
- **Tailwind CSS**: Utility-first CSS framework with custom theme configuration
- **class-variance-authority**: Component variant management
- **tailwind-merge**: Intelligent class merging

### Form Handling
- **react-hook-form**: Form state management
- **@hookform/resolvers**: Form validation resolvers
- **zod**: Schema validation (integrated with drizzle-zod)

### Build Tools
- **Vite**: Frontend bundler with React plugin
- **esbuild**: Server bundler for production
- **tsx**: TypeScript execution for development
- **sass**: SCSS compilation on the server

### Replit-specific
- **@replit/vite-plugin-runtime-error-modal**: Error overlay in development
- **@replit/vite-plugin-cartographer**: Development tooling
- **@replit/vite-plugin-dev-banner**: Development environment indicator