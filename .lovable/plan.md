
# WanderSculpt AI — Detailed Project Breakdown

This is an informational walkthrough, not an implementation plan. Nothing will change in the codebase when approved.

---

## 1. Tech Stack at a Glance

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + TypeScript + Vite |
| Styling / UI | Tailwind CSS + shadcn/ui (Radix primitives) |
| Routing | react-router-dom |
| Data fetching / cache | TanStack Query (React Query) |
| Forms / validation | react-hook-form + zod |
| Charts | Recharts |
| Backend / DB / Auth | Lovable Cloud (Supabase: Postgres, Auth, Edge Functions) |
| Server runtime | Deno (Supabase Edge Functions) |
| AI | Lovable AI Gateway (Gemini / GPT models via `LOVABLE_API_KEY`) + LLaMA |
| Payments | Stripe (Checkout + Customer Portal + Webhooks) |
| Maps | Google Maps JS API |
| Weather | OpenWeather API |
| Place verification / web search | You.com API |
| Images | Unsplash API |

---

## 2. Application Shell (`src/App.tsx`, `src/main.tsx`)

- `main.tsx` mounts `<App />` into the DOM.
- `App.tsx` sets up four global providers in this order:
  1. `QueryClientProvider` — TanStack Query cache (5 min staleTime, 30 min gcTime).
  2. `AuthProvider` — Supabase session/user state.
  3. `TooltipProvider` — shadcn tooltip context.
  4. `BrowserRouter` — client-side routing.
- Two global toasters (`Toaster`, `Sonner`) and a `FloatingChatButton` (AI travel assistant) sit above the routes.
- Critical routes (`Index`, `Auth`) are eager-loaded; the rest are `React.lazy` with a `Suspense` skeleton fallback to keep the initial bundle small.

### Routes

```text
/                       Landing page (Index)
/auth                   Sign in / sign up
/terms                  Terms of service
/share/:token           Public read-only itinerary (no auth)
/app                    Dashboard                  (protected)
/app/new                Trip creation wizard       (protected)
/app/trip/:id           Trip detail (timeline)     (protected)
/app/trip/:id/compare   Side-by-side option compare (protected)
/app/trip/:id/map       Map view                   (protected)
/billing                Stripe billing             (protected)
/debug-rls              RLS debug page             (dev only)
```

`ProtectedRoute` reads `useAuth()` and redirects to `/auth` when there is no session.

---

## 3. Authentication (`src/contexts/AuthContext.tsx`)

- Wraps the Supabase JS client and exposes `user`, `session`, `loading`, `signUp`, `signIn`, `signOut`.
- On mount it calls `supabase.auth.getSession()` and subscribes to `onAuthStateChange` so the rest of the app re-renders when auth state changes.
- The Supabase client itself lives in `src/integrations/supabase/client.ts` (auto-generated — never edited).
- A Postgres trigger (`handle_new_user`) auto-creates a `profiles` row, a `preferences` row, and a default `user_roles` row whenever a new auth user is created.
- Roles are stored in a separate `user_roles` table and checked via the `has_role(uuid, app_role)` SECURITY DEFINER function — used to avoid RLS recursion and to mark admins (e.g. unlimited generations).

---

## 4. Landing Page (`src/pages/Index.tsx` + `src/components/landing/*`)

Composed of focused sections:
- `HeroSection` — headline + primary CTA.
- `HowItWorks` — 3-step illustration.
- `Features` — AI itineraries, budget, verification, packing.
- `SampleItinerary` — preview card.
- `TrustSafety` — privacy / safety blurb.
- `CTASection` + `Footer`.

Dark theme, semantic Tailwind tokens defined in `src/index.css`.

---

## 5. Trip Creation Wizard (`src/pages/NewTrip.tsx`)

A multi-step form that captures:
1. Destination.
2. Travel type (family vs solo/group, traveler counts).
3. Budget (INR) + style (luxury / mid-range / budget).
4. Food preference + diet.
5. Interests (multi-select).
6. Pace (relaxed / moderate / packed).
7. Date range.
8. Notes.

Each step writes to a `trips` row (status = `collecting` → `draft`) and individual answers to `trip_answers`. On submit it calls the `generate-itinerary` edge function.

---

## 6. Trip Detail Page (`src/pages/TripDetail.tsx`)

The most complex screen. It:
- Loads trip + itineraries via `useTripData` (TanStack Query).
- Tabs across itinerary options (A / B / C).
- Renders day-by-day `TimelineDay` → `TimelineBlock` → `ActivityCard`.
- Right sidebar (desktop) / bottom sheet (mobile) shows `TripQuickStats` — countdown, total activities, duration, budget progress, food vs activities split, average daily cost, verified places count.
- Other panels: `TripSettings` (slide-out), `TripMap` (mini map), `WeatherForecast`, `PackingList`, `ExportCalendar` (.ics), `CopilotDrawer` (natural-language edits), `ReplaceActivityModal`, `VerificationBadge`.

### Supporting hooks

- `useTripData` — fetches trip, itinerary, items, verifications.
- `useTripActions` — wraps mutations (swap activity, copilot edit, regenerate, share).
- `useUserQuota` — calls `get_user_quota` RPC and powers `UsageBadge` + `QuotaExceededModal`.
- `useTravelChat` — chat history + streaming for the floating assistant.

### Helper libs

- `lib/budget-calculator.ts` — sums item costs into a budget summary.
- `lib/itinerary-adapter.ts` — normalizes AI JSON into UI-friendly shapes.
- `lib/format-activity.ts` — display helpers (time block, cost range, badges).

---

## 7. Backend — Supabase Edge Functions (`supabase/functions/*`)

Each function lives in its own `index.ts`, uses Deno, validates input with zod, and reads secrets via `Deno.env.get()`.

