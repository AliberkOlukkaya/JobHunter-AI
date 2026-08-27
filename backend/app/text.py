import html
import re
from html.parser import HTMLParser


MOJIBAKE_REPLACEMENTS = {
    "Ã„Â±": "ı", "Ã„Â°": "İ", "Ã…Å¸": "ş", "Ã…Åž": "Ş", "Ã„Å¸": "ğ", "Ã„Å¾": "Ğ",
    "ÃƒÂ§": "ç", "ÃƒÂ‡": "Ç", "ÃƒÂ¶": "ö", "ÃƒÂ–": "Ö", "ÃƒÂ¼": "ü", "ÃƒÂœ": "Ü",
    "Ä±": "ı", "Ä°": "İ", "ÅŸ": "ş", "Åž": "Ş", "ÄŸ": "ğ", "Äž": "Ğ",
    "Ã§": "ç", "Ã‡": "Ç", "Ã¶": "ö", "Ã–": "Ö", "Ã¼": "ü", "Ãœ": "Ü",
}


class _PlainTextParser(HTMLParser):
    block_tags = {"p", "div", "br", "li", "ul", "ol", "section", "article", "h1", "h2", "h3", "h4"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.hidden_depth = 0

    def handle_starttag(self, tag: str, _attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style"}:
            self.hidden_depth += 1
        elif tag in self.block_tags and self.parts:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self.hidden_depth:
            self.hidden_depth -= 1
        elif tag in self.block_tags:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.hidden_depth:
            self.parts.append(data)


def repair_known_mojibake(value: str) -> str:
    for broken, correct in MOJIBAKE_REPLACEMENTS.items():
        value = value.replace(broken, correct)
    return value


def clean_display_text(value: str | None, *, multiline: bool = False) -> str | None:
    if value is None:
        return None
    decoded = html.unescape(html.unescape(value)).replace("\xa0", " ")
    parser = _PlainTextParser()
    parser.feed(decoded)
    text = repair_known_mojibake("".join(parser.parts))
    if multiline:
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
        text = "\n".join(line for line in lines if line)
    else:
        text = re.sub(r"\s+", " ", text).strip()
    return text or None


def preserve_source_url(value: str | None) -> str | None:
    """Keep provider URLs byte-for-byte; ingestion owns URL selection."""
    return value
