// AI Builder (2026-10-15, per Hudson): natural-language prompt -> structured
// group management rules + automations. User describes what they want in plain
// words; the LLM converts it into concrete bot settings.
import { askAI } from './ai.js';
import { addScheduledTask } from './automation.js';

const BUILDER_SYSTEM = `You are a WhatsApp bot setup assistant. The user describes how they want their group managed and what automations they want, in natural language (English, Roman Urdu, or mixed).

Convert their description into a JSON config. Available group features:
- antilink: true/false — auto-delete links (except admins)
- antispam: true/false — flood control (5+ msgs in 10s)
- welcome: { on: true/false, text: "..." } — greeting for new members, use @user for name
- goodbye: { on: true/false, text: "..." } — farewell for leaving members
- slowmode: { on: true/false, seconds: N } — limit message frequency
- nightmode: { on: true/false, start: "HH:MM", end: "HH:MM" } — quiet hours
- autoreact: true/false — auto-react to messages

Available automations (scheduled messages):
- automations: [{ message: "...", schedule: "daily"|"weekly"|"monthly", time: "HH:MM", weekday: "monday"|... (for weekly) }]

Rules:
- Only include features the user actually asked for. Don't invent extras.
- Times are Pakistan time (PKT), 24h format.
- Welcome/goodbye text: write it in the user's language style. Keep under 200 chars.
- If the user is vague, pick sensible defaults but note them.
- Respond with ONLY valid JSON, no markdown, no explanation.

Example input: "jo link bheje uska message delete karo, naye members ko welcome karo, roz subah 9 baje good morning bhejo"
Example output:
{"group":{"antilink":true,"welcome":{"on":true,"text":"Assalam o Alaikum @user! Group mein khush aamdeed 🎉"}},"automations":[{"message":"Good morning! 🌅 Have a great day!","schedule":"daily","time":"09:00"}]}`;

export async function parseBuildPrompt(userPrompt) {
  const response = await askAI(`${BUILDER_SYSTEM}\n\nUser request: ${userPrompt}`, { maxTokens: 1000 });
  // Extract JSON from response (handle markdown wrappers)
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI did not return valid config');
  return JSON.parse(jsonMatch[0]);
}

export function describeConfig(config) {
  const lines = ['🤖 *AI Setup Preview*\n'];
  const g = config.group || {};
  if (g.antilink) lines.push('🔗 Anti-Link: ON');
  if (g.antispam) lines.push('🐢 Anti-Spam: ON');
  if (g.welcome?.on) lines.push(`👋 Welcome: ON — "${(g.welcome.text || '').slice(0, 60)}..."`);
  if (g.goodbye?.on) lines.push(`👋 Goodbye: ON — "${(g.goodbye.text || '').slice(0, 60)}..."`);
  if (g.slowmode?.on) lines.push(`⏱️ Slowmode: ON (${g.slowmode.seconds || 30}s)`);
  if (g.nightmode?.on) lines.push(`🌙 Nightmode: ON (${g.nightmode.start || '22:00'}–${g.nightmode.end || '07:00'})`);
  if (g.autoreact) lines.push('❤️ Auto-React: ON');
  const autos = config.automations || [];
  if (autos.length) {
    lines.push('\n⏰ *Automations:*');
    autos.forEach((a, i) => {
      lines.push(`${i + 1}. "${(a.message || '').slice(0, 50)}..." — ${a.schedule} ${a.time}${a.weekday ? ' ' + a.weekday : ''}`);
    });
  }
  if (lines.length === 1) lines.push('_(No features detected — try being more specific)_');
  lines.push('\nReply *yes* to apply, or *no* to cancel.');
  return lines.join('\n');
}
