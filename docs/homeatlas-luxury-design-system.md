# HomeAtlas luxury design system audit

## Visual thesis

HomeAtlas should feel like a quiet private operating system for a well-cared-for home: dark mineral surfaces, warm ivory type, one restrained champagne accent, crisp operational status, and motion that explains state instead of decorating it. Premium comes from hierarchy, calm density, exact spacing, legible controls, and consistent feedback.

## Surface inventory

The application currently contains 89 page routes and 17 nested layouts. The audited user-facing families are:

| Family | Principal routes and experiences | Current condition |
| --- | --- | --- |
| Public | Home, services, properties, request, contact, privacy, terms | Strong editorial moments, but multiple legacy/lab palettes and independent button recipes remain. |
| Customer | Portal, home health, plan, enrollment, payment completion | Good storytelling and loading artwork; forms, statuses, and transaction screens do not all share the craftsmanship layer. |
| HQ | Today, Dispatch, Atlas, Pulse, Requests, Sales, Enrollment, Inbox, Members, Jobber, Team, Care, Billing, Numbers, Growth, Health | Broadest surface. Navigation is strong, but cards, radii, status colors, loading, and empty states are still authored page by page. |
| Technician | Access, Today, assigned properties, assessment, health check, referral | Phone-first and usable, but the mint/emerald visual language diverges from the champagne HomeAtlas system. |
| Salesperson | Access, daily field workspace, map, follow-ups, performance | Increasingly aligned with craftsmanship tokens; several large components still contain local status and skeleton recipes. |
| Forms and auth | HQ unlock, technician and sales access, request/enrollment/payment flows | Functional, but shared field, error, success, and focus treatments are incomplete. |
| Email | Enrollment, lead confirmation, welcome, notifications | Brand language exists in separate HTML recipes; needs the same semantic palette and hierarchy contract as the web product. |

The route-family scan found 685 hard-coded hex-color uses, 185 custom radius declarations, and only 281 references to the existing shared craftsmanship layer. The largest divergence is in HQ and technician components. These counts are diagnostic, not a target for blind replacement: maps, photography, charts, and intentionally branded customer themes may keep scoped colors.

## Unified foundation

### Color

- Canvas: `obsidian` (`#070605`)
- Primary surface: `mineral` (`#121110`)
- Elevated surface: `charcoal` (`#181614`)
- Primary text: `ivory` (`#f5f2eb`)
- Secondary text: `stone` (`#a6a097`)
- Brand accent: `champagne` (`#c9b896`)
- Success: restrained eucalyptus
- Warning: muted amber
- Danger: mineral rose
- Information: cool slate-blue

Status colors communicate meaning only; champagne communicates brand and primary action. Status always includes text or an icon, never color alone.

### Typography

- Cormorant Garamond is reserved for editorial and major page headings.
- Geist is the operational face for controls, tables, status, and body copy.
- Operational body and labels remain at least 14px; mobile form controls remain 16px to prevent zoom.
- Numerals use tabular spacing in metrics, money, dates, and elapsed time.

### Geometry and spacing

- Control radius: 14px
- Nested tray: 16px
- Standard card: 22px
- Hero/elevated card: 28px
- Touch targets: at least 44px, with primary field actions at least 52px
- Page gutters: 16px mobile, 24px tablet, 32px desktop
- One elevated/rimmed hero surface per view; nested glass is limited to one level.

### Motion

- State transitions: 160–240ms
- Page/card reveal: 320–480ms, staggered only where order helps comprehension
- No perpetual decorative motion except a small live-status indicator
- Every animation respects `prefers-reduced-motion`

### Shared state contract

Every data surface must support the same five states: loading, empty, success, warning, and error. Each state has a title, plain-language next step, semantic role, and stable layout so content does not jump when data arrives.

## Release stages

1. Foundation: semantic tokens, shared controls/status/state primitives, role shells, and accessibility defaults.
2. Operational core: HQ navigation and dashboard states, Dispatch, Today, technician access and field run, salesperson access/workspace.
3. Customer journey: request, enrollment, payment, portal, home health, and customer-facing email shells.
4. Public editorial: home, services, properties, contact, and legal pages.
5. Long-tail and labs: presentations, setup tools, historical experience routes, and explicitly experimental pages.

Each stage is independently buildable and reviewable. Existing business logic, provider calls, permissions, routes, and data contracts are out of scope unless visual verification exposes a functional defect.
