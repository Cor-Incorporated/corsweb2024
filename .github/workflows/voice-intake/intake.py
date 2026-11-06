#!/usr/bin/env python3
"""Collect public URLs for human review. Python standard library; no LLM."""

import argparse
import datetime as dt
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import xml.etree.ElementTree as ET

NOTE_RSS = "https://note.com/cor_instrument/rss"
QIITA_API = "https://qiita.com/api/v2/users/terisuke/items"
REPO = "Cor-Incorporated/corsweb2024"
MAX_BYTES = 2_000_000


def canonical_url(value, repo=REPO):
    """Accept article and feedback URLs only, never profile or arbitrary links."""
    if not isinstance(value, str):
        raise ValueError("URL must be a string")
    parsed = urlsplit(value)
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port:
        raise ValueError("URL must use plain HTTPS")
    paths = {
        "note.com": r"/cor_instrument/n/n[a-z0-9]+/?",
        "qiita.com": r"/terisuke/items/[a-f0-9]{20}/?",
        "github.com": rf"/{re.escape(repo)}/issues/[1-9][0-9]*/?",
    }
    if not re.fullmatch(paths.get(parsed.hostname, r"(?!)"), parsed.path):
        raise ValueError("URL is outside the public source allowlist")
    return urlunsplit(("https", parsed.hostname, parsed.path.rstrip("/"), "", ""))


def recorded_urls(text, repo=REPO):
    result = set()
    for raw in re.findall(r"https://[^\s<>\[\]()\"']+", text):
        try:
            result.add(canonical_url(raw.rstrip(".,、。"), repo))
        except ValueError:
            pass
    return result


def request_bytes(url):
    class SameHostRedirect(HTTPRedirectHandler):
        def redirect_request(self, request, response, code, message, headers, newurl):
            parsed = urlsplit(newurl)
            if parsed.scheme != "https" or parsed.hostname != urlsplit(url).hostname:
                raise ValueError("Cross-host source redirect")
            return super().redirect_request(request, response, code, message, headers, newurl)

    request = Request(url, headers={"User-Agent": "cor-voice-intake/1.0"})
    with build_opener(SameHostRedirect()).open(request, timeout=20) as response:
        data = response.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError("Source response exceeds byte limit")
    return data


def parse_note_rss(data):
    if b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
        raise ValueError("RSS document declarations are not accepted")
    root = ET.fromstring(data)
    channel = root.find("channel")
    if root.tag != "rss" or channel is None:
        raise ValueError("Expected note RSS channel")
    urls = {canonical_url(item.findtext("link")) for item in channel.findall("item")}
    if any(urlsplit(url).hostname != "note.com" for url in urls):
        raise ValueError("RSS item points outside note")
    return urls


def collect_articles(fetch=request_bytes, max_pages=100):
    urls = parse_note_rss(fetch(NOTE_RSS))
    for page in range(1, max_pages + 1):
        items = json.loads(fetch(f"{QIITA_API}?page={page}&per_page=100"))
        if not isinstance(items, list) or len(items) > 100:
            raise ValueError("Expected Qiita item page")
        for item in items:
            if not isinstance(item, dict):
                raise ValueError("Expected Qiita item object")
            url = canonical_url(item.get("url"))
            if urlsplit(url).hostname != "qiita.com":
                raise ValueError("Qiita item points outside Qiita")
            urls.add(url)
        if len(items) < 100:
            return urls
    raise ValueError("Qiita pagination limit reached; completeness unknown")


