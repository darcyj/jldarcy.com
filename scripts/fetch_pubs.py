#!/usr/bin/env python3
"""Fetch publications from OpenAlex and write data/publications.bib.

Usage:
    python3 scripts/fetch_pubs.py
    python3 scripts/fetch_pubs.py --dry-run     # print to stdout, do not write
    python3 scripts/fetch_pubs.py --output PATH # write to PATH instead

Queries the OpenAlex API for every work attributed to John L. Darcy
(OpenAlex author ID A5076986462), converts each to a BibTeX entry, and
writes the result to data/publications.bib at the repo root.

The site (`main.js`) uses the `keywords` field on each entry to decide
whether the publication is shown under the "first-author" filter, so this
script sets `keywords = {firstauthor}` when OpenAlex marks the position as
"first" and `keywords = {coauthor}` otherwise.

No third-party dependencies; uses the Python standard library only.
"""

from __future__ import annotations

import argparse
import datetime
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

# --- Configuration -----------------------------------------------------------

OPENALEX_AUTHOR_ID = "A5076986462"
POLITE_EMAIL = "Jack.L.Darcy@gmail.com"  # OpenAlex polite-pool: faster, fewer rate limits
PER_PAGE = 200
API_BASE = "https://api.openalex.org/works"
DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DEFAULT_OUTPUT = DATA_DIR / "publications.bib"
MANUAL_BIB = DATA_DIR / "publications.manual.bib"
STATS_OUTPUT = DATA_DIR / "stats.json"
CAREER_START_YEAR = 2012  # for the "Years active" hero stat

# Skip works of these OpenAlex types; the site is a publications list, not a
# full output record. Preprints and book-chapters ARE kept (and tagged) so
# they show up with badges in the UI.
SKIP_TYPES = {"erratum", "retraction", "paratext", "editorial", "dataset"}

# Map OpenAlex `type` values to extra tags appended to the `keywords` field.
# These join "firstauthor"/"coauthor" so the site can filter on them.
TYPE_TAG_MAP = {
    "book-chapter": "chapter",
    "preprint": "preprint",
    "letter": "letter",
}

HTML_TAG_RE = re.compile(r"<[^>]+>")

# --- OpenAlex client ---------------------------------------------------------


def fetch_author_summary(author_id: str) -> dict:
    """Fetch the author record from OpenAlex (h-index, works count, etc.)."""
    params = {"mailto": POLITE_EMAIL}
    url = f"https://api.openalex.org/authors/{author_id}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.load(resp)


def fetch_works(author_id: str):
    """Yield every OpenAlex work for an author, paginating cursor-style."""
    cursor = "*"
    while True:
        params = {
            "filter": f"authorships.author.id:{author_id}",
            "per-page": PER_PAGE,
            "cursor": cursor,
            "mailto": POLITE_EMAIL,
        }
        url = f"{API_BASE}?{urllib.parse.urlencode(params)}"
        with urllib.request.urlopen(url, timeout=30) as resp:
            payload = json.load(resp)
        results = payload.get("results") or []
        for work in results:
            yield work
        next_cursor = (payload.get("meta") or {}).get("next_cursor")
        if not next_cursor or not results:
            break
        cursor = next_cursor


# --- BibTeX rendering --------------------------------------------------------


def flip_name(name: str) -> str:
    """Convert "First Middle Last" → "Last, First Middle" for BibTeX.

    Names already in "Last, First" form (containing a comma) are returned
    unchanged. Multi-word surnames like "van der Veen" will not be split
    perfectly; that affects ~zero entries in this dataset and is easy to
    hand-fix if it ever matters.
    """
    name = (name or "").strip()
    if not name or "," in name:
        return name
    parts = name.split()
    if len(parts) == 1:
        return parts[0]
    return f"{parts[-1]}, {' '.join(parts[:-1])}"


def strip_html(s: str) -> str:
    """Remove HTML tags that OpenAlex sometimes includes in titles."""
    return HTML_TAG_RE.sub("", s or "").replace("  ", " ").strip()


def bib_escape(s: str) -> str:
    """Sanitize a string for inclusion as a BibTeX field value."""
    return (s or "").replace("{", "").replace("}", "").strip()


def author_position_for(work: dict, author_id: str) -> str:
    """Return our author's position ("first" / "middle" / "last") on this work."""
    for a in work.get("authorships") or []:
        author_obj = a.get("author") or {}
        if (author_obj.get("id") or "").endswith(author_id):
            return a.get("author_position") or ""
    return ""


def citekey(year, used: set[str]) -> str:
    """Build a unique citation key like Darcy2020a."""
    base = f"Darcy{year or 'nd'}"
    if base not in used:
        used.add(base)
        return base
    suffix = ord("a")
    while f"{base}{chr(suffix)}" in used:
        suffix += 1
    key = f"{base}{chr(suffix)}"
    used.add(key)
    return key


def normalize_title(s: str) -> str:
    """Lowercased, alphanumeric-only title for dedupe comparison."""
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def parse_bib_entries(text: str):
    """Yield (raw_entry_str, year, title_normalized) for each entry in a bib string.

    Walks brace depth so nested braces in titles do not confuse it. Comment
    lines starting with `%` are ignored. Returns the raw entry text verbatim
    so manual formatting is preserved.
    """
    out = []
    i, n = 0, len(text)
    while i < n:
        at = text.find("@", i)
        if at == -1:
            break
        # Skip if the @ is on a comment line
        line_start = text.rfind("\n", 0, at) + 1
        if text[line_start:at].lstrip().startswith("%"):
            i = at + 1
            continue
        brace_start = text.find("{", at)
        if brace_start == -1:
            break
        depth, j = 1, brace_start + 1
        while j < n and depth > 0:
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
            j += 1
        chunk = text[at:j]
        i = j
        m_year = re.search(r"year\s*=\s*[{\"]?(\d{4})", chunk, re.IGNORECASE)
        year = int(m_year.group(1)) if m_year else 0
        m_title = re.search(r"title\s*=\s*\{+([^{}]+)\}+", chunk, re.IGNORECASE)
        title_norm = normalize_title(m_title.group(1) if m_title else "")
        out.append((chunk.rstrip() + "\n", year, title_norm))
    return out


