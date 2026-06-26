# Freelancer's Hub: Features List

Here is a detailed breakdown of all the features currently available in the app, along with their functional status.

## 1. Authentication & User Management

* **Login & Signup Flows**: Email/Password and potentially Google sign-in (via Firebase Auth). Includes a custom Landing Page for unauthenticated users.
* **User Profiles (`/u/:uid` or `/u/:handle`)**: Displays user information, reputation, achievements, and posts authored by the user. Includes Follow/Unfollow logic.
* **Settings (`/settings`)**: A dedicated page for users to manage their account details and preferences.
* **Status**: **Working**. Data is actively fetched and managed through Firebase.

## 2. Feed & Post System

* **Main Feed (`/`)**: Displays posts. Users can toggle between an "All Feed" and a "Following Feed" (posts only from users they follow).
* **New Feed (`/new`)**: Dedicated feed for the latest posts.
* **Tag Feed (`/tag/:tagName`)**: Filter feeds based on specific tags.
* **Create Post (`/submit`)**: A rich-text editor (using TipTap) allowing users to write posts, format text, and upload images.
* **Post Detail (`/p/:id`)**: View a single post, its comments, and engage in discussion.
* **Reddit-Style Sorting**: Feeds can be sorted by "Hot", "Best", and "New" using a custom `FeedFilter` algorithm.
* **Bookmarks (`/bookmarks`)**: Functionality to save posts for later viewing.
* **Status**: **Working**. Posts and comments are stored in and retrieved from the Firebase real-time database. Sorting and caching are optimized using TanStack Query.

## 3. Communities (Borynx / Styvix)

* **Communities Directory (`/communities`)**: A directory of niche spaces (e.g., Design, Freelance Dev, Writing). Users can "Join" or "Leave" these communities.
* **Community Detail (`/b/:slug`)**: A dedicated feed for posts scoped to a specific community.
* **Status**: **Partially Working / UI Only**. The directory list is currently hardcoded. While you can toggle the "Join" button in the UI, this state is local and not yet persisted to the backend database.

## 4. Leads Board (Bounties & Opportunities)

* **Leads Directory (`/l`)**: A job/bounty board for professional opportunities. Includes a search bar and category filters (All, Bounties, Projects, Retainers, Full-time).
* **Create Lead (`/l/post`)**: A form to post a new job or bounty.
* **Lead Detail (`/l/:leadId`)**: Detailed view of a specific opportunity.
* **Status**: **Working**. Integrates directly with Firebase (`fetchLeads`, `createLead`, etc.).

## 5. Gamification & Achievements

* **Achievements Dashboard (`/achievements`)**: Displays a list of unlockable badges (e.g., First Post, Rising Voice, Trusted Voice) and tracks the user's progress toward "Verification".
* **Status**: **Working**. Achievements are dynamically calculated based on the user's real data (reputation, post count, upvotes received on comments) fetched from the backend.

## Summary

The core infrastructure (Auth, Posting, Leads, and Gamification) is functional and connected to Firebase. The primary area requiring backend integration is the **Communities** joining logic, which is currently just a mocked UI.
