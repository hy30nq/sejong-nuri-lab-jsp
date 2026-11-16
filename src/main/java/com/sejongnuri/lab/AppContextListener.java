package com.sejongnuri.lab;

import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;
import jakarta.servlet.annotation.WebListener;

import java.nio.file.Files;
import java.nio.file.Path;

@WebListener
public final class AppContextListener implements ServletContextListener {
    static final String METADATA_SERVER = "metadataServer";

    @Override
    public void contextInitialized(ServletContextEvent event) {
        if (!"1".equals(System.getenv("TRAINING_MODE"))) {
            throw new IllegalStateException("이 서버는 의도적인 취약점을 포함합니다. TRAINING_MODE=1로만 실행하세요.");
        }
        try {
            Database.initialize();
            Files.createDirectories(Path.of(System.getenv().getOrDefault("TARGET_UPLOAD_ROOT", "build/uploads")));
            event.getServletContext().setAttribute(METADATA_SERVER, new MetadataServer());
            event.getServletContext().log("세종누리 JSP/WildFly 실습 포털이 시작되었습니다.");
        } catch (Exception error) {
            throw new IllegalStateException("실습 서비스를 초기화하지 못했습니다.", error);
        }
    }

    @Override
    public void contextDestroyed(ServletContextEvent event) {
        Object server = event.getServletContext().getAttribute(METADATA_SERVER);
        if (server instanceof MetadataServer metadataServer) {
            try { metadataServer.close(); } catch (Exception ignored) {}
        }
    }
}
