/**
 * Onboarding flow for new AwaisxBot users (2026-10-14, simplified per Hudson).
 *
 * ONLY asks for the user's name. Nothing else. No categories, no usage types,
 * no branching. If the user dodges (hi/hello/menu), keep asking for the name
 * — don't process anything else until a real name is given.
 */
import { Store } from './store.js';

// Greetings and commands that are NOT a name
const DODGE_PATTERNS = /^(hi+|hello+|hey+|salam|assalam|aoa|menu|help|start|yo|hii+|helo+)[\s!?.]*$/i;

export async function checkOnboarding(bot, { msg, from, sender, senderName, isGroup, text }) {
  if (isGroup) return false;
  if (Store.isOnboarded(sender)) return false;
  const trimmed = (text || '').trim();
  if (!trimmed) return false;

  let profile = Store.getUserProfile(sender) || {};
  let step = profile.onboardingStep || 'start';
  let nameAsks = profile.nameAsks || 0;

  // ── Step: start → ask for name ──
  if (step === 'start') {
    Store.saveUserProfile(sender, { onboardingStep: 'name', nameAsks: 1, onboarded: false });
    await bot.sendMessage(from,
      `*Hi! I'm AwaisxBot!* 🤖\n\n*What is your name?*`
    );
    return true;
  }

  // ── Step: name ──
  if (step === 'name') {
    // If it's a real command (not a greeting), let it through — don't eat it as a name.
    // This fixes deletemydata and other commands being swallowed during onboarding.
    const firstWord = trimmed.split(/\s+/)[0].toLowerCase().replace(/^[./!#>]+/, '');
    if (bot.isKnownCommand && bot.isKnownCommand(firstWord)) {
      return false; // Not onboarding — process as command
    }
    // User dodged with greeting/command — keep asking, don't process
    if (DODGE_PATTERNS.test(trimmed) || trimmed.length < 2) {
      nameAsks++;
      Store.saveUserProfile(sender, { nameAsks });

      if (nameAsks >= 4) {
        // After 4 dodges, accept it and move on — don't trap them forever
        Store.saveUserProfile(sender, {
          name: senderName || 'Friend',
          onboardingStep: 'done', onboarded: true,
          onboardedAt: new Date().toISOString(),
        });
        await bot.sendMessage(from,
          `OK, moving on! 😊 Type *menu* to see what I can do.\n\n🤖 *Powered by Awais AI*`
        );
        return true;
      }

      const nudges = [
        `I need your *name* first — what should I call you? 😊`,
        `Still need your name! Just tell me what to call you.`,
        `One thing — your *name*? Then we're good to go!`,
      ];
      await bot.sendMessage(from, nudges[Math.min(nameAsks - 1, nudges.length - 1)]);
      return true;
    }

    // Got a real name — done. No more questions.
    const name = trimmed.split(/\s+/).slice(0, 3).join(' ');
    Store.saveUserProfile(sender, {
      name, onboardingStep: 'done',
      onboarded: true, onboardedAt: new Date().toISOString(),
    });
    await bot.sendMessage(from,
      `Nice to meet you, *${name}*! 😊\n\n` +
      `Type *menu* to see what I can do, or just tell me what you need!\n\n` +
      `🤖 *Powered by Awais AI*`
    );
    return true;
  }

  return false;
}

/**
 * Personalization context for the AI. Now minimal — just the name.
 */
export function getUserContext(sender) {
  const p = Store.getUserProfile(sender);
  if (!p || !p.onboarded) return '';
  const parts = [];
  if (p.name) parts.push(`The user's name is ${p.name}.`);
  if (p.onboardedAt) parts.push(`Onboarded on ${p.onboardedAt.slice(0, 10)}.`);
  return parts.join(' ');
}
