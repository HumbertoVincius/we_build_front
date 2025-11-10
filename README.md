# Supabase Agents Observatory

Monitor the flow of a multi-agent code generation pipeline, including messaging logs and generated artefacts.

## Setup

1. Install dependencies (requires Node.js 18+)
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Run the dev server
   ```bash
   npm run dev
   ```

## Tech Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase JS SDK
- React Syntax Highlighter for code previews
- Custom JSON explorer component

