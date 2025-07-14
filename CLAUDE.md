# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Architecture

This repository contains multiple web projects for Slurm cluster management and visualization:

### Projects Structure
- **slurm-dashboard/**: Modern React + TypeScript + Vite application for Slurm cluster visualization
- **slurm/**: Standalone HTML dashboard with embedded JavaScript for Slurm cluster management

### Project Types
The repository supports two types of web projects:
1. **Node.js Projects**: Directories containing `package.json` files (built with npm)
2. **Static Projects**: Directories containing HTML files (deployed as-is)

## Development Commands

### slurm-dashboard (React Project)
```bash
cd slurm-dashboard
npm install          # Install dependencies
npm run dev          # Start development server
npm run build        # Build for production (outputs to dist/)
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Building All Projects
The GitHub Actions workflow automatically builds all projects:
- Node.js projects are built using `npm ci && npm run build`
- Static projects are copied directly to deployment
- Built files are deployed to GitHub Pages at corresponding paths

## Code Architecture

### slurm-dashboard Architecture
- **Single Page Application**: React-based dashboard with TypeScript
- **Styling**: Tailwind CSS with Vite plugin integration
- **State Management**: React hooks (useState, useEffect, useMemo, useCallback)
- **Data Flow**: 
  - Input parsing → Data transformation → Component rendering
  - Slurm command output parsing into structured data objects
  - Real-time visualization of cluster status

### Core Data Structures
```typescript
interface SlurmData {
    partitions: Map<string, { nodes: Set<string>; details: Record<string, string> }>;
    nodes: Map<string, { details: Record<string, string> }>;
    queue: any[];
    history: any[];
    clusterDate: string | null;
    detectedTimezone: string | null;
}
```

### Key Components
- **Parsing Logic**: Functions to parse Slurm command outputs (scontrol, squeue, sacct)
- **Visualization Components**: React components for partitions, nodes, job queue, and history
- **Resource Management**: GRES (GPU/special resources) parsing and display
- **Time Handling**: Timezone-aware relative time calculations

### Static HTML Dashboard
- **Self-contained**: Single HTML file with embedded CSS and JavaScript
- **Vanilla JavaScript**: No external dependencies
- **Similar functionality**: Parses same Slurm commands as React version
- **AI Integration**: Optional AI summarization features

## Configuration

### Environment Variables (GitHub Actions)
```yaml
env:
  NODE_PROJECTS: "slurm-dashboard"    # Space-separated list of Node.js projects
  STATIC_PROJECTS: "slurm"            # Space-separated list of static projects
```

### Build Configuration
- **Vite**: Modern build tool with React and Tailwind plugins
- **TypeScript**: Strict type checking with project references
- **ESLint**: Code linting with React-specific rules

## Development Guidelines

### Adding New Projects
1. Create project directory
2. For Node.js projects: Add project name to `NODE_PROJECTS` in `.github/workflows/pages.yml`
3. For static projects: Add project name to `STATIC_PROJECTS` in workflow
4. Ensure build outputs to `dist/` or `build/` directory for Node.js projects

### Code Standards
- Use TypeScript for type safety
- Follow React hooks patterns
- Implement proper error handling for parsing
- Use Tailwind for consistent styling
- Pin GitHub Actions to specific commit SHAs (not version tags)

### Slurm Command Integration
The dashboards parse output from this combined command:
```bash
scontrol show partition --oneliner; echo "---"; scontrol show node --oneliner; echo "---"; squeue --all -o "%.18i %.9P %.30j %.8u %.8T %.10M %.10l %.6D %R"; echo "---"; scontrol show job --oneliner; echo "---"; sacct -a --starttime "now-1day" --parsable2 --format=JobID,JobName,User,Partition,State,Start,End,Elapsed,ReqMem,ReqCPUS,ReqTRES; echo "---"; date --iso-8601=seconds
```

## Cursor Rules Integration

### General Development
- Do not ask for confirmation when making changes
- Proceed directly with implementation and validate each change

### GitHub Actions
- Always pin actions to specific commit SHAs instead of version tags
- Use latest release SHAs, not pre-release or dev commits
- Use web search to find latest releases when adding new actions

## Deployment

### GitHub Pages
- Automated deployment via GitHub Actions
- Each project deployed to its own path (e.g., `/slurm-dashboard/`, `/slurm/`)
- No manual index page generation - projects are self-contained
- Static files copied directly, React apps built and deployed from `dist/`

### Local Development
- Use `npm run dev` for hot reloading during development
- Use `npm run preview` to test production builds locally
- No special server requirements - static hosting compatible