class GitHub:
    def __init__(self, repo):
        self.repo = repo

    def command(self, *args):
        result = subprocess.run(["gh", *args], capture_output=True, text=True, timeout=60)
        if result.returncode:
            raise RuntimeError(f"gh command failed (exit={result.returncode})")
        return result.stdout

    def pages(self, endpoint):
        pages = json.loads(self.command("api", "--paginate", "--slurp", endpoint))
        if not isinstance(pages, list) or any(not isinstance(page, list) for page in pages):
            raise ValueError("Expected paginated GitHub arrays")
        return [item for page in pages for item in page]

    def issues(self, label):
        return [item for item in self.pages(
            f"repos/{self.repo}/issues?state=open&labels={label}&per_page=100"
        ) if "pull_request" not in item]

    def comments(self, number):
        return self.pages(f"repos/{self.repo}/issues/{number}/comments?per_page=100")

    def write(self, body, number=None, title=None):
        with tempfile.TemporaryDirectory(prefix="cor-voice-intake-") as directory:
            body_file = Path(directory) / "body.md"
            body_file.write_text(body, encoding="utf-8")
            args = ["issue", "comment", str(number)] if number else [
                "issue", "create", "--title", title, "--label", "voice-intake"
            ]
            return self.command(*args, "--repo", self.repo, "--body-file", str(body_file)).strip()


def execute(github, evidence, articles, now, dry_run=False):
    if now.tzinfo is None:
        raise ValueError("--now must include a timezone")
    iso = now.astimezone(dt.timezone.utc).isocalendar()
    week = f"{iso.year}-W{iso.week:02}"
    marker = f"<!-- cor-voice-intake:{week} -->"
    known = recorded_urls(evidence, github.repo)
    feedback = {
        canonical_url(item.get("html_url"), github.repo)
        for item in github.issues("voice-feedback")
    }
    if any(urlsplit(url).hostname != "github.com" for url in feedback):
        raise ValueError("Feedback must link to a repository issue")
    weekly = [item for item in github.issues("voice-intake") if marker in (item.get("body") or "")]
    if len(weekly) > 1:
        raise ValueError("Multiple open intake issues have the same week marker")
    issue = weekly[0] if weekly else None
    if issue:
        number = issue.get("number")
        if type(number) is not int or number < 1:
            raise ValueError("Invalid weekly issue number")
        known |= recorded_urls(issue.get("body") or "", github.repo)
        for comment in github.comments(number):
            known |= recorded_urls(comment.get("body") or "", github.repo)
    article_urls = sorted(articles - known)
    feedback_urls = sorted(feedback - known)
    action = "append" if issue else "create"
    if not article_urls and not feedback_urls:
        action = "noop"
    result = {"week": week, "action": action, "articles": len(article_urls),
              "feedback": len(feedback_urls), "dry_run": dry_run}
    if action != "noop":
        body = "\n".join([
            marker, f"## cor-voice 更新の材料（{week}）", "",
            "公開URLの検出結果です。本文・文体の評価と取り込みは、人が承認するPRで行います。", "",
            "### 公開記事", *[f"- {url}" for url in article_urls], "",
            "### 書き方の指示（voice-feedback）", *[f"- {url}" for url in feedback_urls], "",
            "取り込み手順: docs/cor-voice-weekly-intake.md", "",
        ])
        if dry_run:
            result["body"] = body
        else:
            result["url"] = github.write(body, number=issue["number"] if issue else None,
                                         title=f"cor-voice 更新の材料（{week}）")
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=REPO, choices=[REPO])
    parser.add_argument("--evidence", default=".claude/skills/cor-voice/references/evidence.md")
    parser.add_argument("--ledger", required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--now", help="ISO 8601 timestamp with timezone (tests only)")
    args = parser.parse_args(argv)
    event = {"guard": "cor-voice-intake", "at": dt.datetime.now(dt.timezone.utc).isoformat()}
    try:
        now = dt.datetime.fromisoformat(args.now) if args.now else dt.datetime.now(dt.timezone.utc)
        evidence = Path(args.evidence).read_text(encoding="utf-8")
        articles = collect_articles()
        result = execute(GitHub(args.repo), evidence, articles, now, args.dry_run)
        event.update({key: value for key, value in result.items() if key != "body"}, status="success")
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as error:
        event.update(status="failure", error=f"{type(error).__name__}: {error}")
        print(event["error"], file=sys.stderr)
        return 1
    finally:
        ledger = Path(args.ledger)
        ledger.parent.mkdir(parents=True, exist_ok=True)
        with ledger.open("a", encoding="utf-8") as output:
            output.write(json.dumps(event, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    sys.exit(main())
