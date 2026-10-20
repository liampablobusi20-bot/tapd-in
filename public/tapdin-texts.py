#!/usr/bin/env python3
"""Tapd In text helper.

Sends text messages from contacts YOU chose to your private Tapd In inbox so they
can be sorted and summarized with your email.

What it does and doesn't do:
  * It asks Tapd In for your allow-list (the contacts you picked in Settings).
  * It reads ONLY messages from those contacts out of the Messages app on this Mac.
    Messages from everyone else are never read, so they never leave this computer.
  * It only looks at messages people sent you, never ones you sent.
  * It keeps nothing on disk except your key and a bookmark of how far it has read.

First time:
  python3 tapdin-texts.py --key tt_your_key_here --dry-run   # shows what would be sent
  python3 tapdin-texts.py --watch                            # sends, and keeps running

Needs Python 3 (already on your Mac) and, once, permission to read Messages:
  System Settings > Privacy & Security > Full Disk Access > add Terminal.
"""

import argparse
import json
import os
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

CONFIG_DIR = Path.home() / ".tapdin"
CONFIG_FILE = CONFIG_DIR / "config.json"
STATE_FILE = CONFIG_DIR / "state.json"
DEFAULT_DB = Path.home() / "Library" / "Messages" / "chat.db"
DEFAULT_URL = "https://tapdin.tech"
APPLE_EPOCH = 978307200  # Messages stores dates as time since 2001-01-01
BATCH = 50


def normalize_handle(raw):
    """Same rule as the Tapd In server: digits only (no leading US 1), or a lowercase email."""
    s = (raw or "").strip()
    if not s:
        return None
    if "@" in s:
        return s.lower() if re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", s) else None
    digits = re.sub(r"\D", "", s)
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) < 7 or len(digits) > 15:
        return None
    return digits


def decode_attributed_body(blob):
    """Newer macOS keeps some message text in a binary blob instead of the text column."""
    if not blob:
        return None
    try:
        parts = bytes(blob).split(b"NSString")
        if len(parts) < 2:
            return None
        data = parts[1][5:]
        if not data:
            return None
        length, start = data[0], 1
        if length == 0x81:
            length = int.from_bytes(data[1:3], "little")
            start = 3
        return data[start:start + length].decode("utf-8", errors="ignore").strip() or None
    except Exception:
        return None


