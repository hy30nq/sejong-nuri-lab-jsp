package com.sejongnuri.lab;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.security.SecureRandom;
import java.sql.SQLException;
import java.util.HexFormat;
import java.util.Map;

public final class SessionService {
    public static final String COOKIE_NAME = "sn_citizen";
    private static final SecureRandom RANDOM = new SecureRandom();

    private SessionService() {}

    public static Map<String, Object> currentUser(HttpServletRequest request) throws SQLException {
        String token = token(request);
        if (token == null) return null;
        return Database.one("""
            SELECT c.username,
                   c.display_name AS "displayName",
                   c.department,
                   c.training_note AS "trainingNote",
                   a.role
              FROM portal_sessions s
              JOIN citizens c ON c.username = s.username
              JOIN portal_accounts a ON a.username = s.username
             WHERE s.token = ?
               AND s.created_at >= DATEADD('HOUR', -12, CURRENT_TIMESTAMP)
            """, token);
    }

    public static String create(String username) throws SQLException {
        Database.execute("DELETE FROM portal_sessions WHERE created_at < DATEADD('HOUR', -12, CURRENT_TIMESTAMP)");
        String token = HexFormat.of().formatHex(RANDOM.generateSeed(24));
        Database.execute("INSERT INTO portal_sessions (token, username) VALUES (?, ?)", token, username);
        return token;
    }

    public static void setCookie(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie(COOKIE_NAME, token);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(12 * 60 * 60);
        cookie.setAttribute("SameSite", "Lax");
        response.addCookie(cookie);
    }

    public static void clear(HttpServletRequest request, HttpServletResponse response) throws SQLException {
        String token = token(request);
        if (token != null) Database.execute("DELETE FROM portal_sessions WHERE token = ?", token);
        Cookie cookie = new Cookie(COOKIE_NAME, "");
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        cookie.setAttribute("SameSite", "Lax");
        response.addCookie(cookie);
    }

    private static String token(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (Cookie cookie : request.getCookies()) {
            if (COOKIE_NAME.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }
}
