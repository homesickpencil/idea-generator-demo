"""Telegram bot handlers — they run INSIDE the backend deployment.

There's no separate bot service: the backend serves the web API *and* the Telegram
webhook. The `/ideate` handler creates an idea by calling the database directly
(same process, no HTTP hop).

The bot is optional: if TELEGRAM_BOT_TOKEN isn't set, `bot` is None and the Telegram
routes in main.py report that it's not configured.
"""

import os

import telebot

import service

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")

# Build the bot only if a token is set. Wrapped so a malformed token disables the
# bot (routes return 503) instead of crashing the whole backend on import.
try:
    bot = telebot.TeleBot(BOT_TOKEN, threaded=False) if BOT_TOKEN else None
except Exception:
    bot = None

if bot is not None:

    @bot.message_handler(commands=["start", "help"])
    def _start(message):
        bot.reply_to(message, "Send /ideate <your idea> and I'll start an AI mindmap for it.")

    @bot.message_handler(commands=["ideate"])
    def _ideate(message):
        # Everything after the "/ideate " prefix is the idea text.
        idea_text = message.text.partition(" ")[2].strip()
        if not idea_text:
            bot.reply_to(message, "Usage: /ideate <your idea>")
            return
        try:
            # Same flow as POST /api/ideas: LLM title + auto-expanded first level.
            idea_id, _root, title = service.create_idea(idea_text)
        except Exception:
            bot.reply_to(message, "Sorry, I couldn't explore that idea. Please try again later.")
            return
        link = f"{FRONTEND_URL}/idea/{idea_id}"
        bot.reply_to(message, f"💡 {title}\nExplore it: {link}")
