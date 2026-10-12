"""Behavior tests for dev identity seeding; no real AWS credentials or network calls."""
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location("seed_dev", Path(__file__).resolve().parents[1] / "scripts/seed_dev.py")
seed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seed)


class FakeAWS:
    def __init__(self):
        self.users = {}
        self.groups = {}
        self.calls = []
        self.pool_name = "therapy-service-hours-dev-users"
        self.database_status = "ok"

    def __call__(self, service, operation, request):
        self.calls.append((service, operation, request))
        if operation == "describe-user-pool":
            return {"UserPool": {"Name": self.pool_name}}
        if operation == "describe-user-pool-client":
            return {"UserPoolClient": {"ClientName": "therapy-service-hours-dev-test-only", "ExplicitAuthFlows": ["ALLOW_USER_PASSWORD_AUTH"], "SupportedIdentityProviders": ["COGNITO"]}}
        if operation == "invoke":
            payload = json.loads(request["Payload"])
            assert payload["allow_prod"] is False
            return {"status": self.database_status, "accounts_created": 3}
        if operation == "get-secret-value":
            return {"SecretString": json.dumps({"password": "Synthetic-test-only-password-123!"})}
        username = request["Username"]
        if operation == "admin-get-user":
            return self.users.get(username)
        if operation == "admin-create-user":
            user = {"Username": username, "Enabled": True, "UserStatus": "FORCE_CHANGE_PASSWORD", "Attributes": request["UserAttributes"]}
            self.users[username] = user
            return {"User": user}
        if operation == "admin-set-user-password":
            self.users[username]["UserStatus"] = "CONFIRMED"
            return {}
        if operation == "admin-list-groups-for-user":
            return {"Groups": [{"GroupName": g} for g in self.groups.get(username, set())]}
        if operation == "admin-add-user-to-group":
            self.groups.setdefault(username, set()).add(request["GroupName"])
            return {}
        raise AssertionError(operation)


class AwsCLITests(unittest.TestCase):
    def test_lambda_invocation_uses_explicit_arguments_and_private_payload_file(self):
        identity = {"admin_email": "private@example.test", "include_dev_users": True, "allow_prod": False}
        paths = []

        def invoke(args, **kwargs):
            self.assertEqual(args[:3], ["aws", "lambda", "invoke"])
            self.assertNotIn("--cli-input-json", args)
            self.assertEqual(args[args.index("--function-name") + 1], "therapy-service-hours-dev-seed")
            source = args[args.index("--payload") + 1]
            self.assertTrue(source.startswith("fileb://"))
            request = Path(source.removeprefix("fileb://"))
            paths.append(request)
            self.assertEqual(json.loads(request.read_text(encoding="utf-8")), identity)
            self.assertNotIn(identity["admin_email"], " ".join(args))
            if seed.os.name != "nt":
                self.assertEqual(request.stat().st_mode & 0o077, 0)
            self.assertTrue(kwargs["capture_output"])
            Path(args[-1]).write_text('{"status":"ok","accounts_created":3}', encoding="utf-8")
            return SimpleNamespace(returncode=0, stdout='{"StatusCode":200}', stderr="")

        with patch.object(seed.subprocess, "run", side_effect=invoke) as process:
            result = seed.AwsCLI({})("lambda", "invoke", {"FunctionName": "therapy-service-hours-dev-seed", "Payload": json.dumps(identity)})
        self.assertEqual(result, {"status": "ok", "accounts_created": 3})
        process.assert_called_once()
        self.assertFalse(paths[0].exists())

    def test_other_aws_operations_keep_json_input_and_captured_credentials(self):
        def assume(args, **kwargs):
            self.assertEqual(args[:3], ["aws", "sts", "assume-role"])
            source = args[args.index("--cli-input-json") + 1]
            self.assertEqual(json.loads(Path(source.removeprefix("file://")).read_text(encoding="utf-8")), {"RoleArn": "synthetic-role"})
            return SimpleNamespace(returncode=0, stdout='{"Credentials":{"SessionToken":"synthetic-token"}}', stderr="")

        with patch.object(seed.subprocess, "run", side_effect=assume):
            result = seed.AwsCLI({})("sts", "assume-role", {"RoleArn": "synthetic-role"})
        self.assertEqual(result["Credentials"]["SessionToken"], "synthetic-token")

    def test_lambda_failure_does_not_expose_identity_or_cli_error(self):
        response = SimpleNamespace(returncode=1, stdout="", stderr="private@example.test synthetic-password")
        with patch.object(seed.subprocess, "run", return_value=response):
            with self.assertRaisesRegex(seed.SeedFailure, "^SEED_AWS_CALL_FAILED$"):
                seed.AwsCLI({})("lambda", "invoke", {"FunctionName": "therapy-service-hours-dev-seed", "Payload": "{}"})


