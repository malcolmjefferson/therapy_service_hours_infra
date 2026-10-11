"""Behavior tests for dev identity seeding; no real AWS credentials or network calls."""
import importlib.util
import json
from pathlib import Path
import unittest

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
