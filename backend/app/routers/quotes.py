import json
import logging
import random
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
RANDOM_QUOTE_CATEGORIES = (
    "success",
    "wisdom",
    "philosophy",
    "inspirational",
    "happiness",
    "time",
    "humor",
)


def fetch_quote(endpoint: str) -> QuoteOutput:
    cached = _quote_cache.get("daily") if endpoint == "quoteoftheday" else None
    if cached and cached[0] > time.monotonic():
        return cached[1]
    if not settings.x_api_key:
        return fallback_quote(endpoint == "randomquotes")
    url = f"https://api.api-ninjas.com/v2/{endpoint}"
    if endpoint == "randomquotes":
        category = random.choice(RANDOM_QUOTE_CATEGORIES)
        url = f"{url}?{urlencode({'categories': category})}"
    elif endpoint != "quoteoftheday":
        raise HTTPException(status_code=404, detail="Unknown quote endpoint")

    request = Request(
        url,
        headers={"X-Api-Key": settings.x_api_key, "Accept": "application/json"},
    )
    try:
        with urlopen(request, timeout=10) as response:
            data = json.load(response)
    except HTTPError as exc:
        logger.warning("Quote provider %s request failed with HTTP %s", endpoint, exc.code)
        return fallback_quote(endpoint == "randomquotes")
    except (URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        logger.warning("Quote provider %s is unavailable: %s", endpoint, exc)
        return fallback_quote(endpoint == "randomquotes")

    if isinstance(data, list):
        data = data[0] if data else None
    if not isinstance(data, dict):
        logger.warning("Quote provider %s returned an invalid response", endpoint)
        return fallback_quote(endpoint == "randomquotes")
    try:
        result = QuoteOutput.model_validate(data)
        if endpoint == "quoteoftheday":
            _quote_cache["daily"] = (time.monotonic() + QUOTE_CACHE_SECONDS, result)
        return result
    except ValidationError:
        logger.warning("Quote provider %s response failed validation", endpoint)
        return fallback_quote(endpoint == "randomquotes")


@router.get("/daily", response_model=QuoteOutput)
def daily_quote(_: User = Depends(get_current_user)):
    return fetch_quote("quoteoftheday")


@router.get("/random", response_model=QuoteOutput)
def random_quote(_: User = Depends(get_current_user)):
    return fetch_quote("randomquotes")
