"""Dev-only non-VPC seed step. AWS CLI inputs/output are captured; no secrets enter logs."""
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile


class SeedFailure(Exception):
    """Only stable non-sensitive codes are exposed by the script."""


class AwsCLI:
    def __init__(self, env):
        self.env = dict(env)

    def __call__(self, service, operation, payload):
        with tempfile.TemporaryDirectory(prefix="identity-seed-") as directory:
            root = Path(directory)
            if root.resolve().parent != Path(tempfile.gettempdir()).resolve():
                raise SeedFailure("INVALID_TEMP_DIRECTORY")
            request = root / "request.json"
            request.write_text(json.dumps(payload), encoding="utf-8")
            request.chmod(0o600)
            args = ["aws", service, operation, "--region", "us-west-2", "--no-cli-pager", "--no-cli-auto-prompt", "--cli-input-json", "file://" + str(request), "--cli-binary-format", "raw-in-base64-out", "--output", "json"]
            if service == "lambda" and operation == "invoke":
                args.append(str(root / "response.json"))
            result = subprocess.run(args, env=self.env, capture_output=True, text=True, encoding="utf-8", check=False)
            if result.returncode:
                if operation == "admin-get-user" and "(UserNotFoundException)" in result.stderr:
                    return None
                raise SeedFailure("SEED_AWS_CALL_FAILED")
            response = json.loads(result.stdout or "{}")
            if service == "lambda" and operation == "invoke":
                if response.get("FunctionError"):
                    raise SeedFailure("SEED_LAMBDA_FAILED")
                response = json.loads((root / "response.json").read_text(encoding="utf-8"))
            return response


USERS = {
    "test-invited": "Invited",
    "test-uninvited": "Uninvited",
    "test-supervisor": "Supervisor",
}


def run(env, aws):
    """Refuse prod targets before mutation; repeated runs preserve confirmed identities."""
    if env.get("APP_ENV") != "dev" or env.get("SEED_FUNCTION_NAME") != "therapy-service-hours-dev-seed":
        raise SeedFailure("DEV_SEED_ONLY")
    if env.get("AUTH_ENABLED") not in ("true", "false") or env.get("INCLUDE_DEV_USERS") not in ("true", "false") or not env.get("ADMIN_EMAIL"):
        raise SeedFailure("INVALID_SEED_CONFIGURATION")
    auth = env["AUTH_ENABLED"] == "true"
    pool = env.get("USER_POOL_ID")
    if auth:
        if not pool or not env.get("TEST_CLIENT_ID") or not env.get("TEST_CREDENTIALS_ARN") or env["INCLUDE_DEV_USERS"] != "true":
            raise SeedFailure("MISSING_DEV_AUTH_CONFIGURATION")
        actual_pool = aws("cognito-idp", "describe-user-pool", {"UserPoolId": pool})["UserPool"]
        actual_client = aws("cognito-idp", "describe-user-pool-client", {"UserPoolId": pool, "ClientId": env["TEST_CLIENT_ID"]})["UserPoolClient"]
        if actual_pool["Name"] != "therapy-service-hours-dev-users" or actual_client["ClientName"] != "therapy-service-hours-dev-test-only" or "ALLOW_USER_PASSWORD_AUTH" not in actual_client.get("ExplicitAuthFlows", []) or actual_client.get("SupportedIdentityProviders") != ["COGNITO"]:
            raise SeedFailure("DEV_AUTH_TARGET_MISMATCH")
    database = aws("lambda", "invoke", {"FunctionName": env["SEED_FUNCTION_NAME"], "Payload": json.dumps({"admin_email": env["ADMIN_EMAIL"], "include_dev_users": env["INCLUDE_DEV_USERS"] == "true", "allow_prod": False})})
    if database.get("status") != "ok":
        raise SeedFailure("SEED_DATABASE_REFUSED")
    counts = {}
    for key in ("accounts_created", "invitations_created", "invitations_renewed"):
        value = database.get(key, 0)
        if type(value) is not int or value < 0:
            raise SeedFailure("INVALID_SEED_RESPONSE")
        counts[key] = value
    created = 0
    if auth:
        secret = aws("secretsmanager", "get-secret-value", {"SecretId": env["TEST_CREDENTIALS_ARN"]})
        password = json.loads(secret["SecretString"])["password"]
        if not isinstance(password, str) or len(password) < 12:
            raise SeedFailure("INVALID_TEST_CREDENTIALS")
        for username, last_name in USERS.items():
            user = aws("cognito-idp", "admin-get-user", {"UserPoolId": pool, "Username": username})
            new = user is None
            if new:
                user = aws("cognito-idp", "admin-create-user", {"UserPoolId": pool, "Username": username, "TemporaryPassword": password, "MessageAction": "SUPPRESS", "ForceAliasCreation": False, "UserAttributes": [{"Name": "email", "Value": username + "@example.invalid"}, {"Name": "email_verified", "Value": "true"}, {"Name": "given_name", "Value": "Test"}, {"Name": "family_name", "Value": last_name}]})["User"]
                created += 1
            attributes = {a["Name"]: a["Value"] for a in user.get("UserAttributes", user.get("Attributes", []))}
            if user.get("Username") != username or user.get("Enabled") is not True or attributes.get("email") != username + "@example.invalid" or attributes.get("email_verified") != "true" or user.get("UserStatus") not in ("CONFIRMED", "FORCE_CHANGE_PASSWORD"):
                raise SeedFailure("DEV_USER_CONFLICT")
            membership = aws("cognito-idp", "admin-list-groups-for-user", {"UserPoolId": pool, "Username": username})
            if membership.get("NextToken"):
                raise SeedFailure("DEV_USER_GROUP_CONFLICT")
            groups = {g["GroupName"] for g in membership.get("Groups", [])}
            wanted = {"supervisor"} if username == "test-supervisor" else set()
            if groups - wanted:
                raise SeedFailure("DEV_USER_GROUP_CONFLICT")
            if new or user["UserStatus"] == "FORCE_CHANGE_PASSWORD":
                aws("cognito-idp", "admin-set-user-password", {"UserPoolId": pool, "Username": username, "Password": password, "Permanent": True})
            if wanted - groups:
                aws("cognito-idp", "admin-add-user-to-group", {"UserPoolId": pool, "Username": username, "GroupName": "supervisor"})
    return {"status": "ok", "database": {"status": "ok", **counts}, "synthetic_users_created": created}


def main():
    try:
        env = dict(os.environ)
        role = env.get("SEED_OPERATOR_ROLE_ARN", "")
        if not re.fullmatch(r"arn:aws:iam::\d{12}:role/therapy-service-hours-dev-seed-operator", role):
            raise SeedFailure("DEV_OPERATOR_REQUIRED")
        runner = AwsCLI(env)
        credentials = runner("sts", "assume-role", {"RoleArn": role, "RoleSessionName": "dev-identity-seed", "DurationSeconds": 900})["Credentials"]
        env.update(AWS_ACCESS_KEY_ID=credentials["AccessKeyId"], AWS_SECRET_ACCESS_KEY=credentials["SecretAccessKey"], AWS_SESSION_TOKEN=credentials["SessionToken"])
        print(json.dumps(run(env, AwsCLI(env))))
    except SeedFailure as error:
        print(json.dumps({"status": "error", "code": str(error)}))
        return 1
    except Exception:
        # SDK/CLI responses may contain credentials or identity attributes; never print them.
        print(json.dumps({"status": "error", "code": "SEED_STEP_FAILED"}))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
