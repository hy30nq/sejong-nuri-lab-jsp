package com.sejongnuri.lab;

import java.sql.SQLException;
import java.util.Map;

public final class TrainingContext {
    public static final String DEFAULT_USERNAME = "hangaram";

    private TrainingContext() {}

    public static Map<String, Object> defaultUser() throws SQLException {
        Map<String, Object> user = Database.one("""
            SELECT c.username, c.display_name AS "displayName", c.department,
                   c.training_note AS "trainingNote", a.role
              FROM portal_accounts a
              JOIN citizens c ON c.username = a.username
             WHERE a.username = ?
            """, DEFAULT_USERNAME);
        if (user == null) throw new IllegalStateException("기본 실습 사용자를 찾을 수 없습니다.");
        return user;
    }
}
