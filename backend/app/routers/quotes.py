import json
import logging
import random
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError

from app.core.config import settings
from app.models import User
from app.schemas import QuoteOutput
from app.security import get_current_user

router = APIRouter(prefix="/quotes", tags=["quotes"])
logger = logging.getLogger(__name__)
QUOTE_CACHE_TTLS = {"quoteoftheday": 6 * 60 * 60, "randomquotes": 60}
_quote_cache: dict[str, tuple[float, QuoteOutput]] = {}
FALLBACK_QUOTES = (
    QuoteOutput(quote="The important thing is not to stop questioning.", author="Albert Einstein"),
    QuoteOutput(quote="It always seems impossible until it is done.", author="Nelson Mandela"),
    QuoteOutput(quote="Somewhere, something incredible is waiting to be known.", author="Carl Sagan"),
    QuoteOutput(quote="The beautiful thing about learning is that nobody can take it away from you.", author="B.B. King"),
    QuoteOutput(quote="Nothing in life is to be feared; it is only to be understood.", author="Marie Curie"),
)
RANDOM_QUOTE_CATEGORIES = (
    "success", "wisdom", "philosophy", "inspirational", "happiness", "time", "humor",
)


def fallback_quote(randomize: bool, exclude: str | None = None) -> QuoteOutput:
    if not randomize:
        return FALLBACK_QUOTES[0]
    choices = [quote for quote in FALLBACK_QUOTES if quote.quote != exclude]
    return random.choice(choices or list(FALLBACK_QUOTES))


_last_random_quote: str | None = None


def fetch_from_provider(endpoint: str) -> QuoteOutput:
    if not settings.x_api_key:
        raise HTTPException(status_code=503, detail="Quote service is not configured")
    url = f"https://api.api-ninjas.com/v2/{endpoint}"
    if endpoint == "randomquotes":
        category = random.choice(RANDOM_QUOTE_CATEGORIES)
        url = f"{url}?{urlencode({'categories': category})}"
    elif endpoint != "quoteoftheday":
        raise HTTPException(status_code=404, detail="Unknown quote endpoint")

    request = Request(url, headers={"X-Api-Key": settings.x_api_key, "Accept": "application/json"})
    try:
        with urlopen(request, timeout=10) as response:
            data = json.load(response)
    except HTTPError as exc:
        logger.warning("Quote provider %s request failed with HTTP %s", endpoint, exc.code)
        raise HTTPException(status_code=502, detail=f"Quote provider request failed with HTTP {exc.code}") from exc
    except (URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        logger.warning("Quote provider %s is unavailable: %s", endpoint, exc)
        raise HTTPException(status_code=502, detail="Could not retrieve a quote") from exc

    if isinstance(data, list):
        data = data[0] if data else None
    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="Quote provider returned an invalid response")
    try:
        return QuoteOutput.model_validate(data)
    except ValidationError as exc:
        raise HTTPException(status_code=502, detail="Quote provider returned an invalid response") from exc


def fetch_quote(endpoint: str) -> QuoteOutput:
    global _last_random_quote
    now = time.monotonic()
    cached = _quote_cache.get(endpoint)
    is_random = endpoint == "randomquotes"

    # Daily quotes are stable for the day; an explicit random request should
    # always try the provider instead of treating its short cache as a hit.
    if not is_random and cached and cached[0] > now:
        return cached[1]

    try:
        quote = fetch_from_provider(endpoint)
        if is_random and quote.quote == _last_random_quote:
            # API Ninjas can return the same result for different categories.
            # Make a couple of fresh attempts before falling back to our own set.
            for _ in range(2):
                candidate = fetch_from_provider(endpoint)
                if candidate.quote != _last_random_quote:
                    quote = candidate
                    break
            else:
                quote = fallback_quote(True, exclude=_last_random_quote)
        _quote_cache[endpoint] = (now + QUOTE_CACHE_TTLS.get(endpoint, 60), quote)
        if is_random:
            _last_random_quote = quote.quote
        return quote
    except HTTPException:
        if is_random:
            # A stale random quote defeats the user's request for another one.
            quote = fallback_quote(True, exclude=_last_random_quote)
            _last_random_quote = quote.quote
            return quote
        if cached:
            logger.info("Serving a stale cached quote for %s after provider failure", endpoint)
            return cached[1]
        # Keep the dashboard useful even when no provider key has been configured.
        return fallback_quote(False)


@router.get("/daily", response_model=QuoteOutput)
def daily_quote(_: User = Depends(get_current_user)):
    return fetch_quote("quoteoftheday")


@router.get("/random", response_model=QuoteOutput)
def random_quote(_: User = Depends(get_current_user)):
    return fetch_quote("randomquotes")
