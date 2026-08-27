import json
import os
import shutil
import subprocess
import tempfile
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "linuxdo-wecom.user.js"
INIT_SCRIPT_PATH = Path(tempfile.gettempdir()) / "linuxdo-wecom-smoke.user.js"
BROWSER_SCREENSHOT_PATH = Path(tempfile.gettempdir()) / "linuxdo-wecom-smoke.png"
BROWSER_IMAGE_VIEWER_PATH = Path(tempfile.gettempdir()) / "linuxdo-wecom-image-viewer.png"
WATERMARK_TEXT = "产品研发部 · 内部资料"
TEST_IMAGE_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
<rect width="640" height="360" rx="20" fill="#4389F5"/><circle cx="520" cy="85" r="44" fill="#BDE4FF"/>
<path d="M80 280l130-130 90 90 70-70 190 110H80z" fill="#DDEEFF"/>
<text x="42" y="64" fill="white" font-size="28">WeCom Image Preview</text></svg>"""
TEST_IMAGE = f"data:image/svg+xml,{quote(TEST_IMAGE_SVG)}"


HTML = """<!doctype html>
<html><head><meta charset="utf-8"><title>Linux DO Mock</title>
<link class="light-scheme" rel="stylesheet" media="all">
<link class="dark-scheme" rel="stylesheet" media="none">
<style>
input[type="search"] {
  height: 42px; padding: 8px 12px; border: 1px solid #9199a1; border-radius: 3px;
  background: #fff; box-shadow: inset 0 1px 3px rgba(0, 0, 0, .18); font: 18px serif;
}
</style>
</head><body>
<header class="d-header"><div id="current-user">
  <button data-user-card="demo"><img alt="demo" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23267ef0'/%3E%3Ctext x='20' y='26' text-anchor='middle' fill='white'%3ED%3C/text%3E%3C/svg%3E"></button>
</div></header>
<div id="main-outlet-wrapper">
  <aside class="sidebar-wrapper"><div class="sidebar-container">
    <a class="sidebar-section-link" href="/latest">最新话题</a>
    <a class="sidebar-section-link" href="/categories">分类</a>
  </div></aside>
  <main id="main-outlet"><ul id="navigation-bar">
    <li><a class="active" href="/latest">最新</a></li>
    <li><a href="/hot">热门</a></li>
  </ul></main>
