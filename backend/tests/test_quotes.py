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

def test_random_quote_requests_bypass_cache(monkeypatch):
    calls = []

    def next_quote(_endpoint):
        calls.append(1)
        return quotes.QuoteOutput(quote=f"Fresh quote {len(calls)}", author="Atlas")

    monkeypatch.setattr(quotes, "fetch_from_provider", next_quote)
    quotes._quote_cache.clear()

    first = quotes.fetch_quote("randomquotes")
    second = quotes.fetch_quote("randomquotes")

    assert first.quote == "Fresh quote 1"
    assert second.quote == "Fresh quote 2"
    assert len(calls) == 2
    quotes._quote_cache.clear()


def test_random_quote_uses_last_successful_quote_when_provider_fails(monkeypatch):
    quotes._quote_cache.clear()
    monkeypatch.setattr(
        quotes,
        "fetch_from_provider",
        lambda _endpoint: quotes.QuoteOutput(quote="Last good quote", author="Atlas"),
    )
    first = quotes.fetch_quote("randomquotes")

    def unavailable(_endpoint):
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail="Provider unavailable")

    monkeypatch.setattr(quotes, "fetch_from_provider", unavailable)
    second = quotes.fetch_quote("randomquotes")

    assert first.quote == "Last good quote"
    assert second == first
    quotes._quote_cache.clear()
