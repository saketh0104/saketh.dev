# saketh.dev — Saketh Nandula · Portfolio

A single-page portfolio site for Saketh Nandula — AI Engineer (Backend & LLM
Systems). Live on Vercel:

**Live site:** https://sakethnandula.vercel.app/

> A custom domain (`saketh.dev`) is planned; the site is fully reachable on
> the Vercel URL above until DNS is configured.

---

## Design

The portfolio is built around a content-first, light single-page layout:

- **Sections:** Hero → About → Skills → Experience → Projects → Education →
  Certifications → Presence → Contact.
- **No build step, no framework runtime.** The site ships as a single
  `index.html` with hand-tuned CSS layers and vanilla JavaScript. Everything
  is progressively enhanced — content is visible with or without `js` or
  animation stylesheets.
- **Accessibility-first motion:** all animation respects `prefers-reduced-motion`
  and gracefully degrades if scripts fail to load.
- **Asset hygiene:** binary assets (favicon, images) live in Vercel Blob
  Storage instead of the repository, keeping the repo light and the HTML
  cacheable.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Markup | Semantic HTML5 in a single `index.html` |
| Styling | Tailwind CSS (v4, pre-compiled) + custom CSS files in `assets/css/` (main, animations, github-heatmap, presence, projects) |
| Motion | CSS keyframes + CSS custom-property tokens; `data-motion` / `data-step` / `data-hover` hooks; zero animation libraries |
| Scripting | Vanilla JavaScript (deferred, dependency-free) in `assets/js/` |
| Backend | Node.js Vercel serverless function: `/api/github-contributions` |
| Storage | Vercel Blob Storage (favicon and static assets) |
| Hosting | Vercel (static hosting + edge/serverless functions) |

### Serverless API

- **`/api/github-contributions`** — fetches Saketh's public GitHub
  contribution page server-side and normalizes it into a small JSON payload
  (totals, per-day `date/count/level`, month labels) that the client-side
  heatmap renders. No third-party proxy, no auth, no private data; 8s
  server-side timeout and HTTP `cache-control` caching.

### Configuration (`.env`)

Site constants are kept out of the HTML and read from environment variables:

`SITE_NAME`, `SITE_URL`, `OG_IMAGE`, `CONTACT_EMAIL`, `CONTACT_PHONE`,
`GITHUB_URL`, `LINKEDIN_URL`, `TWITTER_X_URL`, `RESUME_URL`,
`GEMINI_API_KEY` (reserved), plus Vercel Blob runtime vars.

> `.env*` files are git-ignored and are never committed. Secrets, especially
> `GEMINI_API_KEY`, are intended for server-side use only — never expose them
> in client-side code.

## Animations

Motion is implemented as a small, self-contained system — no libraries:

- CSS **tokens** for duration, easing, distance, and choreography stagger
  (e.g. `--motion-duration-normal: 320ms`, `--motion-ease-emphasized`,
  section stagger 60–110ms).
- `transform` + `opacity` keyframes only, driven by `data-motion` and
  `data-step` attributes with a fallback chain: reduced-motion → static and
  visible; missing `IntersectionObserver` → visible; JS error → visible.

Included effects (full spec in `MOTION_SPEC.md`):

1. Hero entrance choreography (staggered fade-up) and floating background blobs/shapes
2. "Hola!" wave and hero role/chip micro-interactions
3. Skill ticker / marquee and section heading entrances
4. Card hovers — skills, experience timeline, projects, certifications, contact
5. Resume CTA and social-icon micro-interactions
6. Mobile menu open/close with item stagger
7. Ambient pulse, light glass hover response, and scroll parallax
8. Reduced-motion and load/failure safety paths

## GitHub Contribution Heatmap

The Presence section embeds a real contribution heatmap. Data flows:

```
index.html (client) → fetch /api/github-contributions (Vercel) → github.com/users/saketh0104/contributions
      → normalized JSON → assets/js/github-heatmap.js → rendered grid
```

## Future Enhancements

- **AI-based Q&A assistant** — an interactive assistant on the portfolio that
  answers questions about Saketh's background, projects, and skills using
  Gemini, wired through a server-side/edge function so the API key never
  reaches the client. Model configuration is already reserved in `.env`.
- **LinkedIn & X (Twitter) post engagement** — automatic or semi-automatic
  posting of project releases and milestones to LinkedIn and X, so new work
  published on this site is announced on social profiles without manual
  effort.
- **Custom domain (`saketh.dev`) + OG image / canonical URL** once the domain
  is live.
- Restoring a **blog & feeds area** (removed to keep the launch page focused)
  with real articles and live activity.

## Running Locally

The frontend is static — open `index.html` in a browser or serve it:

```sh
# any static server works
npx serve .
```

To run the serverless endpoint locally, use the Vercel CLI:

```sh
npx vercel dev
```

The heatmap and API require a Vercel environment (the function runs server-side);
frontend-only previews will show the graceful fallback.

## Repository Layout

```
index.html                     Single-page site (HTML + inlined Tailwind CSS)
api/
  github-contributions.js      Vercel serverless function for the heatmap
assets/
  css/                         Hand-tuned stylesheets (main, animations, heatmap, presence, projects)
  js/                          Vanilla JS (main, github-heatmap)
.env                           Environment variables (SITE_*, CONTACT_*, URLs) — git-ignored, never committed
MOTION_SPEC.md                 Motion specification (all animation records)
MOTION_ARCHITECTURE.md         How the motion system is structured
```