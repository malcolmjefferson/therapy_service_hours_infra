"""Emit only public deployment auth settings. Credentials and tokens never enter this file."""
import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse


def configuration(env):
    if env.get("AUTH_ENABLED") == "false":
        return {"enabled": False}
    if env.get("AUTH_ENABLED") != "true":
        raise ValueError("INVALID_AUTH_CONFIGURATION")
    origin = env.get("HOSTED_UI_ORIGIN", "")
    client = env.get("SPA_CLIENT_ID", "")
    pool = env.get("USER_POOL_ID", "")
    url = urlparse(env.get("URL", ""))
    if not re.fullmatch(r"https://[a-z0-9-]+\.auth\.us-west-2\.amazoncognito\.com", origin) or not re.fullmatch(r"[a-z0-9]{1,128}", client) or not re.fullmatch(r"us-west-2_[A-Za-z0-9]+", pool):
        raise ValueError("INVALID_AUTH_CONFIGURATION")
    if url.scheme != "https" or not url.netloc or url.username or url.password or url.query or url.fragment or url.path not in ("", "/"):
        raise ValueError("INVALID_AUTH_CONFIGURATION")
    base = f"https://{url.netloc}"
    if env.get("CALLBACK_URL") != base + "/auth/callback" or env.get("LOGOUT_URL") != base + "/":
        raise ValueError("INVALID_AUTH_CONFIGURATION")
    return {"enabled": True, "hostedUiOrigin": origin, "clientId": client, "issuer": f"https://cognito-idp.us-west-2.amazonaws.com/{pool}", "callbackUrl": base + "/auth/callback", "logoutUrl": base + "/"}


if __name__ == "__main__":
    try:
        Path("auth-config.json").write_text(json.dumps(configuration(os.environ)) + "\n", encoding="utf-8")
    except Exception:
        raise SystemExit("INVALID_AUTH_CONFIGURATION") from None
