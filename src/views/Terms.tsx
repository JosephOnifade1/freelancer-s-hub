import { LegalPage } from "@/components/LegalPage";

const Terms = () => (
  <LegalPage
    title="Terms of Service"
    updated="November 2026"
    intro="These terms govern your use of Borynx, a community platform for freelancers. By creating an account or using the platform, you agree to them. If you do not agree, please do not use Borynx."
    sections={[
      {
        heading: "Your account",
        paragraphs: [
          "You must provide accurate information when you sign up and keep your credentials secure. You are responsible for activity under your account. Usernames may be reclaimed if they are inactive, misleading, or infringe someone else's rights. One person may not maintain multiple accounts to manipulate votes, reputation, or lead applications.",
        ],
      },
      {
        heading: "Your content",
        paragraphs: [
          "You keep ownership of the posts, comments, and other content you create. By posting on Borynx you grant us a non-exclusive, worldwide, royalty-free license to host, display, and distribute that content as part of operating the platform (for example, showing your post in feeds, search, and community pages). You are responsible for your content and must have the right to share it. You can delete your content at any time; copies may remain in backups for a limited period.",
        ],
      },
      {
        heading: "Acceptable use",
        paragraphs: ["To keep the community high-signal and safe, you agree not to:"],
        bullets: [
          "Post spam, scams, misleading job offers, or content that infringes intellectual-property or privacy rights.",
          "Harass, threaten, or discriminate against other members, or impersonate another person or company.",
          "Manipulate votes, reputation, followers, or application counts (including with bots or multiple accounts).",
          "Scrape the platform at scale, probe for vulnerabilities, or interfere with the service's operation.",
          "Post other people's private information (doxxing), or use leads/applications to collect data for unrelated marketing.",
        ],
      },
      {
        heading: "Moderation",
        paragraphs: [
          "Members can report content, leads, and profiles. Moderators may review reports, remove or close content, and restrict or suspend accounts that violate these terms — with or without prior notice in serious cases. Moderation decisions aim to be fair and proportionate; if you believe a decision was wrong, contact us and we will take another look.",
        ],
      },
      {
        heading: "Leads and applications",
        paragraphs: [
          "Borynx provides a board where members post opportunities (leads) and apply to them. Borynx is not a party to any agreement between a lead poster and a freelancer, does not verify every poster's identity or budget, and does not hold funds, provide escrow, or guarantee payment or delivery. Always do your own due diligence, agree terms in writing, and use payment arrangements you trust. Report suspicious leads so moderators can act.",
        ],
      },
      {
        heading: "Reputation and Verified Pro",
        paragraphs: [
          "Reputation, badges, and streaks reflect community activity and are provided for information only; they are not a professional certification or guarantee of quality. The Verified Pro badge is granted at our discretion following review and may be withdrawn if these terms are violated or the member no longer meets the standard.",
        ],
      },
      {
        heading: "The service",
        paragraphs: [
          "Borynx is provided “as is” and may change over time. Features may be added, changed, or removed, and the service may occasionally be unavailable. To the maximum extent permitted by law, we disclaim warranties of merchantability, fitness for a particular purpose, and non-infringement, and our total liability for any claim arising from use of the platform is limited to the greater of the amount you paid us in the previous 12 months or USD 50.",
        ],
      },
      {
        heading: "Termination",
        paragraphs: [
          "You may stop using Borynx and request account deletion at any time. We may suspend or terminate accounts that violate these terms or create risk for other members. Sections covering content licenses (for content already shared), acceptable use, and liability survive termination.",
        ],
      },
      {
        heading: "Changes to these terms",
        paragraphs: [
          "We may update these terms as the product evolves. Material changes will be announced on the platform and the “last updated” date above will change. Continued use after changes take effect means you accept the updated terms.",
        ],
      },
    ]}
  />
);

export default Terms;
