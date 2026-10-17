import { openConsent } from '../lib/analytics.js';
import { site } from '../data/site.js';

// Short privacy and cookies page. The operator details are not filled in yet:
// they need the owner's legal name, address and ICO position before launch.
export default function Privacy() {
  return (
    <div className="page page--legal">
      <p className="eyebrow">EMBLARA</p>
      <h1 className="h2">Privacy &amp; <em>cookies</em></h1>

      <h2>Who runs this site</h2>
      <p>Legal name, address and ICO registration status: to be confirmed before launch. Questions about your data: <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.</p>

      <h2>What we collect</h2>
      <p>When you order, we use the contact and delivery details you enter at checkout to make and deliver your order. Card payments are handled by Stripe. We never see your card number.</p>

      <h2>What is stored in your browser</h2>
      <ul>
        <li>Your theme choice, your bag and the logo you add to preview garments. These stay on your device and are not sent to us until you order.</li>
        <li>Your cookie choice from the banner.</li>
      </ul>

      <h2>Analytics</h2>
      <p>If you accept, we load Google Analytics 4. It sets the cookies <code>_ga</code> and <code>_ga_B6MSCZ9TK9</code> and records which pages you view, your browser and device type, and your approximate location. We do not send your name, email or order details to it. Google may process this data outside the UK.</p>
      <p>If you reject, or never choose, nothing is requested from Google. You can change your mind at any time.</p>
      <p><button type="button" className="pill pill--ghost" onClick={openConsent}>Cookie settings</button></p>

      <h2>Staff sign-in</h2>
      <p>The staff dashboard uses one sign-in cookie. Visitors never receive it.</p>
    </div>
  );
}
