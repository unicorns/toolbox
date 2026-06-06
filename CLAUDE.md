# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Architecture

This repository contains web projects for Slurm cluster management and visualization:

### Projects Structure
- **slurm-dashboard/**: Modern React + TypeScript + Vite application for Slurm cluster visualization

### Project Types
The repository supports two types of web projects:
1. **Node.js Projects**: Directories containing `package.json` files (built with npm)
2. **Static Projects**: Directories containing HTML files (deployed as-is; none currently)

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
- **Single Page Application**: React-based dashboard with TypeScript; paste-based input, all data ephemeral (no persistence)
- **Styling**: Tailwind CSS 4 (CSS-first config in `src/index.css`), IBM Plex Sans/Mono via @fontsource, shared style constants in `src/components/theme.ts`
- **State Management**: React hooks (useState, useEffect, useMemo, useCallback); no router or state library
- **Layer split**:
  - `src/parsing.ts` — Slurm output parsing (scontrol, squeue, sacct) into `SlurmData`
  - `src/insights.ts` — pure compute: per-partition capacity (free GPUs/CPUs/mem over *schedulable* nodes), node schedulability/health classification, per-user usage aggregation, queue/history stats, node-name trimming
  - `src/components/` — TopBar, InputPanel, CapacityCards, NodeHeatmap, NodeDetail, UserUsage, QueueTab, HistoryTab, JobDetails, plus theme.ts/ui.tsx primitives
  - `src/App.tsx` — state + tab shell only (Overview / Queue / History)

### Core Data Structures
See `src/types.ts`: `SlurmData` (parsed input), `PartitionCapacity`/`ClusterTotals` (capacity math), `UserUsage`, `QueueStats`, `HistoryStateCount`.

### Capacity Semantics
- A node contributes *free* capacity only if schedulable: its `State` has no segment starting with DOWN/DRAIN/FAIL/MAINT/INVAL/NOT_RESPONDING/POWER/RESERVED/PLANNED
- Unhealthy (DOWN/DRAIN/FAIL/MAINT/INVAL/NOT_RESPONDING) nodes are listed under ⚠ unavailable with their `Reason`
- RESERVED/PLANNED/POWER* nodes are healthy but unobtainable: excluded from free counts and rendered gray (not green) in the heatmap

## Configuration

### Environment Variables (GitHub Actions)
```yaml
env:
  NODE_PROJECTS: "slurm-dashboard"    # Space-separated list of Node.js projects
  STATIC_PROJECTS: ""                 # Space-separated list of static projects
```

### Build Configuration
- **Vite**: Modern build tool with React and Tailwind plugins, configured with `base: './'` for subdirectory deployment
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
The dashboard parses output from this combined command (defined as `SLURM_COMMAND` in `src/parsing.ts`):
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
- Each project deployed to its own path (e.g., `/slurm-dashboard/`)
- No manual index page generation - projects are self-contained
- Static files copied directly, React apps built and deployed from `dist/`

### Local Development
- Use `npm run dev` for hot reloading during development
- Use `npm run preview` to test production builds locally
- No special server requirements - static hosting compatible