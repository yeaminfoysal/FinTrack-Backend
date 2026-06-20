# FinTrack

# Project Goal

একটি Offline-First Personal Finance & Expense Tracking Mobile Application যেখানে ব্যবহারকারী:

- Income Tracking
- Expense Tracking
- Loan Tracking (Lend ও Borrow — ধার দেওয়া ও ধার নেওয়া)
- Untracked Expense Detection
- Monthly Saving Calculation
- PDF Reporting

করতে পারবে।

Application offline-এ সম্পূর্ণ কাজ করবে এবং internet available হলে cloud database-এর সাথে automatically synchronize হবে।

---

## 🔄 Updates in This Version (v3 — Loan: Lend + Borrow যোগ হলো)

এই version-এ আগের কিছুই বাদ যায়নি — শুধু **ধার নেওয়া (Borrow)** functionality যোগ হয়েছে এবং পুরোনো "Temporary Expense Module"-কে একটি unified **Loan Module**-এ রূপান্তর করা হয়েছে:

1. **Unified Loan Module** — একটি `direction` field (`LENT` / `BORROWED`) দিয়ে ধার দেওয়া ও ধার নেওয়া দুটোই এক module-এ।
2. **Borrow = Liability (দায়)** — ধার নেওয়া টাকা income নয়; এটা ফেরতযোগ্য দায়।
3. **Reconciliation Formula Update** — Theoretical Balance-এ **Outstanding Borrowed যোগ** হবে (কারণ ধার নেওয়া cash হাতে আসে)।
4. **Repayment ≠ Expense** — ধার নেওয়া টাকা ফেরত দেওয়া কোনো expense নয়, শুধু দায় নিষ্পত্তি।
5. **Dashboard-এ পাওনা ও দেনা** — Outstanding Lent (পাওনা) ও Outstanding Borrowed (দেনা) আলাদা দেখানো, সাথে optional Net Worth।

> 🆕 **Modification #11 (Calculation Hardening):** Monthly Saving-এর explicit formula, current-month scope নিয়ম, backdated → closed-month recompute, এবং negative-untracked handling যোগ করা হয়েছে। বিস্তারিত নিচের **"Calculation Definitions"** section-এ — এটি অন্য যেকোনো জায়গার বর্ণনার উপর প্রাধান্য পাবে।

---

# Core Concept

