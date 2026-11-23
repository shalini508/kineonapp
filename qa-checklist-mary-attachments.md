# QA checklist: Kineon App (from Mary's attachments)

Source files: App Sitemap (FigJam "Kineon App - Main Navigation"), the four Helvetica Neue weights and Monument Grotesk Mono font files, and the Kineon-AI/app-codebase README.

## A. Navigation reachability (from App Sitemap)
- [ ] Home reachable as the first tab, with Recovery Milestones and Pain/Energy/Mood cards
- [ ] Recovery Milestones opens the Session Calendar overlay
- [ ] Sessions tab → Session History → Session Detail
- [ ] Session Detail → "Repeat Session" opens Start Session
- [ ] Sessions tab → Log Past Session form
- [ ] Start Session (+) → Device / Area / Timer
- [ ] Device / Area / Timer → Body Part / Type → Time and Milestones
- [ ] Profile and Settings reachable from Home
- [ ] Meditations reachable from Home and from Learn
- [ ] Learn → Getting Started / Guides → Video Detail
- [ ] Learn → Featured / Library Articles → Article Detail
- [ ] Learn → Protocols: Coming Soon (placeholder, no working flow)
- [ ] Shop → Product Detail → External Purchase Website

## B. Screen coverage (from codebase README, 34 screens)
- [ ] Auth: Welcome, Sign Up, Sign In
- [ ] Tabs: Dashboard, Session Log, Learn, Shop
- [ ] Settings: Settings, Profile, Help Center, Send Feedback
- [ ] Placeholders (Change Password, Manage Membership): confirm they behave as placeholders
- [ ] Subscription section hidden from Settings (gated by a store-release flag)
- [ ] Device: Select Device, Connect flow (Search → Detected → Pairing → Success), Bluetooth Pair, Connectivity Help
- [ ] Guided session: Prepare, Duration, Active, Complete
- [ ] Manual session: Setup, Active
- [ ] Other: Meditations, Quiz (6 steps, progress bar, can't advance without an answer), Daily Log
- [ ] Light and dark theme toggle in Settings changes the whole screen

## C. Fonts (from Mary's font files)
- [ ] Body text and headings use Helvetica Neue
- [ ] Prices and captions use Monument Grotesk Mono
- [ ] Shop prices on Product Detail use mono (passed earlier)
- [ ] "BUY PRODUCT" font: OPEN. Kundan asked whether it should be mono. Mary's files don't answer this.

## D. Test setup
- [ ] Test on a build with a real Supabase login, not demo mode. Demo mode shows mock data, so account and session tests won't mean anything.
- [ ] Record the TestFlight build number on every test result
- [ ] README timer ranges are out of date. Use Asana tickets as the source for timer options.

## E. Open items from Asana
- [ ] Learn page category headers (open, waiting on Kundan)
- [ ] Shop list thumbnail margin (open, waiting on Kundan)
- [ ] Heal+ placement guide content (open, waiting on Kundan)