</div>
<div id="reply-control"></div>
</body></html>"""


LATEST = {
    "users": [
        {"id": 1, "username": "alice", "name": "林晨"},
        {"id": 2, "username": "demo", "name": "我"},
    ],
    "topic_list": {
        "topics": [
            {
                "id": 101,
                "slug": "team-announcement",
                "title": "产品研发群｜八月版本发布安排",
                "category_id": 9,
                "posts_count": 3,
                "last_poster_username": "alice",
                "bumped_at": "2026-08-27T08:30:00Z",
                "unread": 2,
                "posters": [{"user_id": 1}],
            },
            {
                "id": 102,
                "slug": "design-review",
                "title": "设计评审：企业微信换肤方案",
                "category_id": 10,
                "posts_count": 8,
                "last_poster_username": "demo",
                "bumped_at": "2026-08-27T07:20:00Z",
                "posters": [{"user_id": 2}],
            },
        ]
    },
}


TOPIC = {
    "id": 101,
    "title": "产品研发群｜八月版本发布安排",
    "category_id": 9,
    "participant_count": 6,
    "posts_count": 2,
    "details": {
        "participants": [
            {"id": 1, "username": "alice", "name": "林晨"},
            {"id": 2, "username": "demo", "name": "我"},
            {"id": 3, "username": "bob", "name": "程旭东"},
            {"id": 4, "username": "carol", "name": "陈雨森"},
            {"id": 5, "username": "dave", "name": "周一凡"},
            {"id": 6, "username": "eve", "name": "郭绍华"},
        ]
    },
    "post_stream": {
        "stream": [1001, 1002],
        "posts": [
            {
                "id": 1001,
                "post_number": 1,
                "username": "alice",
                "name": "林晨",
                "created_at": "2026-08-27T08:30:00Z",
                "pinned": True,
                "cooked": (
                    "<p>大家好，八月版本已进入发布窗口，请按清单完成回归。</p>"
                    f'<a class="lightbox" href="{TEST_IMAGE}">'
                    f'<img src="{TEST_IMAGE}" alt="八月版本发布示意图" width="240" height="135"></a>'
                ),
                "actions_summary": [],
            },
            {
                "id": 1002,
                "post_number": 2,
                "username": "demo",
                "name": "我",
                "yours": True,
                "created_at": "2026-08-27T08:34:00Z",
                "cooked": "<p>收到，我会在今天下班前同步验证结果。</p>",
                "actions_summary": [],
            },
        ],
    },
}


CATEGORIES = {
    "category_list": {
        "categories": [
            {"id": 9, "name": "运营反馈", "slug": "feedback", "color": "267EF0"},
            {"id": 10, "name": "开发调优", "slug": "dev", "color": "07C160"},
        ]
    }
}


class FixtureHandler(BaseHTTPRequestHandler):
    routes = {
        "/latest.json": ("application/json", LATEST),
        "/unseen.json": ("application/json", LATEST),
        "/t/101.json": ("application/json", TOPIC),
        "/categories.json": ("application/json", CATEGORIES),
    }

    def do_GET(self) -> None:
        path = self.path.split("?", maxsplit=1)[0]
        if path in ("/", "/latest") or (path.startswith("/t/") and not path.endswith(".json")):
            self.respond("text/html; charset=utf-8", HTML.encode())
            return
        content_type, payload = self.routes.get(path, ("application/json", {}))
        status = 200 if path in self.routes else 404
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.respond(f"{content_type}; charset=utf-8", body, status)

    def respond(self, content_type: str, body: bytes, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format: str, *_args: object) -> None:
        return


def browser_command(cli: str, session: str, *args: str, init: bool = False) -> dict:
    command = [cli, "--session", session, "--json"]
    if init:
        command.extend(("--init-script", str(INIT_SCRIPT_PATH)))
    command.extend(args)
    env = {**os.environ, "NO_PROXY": "127.0.0.1,localhost"}
    with tempfile.TemporaryFile(mode="w+", encoding="utf-8") as stdout:
        with tempfile.TemporaryFile(mode="w+", encoding="utf-8") as stderr:
            result = subprocess.run(command, stdout=stdout, stderr=stderr, timeout=25, env=env)
            stdout.seek(0)
            stderr.seek(0)
            output = stdout.read()
            error = stderr.read()
    if result.returncode != 0:
        raise RuntimeError(f"{' '.join(command)}\n{output}\n{error}")
    lines = [line for line in output.splitlines() if line.strip().startswith("{")]
    if not lines:
        return {}
    payload = json.loads(lines[-1])
    if not payload.get("success", True):
        raise RuntimeError(str(payload))
    return payload


def evaluate(cli: str, session: str, expression: str):
    payload = browser_command(cli, session, "eval", expression)
    return payload["data"]["result"]


def verify_ui(cli: str, session: str, url: str) -> None:
    browser_command(cli, session, "open", url, init=True)
    browser_command(cli, session, "set", "viewport", "1440", "900")
    browser_command(cli, session, "wait", ".wecom-conv")
    assert evaluate(cli, session, "document.querySelectorAll('.wecom-conv').length") == 2
    assert evaluate(cli, session, "getComputedStyle(document.querySelector('.wecom-rail')).width") == "162px"
    rail_image = evaluate(cli, session, "getComputedStyle(document.querySelector('.wecom-rail')).backgroundImage")
    assert "linear-gradient" in rail_image
    search_style = evaluate(
        cli,
        session,
        "(() => { const s = getComputedStyle(document.querySelector('.wecom-list-search input')); "
        "return { background: s.backgroundColor, border: s.borderTopWidth, padding: s.paddingLeft, "
        "shadow: s.boxShadow, family: s.fontFamily }; })()",
    )
    assert search_style["background"] == "rgba(0, 0, 0, 0)"
    assert search_style["border"] == "0px"
    assert search_style["padding"] == "0px"
    assert search_style["shadow"] == "none"
    assert "Microsoft YaHei UI" in search_style["family"]
    browser_command(cli, session, "fill", ".wecom-list-search input", "版本发布")
    assert evaluate(cli, session, "document.querySelector('.wecom-list-search input').value") == "版本发布"
    browser_command(cli, session, "click", ".wecom-conv")
    browser_command(cli, session, "wait", ".wecom-msg-me")
    browser_command(cli, session, "wait", ".wecom-member-panel")
    assert evaluate(cli, session, "document.querySelector('.wecom-chat-title').textContent") == TOPIC["title"]
    assert evaluate(cli, session, "document.querySelectorAll('.wecom-msg').length") == 2
    image_selector = ".wecom-msg-other .wecom-msg-bubble img"
    browser_command(cli, session, "wait", image_selector)
    assert evaluate(cli, session, f"document.querySelector('{image_selector}').title") == "点击查看大图"
    assert evaluate(cli, session, f"document.querySelector('{image_selector}').tabIndex") == 0
    browser_command(cli, session, "click", image_selector)
    browser_command(cli, session, "wait", ".wecom-image-viewer:not([hidden])")
    close_visible = evaluate(
        cli,
        session,
        "(() => { const b = document.querySelector('.wecom-image-viewer-close').getBoundingClientRect(); "
        "return b.width >= 70 && b.height >= 36; })()",
    )
    assert close_visible
    assert evaluate(cli, session, "document.documentElement.classList.contains('wecom-image-viewer-open')")
    browser_command(cli, session, "screenshot", str(BROWSER_IMAGE_VIEWER_PATH))
    browser_command(cli, session, "click", ".wecom-image-viewer-close")
    assert evaluate(cli, session, "document.querySelector('.wecom-image-viewer').hidden")

    browser_command(cli, session, "click", image_selector)
    evaluate(cli, session, "document.querySelector('.wecom-image-viewer-stage').click()")
    assert evaluate(cli, session, "document.querySelector('.wecom-image-viewer').hidden")
    browser_command(cli, session, "click", image_selector)
    evaluate(cli, session, "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))")
    assert evaluate(cli, session, "document.querySelector('.wecom-image-viewer').hidden")
    assert evaluate(cli, session, "location.pathname") == "/t/team-announcement/101"
    mine_color = evaluate(cli, session, "getComputedStyle(document.querySelector('.wecom-msg-me .wecom-msg-bubble')).backgroundColor")
    assert mine_color == "rgb(189, 228, 255)"
    assert evaluate(cli, session, "document.querySelectorAll('.wecom-member-row').length") == 6
    assert evaluate(cli, session, "getComputedStyle(document.querySelector('.wecom-pinned-banner')).display") == "flex"
    assert evaluate(cli, session, "getComputedStyle(document.querySelector('.wecom-chat-panel')).right") == "192px"
    assert evaluate(cli, session, "location.pathname") == "/t/team-announcement/101"
    assert evaluate(cli, session, "getComputedStyle(document.querySelector('.wecom-chat-body')).backgroundImage") == "none"
    browser_command(cli, session, "click", ".wecom-watermark-settings")
    assert evaluate(cli, session, "document.querySelector('.wecom-watermark-panel').hidden") is False
    browser_command(cli, session, "fill", ".wecom-watermark-text", WATERMARK_TEXT)
    evaluate(
        cli,
        session,
        "document.querySelector('.wecom-watermark-enabled').click()",
    )
    preview_image = evaluate(cli, session, "getComputedStyle(document.querySelector('.wecom-chat-body')).backgroundImage")
    assert "data:image/svg+xml" in preview_image
    browser_command(cli, session, "click", ".wecom-watermark-save")
    assert evaluate(cli, session, "localStorage.getItem('linuxdo-wecom-watermark-enabled')") == "1"
    assert evaluate(cli, session, "localStorage.getItem('linuxdo-wecom-watermark-text')") == WATERMARK_TEXT
    assert evaluate(cli, session, "document.querySelector('.wecom-watermark-settings').classList.contains('is-on')")

    browser_command(cli, session, "click", ".wecom-watermark-settings")
    evaluate(cli, session, "document.querySelector('.wecom-watermark-enabled').click()")
    assert evaluate(cli, session, "getComputedStyle(document.querySelector('.wecom-chat-body')).backgroundImage") == "none"
    browser_command(cli, session, "click", ".wecom-watermark-save")
    assert evaluate(cli, session, "localStorage.getItem('linuxdo-wecom-watermark-enabled')") == "0"

    browser_command(cli, session, "click", ".wecom-watermark-settings")
    evaluate(cli, session, "document.querySelector('.wecom-watermark-enabled').click()")
    browser_command(cli, session, "click", ".wecom-watermark-save")
    saved_image = evaluate(cli, session, "getComputedStyle(document.querySelector('.wecom-chat-body')).backgroundImage")
    assert "data:image/svg+xml" in saved_image
    browser_command(cli, session, "click", ".wecom-list-add")
    assert evaluate(cli, session, "document.documentElement.classList.contains('wecom-nav2-open')")
    assert evaluate(cli, session, "getComputedStyle(document.querySelector('.sidebar-wrapper')).visibility") == "visible"
    browser_command(cli, session, "click", ".wecom-list-add")
    evaluate(cli, session, "document.querySelector('.wecom-mask-avatar-toggle').click()")
    assert evaluate(cli, session, "localStorage.getItem('linuxdo-wecom-mask-avatar')") == "1"
    evaluate(cli, session, "document.querySelector('.wecom-mask-avatar-toggle').click()")
    browser_command(cli, session, "screenshot", str(BROWSER_SCREENSHOT_PATH))
    browser_command(cli, session, "click", ".wecom-chat-native")
    browser_command(cli, session, "wait", ".wecom-mode-fab")
    assert evaluate(cli, session, "localStorage.getItem('linuxdo-wecom-view')") == "native"
    browser_command(cli, session, "click", ".wecom-mode-fab")
    browser_command(cli, session, "wait", ".wecom-msg-me")
    restored_image = evaluate(cli, session, "getComputedStyle(document.querySelector('.wecom-chat-body')).backgroundImage")
    assert "data:image/svg+xml" in restored_image


def main() -> None:
    wrapper = shutil.which("agent-browser")
    if not wrapper:
        raise RuntimeError("agent-browser is required; run browser-automation/scripts/setup.ps1")
    cli_path = Path(wrapper).parent / "node_modules" / "agent-browser" / "bin" / "agent-browser-win32-x64.exe"
    if not cli_path.is_file():
        raise RuntimeError(f"agent-browser native binary not found: {cli_path}")
    cli = str(cli_path)
    server = ThreadingHTTPServer(("127.0.0.1", 0), FixtureHandler)
    session = f"wecom-smoke-{uuid.uuid4().hex[:8]}"
    try:
        import threading

        shutil.copyfile(SCRIPT_PATH, INIT_SCRIPT_PATH)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{server.server_port}/latest"
        verify_ui(cli, session, url)
    finally:
        server.shutdown()
        subprocess.run(
            [cli, "--session", session, "close"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=15,
        )
        INIT_SCRIPT_PATH.unlink(missing_ok=True)
        BROWSER_SCREENSHOT_PATH.unlink(missing_ok=True)
        BROWSER_IMAGE_VIEWER_PATH.unlink(missing_ok=True)
    print("PASS: rail/list/topic/messages/watermark/image-viewer rendered")


if __name__ == "__main__":
    main()