def apple_date_to_iso(value):
    seconds = value / 1e9 if value > 1e12 else value  # nanoseconds on modern macOS
    return datetime.fromtimestamp(seconds + APPLE_EPOCH, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def load_json(path, default):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return default


def save_json(path, data, private=False):
    CONFIG_DIR.mkdir(mode=0o700, exist_ok=True)
    path.write_text(json.dumps(data))
    if private:
        os.chmod(path, 0o600)


def call(url, key, payload=None):
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST" if payload is not None else "GET",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode())


def open_messages(db_path):
    try:
        con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        con.execute("SELECT 1 FROM message LIMIT 1")
        return con
    except sqlite3.Error:
        sys.exit(
            "Can't read the Messages database.\n"
            "Give Terminal permission once: System Settings > Privacy & Security > Full Disk Access,\n"
            "turn on Terminal, then quit and reopen Terminal and run this again."
        )


def run_once(args, config):
    base = config["url"].rstrip("/")
    key = config["key"]

    try:
        contacts = call(f"{base}/api/ingest/text/contacts", key)["contacts"]
    except urllib.error.HTTPError as err:
        if err.code == 401:
            sys.exit("Tapd In didn't accept this key. Make a new one in Settings > Texts.")
        sys.exit(f"Couldn't reach Tapd In ({err.code}).")
    except (urllib.error.URLError, OSError) as err:
        print(f"Couldn't reach Tapd In: {err}. Will try again.")
        return 0

    allowed = {}
    for contact in contacts:
        handle = normalize_handle(contact.get("handle"))
        if handle:
            allowed[handle] = contact.get("name") or handle
    if not allowed:
        print("No contacts on your allow-list yet. Add some in Tapd In under Settings > Texts. Nothing was read.")
        return 0

    con = open_messages(args.db)
    has_blob = any(row[1] == "attributedBody" for row in con.execute("PRAGMA table_info(message)"))

    # Only the people on the allow-list: find their handle ids, and ask for nothing else.
    handle_ids = {}
    for rowid, raw in con.execute("SELECT ROWID, id FROM handle"):
        normalized = normalize_handle(raw)
        if normalized in allowed:
            handle_ids[rowid] = (normalized, allowed[normalized])
    if not handle_ids:
        print("None of your allowed contacts have texted this Mac yet.")
        return 0

    state = load_json(STATE_FILE, {})
    last = state.get("last_rowid")
    # The first run reads only the last few days. After that a bookmark is enough.
    cutoff = None
    if last is None:
        last = 0
        cutoff = (time.time() - args.since_days * 86400 - APPLE_EPOCH) * 1e9

    marks = ",".join("?" for _ in handle_ids)
    blob_col = ", m.attributedBody" if has_blob else ", NULL"
    date_filter = " AND m.date >= ?" if cutoff is not None else ""
    params = [last, *handle_ids.keys()] + ([cutoff] if cutoff is not None else [])
    rows = con.execute(
        f"SELECT m.ROWID, m.guid, m.text{blob_col}, m.date, m.handle_id FROM message m "
        f"WHERE m.ROWID > ? AND m.is_from_me = 0 AND m.handle_id IN ({marks}){date_filter} "
        f"ORDER BY m.ROWID ASC LIMIT 1000",
        params,
    ).fetchall()

    messages, newest = [], last
    for rowid, guid, text, blob, date, handle_id in rows:
        newest = max(newest, rowid)
        body = (text or "").strip() or decode_attributed_body(blob)
        if not body:
            continue  # photos and reactions have no text
        handle, name = handle_ids[handle_id]
        messages.append(
            {"id": guid, "handle": handle, "text": body, "sentAt": apple_date_to_iso(date), "fromMe": False, "_name": name}
        )

    if args.dry_run:
        print(f"Would send {len(messages)} text(s) from {len(handle_ids)} allowed contact(s):")
        for m in messages:
            print(f"  {m['sentAt'][:16]}  {m['_name']}: {m['text'][:80]}")
        return len(messages)

    sent = 0
    for i in range(0, len(messages), BATCH):
        chunk = [{k: v for k, v in m.items() if k != "_name"} for m in messages[i:i + BATCH]]
        try:
            result = call(f"{base}/api/ingest/text", key, {"messages": chunk})
        except urllib.error.HTTPError as err:
            print(f"Tapd In refused the upload ({err.code}). Will retry.")
            return sent
        except (urllib.error.URLError, OSError) as err:
            print(f"Couldn't reach Tapd In: {err}. Will retry.")
            return sent
        sent += result.get("accepted", 0)

    save_json(STATE_FILE, {"last_rowid": newest})
    if messages:
        print(f"{datetime.now().strftime('%H:%M')}  sent {sent} text(s).")
    return sent


def main():
    parser = argparse.ArgumentParser(description="Send texts from chosen contacts to your Tapd In inbox.")
    parser.add_argument("--key", help="Your device key from Tapd In (saved for next time).")
    parser.add_argument("--url", help=f"Tapd In address (default {DEFAULT_URL}).")
    parser.add_argument("--db", default=str(DEFAULT_DB), help="Messages database (for testing).")
    parser.add_argument("--since-days", type=int, default=3, help="On the first run, how many days back to read.")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be sent, and send nothing.")
    parser.add_argument("--watch", action="store_true", help="Keep running and send new texts as they arrive.")
    parser.add_argument("--interval", type=int, default=60, help="Seconds between checks with --watch.")
    parser.add_argument("--reset", action="store_true", help="Forget how far it has read.")
    args = parser.parse_args()

    config = load_json(CONFIG_FILE, {})
    if args.key:
        config["key"] = args.key.strip()
    if args.url:
        config["url"] = args.url.strip()
    config.setdefault("url", DEFAULT_URL)
    if not config.get("key"):
        sys.exit("Add your key first: python3 tapdin-texts.py --key tt_...  (make one in Tapd In under Settings > Texts)")
    if args.key or args.url:
        save_json(CONFIG_FILE, config, private=True)
    if args.reset and STATE_FILE.exists():
        STATE_FILE.unlink()

    if not args.watch:
        run_once(args, config)
        return
    print("Watching for new texts from your allowed contacts. Press Control-C to stop.")
    while True:
        run_once(args, config)
        time.sleep(max(10, args.interval))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.")
