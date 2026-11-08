import { LegalPage } from "@/components/LegalPage";

const Privacy = () => (
  <LegalPage
    title="Privacy Policy"
    updated="November 2026"
    intro="This policy explains what information Borynx collects when you use our community platform for freelancers, why we collect it, and the choices you have. By using Borynx you agree to the practices described here."
    sections={[
      {
        heading: "Information we collect",
        paragraphs: ["We collect the information you give us and limited technical information about how you use the service:"],
        bullets: [
          "Account information: your email address, display name, username, and a hashed password (or your Google account identifier if you sign in with Google). Passwords are never stored in plain text.",
          "Profile information: bio, website, skills, location, availability status, and avatar image.",
          "Content you create: posts, comments, poll votes, community memberships, bookmarks, follows, votes, lead postings, lead applications (including your proposal text), and reports you submit to moderators.",
          "Activity signals derived from your content: reputation, badges, streaks, and notification records (for example, that someone replied to your post).",
          "Technical information: browser type, device information, and logs needed to operate and secure the service. In demo mode (VITE_DEMO_MODE), data is stored only in your browser's local storage and never leaves your device.",
        ],
      },
      {
        heading: "How we use information",
        paragraphs: ["We use the information we collect to:"],
        bullets: [
          "Provide the service: show your profile and content, operate feeds, communities, search, leads, applications, and notifications.",
          "Keep the community safe: investigate reports, enforce our Terms, prevent spam and abuse, and protect accounts.",
          "Communicate with you about your account and activity on the platform (for example, in-app notifications).",
          "Understand how the product is used so we can improve it. We do not sell your personal information, and we do not use your content to train third-party advertising profiles.",
        ],
      },
      {
        heading: "What other users can see",
        paragraphs: [
          "Your public profile (username, display name, bio, skills, reputation, badges, and posts) is visible to other members. Posts are visible according to the audience you choose when posting. Lead applications are visible only to you and the owner of the lead you applied to. Reports you file are visible only to moderators and are never shown to the person you reported.",
        ],
      },
      {
        heading: "Service providers",
        paragraphs: [
          "We use a small number of providers to run Borynx, including Supabase (database, authentication, and hosting of account data). These providers process information only to provide their services to us. If you sign in with Google, Google receives the information necessary to authenticate you under its own privacy policy.",
        ],
      },
      {
        heading: "Cookies and local storage",
        paragraphs: [
          "We use browser local storage to keep you signed in, remember your theme, hold post drafts on your device, and (in demo mode) store the demo database. Drafts stored on your device are not uploaded until you publish them. We do not use third-party advertising cookies.",
        ],
      },
      {
        heading: "Data retention and deletion",
        paragraphs: [
          "We keep your information while your account is active. Content you delete is soft-deleted (hidden from the community) and removed from active use. You may request deletion of your account and associated personal information through Settings or by contacting us; some records (such as moderation reports) may be retained where needed for safety, legal, or audit purposes.",
        ],
      },
      {
        heading: "Security",
        paragraphs: [
          "Access to data is controlled with row-level security policies so users can only reach their own private data (applications, bookmarks, notifications, and reports). No system is perfectly secure, but we work to protect your information and will notify affected users of significant breaches as required by law.",
        ],
      },
      {
        heading: "Children",
        paragraphs: [
          "Borynx is a professional community and is not directed to children under 16. If you believe a child has provided us personal information, contact us and we will remove it.",
        ],
      },
      {
        heading: "Changes to this policy",
        paragraphs: [
          "We may update this policy as the product evolves. Material changes will be announced on the platform, and the “last updated” date above will change. Continued use of Borynx after changes take effect means you accept the updated policy.",
        ],
      },
    ]}
  />
);

export default Privacy;
