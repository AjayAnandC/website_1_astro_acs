import json
import logging
import os
from typing import Literal, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import firebase_admin
from fastapi import APIRouter, Depends, Header, HTTPException
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from firebase_admin.exceptions import FirebaseError
from pydantic import BaseModel, Field, conlist, constr

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["AI"])


class ReportRequest(BaseModel):
    plan: Literal["daily", "weekly", "monthly"]
    zodiac: constr(strip_whitespace=True, min_length=1, max_length=40)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: constr(strip_whitespace=True, min_length=1, max_length=1600)


class ChatRequest(BaseModel):
    message: constr(strip_whitespace=True, min_length=1, max_length=1600)
    zodiac: Optional[constr(strip_whitespace=True, min_length=1, max_length=40)] = None
    history: conlist(ChatTurn, max_items=12) = Field(default_factory=list)


def _firebase_app():
    try:
        return firebase_admin.get_app()
    except ValueError:
        project_id = os.getenv("FIREBASE_PROJECT_ID")
        if not project_id:
            raise HTTPException(
                status_code=503,
                detail="Firebase authentication is not configured on the AI service.",
            )

        service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if service_account_json:
            try:
                service_account = json.loads(service_account_json)
            except json.JSONDecodeError as error:
                logger.error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON")
                raise HTTPException(
                    status_code=503,
                    detail="Firebase authentication is not configured correctly.",
                ) from error
            try:
                credential = credentials.Certificate(service_account)
            except (TypeError, ValueError) as error:
                logger.exception("Firebase service-account credentials are invalid")
                raise HTTPException(
                    status_code=503,
                    detail="Firebase authentication is not configured correctly.",
                ) from error
        else:
            credential_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            if not credential_path:
                raise HTTPException(
                    status_code=503,
                    detail="Firebase service-account credentials are not configured.",
                )
            try:
                credential = credentials.Certificate(credential_path)
            except (TypeError, ValueError) as error:
                logger.exception("Firebase service-account credentials are invalid")
                raise HTTPException(
                    status_code=503,
                    detail="Firebase authentication is not configured correctly.",
                ) from error

        return firebase_admin.initialize_app(
            credential,
            options={"projectId": project_id},
        )


def verify_firebase_user(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in to use AI features.")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Sign in to use AI features.")

    app = _firebase_app()
    try:
        return firebase_auth.verify_id_token(token, check_revoked=True, app=app)
    except (
        firebase_auth.InvalidIdTokenError,
        firebase_auth.ExpiredIdTokenError,
        firebase_auth.RevokedIdTokenError,
        firebase_auth.UserDisabledError,
        firebase_auth.UserNotFoundError,
    ) as error:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.") from error
    except firebase_auth.CertificateFetchError as error:
        logger.exception("Firebase token verification could not fetch signing certificates")
        raise HTTPException(
            status_code=503,
            detail="Authentication is temporarily unavailable. Please try again.",
        ) from error
    except FirebaseError as error:
        logger.exception("Firebase authentication failed")
        raise HTTPException(
            status_code=503,
            detail="Authentication is temporarily unavailable. Please try again.",
        ) from error


def _openai_completion(messages):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI generation is not configured yet.")

    payload = json.dumps(
        {
            "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            "messages": messages,
            "max_tokens": 800,
            "temperature": 0.8,
        }
    ).encode("utf-8")
    request = Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=45) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        logger.error("OpenAI request failed with HTTP status %s", error.code)
        raise HTTPException(
            status_code=502,
            detail="AI generation is temporarily unavailable. Please try again.",
        ) from error
    except (URLError, TimeoutError) as error:
        logger.error("Could not reach the OpenAI service: %s", error)
        raise HTTPException(
            status_code=502,
            detail="Could not reach the AI service. Please try again.",
        ) from error
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        logger.error("OpenAI returned a response that could not be decoded")
        raise HTTPException(
            status_code=502,
            detail="The AI service returned an invalid response. Please try again.",
        ) from error

    choices = result.get("choices") if isinstance(result, dict) else None
    first_choice = choices[0] if isinstance(choices, list) and choices else None
    message = first_choice.get("message") if isinstance(first_choice, dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content.strip():
        logger.error("OpenAI returned no completion content")
        raise HTTPException(
            status_code=502,
            detail="The AI service returned an empty response. Please try again.",
        )
    return content.strip()


@router.post("/reports")
def generate_report(
    request: ReportRequest,
    _user=Depends(verify_firebase_user),
):
    return {
        "report": _openai_completion(
            [
                {
                    "role": "system",
                    "content": (
                        "You are Astro ACS, a warm and thoughtful astrology companion. "
                        "Write an original, personalized-for-the-zodiac-sign reading for the "
                        "requested time period. Astrology is for entertainment and reflection, "
                        "not a factual prediction. Never claim certainty or make medical, legal, "
                        "financial, or other high-stakes recommendations. For health topics, "
                        "offer only gentle general wellbeing reflections and encourage consulting "
                        "a qualified professional for concerns. Use concise, accessible language "
                        "with clear headings: Cosmic theme, Relationships, Work and purpose, "
                        "A moment for yourself, and Reflection prompt. Do not invent planetary "
                        "positions or claim to have calculated a birth chart."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Create a {request.plan} astrology reading for someone whose "
                        f"zodiac sign is {request.zodiac}."
                    ),
                },
            ]
        )
    }


@router.post("/chat")
def chat(
    request: ChatRequest,
    _user=Depends(verify_firebase_user),
):
    context = (
        f"The user's zodiac sign is {request.zodiac}. "
        if request.zodiac
        else "The user's zodiac sign is not known. "
    )
    messages = [
        {
            "role": "system",
            "content": (
                "You are Astro ACS, a friendly astrology consultation companion. "
                f"{context}"
                "Answer in a warm, conversational, non-judgmental way. Treat astrology "
                "as entertainment and a tool for reflection, never as certainty or fact. "
                "Do not give medical, legal, financial, or other high-stakes advice. "
                "For health concerns, encourage the user to consult a qualified professional. "
                "Be clear when you do not know something, do not invent chart calculations, "
                "and keep replies concise."
            ),
        }
    ]
    messages.extend(turn.dict() for turn in request.history)
    messages.append({"role": "user", "content": request.message})
    return {"reply": _openai_completion(messages)}
