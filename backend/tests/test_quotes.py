import json

from app.routers import quotes


class FakeResponse:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps([{"quote": "Learning is a journey.", "author": "Atlas", "work": None}]).encode()


def test_quote_provider_cache_avoids_repeated_external_requests(monkeypatch):
    calls = []
    monkeypatch.setattr(quotes.settings, "x_api_key", "test-key")
    monkeypatch.setattr(quotes, "urlopen", lambda *_args, **_kwargs: (calls.append(1) or FakeResponse()))
    quotes._quote_cache.clear()

    first = quotes.fetch_quote("quoteoftheday")
    second = quotes.fetch_quote("quoteoftheday")

    assert first.quote == "Learning is a journey."
    assert second == first
    assert len(calls) == 1
    quotes._quote_cache.clear()


def test_quote_provider_uses_cached_copy_when_provider_key_is_missing(monkeypatch):
    monkeypatch.setattr(quotes.settings, "x_api_key", "test-key")
    monkeypatch.setattr(quotes, "urlopen", lambda *_args, **_kwargs: FakeResponse())
    quotes._quote_cache.clear()
    cached = quotes.fetch_quote("quoteoftheday")

    monkeypatch.setattr(quotes.settings, "x_api_key", None)
    assert quotes.fetch_quote("quoteoftheday") == cached
    quotes._quote_cache.clear()
