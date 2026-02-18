// Reflow - Privacy Policy Page

Deno.serve(() => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reflow – Privacy Policy</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 60px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.7; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    h2 { font-size: 18px; margin-top: 36px; }
    p, li { font-size: 15px; color: #333; }
    .updated { color: #888; font-size: 14px; margin-bottom: 40px; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>Reflow – Privacy Policy</h1>
  <p class="updated">Last updated: February 19, 2026</p>

  <h2>1. Overview</h2>
  <p>Reflow ("the Extension") is a Chrome extension that provides step-by-step navigation guidance on ChatGPT (chatgpt.com). This policy explains what data we collect, how it is used, and your rights.</p>

  <h2>2. Data We Collect</h2>
  <p>When you use Reflow, the following information is processed:</p>
  <ul>
    <li><strong>Page structure data:</strong> The Extension reads the current page's DOM structure (element types, visible text labels, ARIA attributes) on chatgpt.com to understand the UI context. This data is sent to our API proxy to generate navigation guidance.</li>
    <li><strong>User-entered goals:</strong> The text you type into the Reflow input field (e.g., "How do I create a GPT?") is sent to our API to generate a response.</li>
    <li><strong>Session state:</strong> Temporary session data (current goal, step history) is stored locally in Chrome's session storage and is cleared when the browser tab is closed.</li>
  </ul>

  <h2>3. Data We Do NOT Collect</h2>
  <ul>
    <li>We do not collect your ChatGPT conversation content or messages.</li>
    <li>We do not collect personally identifiable information (name, email, etc.).</li>
    <li>We do not use cookies or tracking technologies.</li>
    <li>We do not sell or share your data with third parties for advertising.</li>
  </ul>

  <h2>4. How Your Data Is Used</h2>
  <p>Page structure data and your goal text are sent to our secure API proxy (hosted on Supabase) and forwarded to OpenAI's API solely to generate navigation guidance. This data is not stored on our servers after the response is returned. OpenAI may retain API request data per their own <a href="https://openai.com/policies/privacy-policy" target="_blank">Privacy Policy</a>.</p>

  <h2>5. Data Storage</h2>
  <p>No personal data is stored on our servers. Session data is stored temporarily in your browser's local session storage and is automatically deleted when the tab is closed.</p>

  <h2>6. Third-Party Services</h2>
  <ul>
    <li><strong>OpenAI API:</strong> Used to generate navigation guidance. See <a href="https://openai.com/policies/privacy-policy" target="_blank">OpenAI Privacy Policy</a>.</li>
    <li><strong>Supabase:</strong> Used as an API proxy. See <a href="https://supabase.com/privacy" target="_blank">Supabase Privacy Policy</a>.</li>
  </ul>

  <h2>7. Permissions</h2>
  <p>The Extension requests the following Chrome permissions:</p>
  <ul>
    <li><strong>activeTab:</strong> To read the current ChatGPT page structure for generating guidance.</li>
    <li><strong>storage:</strong> To temporarily store session state across page navigations within ChatGPT.</li>
  </ul>

  <h2>8. Children's Privacy</h2>
  <p>Reflow is not directed at children under 13. We do not knowingly collect data from children.</p>

  <h2>9. Changes to This Policy</h2>
  <p>We may update this policy from time to time. The "Last updated" date at the top will reflect any changes.</p>

  <h2>10. Contact</h2>
  <p>If you have questions about this privacy policy, please contact: <a href="mailto:gracekim7765@gmail.com">gracekim7765@gmail.com</a></p>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
});