| Function | Purpose |
|---|---|
| `generate-itinerary` | Reads a trip, prompts AI for 2–3 day-by-day options, writes `itineraries` + `itinerary_days` + `itinerary_items`. |
| `enrich-destination` | AI-generated attractions + food spots → `destination_facts`. |
| `enrich-itinerary` | Adds tips / disclaimers / pros-cons to an existing itinerary. |
| `activity-alternatives` | AI suggests 3–4 swap candidates for a slot. |
| `activity-swap` | Performs the swap, logs to `itinerary_edits_log`. |
| `copilot-edit` | Natural-language itinerary edits. |
| `verify-place` / `verify-trip-places` | You.com search → `place_verifications` + `itinerary_item_facts`. |
| `get-maps-key` | Returns Google Maps key for the frontend. |
| `get-weather` | OpenWeather forecast for trip dates. |
| `unsplash-photos` | Destination photo search (currently unused after the Quick Stats swap). |
| `travel-assistant` | Chat-style AI Q&A. |
| `trip-flow` | Step orchestration helpers. |
| `you-search` | Cached web search via You.com. |
| `stripe-create-checkout` / `stripe-create-portal` / `stripe-webhook` | Stripe subscription flow. |

Shared utilities live under `supabase/functions/_shared/`:
- `auth.ts` — extracts user from JWT via `supabase.auth.getClaims()`.
- `supabase-client.ts` — server-side client factories.
- `ai-client.ts` — Lovable AI Gateway wrapper.
- `response.ts`, `validation.ts` — CORS + zod helpers.

---

## 8. Database (Postgres)

Core tables (all in `public`, RLS enabled, GRANTed appropriately):

- `profiles` — name, email, plan, Stripe IDs, usage counters. Column-level revokes restrict Stripe/billing fields to service_role.
- `user_roles` — role assignments; checked through `has_role()`.
- `preferences` — per-user defaults.
- `terms_acceptance` — version tracking for forced modal.
- `trips` — main trip record (destination, dates, travelers, budget, status, share_token).
- `trip_answers` — per-question wizard answers.
- `trip_settings`, `trip_collaborators`, `trip_share_tokens`, `trip_reminders`, `trip_places`.
- `itineraries` — generated options (days JSON, summary, pros/cons, scores).
- `itinerary_days`, `itinerary_items`, `itinerary_item_facts`, `itinerary_edits_log` — normalized view of the JSON.
- `destination_facts` — AI-enriched destination knowledge.
- `place_verifications` — You.com verification results.
- `trip_chat_threads`, `trip_chat_messages`, `trip_messages` — assistant history.
- `generation_events`, `rate_limits` — quota + audit.
- `you_search_cache`, `you_search_rate_limits` — backend-only search cache (service_role only).

### Important functions

- `handle_new_user()` — trigger that bootstraps profile/preferences/role on signup.
- `has_role(uuid, app_role)` — recursion-safe role check.
- `get_user_quota(uuid)` — returns plan, used, remaining, period window; treats admins as unlimited.
- `increment_lifetime_generations`, `increment_period_generations` — atomic counter bumps.
- `get_shared_trip(text)`, `get_shared_itinerary(text)` — public read access via share token (SECURITY DEFINER, no auth required).

---

## 9. Quotas, Billing & Roles

- Free plan: 1 lifetime generation; Pro plan: 10 per billing period; admins: unlimited.
- `UsageBadge` shows remaining; `QuotaExceededModal` blocks further generation.
- `/billing` shows status and links to Stripe Checkout (`stripe-create-checkout`) and the Customer Portal (`stripe-create-portal`).
- `stripe-webhook` updates `profiles` on `checkout.session.completed`, `customer.subscription.updated|deleted`, and `invoice.payment_succeeded` (resets `period_generations_used`).

---

## 10. Public Sharing (`/share/:token`)

- Trip owner toggles sharing in `TripSettings`, which inserts into `trip_share_tokens`.
- `ShareTrip` page calls the SECURITY DEFINER RPCs above to render a read-only itinerary with no auth.

---

## 11. AI Travel Assistant

- `FloatingChatButton` opens `TravelAssistant`.
- `useTravelChat` posts to the `travel-assistant` edge function, which calls the Lovable AI Gateway with a travel-expert system prompt.
- Threads + messages persist in `trip_chat_threads` / `trip_chat_messages`.

---

## 12. End-to-End Data Flow

```text
User → React page → TanStack Query
   → supabase.functions.invoke('xxx')
   → Edge Function (Deno)
      → validate JWT (getClaims)
      → validate input (zod)
      → call AI Gateway / Google / OpenWeather / You.com / Stripe
      → write to Postgres (RLS-aware service-role client)
   → response → React Query cache → UI re-render
```

---

## 13. Cross-Cutting Concerns

- **Design tokens**: all colors/gradients/shadows defined in `src/index.css` and `tailwind.config.ts`; components never hardcode raw colors.
- **Security**: RLS on every public table; role checks via `has_role`; sensitive columns column-revoked; secrets stored via Lovable Cloud secrets (`STRIPE_*`, `LOVABLE_API_KEY`, `GOOGLE_MAPS_API_KEY`, `OPENWEATHER_API_KEY`, `UNSPLASH_ACCESS_KEY`, `YOU_API_KEY`).
- **Performance**: route-level code splitting, 5-min Query stale time, lazy edge function invocation, cached web search results.
- **DX**: `DebugRLS` page mounted only in dev; TypeScript everywhere; auto-generated Supabase types in `src/integrations/supabase/types.ts`.

---

If you'd like, I can follow up with a Mermaid architecture diagram or zoom into any specific area (e.g. the itinerary generation prompt, the budget calculator, or the Stripe webhook flow).
