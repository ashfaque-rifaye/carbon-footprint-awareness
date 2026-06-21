# Contributing

Thanks for your interest in CarbonSync! This is a PromptWars Challenge 3 submission,
but contributions and suggestions are welcome.

## Getting started

```bash
npm install
cp .env.example .env.local   # add your GEMINI_API_KEY (optional; falls back to rule-based)
npm run dev                  # http://localhost:3000
```

## Before opening a PR

All of these run in CI and must pass:

```bash
npm run format:check   # Prettier
npm run lint           # ESLint + tsc --noEmit
npm test               # Vitest
npm run build          # production build
```

`npm run format` will auto-fix formatting.

## Guidelines

- **TypeScript strict** is enforced — no `any`, no unused locals/params.
- Keep components small and single-responsibility; put pure logic in `src/lib/` and
  cover it with unit tests.
- Match the existing style (Prettier handles formatting automatically).
- Keep the repository to a **single branch** and under the challenge's size limit.

## Project layout

See the **Project structure** section in the [README](README.md#project-structure).
