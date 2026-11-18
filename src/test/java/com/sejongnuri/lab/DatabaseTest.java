package com.sejongnuri.lab;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class DatabaseTest {
    @BeforeAll
    static void initialize() {
        Database.configureForTests("jdbc:h2:mem:sejong-test;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1");
        Database.initialize();
    }

    @Test
    void seedsCitizenAndAdminAccounts() throws Exception {
        assertEquals(3L, ((Number) Database.one("SELECT COUNT(*) AS count FROM portal_accounts").get("count")).longValue());
        assertEquals("NURI-7342", Database.one("SELECT recovery_code FROM portal_accounts WHERE username = ?", "admin").get("recovery_code"));
    }

    @Test
    void keepsS01BooleanOracleCompatible() throws Exception {
        Map<String, Object> trueRow = Database.unsafeOne("SELECT username FROM portal_accounts WHERE username = 'admin' AND UNICODE(SUBSTR(recovery_code, 1, 1)) > 70 -- '");
        Map<String, Object> falseRow = Database.unsafeOne("SELECT username FROM portal_accounts WHERE username = 'admin' AND UNICODE(SUBSTR(recovery_code, 1, 1)) > 90 -- '");
        assertNotNull(trueRow);
        assertNull(falseRow);
    }

    @Test
    void removesPasswordsAndSessionsFromTheTrainingPortal() throws Exception {
        Map<String, Object> passwordColumns = Database.one("""
            SELECT COUNT(*) AS count
              FROM information_schema.columns
             WHERE table_name = 'portal_accounts' AND column_name = 'password'
            """);
        assertEquals(0L, ((Number) passwordColumns.get("count")).longValue());
        assertThrows(Exception.class, () -> Database.query("SELECT * FROM portal_sessions"));
        assertEquals("hangaram", TrainingContext.defaultUser().get("username"));
    }
}
