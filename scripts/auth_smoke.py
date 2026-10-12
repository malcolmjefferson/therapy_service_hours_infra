"""Authenticated dev release checks; credentials, token responses and HTTP bodies are captured."""
import json
import os
import re
import urllib.error
import urllib.request
from seed_dev import AwsCLI, SeedFailure


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # The release must never forward a bearer credential to a redirected origin.
        return None


def request(base, path, token):
    req = urllib.request.Request(base + path, headers={"Authorization": "Bearer " + token})
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=20) as response:
            return response.status, response.headers.get("Content-Type", ""), json.loads(response.read(65536))
    except urllib.error.HTTPError as error:
        return error.code, error.headers.get("Content-Type", ""), json.loads(error.read(65536))


def run(env, aws, fetch=request):
    if env.get("AUTH_ENABLED") == "false":
        return {"status": "skipped", "code": "AUTH_DISABLED"}
    if env.get("AUTH_ENABLED") != "true":
        raise SeedFailure("INVALID_AUTH_CONFIGURATION")
    if env.get("APP_ENV") != "dev":
        return {"status": "skipped", "code": "NO_PROD_TEST_IDENTITIES"}
    base = env.get("URL", "").rstrip("/")
    if not re.fullmatch(r"https://[a-z0-9]+\.cloudfront\.net", base):
        raise SeedFailure("INVALID_SMOKE_ORIGIN")
    client, pool = env["TEST_CLIENT_ID"], env["USER_POOL_ID"]
    actual = aws("cognito-idp", "describe-user-pool-client", {"UserPoolId": pool, "ClientId": client})["UserPoolClient"]
    if actual["ClientName"] != "therapy-service-hours-dev-test-only" or actual.get("SupportedIdentityProviders") != ["COGNITO"]:
        raise SeedFailure("DEV_AUTH_TARGET_MISMATCH")
    secret = aws("secretsmanager", "get-secret-value", {"SecretId": env["TEST_CREDENTIALS_ARN"]})
    password = json.loads(secret["SecretString"])["password"]
    for username, expected in (("test-invited", 200), ("test-uninvited", 403)):
        result = aws("cognito-idp", "initiate-auth", {"ClientId": client, "AuthFlow": "USER_PASSWORD_AUTH", "AuthParameters": {"USERNAME": username, "PASSWORD": password}})["AuthenticationResult"]
        try:
            status, content, body = fetch(base, "/api/v1/me", result["IdToken"])
            if status != expected or (expected == 200 and "application/json" not in content) or (expected == 403 and ("application/problem+json" not in content or body.get("type") != "urn:therapy-service-hours:problem:forbidden")):
                raise SeedFailure("AUTH_PROFILE_CHECK_FAILED")
            if expected == 200:
                if set(body) != {"id", "name", "email", "roles", "organization"} or body["roles"] != []:
                    raise SeedFailure("AUTH_PROFILE_CHECK_FAILED")
                status, content, body = fetch(base, "/api/v1/smoke-test-does-not-exist", result["IdToken"])
                if status != 404 or "application/problem+json" not in content or body.get("status") != 404:
                    raise SeedFailure("AUTH_UNKNOWN_ROUTE_CHECK_FAILED")
        finally:
            aws("cognito-idp", "revoke-token", {"ClientId": client, "Token": result["RefreshToken"]})
    return {"status": "ok", "invited_profile": 200, "uninvited_profile": 403, "authenticated_unknown": 404}


def main():
    try:
        env = dict(os.environ)
        runner = AwsCLI(env)
        if env.get("AUTH_ENABLED") == "true" and env.get("APP_ENV") == "dev":
            role = env.get("SMOKE_READER_ROLE_ARN", "")
            if not re.fullmatch(r"arn:aws:iam::\d{12}:role/therapy-service-hours-dev-smoke-reader", role):
                raise SeedFailure("DEV_SMOKE_READER_REQUIRED")
            creds = runner("sts", "assume-role", {"RoleArn": role, "RoleSessionName": "dev-auth-smoke", "DurationSeconds": 900})["Credentials"]
            env.update(AWS_ACCESS_KEY_ID=creds["AccessKeyId"], AWS_SECRET_ACCESS_KEY=creds["SecretAccessKey"], AWS_SESSION_TOKEN=creds["SessionToken"])
        print(json.dumps(run(env, AwsCLI(env))))
        return 0
    except SeedFailure as error:
        print(json.dumps({"status": "error", "code": str(error)}))
        return 1
    except Exception:
        print(json.dumps({"status": "error", "code": "AUTH_SMOKE_FAILED"}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