def work_to_bib(work: dict, used_keys: set[str]):
    """Return (entry_str, year, title_norm) for a work, or None to skip."""
    if work.get("is_retracted"):
        return None
    work_type = (work.get("type") or "").lower()
    if work_type in SKIP_TYPES:
        return None

    title = strip_html(work.get("title") or "")
    year = work.get("publication_year")
    if not title or not year:
        return None

    authors = [
        flip_name((a.get("author") or {}).get("display_name", ""))
        for a in (work.get("authorships") or [])
    ]
    authors = [a for a in authors if a]
    if not authors:
        return None
    author_str = " and ".join(authors)

    primary = work.get("primary_location") or {}
    source = primary.get("source") or {}
    journal = source.get("display_name") or "" if source else ""

    position = author_position_for(work, OPENALEX_AUTHOR_ID)
    tags = ["firstauthor" if position == "first" else "coauthor"]
    extra_tag = TYPE_TAG_MAP.get(work_type)
    if extra_tag:
        tags.append(extra_tag)
    keywords_value = ", ".join(tags)
    key = citekey(year, used_keys)

    fields = [
        f"keywords = {{{keywords_value}}}",
        f"author = {{{bib_escape(author_str)}}}",
        f"title = {{{bib_escape(title)}}}",
        f"year = {{{year}}}",
    ]
    if journal:
        fields.append(f"journal = {{{bib_escape(journal)}}}")

    doi = (work.get("doi") or "").strip()
    if doi:
        # Store as bare DOI (strip URL prefix); main.js re-adds the doi.org host
        doi = re.sub(r"^https?://(?:dx\.)?doi\.org/", "", doi)
        fields.append(f"doi = {{{bib_escape(doi)}}}")

    body = ",\n\t".join(fields)
    entry_str = f"@article{{{key},\n\t{body}\n}}\n"
    return (entry_str, year, normalize_title(title))


# --- Entry point -------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="Print to stdout instead of writing")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output path")
    parser.add_argument("--manual", type=Path, default=MANUAL_BIB, help="Path to hand-curated BibTeX entries (merged in by year). Use /dev/null to skip.")
    args = parser.parse_args()

    # 1. Manual entries — preserved verbatim, take precedence on title conflicts
    manual_entries = []
    if args.manual.exists():
        manual_entries = parse_bib_entries(args.manual.read_text(encoding="utf-8"))
        print(f"Loaded {len(manual_entries)} manual entries from {args.manual}", file=sys.stderr)
    manual_titles = {t for _, _, t in manual_entries if t}

    # 2. OpenAlex entries — filtered, transformed, deduped against manual
    print(f"Fetching works for OpenAlex {OPENALEX_AUTHOR_ID}...", file=sys.stderr)
    works = list(fetch_works(OPENALEX_AUTHOR_ID))
    print(f"  retrieved {len(works)} works", file=sys.stderr)
    works.sort(key=lambda w: (-(w.get("publication_year") or 0), (w.get("title") or "").lower()))

    used_keys: set[str] = set()
    seen_titles: set[str] = set(manual_titles)
    oa_entries = []
    skipped_dupe = 0
    for work in works:
        result = work_to_bib(work, used_keys)
        if not result:
            continue
        entry_str, year, title_norm = result
        if title_norm and title_norm in seen_titles:
            skipped_dupe += 1
            continue
        if title_norm:
            seen_titles.add(title_norm)
        oa_entries.append((entry_str, year, title_norm))
    print(f"  kept {len(oa_entries)} after filtering (skipped {skipped_dupe} duplicates)", file=sys.stderr)

    # 3. Combine and sort year-desc; manual entries within a year sort first
    combined = [(s, y, t, 0) for s, y, t in manual_entries] + [(s, y, t, 1) for s, y, t in oa_entries]
    combined.sort(key=lambda x: (-x[1], x[3], x[2]))

    output = "".join(s for s, _, _, _ in combined)
    if args.dry_run:
        sys.stdout.write(output)
    else:
        args.output.write_text(output, encoding="utf-8")
        print(f"  wrote {len(combined)} total entries to {args.output}", file=sys.stderr)

    # 4. Hero-page stats — written even on dry-run-of-bib so the action stays
    # in sync, but only when we are writing files (the script's primary mode).
    if not args.dry_run:
        try:
            author = fetch_author_summary(OPENALEX_AUTHOR_ID)
        except Exception as err:
            print(f"  warning: could not fetch author summary ({err}); leaving stats untouched", file=sys.stderr)
        else:
            h_index = (author.get("summary_stats") or {}).get("h_index", 0)
            year_now = datetime.date.today().year
            stats = {
                "publications": len(combined),
                "h_index": h_index,
                "years_active": year_now - CAREER_START_YEAR,
            }
            STATS_OUTPUT.write_text(json.dumps(stats, indent=2) + "\n", encoding="utf-8")
            print(f"  wrote stats to {STATS_OUTPUT}: {stats}", file=sys.stderr)


if __name__ == "__main__":
    main()
