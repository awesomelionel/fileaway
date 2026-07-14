import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Support — fileaway",
  description: "Get help with fileaway.",
};

export default function SupportPage() {
  return (
    <LegalLayout title="Support" lastUpdated="July 9, 2026">
      <section>
        <p>
          Need help with fileaway? Email us at{" "}
          <a href="mailto:lionel.ttl+claude2@gmail.com">lionel.ttl+claude2@gmail.com</a> and we&apos;ll
          get back to you within a few days.
        </p>
      </section>

      <section>
        <h2>What to include</h2>
        <p>To help us resolve your issue quickly, please include:</p>
        <ul>
          <li>The email address on your account.</li>
          <li>If a saved link isn&apos;t working, the link itself.</li>
          <li>A short description of what you expected to happen and what happened instead.</li>
        </ul>
      </section>

      <section>
        <h2>Deleting your account</h2>
        <p>
          You can delete your account and all of its data directly from the app: open Settings and
          tap Delete account. If you&apos;d rather we do it for you, email us at the address above
          and we&apos;ll take care of it.
        </p>
      </section>
    </LegalLayout>
  );
}
