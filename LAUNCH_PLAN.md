# 🚀 FAQBot — Launch Plan  
_Last updated: November 2025_

---

## 📍 Current Position

**Phase 4 complete** — Core app works end-to-end:

- ✅ Supabase schema & RLS policies verified  
- ✅ Embedding worker functional  
- ✅ `/api/chat` returns valid responses  
- ✅ Stripe test mode checkout + portal working  
- ✅ curl tests for `/lookup`, `/search`, `/chat`, `/billing` all pass  

Next: convert from a technical demo → production-ready SaaS with live payments, onboarding, and UI polish.

---

## 🧱 PHASE 5 — Productization & Cohesive UI

> Goal: Turn the backend into a usable, guided SaaS product.

- [ X] **AppShell + Navigation** — consistent sidebar, header, toasts  
- [ X] **Get Started checklist** — guided onboarding progress  
- [ X] **Upload UX & Job Poller** — progress bar + post-embed link  
- [ X] **Chat UI polish** — persistent history, citations, quota toasts
//also adjusted the api/chat so it dealt better with fake uploads. When I'm ready to deploy I need to disable these fake flags and call the OpenAI API key accordingly  
- [ X] **Widget Embed snippet** — one-click copy for client sites
//test widget logic included in the original logic if I need to find it.  
- [ X] **Billing UI polish** — plan display, usage bar, portal link  
//need to inspect the behaviour of billing/settings on the UI as it doesn't seeem to be currently gelling very well.
- [ X] **Quota alerts + Sentry** — email at 80% usage, error tracking 
//sort the vercel.envs at a later date with Phase 7 to ensure this is wired up correctly

**Target branch:** `feature/phase5-ui`  
**Outcome:** fully usable admin interface.

---

## 🌐 PHASE 6 — Production Deployment

> Goal: Migrate from local/test to a stable production environment.

- [ ] Create **Supabase Production Project** (`faqbot-prod`)  
- [ ] Configure **Vercel** project → add all `.env` vars  
- [ ] Swap **Stripe keys** to live mode (`sk_live_...`, `pk_live_...`)  
- [ ] Duplicate products/prices in Stripe → copy new `price_...` IDs  
- [ ] Swap **OpenAI key** to paid API key  
- [ ] Update **webhook endpoint** to live domain  
- [ ] Verify **RLS policies** still isolate org data  
- [ ] Add **custom domain** (`faqbot.app` or similar)

**Target branch:** `deploy/production`  
**Outcome:** live deployment, ready for real payments.

---

## 💳 PHASE 7 — Trial Control & Billing Enforcement

> Goal: Activate real subscription logic and trial gating.

- [ ] Add cron to expire trials (`trial_ends_at`)  
- [ ] Enforce quotas per plan (chat + upload limits)  
- [ ] Stripe checkout & portal redirect back to app  
- [ ] Display usage summary (e.g. “48 / 100 messages”)  
- [ ] Send trial reminder emails (Day −2, 0, +1) via Resend/SMTP2Go  

**Outcome:** customers self-upgrade; usage enforced.

---

## 💡 PHASE 8 — Marketing & Onboarding

> Goal: Attract signups and guide new users.

- [ ] Public landing page with pricing + CTA  
- [ ] Demo bot with pre-loaded docs  
- [ ] Welcome email after signup  
- [ ] `/help` docs or quick-start guide  
- [ ] Analytics: GA4 / PostHog  
- [ ] Privacy Policy + Terms pages  

**Outcome:** user acquisition funnel and clear documentation.

---

## 🧪 PHASE 9 — Private Beta

> Goal: Validate UX, performance, and billing.

- [ ] Invite 3–5 testers  
- [ ] Watch logs + Supabase job latency  
- [ ] Refine onboarding text & visuals  
- [ ] Verify checkout → portal → trial expiry loop  

**Outcome:** stable MVP ready for public users.

---

## 🌍 PHASE 10 — Public Launch

> Goal: Open to everyone and start selling.

- [ ] Switch all keys to **live mode** (Stripe + OpenAI)  
- [ ] Update marketing CTAs with live checkout links  
- [ ] Push announcement (Product Hunt, IndieHackers, LinkedIn)  
- [ ] Add support email or chat link  
- [ ] Track KPIs: signups, active orgs, revenue, usage  

**Outcome:** official go-live.

---

## 🔑 ENV & KEY MIGRATION REFERENCE

| System | Current | Live Target |
|---------|----------|-------------|
| **Supabase** | `clupilpupzvpyuaoaclv` (dev) | `faqbot-prod` |
| **OpenAI** | `OPENAI_API_KEY=fake/test` | Paid production key |
| **Stripe** | `sk_test_...` / `pk_test_...` | `sk_live_...` / `pk_live_...` |
| **Webhook URL** | `localhost:3000/api/webhooks/stripe` | `https://faqbot.app/api/webhooks/stripe` |
| **NEXT_PUBLIC_BASE_URL** | `http://localhost:3000` | `https://faqbot.app` |

---

## ✅ QUICK “GO LIVE” VERIFICATION CHECKS

1. `curl /api/chat` → returns **real OpenAI** response  
2. `curl /api/billing/checkout` → opens **live Stripe session**  
3. Stripe webhook delivers → logs `invoice.paid` event  
4. New org signup → shows **Get Started** checklist  
5. Chat widget responds + shows citations  
6. Trial expiry → access restricted until upgrade  

---

## 📊 PHASE SUMMARY

| Phase | Description | Status |
|-------|--------------|--------|
| 1 | RLS + Header Policy | ✅ Done |
| 2 | Embeddings + Search | ✅ Done |
| 3 | Admin Console | ✅ Done |
| 4 | Chat Endpoint | ✅ Done |
| 5 | Productization (UI polish) |✅ Done  |
| 6 | Production Deploy | ⬜ Next |
| 7 | Trial + Billing Gating | ⬜ Planned |
| 8 | Marketing Site | ⬜ Planned |
| 9 | Private Beta | ⬜ Planned |
| 10 | Public Launch | ⬜ Planned |

---

## 🧭 Notes
- Keep using **feature branches per phase** to keep commits clean.  
- Run `curl` sanity checks after each environment change.  
- Add small screenshots/gifs to this doc as visual proof of progress.  
- Once Phase 10 is live, tag the repo: `v1.0.0` → public release.

---