class SeedTests(unittest.TestCase):
    def setUp(self):
        self.env = {"APP_ENV": "dev", "AUTH_ENABLED": "true", "INCLUDE_DEV_USERS": "true", "ADMIN_EMAIL": "admin@example.test", "SEED_FUNCTION_NAME": "therapy-service-hours-dev-seed", "USER_POOL_ID": "dev-pool", "TEST_CLIENT_ID": "dev-client", "TEST_CREDENTIALS_ARN": "dev-secret"}
        self.aws = FakeAWS()

    def test_repeat_preserves_confirmed_users_passwords_and_groups(self):
        first = seed.run(self.env, self.aws)
        self.assertEqual(first["synthetic_users_created"], 3)
        creates = [r for _, op, r in self.aws.calls if op == "admin-create-user"]
        self.assertTrue(all(r["MessageAction"] == "SUPPRESS" and r["ForceAliasCreation"] is False for r in creates))
        self.assertEqual(set(self.aws.users), {"test-invited", "test-uninvited", "test-supervisor"})
        self.assertEqual(self.aws.groups, {"test-supervisor": {"supervisor"}})
        self.aws.calls.clear()
        second = seed.run(self.env, self.aws)
        self.assertEqual(second["synthetic_users_created"], 0)
        self.assertFalse(any(op in ("admin-create-user", "admin-set-user-password", "admin-add-user-to-group") for _, op, _ in self.aws.calls))

    def test_prod_and_wrong_pool_are_refused_before_mutation(self):
        for changes in ({"APP_ENV": "prod"}, {"SEED_FUNCTION_NAME": "therapy-service-hours-prod-seed"}):
            with self.assertRaises(seed.SeedFailure):
                seed.run({**self.env, **changes}, self.aws)
            self.assertEqual(self.aws.calls, [])
        self.aws.pool_name = "therapy-service-hours-prod-users"
        with self.assertRaises(seed.SeedFailure):
            seed.run(self.env, self.aws)
        self.assertFalse(any(op in ("invoke", "admin-create-user") for _, op, _ in self.aws.calls))

    def test_disabled_auth_never_reads_credentials_or_calls_cognito(self):
        seed.run({**self.env, "AUTH_ENABLED": "false"}, self.aws)
        self.assertEqual([op for _, op, _ in self.aws.calls], ["invoke"])

    def test_database_refusal_stops_identity_creation(self):
        self.aws.database_status = "error"
        with self.assertRaises(seed.SeedFailure):
            seed.run(self.env, self.aws)
        self.assertEqual(self.aws.users, {})

    def test_unexpected_database_attributes_never_reach_output(self):
        original = self.aws
        def response(service, operation, request):
            value = original(service, operation, request)
            if operation == "invoke":
                value["unexpected_identity"] = "private@example.test"
            return value
        result = seed.run({**self.env, "AUTH_ENABLED": "false"}, response)
        self.assertNotIn("private@example.test", json.dumps(result))

    def test_conflicting_or_disabled_native_users_are_not_overwritten(self):
        seed.run(self.env, self.aws)
        self.aws.users["test-invited"]["Enabled"] = False
        self.aws.calls.clear()
        with self.assertRaises(seed.SeedFailure):
            seed.run(self.env, self.aws)
        self.assertFalse(any(op == "admin-set-user-password" for _, op, _ in self.aws.calls))

    def test_unexpected_admin_group_is_refused(self):
        seed.run(self.env, self.aws)
        self.aws.groups["test-invited"] = {"admin"}
        with self.assertRaises(seed.SeedFailure):
            seed.run(self.env, self.aws)

    def test_partial_creation_is_finished_without_creating_another_identity(self):
        seed.run(self.env, self.aws)
        self.aws.users["test-invited"]["UserStatus"] = "FORCE_CHANGE_PASSWORD"
        self.aws.calls.clear()
        seed.run(self.env, self.aws)
        self.assertEqual([op for _, op, _ in self.aws.calls if op == "admin-set-user-password"], ["admin-set-user-password"])
        self.assertFalse(any(op == "admin-create-user" for _, op, _ in self.aws.calls))


if __name__ == "__main__":
    unittest.main()
