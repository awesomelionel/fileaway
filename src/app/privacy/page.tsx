import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — fileaway",
  description: "How fileaway collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="May 16, 2026">
      <section>
        <p>
          This Privacy Policy explains what information fileaway (&quot;fileaway&quot;, &quot;we&quot;,
          &quot;us&quot;) collects when you use our website and application (the &quot;Service&quot;),
          how we use it, and the choices you have. By using the Service you agree to this Policy.
        </p>
      </section>

      <section>
        <h2>1. Information we collect</h2>

        <p><strong>Account information.</strong> When you sign up, we collect the email address you
          provide, a hashed password (for password-based accounts), and a unique account identifier.
          If you sign in with Google or GitHub, we receive the basic profile information those
          providers return to us (such as your email, name, and provider user ID).</p>

        <p><strong>Saved items.</strong> When you save a link, we store the URL you submitted, the
          platform it came from, a category our system assigns, the content we retrieved from the
          link (such as captions or transcripts), structured data extracted by AI from that content,
          and metadata such as timestamps and processing status.</p>

        <p><strong>Usage data.</strong> We collect information about how you interact with the
          Service, including pages viewed, features used, approximate location derived from IP
          address, device and browser type, referring page, and performance metrics. This is
          collected through analytics providers including PostHog and Vercel Analytics / Speed
          Insights.</p>

        <p><strong>Cookies and similar technologies.</strong> We use cookies and similar
          technologies to keep you signed in, remember your preferences, secure the Service, and
          measure usage. You can control cookies through your browser settings; disabling them may
          break parts of the Service (for example, you may not be able to stay signed in).</p>

        <p><strong>Communications.</strong> If you contact us, we keep a record of the correspondence
          and any information you choose to share.</p>
      </section>

      <section>
        <h2>2. How we use your information</h2>
        <ul>
          <li>To provide, operate, and maintain the Service, including authenticating you, retrieving content from the URLs you submit, running AI categorization and extraction, and storing the results in your account.</li>
          <li>To secure the Service, prevent fraud and abuse, and enforce our Terms.</li>
          <li>To understand how the Service is used so we can improve it.</li>
          <li>To respond to your support requests and other communications.</li>
          <li>To comply with legal obligations and protect our rights and the rights of others.</li>
        </ul>
        <p>
          Where required by law, we rely on the following legal bases: performance of a contract
          with you, our legitimate interests in operating and improving the Service, your consent
          (where you have given it), and compliance with legal obligations.
        </p>
      </section>

      <section>
        <h2>3. AI processing</h2>
        <p>
          When you save a link, the content retrieved from that link is sent to third-party AI
          providers (currently Google&apos;s Gemini models) to be categorized and to produce
          structured output. We do not use your saved-item content to train AI models. The AI
          providers process the content under their own terms and may temporarily retain it for
          abuse monitoring as described in their policies.
        </p>
      </section>

      <section>
        <h2>4. Service providers we use</h2>
        <p>
          We share information with the following categories of providers strictly to operate the
          Service. They process data on our behalf under contractual confidentiality and security
          obligations:
        </p>
        <ul>
          <li><strong>Convex</strong> — database, authentication, and serverless backend hosting.</li>
          <li><strong>Vercel</strong> — application hosting, analytics, and performance monitoring.</li>
          <li><strong>Apify</strong> — retrieves publicly available content from social media URLs you submit.</li>
          <li><strong>Google (Gemini API)</strong> — AI categorization and extraction.</li>
          <li><strong>Google and GitHub</strong> — optional OAuth sign-in providers, if you choose to use them.</li>
          <li><strong>PostHog</strong> — product analytics.</li>
        </ul>
        <p>
          Each provider operates under its own privacy policy. We may add or change providers from
          time to time and will update this Policy when we do.
        </p>
      </section>

      <section>
        <h2>5. Sharing of information</h2>
        <p>We do not sell your personal information. We share it only:</p>
        <ul>
          <li>With the service providers listed above, to run the Service.</li>
          <li>When you direct us to (for example, by using a feature that shares a saved item).</li>
          <li>To comply with law, valid legal process, or a lawful government request.</li>
          <li>To protect the rights, property, or safety of fileaway, our users, or others, or to investigate fraud or violations of our Terms.</li>
          <li>In connection with a merger, acquisition, financing, reorganization, or sale of assets, subject to confidentiality.</li>
        </ul>
      </section>

      <section>
        <h2>6. Data retention</h2>
        <p>
          We retain your account information for as long as your account is active. Saved items are
          retained until you delete them or delete your account. We may retain limited information
          for longer when needed to comply with legal obligations, resolve disputes, enforce our
          agreements, or maintain security. Backups and logs may persist for a limited period after
          deletion.
        </p>
      </section>

      <section>
        <h2>7. Your rights and choices</h2>
        <p>
          Depending on where you live, you may have rights under laws such as the EU/UK GDPR or the
          CCPA, including the right to access, correct, delete, port, or restrict processing of your
          personal information, the right to object to processing, and the right to withdraw consent.
          To exercise these rights, contact us at the address below. You can also:
        </p>
        <ul>
          <li>Update your email or password from your account settings.</li>
          <li>Delete saved items individually from the Service.</li>
          <li>Request deletion of your account by emailing us.</li>
          <li>Disconnect Google or GitHub from your account by revoking access in the relevant provider.</li>
        </ul>
        <p>
          We will respond to verifiable requests within the time required by applicable law. You may
          also lodge a complaint with your local data protection authority.
        </p>
      </section>

      <section>
        <h2>8. Security</h2>
        <p>
          We use reasonable technical and organizational measures to protect your information,
          including transport-layer encryption, hashed credentials, and access controls. No system
          is perfectly secure; we cannot guarantee that unauthorized parties will never gain access
          to your information.
        </p>
      </section>

      <section>
        <h2>9. International transfers</h2>
        <p>
          fileaway and its service providers may process your information in countries other than
          the one in which you live. Where required, we rely on appropriate safeguards such as
          standard contractual clauses to protect your information during cross-border transfers.
        </p>
      </section>

      <section>
        <h2>10. Children</h2>
        <p>
          The Service is not directed to children under 13 (or the equivalent minimum age in your
          jurisdiction), and we do not knowingly collect personal information from them. If you
          believe a child has provided us with personal information, contact us and we will take
          appropriate steps to delete it.
        </p>
      </section>

      <section>
        <h2>11. Third-party links</h2>
        <p>
          The Service displays links to and information about third-party content on platforms we do
          not operate. We are not responsible for the privacy practices of those platforms. Review
          their privacy policies before interacting with them.
        </p>
      </section>

      <section>
        <h2>12. Changes to this Policy</h2>
        <p>
          We may update this Policy from time to time. When we do, we will update the &quot;Last
          updated&quot; date above and, for material changes, take reasonable steps to notify you,
          such as posting a notice in the Service or sending you an email. Your continued use of
          the Service after a change takes effect means you accept the updated Policy.
        </p>
      </section>

      <section>
        <h2>13. Contact</h2>
        <p>
          For questions, requests, or complaints about this Policy or your information, contact us
          at <a href="mailto:privacy@fileaway.app">privacy@fileaway.app</a>.
        </p>
      </section>
    </LegalLayout>
  );
}