> ⚠️ **Updated (Modification #2):** Theoretical Balance-এ শুধু **tracked** খরচ (Daily + Outstanding Lent) বাদ যাবে — Untracked Expense এখানে ধরা হবে না (নাহলে circular logic হয়)।
> 
> 
> ⚠️ **Updated (Loan v3):** ধার নেওয়া টাকা হাতে আসে বলে **Outstanding Borrowed যোগ** হবে।
> 

**Theoretical Balance =**
Opening Savings + Total Income + Outstanding Borrowed − (Daily Expense + Outstanding Lent)

**Practical Balance =**
বর্তমানে ব্যবহারকারীর কাছে বাস্তবে থাকা টাকা

**Untracked Expense =**
Theoretical Balance − Practical Balance

**Total Expense =**
Daily Expense + Outstanding Lent + Untracked Expense

> অর্থাৎ: theoretical হিসাবের সময় untracked বাদ, কিন্তু মোট খরচ হিসাবের সময় untracked যোগ — দুটো আলাদা।
> 
> 
> **মনে রাখবেন:**
> 
> - **Outstanding Lent (ধার দেওয়া)** → হাত থেকে cash বেরিয়েছে → theoretical থেকে **বিয়োগ**।
> - **Outstanding Borrowed (ধার নেওয়া)** → হাতে cash এসেছে → theoretical-এ **যোগ**।

---

# 🧾 Calculation Definitions (Modification #11)

> এই section আগের সব formula-র **canonical, dispute-free** সংজ্ঞা দেয়। কোথাও সংজ্ঞায় দ্বিধা থাকলে এই section-ই **single source of truth** (Modification #6-এর সাথে সামঞ্জস্যপূর্ণ)।

## A. তিন ধরনের Balance (Glossary)

| Term | মানে | কীভাবে আসে |
| --- | --- | --- |
| **Opening Balance** | চলতি মাসের শুরুতে হাতে থাকা saving | প্রথম মাসে user input; পরের মাসে Carry Forward |
| **Theoretical Balance** | হিসাব অনুযায়ী এখন হাতে যত থাকার কথা | নিচের formula (§B) |
| **Practical Balance** | বাস্তবে এখন হাতে যত আছে | user input (Cash + Bank + MFS) |
| **Current Balance** (Dashboard label) | = **Theoretical Balance**-এর alias | computed |

## B. Scope নিয়ম — সবচেয়ে গুরুত্বপূর্ণ

> ⚠️ Theoretical Balance-এর Income ও Expense **চলতি মাসের (current month)** scope-এ, **all-time নয়** — নাহলে carried-forward Opening-এর সাথে double-count হবে।

**Theoretical Balance =**
`Opening Balance (চলতি মাস)`
`+ Month Income (চলতি মাস)`
`+ Outstanding Borrowed (global running total)`
`− Month Daily Expense (চলতি মাস)`
`− Outstanding Lent (global running total)`

> দ্রষ্টব্য: Income ও Daily Expense **মাস-ভিত্তিক**, কিন্তু Outstanding Lent/Borrowed **global running total** (Modification #9 অনুযায়ী মাসে মাসে পুনরায় গোনা হয় না)। এই দুটো scope মেলালে hisab মিলবে না।

## C. Untracked Expense

`Untracked Expense = Theoretical Balance − Practical Balance`

- Practical Balance input না দিলে → **0**।
- **Negative হলে** (Practical > Theoretical, যেমন না-লেখা income/gift): এটি expense নয় — UI-তে **"Untracked Income"** হিসেবে দেখাবে (একই মান, opposite sign)। কখনো negative "expense" দেখানো হবে না।

## D. Monthly Saving (আগে অনুপস্থিত ছিল)

`Monthly Saving = Month Income − Month Daily Expense`

- **Loan (Lent/Borrowed) এতে ধরা হবে না** — loan আলাদা global running total; এখানে ধরলে double-count হবে।
- **Untracked Expense এতে ধরা হবে না** — Saving হলো *tracked* হিসাব; untracked শুধু reconciliation/দেখানোর জন্য।
- (চাইলে আলাদা একটি derived "real saving" দেখানো যায়: `Income − Daily Expense − Untracked` — কিন্তু এটি **Carry Forward-এ ব্যবহার করা যাবে না**।)

## E. Carry Forward (consistency check)

`New Month Opening = Previous Month Opening + Previous Month Saving`

- যেহেতু Saving = Income − Daily Expense (§D), Opening কখনো loan বা untracked effect বহন করে না → Theoretical Balance-এর global loan adjustment-এর সাথে **double-count হয় না**। ✓

## F. Total Expense (label সতর্কতা)

`Total Expense = Daily Expense + Outstanding Lent + Untracked Expense`

- এখানে **Outstanding Lent প্রকৃত expense নয়** — এটি একটি asset/পাওনা যা সাময়িকভাবে cash হাত থেকে বের করেছে। Loan **settle (Returned) হলে এটি Total Expense থেকে স্বয়ংক্রিয়ভাবে বাদ** যাবে। তাই এটিকে "temporary cash-out" হিসেবে ভাবতে হবে, স্থায়ী খরচ নয়।

---

# 💰 Money / Currency Handling (Modification #1)

> সব আর্থিক মান **integer paisa** হিসেবে সংরক্ষিত হবে।
> 
- সংরক্ষণ: `Int` (বা প্রয়োজনে `BigInt`), মান = টাকা × ১০০
    - উদাহরণ: ৳ ১,২৫০.৫০ → `125050`
- কখনো `Float` বা `Decimal` ব্যবহার করা হবে না (rounding error এড়াতে)।
- শুধু UI-তে দেখানোর সময় ১০০ দিয়ে ভাগ করে ৳ format করা হবে।
- এই নিয়ম local SQLite, Zustand state এবং PostgreSQL — সব জায়গায় প্রযোজ্য।

---

# Technology Stack

## Mobile Application

- React Native
- Expo
- TypeScript
- NativeWind (Tailwind CSS)

---

## Local Offline Database

- SQLite

Purpose:

- Complete offline support
- Instant read/write
- Store all financial records locally

---

## State Management

- Zustand

Purpose:

- Global state management
- User session
- Dashboard statistics
- Sync status

> **Optional (Modification #10):** Server sync state ম্যানেজ করতে Zustand-এর পাশাপাশি **TanStack Query** ব্যবহার করা যেতে পারে।
> 

---

## Local Storage

### MMKV

Store:

- App settings
- Theme
- Last sync time
- Cached values

### Expo Secure Store

Store:

- Access Token
- Refresh Token
- User Session Data

---

## Backend

- NestJS
- TypeScript

---

## Database

- PostgreSQL
- Prisma ORM

---

## Authentication

- JWT Access Token
- JWT Refresh Token

---

## PDF Generation

> ⚠️ **Updated (Modification #5):** Offline-first হওয়ায় PDF **client-side**-এ তৈরি হবে।
> 

Mobile (Client-side):

- **expo-print** (HTML → PDF)
- **expo-sharing** (share/save)
- বাংলা font HTML/CSS-এ embed করা হবে (যেমন Noto Sans Bengali)

> পুরোনো plan-এ PDF backend (PDFKit)-এ ছিল, কিন্তু তাতে internet ছাড়া report বানানো যেত না এবং বাংলা যুক্তাক্ষর rendering কঠিন। তাই client-side `expo-print`।
> 

---

# 🧮 Calculation Authority (Modification #6)

> সব আর্থিক হিসাবের **single source of truth = Client (Mobile App)**।
> 
- Dashboard, Monthly Summary, Untracked Expense, Saving — সব calculation client-side-এ হবে (offline-এ কাজ করার জন্য)।
- Backend শুধু raw record store ও sync করবে।
- Backend শুধুমাত্র backup বা cross-check-এর জন্য recompute করতে পারে, কিন্তু client-ই authority।

---

# Mobile Features

## Authentication

### Login

- Email Login
- Password Login

### Register

- Create Account

### Forgot Password

- Email Reset Link
- **Note (Modification #10):** এর জন্য একটি email service (যেমন Resend / SendGrid) প্রয়োজন হবে।

### Offline Login Strategy (Modification #7)

- প্রথমবার অবশ্যই **online login** করতে হবে।
- Login-এর পর Access + Refresh Token `Expo Secure Store`এ থাকবে।
- এরপর ব্যবহারকারী **offline-এ অনির্দিষ্টকাল কাজ করতে পারবে**।
- Refresh Token-এর মেয়াদ লম্বা রাখা হবে (offline grace period), যাতে দীর্ঘদিন offline থাকলেও session না ভাঙে।
- (বিকল্প: প্রথম run-এ login ছাড়াই local-only ব্যবহার শুরু করা যাবে; পরে login করলে data sync হবে।)

---

# Dashboard

Dashboard এ দেখাবে:

- Current Balance
- Opening Savings
- Current Month Income
- Current Month Expense
- **Outstanding Lent (পাওনা — মানুষ আপনাকে যত দেবে)** *(Loan v3)*
- **Outstanding Borrowed (দেনা — আপনি মানুষকে যত দেবেন)** *(Loan v3)*
- Untracked Expense
- Current Month Saving
- **Net Worth (optional)** = Available Cash (= **Practical Balance**) + পাওনা − দেনা *(Loan v3)*

> সব মান client-side calculation থেকে আসবে (Modification #6)।
> 

---

# Savings Management

### Initial Savings

ব্যবহারকারী প্রথমবার Opening Savings যোগ করবে।

### Carry Forward

প্রতিমাসে Saving Auto Carry Forward হবে।

---

# Income Management

### Add Income

Fields:

- Amount *(integer paisa — Modification #1)*
- Source
- Date
- Note

### Edit Income

### Delete Income *(soft delete — `isDeleted` mark হবে, Modification #3)*

### Income History

---

# Expense Management

### Add Expense

Fields:

- Amount *(integer paisa — Modification #1)*
- Category
- Date
- Description

### Backdated Expense

পুরনো তারিখে Expense Add করা যাবে।

### Edit Expense

### Delete Expense *(soft delete — `isDeleted` mark হবে, Modification #3)*

---

# Expense Categories

Default Categories:

- Food
- Transport
- Shopping
- Medical
- Education
- Entertainment
- Utilities
- Others

---

# Loan Module (Lend + Borrow)

> ⚠️ **Updated (Loan v3):** পুরোনো "Temporary Expense Module"-এর জায়গায় একটি unified **Loan Module**। একটি `direction` field দিয়ে ধার দেওয়া (LENT) ও ধার নেওয়া (BORROWED) দুটোই এখানে handle হবে।
> 

## Purpose

- **LENT (ধার দেওয়া):** কাউকে টাকা ধার দেওয়া Track করা।
- **BORROWED (ধার নেওয়া):** কারো কাছ থেকে টাকা ধার নেওয়া Track করা।

## Fields

- **direction** — `LENT` / `BORROWED`
- **personName** — কাকে দিলেন / কার কাছ থেকে নিলেন
- **Amount** *(integer paisa — Modification #1)*
- **Date**
- **Note** *(optional)*

## Status

- **Active**
- **Settled**
    - `LENT` settled হলে → **Returned** (ফেরত পেয়েছেন)
    - `BORROWED` settled হলে → **Paid** (ফেরত দিয়েছেন)
- **settledDate** — কবে নিষ্পত্তি হলো

## Settle Loan (নিষ্পত্তি)

### LENT → Return পাওয়া

- Status `Returned` হবে।
- Outstanding Lent থেকে বাদ যাবে।
- হাতে cash ফিরবে → Balance auto update।

### BORROWED → Repay (ফেরত দেওয়া)

- Status `Paid` হবে।
- Outstanding Borrowed থেকে বাদ যাবে।
- **এটি কোনো Expense নয়** — শুধু দায় নিষ্পত্তি। হাতে cash কমবে আর Outstanding Borrowed একসাথে কমবে, তাই reconciliation ঠিক থাকবে।

## হিসাবের নিয়ম (Calculation Rules)

| direction | অর্থ | Cash effect | Theoretical Balance-এ |
| --- | --- | --- | --- |
| **LENT** (ধার দেওয়া) | হাত থেকে টাকা গেছে (পাওনা/asset) | কমে | **বিয়োগ** |
| **BORROWED** (ধার নেওয়া) | হাতে টাকা এসেছে (দেনা/liability) | বাড়ে | **যোগ** |

> **গুরুত্বপূর্ণ:** ধার নেওয়া টাকা **income নয়**, তাই Monthly Saving/Total Credits-এ যোগ হবে না। এটা শুধু Theoretical Balance-এ (cash reconciliation-এর জন্য) যোগ হবে।
> 

---

# Practical Balance Module

ব্যবহারকারী যেকোনো সময় Current Practical Balance Input দিতে পারবে।

Example:

Cash + Bank + Mobile Banking Total

---

# Untracked Expense Module

System Auto Calculate করবে:

> **Updated (Modification #2 & Loan v3):**
> 

**Untracked Expense =**
Theoretical Balance − Practical Balance

যেখানে
**Theoretical Balance =** Opening + Total Income + Outstanding Borrowed − (Daily Expense + Outstanding Lent)

Practical Balance input না দিলে: **Untracked Expense = 0**।

> **Negative হলে** (Practical > Theoretical): "Untracked **Income**" হিসেবে দেখাবে — negative expense নয় (বিস্তারিত: Calculation Definitions §C)।

> **উদাহরণ (কেন Outstanding Borrowed যোগ হয়):** ধরুন আপনি ৳৫,০০০ ধার নিলেন। হাতে cash বাড়ল ৫,০০০।
> 
> - যোগ না করলে: Theoretical = ০, Practical = ৫,০০০ → Untracked = −৫,০০০ (ভুলভাবে "found money")।
> - যোগ করলে: Theoretical = ৫,০০০, Practical = ৫,০০০ → Untracked = ০ (সঠিক)।

---

# Monthly Closing System

> ⚠️ **Updated (Modification #8):** Mobile-এ cron/server job নেই, তাই month-close **App খোলার সময়** trigger হবে।
> 

App Open হলে System একটি **Catch-up Check** চালাবে:

- শেষ closed month কোনটি তা দেখবে।
- এরপর যত মাস পেরিয়ে গেছে, প্রতিটি একে একে close করবে।
- প্রতিটি Close-এর জন্য Auto Generate করবে:
    - Monthly Summary
    - Monthly Saving
    - Closing Balance
- প্রক্রিয়াটি **Idempotent** হবে (একই মাস দুবার close হবে না)।
- অতিরিক্ত: প্রতি মাসের ১ তারিখে একটি **Local Notification** reminder দেওয়া যেতে পারে।

### Backdated Edit → Recompute (Modification #11)

> Closed মাসে backdated income/expense **add / edit / delete** হলে সেই মাসের summary এবং তার পরের সব মাসের Opening Balance stale হয়ে যায় (carry-forward chain ভেঙে যায়)।

- যে মাসে পরিবর্তন হলো, **সেই মাস + তার পরের সব মাস recompute** হবে — Monthly Summary, Monthly Saving, Closing/Opening Balance আবার গণনা করতে হবে।
- Recompute অবশ্যই **idempotent**: একই input থেকে সবসময় একই output।
- যেহেতু Opening Balance chain আকারে carry-forward হয় (§E), একটি পুরোনো মাস বদলালে পুরো chain ঠিক করতে হবে — শুধু একটি মাস নয়।

---

# Carry Forward System

New Month Opening Balance =

Previous Month Opening Balance +
Previous Month Saving

> Saving-এর সংজ্ঞা: **Calculation Definitions §D** (Income − Daily Expense; loan ও untracked বাদ)। ভিন্ন সংজ্ঞা ব্যবহার করলে double-count হবে।

---

# Outstanding Loan Carry Forward

> ⚠️ **Updated (Modification #9 & Loan v3):** Double-count এড়াতে outstanding loan একটি **global running total** হিসেবে গণনা হবে — Lent ও Borrowed দুটোর জন্যই।
> 
- Settle না হওয়া Loan (Status = Active) **running total** হিসেবে হিসাব হবে।
- প্রতি মাসে নতুন করে আলাদাভাবে বিয়োগ/যোগ করা হবে **না** (নাহলে double-count হয়)।
- সব Active loan globally query করে দুটো আলাদা total বের হবে:
    - **Outstanding Lent** = sum of Active `LENT` → theoretical থেকে বিয়োগ
    - **Outstanding Borrowed** = sum of Active `BORROWED` → theoretical-এ যোগ
- Settle হওয়ার পর সেই loan running total থেকে বাদ যাবে এবং Balance auto adjust হবে।

---

# History Module

User দেখতে পারবে:

- Previous Months
- Income History
- Expense History
- **Loan History (Lent + Borrowed আলাদা filter সহ)** *(Loan v3)*
- Saving History

---

# PDF Report

> Client-side (expo-print) দিয়ে generate হবে — Modification #5।
> 

Generate Monthly Report

Includes:

- Opening Balance
- Total Income
- Total Expense
- **Loan Given / Outstanding Lent (পাওনা)** *(Loan v3)*
- **Loan Taken / Outstanding Borrowed (দেনা)** *(Loan v3)*
- Untracked Expense
- Saving
- Closing Balance
- Transaction List

---

# Offline First Architecture

Every Record Stored In:

- SQLite

Immediately

No Internet Required

---

# Sync Architecture

> ⚠️ **Updated (Modification #3 & #4):**
> 

Every Record Contains:

- **id (UUID)** — client-side-এ generate করা; local ও server দুই দিকেই একই primary key *(Modification #4)*
- createdAt
- updatedAt
- **isDeleted** *(soft delete tombstone — Modification #3)*
- **deletedAt**
- syncStatus

syncStatus:

- PENDING
- SYNCED
- FAILED

> পুরোনো `localId` + `serverId` আলাদা না রেখে একটিমাত্র client-generated **UUID** ব্যবহার করা হবে — এতে id mapping লাগে না, sync সহজ হয়।
> 

---

# Sync Flow

> ⚠️ **Updated (Modification #3):** শুধু Push নয়, **Pull**-ও থাকবে।
> 

## Push Flow (Local → Server)

Create / Edit / Delete Record

↓

Save To SQLite (UUID সহ)

↓

Mark PENDING

↓

Internet Available

↓

Sync Service Runs

↓

Push To API

↓

PostgreSQL

↓

Mark SYNCED

## Pull Flow (Server → Local)

App Login / Reinstall / New Device

↓

Request: `lastSyncedAt`-এর পরে বদলানো সব record

↓

Server Returns Changes (নতুন + updated + deleted)

↓

Merge Into SQLite (Last-Write-Wins, UUID দিয়ে match)

↓

Update lastSyncedAt

> এর ফলে app reinstall বা নতুন device-এ login করলেও সব data ফিরে আসবে। Delete-ও tombstone (`isDeleted`) আকারে sync হবে।
> 

> ⚠️ **LWW caveat (Modification #11):** Last-Write-Wins `updatedAt` (device-local time) দিয়ে হয়। একাধিক device-এ clock skew থাকলে ভুল winner বাছতে পারে। নিরাপদ করতে: conflict resolution-এ server-receive timestamp বা একটি monotonic `version` counter ব্যবহার করা যায়। Single-user app-এ ঝুঁকি কম, তবু সচেতন থাকা ভালো।

---

# Backend Modules

## Auth Module

- Register
- Login
- Refresh Token

---

## User Module

- Profile
- Settings

---

## Income Module

CRUD

---

## Expense Module

CRUD

---

## Loan Module

> ⚠️ **Updated (Loan v3):** পুরোনো "Temporary Expense Module"-এর জায়গায়।
> 
- CRUD (with `direction`: LENT / BORROWED)
- Settle (Return / Repay)

---

## Monthly Summary Module

Calculations

> Backend-এ এই calculation শুধু backup/cross-check-এর জন্য; প্রধান authority client *(Modification #6)*।
> 

---

## Report Module

> Client-side PDF (expo-print) মূল; backend report optional *(Modification #5)*।
> 

---

## Sync Module

Mobile Synchronization APIs (Push + Pull) *(Modification #3)*

---

# ⏱️ Timezone Handling (Modification #10)

- Month boundary ও Monthly Closing সবসময় **device-এর local timezone** ধরে হিসাব হবে।
- Date সংরক্ষণ ISO-8601 ফরম্যাটে।