Param()
$ErrorActionPreference = "Stop"

# Enable corepack and pnpm
corepack enable | Out-Null
corepack prepare pnpm@latest --activate | Out-Null

# Create Next app if missing
if (-not (Test-Path "apps/web")) { New-Item -ItemType Directory -Path apps/web | Out-Null }
if (-not (Get-ChildItem "apps/web")) {
  pnpm create next-app@latest apps/web --typescript --eslint --tailwind --app --src-dir --import-alias "@/*"
  Push-Location apps/web
  pnpm add @tanstack/react-query zustand zod @hookform/resolvers react-hook-form @radix-ui/react-scroll-area monaco-editor @monaco-editor/react xterm xterm-addon-fit clsx tailwind-merge lucide-react framer-motion
  npx shadcn@latest init -y
  Pop-Location
}

# Python venv
if (-not (Test-Path "apps/api/.venv")) {
  python -m venv apps/api/.venv
}

Write-Host "Bootstrap complete. See README.md for run commands."
