# Toolbox

A collection of web-based tools for HPC (High-Performance Computing) cluster management, currently featuring a Slurm cluster dashboard.

## Projects

### [slurm-dashboard/](slurm-dashboard/) — Slurm Cluster Dashboard

A modern single-page application for visualizing Slurm cluster status. Paste the output of a combined `scontrol`/`squeue`/`sacct` command and get an interactive breakdown of your cluster.

- **Stack:** React 19, TypeScript, Vite 7, Tailwind CSS 4
- **Features:** Partition overview, per-node resource bars (CPU/memory/GPU), job queue with expandable details, job history with filtering, timezone-aware relative timestamps, GRES/TRES parsing
- **Testing:** Vitest + React Testing Library (28+ tests covering parsing, rendering, and interaction)

## Usage

The dashboard parses the output of this combined Slurm command:

```bash
scontrol show partition --oneliner; echo "---"; \
scontrol show node --oneliner; echo "---"; \
squeue --all -o "%.18i %.9P %.30j %.8u %.8T %.10M %.10l %.6D %R"; echo "---"; \
scontrol show job --oneliner; echo "---"; \
sacct -a --starttime "now-1day" --parsable2 \
  --format=JobID,JobName,User,Partition,State,Start,End,Elapsed,ReqMem,ReqCPUS,ReqTRES; \
echo "---"; date --iso-8601=seconds
```

Run it on your cluster, copy the output, and paste it into the dashboard.

## Development

```bash
cd slurm-dashboard
npm install
npm run dev          # Dev server with HMR
npm run test:run     # Run tests
npm run build        # Production build → dist/
npm run lint         # ESLint
```

## Deployment

GitHub Actions automatically builds and deploys to GitHub Pages on push to `main`. The dashboard is served at `/slurm-dashboard/`.

## Adding a New Project

1. Create a directory at the repo root.
2. For Node.js projects: add the directory name to `NODE_PROJECTS` in `.github/workflows/pages.yml` and ensure the build outputs to `dist/`.
3. For static projects: add the directory name to `STATIC_PROJECTS` in the same workflow.
