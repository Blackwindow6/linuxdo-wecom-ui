// ==UserScript==
// @name         Linux DO · 企业微信 IM 外观
// @namespace    https://linux.do/
// @version      0.4.4
// @description  将 Linux DO 换成企业微信 5.x 桌面端风格；保留原站数据、路由、通知与回复交互。
// @author       Richy
// @match        https://linux.do/*
// @icon         https://linux.do/favicon.ico
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  /* ============================== 常量 ============================== */

  const STYLE_ID = "linuxdo-wecom-theme";
  const FAVICON_ID = "wecom-favicon";
  const ROOT_CLASS = "wecom-im-theme";
  const LOCK_CLASS = "wecom-locked"; // 仅三栏路由挂载：隐藏原生主内容
  const VIEW_KEY = "linuxdo-wecom-view"; // "im" | "native"
  const LAST_READ_KEY = "linuxdo-wecom-last-read";
  const LAST_READ_MAX_TOPICS = 200;

  const RAIL_WIDTH = 162; // 企业微信 5.x 展开导航
  const NAV2_WIDTH = 240; // 展开栏（原生侧栏原样搬入，默认收起）
  const STRIP_WIDTH = 0; // 企业微信布局无窄条
  const LIST_WIDTH = 304; // 会话列表
  const MEMBER_WIDTH = 192; // 群成员栏
  const TITLEBAR_HEIGHT = 0; // 企业微信经典布局无全局顶栏
  const WATERMARK_ENABLED_KEY = "linuxdo-wecom-watermark-enabled";
  const WATERMARK_TEXT_KEY = "linuxdo-wecom-watermark-text";
  const DEFAULT_WATERMARK_TEXT = "linux.do · 内部资料";
  const WATERMARK_MAX_LENGTH = 48;
  const WATERMARK_TILE_WIDTH = 300;
  const WATERMARK_TILE_HEIGHT = 160;
  const AVATAR_SOURCE_SIZE = 96;
  const COMPOSER_READY_TIMEOUT_MS = 5000;
  const COMPOSER_SUBMIT_TIMEOUT_MS = 20000;
  const COMPOSER_INPUT_SETTLE_MS = 80;
  const COMPOSER_POLL_INTERVAL_MS = 50;
  const COMPOSER_STATUS_DURATION_MS = 3200;
  const POST_SYNC_RETRY_DELAYS_MS = [0, 240, 900];
  const POST_SYNC_BATCH_SIZE = 20;
  const UPLOAD_ENDPOINTS = ["/uploads.json", "/uploads"];
  const POST_ENDPOINTS = ["/posts.json", "/posts"];
  const RETRYABLE_ENDPOINT_STATUS = new Set([404, 405, 415]);
  const COMPOSER_ERROR_PREVIEW_LENGTH = 240;
  const NATIVE_COMPOSER_TEXTAREA = "#reply-control textarea.d-editor-input, #reply-control textarea";
  const NATIVE_COMPOSER_SUBMIT = [
    "#reply-control .save-or-cancel button.create",
    "#reply-control .save-or-cancel button.btn-primary",
    "#reply-control button.create.btn-primary"
  ].join(", ");
  const NATIVE_COMPOSER_ERROR = [
    "#reply-control .alert-error",
    "#reply-control .alert.alert-error",
    "#reply-control .composer-error",
    "#reply-control .validation-error",
    "#reply-control .popup-tip.bad",
    "#reply-control [role='alert']"
  ].join(", ");

  const AVATAR_COLORS = [
    "#267EF0", "#07C160", "#5B8FF9", "#8B6CFF",
    "#10B981", "#E6A23C", "#61758A", "#E85D5D"
  ];

  /* ============================== 内联 SVG 图标 ============================== */

  const ICONS = {
    msg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-4.2 3.2A.8.8 0 0 1 4.5 18.6V6.5Z" stroke="currentColor" stroke-width="1.7"/></svg>`,
    doc: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M7 4.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V6A1.5 1.5 0 0 1 7 4.5Z" stroke="currentColor" stroke-width="1.7"/><path d="M14 4.5V9h4.5" stroke="currentColor" stroke-width="1.7"/></svg>`,
    work: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="7" height="7" rx="1.4" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="4" width="7" height="7" rx="1.4" stroke="currentColor" stroke-width="1.7"/><rect x="4" y="13" width="7" height="7" rx="1.4" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="13" width="7" height="7" rx="1.4" stroke="currentColor" stroke-width="1.7"/></svg>`,
    book: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M9 9h6M9 13h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    meet: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4.5 8.5A2.5 2.5 0 0 1 7 6h6.5A2.5 2.5 0 0 1 16 8.5v7A2.5 2.5 0 0 1 13.5 18H7A2.5 2.5 0 0 1 4.5 15.5v-7Z" stroke="currentColor" stroke-width="1.7"/><path d="M16 10.2l4-2.2v8l-4-2.2" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
    disk: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 8.5L12 4l8 4.5v7L12 20 4 15.5v-7Z" stroke="currentColor" stroke-width="1.7"/><path d="M12 20v-7.5M4 8.5l8 4 8-4" stroke="currentColor" stroke-width="1.7"/></svg>`,
    cal: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4.5" y="5.5" width="15" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M8 4v3M16 4v3M4.5 10h15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    todo: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M8 9h8M8 13h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    ding: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 4v3M8 8a4 4 0 1 1 8 0c0 3-4 4.5-4 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="18.5" r="1.3" fill="currentColor"/></svg>`,
    proj: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 8h14v10.5A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5V8Z" stroke="currentColor" stroke-width="1.7"/><path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8" stroke="currentColor" stroke-width="1.7"/></svg>`,
    mail: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M5 8l7 5 7-5" stroke="currentColor" stroke-width="1.7"/></svg>`,
    apps: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="7" cy="7" r="2.1" stroke="currentColor" stroke-width="1.7"/><circle cx="17" cy="7" r="2.1" stroke="currentColor" stroke-width="1.7"/><circle cx="7" cy="17" r="2.1" stroke="currentColor" stroke-width="1.7"/><circle cx="17" cy="17" r="2.1" stroke="currentColor" stroke-width="1.7"/></svg>`,
    build: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M7 19V9l5-4 5 4v10" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10 19v-5h4v5" stroke="currentColor" stroke-width="1.7"/></svg>`,
    more: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="6" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18" cy="12" r="1.4" fill="currentColor"/></svg>`,
    clock: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.7"/><path d="M12 8v4l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    grid: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="5" y="5" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="5" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.7"/><rect x="5" y="13" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="13" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.7"/></svg>`,
    spark: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.6 5.2L19 10l-5.4 1.8L12 17l-1.6-5.2L5 10l5.4-1.8L12 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
    phone: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 4.5h3.2l1 3.2-2 1.4a11 11 0 0 0 5.7 5.7l1.4-2 3.2 1V17a2 2 0 0 1-2.2 2A15 15 0 0 1 5 6.7 2 2 0 0 1 7 4.5Z" stroke="currentColor" stroke-width="1.6"/></svg>`,
    plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    mute: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M10 8H7v8h3l5 3V5l-5 3Z" stroke="currentColor" stroke-width="1.6"/><path d="M18 9l3 3-3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    bell: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 16h12l-1.2-2.2a6.5 6.5 0 0 1-.8-3.3V9a4 4 0 1 0-8 0v1.5c0 1.16-.28 2.3-.8 3.3L6 16Z" stroke="currentColor" stroke-width="1.6"/><path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.6"/></svg>`,
    users: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="9" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M4.5 18a4.5 4.5 0 0 1 9 0" stroke="currentColor" stroke-width="1.6"/><circle cx="16.5" cy="9.5" r="2.3" stroke="currentColor" stroke-width="1.6"/><path d="M15 18c.4-1.6 1.6-2.8 3.4-3.2" stroke="currentColor" stroke-width="1.6"/></svg>`,
    win: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="5" y="6" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M5 10h14" stroke="currentColor" stroke-width="1.6"/></svg>`,
    gear: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.4 6.4l1.4 1.4M16.2 16.2l1.4 1.4M17.6 6.4l-1.4 1.4M7.8 16.2l-1.4 1.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    emoji: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 14.2c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg>`,
    like: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8 11V20H6a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h2Zm0 0 3.2-6.2A2 2 0 0 1 13 3.6V8h5.2a2 2 0 0 1 1.96 2.4l-1.2 6A2 2 0 0 1 17 18h-9" stroke="currentColor" stroke-width="1.6"/></svg>`,
    cut: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="7" cy="17" r="2.2" stroke="currentColor" stroke-width="1.6"/><circle cx="17" cy="17" r="2.2" stroke="currentColor" stroke-width="1.6"/><path d="M8.8 15.4L16 5M15.2 15.4L8 5" stroke="currentColor" stroke-width="1.6"/></svg>`,
    folder: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 8h6l2 2h8v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" stroke="currentColor" stroke-width="1.6"/></svg>`,
    pic: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="10" r="1.4" stroke="currentColor" stroke-width="1.4"/><path d="M5 16l4.5-4 3 3 2-2L19 16" stroke="currentColor" stroke-width="1.6"/></svg>`,
    collect: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5l1.7 4.4H18l-3.5 2.7 1.3 4.4L12 14.6 8.2 16.5l1.3-4.4L6 9.4h4.3L12 5Z" stroke="currentColor" stroke-width="1.6"/></svg>`,
    file: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M7 4h7l4 4v12H7V4Z" stroke="currentColor" stroke-width="1.6"/><path d="M14 4v4h4" stroke="currentColor" stroke-width="1.6"/></svg>`,
    bolt: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M13 3L6 14h6l-1 7 7-11h-6l1-7Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
    cam: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="7" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M15.5 10.5l5-2.5v8l-5-2.5" stroke="currentColor" stroke-width="1.6"/></svg>`,
    redpack: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="6" y="4" width="12" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M6 9h12" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="9" r="1.6" fill="currentColor"/></svg>`,
    dots: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/></svg>`,
    expand: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M14 6h4v4M10 18H6v-4M18 6l-5 5M6 18l5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    refresh: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 1 1-2.3-5.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M20 4v5h-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    external: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M14 5h5v5M19 5l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 7H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4" stroke="currentColor" stroke-width="1.6"/></svg>`,
    reply: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 14L4 9l5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9h10a6 6 0 0 1 0 12h-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    menu: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M7 12h10M10 17h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    chevronDown: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    chevronUp: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 15l6-6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    compose: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 17.5V20h2.5L18 8.5 15.5 6 4 17.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M13.8 7.7l2.5 2.5" stroke="currentColor" stroke-width="1.6"/></svg>`,
    filter: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h11M4 18h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    disguise: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" stroke-width="1.6"/><path d="M8 14c1.2 1.4 2.5 2 4 2s2.8-.6 4-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg>`,
    aitable: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="4.5" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M4 9.5h16M9.6 9.5v10M15.4 9.5v10" stroke="currentColor" stroke-width="1.7"/></svg>`,
    aimic: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="9" y="3.5" width="6" height="11" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    monitor: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M9 20.5h6M12 17v3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    at: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.6"/><path d="M15.2 8.8v4.4a2.4 2.4 0 0 0 4.8 0V12a8 8 0 1 0-3.4 6.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`
  };
  ICONS.chat = ICONS.msg;
  ICONS.list = ICONS.msg;
  ICONS.calendar = ICONS.cal;
  ICONS.worktable = ICONS.work;
  ICONS.cloud = ICONS.doc;
  ICONS.wiki = ICONS.doc;
  ICONS.task = ICONS.todo;
  ICONS.contacts = ICONS.book;
  ICONS.project = ICONS.proj;
  ICONS.watermark = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 18.5h14M8 16l4-10 4 10M9.4 12.5h5.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 5.5l1 1 2-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const FAVICON_URI = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJhIiB4MT0iOCIgeTE9IjQiIHgyPSI1NiIgeTI9IjYwIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHN0b3Agc3RvcC1jb2xvcj0iIzQwOTZmZiIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzE3NjlkMiIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgcng9IjE1IiBmaWxsPSJ1cmwoI2EpIi8+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTExIDI3LjVDMTEgMTguOTQgMTguODQgMTIgMjguNSAxMlM0NiAxOC45NCA0NiAyNy41IDM4LjE2IDQzIDI4LjUgNDNjLTIuMTMgMC00LjE3LS4zNC02LjA2LS45NUwxNCA0N2wyLjQ4LTcuMTZDMTMuMSAzNi45MSAxMSAzMi41NSAxMSAyNy41WiIvPjxwYXRoIGZpbGw9IiMxOWM4NzgiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIyLjUiIGQ9Ik0zNCAzNy41QzM0IDMwLjYgNDAuMjcgMjUgNDggMjVzMTQgNS42IDE0IDEyLjVTNTUuNzMgNTAgNDggNTBjLTEuNTUgMC0zLjA0LS4yMy00LjQzLS42NUwzNyA1M2wxLjg0LTUuMjNDMzUuODcgNDUuMzkgMzQgNDEuNzMgMzQgMzcuNVoiLz48Y2lyY2xlIGN4PSIyMyIgY3k9IjI3IiByPSIyIiBmaWxsPSIjMjY3ZWYwIi8+PGNpcmNsZSBjeD0iMzMiIGN5PSIyNyIgcj0iMiIgZmlsbD0iIzI2N2VmMCIvPjxjaXJjbGUgY3g9IjQ0IiBjeT0iMzcuNSIgcj0iMS43IiBmaWxsPSIjZmZmIi8+PGNpcmNsZSBjeD0iNTIiIGN5PSIzNy41IiByPSIxLjciIGZpbGw9IiNmZmYiLz48L3N2Zz4=";


  /* ============================== 工具函数 ============================== */

  function escapeHtml(text) {
    return String(text ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function debounce(fn, wait) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function avatarColor(name) {
    let hash = 0;
    const s = String(name || "?");
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  function avatarLetter(name) {
    const s = String(name || "?").trim();
    const ch = [...s][0] || "?";
    return /[a-z]/i.test(ch) ? ch.toUpperCase() : ch;
  }

  /** 优先用户显示名（name），再退回 username */
  function userDisplayName(user, fallback) {
    const name = user && String(user.name || "").trim();
    if (name) return name;
    const uname = user && String(user.username || "").trim();
    if (uname) return uname;
    return String(fallback || "?").trim() || "?";
  }

  /* ---------- 会话伪装头像（圆角矩形单字） ---------- */
  const MASK_AVATAR_KEY = "linuxdo-wecom-mask-avatar"; // "1" = 开

  function isMaskAvatar() {
    try { return localStorage.getItem(MASK_AVATAR_KEY) === "1"; } catch { return false; }
  }

  function setMaskAvatar(on) {
    try { localStorage.setItem(MASK_AVATAR_KEY, on ? "1" : "0"); } catch { /* ignore */ }
    const panel = document.querySelector(".wecom-list-panel");
    ensureMaskAvatarToggle(panel);
    // 列表若还没数据，先别空转；有数据则立刻重绘头像
    if (listState.topics && listState.topics.length) {
      renderListRows();
    } else if (panel) {
      // 兜底：按当前路由拉一次列表再绘
      loadList(listState.apiPath || listApiForPath(location.pathname) || "/latest.json", true);
    }
  }


  const SURNAMES = [
    "赵","钱","孙","李","周","吴","郑","王","冯","陈","褚","卫","蒋","沈","韩","杨","朱","秦","尤","许",
    "何","吕","施","张","孔","曹","严","华","金","魏","陶","姜","戚","谢","邹","喻","柏","水","窦","章",
    "云","苏","潘","葛","奚","范","彭","郎","鲁","韦","昌","马","苗","凤","花","方","俞","任","袁","柳",
    "酆","鲍","史","唐","费","廉","岑","薛","雷","贺","倪","汤","滕","殷","罗","毕","郝","邬","安","常",
    "乐","于","时","傅","皮","卞","齐","康","伍","余","元","卜","顾","孟","平","黄","和","穆","萧","尹"
  ];

  function surnameForTopic(topic) {
    const idx = Math.abs(Number(topic.id) || 0) % SURNAMES.length;
    return SURNAMES[idx];
  }

  /**
   * 伪装头像：圆角矩形 + 百家姓单字
   * @returns {{ html: string, bg: string, className: string, styleExtra: string }}
   */
  function disguiseAvatarForTopic(topic) {
    const ch = surnameForTopic(topic);
    const color = avatarColor(ch + String(topic.id || 0));
    return {
      html: `<span class="wecom-avatar-text" data-len="1">${escapeHtml(ch)}</span>`,
      bg: color,
      className: "is-text-avatar is-solid",
      styleExtra: "color:#fff;"
    };
  }

  /** 隐私模式下随机一半话题使用九宫格姓氏头像 */
  function isGridMaskTopic(topic) {
    return isMaskAvatar() && (Math.abs(Number(topic.id) || 0) % 2 === 0);
  }

  const MASK_GRID_BLUES = [
    "#0A6FE0", "#1A87FF", "#2F88FF", "#3B92FF", "#4B7CFF",
    "#5B8FFF", "#6BA0FF", "#7CB1FF", "#8DC2FF"
  ];

  function disguiseGridAvatar(topic) {
    const cells = [];
    const seed = Math.abs(Number(topic.id) || 0);
    for (let i = 0; i < 9; i++) {
      const ch = SURNAMES[(seed + i * 17) % SURNAMES.length];
      const color = MASK_GRID_BLUES[(seed + i) % MASK_GRID_BLUES.length];
      cells.push(`<span style="background:${color}">${escapeHtml(ch)}</span>`);
    }
    return `<span class="wecom-conv-avatar is-grid-mask" style="background:transparent">${cells.join("")}</span>`;
  }


  function ensureMaskAvatarToggle(panel) {
    if (!panel) return;
    const actions = panel.querySelector(".wecom-list-actions");
    if (!actions) return;
    let btn = actions.querySelector(".wecom-mask-avatar-toggle");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wecom-icon-btn wecom-mask-avatar-toggle";
      btn.innerHTML = ICONS.disguise;
      actions.insertBefore(btn, actions.firstChild);
    }
    // 直接绑在按钮上，避免旧面板 linkBound 已占用导致点不到
    if (btn.dataset.bound !== "1") {
      btn.dataset.bound = "1";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        setMaskAvatar(!isMaskAvatar());
      });
    }
    const on = isMaskAvatar();
    btn.title = on ? "伪装头像：开（点击恢复真实头像）" : "伪装头像：关（点击开启）";
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.classList.toggle("is-on", on);
  }

  function fullAvatarUrl(template) {
    if (!template) return "";
    const url = template.replace("{size}", String(AVATAR_SOURCE_SIZE));
    if (/^(?:data:|blob:|https?:)/i.test(url)) return url;
    return new URL(url, location.origin).href;
  }

  function formatTime(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const now = Date.now();
    const diff = now - date.getTime();
    const minute = 60e3, hour = 3600e3, day = 86400e3;
    if (diff < minute) return "刚刚";
    if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
    if (diff < day && date.getDate() === new Date().getDate()) {
      return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    }
    if (diff < 2 * day) return "昨天";
    if (diff < 365 * day) return `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, "0")}`;
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }

  function formatClock(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  async function api(path, options = {}) {
    const resp = await fetch(path, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      ...options
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  let cachedUsername = null;
  let cachedUserId = null;

  function normalizeUsername(name) {
    return String(name ?? "").trim().replace(/^@/, "").toLowerCase();
  }

  function normalizeUserId(value) {
    const id = String(value ?? "").trim();
    return id ? id.toLowerCase() : "";
  }

  function extractUsernameFromHref(href) {
    if (!href) return null;
    try {
      const path = new URL(href, location.origin).pathname;
      const match = path.match(/^\/u\/([^/?#]+)/i);
      return match ? decodeURIComponent(match[1]) : null;
    } catch {
      return null;
    }
  }

  function parseUserCard(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : { username: raw };
    } catch {
      return { username: raw };
    }
  }

  function usernameFromElement(element) {
    if (!element) return null;
    const fromHref = extractUsernameFromHref(element.getAttribute("href") || "");
    if (fromHref) return fromHref;
    const card = parseUserCard(element.getAttribute("data-user-card"));
    const name = card?.username || card?.user?.username ||
      element.getAttribute("data-username") || element.getAttribute("data-user-name");
    return name ? String(name).trim() : null;
  }

  function userIdFromElement(element) {
    if (!element) return "";
    for (const attr of ["data-user-id", "data-user-id-value", "data-id"]) {
      const value = normalizeUserId(element.getAttribute(attr));
      if (value) return value;
    }
    return "";
  }

  function preloadedCurrentUser() {
    try {
      const element = document.getElementById("data-preloaded");
      const raw = element?.getAttribute("data-preloaded") || element?.textContent;
      if (!raw) return null;
      const data = JSON.parse(raw);
      const candidates = [data.currentUser, data.current_user];
      for (const key of Object.keys(data || {})) {
        if (/current.?user/i.test(key)) candidates.push(data[key]);
      }
      for (const candidate of candidates) {
        const record = typeof candidate === "string" ? parseUserCard(candidate) : candidate;
        if (record?.username || record?.user?.username || record?.id) return record;
      }
    } catch { /* 页面尚未完成预加载时稍后重试 */ }
    return null;
  }

  function rememberCurrentUser(record) {
    const username = record?.username || record?.user?.username;
    const id = record?.id ?? record?.user?.id;
    if (username) cachedUsername = String(username).trim();
    if (id != null && String(id).trim()) cachedUserId = normalizeUserId(id);
  }

  function getCurrentUserIdentity() {
    if (cachedUsername || cachedUserId) return { username: cachedUsername, id: cachedUserId };
    const selectors = [
      "#current-user",
      ".header-dropdown-toggle.current-user",
      ".current-user",
      "button.icon.btn-flat[data-user-card]"
    ];
    for (const selector of selectors) {
      const root = document.querySelector(selector);
      if (!root) continue;
      const elements = [root, ...root.querySelectorAll("a[href*='/u/'], [data-user-card], [data-username]")];
      let found = false;
      for (const element of elements) {
        const username = usernameFromElement(element);
        const id = userIdFromElement(element);
        if (username || id) {
          rememberCurrentUser({ username, id });
          found = true;
        }
      }
      if (found) return { username: cachedUsername, id: cachedUserId };
    }
    const image = document.querySelector("#current-user img[alt], .current-user img[alt]");
    if (image?.alt && !/avatar|头像/i.test(image.alt)) {
      rememberCurrentUser({ username: image.alt.trim() });
      return { username: cachedUsername, id: cachedUserId };
    }
    const preloaded = preloadedCurrentUser();
    if (preloaded) {
      rememberCurrentUser(preloaded);
      return { username: cachedUsername, id: cachedUserId };
    }
    try {
      const owner = window.Discourse?.__container__ ||
        document.querySelector(".ember-application")?.__ember_meta__?.owner;
      const user = owner?.lookup?.("service:current-user") || window.Discourse?.User?.current?.();
      const record = { username: user?.username || user?.get?.("username"), id: user?.id || user?.get?.("id") };
      if (record.username || record.id) rememberCurrentUser(record);
    } catch { /* Ember 尚未就绪时由下一次调用重试 */ }
    return { username: cachedUsername, id: cachedUserId };
  }

  function getCurrentUsername() {
    return getCurrentUserIdentity().username;
  }

  function booleanFlag(value) {
    return value === true || value === 1 || value === "1" ||
      (typeof value === "string" && value.trim().toLowerCase() === "true");
  }

  function postUsername(post) {
    return post?.username || post?.user?.username || post?.author?.username || "";
  }

  function postUserId(post) {
    return post?.user_id ?? post?.author_id ?? post?.user?.id ?? post?.author?.id ?? "";
  }

  function isMyPost(post, myName) {
    if (!post) return false;
    if (booleanFlag(post.yours) || booleanFlag(post.mine) || booleanFlag(post.is_my_post)) return true;
    const identity = getCurrentUserIdentity();
    const myId = normalizeUserId(identity.id);
    const postId = normalizeUserId(postUserId(post));
    if (myId && postId && myId === postId) return true;
    const me = normalizeUsername(myName || identity.username);
    const author = normalizeUsername(postUsername(post));
    return Boolean(me && author && me === author);
  }

  function isTopicPath(pathname) {
    return /^\/t\//.test(pathname);
  }

  /** /t/:slug/:id(/:post) 或 /t/:id(/:post) */
  function topicRouteFromPath(pathname) {
    const parts = String(pathname || "").split("/").filter(Boolean);
    if (parts[0] !== "t" || parts.length < 2) return { topicId: null, postNumber: 0, slug: "" };
    const postOf = (value) => (/^\d+$/.test(value || "") ? Number(value) : 0);
    if (/^\d+$/.test(parts[1])) {
      return { topicId: Number(parts[1]), postNumber: postOf(parts[2]), slug: "" };
    }
    if (/^\d+$/.test(parts[2] || "")) {
      return { topicId: Number(parts[2]), postNumber: postOf(parts[3]), slug: parts[1] };
    }
    return { topicId: null, postNumber: 0, slug: parts[1] || "" };
  }

  function topicIdFromPath(pathname) {
    return topicRouteFromPath(pathname).topicId;
  }

  function postNumberFromPath(pathname) {
    return topicRouteFromPath(pathname).postNumber;
  }

  function readLastReadMap() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LAST_READ_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function getRememberedPost(topicId) {
    const n = Number(readLastReadMap()[topicId]) || 0;
    return n > 0 ? n : 0;
  }

  function rememberedPostForTopic(topic) {
    if (!topic) return 0;
    return getRememberedPost(topic.id) || Number(topic.last_read_post_number) || 0;
  }

  function isHomePath(pathname) {
    return pathname === "/" ||
      /^\/(latest|new|unread|unseen|top|categories|hot|posted|read|bookmarks)\b/.test(pathname) ||
      /^\/c\//.test(pathname) || /^\/tag\//.test(pathname);
  }

  /** 中栏列表 JSON 端点按路由映射 */
  function listApiForPath(pathname) {
    if (pathname === "/" || pathname === "/latest") return "/latest.json";
    if (pathname === "/new") return "/new.json";
    if (pathname === "/unread" || pathname === "/unseen") return "/unseen.json";
    if (pathname === "/top") return "/top.json";
    if (pathname === "/hot") return "/hot.json";
    if (pathname === "/posted") return "/posted.json";
    if (pathname === "/read") return "/read.json";
    if (pathname === "/bookmarks") return "/bookmarks.json";
    // 类别页本身不是话题流；中栏仍拉 latest，避免 categories.json 无 topic_list
    if (pathname === "/categories") return "/latest.json";
    const c = pathname.match(/^\/c\/([\w-]+(?:\/[\w-]+)?)/);
    if (c) return `/c/${c[1]}.json`;
    const t = pathname.match(/^\/tag\/([\w-]+)/);
    if (t) return `/tag/${t[1]}.json`;
    return "/latest.json";
  }

  /* ============================== CSS ============================== */

  const RAW_CSS = String.raw`
    /* ---------- Token ---------- */
    .${ROOT_CLASS} {
      color-scheme: light !important;
      --wc-blue: #1A87FF;
      --wc-blue-hover: #0A6FE0;
      --wc-blue-soft: #E8F3FF;
      --wc-blue-chip: #D6EBFF;
      --wc-title: #1A87FF;
      --wc-accent: #1A87FF;
      --wc-accent-soft: #E8F3FF;
      --wc-nav2-bg: #FFFFFF;
      --wc-nav2-border: #E6E8EB;
      --wc-text: #1A1D24;
      --wc-text-2: #4A4F5C;
      --wc-text-3: #8A8F99;
      --wc-text-4: #B0B4BE;
      --wc-bg: #FFFFFF;
      --wc-chat-bg: #F5F7FB;
      --wc-hover: #ECF0F7;
      --wc-active: #E4EAF5;
      --wc-bubble-other: #FFFFFF;
      --wc-bubble-me: #D4E5FF;
      --wc-border: #E6E8EB;
      --wc-border-strong: #D5D8DE;
      --wc-danger: #FF4D4F;
      --wc-rail-bg: #F3F4F6;
      --wc-strip-bg: transparent;
      --wc-nav: ${RAIL_WIDTH}px;
      --wc-nav2w: 0px;
      --wc-strip: ${STRIP_WIDTH}px;
      --wc-list: ${LIST_WIDTH}px;
      --wc-header-h: ${TITLEBAR_HEIGHT}px;
      --wc-font: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Inter, -apple-system, BlinkMacSystemFont, sans-serif;
      --radius: 8px;

      --primary: var(--wc-text);
      --primary-medium: var(--wc-text-2);
      --primary-low: var(--wc-text-3);
      --secondary: var(--wc-bg);
      --tertiary: var(--wc-accent);
      --header_background: #FFFFFF;
      --header_primary: var(--wc-text);
      --d-hover: var(--wc-hover);
    }

    /* 整站写死光明：覆盖系统/站点暗色偏好 */
    html.${ROOT_CLASS},
    html.${ROOT_CLASS} body {
      color-scheme: light !important;
    }

    /* ---------- 字体与基础 ---------- */
    .${ROOT_CLASS} body { font-family: var(--wc-font) !important; }

    /* 站点无全局 border-box：自绘面板统一盒模型，否则 padding 会加宽导致互相堆叠 */
    .wecom-rail, .wecom-rail *,
    .wecom-strip, .wecom-strip *,
    .wecom-list-panel, .wecom-list-panel *,
    .wecom-chat-panel, .wecom-chat-panel *,
    .wecom-mode-fab { box-sizing: border-box; }

    /* ---------- 顶栏视觉隐藏（保留 DOM，供 user-menu 挂载/点击） ---------- */
    .${ROOT_CLASS} .d-header-wrap,
    .${ROOT_CLASS} .d-header {
      position: fixed !important;
      left: 0 !important; top: 0 !important;
      width: 0 !important; height: 0 !important;
      max-width: 0 !important; max-height: 0 !important;
      overflow: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      margin: 0 !important; padding: 0 !important;
      border: none !important;
      clip: rect(0, 0, 0, 0) !important;
      z-index: -1 !important;
    }
    /* 允许脚本对用户按钮做 programmatic click */
    .${ROOT_CLASS} #current-user,
    .${ROOT_CLASS} #toggle-current-user,
    .${ROOT_CLASS} .header-dropdown-toggle.current-user {
      pointer-events: auto !important;
    }
    .${ROOT_CLASS} #main-outlet-wrapper {
      padding-top: var(--wc-header-h) !important;
      margin-left: calc(var(--wc-nav) + var(--wc-nav2w) + var(--wc-strip)) !important;
    }

    /* ---------- 展开栏：原生侧栏原样搬入（内容与文案不变，≡ 滑出） ---------- */
    .${ROOT_CLASS}.wecom-nav2-open { --wc-nav2w: ${NAV2_WIDTH}px; }
    html.${ROOT_CLASS} body .sidebar-wrapper {
      display: block !important;
      position: fixed;
      left: var(--wc-nav); top: 0; bottom: 0;
      width: ${NAV2_WIDTH}px !important;
      background-color: #FFFFFF !important;
      background-image: none !important;
      backdrop-filter: none !important;
      box-shadow: none !important;
      border-right: 1px solid var(--wc-border);
      z-index: 600;
      transform: translateX(-105%);
      visibility: hidden;
      transition: transform 0.18s ease, visibility 0.18s;
      /* 站点可能是深色方案：强制企业微信浅色调色板 */
      --primary: var(--wc-text);
      --primary-medium: var(--wc-text-2);
      --primary-low: var(--wc-text-3);
      --primary-low-mid: #BBBFC4;
      --primary-very-low: #F0F2F5;
      --primary-50: #F5F6F7;
      --primary-100: #EBEDEF;
      --primary-200: #E8E9EB;
      --primary-300: #DEE0E3;
      --secondary: #FFFFFF;
      --tertiary: var(--wc-accent);
      --quaternary: var(--wc-accent);
      --d-hover: var(--wc-hover);
      --d-sidebar-background: #FFFFFF;
      --d-sidebar-border-color: var(--wc-border);
      color: var(--wc-text);
    }
    /* 可能盖住白底的子层/伪层一律透明 */
    html.${ROOT_CLASS} body .sidebar-wrapper *,
    html.${ROOT_CLASS} body .sidebar-wrapper *::before,
    html.${ROOT_CLASS} body .sidebar-wrapper *::after {
      background-color: transparent !important;
      background-image: none !important;
      backdrop-filter: none !important;
    }
    .${ROOT_CLASS}.wecom-nav2-open .sidebar-wrapper {
      transform: none;
      visibility: visible;
    }
    /*
     * 锁定态把 #main-outlet-wrapper 设成 pointer-events:none，
     * 而 Discourse 的 .sidebar-wrapper 在其内部 → 展开后只能看不能点。
     * 侧栏自身及子元素显式恢复点击。
     */
    .${ROOT_CLASS} .sidebar-wrapper,
    .${ROOT_CLASS} .sidebar-wrapper * {
      pointer-events: auto !important;
    }
    html.${ROOT_CLASS} body .sidebar-wrapper .sidebar-container {
      height: 100%;
      border-right: none;
    }
    /* 侧栏内部元素统一到企业微信浅色观感 */
    .${ROOT_CLASS} .sidebar-wrapper .sidebar-section-header,
    .${ROOT_CLASS} .sidebar-wrapper .sidebar-section-header-text {
      color: var(--wc-text-3) !important;
    }
    .${ROOT_CLASS} .sidebar-wrapper .sidebar-section-link {
      color: var(--wc-text-2) !important;
      border-radius: 8px;
      transition: background-color 0.15s;
    }
    html.${ROOT_CLASS} body .sidebar-wrapper .sidebar-section-link:hover {
      background-color: var(--wc-hover) !important;
      color: var(--wc-text) !important;
    }
    html.${ROOT_CLASS} body .sidebar-wrapper .sidebar-section-link.active {
      background-color: var(--wc-active) !important;
      color: var(--wc-accent) !important;
    }
    .${ROOT_CLASS} .sidebar-wrapper .sidebar-section-content svg,
    .${ROOT_CLASS} .sidebar-wrapper .sidebar-section-link-prefix {
      color: var(--wc-text-3);
    }
    /* 底部黑色聊天抽屉与侧栏底栏（用户栏）会破坏三栏观感，隐藏（不限于 sidebar 内部） */
    .${ROOT_CLASS} .chat-drawer-container,
    .${ROOT_CLASS} #chat-drawer,
    .${ROOT_CLASS} .chat-drawer,
    .${ROOT_CLASS} [class*="sidebar-footer"],
    .${ROOT_CLASS} [id*="chat-drawer"] {
      display: none !important;
    }

    /* ---------- 窄图标条：假 icon（纯装饰） ---------- */
    .wecom-strip {
      display: none !important;
    }
    .wecom-strip-item {
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: var(--wc-text-2);
      position: relative; flex-shrink: 0;
      cursor: default; user-select: none;
    }
    .wecom-strip-item svg { width: 17px; height: 17px; }
    .wecom-strip-badge {
      position: absolute; top: -4px; right: -10px;
      min-width: 14px; height: 14px; padding: 0 4px;
      background: var(--wc-danger); color: #fff;
      font-size: 9px; line-height: 14px; text-align: center;
      border-radius: 7px; font-weight: 500;
    }
    /* 左侧栏头像通知：仅在 html.wecom-notif-open 时显示，避免关不掉 */
    .${ROOT_CLASS} .user-menu.wecom-user-menu-float,
    .${ROOT_CLASS} .user-menu.revamped.menu-panel.wecom-user-menu-float,
    .${ROOT_CLASS} .user-menu.menu-panel.wecom-user-menu-float {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    .${ROOT_CLASS}.wecom-notif-open .user-menu.wecom-user-menu-float,
    .${ROOT_CLASS}.wecom-notif-open .user-menu.revamped.menu-panel.wecom-user-menu-float,
    .${ROOT_CLASS}.wecom-notif-open .user-menu.menu-panel.wecom-user-menu-float {
      display: block !important;
      position: fixed !important;
      left: 8px !important;
      top: calc(var(--wc-header-h) + 4px) !important;
      right: auto !important;
      bottom: auto !important;
      width: 320px !important;
      max-width: min(320px, calc(100vw - 20px)) !important;
      max-height: calc(100vh - 28px) !important;
      margin: 0 !important;
      z-index: 450 !important;
      box-shadow: 0 8px 28px rgba(31, 35, 41, 0.18) !important;
      border-radius: 8px !important;
      overflow: auto !important;
      pointer-events: auto !important;
      opacity: 1 !important;
      visibility: visible !important;
      background: #fff !important;
      color: var(--wc-text) !important;
      clip: auto !important;
    }

    /* ---------- 最左：企业微信文字导航栏（浅色渐变；仅「更多」可点，展开原生侧栏） ---------- */

    /* ---------- 顶部浅色 titlebar ---------- */
    .wecom-titlebar {
      position: fixed; left: 0; right: 0; top: 0;
      height: var(--wc-header-h);
      background: linear-gradient(90deg, #D5E0F8 0%, #DCE4F9 100%);
      color: var(--wc-text);
      display: flex; align-items: center;
      padding: 0 10px;
      z-index: 500;
      font-family: var(--wc-font);
      user-select: none;
      gap: 8px;
    }
    /* 顶栏左侧：当前用户头像（沿用 rail-avatar 类名，复用通知菜单逻辑） */
    .wecom-titlebar .me-chip { position: relative; width: 26px; height: 26px; flex-shrink: 0; }
    .wecom-titlebar .wecom-rail-avatar {
      width: 26px; height: 26px; border-radius: 6px; font-size: 11px;
    }
    .wecom-titlebar .wecom-rail-avatar-badge {
      top: -5px; right: -7px; min-width: 14px; height: 14px; padding: 0 3px;
      font-size: 9px; line-height: 14px; border-radius: 7px;
    }
    .wecom-titlebar .title-search {
      margin: 2px auto 0;
      width: min(420px, 36vw);
      height: 26px; border-radius: 13px;
      background: #EFF1FB;
      display: flex; align-items: center; gap: 6px;
      padding: 0 12px; color: var(--wc-text-3); font-size: 12px;
      position: relative;
    }
    .wecom-titlebar .title-search form {
      display: flex; align-items: center; gap: 6px; width: 100%; margin: 0;
    }
    .wecom-titlebar .title-search svg { opacity: .9; flex-shrink: 0; color: var(--wc-text-3); width: 14px; height: 14px; }
    .wecom-titlebar .title-search input {
      flex: 1; min-width: 0; border: 0; outline: none; background: transparent;
      color: var(--wc-text); font-size: 12px; font-family: var(--wc-font);
      text-align: center; line-height: 26px; padding: 0; height: 100%;
    }
    .wecom-titlebar .title-search input::placeholder { color: var(--wc-text-4); text-align: center; }
    .wecom-titlebar .title-actions { display: flex; align-items: center; gap: 6px; margin-left: 8px; flex-shrink: 0; }
    .wecom-titlebar .t-btn {
      width: 28px; height: 28px; border: 0; background: transparent; color: var(--wc-text-2);
      border-radius: 6px; cursor: pointer; display: grid; place-items: center; padding: 0;
      position: relative;
    }
    .wecom-titlebar .t-btn:hover { background: rgba(0,0,0,.05); }
    .wecom-titlebar .t-btn .dot {
      position: absolute; top: 4px; right: 4px; width: 6px; height: 6px;
      background: var(--wc-danger); border-radius: 50%;
    }
    .wecom-titlebar .t-btn.ai {
      width: 24px; height: 24px; border-radius: 50%; color: #fff;
      background: conic-gradient(from 210deg, #7C5CFF, #1A87FF, #00C56C, #FFB020, #7C5CFF);
    }
    .wecom-titlebar .t-btn.ai svg { width: 12px; height: 12px; }
    .wecom-titlebar .t-btn svg { width: 16px; height: 16px; }

    .wecom-rail {
      position: fixed; left: 0; top: var(--wc-header-h); bottom: 0;
      width: var(--wc-nav);
      background: linear-gradient(180deg, #D5E0F8 0%, #DCE4F9 100%);
      display: flex; flex-direction: column; align-items: center;
      padding: 6px 0 8px;
      z-index: 350;
      font-family: var(--wc-font);
      /* 不能 overflow:hidden：顶部组织 chip 的名称要溢出到中栏头部区 */
      overflow: visible;
    }
    .wecom-rail-head {
      width: 100%; flex-shrink: 0;
      padding: 2px 8px 8px;
      position: relative; z-index: 360;
    }
    .wecom-rail-org-chip {
      display: flex; align-items: center; gap: 6px;
      white-space: nowrap; cursor: pointer;
      border-radius: 8px; padding: 2px 4px; margin-left: -4px;
    }
    .wecom-rail-org-chip:hover { background: rgba(255,255,255,.6); }
    .wecom-rail-org-chip:hover .wecom-rail-org-name { color: var(--wc-blue); }
    .wecom-rail-org-logo img { width: 100%; height: 100%; object-fit: cover; border-radius: 6px; }
    .wecom-rail-org-logo {
      width: 24px; height: 24px; border-radius: 6px; flex-shrink: 0;
      background: #2F88FF; color: #fff;
      display: grid; place-items: center; font-size: 12px; font-weight: 700;
    }
    .wecom-rail-org-name { font-size: 13px; font-weight: 600; color: var(--wc-text); }
    .wecom-rail-org-chip > svg { width: 10px; height: 10px; color: var(--wc-text-3); flex-shrink: 0; }
    /* 头像基础样式（现挂在 titlebar 左侧，类名保留以复用通知逻辑） */
    .wecom-rail-avatar {
      width: 36px; height: 36px; border-radius: 8px;
      overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 13px; font-weight: 700;
      background: #F3A23A;
      cursor: pointer;
    }
    .wecom-rail-avatar img { width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    .wecom-rail-avatar.is-notif-pinned {
      box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--wc-accent);
    }
    .wecom-rail-avatar-badge {
      position: absolute; top: -4px; right: -6px;
      min-width: 16px; height: 16px; padding: 0 4px;
      background: var(--wc-danger); color: #fff;
      font-size: 10px; font-weight: 700; line-height: 16px; text-align: center;
      border-radius: 8px;
      box-shadow: 0 0 0 2px #fff;
    }
    .wecom-rail-search { display: none !important; }
    .wecom-rail-items {
      flex: 1; width: 100%; overflow: auto;
      display: flex; flex-direction: column; align-items: center;
      padding: 0 8px;
    }
    .wecom-rail-items::-webkit-scrollbar { width: 0; }
    .wecom-rail-item {
      width: 100%; border: 0; background: transparent; border-radius: 10px;
      display: flex; flex-direction: row; align-items: center; justify-content: flex-start;
      gap: 8px;
      padding: 9px 10px; color: var(--wc-text-2); cursor: pointer; position: relative;
      font-size: 16px; line-height: 1; text-align: left;
    }
    .wecom-rail-item svg { width: 20px; height: 20px; color: #5B616C; flex-shrink: 0; }
    .wecom-rail-item span { white-space: nowrap; }
    .wecom-rail-item:hover { background: rgba(255,255,255,.65); }
    .wecom-rail-item.active { color: var(--wc-blue); background: #FFFFFF; box-shadow: 0 1px 4px rgba(31,35,41,.06); }
    .wecom-rail-item.active svg { color: var(--wc-blue); }
    .wecom-rail-bottom { width: 100%; flex-shrink: 0; padding: 4px 8px 0; }
    .wecom-rail-more.is-on { color: var(--wc-blue); background: #FFFFFF; box-shadow: 0 1px 4px rgba(31,35,41,.06); }
    .wecom-rail-more.is-on svg { color: var(--wc-blue); }
    /* 右边缘拖拽柄：左右拉伸 rail */
    .wecom-rail-resizer {
      position: fixed; top: var(--wc-header-h); bottom: 0;
      left: calc(var(--wc-nav) - 3px); width: 6px;
      cursor: col-resize; z-index: 400;
      touch-action: none;
    }
    .wecom-rail-resizer:hover,
    .wecom-rail-resizer.dragging { background: rgba(26,135,255,.3); }
    /* 窄宽度 → 纯图标模式 */
    .wecom-rail-compact .wecom-rail-item { justify-content: center; padding: 8px 0; }
    .wecom-rail-compact .wecom-rail-item span { display: none; }
    .wecom-rail-compact .wecom-rail-head { padding: 2px 0 8px; display: flex; justify-content: center; }
    .wecom-rail-compact .wecom-rail-org-name,
    .wecom-rail-compact .wecom-rail-org-chip > svg { display: none; }
    .wecom-rail-compact .wecom-rail-badge { left: auto; right: 8px; }
    .wecom-rail-badge {
      position: absolute; top: 3px; left: 26px; right: auto;
      min-width: 16px; height: 16px; padding: 0 4px;
      background: var(--wc-danger); color: #fff; border-radius: 8px;
      font-size: 10px; font-weight: 700; line-height: 16px; text-align: center;
    }

    .wecom-nav2-cat-dot {
      width: 10px; height: 10px; border-radius: 3px;
      flex-shrink: 0; margin: 0 4px;
    }

    /* ---------- 聊天 header 头像与标题行 ---------- */
    .wecom-chat-head-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .wecom-chat-avatar {
      width: 28px; height: 28px; border-radius: 6px;
      flex-shrink: 0; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 13px; font-weight: 600;
    }
    /* ---------- 聊天头：标题行（人数 + 分类 chip） ---------- */
    .wecom-chat-title-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .wecom-chat-count {
      display: inline-flex; align-items: center; gap: 2px;
      font-size: 12px; color: var(--wc-text-3); font-weight: 400; flex-shrink: 0;
    }
    .wecom-chat-count svg { width: 13px; height: 13px; }
    .wecom-chat-chips { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .wecom-chat-chip {
      display: inline-flex; align-items: center; gap: 3px;
      height: 18px; padding: 0 5px; border-radius: 4px;
      font-size: 11px; line-height: 1; white-space: nowrap;
      color: var(--wc-blue) !important; background: var(--wc-blue-soft);
      border: 1px solid #C9E2FF !important;
      text-decoration: none !important; cursor: pointer;
    }
    .wecom-chat-chip .wecom-nav2-cat-dot { width: 8px; height: 8px; border-radius: 2px; margin: 0; }

    /* ---------- 隐藏原生主内容（三栏路由） ---------- */
    .${ROOT_CLASS}.${LOCK_CLASS} body { overflow: hidden !important; }
    .${ROOT_CLASS}.${LOCK_CLASS} #main-outlet > * {
      visibility: hidden !important;
      height: 0 !important;
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
    }

    /* ---------- 中栏右边缘拖拽柄 ---------- */
    .wecom-list-resizer {
      position: fixed; top: var(--wc-header-h); bottom: 0;
      left: calc(var(--wc-nav) + var(--wc-nav2w) + var(--wc-list) - 3px); width: 6px;
      cursor: col-resize; z-index: 400; touch-action: none;
    }
    .wecom-list-resizer:hover,
    .wecom-list-resizer.dragging { background: rgba(26,135,255,.25); }
    .${ROOT_CLASS}.${LOCK_CLASS}.wecom-nav2-open .wecom-list-resizer { left: calc(var(--wc-nav) + var(--wc-nav2w) + var(--wc-list) - 3px); }

    /* ---------- 中栏：会话列表 ---------- */
    .wecom-list-panel {
      position: fixed;
      top: var(--wc-header-h);
      left: calc(var(--wc-nav) + var(--wc-nav2w) + var(--wc-strip));
      width: var(--wc-list);
      bottom: 0;
      background: #F5F7FB;
      border-right: 1px solid var(--wc-border);
      display: flex;
      flex-direction: column;
      z-index: 200;
      font-family: var(--wc-font);
    }
    .wecom-list-header {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 44px;
      padding: 0 10px;
      flex-shrink: 0;
      border-bottom: 1px solid transparent;
    }
    .wecom-list-title { display: none !important; }
    /* 消息/未读：分段控件胶囊 */
    .wecom-list-chips {
      display: inline-flex; align-items: center; gap: 2px;
      background: #E7EAF1; border-radius: 14px; padding: 2px;
      flex-shrink: 0;
    }
    .wecom-chip {
      height: 24px; padding: 0 12px; border: 0; border-radius: 12px;
      background: transparent; color: var(--wc-text-2); font-size: 13px; cursor: pointer;
      font-family: var(--wc-font);
      display: inline-flex; align-items: center; gap: 3px;
      white-space: nowrap; flex-shrink: 0;
    }
    .wecom-chip .n { font-weight: 600; }
    .wecom-chip.active { background: #FFFFFF; color: var(--wc-text); font-weight: 600; box-shadow: 0 1px 3px rgba(31,35,41,.12); }
    .wecom-list-actions { display: flex; gap: 6px; margin-left: auto; align-items: center; }
    .wecom-chip-icon {
      width: 26px; height: 26px; border-radius: 50%; background: #E7EAF1;
      border: 0; display: grid; place-items: center; color: var(--wc-text-2); cursor: pointer; padding: 0;
    }
    .wecom-chip-icon:hover { background: #DCE1EA; }
    .wecom-chip-icon.is-on, .wecom-list-nav-toggle[aria-expanded="true"] { color: var(--wc-accent); background: var(--wc-accent-soft); }
    .wecom-chip-icon svg { width: 14px; height: 14px; }
    .wecom-list-nav-toggle[aria-expanded="true"] { color: var(--wc-accent); background: var(--wc-accent-soft); }
    .wecom-list-nav {
      display: none !important;
      flex-wrap: wrap;
      gap: 6px;
      padding: 10px 12px 10px;
      flex-shrink: 0;
      border-bottom: 1px solid var(--wc-border);
    }
    .wecom-list-nav.open,
    .wecom-list-panel.wecom-list-nav-open .wecom-list-nav {
      display: flex !important;
    }
    .wecom-list-nav a {
      display: inline-flex; align-items: center;
      height: 28px; padding: 0 10px;
      border-radius: 14px;
      font-size: 12px; line-height: 1;
      color: var(--wc-text-2) !important;
      text-decoration: none !important;
      border: 1px solid var(--wc-border) !important;
      background: var(--wc-bg);
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .wecom-list-nav a:hover {
      background: var(--wc-hover);
      color: var(--wc-text) !important;
    }
    .wecom-list-nav a.active {
      background: var(--wc-accent-soft);
      color: var(--wc-accent) !important;
      border-color: #C2D4FF !important;
      font-weight: 500;
    }
    .wecom-icon-btn {
      width: 32px; height: 32px;
      border: none; border-radius: 8px;
      background: transparent; color: var(--wc-text-2);
      cursor: pointer; display: inline-flex;
      align-items: center; justify-content: center;
      transition: background 0.15s;
      padding: 0;
    }
    .wecom-icon-btn:hover { background: var(--wc-hover); }
    .wecom-icon-btn svg { width: 18px; height: 18px; }
    .wecom-list-body { flex: 1; overflow-y: auto; overscroll-behavior: contain; }
    .wecom-list-body::-webkit-scrollbar { width: 6px; }
    .wecom-list-body::-webkit-scrollbar-thumb { background: var(--wc-border-strong); border-radius: 3px; }

    .wecom-conv {
      display: flex; gap: 8px;
      padding: 7px 10px;
      position: relative;
      text-decoration: none !important;
      cursor: pointer;
      transition: background 0.15s;
      border: none !important;
    }
    .wecom-conv:hover { background: var(--session-hover, var(--wc-hover)); }
    .wecom-conv.active { background: var(--session-active, var(--wc-active)); }
    .wecom-conv-avatar {
      width: 44px; height: 44px; border-radius: 8px;
      flex-shrink: 0; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 15px; font-weight: 600;
    }
    /* 头像模板返回的图片通常是 96px；必须约束到头像框，否则会按原始尺寸溢出并被裁成放大的局部。 */
    .wecom-conv-avatar img,
    .wecom-chat-avatar img {
      display: block;
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      object-fit: cover;
    }
    /* 伪装文字头像：保持圆形；实心 / 空心；字数 3～5 */
    .wecom-conv-avatar.is-text-avatar {
      box-sizing: border-box;
      padding: 3px;
      letter-spacing: 0;
      text-align: center;
    }
    .wecom-conv-avatar .wecom-avatar-text {
      line-height: 1; font-weight: 700;
      font-size: 13px;
    }
    .wecom-conv-avatar .wecom-avatar-text[data-len="1"] { font-size: 14px; }
    .wecom-conv-avatar.is-grid-mask {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(3, 1fr);
      gap: 0;
      background: #C9E7FF;
      padding: 0;
      overflow: hidden;
    }
    .wecom-conv-avatar.is-grid-mask > span {
      display: flex; align-items: center; justify-content: center;
      width: 100%; height: 100%;
      color: #fff; font-size: 7px; font-weight: 700; line-height: 1;
    }
    .wecom-mask-avatar-toggle.is-on {
      color: var(--wc-accent); background: var(--wc-accent-soft);
    }
    .wecom-conv-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .wecom-conv-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
    .wecom-conv-avatar.is-group {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(3, 1fr);
      gap: 0;
      background: #C9E7FF;
      padding: 0;
      overflow: hidden;
    }
    .wecom-conv-avatar.is-group img,
    .wecom-conv-avatar.is-group span {
      width: 100%; height: 100%; object-fit: cover; background: #D4E5FF;
    }
    .wecom-conv-title {
      display: flex; align-items: center; gap: 6px;
      min-width: 0; flex: 1;
    }
    .wecom-conv-name {
      font-size: 14px; font-weight: 500; color: var(--wc-text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      flex: 1; min-width: 0;
    }
    .wecom-conv-tag {
      display: inline-flex; align-items: center;
      height: 16px; padding: 0 5px; border-radius: 4px;
      font-size: 10px; line-height: 1; white-space: nowrap; flex-shrink: 0;
      color: #2F88FF; background: #E8F3FF;
      border: 1px solid #A8CFFF;
    }
    .wecom-conv-time { font-size: 12px; color: var(--wc-text-3); flex-shrink: 0; }
    .wecom-conv-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .wecom-conv-msg {
      font-size: 13px; color: var(--wc-text-3);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .wecom-conv-badge {
      position: absolute; right: 12px; bottom: 12px;
      min-width: 16px; height: 16px; padding: 0 4px;
      background: var(--wc-danger); color: #fff;
      font-size: 10px; font-weight: 700; line-height: 16px; text-align: center;
      border-radius: 8px; flex-shrink: 0;
    }
    .wecom-list-status {
      padding: 14px; text-align: center;
      font-size: 12px; color: var(--wc-text-3);
    }

    /* ---------- 右栏：聊天详情 ---------- */
    .wecom-chat-panel {
      position: fixed;
      top: var(--wc-header-h);
      left: calc(var(--wc-nav) + var(--wc-nav2w) + var(--wc-strip) + var(--wc-list));
      right: 0; bottom: 0;
      background: var(--wc-chat-bg);
      display: flex; flex-direction: column;
      z-index: 420;
      font-family: var(--wc-font);
    }
    .wecom-chat-header {
      height: 52px; flex-shrink: 0;
      background: #F5F7FB;
      border-bottom: 1px solid var(--wc-border);
      display: flex; align-items: center;
      justify-content: space-between;
      padding: 0 20px; gap: 12px;
    }
    .wecom-chat-titles { min-width: 0; }
    .wecom-chat-title {
      font-size: 16px; font-weight: 600; color: var(--wc-text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .wecom-chat-sub { font-size: 12px; color: var(--wc-text-3); margin-top: 1px; }
    .wecom-chat-actions { display: flex; gap: 4px; flex-shrink: 0; }
    .wecom-chat-body {
      flex: 1; overflow-y: auto;
      padding: 20px 24px;
      display: flex; flex-direction: column; gap: 16px;
      overscroll-behavior: contain;
    }
    .wecom-chat-body::-webkit-scrollbar { width: 6px; }
    .wecom-chat-body::-webkit-scrollbar-thumb { background: var(--wc-border-strong); border-radius: 3px; }

    .wecom-msg { display: flex; gap: 10px; max-width: 78%; }
    .wecom-msg-other { align-self: flex-start; }
    .wecom-msg-me { align-self: flex-end; flex-direction: row-reverse; }
    .wecom-msg-avatar {
      width: 36px; height: 36px; border-radius: 8px;
      flex-shrink: 0; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 14px; font-weight: 600;
    }
    .wecom-msg-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .wecom-msg-content { min-width: 0; display: flex; flex-direction: column; position: relative; }
    .wecom-msg-me .wecom-msg-content { align-items: flex-end; }
    .wecom-msg-name { font-size: 12px; color: var(--wc-text-3); margin-bottom: 4px; }
    .wecom-msg-me .wecom-msg-name { display: none; }
    .wecom-msg-bubble {
      padding: 10px 14px;
      font-size: 14px; line-height: 1.6;
      color: var(--wc-text);
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .wecom-msg-other .wecom-msg-bubble {
      background: var(--wc-bubble-other);
      border-radius: 8px;
      box-shadow: 0 1px 0 rgba(0,0,0,.03);
    }
    .wecom-msg-me .wecom-msg-bubble {
      background: var(--wc-bubble-me);
      border-radius: 8px;
    }
    .wecom-msg-bubble p { margin: 0 0 8px; }
    .wecom-msg-bubble p:last-child { margin-bottom: 0; }
    .wecom-msg-bubble img { max-width: 100%; border-radius: 6px; }
    .wecom-msg-bubble img:not(.emoji):not(.site-icon) { cursor: zoom-in; }
    .wecom-msg-bubble pre {
      background: rgba(127,127,127,0.12);
      padding: 8px 10px; border-radius: 6px;
      overflow-x: auto; font-size: 13px;
    }
    .wecom-msg-bubble code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .wecom-msg-bubble blockquote {
      margin: 0 0 8px; padding: 4px 10px;
      border-left: 3px solid var(--wc-accent);
      background: rgba(51,112,255,0.06);
      border-radius: 0 6px 6px 0;
    }
    .wecom-msg-bubble a { color: var(--wc-accent); }
    .wecom-msg-meta {
      font-size: 11px; color: var(--wc-text-3);
      margin-top: 4px; display: flex; gap: 8px; align-items: center;
    }
    .wecom-msg-time-sep {
      align-self: center;
      font-size: 12px; color: var(--wc-text-3);
      padding: 2px 10px;
    }
    .wecom-msg-tools {
      position: absolute; top: -14px; right: 0; z-index: 5;
      display: flex; align-items: center; gap: 2px;
      background: var(--wc-bg);
      border: 1px solid var(--wc-border);
      border-radius: 8px;
      padding: 2px;
      box-shadow: 0 2px 8px rgba(31, 35, 41, 0.1);
      opacity: 0; visibility: hidden;
      transition: opacity 0.15s ease;
    }
    .wecom-msg:hover .wecom-msg-tools { opacity: 1; visibility: visible; }
    .wecom-msg-me .wecom-msg-tools { right: auto; left: 0; }
    .wecom-msg-tool {
      width: 26px; height: 26px;
      display: flex; align-items: center; justify-content: center;
      border: none; background: transparent; cursor: pointer;
      border-radius: 6px; color: var(--wc-text-2);
      padding: 0;
    }
    .wecom-msg-tool svg { width: 15px; height: 15px; }
    .wecom-msg-tool:hover { background: var(--wc-hover); color: var(--wc-accent); }
    .wecom-msg-tool.liked { color: var(--wc-accent); }

    .wecom-chat-empty, .wecom-chat-error, .wecom-chat-loading {
      margin: auto;
      display: flex; flex-direction: column;
      align-items: center; gap: 10px;
      color: var(--wc-text-3); font-size: 14px;
      text-align: center; padding: 40px 20px;
    }
    .wecom-chat-empty svg, .wecom-chat-error svg {
      width: 56px; height: 56px; opacity: 0.5;
    }
    .wecom-empty-btn {
      margin-top: 6px;
      border: 1px solid var(--wc-border-strong);
      background: var(--wc-bg); color: var(--wc-text-2);
      border-radius: 6px; height: 32px; padding: 0 14px;
      font-size: 13px; cursor: pointer; font-family: var(--wc-font);
    }
    .wecom-empty-btn:hover { background: var(--wc-hover); }

    /* ---------- 企业微信 composer：白卡片，输入区 + 下方工具行 + 发送钮 ---------- */
    .wecom-composer {
      background: transparent; border-top: none;
      padding: 4px 12px 12px; flex-shrink: 0;
    }
    .wecom-composer-card {
      background: #FFFFFF;
      border: 1px solid var(--wc-border);
      border-radius: 12px;
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .wecom-composer-card:hover {
      border-color: #C2D4FF;
      box-shadow: 0 2px 10px rgba(26,135,255,.08);
    }
    .wecom-composer-tools {
      display: flex; align-items: center; gap: 0; padding: 0 8px 6px;
    }
    .wecom-composer-tools .wecom-icon-btn { width: 28px; height: 28px; }
    .wecom-composer-tools .spacer { flex: 1; }
    .wecom-composer-tools .hint { font-size: 11px; color: var(--wc-text-4); margin-right: 8px; }
    .wecom-image-input {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      opacity: 0 !important;
      overflow: hidden !important;
      pointer-events: none !important;
    }
    .wecom-send-btn {
      height: 26px; padding: 0 14px; border: 0; border-radius: 5px;
      background: #C5C9D0; color: #fff; font-size: 12px; cursor: pointer;
      font-family: var(--wc-font);
    }
    .wecom-chat-tools { margin-left: auto; display: flex; gap: 2px; }
    .wecom-chat-tools .wecom-icon-btn { width: 32px; height: 32px; position: relative; }
    .wecom-chat-tools .dot,
    .wecom-composer-tools .dot {
      position: absolute; top: 6px; right: 6px; width: 6px; height: 6px;
      background: var(--wc-danger); border-radius: 50%;
    }
    .wecom-composer-tools .wecom-icon-btn { position: relative; }

    /* ---------- 输入区：企微外观，内容同步给后台原生 composer ---------- */
    .wecom-chat-compose {
      position: relative;
      z-index: 430;
      flex-shrink: 0;
      margin: 0;
      min-height: 64px;
      height: auto;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--wc-text-4);
      display: flex; align-items: flex-start; gap: 8px;
      padding: 10px 14px 4px;
      cursor: text;
      font-size: 14px;
      font-family: var(--wc-font);
      transition: color 0.15s;
      pointer-events: auto !important;
      width: 100%;
      text-align: left;
    }
    .wecom-chat-compose:hover { color: var(--wc-text-1); }
    .wecom-chat-compose.busy { color: var(--wc-accent); }
    .wecom-chat-compose.error { color: var(--wc-danger); }
    .wecom-chat-compose svg { width: 16px; height: 16px; flex-shrink: 0; }
    .wecom-chat-panel[data-empty="1"] .wecom-composer { display: none; }

    /* 锁定态：原生主区不要抢走点击；原生 composer 仅作为后台提交引擎 */
    .${ROOT_CLASS}.${LOCK_CLASS} #main-outlet-wrapper,
    .${ROOT_CLASS}.${LOCK_CLASS} #main-outlet {
      pointer-events: none !important;
    }
    .${ROOT_CLASS}.${LOCK_CLASS} #reply-control:not(.open):not(.fullscreen):not(.edit-title) {
      display: none !important;
      pointer-events: none !important;
      z-index: 0 !important;
    }
    .${ROOT_CLASS}.${LOCK_CLASS} #reply-control.open,
    .${ROOT_CLASS}.${LOCK_CLASS} #reply-control.edit-title,
    .${ROOT_CLASS}.${LOCK_CLASS} #reply-control.fullscreen {
      display: block !important;
      position: fixed !important;
      inset: 0 auto auto -10000px !important;
      width: 2px !important;
      min-width: 0 !important;
      max-width: 2px !important;
      height: 2px !important;
      min-height: 0 !important;
      max-height: 2px !important;
      overflow: hidden !important;
      opacity: 0 !important;
      visibility: hidden !important;
      user-select: none !important;
      clip-path: inset(50%) !important;
      pointer-events: none !important;
      box-shadow: none !important;
    }
    /* 原生编辑器可能把补全菜单挂到 body；IM 输入框不应被这些浮层打断。 */
    .${ROOT_CLASS}.${LOCK_CLASS} .autocomplete,
    .${ROOT_CLASS}.${LOCK_CLASS} .autocomplete-container,
    .${ROOT_CLASS}.${LOCK_CLASS} .d-editor-popup,
    .${ROOT_CLASS}.${LOCK_CLASS} .emoji-picker,
    .${ROOT_CLASS}.${LOCK_CLASS} .tag-chooser {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }

    /* ---------- native 模式悬浮恢复钮 ---------- */
    .wecom-mode-fab {
      position: fixed; right: 20px; bottom: 20px; z-index: 10000;
      width: 44px; height: 44px; border-radius: 50%;
      background: #1A87FF; color: #fff; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 14px rgba(51,112,255,0.4);
    }
    .wecom-mode-fab svg { width: 22px; height: 22px; }

    /* ---------- 聊天图片预览 ---------- */
    html.wecom-image-viewer-open,
    html.wecom-image-viewer-open body { overflow: hidden !important; }
    .wecom-image-viewer,
    .wecom-image-viewer * { box-sizing: border-box; }
    .wecom-image-viewer[hidden] { display: none !important; }
    .wecom-image-viewer {
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(10, 18, 29, .88);
      backdrop-filter: blur(3px);
      font-family: var(--wc-font);
    }
    .wecom-image-viewer-stage {
      position: absolute;
      inset: 70px 32px 56px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .wecom-image-viewer-image {
      display: block;
      max-width: 100%;
      max-height: 100%;
      border-radius: 6px;
      object-fit: contain;
      box-shadow: 0 18px 60px rgba(0, 0, 0, .42);
    }
    .wecom-image-viewer-close {
      position: fixed;
      top: 20px;
      right: 24px;
      z-index: 2;
      height: 40px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 0 14px;
      border: 1px solid rgba(255, 255, 255, .28);
      border-radius: 8px;
      background: rgba(255, 255, 255, .13);
      color: #FFFFFF;
      font: 13px var(--wc-font);
      cursor: pointer;
    }
    .wecom-image-viewer-close:hover,
    .wecom-image-viewer-close:focus-visible {
      outline: none;
      background: rgba(255, 255, 255, .24);
    }
    .wecom-image-viewer-close b { font-size: 24px; font-weight: 300; line-height: 1; }
    .wecom-image-viewer-caption {
      position: fixed;
      left: 24px;
      right: 24px;
      bottom: 18px;
      overflow: hidden;
      color: rgba(255, 255, 255, .78);
      font-size: 12px;
      text-align: center;
      white-space: nowrap;
      text-overflow: ellipsis;
      pointer-events: none;
    }

    /* ---------- splash ---------- */
    .${ROOT_CLASS} #d-splash { background: var(--wc-bg) !important; }
    .${ROOT_CLASS} #d-splash .preloader-image { display: none !important; }
    .${ROOT_CLASS} #d-splash .splash-logo-container {
      width: 96px !important; height: 96px !important;
      background-image: var(--wc-splash-logo) !important;
      background-size: contain !important;
      background-repeat: no-repeat !important;
      animation: none !important;
    }
    .${ROOT_CLASS} #d-splash .dots { background-color: #1A87FF !important; filter: none !important; }

    /* ---------- 窄屏降级 ---------- */
    @media (max-width: 1280px) {
      .${ROOT_CLASS} { --wc-list: 250px; }
    }
    @media (max-width: 1000px) {
      .${ROOT_CLASS} { --wc-nav2w: 0px !important; --wc-strip: 0px !important; }
      .wecom-strip { display: none; }
      .${ROOT_CLASS}.${LOCK_CLASS} .wecom-list-panel { width: calc(100% - var(--wc-nav)); left: var(--wc-nav); }
      .${ROOT_CLASS}.${LOCK_CLASS}.wecom-topic-open .wecom-list-panel { display: none; }
      .${ROOT_CLASS}.${LOCK_CLASS}:not(.wecom-topic-open) .wecom-chat-panel { display: none; }
      .${ROOT_CLASS}.${LOCK_CLASS} .wecom-chat-panel { left: var(--wc-nav); }
      .wecom-image-viewer-stage { inset: 68px 12px 44px; }
      .wecom-image-viewer-close { top: 14px; right: 14px; }
    }
  `;

  /* 企业微信经典桌面端视觉层。交互逻辑与 Discourse 数据层保持独立。 */
  const WECOM_REFINEMENTS = String.raw`
    .${ROOT_CLASS} {
      --wc-blue: #267EF0;
      --wc-blue-hover: #176BCE;
      --wc-blue-soft: #EAF3FF;
      --wc-blue-chip: #DCEBFF;
      --wc-title: #267EF0;
      --wc-accent: #267EF0;
      --wc-accent-soft: #EAF3FF;
      --wc-nav2-bg: #FFFFFF;
      --wc-nav2-border: #D9D9D9;
      --wc-text: #181818;
      --wc-text-2: #575757;
      --wc-text-3: #8B8B8B;
      --wc-text-4: #B2B2B2;
      --wc-bg: #FFFFFF;
      --wc-chat-bg: #F5F5F5;
      --wc-hover: #E7E7E7;
      --wc-active: #D8D8D8;
      --wc-bubble-other: #FFFFFF;
      --wc-bubble-me: #95EC69;
      --wc-border: #DEDEDE;
      --wc-border-strong: #CACACA;
      --wc-danger: #FA5151;
      --wc-rail-bg: #2B2D31;
      --wc-nav: ${RAIL_WIDTH}px;
      --wc-list: ${LIST_WIDTH}px;
      --wc-header-h: 0px;
      --wc-font: "Microsoft YaHei UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      --radius: 4px;
    }

    .wecom-titlebar { display: none !important; }

    /* 深色工作台 rail */
    .wecom-rail {
      top: 0;
      padding: 14px 0 8px;
      overflow: hidden;
      background: #2B2D31;
      border-right: 1px solid #202226;
    }
    .wecom-rail-head {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 11px;
      width: 100%;
      padding: 0 0 8px;
    }
    .wecom-rail-head .me-chip {
      position: relative;
      width: 38px;
      height: 38px;
      flex: 0 0 auto;
    }
    .wecom-rail .wecom-rail-avatar {
      width: 38px;
      height: 38px;
      border-radius: 4px;
      background: #267EF0;
      box-shadow: none;
    }
    .wecom-rail .wecom-rail-avatar.is-notif-pinned {
      box-shadow: 0 0 0 2px #2B2D31, 0 0 0 4px #46C36F;
    }
    .wecom-rail .wecom-rail-avatar-badge {
      top: -7px;
      right: -9px;
      box-shadow: 0 0 0 2px #2B2D31;
    }
    .wecom-rail-org-chip {
      width: 32px;
      height: 32px;
      justify-content: center;
      margin: 0;
      padding: 0;
      border-radius: 5px;
      background: rgba(255, 255, 255, .08);
    }
    .wecom-rail-org-chip:hover { background: rgba(255, 255, 255, .14); }
    .wecom-rail-org-logo {
      width: 26px;
      height: 26px;
      border-radius: 4px;
      background: linear-gradient(145deg, #4294FF, #1769D2);
      font-size: 10px;
    }
    .wecom-rail-org-name,
    .wecom-rail-org-chip > svg { display: none; }
    .wecom-rail-items {
      gap: 2px;
      padding: 4px 5px;
      overflow-x: hidden;
    }
    .wecom-rail-item {
      height: 52px;
      flex: 0 0 52px;
      flex-direction: column;
      justify-content: center;
      gap: 3px;
      padding: 5px 2px;
      border-radius: 4px;
      color: #AEB2B9;
      font-size: 10px;
      line-height: 1.15;
      text-align: center;
    }
    .wecom-rail-item svg {
      width: 21px;
      height: 21px;
      color: #B9BDC4;
    }
    .wecom-rail-item:hover { background: rgba(255, 255, 255, .07); }
    .wecom-rail-item.active,
    .wecom-rail-more.is-on {
      color: #55CF7B;
      background: rgba(255, 255, 255, .08);
      box-shadow: none;
    }
    .wecom-rail-item.active svg,
    .wecom-rail-more.is-on svg { color: #55CF7B; }
    .wecom-rail-item.active::before {
      content: "";
      position: absolute;
      left: -5px;
      top: 14px;
      width: 3px;
      height: 24px;
      border-radius: 0 2px 2px 0;
      background: #55CF7B;
    }
    .wecom-rail-bottom { padding: 3px 5px 0; }
    .wecom-rail-badge {
      top: 2px;
      left: auto;
      right: 3px;
      box-shadow: 0 0 0 2px #2B2D31;
    }
    .wecom-rail-resizer { display: none !important; }

    /* 通知浮层从头像右侧展开 */
    .${ROOT_CLASS}.wecom-notif-open .user-menu.wecom-user-menu-float,
    .${ROOT_CLASS}.wecom-notif-open .user-menu.revamped.menu-panel.wecom-user-menu-float,
    .${ROOT_CLASS}.wecom-notif-open .user-menu.menu-panel.wecom-user-menu-float {
      left: 76px !important;
      top: 10px !important;
      border: 1px solid #E1E1E1 !important;
      border-radius: 6px !important;
      box-shadow: 0 10px 32px rgba(0, 0, 0, .2) !important;
    }

    /* 会话栏 */
    .wecom-list-panel {
      top: 0;
      background: #F2F2F2;
      border-right-color: #D5D5D5;
    }
    .wecom-list-search {
      height: 60px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 10px 8px;
      flex: 0 0 60px;
    }
    .wecom-list-search form {
      height: 30px;
      min-width: 0;
      flex: 1;
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 0 9px;
      border-radius: 4px;
      background: #E2E2E2;
      color: #8B8B8B;
    }
    .wecom-list-search form:focus-within {
      background: #FFFFFF;
      box-shadow: inset 0 0 0 1px #AFCDF5;
    }
    .wecom-list-search svg { width: 15px; height: 15px; flex: 0 0 auto; }
    .wecom-list-search input {
      width: 100%;
      height: 100%;
      padding: 0;
      border: 0;
      outline: 0;
      background: transparent;
      color: #202020;
      font: 12px var(--wc-font);
    }
    .wecom-list-search input::placeholder { color: #8C8C8C; }
    .wecom-list-add {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      padding: 0;
      border: 0;
      border-radius: 4px;
      background: #DFDFDF;
      color: #555;
      cursor: pointer;
    }
    .wecom-list-add:hover { background: #D4D4D4; }
    .wecom-list-add svg { width: 17px; height: 17px; }
    .wecom-list-header {
      height: 40px;
      padding: 0 10px;
      border-bottom: 1px solid #E2E2E2;
    }
    .wecom-list-chips {
      gap: 16px;
      padding: 0;
      background: transparent;
      border-radius: 0;
    }
    .wecom-chip {
      position: relative;
      height: 39px;
      padding: 0 2px;
      border-radius: 0;
      color: #707070;
    }
    .wecom-chip.active {
      color: #191919;
      background: transparent;
      box-shadow: none;
    }
    .wecom-chip.active::after {
      content: "";
      position: absolute;
      left: 5px;
      right: 5px;
      bottom: 0;
      height: 2px;
      background: #267EF0;
    }
    .wecom-chip-icon { background: transparent; border-radius: 4px; }
    .wecom-chip-icon:hover { background: #E3E3E3; }
    .wecom-conv {
      min-height: 62px;
      gap: 10px;
      padding: 9px 11px;
    }
    .wecom-conv:hover { background: #E5E5E5; }
    .wecom-conv.active { background: #D5D5D5; }
    .wecom-conv-avatar {
      width: 42px;
      height: 42px;
      border-radius: 4px;
    }
    .wecom-conv-avatar.is-group,
    .wecom-conv-avatar.is-grid-mask { gap: 1px; padding: 1px; background: #FFFFFF; }
    .wecom-conv-info { justify-content: center; gap: 5px; }
    .wecom-conv-name { font-size: 13px; font-weight: 400; }
    .wecom-conv-msg,
    .wecom-conv-time { font-size: 11px; }
    .wecom-conv-tag {
      color: #267EF0;
      background: #E8F2FF;
      border-color: #BDD8FA;
    }

    /* 聊天区 */
    .wecom-chat-panel { top: 0; background: #F5F5F5; }
    .wecom-chat-header {
      height: 62px;
      padding: 0 22px;
      background: #F5F5F5;
      border-bottom-color: #E2E2E2;
    }
    .wecom-chat-title { font-size: 15px; font-weight: 500; }
    .wecom-chat-sub { color: #999; }
    .wecom-chat-avatar { border-radius: 4px; }
    .wecom-chat-body { padding: 22px 30px; gap: 18px; }
    .wecom-msg { max-width: min(76%, 820px); gap: 11px; }
    .wecom-msg-avatar {
      width: 38px;
      height: 38px;
      border-radius: 4px;
    }
    .wecom-msg-name { margin-bottom: 5px; color: #999; }
    .wecom-msg-bubble {
      position: relative;
      padding: 9px 12px;
      border-radius: 4px !important;
      font-size: 14px;
      line-height: 1.62;
      box-shadow: none !important;
    }
    .wecom-msg-other .wecom-msg-bubble::before,
    .wecom-msg-me .wecom-msg-bubble::before {
      content: "";
      position: absolute;
      top: 12px;
      width: 0;
      height: 0;
      border-top: 6px solid transparent;
      border-bottom: 6px solid transparent;
    }
    .wecom-msg-other .wecom-msg-bubble::before {
      left: -7px;
      border-right: 8px solid #FFFFFF;
    }
    .wecom-msg-me .wecom-msg-bubble::before {
      right: -7px;
      border-left: 8px solid #95EC69;
    }
    .wecom-msg-bubble blockquote {
      border-left-color: #267EF0;
      background: rgba(38, 126, 240, .06);
    }
    .wecom-msg-meta { color: #AAA; }
    .wecom-msg-tools { border-radius: 4px; }

    /* 企业微信底部编辑区 */
    .wecom-composer {
      min-height: 142px;
      padding: 0;
      background: #FFFFFF;
      border-top: 1px solid #DFDFDF;
    }
    .wecom-composer-card {
      min-height: 141px;
      display: flex;
      flex-direction: column;
      border: 0;
      border-radius: 0;
      background: #FFFFFF;
    }
    .wecom-composer-card:hover { border: 0; box-shadow: none; }
    .wecom-chat-compose {
      order: 2;
      min-height: 82px;
      padding: 7px 18px;
      color: #B1B1B1;
    }
    .wecom-composer-tools {
      order: 1;
      padding: 7px 13px 0;
    }
    .wecom-send-btn {
      order: 3;
      align-self: flex-end;
      margin: auto 18px 12px 0;
      height: 28px;
      padding: 0 18px;
      color: #777;
      background: #F0F0F0;
      border: 1px solid #DEDEDE;
    }
    .wecom-mode-fab {
      background: #267EF0;
      border-radius: 6px;
      box-shadow: 0 5px 18px rgba(38, 126, 240, .32);
    }
    .${ROOT_CLASS} #d-splash .dots { background-color: #267EF0 !important; }

    @media (max-width: 1280px) {
      .${ROOT_CLASS} { --wc-list: 280px; }
    }
    @media (max-width: 1000px) {
      .${ROOT_CLASS}.${LOCK_CLASS} .wecom-chat-panel { left: var(--wc-nav); }
    }
  `;

  /* 企业微信 5.x：以 2026 年桌面客户端展开导航版为视觉基准。 */
  const WECOM_LATEST_REFINEMENTS = String.raw`
    .${ROOT_CLASS} {
      --wc-blue: #4389F5;
      --wc-blue-hover: #2F78E8;
      --wc-blue-soft: #DCEBFF;
      --wc-accent: #4389F5;
      --wc-accent-soft: #DCEBFF;
      --wc-text: #172033;
      --wc-text-2: #526175;
      --wc-text-3: #8B98AA;
      --wc-text-4: #B5BFCC;
      --wc-chat-bg: #F1F4F8;
      --wc-hover: #E7EEF8;
      --wc-active: #4B8FF7;
      --wc-bubble-other: #E5E8ED;
      --wc-bubble-me: #BEE4FF;
      --wc-border: #D9E0E9;
      --wc-border-strong: #C5CFDB;
      --wc-rail-bg: #E3F0FF;
      --wc-nav: ${RAIL_WIDTH}px;
      --wc-list: ${LIST_WIDTH}px;
      --wc-members: ${MEMBER_WIDTH}px;
      --wc-font: "Microsoft YaHei UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    }

    /* 左侧展开导航 */
    .wecom-rail {
      top: 0;
      padding: 10px 0 8px;
      align-items: stretch;
      overflow: hidden;
      background: linear-gradient(180deg, #E7F3FF 0%, #DDEEFF 100%);
      border-right: 1px solid #C9D9EB;
      color: #47617E;
    }
    .wecom-rail-head {
      height: 46px;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 8px;
      padding: 0 16px;
      flex: 0 0 46px;
    }
    .wecom-rail-head .me-chip { width: 26px; height: 26px; flex: 0 0 26px; }
    .wecom-rail .wecom-rail-avatar {
      width: 26px;
      height: 26px;
      border-radius: 4px;
      font-size: 10px;
    }
    .wecom-current-user-name {
      min-width: 0;
      overflow: hidden;
      color: #26384E;
      font-size: 12px;
      line-height: 1;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .wecom-rail-org-chip[hidden] { display: none !important; }
    .wecom-rail-items {
      flex: 0 0 auto;
      width: 100%;
      gap: 1px;
      padding: 4px 12px 8px;
      overflow: visible;
    }
    .wecom-rail-item {
      width: 100%;
      height: 31px;
      min-height: 31px;
      flex: 0 0 31px;
      flex-direction: row;
      justify-content: flex-start;
      gap: 10px;
      padding: 0 9px;
      border-radius: 6px;
      color: #5D718A;
      font-size: 13px;
      line-height: 31px;
      text-align: left;
    }
    .wecom-rail-item svg { width: 16px; height: 16px; color: #7B8CA1; }
    .wecom-rail-item:hover { background: rgba(79, 143, 234, .09); }
    .wecom-rail-item.active,
    .wecom-rail-more.is-on {
      color: #2D78E7;
      background: #CFE4FF;
      box-shadow: none;
    }
    .wecom-rail-item.active svg,
    .wecom-rail-more.is-on svg { color: #2D78E7; }
    .wecom-rail-item.active::before { display: none; }
    .wecom-rail-badge {
      top: 6px;
      left: auto;
      right: 8px;
      height: 17px;
      min-width: 17px;
      line-height: 17px;
      border-radius: 9px;
      box-shadow: 0 0 0 2px #CFE4FF;
    }
    .wecom-rail-dot {
      position: absolute;
      right: 10px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #FF574F;
    }
    .wecom-rail-groups {
      min-height: 0;
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 0 12px 4px;
      scrollbar-width: none;
    }
    .wecom-rail-groups::-webkit-scrollbar { display: none; }
    .wecom-rail-group-title {
      height: 27px;
      padding: 6px 9px 0;
      color: #8293A8;
      font-size: 12px;
    }
    .wecom-rail-group-item {
      position: relative;
      width: 100%;
      height: 31px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 9px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: #536A84;
      font: 13px var(--wc-font);
      cursor: default;
    }
    .wecom-rail-group-item:hover { background: rgba(79, 143, 234, .08); }
    .wecom-rail-group-item svg { width: 16px; height: 16px; color: #7187A0; }
    .wecom-group-unread {
      margin-left: auto;
      color: #8595A8;
      font-size: 11px;
      font-weight: 400;
    }
    .wecom-rail-bottom { padding: 2px 12px 0; }
    .wecom-rail-bottom .wecom-rail-item { color: #536A84; }
    .wecom-rail-resizer {
      top: 0;
      display: block !important;
      background: transparent;
    }
    .wecom-rail-resizer:hover,
    .wecom-rail-resizer.dragging { background: rgba(67, 137, 245, .24); }
    .${ROOT_CLASS}.wecom-notif-open .user-menu.wecom-user-menu-float,
    .${ROOT_CLASS}.wecom-notif-open .user-menu.revamped.menu-panel.wecom-user-menu-float,
    .${ROOT_CLASS}.wecom-notif-open .user-menu.menu-panel.wecom-user-menu-float {
      left: calc(var(--wc-nav) + 8px) !important;
      top: 10px !important;
    }

    /* 会话列表 */
    .wecom-list-panel {
      top: 0;
      background: #F4F7FB;
      border-right-color: #D6DEE8;
    }
    .wecom-list-search {
      height: 62px;
      flex: 0 0 62px;
      padding: 14px 16px 10px;
      gap: 8px;
    }
    .wecom-list-search form {
      height: 34px;
      padding: 0 11px;
      margin: 0 !important;
      border: 0 !important;
      border-radius: 7px;
      background: #E5EAF0;
      box-shadow: none;
      box-sizing: border-box;
    }
    .wecom-list-search form:focus-within {
      background: #FFFFFF;
      box-shadow: inset 0 0 0 1px #A9C9F6;
    }
    .wecom-list-search form > input[type="search"] {
      appearance: none !important;
      -webkit-appearance: none !important;
      display: block;
      min-width: 0 !important;
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      outline: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      color: #26384E !important;
      font-family: var(--wc-font) !important;
      font-size: 13px !important;
      font-weight: 400 !important;
      line-height: normal !important;
    }
    .wecom-list-search form > input[type="search"]::-webkit-search-decoration,
    .wecom-list-search form > input[type="search"]::-webkit-search-cancel-button {
      display: none !important;
      appearance: none !important;
      -webkit-appearance: none !important;
    }
    .wecom-list-add {
      width: 34px;
      height: 34px;
      border-radius: 7px;
      background: #E5EAF0;
    }
    .wecom-list-header { display: none !important; }
    .wecom-list-nav {
      position: absolute;
      top: 58px;
      left: 10px;
      right: 10px;
      z-index: 5;
      border: 1px solid #DCE3EC;
      border-radius: 8px;
      background: #FFFFFF;
      box-shadow: 0 8px 24px rgba(44, 71, 105, .16);
    }
    .wecom-conv {
      min-height: 62px;
      gap: 10px;
      padding: 8px 13px;
      border-radius: 0;
    }
    .wecom-conv:hover { background: #E8EEF6; }
    .wecom-conv.active { background: #4B8FF7; }
    .wecom-conv-avatar { width: 42px; height: 42px; border-radius: 6px; }
    .wecom-conv-info { justify-content: center; gap: 4px; }
    .wecom-conv-name { color: #1B2A3B; font-size: 13px; font-weight: 500; }
    .wecom-conv-msg,
    .wecom-conv-time { color: #8A98AA; font-size: 11px; }
    .wecom-conv.active .wecom-conv-name,
    .wecom-conv.active .wecom-conv-msg,
    .wecom-conv.active .wecom-conv-time { color: #FFFFFF !important; }
    .wecom-conv.active .wecom-conv-tag {
      color: #FFFFFF;
      border-color: rgba(255,255,255,.45);
      background: rgba(255,255,255,.18);
    }
    .wecom-conv-tag {
      color: #2C79E9;
      border-color: #B8D5FA;
      background: #E8F2FF;
    }
    .wecom-list-resizer { top: 0; }

    /* 聊天主区 */
    .wecom-chat-panel {
      top: 0;
      right: 0;
      background: #F1F4F8;
      transition: right .16s ease;
    }
    .${ROOT_CLASS}.wecom-members-open .wecom-chat-panel { right: var(--wc-members); }
    .wecom-chat-header {
      height: 80px;
      padding: 0 17px;
      background: #FFFFFF;
      border-bottom-color: #DCE3EB;
    }
    .wecom-chat-avatar { display: none !important; }
    .wecom-chat-title { color: #111827; font-size: 17px; font-weight: 700; }
    .wecom-chat-sub { margin-top: 4px; color: #75849A; font-size: 11px; }
    .wecom-chat-title-row { gap: 7px; }
    .wecom-chat-count { color: #8795A7; }
    .wecom-chat-chip { border-radius: 3px; }
    .wecom-chat-tools { gap: 1px; }
    .wecom-chat-body {
      padding: 18px 17px 24px;
      gap: 15px;
      background-color: #F1F4F8;
      background-image: none;
      background-repeat: repeat;
      background-position: 0 0;
      background-size: ${WATERMARK_TILE_WIDTH}px ${WATERMARK_TILE_HEIGHT}px;
    }
    .wecom-watermark-settings.is-on {
      color: #2D78E7;
      background: #E3EFFF;
    }
    .wecom-watermark-panel[hidden] { display: none !important; }
    .wecom-watermark-panel {
      position: absolute;
      top: 66px;
      right: 16px;
      z-index: 500;
      width: 310px;
      padding: 16px;
      border: 1px solid #D6DEE8;
      border-radius: 10px;
      background: #FFFFFF;
      box-shadow: 0 12px 34px rgba(36, 58, 86, .18);
      color: #25364B;
      font: 13px var(--wc-font);
    }
    .wecom-watermark-head,
    .wecom-watermark-switch-row,
    .wecom-watermark-actions {
      display: flex;
      align-items: center;
    }
    .wecom-watermark-head { justify-content: space-between; margin-bottom: 14px; }
    .wecom-watermark-head strong { color: #172033; font-size: 15px; }
    .wecom-watermark-close {
      width: 26px;
      height: 26px;
      border: 0;
      border-radius: 5px;
      background: transparent;
      color: #7D8B9D;
      font-size: 20px;
      line-height: 24px;
      cursor: pointer;
    }
    .wecom-watermark-close:hover { background: #EEF3F8; }
    .wecom-watermark-switch-row {
      justify-content: space-between;
      margin-bottom: 14px;
      cursor: pointer;
    }
    .wecom-watermark-switch {
      position: relative;
      width: 38px;
      height: 22px;
      flex: 0 0 38px;
    }
    .wecom-watermark-switch input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
    }
    .wecom-watermark-switch i {
      position: absolute;
      inset: 0;
      border-radius: 12px;
      background: #C5CED9;
      transition: background .16s ease;
    }
    .wecom-watermark-switch i::after {
      content: "";
      position: absolute;
      top: 3px;
      left: 3px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #FFFFFF;
      box-shadow: 0 1px 3px rgba(35, 52, 72, .24);
      transition: transform .16s ease;
    }
    .wecom-watermark-switch input:checked + i { background: #4389F5; }
    .wecom-watermark-switch input:checked + i::after { transform: translateX(16px); }
    .wecom-watermark-switch input:focus-visible + i { outline: 2px solid #9CC5FF; outline-offset: 2px; }
    .wecom-watermark-field { display: block; }
    .wecom-watermark-field > span { display: block; margin-bottom: 7px; color: #536378; }
    .wecom-watermark-text {
      width: 100%;
      height: 36px;
      padding: 0 10px;
      border: 1px solid #C9D3DF;
      border-radius: 6px;
      outline: none;
      background: #FFFFFF;
      color: #172033;
      font: 13px var(--wc-font);
      box-sizing: border-box;
    }
    .wecom-watermark-text:focus { border-color: #4389F5; box-shadow: 0 0 0 2px rgba(67,137,245,.13); }
    .wecom-watermark-hint { margin-top: 7px; color: #8B98AA; font-size: 11px; line-height: 1.5; }
    .wecom-watermark-error { min-height: 18px; margin-top: 5px; color: #D84C4C; font-size: 11px; }
    .wecom-watermark-actions { justify-content: flex-end; gap: 8px; margin-top: 8px; }
    .wecom-watermark-actions button {
      min-width: 64px;
      height: 32px;
      border: 1px solid #CCD6E2;
      border-radius: 6px;
      background: #FFFFFF;
      color: #526175;
      font: 13px var(--wc-font);
      cursor: pointer;
    }
    .wecom-watermark-actions .wecom-watermark-save {
      border-color: #4389F5;
      background: #4389F5;
      color: #FFFFFF;
    }
    .wecom-watermark-actions .wecom-watermark-save:hover { background: #2F78E8; }
    .wecom-msg { max-width: 82%; gap: 9px; }
    .wecom-msg-avatar { width: 34px; height: 34px; border-radius: 5px; }
    .wecom-msg-name { color: #7F8EA2; font-size: 11px; }
    .wecom-msg-bubble {
      padding: 8px 11px;
      border-radius: 5px !important;
      font-size: 13px;
      line-height: 1.55;
    }
    .wecom-msg-other .wecom-msg-bubble { background: #E4E7EC; }
    .wecom-msg-me .wecom-msg-bubble { background: #BDE4FF; }
    .wecom-msg-other .wecom-msg-bubble::before { border-right-color: #E4E7EC; }
    .wecom-msg-me .wecom-msg-bubble::before { border-left-color: #BDE4FF; }
    .wecom-msg-meta { color: #9AA7B8; }
    .wecom-msg-time-sep { color: #94A2B4; }
    .wecom-pinned-banner {
      min-height: 58px;
      display: flex;
      align-items: center;
      gap: 9px;
      margin: 6px 5px 0;
      padding: 7px 12px;
      flex: 0 0 auto;
      border: 1px solid #BFD9FA;
      border-radius: 5px;
      background: #DDEEFF;
      color: #3D536D;
      font-size: 12px;
    }
    .wecom-pinned-avatar {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      flex: 0 0 30px;
      border-radius: 4px;
      background: #4389F5;
      color: #FFFFFF;
      font-weight: 700;
    }
    .wecom-pinned-content { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .wecom-pinned-content b { color: #38516D; font-weight: 500; }
    .wecom-pinned-content span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .wecom-pinned-close { margin-left: auto; border: 0; background: transparent; color: #8291A4; cursor: pointer; }
    .wecom-composer {
      min-height: 174px;
      padding: 0 16px 13px;
      background: #F1F4F8;
      border-top: 0;
    }
    .wecom-composer-card {
      min-height: 160px;
      position: relative;
      border: 1px solid #D6DEE8;
      border-radius: 8px;
      background: #FFFFFF;
      box-shadow: 0 1px 2px rgba(34,55,80,.03);
      cursor: text;
    }
    .wecom-composer-card:hover { border: 1px solid #B8D0EF; box-shadow: none; }
    .wecom-composer-tools { padding: 9px 10px 1px; }
    textarea.wecom-chat-compose {
      order: 3;
      display: block;
      box-sizing: border-box;
      min-height: 96px;
      max-height: 180px;
      padding: 8px 12px 12px;
      resize: none;
      overflow-y: auto;
      outline: 0;
      color: #1F2D3D;
      line-height: 1.55;
      cursor: text;
    }
    textarea.wecom-chat-compose::placeholder { color: #A8B0BC; opacity: 1; }
    textarea.wecom-chat-compose:focus { color: #1F2D3D; }
    .wecom-compose-status {
      min-width: 0;
      margin-left: 6px;
      overflow: hidden;
      color: #8795A8;
      font-size: 11px;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .wecom-compose-status.busy { color: #4389F5; }
    .wecom-compose-status.error { color: #E45C5C; }
    .wecom-compose-status.success { color: #31A05D; }
    .wecom-reply-target {
      order: 2;
      min-height: 26px;
      margin: 4px 12px 0;
      padding: 4px 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      border-left: 2px solid #4389F5;
      background: #F3F7FC;
      color: #65758A;
      font-size: 11px;
    }
    .wecom-reply-target[hidden] { display: none !important; }
    .wecom-reply-target span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .wecom-reply-cancel {
      margin-left: auto;
      padding: 0 2px;
      border: 0;
      background: transparent;
      color: #8795A8;
      cursor: pointer;
    }
    .wecom-send-btn {
      margin: 0 4px 0 8px;
      align-self: center;
      color: #A8B0BC;
      background: transparent;
      border: 0;
      cursor: default;
    }
    .wecom-send-btn:not(:disabled) { color: #4389F5; cursor: pointer; }
    .wecom-send-btn:not(:disabled):hover { background: #EEF5FF; }

    /* 最终兜底：后续响应式规则也不能把后台原生编辑器带回屏幕。 */
    .${ROOT_CLASS}.${LOCK_CLASS} #reply-control.open,
    .${ROOT_CLASS}.${LOCK_CLASS} #reply-control.edit-title,
    .${ROOT_CLASS}.${LOCK_CLASS} #reply-control.fullscreen {
      inset: 0 auto auto -10000px !important;
      right: auto !important;
      width: 2px !important;
      height: 2px !important;
      opacity: 0 !important;
      visibility: hidden !important;
      clip-path: inset(50%) !important;
      pointer-events: none !important;
    }

    /* 右侧群成员栏 */
    .wecom-member-panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: var(--wc-members);
      z-index: 421;
      display: flex;
      flex-direction: column;
      background: #FFFFFF;
      border-left: 1px solid #D8E0E9;
      font-family: var(--wc-font);
    }
    .wecom-member-header {
      height: 80px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      padding: 0 12px 10px;
      flex: 0 0 80px;
      border-bottom: 1px solid #E2E7ED;
      color: #536378;
      font-size: 12px;
    }
    .wecom-member-header b { font-weight: 400; }
    .wecom-member-actions { display: flex; gap: 8px; color: #697B92; }
    .wecom-member-actions svg { width: 14px; height: 14px; }
    .wecom-member-body { flex: 1; overflow-y: auto; padding: 8px 10px 18px; }
    .wecom-member-section + .wecom-member-section { margin-top: 10px; }
    .wecom-member-section-title { padding: 4px 0 6px; color: #D99016; font-size: 11px; }
    .wecom-member-section + .wecom-member-section .wecom-member-section-title { color: #42A45D; }
    .wecom-member-row { height: 28px; display: flex; align-items: center; gap: 7px; min-width: 0; }
    .wecom-member-avatar {
      width: 18px;
      height: 18px;
      display: grid;
      place-items: center;
      flex: 0 0 18px;
      overflow: hidden;
      border-radius: 3px;
      color: #FFFFFF;
      font-size: 8px;
      font-weight: 700;
    }
    .wecom-member-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .wecom-member-name { min-width: 0; overflow: hidden; color: #25364B; font-size: 11px; white-space: nowrap; text-overflow: ellipsis; }
    .wecom-member-role { margin-left: auto; padding: 1px 4px; border-radius: 3px; background: #EEF2F7; color: #8C98A8; font-size: 9px; }
    @media (max-width: 1100px) {
      .wecom-member-panel { display: none; }
      .${ROOT_CLASS}.wecom-members-open .wecom-chat-panel { right: 0; }
    }
    @media (max-width: 1000px) {
      .${ROOT_CLASS} { --wc-nav: 68px !important; }
      .wecom-current-user-name,
      .wecom-rail-item > span,
      .wecom-rail-groups,
      .wecom-rail-bottom span { display: none !important; }
      .wecom-rail-head { justify-content: center; padding: 0; }
      .wecom-rail-items { padding: 4px 8px; }
      .wecom-rail-item { justify-content: center; padding: 0; }
      .wecom-watermark-panel { right: 10px; width: min(310px, calc(100vw - 96px)); }
    }
  `;

  /* ============================== 基础设施 ============================== */

  function injectStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    // 始终刷新，避免旧版 CSS（挡住回复按钮）残留
    style.textContent = `${RAW_CSS}\n${WECOM_REFINEMENTS}\n${WECOM_LATEST_REFINEMENTS}`;
  }

  let faviconObserver = null;
  let faviconApplying = false;

  function makeFavicon() {
    const head = document.head;
    if (!head || faviconApplying) return;
    faviconApplying = true;
    try {
      const href = FAVICON_URI;
      // 覆盖所有常见 icon 链（含 shortcut / apple-touch），避免未选中标签仍用站点原图
      const icons = head.querySelectorAll(
        "link[rel='icon'], link[rel='shortcut icon'], link[rel~='icon'], link[rel='apple-touch-icon'], link[rel='apple-touch-icon-precomposed'], link[rel='mask-icon']"
      );
      for (const icon of icons) {
        if (icon.id && icon.id !== FAVICON_ID) icon.removeAttribute("id");
        if (icon.getAttribute("href") !== href) icon.setAttribute("href", href);
        if (icon.rel === "mask-icon") continue;
        if (icon.getAttribute("type") !== "image/x-icon") icon.setAttribute("type", "image/x-icon");
        if (!icon.getAttribute("sizes")) icon.setAttribute("sizes", "any");
      }

      let link = document.getElementById(FAVICON_ID);
      if (!link) {
        link = document.createElement("link");
        link.id = FAVICON_ID;
        link.rel = "icon";
        link.type = "image/x-icon";
        link.sizes = "any";
        link.setAttribute("href", href);
        head.appendChild(link);
      } else if (link.getAttribute("href") !== href) {
        link.setAttribute("href", href);
      }

      // 再补一条 shortcut icon，部分浏览器未聚焦标签时优先读它
      let shortcut = head.querySelector("link[data-wecom-shortcut='1']");
      if (!shortcut) {
        shortcut = document.createElement("link");
        shortcut.rel = "shortcut icon";
        shortcut.type = "image/x-icon";
        shortcut.dataset.wecomShortcut = "1";
        shortcut.setAttribute("href", href);
        head.insertBefore(shortcut, head.firstChild);
      } else if (shortcut.getAttribute("href") !== href) {
        shortcut.setAttribute("href", href);
      }

      if (!faviconObserver) {
        faviconObserver = new MutationObserver(() => {
          if (faviconApplying) return;
          // 站点 SPA / 主题脚本可能写回原 favicon
          makeFavicon();
        });
        faviconObserver.observe(head, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["href", "rel", "type", "sizes"]
        });
      }
    } finally {
      faviconApplying = false;
    }
  }

  function restyleSplash() {
    const splash = document.getElementById("d-splash");
    if (!splash) return;
    document.documentElement.style.setProperty(
      "--wc-splash-logo",
      `url("${FAVICON_URI}")`
    );
  }

  function getViewMode() {
    try {
      return localStorage.getItem(VIEW_KEY) === "native" ? "native" : "im";
    } catch {
      return "im";
    }
  }

  function setViewMode(mode) {
    try {
      localStorage.setItem(VIEW_KEY, mode);
    } catch { /* ignore */ }
  }

  /** 与仓库内其他外观脚本互斥避让 */
  function otherThemeActive() {
    return !!document.getElementById("linuxdo-idea-theme") ||
      document.documentElement.classList.contains("idea-ide-theme") ||
      !!document.getElementById("linuxdo-feishu-theme") ||
      document.documentElement.classList.contains("feishu-im-theme") ||
      !!document.getElementById("linuxdo-dingtalk-theme") ||
      document.documentElement.classList.contains("dingtalk-im-theme");
  }

  /* ============================== 整站强制光明模式 ============================== */

  let lightSchemeObserver = null;
  let forcingLight = false;

  /** Discourse 用 link.light-scheme / link.dark-scheme 的 media 切换明暗 */
  function forceSiteLightMode() {
    if (otherThemeActive()) return;

    forcingLight = true;
    try {
      document.documentElement.style.colorScheme = "light";
      if (document.body) document.body.style.colorScheme = "light";

      for (const link of document.querySelectorAll("link.dark-scheme, link[class*='dark-scheme']")) {
        if (link.media !== "none") link.media = "none";
        if (!link.disabled) link.disabled = true;
      }
      for (const link of document.querySelectorAll("link.light-scheme, link[class*='light-scheme']")) {
        if (link.disabled) link.disabled = false;
        if (link.media !== "all") link.media = "all";
      }

      // 个别主题会在 html/body 挂暗色 class
      document.documentElement.classList.remove("dark", "dark-scheme", "scheme-dark");
      if (document.body) {
        document.body.classList.remove("dark", "dark-scheme", "scheme-dark");
      }
    } finally {
      forcingLight = false;
    }

    ensureLightSchemeObserver();
  }

  function ensureLightSchemeObserver() {
    if (lightSchemeObserver || typeof MutationObserver === "undefined") return;
    lightSchemeObserver = new MutationObserver(() => {
      if (forcingLight || otherThemeActive()) return;
      forceSiteLightMode();
    });
    const start = () => {
      const root = document.head || document.documentElement;
      if (!root) return;
      lightSchemeObserver.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["media", "disabled", "class", "href"]
      });
    };
    start();
  }

  /* ============================== 最左图标 rail ============================== */

  const NAV2_KEY = "linuxdo-wecom-nav2"; // "1" = 展开原生侧栏

  function isNav2Open() {
    try { return localStorage.getItem(NAV2_KEY) === "1"; } catch { return false; }
  }

  function setNav2Open(open) {
    try { localStorage.setItem(NAV2_KEY, open ? "1" : "0"); } catch { /* ignore */ }
    document.documentElement.classList.toggle("wecom-nav2-open", open);
    const moreBtn = document.querySelector(".wecom-rail-more");
    if (moreBtn) {
      moreBtn.classList.toggle("is-on", open);
      moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
      moreBtn.title = open ? "收起话题导航" : "展开话题导航";
    }
  }

  /** 企业微信工作台装饰项；仅消息和底部更多承接真实站点动作。 */
  const RAIL_DECO_ITEMS = [
    { key: "mail", icon: "mail", label: "邮件" },
    { key: "doc", icon: "doc", label: "文档" },
    { key: "cal", icon: "cal", label: "日程" },
    { key: "todo", icon: "todo", label: "待办" },
    { key: "meet", icon: "meet", label: "会议" },
    { key: "smartdoc", icon: "file", label: "智能文档", dot: true },
    { key: "summary", icon: "spark", label: "智能总结" },
    { key: "work", icon: "work", label: "工作台" },
    { key: "book", icon: "book", label: "通讯录" },
    { key: "disk", icon: "disk", label: "微盘" },
    { key: "advanced", icon: "apps", label: "高级功能" }
  ];

  const RAIL_GROUP_ITEMS = [
    { key: "unread", icon: "mail", label: "未读", count: true },
    { key: "at", icon: "at", label: "@我" },
    { key: "single", icon: "users", label: "单聊" },
    { key: "group", icon: "users", label: "群聊" },
    { key: "inside", icon: "chat", label: "内部聊天" },
    { key: "outside", icon: "cloud", label: "外部聊天" },
    { key: "mark", icon: "collect", label: "标记" }
  ];

  /* ---------- 组织 chip：点击改名 / 换图标 ---------- */
  const ORG_NAME_KEY = "linuxdo-wecom-org-name";
  const ORG_ICON_KEY = "linuxdo-wecom-org-icon";

  function getOrgName() {
    try { return localStorage.getItem(ORG_NAME_KEY) || "linux.do"; } catch { return "linux.do"; }
  }

  function getOrgIcon() {
    try { return localStorage.getItem(ORG_ICON_KEY) || "do"; } catch { return "do"; }
  }

  function renderOrgChip(rail) {
    const root = rail || document.querySelector(".wecom-rail");
    if (!root) return;
    const logo = root.querySelector(".wecom-rail-org-logo");
    const name = root.querySelector(".wecom-rail-org-name");
    if (!logo || !name) return;
    const icon = getOrgIcon();
    name.textContent = getOrgName();
    if (/^(https?:\/\/|data:image)/i.test(icon)) {
      logo.innerHTML = `<img src="${escapeHtml(icon)}" alt="">`;
    } else {
      logo.textContent = [...icon].slice(0, 2).join("") || "do";
    }
  }

  function bindOrgChip(rail) {
    const chip = rail?.querySelector(".wecom-rail-org-chip");
    if (!chip || chip.dataset.bound === "1") return;
    chip.dataset.bound = "1";
    const logo = chip.querySelector(".wecom-rail-org-logo");
    const name = chip.querySelector(".wecom-rail-org-name");
    if (logo) {
      logo.title = "点击更换图标（1~2 个字 / emoji / 图片 URL）";
      logo.addEventListener("click", (e) => {
        e.stopPropagation();
        const v = window.prompt("团队图标：1~2 个字、emoji 或图片 URL", getOrgIcon());
        if (v === null) return;
        try { localStorage.setItem(ORG_ICON_KEY, v.trim() || "do"); } catch { /* ignore */ }
        renderOrgChip(rail);
      });
    }
    if (name) {
      name.title = "点击修改团队名称";
      name.addEventListener("click", (e) => {
        e.stopPropagation();
        const v = window.prompt("团队名称", getOrgName());
        if (v === null) return;
        try { localStorage.setItem(ORG_NAME_KEY, v.trim() || "linux.do"); } catch { /* ignore */ }
        renderOrgChip(rail);
      });
    }
  }

  /* ---------- rail 右边缘拖拽调宽 ---------- */
  const RAIL_W_KEY = "linuxdo-wecom-rail-width";
  const RAIL_W_MIN = 138;
  const RAIL_W_MAX = 220;
  const RAIL_W_COMPACT = 150;

  function getRailWidth() {
    try {
      const w = parseInt(localStorage.getItem(RAIL_W_KEY), 10);
      if (w >= RAIL_W_MIN && w <= RAIL_W_MAX) return w;
    } catch { /* ignore */ }
    return RAIL_WIDTH;
  }

  function applyRailWidth(w) {
    const width = Math.min(RAIL_W_MAX, Math.max(RAIL_W_MIN, Math.round(w)));
    document.documentElement.style.setProperty("--wc-nav", `${width}px`);
    const rail = document.querySelector(".wecom-rail");
    if (rail) rail.classList.toggle("wecom-rail-compact", width < RAIL_W_COMPACT);
  }

  function ensureRailResizer() {
    let rz = document.querySelector(".wecom-rail-resizer");
    if (rz) return rz;
    rz = document.createElement("div");
    rz.className = "wecom-rail-resizer";
    rz.title = "拖动调整侧栏宽度（双击复位）";
    document.body.appendChild(rz);

    let dragging = false;
    let startX = 0;
    let startW = 0;
    rz.addEventListener("pointerdown", (e) => {
      dragging = true;
      startX = e.clientX;
      startW = parseInt(document.documentElement.style.getPropertyValue("--wc-nav"), 10) || getRailWidth();
      rz.classList.add("dragging");
      try { rz.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      e.preventDefault();
    });
    rz.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      applyRailWidth(startW + e.clientX - startX);
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      rz.classList.remove("dragging");
      const w = parseInt(document.documentElement.style.getPropertyValue("--wc-nav"), 10);
      if (w) {
        try { localStorage.setItem(RAIL_W_KEY, String(w)); } catch { /* ignore */ }
      }
    };
    rz.addEventListener("pointerup", endDrag);
    rz.addEventListener("pointercancel", endDrag);
    rz.addEventListener("dblclick", () => {
      applyRailWidth(RAIL_WIDTH);
      try { localStorage.removeItem(RAIL_W_KEY); } catch { /* ignore */ }
    });
    return rz;
  }

  /* ---------- 中栏会话列表右边缘拖拽调宽 ---------- */
  const LIST_W_KEY = "linuxdo-wecom-list-width";
  const LIST_W_MIN = 200;
  const LIST_W_MAX = 420;

  function getListWidth() {
    try {
      const w = parseInt(localStorage.getItem(LIST_W_KEY), 10);
      if (w >= LIST_W_MIN && w <= LIST_W_MAX) return w;
    } catch { /* ignore */ }
    return LIST_WIDTH;
  }

  function applyListWidth(w) {
    const width = Math.min(LIST_W_MAX, Math.max(LIST_W_MIN, Math.round(w)));
    document.documentElement.style.setProperty("--wc-list", `${width}px`);
  }

  function ensureListResizer() {
    let rz = document.querySelector(".wecom-list-resizer");
    if (rz) return rz;
    rz = document.createElement("div");
    rz.className = "wecom-list-resizer";
    rz.title = "拖动调整会话列表宽度（双击复位）";
    document.body.appendChild(rz);

    let dragging = false;
    let startX = 0;
    let startW = 0;
    rz.addEventListener("pointerdown", (e) => {
      dragging = true;
      startX = e.clientX;
      startW = parseInt(document.documentElement.style.getPropertyValue("--wc-list"), 10) || getListWidth();
      rz.classList.add("dragging");
      try { rz.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      e.preventDefault();
    });
    rz.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      applyListWidth(startW + e.clientX - startX);
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      rz.classList.remove("dragging");
      const w = parseInt(document.documentElement.style.getPropertyValue("--wc-list"), 10);
      if (w) {
        try { localStorage.setItem(LIST_W_KEY, String(w)); } catch { /* ignore */ }
      }
    };
    rz.addEventListener("pointerup", endDrag);
    rz.addEventListener("pointercancel", endDrag);
    rz.addEventListener("dblclick", () => {
      applyListWidth(LIST_WIDTH);
      try { localStorage.removeItem(LIST_W_KEY); } catch { /* ignore */ }
    });
    return rz;
  }

  function bindRailSearch(rail) {
    if (!rail) return;
    let wrap = rail.querySelector(".wecom-rail-search");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "wecom-rail-search";
      const head = rail.querySelector(".wecom-rail-head");
      if (head && head.nextSibling) rail.insertBefore(wrap, head.nextSibling);
      else rail.prepend(wrap);
    }
    // 旧版装饰块 / 缺 input 时升级为可输入搜索
    if (!wrap.querySelector("input")) {
      wrap.innerHTML = `
        <form action="/search" method="get" role="search">
          ${ICONS.search}
          <input type="search" name="q" placeholder="搜索" autocomplete="off" enterkeyhint="search" aria-label="搜索">
        </form>`;
      delete rail.dataset.searchBound;
    }
    if (rail.dataset.searchBound === "1") return;
    const form = wrap.querySelector("form");
    const input = wrap.querySelector("input");
    if (!form || !input) return;
    rail.dataset.searchBound = "1";

    input.addEventListener("input", () => {
      syncSearchToNative(input.value);
    });
    input.addEventListener("focus", () => {
      syncSearchToNative(input.value);
      const native = getNativeSearchInput();
      if (native && native !== input) {
        try { native.dispatchEvent(new FocusEvent("focus", { bubbles: true })); } catch { /* ignore */ }
      }
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      e.stopPropagation();
      submitNativeSearch(input.value);
    });
  }


  /* ============================== 会话栏搜索 ============================== */

  function bindSearchBox(container) {
    if (!container || container.dataset.searchBound === "1") return;
    const form = container.querySelector(".wecom-list-search form");
    const input = form?.querySelector("input");
    if (!form || !input) return;
    container.dataset.searchBound = "1";
    input.addEventListener("input", () => syncSearchToNative(input.value));
    input.addEventListener("focus", () => {
      syncSearchToNative(input.value);
      const native = getNativeSearchInput();
      if (native && native !== input) {
        try { native.dispatchEvent(new FocusEvent("focus", { bubbles: true })); } catch { /* ignore */ }
      }
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      e.stopPropagation();
      submitNativeSearch(input.value);
    });
  }

  function ensureRail() {
    let rail = document.querySelector(".wecom-rail");
    // 旧结构重建为企业微信 5.x 展开导航
    if (rail && !rail.querySelector(".wecom-rail-groups")) {
      rail.remove();
      rail = null;
    }
    if (rail) {
      bindRailAvatarNotif(rail);
      syncRail();
      return rail;
    }
    rail = document.createElement("nav");
    rail.className = "wecom-rail";
    rail.setAttribute("aria-label", "企业微信工作台导航");

    const head = document.createElement("div");
    head.className = "wecom-rail-head";
    head.innerHTML =
      `<div class="me-chip" title="通知与个人菜单">` +
      `<div class="wecom-rail-avatar"></div>` +
      `<span class="wecom-rail-avatar-badge" style="display:none"></span>` +
      `</div>` +
      `<span class="wecom-current-user-name">linux.do</span>` +
      `<div class="wecom-rail-org-chip" hidden>` +
      `<span class="wecom-rail-org-logo">do</span>` +
      `<span class="wecom-rail-org-name">linux.do</span>` +
      `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>` +
      `</div>`;
    rail.appendChild(head);

    const items = document.createElement("div");
    items.className = "wecom-rail-items";
    items.innerHTML =
      `<button type="button" class="wecom-rail-item active" data-rail-key="chat">${ICONS.msg}<span>消息</span>` +
      `<span class="wecom-rail-badge" style="display:none"></span></button>` +
      RAIL_DECO_ITEMS.map((item) =>
        `<button type="button" class="wecom-rail-item" data-rail-key="${item.key}">${ICONS[item.icon]}<span>${item.label}</span>${item.dot ? '<i class="wecom-rail-dot"></i>' : ""}</button>`
      ).join("");
    rail.appendChild(items);

    const groups = document.createElement("div");
    groups.className = "wecom-rail-groups";
    groups.innerHTML = `<div class="wecom-rail-group-title">分组</div>` +
      RAIL_GROUP_ITEMS.map((item) =>
        `<button type="button" class="wecom-rail-group-item" data-group-key="${item.key}">${ICONS[item.icon]}<span>${item.label}</span>${item.count ? '<b class="wecom-group-unread"></b>' : ""}</button>`
      ).join("");
    groups.querySelector('[data-group-key="unread"]')?.addEventListener("click", () => navigateInApp("/unseen"));
    rail.appendChild(groups);

    // 底部「更多」：展开 / 收起话题导航（原生侧栏）
    const bottom = document.createElement("div");
    bottom.className = "wecom-rail-bottom";
    const more = document.createElement("button");
    more.type = "button";
    more.className = "wecom-rail-item wecom-rail-more";
    more.dataset.railKey = "more";
    more.title = "展开话题导航";
    more.setAttribute("aria-expanded", "false");
    more.innerHTML = `${ICONS.build}<span>我的企业</span>`;
    more.addEventListener("click", () => setNav2Open(!isNav2Open()));
    bottom.appendChild(more);
    rail.appendChild(bottom);

    document.body.appendChild(rail);
    renderOrgChip(rail);
    bindOrgChip(rail);
    bindRailAvatarNotif(rail);
    setNav2Open(isNav2Open()); // 同步「更多」高亮态
    syncRail();
    return rail;
  }

  /** 读取 Discourse 未读通知数（与顶栏用户菜单角标同源） */
  function getUnreadNotificationCount() {
    try {
      const owner = getEmberOwner();
      const user =
        safeLookup(owner, "service:current-user") ||
        window.Discourse?.User?.current?.() ||
        null;
      if (user) {
        const pick = (key) => {
          try {
            const v = user.get?.(key);
            if (v != null && v !== "") return Number(v);
          } catch { /* ignore */ }
          const direct = user[key];
          return direct == null || direct === "" ? null : Number(direct);
        };
        const all = pick("all_unread_notifications_count");
        if (all != null && !Number.isNaN(all)) return Math.max(0, all);
        const unread = pick("unread_notifications");
        const high = pick("unread_high_priority_notifications");
        const pm = pick("new_personal_messages_notifications_count");
        const sum = (unread || 0) + (high || 0) + (pm || 0);
        if (sum > 0) return sum;
        if (unread != null && !Number.isNaN(unread)) return Math.max(0, unread);
      }
    } catch { /* ignore */ }

    const domBadge = document.querySelector(
      "#current-user .badge-notification, " +
      ".header-dropdown-toggle.current-user .badge-notification, " +
      "#toggle-current-user .badge-notification, " +
      ".current-user .badge-notification"
    );
    if (domBadge) {
      const text = (domBadge.textContent || "").replace(/\s+/g, "").trim();
      if (/^\d+$/.test(text)) return Number(text);
      if (/\d/.test(text)) {
        const n = parseInt(text, 10);
        if (!Number.isNaN(n)) return Math.min(n, 99);
      }
      // 只有红点/图标、无数字时视为至少 1
      if (domBadge.classList.contains("unread") || domBadge.querySelector("svg")) return 1;
    }
    return 0;
  }

  function syncRail() {
    // 当前用户头像与名称
    const avatarEl = document.querySelector(".wecom-rail-avatar");
    if (!avatarEl) return;
    // 头像：取原生当前用户头像
    const img = document.querySelector("#current-user img");
    const name = getCurrentUsername();
    if (img && img.src) {
      if (avatarEl.dataset.bound !== img.src) {
        avatarEl.dataset.bound = img.src;
        avatarEl.innerHTML = `<img src="${escapeHtml(img.src)}" alt="">`;
        avatarEl.style.background = "transparent";
      }
    } else if (name && avatarEl.dataset.bound !== name) {
      avatarEl.dataset.bound = name;
      avatarEl.textContent = avatarLetter(name);
      avatarEl.style.background = avatarColor(name);
    }
    const currentName = document.querySelector(".wecom-current-user-name");
    if (currentName) currentName.textContent = name || getOrgName();

    // 头像通知角标
    const notifCount = getUnreadNotificationCount();
    const avatarBadge = document.querySelector(".wecom-rail-avatar-badge");
    if (avatarBadge) {
      avatarBadge.style.display = notifCount > 0 ? "" : "none";
      avatarBadge.textContent = notifCount > 99 ? "99+" : String(notifCount);
    }

    // 「消息」项未读（中栏话题求和）
    const unread = listState.topics.reduce((sum, t) => sum + (t.unread || 0) + (t.new_posts || 0), 0);
    const badge = document.querySelector('[data-rail-key="chat"] .wecom-rail-badge');
    if (badge) {
      badge.style.display = unread > 0 ? "" : "none";
      badge.textContent = unread > 99 ? "99+" : String(unread);
    }
    const groupUnread = document.querySelector(".wecom-group-unread");
    if (groupUnread) groupUnread.textContent = unread > 99 ? "99+" : String(unread || "");
  }

  /* ============================== 左侧头像 hover → 原生通知菜单 ============================== */

  let notifLeaveTimer = null;
  let notifOpenInFlight = false;
  let notifMenuObserver = null;
  let notifPinned = false; // 点击头像钉住；再点头像 / 点外面取消
  let notifWantOpen = false; // 意向开关：避免收起后因仍悬停被 observer 再次捞起
  let notifIgnoreHoverUntil = 0; // 点击收起后短暂忽略 hover，防止立刻再打开

  function findUserMenu() {
    return document.querySelector(".user-menu.revamped.menu-panel, .user-menu.menu-panel, .user-menu");
  }

  function findUserMenuToggle() {
    return document.querySelector(
      "#toggle-current-user, #current-user button, .header-dropdown-toggle.current-user button, .current-user button.icon, #current-user .icon, #current-user summary, button[aria-controls*='user'], .header-dropdown-toggle.current-user"
    );
  }

  function getHeaderService() {
    return safeLookup(getEmberOwner(), "service:header");
  }

  /** 打开/关闭 Discourse 原生 user-menu（优先 Ember header.userVisible） */
  function setUserMenuVisible(visible) {
    const header = getHeaderService();
    if (header) {
      try {
        if ("userVisible" in header) {
          header.userVisible = !!visible;
          return true;
        }
        if (typeof header.set === "function") {
          header.set("userVisible", !!visible);
          return true;
        }
      } catch (err) {
        console.warn("[linuxdo-wecom] header.userVisible failed", err);
      }
    }

    const events = safeLookup(getEmberOwner(), "service:app-events");
    if (events && typeof events.trigger === "function") {
      try {
        const isOpen = !!findUserMenu();
        // keyboard-trigger 是 toggle：仅在状态需要变化时触发
        if (!!visible !== isOpen) {
          events.trigger("header:keyboard-trigger", { type: "user" });
        }
        return true;
      } catch (err) {
        console.warn("[linuxdo-wecom] app-events user menu failed", err);
      }
    }
    return false;
  }

  function setNotifOpenClass(open) {
    document.documentElement.classList.toggle("wecom-notif-open", !!open);
  }

  function positionNotifMenu(menu) {
    if (!menu || !notifWantOpen) return;
    // 顶栏被 opacity:0 / clip 藏起来；菜单必须挪到 body 才能看见
    if (menu.parentElement !== document.body) {
      document.body.appendChild(menu);
    }
    menu.classList.add("wecom-user-menu-float", "show-avatars");
    // 显隐交给 html.wecom-notif-open；这里清掉 Discourse 内联定位
    menu.style.display = "";
    menu.style.visibility = "";
    menu.style.opacity = "";
    menu.style.pointerEvents = "";
    menu.style.position = "";
    menu.style.left = "";
    menu.style.top = "";
    menu.style.right = "";
    menu.style.bottom = "";
    menu.style.transform = "";
    setNotifOpenClass(true);
  }

  function clickUserMenuToggle() {
    const toggle = findUserMenuToggle();
    if (!toggle) return false;
    try {
      toggle.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    } catch {
      try { toggle.click(); } catch { return false; }
    }
    return true;
  }

  /** 短暂解除顶栏隐藏，让原生 click / Ember 能创建菜单，再靠 observer 挪到 body */
  function unlockHeaderForNotifClick() {
    let style = document.getElementById("wecom-unlock-header");
    if (!style) {
      style = document.createElement("style");
      style.id = "wecom-unlock-header";
      style.textContent = `
        html.wecom-im-theme.wecom-notif-opening .d-header-wrap,
        html.wecom-im-theme.wecom-notif-opening .d-header {
          opacity: 1 !important;
          clip: auto !important;
          overflow: visible !important;
          width: auto !important;
          height: auto !important;
          max-width: none !important;
          max-height: none !important;
          pointer-events: auto !important;
          z-index: 440 !important;
          top: -9999px !important;
          left: 0 !important;
          position: fixed !important;
        }
      `;
      document.documentElement.appendChild(style);
    }
    document.documentElement.classList.add("wecom-notif-opening");
  }

  function lockHeaderAfterNotif() {
    document.documentElement.classList.remove("wecom-notif-opening");
  }

  function adoptNotifMenuIfAny() {
    if (!notifWantOpen) return false;
    const menu = findUserMenu();
    if (!menu) return false;
    positionNotifMenu(menu);
    bindNotifMenuHover(menu);
    lockHeaderAfterNotif();
    return true;
  }

  function openNotifMenu() {
    notifWantOpen = true;
    if (adoptNotifMenuIfAny()) {
      // 已打开则确保 Ember 状态同步为可见
      setUserMenuVisible(true);
      return true;
    }
    if (notifOpenInFlight) return false;
    notifOpenInFlight = true;
    ensureNotifMenuObserver();

    let opened = false;
    try {
      opened = setUserMenuVisible(true);
    } catch (err) {
      console.warn("[linuxdo-wecom] setUserMenuVisible threw", err);
    }

    // Ember 失败或不立刻出 DOM → 解锁顶栏再点一次原生按钮
    if (!findUserMenu()) {
      unlockHeaderForNotifClick();
      clickUserMenuToggle();
    } else {
      opened = true;
    }

    let tries = 0;
    const poll = setInterval(() => {
      if (adoptNotifMenuIfAny()) {
        notifOpenInFlight = false;
        clearInterval(poll);
        return;
      }
      if (++tries > 24) {
        notifOpenInFlight = false;
        lockHeaderAfterNotif();
        clearInterval(poll);
        console.warn("[linuxdo-wecom] openNotifMenu: menu not found", {
          opened,
          hasOwner: !!getEmberOwner(),
          hasHeader: !!getHeaderService(),
          hasToggle: !!findUserMenuToggle()
        });
      }
    }, 50);
    return opened;
  }

  function setNotifPinned(pinned) {
    notifPinned = !!pinned;
    document.documentElement.classList.toggle("wecom-notif-pinned", notifPinned);
    const avatar = document.querySelector(".wecom-rail-avatar");
    if (avatar) avatar.classList.toggle("is-notif-pinned", notifPinned);
  }

  function hideNotifMenuNode(menu) {
    if (!menu) return;
    delete menu.dataset.wecomHoverBound;
    // 先靠 html.wecom-notif-open 隐藏；再尽量拆掉节点，防止 Ember 残留
    menu.classList.remove("show-avatars");
    try {
      menu.remove();
    } catch {
      menu.classList.remove("wecom-user-menu-float");
      menu.style.display = "none";
    }
  }

  function closeNotifMenu() {
    notifWantOpen = false;
    notifOpenInFlight = false;
    clearNotifLeaveTimer();
    setNotifPinned(false);
    setNotifOpenClass(false); // 关键：立刻靠 CSS 藏掉
    lockHeaderAfterNotif();
    // 藏掉所有我们捞出来的浮层副本
    document.querySelectorAll(".user-menu.wecom-user-menu-float, .wecom-user-menu-float").forEach(hideNotifMenuNode);
    hideNotifMenuNode(findUserMenu());
    try { setUserMenuVisible(false); } catch { /* ignore */ }
    // 看过通知后刷新角标
    setTimeout(() => syncRail(), 400);
  }

  function clearNotifLeaveTimer() {
    if (notifLeaveTimer) {
      clearTimeout(notifLeaveTimer);
      notifLeaveTimer = null;
    }
  }

  function scheduleCloseNotifMenu() {
    if (notifPinned) return; // 已钉住：移出不关，点外面才关
    clearNotifLeaveTimer();
    notifLeaveTimer = setTimeout(() => {
      notifLeaveTimer = null;
      if (notifPinned) return;
      const avatar = document.querySelector(".wecom-rail-avatar");
      const menu = findUserMenu();
      const overAvatar = !!(avatar && avatar.matches(":hover"));
      const overMenu = !!(menu && menu.classList.contains("wecom-user-menu-float") && menu.matches(":hover"));
      if (!overAvatar && !overMenu) closeNotifMenu();
    }, 220);
  }

  function bindNotifMenuHover(menu) {
    if (!menu || menu.dataset.wecomHoverBound === "1") return;
    menu.dataset.wecomHoverBound = "1";
    menu.addEventListener("mouseenter", clearNotifLeaveTimer);
    menu.addEventListener("mouseleave", scheduleCloseNotifMenu);
  }

  function ensureNotifMenuObserver() {
    if (notifMenuObserver) return;
    notifMenuObserver = new MutationObserver(() => {
      if (getViewMode() === "native" || otherThemeActive()) return;
      if (!notifWantOpen) return;
      adoptNotifMenuIfAny();
    });
    notifMenuObserver.observe(document.body, { childList: true, subtree: true });
  }

  function isNotifMenuOpen() {
    return notifPinned || document.documentElement.classList.contains("wecom-notif-open");
  }

  function ensureNotifOutsideClose() {
    if (window.__wecomNotifOutsideBound) return;
    window.__wecomNotifOutsideBound = true;
    const onOutside = (e) => {
      if (!isNotifMenuOpen()) return;
      const avatar = document.querySelector(".wecom-rail-avatar");
      const menu = document.querySelector(".user-menu.wecom-user-menu-float, .wecom-user-menu-float");
      const t = e.target;
      if (avatar && (avatar === t || avatar.contains(t))) return;
      if (menu && (menu === t || menu.contains(t))) return;
      notifIgnoreHoverUntil = Date.now() + 400;
      closeNotifMenu();
    };
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("mousedown", onOutside, true);
  }

  function bindRailAvatarNotif(rail) {
    const avatar = rail?.querySelector(".wecom-rail-avatar");
    if (!avatar || avatar.dataset.notifBound === "1") return;
    avatar.dataset.notifBound = "1";
    avatar.removeAttribute("title");
    ensureNotifOutsideClose();

    avatar.addEventListener("mouseenter", () => {
      if (getViewMode() === "native" || otherThemeActive()) return;
      if (notifPinned) return;
      if (Date.now() < notifIgnoreHoverUntil) return;
      clearNotifLeaveTimer();
      ensureNotifMenuObserver();
      openNotifMenu();
    });
    avatar.addEventListener("mouseleave", scheduleCloseNotifMenu);

    // 点击头像：未钉住 → 钉住；已钉住 → 收起
    avatar.addEventListener("click", (e) => {
      if (getViewMode() === "native" || otherThemeActive()) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      clearNotifLeaveTimer();

      if (notifPinned) {
        notifIgnoreHoverUntil = Date.now() + 500;
        closeNotifMenu();
        return;
      }

      ensureNotifMenuObserver();
      openNotifMenu();
      setNotifPinned(true);
    });
  }

  /* ============================== 窄图标条：假 icon（纯装饰） ============================== */

  const STRIP_ITEMS = [
    { icon: "menu" },
    { icon: "chat", badge: 19 },
    { icon: "calendar", badge: 1 },
    { icon: "contacts" },
    { icon: "wiki" },
    { icon: "cloud" },
    { icon: "task", badge: 11 },
    { icon: "more" }
  ];

  function stripFakeHtml() {
    return STRIP_ITEMS.map((it) =>
      `<div class="wecom-strip-item">${ICONS[it.icon]}` +
      (it.badge ? `<span class="wecom-strip-badge">${it.badge}</span>` : "") +
      `</div>`
    ).join("");
  }

  function ensureStrip() {
    // 企业微信布局不使用窄条；若残留则移除
    document.querySelector(".wecom-strip")?.remove();
    return null;
  }

  /* ============================== 展开栏：站点原生侧栏（原样搬入） ============================== */

  let categoriesCache = null; // [{id,name,slug,color}]

  async function loadCategories() {
    if (categoriesCache) return categoriesCache;
    try {
      const data = await api("/categories.json");
      categoriesCache = (data.category_list && data.category_list.categories) || [];
    } catch {
      categoriesCache = [];
    }
    return categoriesCache;
  }

  function categoryById(id) {
    return (categoriesCache || []).find((c) => c.id === id) || null;
  }

  /* ============================== 中栏：会话列表 ============================== */

  const listState = {
    apiPath: "",
    moreUrl: null,
    loading: false,
    topics: [],
    usersById: {}
  };

  const LIST_NAV_KEY = "linuxdo-wecom-list-nav"; // "1" = 展开中栏筛选
  // 内存态优先，避免 MutationObserver 回写时把展开瞬间打回去
  let listNavOpen = (() => {
    try { return localStorage.getItem(LIST_NAV_KEY) === "1"; } catch { return false; }
  })();

  const DEFAULT_LIST_NAV = [
    { href: "/latest", label: "最新" },
    { href: "/new", label: "新" },
    { href: "/unseen", label: "未读" },
    { href: "/hot", label: "热门" },
    { href: "/top", label: "排行榜" },
    { href: "/posted", label: "我的帖子" },
    { href: "/read", label: "已读" },
    { href: "/bookmarks", label: "书签" },
    { href: "/categories", label: "类别" }
  ];

  function applyListNavDom() {
    const panel = document.querySelector(".wecom-list-panel");
    const nav = document.querySelector(".wecom-list-nav");
    const btn = document.querySelector(".wecom-list-nav-toggle");
    if (panel) panel.classList.toggle("wecom-list-nav-open", listNavOpen);
    if (nav) nav.classList.toggle("open", listNavOpen);
    if (btn) {
      btn.setAttribute("aria-expanded", listNavOpen ? "true" : "false");
      btn.title = listNavOpen ? "收起筛选" : "筛选";
      btn.classList.toggle("is-on", listNavOpen);
      if (!btn.dataset.iconFixed) {
        btn.dataset.iconFixed = "1";
        btn.innerHTML = ICONS.filter;
      }
    }
    if (listNavOpen) syncListNav();
  }

  function setListNavOpen(open) {
    listNavOpen = !!open;
    try { localStorage.setItem(LIST_NAV_KEY, listNavOpen ? "1" : "0"); } catch { /* ignore */ }
    applyListNavDom();
  }

  function collectListNavItems() {
    const native = document.querySelector("#navigation-bar");
    if (native) {
      const items = [...native.querySelectorAll(":scope > li > a, li > a")].map((a) => ({
        href: a.getAttribute("href") || "#",
        label: (a.textContent || "").replace(/\s+/g, " ").trim(),
        active: a.classList.contains("active") || a.getAttribute("aria-current") === "page"
      })).filter((it) => it.label && it.href && it.href !== "#");
      // 去重（有的主题 li>a 会匹配两次）
      const seen = new Set();
      const deduped = items.filter((it) => {
        if (seen.has(it.href)) return false;
        seen.add(it.href);
        return true;
      });
      if (deduped.length) return deduped;
    }
    const path = location.pathname.replace(/\/$/, "") || "/";
    return DEFAULT_LIST_NAV.map((it) => ({
      ...it,
      active: path === it.href || (it.href === "/latest" && path === "/")
    }));
  }

  function syncListNav() {
    const nav = document.querySelector(".wecom-list-nav");
    if (!nav) return;
    const items = collectListNavItems();
    const html = items.map((it) =>
      `<a href="${escapeHtml(it.href)}" class="${it.active ? "active" : ""}">${escapeHtml(it.label)}</a>`
    ).join("");
    if (nav.dataset.sig === html) return; // 避免无变化时触发 MutationObserver 死循环
    nav.dataset.sig = html;
    nav.innerHTML = html;
  }

  function getNativeSearchInput() {
    return document.querySelector(
      "#welcome-banner-search-input, .welcome-banner__search-menu .search-term__input, .search-menu .search-term__input, input.search-term__input"
    );
  }

  function setNativeInputValue(input, value) {
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function syncSearchToNative(value) {
    const input = getNativeSearchInput();
    if (!input) return null;
    if (input.value !== value) setNativeInputValue(input, value);
    return input;
  }

  function submitNativeSearch(value) {
    const q = (value || "").trim();
    if (!q) return;
    const input = syncSearchToNative(q) || getNativeSearchInput();
    if (input) {
      try {
        input.focus({ preventScroll: true });
      } catch {
        try { input.focus(); } catch { /* ignore */ }
      }
      for (const type of ["keydown", "keypress", "keyup"]) {
        input.dispatchEvent(new KeyboardEvent(type, {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        }));
      }
      const form = input.closest("form");
      if (form && typeof form.requestSubmit === "function") {
        try { form.requestSubmit(); } catch { /* ignore */ }
      }
    }
    // 站点搜索页不在 IM 锁定路由内，会露出原生结果
    const target = `/search?q=${encodeURIComponent(q)}`;
    if (location.pathname !== "/search" || new URLSearchParams(location.search).get("q") !== q) {
      // 给 Ember 一点时间吃掉 input 事件；若未跳转再兜底
      setTimeout(() => {
        if (!location.pathname.startsWith("/search")) {
          location.assign(target);
        }
      }, 120);
    }
  }

  /** 站内软跳转：避免中栏自定义链接触发浏览器整页重载 */
  function discourseRouteTo(url) {
    if (!url) return false;
    try {
      const mod = discourseRequire("discourse/lib/url");
      const DiscourseURL = mod?.default || mod;
      if (DiscourseURL && typeof DiscourseURL.routeTo === "function") {
        DiscourseURL.routeTo(url);
        return true;
      }
    } catch { /* ignore */ }
    try {
      if (typeof window.Discourse?.URL?.routeTo === "function") {
        window.Discourse.URL.routeTo(url);
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  function navigateInApp(url) {
    if (!url) return;
    // 绝对地址收成站内路径
    let path = url;
    try {
      if (/^https?:/i.test(url)) path = new URL(url, location.origin).pathname + new URL(url, location.origin).search + new URL(url, location.origin).hash;
    } catch { /* keep url */ }
    if (discourseRouteTo(path)) {
      scheduleApply();
      return;
    }
    history.pushState({}, "", path);
    scheduleApply();
  }

  function bindListPanelClicks(panel) {
    // v3：含企业微信搜索栏与话题导航按钮；旧面板需重绑
    if (!panel || panel.dataset.linkBound === "3") return;
    panel.dataset.linkBound = "3";
    panel.addEventListener("click", (e) => {
      const addBtn = e.target.closest(".wecom-list-add");
      if (addBtn && panel.contains(addBtn)) {
        e.preventDefault();
        e.stopPropagation();
        setNav2Open(!isNav2Open());
        return;
      }

      // 伪装按钮已在按钮自身监听；这里仍兜底一次
      const maskBtn = e.target.closest(".wecom-mask-avatar-toggle");
      if (maskBtn && panel.contains(maskBtn)) {
        e.preventDefault();
        e.stopPropagation();
        setMaskAvatar(!isMaskAvatar());
        return;
      }

      const btn = e.target.closest(".wecom-list-nav-toggle");
      if (btn && panel.contains(btn)) {
        e.preventDefault();
        e.stopPropagation();
        setListNavOpen(!listNavOpen);
        return;
      }

      // 会话/置顶：拦截默认跳转，走 Discourse SPA / pushState
      const link = e.target.closest("a.wecom-conv, .wecom-list-nav a");
      if (!link || !panel.contains(link)) return;
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const href = link.getAttribute("href");
      if (!href || href === "#" || href.startsWith("javascript:")) return;
      e.preventDefault();
      e.stopPropagation();
      navigateInApp(href);
    });
  }

  function ensureListPanel() {
    let panel = document.querySelector(".wecom-list-panel");
    // 旧面板缺筛选按钮/容器时重建
    if (panel && (!panel.querySelector(".wecom-list-search") || !panel.querySelector(".wecom-list-nav-toggle") || !panel.querySelector(".wecom-list-nav") || !panel.querySelector(".wecom-chip"))) {
      panel.remove();
      panel = null;
    }
    if (panel) {
      bindListPanelClicks(panel);
      bindSearchBox(panel);
      ensureMaskAvatarToggle(panel);
      applyListNavDom();
      return panel;
    }
    panel = document.createElement("div");
    panel.className = "wecom-list-panel";
    panel.innerHTML = `
      <div class="wecom-list-search">
        <form action="/search" method="get" role="search">
          ${ICONS.search}
          <input type="search" name="q" placeholder="搜索" autocomplete="off" enterkeyhint="search" aria-label="搜索话题">
        </form>
        <button type="button" class="wecom-list-add" title="打开话题导航" aria-label="打开话题导航">${ICONS.plus}</button>
      </div>
      <div class="wecom-list-header">
        <button type="button" class="wecom-chip-icon wecom-list-nav-toggle" title="筛选" aria-expanded="false">${ICONS.filter}</button>
        <div class="wecom-list-chips">
          <button type="button" class="wecom-chip active" data-chip="all">消息<span class="n"></span></button>
          <button type="button" class="wecom-chip" data-chip="unread">未读<span class="n"></span></button>
        </div>
        <div class="wecom-list-actions">
          <button type="button" class="wecom-icon-btn wecom-mask-avatar-toggle" title="伪装头像：关（点击开启）" aria-pressed="false">${ICONS.disguise}</button>
        </div>
      </div>
      <div class="wecom-list-nav" role="navigation" aria-label="话题筛选"></div>
      <div class="wecom-list-body"></div>
    `;
    document.body.appendChild(panel);
    bindListPanelClicks(panel);
    bindSearchBox(panel);
    ensureMaskAvatarToggle(panel);
    panel.querySelectorAll(".wecom-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        panel.querySelectorAll(".wecom-chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        navigateInApp(chip.dataset.chip === "unread" ? "/unseen" : "/latest");
      });
    });
    panel.querySelector(".wecom-list-body").addEventListener("scroll", () => {
      const body = panel.querySelector(".wecom-list-body");
      if (body.scrollTop + body.clientHeight >= body.scrollHeight - 120) {
        loadMoreList();
      }
    });
    applyListNavDom();
    return panel;
  }

  function topicHref(topic) {
    const slug = topic.slug || "topic";
    const lastRead = rememberedPostForTopic(topic);
    if (lastRead > 1) return `/t/${slug}/${topic.id}/${lastRead}`;
    return `/t/${slug}/${topic.id}`;
  }

  function convAvatarHtml(topic, usersById) {
    if (isMaskAvatar()) {
      if (isGridMaskTopic(topic)) return disguiseGridAvatar(topic);
      const d = disguiseAvatarForTopic(topic);
      return `<span class="wecom-conv-avatar${d.className ? " " + d.className : ""}" style="background:${d.bg};${d.styleExtra}">${d.html}</span>`;
    }
    if (isGroupConversation(topic)) {
      return groupAvatarHtml(topic, usersById || {});
    }
    const poster = (topic.posters || [])[0];
    const user = poster && usersById ? usersById[poster.user_id] : null;
    const displayName = userDisplayName(user, topic.last_poster_username || "?");
    if (user && user.avatar_template) {
      return `<span class="wecom-conv-avatar"><img src="${escapeHtml(fullAvatarUrl(user.avatar_template))}" alt="" loading="lazy"></span>`;
    }
    return `<span class="wecom-conv-avatar is-text-avatar is-solid" style="background:${avatarColor(displayName)}">${escapeHtml(avatarLetter(displayName))}</span>`;
  }

  function convCategoryTag(topic) {
    if (!categoriesCache || !topic.category_id) return "";
    const cat = categoryById(topic.category_id);
    if (!cat) return "";
    return `<span class="wecom-conv-tag">${escapeHtml(cat.name)}</span>`;
  }

  function convRowHtml(topic, usersById) {
    const unread = topic.unread > 0 ? topic.unread : (topic.new_posts > 0 ? topic.new_posts : 0);
    const replyCount = Math.max(0, (topic.posts_count || 1) - 1);
    const summary = topic.last_poster_username
      ? `[${replyCount}条] ${topic.last_poster_username}`
      : `${topic.posts_count || 0} 回复`;
    const tag = convCategoryTag(topic);
    return `
      <a class="wecom-conv" href="${escapeHtml(topicHref(topic))}" data-topic-id="${topic.id}">
        ${convAvatarHtml(topic, usersById)}
        <span class="wecom-conv-info">
          <span class="wecom-conv-top">
            <span class="wecom-conv-title">
              <span class="wecom-conv-name">${escapeHtml(topic.title)}</span>
              ${tag}
            </span>
            <span class="wecom-conv-time">${escapeHtml(formatTime(topic.bumped_at || topic.last_activity_at || topic.created_at))}</span>
          </span>
          <span class="wecom-conv-bottom">
            <span class="wecom-conv-msg">${escapeHtml(summary)}</span>
            ${unread ? `<span class="wecom-conv-badge">${unread > 99 ? "99+" : unread}</span>` : ""}
          </span>
        </span>
      </a>`;
  }

  function isGroupConversation(topic) {
    return Math.abs(Number(topic.id) || 0) % 2 === 1;
  }

  function mulberry32(a) {
    a |= 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededShuffle(arr, seed) {
    const rng = mulberry32(seed);
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function groupAvatarHtml(topic, usersById) {
    const all = Object.values(usersById || {})
      .filter((u) => u && u.avatar_template)
      .map((u) => u.avatar_template);
    const tpls = seededShuffle(all, Number(topic.id) || 1).slice(0, 9);
    const seed = Math.abs(Number(topic.id) || 0);
    const placeholder = surnameForTopic(topic);
    const cells = [];
    for (let i = 0; i < 9; i++) {
      const tpl = tpls[i];
      if (tpl) {
        cells.push(`<img src="${escapeHtml(fullAvatarUrl(tpl))}" alt="" loading="lazy">`);
      } else {
        const color = MASK_GRID_BLUES[(seed + i) % MASK_GRID_BLUES.length];
        cells.push(`<span style="background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;line-height:1;">${escapeHtml(placeholder)}</span>`);
      }
    }
    return `<span class="wecom-conv-avatar is-group">${cells.join("")}</span>`;
  }

  function renderListRows() {
    const body = document.querySelector(".wecom-list-body");
    if (!body) return;
    const usersById = listState.usersById || {};
    body.innerHTML =
      listState.topics.map((t) => convRowHtml(t, usersById)).join("") +
      `<div class="wecom-list-status">${listState.moreUrl ? "下拉加载更多…" : (listState.topics.length ? "没有更多了" : "")}</div>`;
    syncListChips();
    syncListActive();
  }

  /** 中栏 chips 计数：消息 = 已加载话题数，未读 = unread/new_posts 求和 */
  function syncListChips() {
    const allN = document.querySelector('.wecom-chip[data-chip="all"] .n');
    const unreadN = document.querySelector('.wecom-chip[data-chip="unread"] .n');
    if (allN) allN.textContent = listState.topics.length ? String(listState.topics.length) : "";
    if (unreadN) {
      const n = listState.topics.reduce((sum, t) => sum + (t.unread || 0) + (t.new_posts || 0), 0);
      unreadN.textContent = n > 0 ? String(n > 99 ? "99+" : n) : "";
    }
  }

  function syncListActive() {
    const currentId = topicIdFromPath(location.pathname);
    for (const row of document.querySelectorAll(".wecom-conv")) {
      row.classList.toggle("active", currentId != null && Number(row.dataset.topicId) === currentId);
    }
  }

  function applyListJson(data, append) {
    const topics = (data.topic_list && data.topic_list.topics) || [];
    const users = data.users || [];
    const usersById = append ? { ...(listState.usersById || {}) } : {};
    for (const u of users) usersById[u.id] = u;
    listState.usersById = usersById;
    const existing = new Set(append ? listState.topics.map((t) => t.id) : []);
    const fresh = topics.filter((t) => !existing.has(t.id));
    listState.topics = append ? listState.topics.concat(fresh) : topics;
    const more = data.topic_list && data.topic_list.more_topics_url;
    listState.moreUrl = more ? more.replace(/\.json\b/, ".json") : null;
    renderListRows();
    syncRail();
  }

  async function loadList(apiPath, force) {
    if (!apiPath) return;
    // 用列表 API 做缓存键：进帖子时 pathname 会变，但不应重拉会话列表
    if (!force && listState.apiPath === apiPath && listState.topics.length) {
      syncListActive();
      return;
    }
    if (listState.loading) return;
    listState.loading = true;
    listState.apiPath = apiPath;
    try {
      const data = await api(apiPath);
      applyListJson(data, false);
    } catch {
      const body = document.querySelector(".wecom-list-body");
      if (body) body.innerHTML = `<div class="wecom-list-status">列表加载失败，请点右上角刷新重试</div>`;
    } finally {
      listState.loading = false;
    }
  }

  async function loadMoreList() {
    if (!listState.moreUrl || listState.loading) return;
    listState.loading = true;
    try {
      const data = await api(listState.moreUrl);
      applyListJson(data, true);
    } catch { /* 保留现状 */ } finally {
      listState.loading = false;
    }
  }

  /* ============================== 右栏：聊天详情 ============================== */

  const chatState = {
    topicId: null,
    slug: "",
    loading: false,
    stream: [],        // 全部 post id 顺序
    renderedFirstIdx: 0, // stream 中已渲染的起始下标
    renderedLastIdx: -1, // stream 中已渲染的结束下标
    renderedLastNumber: 0, // 已渲染的最大 post_number
    hasOlder: false,
    hasNewer: false,
    title: "",
    replyTotal: 0,
    pinnedPost: 0,
    pinningScroll: false
  };

  let suppressHistoryApply = false;

  const composerBridgeState = {
    topicId: null,
    nativeTopicId: null,
    nativeReplyToPostNumber: null,
    replyToPostNumber: null,
    connecting: null,
    connectingTarget: null,
    connectionSerial: 0,
    submitting: false,
    uploading: false,
    drafts: new Map()
  };

  function normalizeWatermarkText(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }

  function validateWatermarkSettings(settings) {
    const text = normalizeWatermarkText(settings.text);
    if (text.length > WATERMARK_MAX_LENGTH) {
      throw new RangeError(`水印文字不能超过 ${WATERMARK_MAX_LENGTH} 个字符`);
    }
    if (settings.enabled && !text) throw new Error("启用水印前请填写水印文字");
    return Object.freeze({ enabled: Boolean(settings.enabled), text });
  }

  function getWatermarkSettings() {
    const storedText = localStorage.getItem(WATERMARK_TEXT_KEY);
    return validateWatermarkSettings({
      enabled: localStorage.getItem(WATERMARK_ENABLED_KEY) === "1",
      text: storedText === null ? DEFAULT_WATERMARK_TEXT : storedText
    });
  }

  function watermarkBackgroundImage(text) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WATERMARK_TILE_WIDTH}" height="${WATERMARK_TILE_HEIGHT}" viewBox="0 0 ${WATERMARK_TILE_WIDTH} ${WATERMARK_TILE_HEIGHT}"><text x="150" y="82" text-anchor="middle" fill="#7890AA" fill-opacity="0.14" font-family="Microsoft YaHei UI, PingFang SC, sans-serif" font-size="15" transform="rotate(-18 150 82)">${escapeHtml(text)}</text></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  function renderWatermark(settings) {
    const text = normalizeWatermarkText(settings.text);
    const enabled = Boolean(settings.enabled && text);
    const body = document.querySelector(".wecom-chat-body");
    if (body) {
      body.style.backgroundImage = enabled ? watermarkBackgroundImage(text) : "none";
      body.classList.toggle("has-watermark", enabled);
    }
    const button = document.querySelector(".wecom-watermark-settings");
    if (!button) return;
    button.classList.toggle("is-on", enabled);
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
    button.title = enabled ? "背景水印：已开启" : "背景水印设置";
  }

  function saveWatermarkSettings(settings) {
    const value = validateWatermarkSettings(settings);
    localStorage.setItem(WATERMARK_TEXT_KEY, value.text);
    localStorage.setItem(WATERMARK_ENABLED_KEY, value.enabled ? "1" : "0");
    renderWatermark(value);
    return value;
  }

  function watermarkFormSettings(panel) {
    return {
      enabled: panel.querySelector(".wecom-watermark-enabled").checked,
      text: panel.querySelector(".wecom-watermark-text").value
    };
  }

  function setWatermarkError(panel, message) {
    panel.querySelector(".wecom-watermark-error").textContent = message || "";
  }

  function openWatermarkSettings(panel) {
    const settings = getWatermarkSettings();
    const dialog = panel.querySelector(".wecom-watermark-panel");
    dialog.querySelector(".wecom-watermark-enabled").checked = settings.enabled;
    dialog.querySelector(".wecom-watermark-text").value = settings.text;
    setWatermarkError(panel, "");
    dialog.hidden = false;
    panel.querySelector(".wecom-watermark-settings").setAttribute("aria-expanded", "true");
    dialog.querySelector(".wecom-watermark-text").focus();
  }

  function closeWatermarkSettings(panel) {
    panel.querySelector(".wecom-watermark-panel").hidden = true;
    panel.querySelector(".wecom-watermark-settings").setAttribute("aria-expanded", "false");
    renderWatermark(getWatermarkSettings());
  }

  function previewWatermarkSettings(panel) {
    const settings = watermarkFormSettings(panel);
    const text = normalizeWatermarkText(settings.text);
    const message = settings.enabled && !text ? "启用水印前请填写水印文字" : "";
    setWatermarkError(panel, message);
    renderWatermark(settings);
  }

  function bindWatermarkSettings(panel) {
    if (panel.dataset.watermarkBound === "1") return;
    panel.dataset.watermarkBound = "1";
    const dialog = panel.querySelector(".wecom-watermark-panel");
    panel.querySelector(".wecom-watermark-settings").addEventListener("click", () => openWatermarkSettings(panel));
    dialog.querySelectorAll(".wecom-watermark-close, .wecom-watermark-cancel").forEach((button) => {
      button.addEventListener("click", () => closeWatermarkSettings(panel));
    });
    dialog.querySelector(".wecom-watermark-save").addEventListener("click", () => {
      try {
        saveWatermarkSettings(watermarkFormSettings(panel));
        closeWatermarkSettings(panel);
      } catch (error) {
        console.error("[Linux DO 企业微信] 保存水印失败", error);
        setWatermarkError(panel, error instanceof Error ? error.message : String(error));
      }
    });
    dialog.querySelector(".wecom-watermark-enabled").addEventListener("change", () => previewWatermarkSettings(panel));
    dialog.querySelector(".wecom-watermark-text").addEventListener("input", () => previewWatermarkSettings(panel));
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeWatermarkSettings(panel);
    });
  }

  let imageViewerTrigger = null;

  function isPreviewableChatImage(image) {
    if (!(image instanceof HTMLImageElement)) return false;
    if (!image.closest(".wecom-msg-bubble")) return false;
    return !image.matches(".emoji, .site-icon, .avatar, [role='emoji']");
  }

  function normalizePreviewImageUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^data:image\//i.test(raw)) return raw;
    try {
      const url = new URL(raw, location.href);
      if (["http:", "https:", "blob:"].includes(url.protocol)) return url.href;
      console.warn("[Linux DO 企业微信] 已拒绝不支持的图片地址协议", url.protocol);
    } catch (error) {
      console.warn("[Linux DO 企业微信] 图片地址解析失败", raw, error);
    }
    return "";
  }

  function previewImageSource(image) {
    const lightbox = image.closest("a.lightbox, .lightbox-wrapper a[href]");
    const candidates = [
      image.getAttribute("data-large-src"),
      image.getAttribute("data-orig-src"),
      image.getAttribute("data-original"),
      lightbox?.getAttribute("href"),
      image.currentSrc,
      image.getAttribute("src")
    ];
    for (const candidate of candidates) {
      const url = normalizePreviewImageUrl(candidate);
      if (url) return url;
    }
    return "";
  }

  function ensureImageViewer() {
    let viewer = document.querySelector(".wecom-image-viewer");
    if (viewer) return viewer;
    viewer = document.createElement("div");
    viewer.className = "wecom-image-viewer";
    viewer.hidden = true;
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");
    viewer.setAttribute("aria-label", "图片预览");
    viewer.innerHTML = `
      <button type="button" class="wecom-image-viewer-close" aria-label="关闭图片预览">
        <b aria-hidden="true">×</b><span>关闭</span>
      </button>
      <div class="wecom-image-viewer-stage"><img class="wecom-image-viewer-image" alt=""></div>
      <div class="wecom-image-viewer-caption" aria-live="polite"></div>`;
    document.body.appendChild(viewer);
    viewer.addEventListener("click", (event) => {
      const close = event.target.closest(".wecom-image-viewer-close");
      if (close || event.target === viewer || event.target.classList.contains("wecom-image-viewer-stage")) {
        closeImageViewer();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !viewer.hidden) closeImageViewer();
    });
    return viewer;
  }

  function openImageViewer(sourceImage) {
    const src = previewImageSource(sourceImage);
    if (!src) {
      console.error("[Linux DO 企业微信] 无法预览图片：未找到有效图片地址", sourceImage);
      return;
    }
    const viewer = ensureImageViewer();
    const image = viewer.querySelector(".wecom-image-viewer-image");
    const caption = viewer.querySelector(".wecom-image-viewer-caption");
    const label = sourceImage.alt?.trim() || "图片预览";
    imageViewerTrigger = sourceImage;
    image.alt = label;
    caption.textContent = "图片加载中…";
    image.onload = () => { caption.textContent = label; };
    image.onerror = () => {
      caption.textContent = "图片加载失败";
      console.error("[Linux DO 企业微信] 图片预览加载失败", src);
    };
    viewer.hidden = false;
    document.documentElement.classList.add("wecom-image-viewer-open");
    image.src = src;
    viewer.querySelector(".wecom-image-viewer-close").focus({ preventScroll: true });
  }

  function closeImageViewer() {
    const viewer = document.querySelector(".wecom-image-viewer");
    document.documentElement.classList.remove("wecom-image-viewer-open");
    if (!viewer) return;
    viewer.hidden = true;
    const image = viewer.querySelector(".wecom-image-viewer-image");
    image.onload = null;
    image.onerror = null;
    image.removeAttribute("src");
    if (imageViewerTrigger?.isConnected) imageViewerTrigger.focus({ preventScroll: true });
    imageViewerTrigger = null;
  }

  function hydrateChatImages(root) {
    root.querySelectorAll(".wecom-msg-bubble img").forEach((image) => {
      if (!isPreviewableChatImage(image)) return;
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      if (!image.title) image.title = "点击查看大图";
    });
  }

  function ensureChatPanel() {
    let panel = document.querySelector(".wecom-chat-panel");
    if (panel && (!panel.querySelector(".wecom-chat-compose") || !panel.querySelector(".wecom-pinned-banner") ||
      !panel.querySelector(".wecom-watermark-panel") || !panel.querySelector(".wecom-image-input") ||
      !panel.querySelector('[data-composer-action="pic"]'))) {
      panel.remove();
      panel = null;
    }
    if (panel) {
      if (!panel.dataset.composeBound) {
        panel.dataset.composeBound = "1";
        bindChatPanelEvents(panel);
      }
      bindWatermarkSettings(panel);
      renderWatermark(getWatermarkSettings());
      wireComposeButton(panel);
      return panel;
    }
    panel = document.createElement("div");
    panel.className = "wecom-chat-panel";
    panel.dataset.empty = "1";
    panel.dataset.composeBound = "1";
    const toolKeys = [
      ["emoji", "表情"],
      ["cut", "截图"],
      ["folder", "附件"],
      ["pic", "发送图片"],
      ["plus", "更多"]
    ];
    const toolsHtml = toolKeys.map(([key, label]) =>
      `<button type="button" class="wecom-icon-btn" data-composer-action="${key}" title="${label}" aria-label="${label}">${ICONS[key]}</button>`
    ).join("");
    const headTools = ["cam", "phone", "users", "dots"].map((k) => {
      const dot = k === "users" ? '<span class="dot"></span>' : "";
      return `<button type="button" class="wecom-icon-btn" title="${k}" tabindex="-1">${dot}${ICONS[k]}</button>`;
    }).join("");
    panel.innerHTML = `
      <div class="wecom-chat-header">
        <div class="wecom-chat-head-main">
          <span class="wecom-chat-avatar" style="display:none"></span>
          <div class="wecom-chat-titles">
            <div class="wecom-chat-title-row">
              <span class="wecom-chat-title"></span>
              <span class="wecom-chat-count" style="display:none"></span>
              <span class="wecom-chat-chips"></span>
            </div>
            <div class="wecom-chat-sub"></div>
          </div>
        </div>
        <div class="wecom-chat-tools">${headTools}</div>
        <div class="wecom-chat-actions">
          <button type="button" class="wecom-icon-btn wecom-watermark-settings" title="背景水印设置" aria-label="背景水印设置" aria-expanded="false" aria-pressed="false">${ICONS.watermark}</button>
          <button class="wecom-icon-btn wecom-chat-refresh" title="刷新本话题">${ICONS.refresh}</button>
          <button class="wecom-icon-btn wecom-chat-native" title="切换原生视图">${ICONS.external}</button>
        </div>
      </div>
      <section class="wecom-watermark-panel" aria-label="聊天背景水印" hidden>
        <div class="wecom-watermark-head">
          <strong>聊天背景水印</strong>
          <button type="button" class="wecom-watermark-close" title="关闭" aria-label="关闭">×</button>
        </div>
        <label class="wecom-watermark-switch-row">
          <span>启用水印</span>
          <span class="wecom-watermark-switch">
            <input type="checkbox" class="wecom-watermark-enabled">
            <i aria-hidden="true"></i>
          </span>
        </label>
        <label class="wecom-watermark-field">
          <span>水印文字</span>
          <input type="text" class="wecom-watermark-text" maxlength="${WATERMARK_MAX_LENGTH}" placeholder="例如：姓名 / 工号 / 公司名称">
        </label>
        <div class="wecom-watermark-hint">文字会以斜向重复方式显示，仅保存在当前浏览器。</div>
        <div class="wecom-watermark-error" role="alert"></div>
        <div class="wecom-watermark-actions">
          <button type="button" class="wecom-watermark-cancel">取消</button>
          <button type="button" class="wecom-watermark-save">保存</button>
        </div>
      </section>
      <div class="wecom-pinned-banner" style="display:none">
        <span class="wecom-pinned-avatar"></span>
        <span class="wecom-pinned-content"></span>
        <button type="button" class="wecom-pinned-close" title="收起">×</button>
      </div>
      <div class="wecom-chat-body"></div>
      <div class="wecom-composer">
        <div class="wecom-composer-card">
          <div class="wecom-composer-tools">${toolsHtml}<input class="wecom-image-input" type="file" accept="image/*" multiple aria-label="选择图片"><span class="wecom-compose-status" aria-live="polite"></span><div class="spacer"></div><button type="button" class="wecom-send-btn" disabled>发送</button></div>
          <div class="wecom-reply-target" hidden><span></span><button type="button" class="wecom-reply-cancel" aria-label="取消指定回复">×</button></div>
          <textarea class="wecom-chat-compose" data-wecom-compose="1" rows="3" aria-label="消息" placeholder="发送消息"></textarea>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    bindChatPanelEvents(panel);
    bindWatermarkSettings(panel);
    renderWatermark(getWatermarkSettings());
    panel.querySelector(".wecom-pinned-close")?.addEventListener("click", () => {
      const banner = panel.querySelector(".wecom-pinned-banner");
      if (banner) banner.style.display = "none";
    });
    wireComposeButton(panel);
    return panel;
  }

  function memberAvatarHtml(user) {
    const name = userDisplayName(user, user?.username || "?");
    if (!isMaskAvatar() && user?.avatar_template) {
      return `<span class="wecom-member-avatar"><img src="${escapeHtml(fullAvatarUrl(user.avatar_template))}" alt=""></span>`;
    }
    return `<span class="wecom-member-avatar" style="background:${avatarColor(name)}">${escapeHtml(avatarLetter(name))}</span>`;
  }

  function topicParticipants(data, posts) {
    const source = [...(data?.details?.participants || []), ...(posts || [])];
    const seen = new Set();
    return source.filter((user) => {
      const key = normalizeUsername(user?.username) || String(user?.id || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function memberRowHtml(user, role) {
    const name = userDisplayName(user, user?.username || "?");
    const roleHtml = role ? `<span class="wecom-member-role">${escapeHtml(role)}</span>` : "";
    return `<div class="wecom-member-row">${memberAvatarHtml(user)}<span class="wecom-member-name">${escapeHtml(name)}</span>${roleHtml}</div>`;
  }

  function ensureMemberPanel() {
    let panel = document.querySelector(".wecom-member-panel");
    if (panel) return panel;
    panel = document.createElement("aside");
    panel.className = "wecom-member-panel";
    panel.innerHTML = `
      <div class="wecom-member-header">
        <span>群成员 · <b class="wecom-member-count">0</b></span>
        <span class="wecom-member-actions">${ICONS.mail}${ICONS.dots}</span>
      </div>
      <div class="wecom-member-body"></div>`;
    document.body.appendChild(panel);
    return panel;
  }

  function renderMemberPanel(data, posts) {
    const panel = ensureMemberPanel();
    const users = topicParticipants(data, posts);
    const owner = posts.find((post) => post.post_number === 1) || users[0] || null;
    const others = users.filter((user) => normalizeUsername(user.username) !== normalizeUsername(owner?.username));
    const total = data.participant_count || users.length;
    panel.querySelector(".wecom-member-count").textContent = String(total);
    panel.querySelector(".wecom-member-body").innerHTML =
      `<div class="wecom-member-section"><div class="wecom-member-section-title">群主/管理员</div>${owner ? memberRowHtml(owner, "群主") : ""}</div>` +
      `<div class="wecom-member-section"><div class="wecom-member-section-title">群成员</div>${others.map((user) => memberRowHtml(user, "")).join("")}</div>`;
    document.documentElement.classList.add("wecom-members-open");
  }

  function renderPinnedBanner(posts) {
    const banner = document.querySelector(".wecom-pinned-banner");
    if (!banner) return;
    const pinned = posts.find((post) => post.pinned || post.pinned_at);
    if (!pinned) {
      banner.style.display = "none";
      return;
    }
    const name = userDisplayName(pinned, pinned.username || "?");
    const text = String(pinned.cooked || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    banner.querySelector(".wecom-pinned-avatar").textContent = avatarLetter(name);
    banner.querySelector(".wecom-pinned-content").innerHTML = `<b>${escapeHtml(name)}置顶了</b><span>${escapeHtml(text.slice(0, 96) || "[消息]")}</span>`;
    banner.style.display = "flex";
  }

  function wireComposeButton(panel) {
    const input = panel.querySelector(".wecom-chat-compose");
    if (!input || input.dataset.wired === "1") return;
    input.dataset.wired = "1";
    input.addEventListener("focus", (event) => {
      event.stopPropagation();
    });
    input.addEventListener("input", (event) => {
      event.stopPropagation();
      handleComposerInput(input);
    });
    ["beforeinput", "keypress", "keyup", "compositionstart", "compositionupdate", "compositionend"].forEach((type) => {
      input.addEventListener(type, (event) => event.stopPropagation());
    });
    input.addEventListener("keydown", handleComposerKeydown);
    input.addEventListener("paste", handleComposerPaste);
    input.addEventListener("drop", handleComposerDrop);
    input.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    panel.querySelector(".wecom-image-input")?.addEventListener("change", handleComposerFileChange);
    panel.querySelector(".wecom-send-btn")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      submitComposerFromUi(event);
    });
    panel.querySelector(".wecom-reply-cancel")?.addEventListener("click", cancelTargetedReply);
    panel.querySelectorAll(".wecom-composer-tools .wecom-icon-btn").forEach((button) => {
      button.addEventListener("pointerdown", stopComposerPointer, true);
      button.addEventListener("mousedown", stopComposerPointer, true);
      button.addEventListener("click", handleComposerToolClick);
    });
    updateComposeSendState();
  }

  function bindChatPanelEvents(panel) {
    panel.addEventListener("click", (e) => {
      const previewImage = e.target.closest(".wecom-msg-bubble img");
      if (isPreviewableChatImage(previewImage)) {
        e.preventDefault();
        e.stopPropagation();
        openImageViewer(previewImage);
        return;
      }
      if (e.target.closest(".wecom-chat-refresh")) {
        if (chatState.topicId) loadTopic(chatState.topicId, true);
        return;
      }
      if (e.target.closest(".wecom-chat-native")) {
        setViewMode("native");
        location.reload();
        return;
      }
      // 聊天头分类 chip：站内软跳转
      const chipLink = e.target.closest("a.wecom-chat-chip");
      if (chipLink && panel.contains(chipLink)) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        navigateInApp(chipLink.getAttribute("href"));
        return;
      }
      const toolBtn = e.target.closest(".wecom-msg-tool");
      if (!toolBtn || !panel.contains(toolBtn)) return;
      const msg = toolBtn.closest(".wecom-msg");
      if (!msg) return;
      if (toolBtn.dataset.action === "like") {
        toggleLike(Number(msg.dataset.postId), toolBtn);
      } else if (toolBtn.dataset.action === "reply") {
        e.preventDefault();
        e.stopPropagation();
        replyToPost(Number(msg.dataset.postNumber));
      }
    });
    panel.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (!isPreviewableChatImage(event.target)) return;
      event.preventDefault();
      openImageViewer(event.target);
    });
    panel.querySelector(".wecom-chat-body").addEventListener("scroll", () => {
      if (chatState.pinningScroll) return;
      chatState.pinnedPost = 0;
      const body = panel.querySelector(".wecom-chat-body");
      if (body.scrollTop < 80) loadOlderPosts();
      if (body.scrollTop + body.clientHeight >= body.scrollHeight - 120) loadNewerPosts();
      trackVisibleTopicPost();
    });
  }

  function renderChatEmpty() {
    ensureChatPanel();
    chatState.topicId = null;
    chatState.slug = "";
    chatState.replyTotal = 0;
    chatState.pinnedPost = 0;
    switchComposerTopic(null);
    const panel = document.querySelector(".wecom-chat-panel");
    if (panel) panel.dataset.empty = "1";
    const body = document.querySelector(".wecom-chat-body");
    if (!body || body.dataset.state === "empty") return;
    body.dataset.state = "empty";
    const title = document.querySelector(".wecom-chat-title");
    const sub = document.querySelector(".wecom-chat-sub");
    if (title) title.textContent = "";
    if (sub) sub.textContent = "";
    const count = document.querySelector(".wecom-chat-count");
    if (count) { count.style.display = "none"; count.textContent = ""; }
    const chips = document.querySelector(".wecom-chat-chips");
    if (chips) chips.innerHTML = "";
    const chatAvatar = document.querySelector(".wecom-chat-avatar");
    if (chatAvatar) chatAvatar.style.display = "none";
    document.documentElement.classList.remove("wecom-members-open");
    document.querySelector(".wecom-member-panel")?.remove();
    const pinned = document.querySelector(".wecom-pinned-banner");
    if (pinned) pinned.style.display = "none";
    body.innerHTML = `
      <div class="wecom-chat-empty">
        ${ICONS.msg}
        <div>暂无消息</div>
      </div>`;
  }

  function renderChatError(message) {
    const body = document.querySelector(".wecom-chat-body");
    if (!body) return;
    body.innerHTML = `
      <div class="wecom-chat-error">
        ${ICONS.chat}
        <div>${escapeHtml(message)}</div>
        <button class="wecom-empty-btn" onclick="location.reload()">打开原生页面</button>
      </div>`;
  }

  const likedPosts = new Set();

  function bubbleHtml(post, myName) {
    const me = isMyPost(post, myName);
    const side = me ? "me" : "other";
    const displayName = userDisplayName(post, post.username || "?");
    let avatar;
    let avatarBg = avatarColor(displayName);
    if (isMaskAvatar()) {
      avatar = escapeHtml(avatarLetter(displayName));
    } else if (post.avatar_template) {
      avatar = `<img src="${escapeHtml(fullAvatarUrl(post.avatar_template))}" alt="" loading="lazy">`;
      avatarBg = "transparent";
    } else {
      avatar = escapeHtml(avatarLetter(displayName));
    }
    const liked = post.id && likedPosts.has(post.id) ? " liked" : "";
    return `
      <div class="wecom-msg wecom-msg-${side}" data-post-number="${post.post_number}"${post.id ? ` data-post-id="${post.id}"` : ""}${me ? ' data-mine="1"' : ""}>
        <span class="wecom-msg-avatar" style="background:${avatarBg}">${avatar}</span>
        <div class="wecom-msg-content">
          <span class="wecom-msg-name">${escapeHtml(displayName)}</span>
          <div class="wecom-msg-bubble">${post.cooked || ""}</div>
          <span class="wecom-msg-meta">
            <span>#${post.post_number}</span>
            <span>${escapeHtml(formatTime(post.created_at))}</span>
          </span>
          <div class="wecom-msg-tools">
            <button class="wecom-msg-tool${liked}" data-action="like" title="点赞">${ICONS.like}</button>
            <button class="wecom-msg-tool" data-action="reply" title="回复">${ICONS.reply}</button>
          </div>
        </div>
      </div>`;
  }

  function csrfToken() {
    const meta = document.querySelector("meta[name='csrf-token']");
    if (meta?.content) return meta.content;
    const session = safeLookup(getEmberOwner(), "service:session");
    return session?.csrfToken || session?.get?.("csrfToken") || "";
  }

  function bridgeHeaders(contentType) {
    const headers = { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" };
    const token = csrfToken();
    if (token) headers["X-CSRF-Token"] = token;
    if (contentType) headers["Content-Type"] = contentType;
    return headers;
  }

  async function responsePayload(response) {
    if (typeof response?.text !== "function") {
      return typeof response?.json === "function" ? response.json() : null;
    }
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return { raw: text }; }
  }

  function payloadError(payload, fallback) {
    const errors = payload?.errors || payload?.error;
    if (Array.isArray(errors) && errors.length) return errors.join("；");
    if (typeof errors === "string" && errors.trim()) return errors.trim();
    if (typeof payload?.message === "string" && payload.message.trim()) return payload.message.trim();
    if (typeof payload?.raw === "string" && payload.raw.trim()) {
      return payload.raw.replace(/\s+/g, " ").trim().slice(0, COMPOSER_ERROR_PREVIEW_LENGTH);
    }
    return fallback;
  }

  function responseStatus(error) {
    return Number(error?.status) || 0;
  }

  function markResponseError(error, status) {
    error.status = Number(status) || 0;
    return error;
  }

  function retryableEndpointError(error) {
    return error instanceof TypeError || Boolean(error?.retryable) ||
      RETRYABLE_ENDPOINT_STATUS.has(responseStatus(error));
  }

  function submittedPostFromPayload(payload) {
    const post = payload?.post || payload?.created_post || payload;
    if (!post || typeof post !== "object") return null;
    const id = Number(post.id || post.post_id);
    const number = Number(post.post_number || post.postNumber);
    return id > 0 || number > 0 ? post : null;
  }

  async function submitReplyViaApi(raw, replyToPostNumber) {
    const body = { raw, topic_id: Number(chatState.topicId) };
    if (replyToPostNumber) body.reply_to_post_number = Number(replyToPostNumber);
    let lastError = null;
    for (const endpoint of POST_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "same-origin",
          headers: bridgeHeaders("application/json; charset=UTF-8"),
          body: JSON.stringify(body)
        });
        const payload = await responsePayload(response);
        if (!response.ok) {
          lastError = markResponseError(new Error(payloadError(payload, `HTTP ${response.status}`)), response.status);
          if (RETRYABLE_ENDPOINT_STATUS.has(response.status)) continue;
          throw lastError;
        }
        const post = submittedPostFromPayload(payload);
        if (post) return post;
        lastError = new Error(payloadError(payload, "站点未确认回复"));
        lastError.retryable = true;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (!retryableEndpointError(error)) throw lastError;
      }
    }
    throw lastError || new Error("回复接口不可用");
  }

  function imageFile(file) {
    if (!file) return false;
    if (String(file.type || "").toLowerCase().startsWith("image/")) return true;
    return /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(String(file.name || ""));
  }

  function uploadPayload(payload) {
    const first = Array.isArray(payload?.uploads) ? payload.uploads[0] : null;
    return payload?.upload || first || payload;
  }

  function uploadedImageUrl(payload) {
    const upload = uploadPayload(payload);
    const value = upload?.short_url || upload?.url || upload?.thumbnail_url;
    if (/^upload:\/\//i.test(String(value || ""))) return String(value);
    return normalizePreviewImageUrl(value);
  }

  function markdownImageUrl(url) {
    return String(url || "").replace(/[\\()]/g, (char) => `\\${char}`);
  }

  function uploadedImageMarkdown(payload, file) {
    const upload = uploadPayload(payload);
    const url = uploadedImageUrl(upload);
    if (!url) throw new Error("站点未返回图片地址");
    const rawLabel = String(upload?.original_filename || file?.name || "图片");
    const label = rawLabel.replace(/\.[^.]+$/, "").replace(/[\[\]\\|]/g, "_");
    const width = Number(upload?.thumbnail_width || upload?.width) || 0;
    const height = Number(upload?.thumbnail_height || upload?.height) || 0;
    const dimensions = width > 0 && height > 0 ? `|${width}x${height}` : "";
    return `![${label}${dimensions}](${markdownImageUrl(url)})`;
  }

  async function uploadImageFile(file) {
    let lastError = null;
    for (const endpoint of UPLOAD_ENDPOINTS) {
      const form = new FormData();
      form.append("file", file, file.name || "image");
      // 原生 composer 使用 composer 类型；type 仅供旧版 Discourse 兼容读取。
      form.append("upload_type", "composer");
      form.append("type", "composer");
      form.append("synchronous", "true");
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "same-origin",
          headers: bridgeHeaders(),
          body: form
        });
        const payload = await responsePayload(response);
        if (!response.ok) {
          lastError = markResponseError(new Error(payloadError(payload, `HTTP ${response.status}`)), response.status);
          if (RETRYABLE_ENDPOINT_STATUS.has(response.status)) continue;
          throw lastError;
        }
        if (uploadedImageUrl(payload)) return payload;
        lastError = new Error("站点未返回图片地址");
        lastError.retryable = true;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (!retryableEndpointError(error)) throw lastError;
      }
    }
    throw lastError || new Error("图片上传接口不可用");
  }

  function insertComposerText(text) {
    const input = composeUi().input;
    if (!input || !text) return;
    const start = Number.isInteger(input.selectionStart) ? input.selectionStart : input.value.length;
    const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start;
    const before = input.value.slice(0, start);
    const after = input.value.slice(end);
    const prefix = before && !/[\n ]$/.test(before) ? "\n" : "";
    const suffix = after && !/^[\n ]/.test(after) ? "\n" : "";
    input.value = `${before}${prefix}${text}${suffix}${after}`;
    const caret = (before + prefix + text + suffix).length;
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus({ preventScroll: true });
  }

  async function uploadComposerFiles(files) {
    const selected = [...(files || [])];
    const images = selected.filter(imageFile);
    if (!selected.length) return;
    if (composerBridgeState.uploading) {
      setComposeStatus("已有图片正在上传，请等待完成后重试", "error", false);
      return;
    }
    if (!images.length) {
      setComposeStatus("请选择图片文件", "error", false);
      return;
    }
    composerBridgeState.uploading = true;
    updateComposeSendState();
    try {
      const markdown = [];
      for (const file of images) {
        setComposeStatus(`正在上传 ${file.name || "图片"}…`, "busy", true);
        const payload = await uploadImageFile(file);
        markdown.push(uploadedImageMarkdown(payload, file));
      }
      insertComposerText(markdown.join("\n"));
      setComposeStatus(`已添加 ${markdown.length} 张图片`, "success", false);
    } catch (error) {
      reportComposerError(error, "上传");
    } finally {
      composerBridgeState.uploading = false;
      updateComposeSendState();
    }
  }

  function handleComposerFileChange(event) {
    event.preventDefault();
    event.stopPropagation();
    uploadComposerFiles(event.target.files);
    event.target.value = "";
  }

  function transferImages(event) {
    const transfer = event.clipboardData || event.dataTransfer;
    const files = [...(transfer?.files || [])];
    // Chromium 会同时在 files 和 items 中暴露同一张剪贴板图片，且两者不是同一个 File 实例。
    if (files.length) return files.filter(imageFile);
    const itemFiles = [...(event.clipboardData?.items || [])]
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile?.())
      .filter(Boolean);
    return itemFiles.filter(imageFile);
  }

  function handleComposerPaste(event) {
    const files = transferImages(event);
    if (!files.length) return;
    event.preventDefault();
    event.stopPropagation();
    uploadComposerFiles(files);
  }

  function handleComposerDrop(event) {
    const files = transferImages(event);
    if (!files.length) return;
    event.preventDefault();
    event.stopPropagation();
    uploadComposerFiles(files);
  }

  function stopComposerPointer(event) {
    event.stopPropagation();
  }

  function handleComposerToolClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget;
    const action = button?.dataset.composerAction;
    const panel = button?.closest(".wecom-chat-panel");
    const input = panel?.querySelector(".wecom-chat-compose");
    if (action === "pic" || action === "folder") panel?.querySelector(".wecom-image-input")?.click();
    else if (input) input.focus({ preventScroll: true });
  }

  async function toggleLike(postId, btn) {
    if (!postId) return;
    const wasLiked = likedPosts.has(postId);
    // 乐观更新，失败回滚
    if (wasLiked) likedPosts.delete(postId); else likedPosts.add(postId);
    btn.classList.toggle("liked", !wasLiked);
    try {
      const resp = await fetch(
        wasLiked ? `/post_actions/${postId}?post_action_type_id=2` : "/post_actions",
        wasLiked
          ? {
              method: "DELETE",
              credentials: "same-origin",
              headers: { "X-CSRF-Token": csrfToken(), "X-Requested-With": "XMLHttpRequest" }
            }
          : {
              method: "POST",
              credentials: "same-origin",
              headers: {
                "X-CSRF-Token": csrfToken(),
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/x-www-form-urlencoded"
              },
              body: `id=${postId}&post_action_type_id=2`
            }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    } catch {
      if (wasLiked) likedPosts.add(postId); else likedPosts.delete(postId);
      btn.classList.toggle("liked", wasLiked);
    }
  }

  function discourseRequire(moduleId) {
    try {
      if (typeof window.require === "function") return window.require(moduleId);
    } catch { /* module missing */ }
    return null;
  }

  function safeLookup(owner, key) {
    if (!owner || typeof owner.lookup !== "function") return null;
    try {
      return owner.lookup(key);
    } catch {
      return null;
    }
  }

  function getEmberOwner() {
    try {
      if (window.Discourse?.__container__) return window.Discourse.__container__;

      // Ember.Namespace 反查 Discourse 应用
      const Ember = window.Ember;
      const namespaces = Ember?.Namespace?.NAMESPACES;
      if (Array.isArray(namespaces)) {
        const app = namespaces.find((n) =>
          n && (n.name === "Discourse" || n.modulePrefix === "discourse" || n.NAMESPACE === "Discourse")
        );
        if (app?.__container__) return app.__container__;
        if (typeof app?.lookup === "function") return app;
      }

      const mod =
        discourseRequire("discourse-common/lib/get-owner") ||
        discourseRequire("discourse/lib/get-owner");
      if (mod) {
        const owner =
          (typeof mod.getOwnerWithFallback === "function" && mod.getOwnerWithFallback(window.Discourse)) ||
          (typeof mod.getOwner === "function" && mod.getOwner(window.Discourse)) ||
          null;
        if (owner) return owner;
      }

      try {
        const appMod = discourseRequire("discourse/app");
        const app = appMod?.default || appMod;
        if (app?.__container__) return app.__container__;
        if (typeof app?.lookup === "function") return app;
      } catch { /* ignore */ }
    } catch (err) {
      console.warn("[linuxdo-wecom] getEmberOwner failed", err);
    }
    return null;
  }

  function getComposerService(owner) {
    return safeLookup(owner, "service:composer") || safeLookup(owner, "controller:composer");
  }

  function getTopicModel(owner) {
    const topicController = safeLookup(owner, "controller:topic");
    if (!topicController) return null;
    try {
      return topicController.get?.("model") || topicController.model || null;
    } catch {
      return null;
    }
  }

  function findLoadedPost(topic, postNumber) {
    if (!topic || !postNumber) return null;
    try {
      const stream = topic.get?.("postStream") || topic.postStream;
      const posts = stream?.get?.("posts") || stream?.posts || [];
      return [...posts].find((p) =>
        Number(p?.get?.("post_number") ?? p?.post_number) === Number(postNumber)
      ) || null;
    } catch { /* ignore */ }
    return null;
  }

  function getOpenComposerModel() {
    const owner = getEmberOwner();
    const composer = owner ? getComposerService(owner) : null;
    if (!composer) return null;
    return composer.model || composer.get?.("model") || null;
  }

  function retargetOpenNativeComposer(postNumber) {
    const model = getOpenComposerModel();
    if (!model) return false;
    const requestedPost = Number(postNumber) || null;
    const topic = getTopicModel(getEmberOwner());
    const post = requestedPost ? findLoadedPost(topic, requestedPost) : null;
    if (requestedPost && !post) {
      throw new Error(`目标楼层 #${requestedPost} 尚未载入原生帖子流`);
    }
    if (typeof model.set === "function") model.set("post", post);
    else model.post = post;
    if (!requestedPost && typeof model.setReplyTo === "function") {
      model.setReplyTo(null, null);
    }
    return true;
  }

  function isComposerOpen() {
    const el = document.querySelector("#reply-control");
    return !!(el && (el.classList.contains("open") || el.classList.contains("fullscreen") || el.classList.contains("edit-title")));
  }

  function composeUi() {
    return {
      input: document.querySelector("textarea.wecom-chat-compose"),
      send: document.querySelector(".wecom-send-btn"),
      status: document.querySelector(".wecom-compose-status"),
      target: document.querySelector(".wecom-reply-target")
    };
  }

  function updateComposeSendState() {
    const { input, send } = composeUi();
    if (!input || !send) return;
    send.disabled = composerBridgeState.submitting || composerBridgeState.uploading || !input.value.trim();
  }

  function setComposeStatus(message, kind, persistent) {
    const { status } = composeUi();
    if (!status) return;
    clearTimeout(setComposeStatus._timer);
    status.textContent = message || "";
    status.className = `wecom-compose-status${kind ? ` ${kind}` : ""}`;
    if (!message || persistent) return;
    setComposeStatus._timer = setTimeout(() => {
      status.textContent = "";
      status.className = "wecom-compose-status";
    }, COMPOSER_STATUS_DURATION_MS);
  }

  function flashComposeHint(message, kind) {
    setComposeStatus(message, kind, false);
  }

  function reportComposerError(error, action = "回复") {
    const message = error instanceof Error ? error.message : String(error || "未知错误");
    console.error("[linuxdo-wecom] composer bridge failed", error);
    setComposeStatus(`${action}失败：${message}`, "error", true);
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function nativeComposerTextarea() {
    if (!isComposerOpen()) return null;
    return document.querySelector(NATIVE_COMPOSER_TEXTAREA);
  }

  function nativeComposerMatchesTopic(topicId) {
    const model = getOpenComposerModel();
    if (!model) return true;
    const modelTopicId = model.get?.("topic.id") ?? model.get?.("topic_id") ??
      model.topic?.id ?? model.topic_id;
    const normalized = Number(modelTopicId?.id ?? modelTopicId);
    return !Number.isFinite(normalized) || normalized === Number(topicId);
  }

  function waitForNativeComposer(topicId) {
    const readyTextarea = () => {
      const textarea = nativeComposerTextarea();
      return textarea && nativeComposerMatchesTopic(topicId) ? textarea : null;
    };
    const existing = readyTextarea();
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        const textarea = readyTextarea();
        if (!textarea) return;
        clearTimeout(timer);
        clearInterval(interval);
        resolve(textarea);
      }, COMPOSER_POLL_INTERVAL_MS);
      const timer = setTimeout(() => {
        clearInterval(interval);
        reject(new Error("原生回复引擎未在规定时间内就绪"));
      }, COMPOSER_READY_TIMEOUT_MS);
    });
  }

  function setNativeComposerValue(value, options = {}) {
    const textarea = nativeComposerTextarea();
    if (!textarea) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (!setter) throw new Error("无法连接原生回复输入框");
    const changed = textarea.value !== value;
    if (changed) setter.call(textarea, value);
    if (options.notify !== true) return changed;
    const model = getOpenComposerModel();
    if (typeof model?.set === "function") model.set("reply", value);
    else if (model && "reply" in model) model.reply = value;
    if (options.emitInput !== false) {
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return changed;
  }

  function storeComposerDraft(value) {
    const topicId = composerBridgeState.topicId;
    if (!topicId) return;
    composerBridgeState.drafts.set(topicId, value);
  }

  function syncFromNativeComposer(textarea) {
    const { input } = composeUi();
    if (!input) return;
    if (input.value) {
      setNativeComposerValue(input.value);
    } else if (textarea.value) {
      input.value = textarea.value;
      storeComposerDraft(input.value);
    }
    updateComposeSendState();
  }

  function bindNativeComposerInput(textarea) {
    if (textarea.dataset.wecomBridgeBound === "1") return;
    textarea.dataset.wecomBridgeBound = "1";
    textarea.addEventListener("input", () => {
      const { input } = composeUi();
      if (!input || input.value === textarea.value) return;
      input.value = textarea.value;
      storeComposerDraft(input.value);
      updateComposeSendState();
    });
  }

  function clearNativeComposerDraft() {
    if (!nativeComposerTextarea()) return;
    setNativeComposerValue("", { notify: true, emitInput: false });
  }

  function connectNativeComposer(postNumber) {
    const requestedPost = Number(postNumber) || null;
    const ready = nativeComposerTextarea();
    if (ready && composerBridgeState.nativeTopicId === chatState.topicId &&
      composerBridgeState.nativeReplyToPostNumber === requestedPost) {
      return Promise.resolve(ready);
    }
    if (composerBridgeState.connecting) {
      if (composerBridgeState.connectingTarget === requestedPost) return composerBridgeState.connecting;
      return composerBridgeState.connecting.catch(() => null).then(() => connectNativeComposer(postNumber));
    }
    const wrongTopic = composerBridgeState.nativeTopicId !== chatState.topicId;
    const wrongReplyTarget = requestedPost !== composerBridgeState.nativeReplyToPostNumber;
    const composeInput = composeUi().input;
    const restoreFocus = composeInput && document.activeElement === composeInput;
    if (!isComposerOpen() || wrongTopic || wrongReplyTarget) {
      if (!openNativeComposer(requestedPost)) {
        return Promise.reject(new Error("无法启动原生回复引擎"));
      }
    }
    const topicId = chatState.topicId;
    const connectionSerial = ++composerBridgeState.connectionSerial;
    composerBridgeState.connectingTarget = requestedPost;
    const connection = waitForNativeComposer(topicId).then((textarea) => {
      if (chatState.topicId !== topicId) throw new Error("回复目标已切换，请重新输入");
      composerBridgeState.nativeTopicId = topicId;
      composerBridgeState.nativeReplyToPostNumber = requestedPost;
      bindNativeComposerInput(textarea);
      syncFromNativeComposer(textarea);
      if (restoreFocus && composeInput?.isConnected) {
        textarea.blur();
        composeInput.focus({ preventScroll: true });
      }
      return textarea;
    });
    composerBridgeState.connecting = connection.finally(() => {
      if (composerBridgeState.connectionSerial === connectionSerial) {
        composerBridgeState.connecting = null;
        composerBridgeState.connectingTarget = null;
      }
    });
    return composerBridgeState.connecting;
  }

  function handleComposerInput(input) {
    storeComposerDraft(input.value);
    if (composeUi().status?.classList.contains("error")) setComposeStatus("", "", false);
    updateComposeSendState();
    const correctTopic = nativeComposerMatchesTopic(chatState.topicId);
    const correctTarget = composerBridgeState.nativeReplyToPostNumber === composerBridgeState.replyToPostNumber;
    if (nativeComposerTextarea() && correctTopic && correctTarget) {
      // 只写入 DOM，不派发原生 input 事件；否则 Discourse 会在输入 #/@ 时弹出补全层。
      setNativeComposerValue(input.value);
    }
  }

  function handleComposerKeydown(event) {
    if (event.__wecomComposerGuarded) return;
    event.stopPropagation();
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    submitComposerFromUi(event);
  }

  function guardComposerShortcut(event) {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest("textarea.wecom-chat-compose")) return;
    event.__wecomComposerGuarded = true;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") event.preventDefault();
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      submitComposerFromUi(event);
    }
    event.stopImmediatePropagation();
  }

  function submitComposerFromUi(event) {
    event?.preventDefault?.();
    submitComposer().catch(reportComposerError);
  }

  function replyTargetLabel(postNumber) {
    const message = document.querySelector(`.wecom-msg[data-post-number="${postNumber}"]`);
    const name = message?.querySelector(".wecom-msg-name")?.textContent?.trim();
    return name ? `回复 ${name} · #${postNumber}` : `回复消息 #${postNumber}`;
  }

  function showTargetedReply(postNumber) {
    const { target } = composeUi();
    composerBridgeState.replyToPostNumber = Number(postNumber) || null;
    if (!target || !composerBridgeState.replyToPostNumber) return;
    target.querySelector("span").textContent = replyTargetLabel(postNumber);
    target.hidden = false;
  }

  function hideTargetedReply() {
    const { target } = composeUi();
    composerBridgeState.replyToPostNumber = null;
    if (target) target.hidden = true;
  }

  function cancelTargetedReply(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    hideTargetedReply();
    composeUi().input?.focus();
  }

  function switchComposerTopic(topicId) {
    const { input } = composeUi();
    const previousTopicId = composerBridgeState.topicId;
    if (input && previousTopicId) {
      composerBridgeState.drafts.set(previousTopicId, input.value);
    }
    composerBridgeState.topicId = topicId || null;
    composerBridgeState.connectionSerial += 1;
    composerBridgeState.connecting = null;
    composerBridgeState.connectingTarget = null;
    if (previousTopicId !== composerBridgeState.topicId) {
      composerBridgeState.nativeTopicId = null;
      composerBridgeState.nativeReplyToPostNumber = null;
    }
    hideTargetedReply();
    if (input) input.value = composerBridgeState.drafts.get(topicId) || "";
    setComposeStatus("", "", false);
    updateComposeSendState();
  }

  function setComposerPlaceholder(title) {
    const { input } = composeUi();
    if (!input) return;
    input.placeholder = title ? `发送给 ${title}` : "发送消息";
  }

  function clickNativeReplyButton(postNumber) {
    if (postNumber) {
      const article = document.querySelector(
        `.post-stream article[data-post-number="${postNumber}"], #post_${postNumber}, article[id="post_${postNumber}"]`
      );
      const postReply = article?.querySelector(
        "button.reply, .post-controls button.reply, button.create.reply, .reply.create"
      );
      if (!postReply) return false;
      postReply.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      return true;
    }
    const topicSelectors = [
      "#topic-footer-buttons button.create",
      "#topic-footer-buttons button.btn-primary.create",
      ".topic-footer-main-buttons button.create",
      ".topic-footer-main-buttons button.btn-primary",
      "button.btn-primary.create.reply",
      "button.create.reply"
    ];
    for (const selector of topicSelectors) {
      const button = document.querySelector(selector);
      if (!button || button.id === "create-topic" || button.closest(".d-header")) continue;
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      return true;
    }
    return false;
  }

  function openComposerViaService(postNumber) {
    const owner = getEmberOwner();
    if (!owner) return false;
    const composer = getComposerService(owner);
    if (!composer) return false;
    const topic = getTopicModel(owner);
    const Composer = discourseRequire("discourse/models/composer");
    const REPLY = Composer?.REPLY || Composer?.default?.REPLY || "reply";

    try {
      if (postNumber) {
        const post = findLoadedPost(topic, postNumber);
        if (!post) return false;
        if (post && typeof composer.replyTo === "function") {
          composer.replyTo(post);
          return true;
        }
        if (post && typeof composer.open === "function") {
          composer.open({
            action: REPLY,
            post,
            draftKey: topic?.get?.("draft_key") || topic?.draft_key || `topic_${chatState.topicId}`,
            draftSequence: topic?.get?.("draft_sequence") ?? topic?.draft_sequence
          });
          return true;
        }
        return false;
      }

      if (topic && typeof composer.replyToTopic === "function") {
        composer.replyToTopic(REPLY, topic);
        return true;
      }
      if (topic && typeof composer.open === "function") {
        composer.open({
          action: REPLY,
          topic,
          draftKey: topic.get?.("draft_key") || topic.draft_key || `topic_${chatState.topicId}`,
          draftSequence: topic.get?.("draft_sequence") ?? topic.draft_sequence,
          title: topic.get?.("title") || topic.title,
          categoryId: topic.get?.("category_id") || topic.category_id
        });
        return true;
      }
    } catch (err) {
      console.warn("[linuxdo-wecom] composer service open failed", err);
    }
    return false;
  }

  function attemptComposerOpen(label, action) {
    try {
      return Boolean(action());
    } catch (error) {
      console.error(`[linuxdo-wecom] ${label} failed`, error);
      return false;
    }
  }

  function tryComposerStrategies(postNumber) {
    const strategies = [
      ["composer service", () => openComposerViaService(postNumber)],
      ["native reply button", () => clickNativeReplyButton(postNumber)]
    ];
    for (const [label, action] of strategies) {
      if (attemptComposerOpen(label, action)) return true;
    }
    return false;
  }

  function closeNativeComposerForTopicSwitch() {
    const owner = getEmberOwner();
    const composer = owner ? getComposerService(owner) : null;
    if (!composer) return false;
    if (typeof composer.saveAndCloseComposer === "function") {
      composer.saveAndCloseComposer();
      return true;
    }
    if (typeof composer.close === "function") {
      composer.close();
      return true;
    }
    return false;
  }

  function retargetActiveComposer(postNumber) {
    const requestedPost = Number(postNumber) || null;
    const wrongTopic = composerBridgeState.nativeTopicId !== chatState.topicId;
    const wrongReplyTarget = requestedPost !== composerBridgeState.nativeReplyToPostNumber;
    if (wrongTopic) {
      if (!closeNativeComposerForTopicSwitch() || !openComposerViaService(requestedPost)) {
        throw new Error("无法切换原生回复话题");
      }
      return;
    }
    if (wrongReplyTarget && !retargetOpenNativeComposer(requestedPost)) {
      throw new Error("无法更新原生回复目标");
    }
  }

  /** 启动后台 Discourse composer；它在 IM 模式中始终保持离屏。 */
  function openNativeComposer(postNumber) {
    try {
      if (isComposerOpen()) {
        retargetActiveComposer(postNumber);
        return true;
      }
      const opened = tryComposerStrategies(postNumber);
      if (opened) return true;
      console.warn("[linuxdo-wecom] openNativeComposer failed", { topicId: chatState.topicId, postNumber });
      return false;
    } catch (err) {
      console.error("[linuxdo-wecom] openNativeComposer crashed", err);
      return false;
    }
  }

  function nativeComposerErrorText() {
    const root = document.querySelector("#reply-control.open, #reply-control.fullscreen, #reply-control.edit-title");
    const error = root?.querySelector(NATIVE_COMPOSER_ERROR);
    return error?.textContent?.replace(/\s+/g, " ").trim() || "";
  }

  function nativeSubmitButton() {
    const root = document.querySelector("#reply-control.open, #reply-control.fullscreen, #reply-control.edit-title");
    if (!root) return null;
    const buttons = [...root.querySelectorAll(`${NATIVE_COMPOSER_SUBMIT}, button[type='submit']`)];
    return buttons.find((button) => !button.hidden && button.getAttribute("aria-hidden") !== "true") || buttons[0] || null;
  }

  function dismissNativeComposerPopups() {
    const selectors = [
      ".autocomplete", ".autocomplete-container", ".d-editor-popup", ".emoji-picker", ".tag-chooser"
    ];
    document.querySelectorAll(selectors.join(", ")).forEach((node) => {
      node.hidden = true;
      node.setAttribute("aria-hidden", "true");
    });
  }

  function waitForComposerSubmitOutcome(initialValue) {
    if (!isComposerOpen()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const finish = (error) => {
        clearTimeout(timer);
        observer.disconnect();
        if (error) reject(error); else resolve();
      };
      const inspect = () => {
        if (!isComposerOpen()) {
          finish();
          return;
        }
        const errorText = nativeComposerErrorText();
        if (errorText) {
          finish(new Error(errorText));
          return;
        }
        const textarea = nativeComposerTextarea();
        if (initialValue && textarea && !textarea.value.trim()) finish();
      };
      const observer = new MutationObserver(inspect);
      const timer = setTimeout(() => {
        finish(new Error("发送状态未确认，请切换原生视图查看具体错误"));
      }, COMPOSER_SUBMIT_TIMEOUT_MS);
      observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
      inspect();
    });
  }

  function completeComposerSubmission(input, submittedPost) {
    const topicId = chatState.topicId;
    input.value = "";
    storeComposerDraft("");
    hideTargetedReply();
    clearNativeComposerDraft();
    composerBridgeState.nativeTopicId = null;
    composerBridgeState.nativeReplyToPostNumber = null;
    setComposeStatus("已发送", "success", false);
    if (topicId) {
      const post = submittedPost?.post || submittedPost;
      if (post && (post.id || post.post_number)) {
        appendFreshPosts([post], document.querySelector(".wecom-chat-body"));
      }
      syncNewPostsFromDom();
      scheduleSubmittedPostSync(topicId);
      refreshTopicAfterSubmission(topicId).catch((error) => {
        console.error("[linuxdo-wecom] submitted post refresh failed", error);
        setComposeStatus("已发送，但当前页同步失败，请点击刷新", "error", true);
      });
    }
  }

  async function submitNativeReply(raw) {
    const requestedPost = composerBridgeState.replyToPostNumber;
    let clicked = false;
    try {
      await connectNativeComposer(requestedPost);
      setNativeComposerValue(raw, { notify: true, emitInput: false });
      await delay(COMPOSER_INPUT_SETTLE_MS);
      let button = nativeSubmitButton();
      if (!button) throw new Error("找不到原生发送按钮");
      if (button.disabled || button.getAttribute("aria-disabled") === "true") {
        setNativeComposerValue(raw, { notify: true, emitInput: true });
        dismissNativeComposerPopups();
        await delay(COMPOSER_INPUT_SETTLE_MS);
        button = nativeSubmitButton();
      }
      if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") {
        throw new Error(nativeComposerErrorText() || "内容未达到站点发送要求");
      }
      dismissNativeComposerPopups();
      clicked = true;
      button.click();
      await waitForComposerSubmitOutcome(raw);
    } catch (error) {
      if (error && typeof error === "object") error.submissionStarted = clicked;
      throw error;
    }
  }

  function isSubmissionTimeout(error) {
    return /发送状态未确认|未在规定时间内就绪/.test(String(error?.message || error || ""));
  }

  async function recoverTimedOutSubmission(raw, replyTo) {
    const beforeStreamLength = chatState.stream.length;
    const refreshed = await refreshTopicOnce(chatState.topicId).catch(() => 0);
    if (refreshed > 0 || chatState.stream.length > beforeStreamLength) return null;
    return submitReplyViaApi(raw, replyTo);
  }

  async function submitComposer() {
    const { input } = composeUi();
    if (!input || !input.value.trim() || composerBridgeState.submitting || composerBridgeState.uploading) return;
    if (!chatState.topicId) throw new Error("请先打开一个话题");
    composerBridgeState.submitting = true;
    updateComposeSendState();
    setComposeStatus("正在发送…", "busy", true);
    const raw = input.value;
    const replyTo = composerBridgeState.replyToPostNumber;
    try {
      let apiError = null;
      try {
        const post = await submitReplyViaApi(raw, replyTo);
        completeComposerSubmission(input, post);
        return;
      } catch (error) {
        apiError = error;
      }
      try {
        await submitNativeReply(raw);
        completeComposerSubmission(input);
      } catch (error) {
        if (error?.submissionStarted && isSubmissionTimeout(error)) {
          try {
            const post = await recoverTimedOutSubmission(raw, replyTo);
            completeComposerSubmission(input, post);
            return;
          } catch (fallbackError) {
            throw new Error(`${error.message || "原生回复失败"}；备用路径：${fallbackError.message}`);
          }
        }
        if (error?.submissionStarted) throw error;
        try {
          const post = await submitReplyViaApi(raw, replyTo);
          completeComposerSubmission(input, post);
        } catch (fallbackError) {
          const details = [apiError, fallbackError]
            .filter(Boolean)
            .map((item) => item.message)
            .join("；");
          throw new Error(`${error.message || "原生回复失败"}${details ? `；备用路径：${details}` : ""}`);
        }
      }
    } finally {
      composerBridgeState.submitting = false;
      updateComposeSendState();
    }
  }

  function replyToPost(postNumber) {
    showTargetedReply(postNumber);
    composeUi().input?.focus();
  }

  const TIME_SEP_GAP = 10 * 60 * 1000;

  function renderBubbles(posts, myName) {
    const frag = [];
    let lastTime = 0;
    for (const post of posts) {
      if (post.id && (post.actions_summary || []).some((a) => a.id === 2 && a.acted)) {
        likedPosts.add(post.id);
      }
      const t = new Date(post.created_at).getTime();
      if (t - lastTime > TIME_SEP_GAP) {
        frag.push(`<div class="wecom-msg-time-sep">${escapeHtml(formatClock(post.created_at))}</div>`);
      }
      lastTime = t;
      frag.push(bubbleHtml(post, myName));
    }
    return frag.join("");
  }

  async function fetchPostsByIds(topicId, ids) {
    if (!ids.length) return [];
    const query = ids.map((id) => `post_ids[]=${encodeURIComponent(id)}`).join("&");
    const data = await api(`/t/${topicId}/posts.json?${query}`);
    return data?.post_stream?.posts || data?.posts || [];
  }

  async function postsForTopicOpening(topicId, stream, posts, aroundPostNumber) {
    const ordered = orderedTopicPosts(posts, stream);
    const target = Number(aroundPostNumber) || 0;
    if (target > 1) return ordered;
    if (!stream.length || ordered.some((post) => postNumberOf(post) === 1)) return ordered;
    const loaded = new Set(ordered.map(postIdOf));
    const missing = stream.slice(0, POST_SYNC_BATCH_SIZE)
      .filter((id) => !loaded.has(String(id)));
    if (!missing.length) return ordered;
    try {
      const fetched = await fetchPostsByIds(topicId, missing);
      return orderedTopicPosts(ordered.concat(fetched), stream);
    } catch (error) {
      console.error("[linuxdo-wecom] failed to load the topic opening posts", error);
      return ordered;
    }
  }

  function openingPostNumber(topicId, topicData) {
    const fromPath = postNumberFromPath(location.pathname);
    if (fromPath > 0) return fromPath;
    const remembered = getRememberedPost(topicId);
    if (remembered > 0) return remembered;
    const fromList = listState.topics.find((topic) => Number(topic.id) === Number(topicId));
    const fromTopic = Number(fromList?.last_read_post_number || topicData?.last_read_post_number) || 0;
    return fromTopic > 0 ? fromTopic : 0;
  }

  async function fetchTopicJson(topicId, postNumber, force) {
    const opts = force ? { cache: "no-store" } : {};
    const n = Number(postNumber) || 0;
    if (n > 1) {
      try {
        return await api(`/t/${topicId}/${n}.json`, opts);
      } catch (error) {
        console.warn("[linuxdo-wecom] failed to load topic at post", n, error);
      }
    }
    return await api(`/t/${topicId}.json`, opts);
  }

  function rememberTopicPost(topicId, postNumber) {
    const id = Number(topicId);
    const n = Number(postNumber) || 0;
    if (!id || n < 1) return;
    const map = readLastReadMap();
    if (Number(map[id]) === n) {
      syncTopicLastReadHref(id, n);
      return;
    }
    map[id] = n;
    const keys = Object.keys(map);
    if (keys.length > LAST_READ_MAX_TOPICS) {
      for (const key of keys.slice(0, keys.length - LAST_READ_MAX_TOPICS)) delete map[key];
    }
    try {
      localStorage.setItem(LAST_READ_KEY, JSON.stringify(map));
    } catch { /* ignore quota */ }
    const topic = listState.topics.find((item) => Number(item.id) === id);
    if (topic) topic.last_read_post_number = n;
    syncTopicLastReadHref(id, n);
  }

  function syncTopicLastReadHref(topicId, postNumber) {
    const row = document.querySelector(`.wecom-conv[data-topic-id="${topicId}"]`);
    if (!row) return;
    const current = row.getAttribute("href") || "";
    const slug = topicRouteFromPath(current).slug || chatState.slug || "topic";
    const next = postNumber > 1 ? `/t/${slug}/${topicId}/${postNumber}` : `/t/${slug}/${topicId}`;
    if (current !== next) row.setAttribute("href", next);
  }

  function replaceTopicPostUrl(topicId, postNumber) {
    const current = topicRouteFromPath(location.pathname);
    if (Number(current.topicId) !== Number(topicId)) return;
    const n = Number(postNumber) || 0;
    if ((current.postNumber || 0) === n || (n <= 1 && current.postNumber <= 1)) return;
    const slug = current.slug || chatState.slug || "topic";
    const path = n > 1 ? `/t/${slug}/${topicId}/${n}` : `/t/${slug}/${topicId}`;
    const next = path + location.search + location.hash;
    if (`${location.pathname}${location.search}${location.hash}` === next) return;
    suppressHistoryApply = true;
    try {
      history.replaceState(history.state, "", next);
    } finally {
      suppressHistoryApply = false;
    }
  }

  function visibleTopicPosts(body) {
    if (!body) return [];
    const rect = body.getBoundingClientRect();
    const posts = [];
    for (const msg of body.querySelectorAll(".wecom-msg[data-post-number]")) {
      const box = msg.getBoundingClientRect();
      if (box.bottom <= rect.top + 8 || box.top >= rect.bottom - 8) continue;
      const number = Number(msg.dataset.postNumber) || 0;
      if (number) posts.push(number);
    }
    return posts;
  }

  function scrollChatToPost(body, postNumber) {
    if (!body || !postNumber) return false;
    const el = body.querySelector(`.wecom-msg[data-post-number="${postNumber}"]`);
    if (!el) return false;
    const delta = el.getBoundingClientRect().top - body.getBoundingClientRect().top;
    chatState.pinningScroll = true;
    body.scrollTop = Math.max(0, body.scrollTop + delta);
    requestAnimationFrame(() => {
      chatState.pinningScroll = false;
    });
    return true;
  }

  function keepChatAtPost(body, postNumber) {
    if (!body || !postNumber) return;
    chatState.pinnedPost = postNumber;
    const pin = () => {
      if (Number(chatState.pinnedPost) !== Number(postNumber)) return;
      scrollChatToPost(body, postNumber);
    };
    pin();
    const pending = [...body.querySelectorAll("img")].filter((image) => !image.complete);
    pending.forEach((image) => {
      image.addEventListener("load", pin, { once: true });
      image.addEventListener("error", pin, { once: true });
    });
    [50, 160, 400, 800].forEach((delay) => setTimeout(pin, delay));
    setTimeout(() => {
      pin();
      if (Number(chatState.pinnedPost) === Number(postNumber)) chatState.pinnedPost = 0;
    }, 1000);
  }

  function markPostsOnscreen(postNumbers) {
    const owner = getEmberOwner();
    const screenTrack = owner ? safeLookup(owner, "service:screen-track") : null;
    if (!screenTrack || typeof screenTrack.setOnscreen !== "function") return false;
    try {
      screenTrack.setOnscreen(postNumbers, postNumbers);
      return true;
    } catch {
      return false;
    }
  }

  function reportReadTimings(topicId, postNumbers) {
    if (!topicId || !postNumbers.length) return;
    if (markPostsOnscreen(postNumbers)) return;
    const body = new URLSearchParams();
    body.set("topic_id", String(topicId));
    body.set("topic_time", "400");
    for (const number of postNumbers) body.set(`timings[${number}]`, "400");
    fetch("/topics/timings", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "X-CSRF-Token": csrfToken(),
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
      },
      body: body.toString()
    }).catch(() => {});
  }

  const trackVisibleTopicPost = debounce(() => {
    if (!chatState.topicId || chatState.pinnedPost || chatState.pinningScroll) return;
    const body = document.querySelector(".wecom-chat-body");
    const visible = visibleTopicPosts(body);
    const postNumber = visible[0];
    if (!postNumber) return;
    rememberTopicPost(chatState.topicId, postNumber);
    replaceTopicPostUrl(chatState.topicId, postNumber);
    reportReadTimings(chatState.topicId, visible);
  }, 220);

  async function loadTopic(topicId, force = false) {
    if (!topicId || chatState.loading) return;
    if (!force && chatState.topicId === topicId) {
      syncListActive();
      return;
    }
    const sameTopic = chatState.topicId === topicId;
    const requestedPost = openingPostNumber(topicId, null);
    chatState.loading = true;
    chatState.topicId = topicId;
    ensureChatPanel();
    if (!sameTopic) switchComposerTopic(topicId);
    const body = document.querySelector(".wecom-chat-body");
    if (body && !sameTopic) {
      delete body.dataset.state;
      body.innerHTML = `<div class="wecom-chat-loading">加载中…</div>`;
    }
    try {
      let data = await fetchTopicJson(topicId, requestedPost, force);
      if (chatState.topicId !== topicId) return; // 路由已切走
      let openPost = openingPostNumber(topicId, data);
      if (!requestedPost && openPost > 1 && !((data.post_stream && data.post_stream.posts) || [])
        .some((post) => postNumberOf(post) === openPost)) {
        try {
          data = await fetchTopicJson(topicId, openPost, force);
        } catch { /* 保留首页 */ }
        if (chatState.topicId !== topicId) return;
      }
      const stream = (data.post_stream && data.post_stream.stream) || [];
      const posts = await postsForTopicOpening(
        topicId,
        stream,
        (data.post_stream && data.post_stream.posts) || [],
        openPost
      );
      if (chatState.topicId !== topicId) return;
      renderPinnedBanner(posts);
      renderMemberPanel(data, posts);
      chatState.stream = stream.length ? stream.slice() : posts.map((post) => post.id);
      chatState.slug = data.slug || chatState.slug || topicRouteFromPath(location.pathname).slug || "";
      const loadedIndexes = posts.map((post) => streamIndexOf(post.id)).filter((index) => index >= 0);
      chatState.renderedFirstIdx = loadedIndexes.length ? Math.min(...loadedIndexes) : 0;
      chatState.renderedLastIdx = loadedIndexes.length ? Math.max(...loadedIndexes) : -1;
      chatState.renderedLastNumber = posts.reduce(
        (max, post) => Math.max(max, Number(post.post_number) || 0),
        0
      );
      chatState.hasOlder = chatState.renderedFirstIdx > 0;
      chatState.hasNewer = chatState.renderedLastIdx >= 0 &&
        chatState.renderedLastIdx < chatState.stream.length - 1;
      chatState.title = data.title || "";

      const panel = document.querySelector(".wecom-chat-panel");
      if (panel) panel.dataset.empty = "0";
      const title = document.querySelector(".wecom-chat-title");
      const sub = document.querySelector(".wecom-chat-sub");
      if (title) title.textContent = chatState.title;
      const participants = data.participant_count ||
        (data.details && data.details.participants ? data.details.participants.length : 0);
      const count = document.querySelector(".wecom-chat-count");
      if (count) {
        if (participants) {
          count.style.display = "";
          count.innerHTML = `${ICONS.users}${participants}`;
        } else {
          count.style.display = "none";
          count.textContent = "";
        }
      }
      const replyTotal = data.posts_count || posts.length;
      chatState.replyTotal = replyTotal;
      if (sub) sub.textContent = `归属于 linux.do · ${replyTotal} 条回复`;
      document.title = `${chatState.title} - Linux DO`;

      setComposerPlaceholder(chatState.title);

      const chatAvatar = document.querySelector(".wecom-chat-avatar");
      if (chatAvatar) {
        chatAvatar.style.display = "";
        const op = posts.find((p) => p.post_number === 1) || posts[0] || null;
        const authorName = userDisplayName(op, (op && op.username) || chatState.title || "?");
        if (!isMaskAvatar() && op && op.avatar_template) {
          chatAvatar.style.background = "transparent";
          chatAvatar.innerHTML = `<img src="${escapeHtml(fullAvatarUrl(op.avatar_template))}" alt="" loading="lazy">`;
        } else {
          chatAvatar.style.background = avatarColor(authorName);
          chatAvatar.textContent = avatarLetter(authorName);
        }
      }
      loadCategories().then(() => {
        if (chatState.topicId !== topicId) return;
        const cat = data.category_id ? categoryById(data.category_id) : null;
        const chipsBox = document.querySelector(".wecom-chat-chips");
        if (chipsBox) {
          chipsBox.innerHTML = cat
            ? `<a class="wecom-chat-chip" href="/c/${escapeHtml(cat.slug)}/${cat.id}"><span class="wecom-nav2-cat-dot" style="background:#${escapeHtml(cat.color || "8F959E")}"></span>${escapeHtml(cat.name)}</a>`
            : "";
        }
        if (cat && sub) sub.textContent = `归属于 ${cat.name} · ${chatState.replyTotal || replyTotal} 条回复`;
      });

      if (body) {
        body.innerHTML = renderBubbles(posts, getCurrentUsername()) ||
          `<div class="wecom-chat-empty">${ICONS.msg}<div>暂无消息</div></div>`;
        hydrateChatImages(body);
        syncRenderedWindow(body);
        if (sameTopic) {
          body.scrollTop = Math.min(body.scrollTop, body.scrollHeight);
        } else if (openPost > 1) {
          rememberTopicPost(topicId, openPost);
          replaceTopicPostUrl(topicId, openPost);
          keepChatAtPost(body, openPost);
        } else {
          body.scrollTop = 0;
          rememberTopicPost(topicId, openPost || 1);
          replaceTopicPostUrl(topicId, openPost || 1);
        }
      }
      syncListActive();
    } catch (err) {
      renderChatError(`话题加载失败（${err && err.message}），可能无权限或已被删除`);
    } finally {
      chatState.loading = false;
    }
  }

  function postNumberOf(post) {
    return Number(post?.post_number) || 0;
  }

  function postIdOf(post) {
    const id = post?.id;
    return id == null ? "" : String(id);
  }

  function sortPostsByStream(posts, ids = []) {
    const order = new Map(ids.map((id, index) => [String(id), index]));
    return posts.slice().sort((a, b) => {
      const ai = order.has(postIdOf(a)) ? order.get(postIdOf(a)) : Number.MAX_SAFE_INTEGER;
      const bi = order.has(postIdOf(b)) ? order.get(postIdOf(b)) : Number.MAX_SAFE_INTEGER;
      return ai - bi || postNumberOf(a) - postNumberOf(b);
    });
  }

  function orderedTopicPosts(posts, stream) {
    return sortPostsByStream(posts, stream);
  }

  function syncRenderedWindow(body) {
    if (!body) return;
    const indexes = new Set();
    let maxNumber = 0;
    for (const message of body.querySelectorAll(".wecom-msg[data-post-number]")) {
      maxNumber = Math.max(maxNumber, Number(message.dataset.postNumber) || 0);
      const index = streamIndexOf(message.dataset.postId);
      if (index >= 0) indexes.add(index);
    }
    if (!indexes.size) {
      chatState.renderedLastNumber = Math.max(chatState.renderedLastNumber, maxNumber);
      return;
    }
    let first = Infinity;
    let last = -1;
    for (const index of indexes) first = Math.min(first, index);
    for (let index = first; indexes.has(index); index += 1) last = index;
    chatState.renderedFirstIdx = first;
    chatState.renderedLastIdx = last;
    chatState.renderedLastNumber = maxNumber;
    chatState.hasOlder = first > 0;
    chatState.hasNewer = last < chatState.stream.length - 1;
  }

  /** 向上滚动加载更早的帖子 */
  async function loadOlderPosts() {
    if (!chatState.hasOlder || chatState.loading || !chatState.topicId) return;
    const ids = chatState.stream.slice(Math.max(0, chatState.renderedFirstIdx - 20), chatState.renderedFirstIdx);
    if (!ids.length) return;
    chatState.loading = true;
    const body = document.querySelector(".wecom-chat-body");
    try {
      const qs = ids.map((id) => `post_ids[]=${id}`).join("&");
      const data = await api(`/t/${chatState.topicId}/posts.json?${qs}`);
      const posts = sortPostsByStream(
        (data.post_stream && data.post_stream.posts) || data.posts || [],
        ids
      );
      if (body && posts.length) {
        const prevHeight = body.scrollHeight;
        body.insertAdjacentHTML("afterbegin", renderBubbles(posts, getCurrentUsername()));
        hydrateChatImages(body);
        body.scrollTop += body.scrollHeight - prevHeight;
        syncRenderedWindow(body);
      }
    } catch { /* 保留现状 */ } finally {
      chatState.loading = false;
    }
  }

  /** 向下滚动加载更新的帖子（话题很长时不能只留首屏一页） */
  async function loadNewerPosts() {
    if (!chatState.hasNewer || chatState.loading || !chatState.topicId) return;
    const start = chatState.renderedLastIdx + 1;
    if (start <= 0 || start >= chatState.stream.length) {
      chatState.hasNewer = false;
      return;
    }
    const ids = chatState.stream.slice(start, start + 20);
    if (!ids.length) {
      chatState.hasNewer = false;
      return;
    }
    chatState.loading = true;
    const body = document.querySelector(".wecom-chat-body");
    try {
      const qs = ids.map((id) => `post_ids[]=${id}`).join("&");
      const data = await api(`/t/${chatState.topicId}/posts.json?${qs}`);
      const posts = sortPostsByStream(
        (data.post_stream && data.post_stream.posts) || data.posts || [],
        ids
      );
      appendFreshPosts(posts, body);
    } catch { /* 保留现状 */ } finally {
      chatState.loading = false;
    }
  }

  function streamIndexOf(id) {
    if (id == null) return -1;
    return chatState.stream.findIndex((candidate) => String(candidate) === String(id));
  }

  function appendFreshPosts(posts, body, options = {}) {
    if (!body || !Array.isArray(posts) || !posts.length) return 0;
    const renderedNumbers = new Set(
      [...body.querySelectorAll(".wecom-msg[data-post-number]")]
        .map((node) => Number(node.dataset.postNumber))
        .filter((number) => number > 0)
    );
    const fresh = posts
      .filter((post) => {
        const number = postNumberOf(post);
        return number > 0 && !renderedNumbers.has(number);
      })
      .sort((a, b) => postNumberOf(a) - postNumberOf(b));
    if (!fresh.length) {
      syncRenderedWindow(body);
      return 0;
    }
    body.querySelector(".wecom-chat-empty")?.remove();
    const currentMax = Math.max(...renderedNumbers, 0);
    if (fresh.every((post) => postNumberOf(post) > currentMax)) {
      body.insertAdjacentHTML("beforeend", renderBubbles(fresh, getCurrentUsername()));
    } else {
      for (const post of fresh) {
        const target = [...body.querySelectorAll(".wecom-msg[data-post-number]")]
          .find((node) => Number(node.dataset.postNumber) > postNumberOf(post));
        const html = bubbleHtml(post, getCurrentUsername());
        if (target) target.insertAdjacentHTML("beforebegin", html);
        else body.insertAdjacentHTML("beforeend", html);
      }
    }
    hydrateChatImages(body);
    syncRenderedWindow(body);
    if (options.scroll !== false) body.scrollTop = body.scrollHeight;
    return fresh.length;
  }

  function nativeTopicPostElements() {
    const selectors = [
      ".post-stream article.topic-post",
      "#main-outlet article.topic-post",
      ".post-stream .topic-post[data-post-number]",
      "#main-outlet .topic-post[data-post-number]",
      ".post-stream article[data-post-number]",
      "#main-outlet article[data-post-number]"
    ];
    const elements = new Set();
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((element) => elements.add(element));
    }
    return [...elements].filter((element) => {
      const parent = element.parentElement?.closest("article.topic-post, .topic-post[data-post-number]");
      return !parent || parent === element;
    });
  }

  function nativePostIdentity(article) {
    const author = article.querySelector(
      ".topic-meta-data a[href*='/u/'], .names a[href*='/u/'], " +
      ".topic-meta-data [data-user-card], .names [data-user-card], " +
      "a[data-user-card], [data-username]"
    );
    const username = usernameFromElement(author);
    const id = userIdFromElement(article) || userIdFromElement(author);
    const fullName = article.querySelector(
      ".topic-meta-data .full-name, .names .full-name"
    )?.textContent?.trim() || author?.textContent?.trim() || username || "?";
    return { username: username || "", id, name: fullName };
  }

  function nativePostIsMine(article, author, identity) {
    if (article.classList.contains("current-user-post")) return true;
    const articleFlag = article.getAttribute("data-current-user-post");
    if (booleanFlag(articleFlag)) return true;
    const authorId = author.id || userIdFromElement(article);
    if (authorId && identity.id && authorId === identity.id) return true;
    return Boolean(author.username && identity.username &&
      normalizeUsername(author.username) === normalizeUsername(identity.username));
  }

  /** 发帖后：原生隐藏流里出现的新帖 → 追加为气泡 */
  function syncNewPostsFromDom() {
    if (!chatState.topicId) return 0;
    const articles = nativeTopicPostElements();
    if (!articles.length) return 0;
    const body = document.querySelector(".wecom-chat-body");
    if (!body || body.querySelector(".wecom-chat-loading")) return 0;
    const current = getCurrentUserIdentity();
    const posts = [];
    for (const article of articles) {
      const number = Number(
        article.dataset.postNumber || (article.id || "").replace("post_", "")
      );
      if (!number || number <= chatState.renderedLastNumber) continue;
      const articleTopicId = Number(article.dataset.topicId || article.getAttribute("data-topic-id")) || 0;
      if (articleTopicId && articleTopicId !== Number(chatState.topicId)) continue;
      const cooked = article.querySelector(".cooked");
      if (!cooked) continue;
      const author = nativePostIdentity(article);
      const avatarImg = article.querySelector(".topic-avatar img, .post-avatar img");
      const timeEl = article.querySelector(".post-info .relative-date, .relative-date");
      const username = author.username || "?";
      const mine = nativePostIsMine(article, author, current);
      const post = {
        id: Number(article.dataset.postId || article.dataset.postIdValue) || undefined,
        post_number: number,
        username,
        name: author.name,
        avatar_template: avatarImg?.currentSrc || avatarImg?.src || "",
        cooked: cooked.innerHTML,
        created_at: (timeEl && (timeEl.getAttribute("title") || timeEl.dataset.time)) || new Date().toISOString(),
        yours: mine
      };
      posts.push(post);
    }
    return appendFreshPosts(posts, body);
  }

  function scheduleSubmittedPostSync(topicId) {
    for (const delayMs of POST_SYNC_RETRY_DELAYS_MS) {
      setTimeout(() => {
        if (chatState.topicId === topicId) syncNewPostsFromDom();
      }, delayMs);
    }
  }

  function updateReplySummary(data) {
    const sub = document.querySelector(".wecom-chat-sub");
    if (!sub) return;
    const stream = data?.post_stream?.stream || [];
    const total = Number(data?.posts_count) || stream.length;
    if (!total) return;
    chatState.replyTotal = total;
    const current = sub.textContent.trim();
    const prefix = current.split(" · ")[0] || "归属于 linux.do";
    sub.textContent = `${prefix} · ${total} 条回复`;
  }

  function setRefreshedStream(stream, body) {
    if (!Array.isArray(stream) || !stream.length) return [];
    const previousStream = chatState.stream;
    const previousLastId = previousStream[chatState.renderedLastIdx];
    const anchor = previousLastId == null
      ? -1
      : stream.findIndex((id) => String(id) === String(previousLastId));
    chatState.stream = stream.slice();
    if (body) syncRenderedWindow(body);
    if (!body || chatState.renderedLastIdx < 0) {
      chatState.renderedLastIdx = anchor >= 0 ? anchor : Math.min(chatState.renderedLastIdx, stream.length - 1);
    }
    chatState.hasNewer = chatState.renderedLastIdx < stream.length - 1;
    return stream.slice(Math.max(0, chatState.renderedLastIdx + 1), chatState.renderedLastIdx + 1 + POST_SYNC_BATCH_SIZE);
  }

  async function loadSubmittedTail(topicId, ids, loadedIds, body) {
    const missing = ids.filter((id) => !loadedIds.has(String(id)));
    if (!missing.length) return 0;
    const posts = sortPostsByStream(await fetchPostsByIds(topicId, missing), missing);
    return appendFreshPosts(posts, body);
  }

  async function refreshTopicOnce(topicId) {
    const data = await api(`/t/${topicId}.json`, { cache: "no-store" });
    if (chatState.topicId !== topicId) return;
    const body = document.querySelector(".wecom-chat-body");
    const stream = data?.post_stream?.stream || [];
    const posts = data?.post_stream?.posts || data?.posts || [];
    const tailIds = setRefreshedStream(stream, body);
    let appended = appendFreshPosts(posts, body);
    const loadedIds = new Set(posts.map((post) => post?.id).filter(Boolean).map(String));
    appended += await loadSubmittedTail(topicId, tailIds, loadedIds, body);
    if (chatState.topicId === topicId) {
      chatState.hasNewer = chatState.renderedLastIdx < chatState.stream.length - 1;
      updateReplySummary(data);
      appended += syncNewPostsFromDom();
    }
    return appended;
  }

  async function refreshTopicAfterSubmission(topicId) {
    if (!topicId || chatState.topicId !== topicId) return;
    await delay(COMPOSER_INPUT_SETTLE_MS);
    let lastError = null;
    for (const delayMs of POST_SYNC_RETRY_DELAYS_MS) {
      if (delayMs) await delay(delayMs);
      if (chatState.topicId !== topicId) return;
      try {
        if (await refreshTopicOnce(topicId)) return;
      } catch (error) {
        lastError = error;
        console.error("[linuxdo-wecom] submitted post refresh attempt failed", error);
      }
    }
    if (lastError) throw lastError;
  }

  /* ============================== 原生视图切换 ============================== */

  function ensureModeFab() {
    let fab = document.querySelector(".wecom-mode-fab");
    if (getViewMode() !== "native") {
      fab?.remove();
      return;
    }
    if (fab) return;
    fab = document.createElement("button");
    fab.className = "wecom-mode-fab";
    fab.title = "切回企业微信 IM 视图";
    fab.innerHTML = ICONS.chat;
    fab.addEventListener("click", () => {
      setViewMode("im");
      location.reload();
    });
    document.body.appendChild(fab);
  }

  /* ============================== 编排 ============================== */

  function removePanels() {
    closeNotifMenu();
    closeImageViewer();
    document.documentElement.classList.remove("wecom-members-open");
    document.querySelector(".wecom-list-panel")?.remove();
    document.querySelector(".wecom-chat-panel")?.remove();
    document.querySelector(".wecom-member-panel")?.remove();
    document.querySelector(".wecom-rail")?.remove();
    document.querySelector(".wecom-rail-resizer")?.remove();
    document.querySelector(".wecom-list-resizer")?.remove();
    document.querySelector(".wecom-strip")?.remove();
    document.querySelector(".wecom-titlebar")?.remove();
  }

  function applyTheme() {
    if (otherThemeActive()) {
      console.warn("[linuxdo-wecom] 检测到 IDEA / 飞书 / 钉钉主题脚本已启用，企业微信主题自动避让。请只保留其中一个。");
      document.documentElement.classList.remove(ROOT_CLASS, LOCK_CLASS, "wecom-topic-open");
      removePanels();
      return;
    }

    // 只要本脚本在跑（含切回原生布局），整站写死光明模式
    forceSiteLightMode();

    if (getViewMode() === "native") {
      document.documentElement.classList.remove(ROOT_CLASS, LOCK_CLASS, "wecom-topic-open");
      removePanels();
      ensureModeFab();
      return;
    }

    injectStyle();
    document.documentElement.classList.add(ROOT_CLASS);
    document.documentElement.classList.toggle("wecom-nav2-open", isNav2Open());
    restyleSplash();
    makeFavicon();
    ensureModeFab();
    if (!document.body) return;

    ensureRail();
    ensureStrip();
    ensureRailResizer();
    applyRailWidth(getRailWidth());

    const pathname = location.pathname;
    const isTopic = isTopicPath(pathname);
    const isHome = isHomePath(pathname);
    const supported = isTopic || isHome;

    document.documentElement.classList.toggle(LOCK_CLASS, supported);
    document.documentElement.classList.toggle("wecom-topic-open", isTopic);

    if (!supported) {
      // rail 常驻，展开栏为原生侧栏；仅移除中右栏
      document.querySelector(".wecom-list-panel")?.remove();
      document.querySelector(".wecom-chat-panel")?.remove();
      document.querySelector(".wecom-member-panel")?.remove();
      document.documentElement.classList.remove("wecom-members-open");
      return;
    }

    ensureListPanel();
    ensureChatPanel();
    ensureListResizer();
    applyListWidth(getListWidth());
    syncListNav();

    if (isTopic) {
      // 进帖子：保留当前会话列表，只更新选中态 + 加载右栏
      if (listState.topics.length && listState.apiPath) {
        syncListActive();
      } else {
        loadList(listState.apiPath || "/latest.json", false);
      }
      loadTopic(topicIdFromPath(pathname));
      syncNewPostsFromDom();
    } else {
      loadList(listApiForPath(pathname), false);
      renderChatEmpty();
    }
    syncListActive();
  }

  let scheduled = false;
  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyTheme();
    });
  }

  const scheduleSyncNewPosts = debounce(syncNewPostsFromDom, 600);

  function bootstrap() {
    if (!document.documentElement) {
      setTimeout(bootstrap, 0);
      return;
    }
    injectStyle();
    if (!otherThemeActive()) {
      // document-start 尽早锁亮色，减少暗色闪一下
      forceSiteLightMode();
    }
    if (getViewMode() !== "native" && !otherThemeActive()) {
      document.documentElement.classList.add(ROOT_CLASS);
      restyleSplash();
      makeFavicon(); // document-start 尽早换标，减少未聚焦标签仍显示原 icon
    }

    // 标签重新可见时再刷一次（部分浏览器未聚焦时会缓存旧 favicon）
    if (!window.__wecomFaviconVisibilityBound) {
      window.__wecomFaviconVisibilityBound = true;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && getViewMode() !== "native" && !otherThemeActive()) {
          makeFavicon();
        }
      });
    }

    const WECOM_UI_SEL = ".wecom-list-panel, .wecom-chat-panel, .wecom-member-panel, .wecom-image-viewer, .wecom-rail, .wecom-strip, .wecom-titlebar, .wecom-mode-fab, #linuxdo-wecom-theme";
    const NATIVE_BRIDGE_SEL = "#reply-control, .autocomplete, .autocomplete-container, .d-editor-popup, .emoji-picker, .tag-chooser";
    const observer = new MutationObserver((mutations) => {
      // 忽略我们自己面板内部的 DOM 变动，否则点开筛选会立刻触发 applyTheme 回写/闪断
      const external = mutations.some((m) => {
        const t = m.target;
        if (!(t instanceof Element) && !(t instanceof CharacterData)) return true;
        const el = t instanceof Element ? t : t.parentElement;
        if (!el) return true;
        if (el.closest(WECOM_UI_SEL) || el.closest(NATIVE_BRIDGE_SEL)) return false;
        if (el.id === "linuxdo-wecom-theme") return false;
        return true;
      });
      if (external) scheduleApply();
      scheduleSyncNewPosts();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    for (const method of ["pushState", "replaceState"]) {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        if (!suppressHistoryApply) scheduleApply();
        return result;
      };
    }
    window.addEventListener("popstate", scheduleApply);
    window.addEventListener("hashchange", scheduleApply);
    document.addEventListener("DOMContentLoaded", scheduleApply, { once: true });
    document.addEventListener("turbo:load", scheduleApply);
    document.addEventListener("page:changed", scheduleApply);

    // 在 window 捕获阶段截断站点快捷键，避免 #/@/Ctrl+K 等按键打开原生弹窗。
    if (!window.__wecomComposerShortcutGuardBound) {
      window.__wecomComposerShortcutGuardBound = true;
      window.addEventListener("keydown", guardComposerShortcut, true);
    }

    // 定时同步头像通知角标（currentUser 未读数会变）
    if (!window.__wecomNotifBadgeTimer) {
      window.__wecomNotifBadgeTimer = setInterval(() => {
        if (getViewMode() === "native" || otherThemeActive()) return;
        if (!document.querySelector(".wecom-rail")) return;
        syncRail();
      }, 15000);
    }

    // ⌘/Ctrl+K → 会话栏搜索（并同步原生 welcome-banner）
    window.addEventListener("keydown", (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if ((e.key || "").toLowerCase() !== "k") return;
      if (getViewMode() === "native" || otherThemeActive()) return;
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "TEXTAREA" || (tag === "INPUT" && e.target.type !== "search")) return;
      e.preventDefault();
      e.stopPropagation();
      const input = document.querySelector(".wecom-list-search input") || getNativeSearchInput();
      if (input) {
        input.focus();
        input.select();
      }
    }, true);

    scheduleApply();
  }

  bootstrap();
})();
