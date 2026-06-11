# Driving School Booking & Payment System (DSBPS)

A relational database that records learner-driver customers, the lessons they book, the instructors and vehicles assigned to those lessons, and the payments customers make against their accounts.

---

## Purpose

This class project covers:

- A conceptual and logical data model
- The physical implementation (tables, keys, constraints, indexes, views, stored procedures and triggers)
- Design decisions and their rationale
- Administrative and operational procedures needed to run the database in production

This document is the authoritative reference used to build, review, maintain, and hand over the database.

---

## Layout Structure

```
index.html            Shell markup only; loads styles.css + js/main.js
styles.css            All styling (extracted from the old <style> block)
app/
  main.js             Entry point: binds sidebar controls, boots the app
  core/               Framework-agnostic helpers
    format.js         esc(), money, date helpers
    dom.js            $(), toast(), modal open/close
    state.js          Shared app state + section metadata
  model/              MODEL — data & business state, never touches the DOM
    supabase.js       Connects the supabase-js client
    dataService.js    Repository: live Supabase backend + disconnected backend
    session.js        Auth session + role-based access control
  view/               VIEW — pure functions: data in, HTML out (no fetching)
    components.js     Pills, <select> builders, the shared address picker
    sections.js       Page section + gate templates
    forms.js          Modal/form templates
  controller/         CONTROLLER — fetch via model, render via view, wire events
    router.js         Navigation, re-render cycle, sidebar/nav chrome
    customers.js      Customer CRUD + payments
    lessons.js        Booking / cancel / delete
    schedule.js       Schedule views + instructor management
    reports.js        The four reports
    auth.js           Connect/disconnect, sign in, register, roles admin
```

---

## Running It

These are real ES modules, so the page must be served over **HTTP** — opening `index.html` directly via `file://` will be blocked by the browser's module security rules.

Any static server works:

```bash
# from this folder
python3 -m http.server 8000
# then open http://localhost:8000
```

Or deploy the folder to any static host (Supabase Storage, Vercel, Netlify, GitHub Pages).

Then use **Connect to Supabase** in the sidebar, and sign in.

---

## Prerequisites

Requires the database side already set up:

- Schema, views, and stored procedures
- The `fn_*` wrappers and `fn_resolve_address`
- The auth extension
- `driving_school` added under **Settings → API → Exposed schemas**
