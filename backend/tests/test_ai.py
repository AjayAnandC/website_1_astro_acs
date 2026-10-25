import json
import os
import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from backend import ai


class AiRequestTests(unittest.TestCase):
    def test_report_uses_requested_plan_and_zodiac(self):
        request = ai.ReportRequest(plan="weekly", zodiac="Taurus")
        with patch.object(ai, "_openai_completion", return_value="A thoughtful reading.") as completion:
            response = ai.generate_report(request, _user={"uid": "member-1"})

        self.assertEqual(response, {"report": "A thoughtful reading."})
        prompt = completion.call_args.args[0][1]["content"]
        self.assertIn("weekly", prompt)
        self.assertIn("Taurus", prompt)

    def test_chat_keeps_only_supported_roles_and_includes_recent_history(self):
        request = ai.ChatRequest(
            message="What should I reflect on?",
            zodiac="Gemini",
            history=[
                ai.ChatTurn(role="user", content="Hello"),
                ai.ChatTurn(role="assistant", content="Welcome."),
            ],
        )
        with patch.object(ai, "_openai_completion", return_value="Try a quiet moment.") as completion:
            response = ai.chat(request, _user={"uid": "member-1"})

        self.assertEqual(response, {"reply": "Try a quiet moment."})
        messages = completion.call_args.args[0]
        self.assertEqual([turn["role"] for turn in messages], ["system", "user", "assistant", "user"])
        self.assertIn("Gemini", messages[0]["content"])
        self.assertEqual(messages[-1]["content"], "What should I reflect on?")

    def test_ai_endpoints_require_a_firebase_bearer_token(self):
        with self.assertRaises(HTTPException) as error:
            ai.verify_firebase_user(None)

        self.assertEqual(error.exception.status_code, 401)

    def test_firebase_token_is_verified_as_revocable(self):
        firebase_app = object()
        with (
            patch.object(ai, "_firebase_app", return_value=firebase_app),
            patch.object(ai.firebase_auth, "verify_id_token", return_value={"uid": "member-1"}) as verify,
        ):
            user = ai.verify_firebase_user("Bearer example-token")

        self.assertEqual(user["uid"], "member-1")
        verify.assert_called_once_with("example-token", check_revoked=True, app=firebase_app)

    def test_openai_key_is_required(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(HTTPException) as error:
                ai._openai_completion([])

        self.assertEqual(error.exception.status_code, 503)

    def test_openai_completion_uses_server_key_and_returns_text(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps(
            {"choices": [{"message": {"content": "A fresh perspective."}}]}
        ).encode()

        with (
            patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}, clear=True),
            patch.object(ai, "urlopen", return_value=response) as open_url,
        ):
            content = ai._openai_completion([{"role": "user", "content": "Hello"}])

        request = open_url.call_args.args[0]
        self.assertEqual(content, "A fresh perspective.")
        self.assertEqual(request.get_header("Authorization"), "Bearer test-key")
        self.assertEqual(request.full_url, "https://api.openai.com/v1/chat/completions")
        self.assertEqual(json.loads(request.data)["model"], "gpt-4o-mini")

    def test_empty_openai_completion_is_reported_as_gateway_error(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps(
            {"choices": [{"message": {"content": " "}}]}
        ).encode()

        with (
            patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}, clear=True),
            patch.object(ai, "urlopen", return_value=response),
        ):
            with self.assertRaises(HTTPException) as error:
                ai._openai_completion([])

        self.assertEqual(error.exception.status_code, 502)


if __name__ == "__main__":
    unittest.main()
