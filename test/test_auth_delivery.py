import json
from pathlib import Path
import sys
import unittest

scripts = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(scripts))
import auth_smoke
import write_auth_config


class AuthDeliveryTests(unittest.TestCase):
    def test_disabled_and_prod_never_request_dev_credentials(self):
        def forbidden(*args):
            self.fail("unexpected AWS or HTTP request")
        self.assertEqual(auth_smoke.run({"AUTH_ENABLED":"false"}, forbidden)["code"], "AUTH_DISABLED")
        self.assertEqual(auth_smoke.run({"AUTH_ENABLED":"true", "APP_ENV":"prod"}, forbidden)["code"], "NO_PROD_TEST_IDENTITIES")
        self.assertEqual(write_auth_config.configuration({"AUTH_ENABLED":"false","SECRET":"private"}), {"enabled":False})

    def test_configuration_contains_only_public_fields_and_matching_origin(self):
        env={"AUTH_ENABLED":"true","HOSTED_UI_ORIGIN":"https://test.auth.us-west-2.amazoncognito.com","SPA_CLIENT_ID":"client123","USER_POOL_ID":"us-west-2_Test","URL":"https://d123.cloudfront.net/","CALLBACK_URL":"https://d123.cloudfront.net/auth/callback","LOGOUT_URL":"https://d123.cloudfront.net/","SECRET":"private"}
        actual=write_auth_config.configuration(env)
        self.assertEqual(set(actual), {"enabled","hostedUiOrigin","clientId","issuer","callbackUrl","logoutUrl"})
        self.assertNotIn("private",json.dumps(actual))
        self.assertEqual(actual["callbackUrl"],"https://d123.cloudfront.net/auth/callback")
        for key,value in (("HOSTED_UI_ORIGIN","https://untrusted.example"),("URL","https://user:password@example.test"),("SPA_CLIENT_ID","bad; value")):
            with self.assertRaises(ValueError):write_auth_config.configuration({**env,key:value})

    def test_authenticated_checks_revoke_both_native_sessions_without_exposing_tokens(self):
        calls=[]
        def aws(service,operation,payload):
            calls.append((operation,payload))
            if operation=="describe-user-pool-client":return {"UserPoolClient":{"ClientName":"therapy-service-hours-dev-test-only","SupportedIdentityProviders":["COGNITO"]}}
            if operation=="get-secret-value":return {"SecretString":json.dumps({"password":"fictional-private-password"})}
            if operation=="initiate-auth":return {"AuthenticationResult":{"IdToken":payload["AuthParameters"]["USERNAME"],"RefreshToken":"fictional-private-refresh"}}
            if operation=="revoke-token":return {}
            self.fail(operation)
        def fetch(base,path,token):
            if path.endswith("/me") and token=="test-invited":return 200,"application/json",{"id":"id","name":"Pseudonym","email":"test@example.invalid","roles":[],"organization":{}}
            if path.endswith("/me"):return 403,"application/problem+json",{"type":"urn:therapy-service-hours:problem:forbidden"}
            return 404,"application/problem+json",{"status":404}
        result=auth_smoke.run({"AUTH_ENABLED":"true","APP_ENV":"dev","URL":"https://d123.cloudfront.net","TEST_CLIENT_ID":"client","USER_POOL_ID":"pool","TEST_CREDENTIALS_ARN":"secret"},aws,fetch)
        self.assertEqual(result["status"],"ok")
        self.assertEqual([op for op,_ in calls].count("revoke-token"),2)
        self.assertNotIn("private",json.dumps(result))


if __name__=="__main__":unittest.main()
