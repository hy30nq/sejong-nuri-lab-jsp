package com.sejongnuri.lab;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;
import java.util.Set;

@WebServlet(urlPatterns = {"", "/login", "/services", "/notices/*", "/apply", "/account", "/admin",
        "/complaints", "/board", "/documents", "/attachments", "/certificates", "/settings", "/identity", "/status"})
public final class PageServlet extends HttpServlet {
    private static final Set<String> CIVIC = Set.of("account", "complaints", "board", "documents", "attachments", "certificates", "settings", "identity", "status");
    private static final Set<String> PUBLIC_CIVIC = Set.of("board", "status");

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        response.setCharacterEncoding("UTF-8");
        try {
            Map<String, Object> user = SessionService.currentUser(request);
            String path = request.getServletPath();
            request.setAttribute("user", user);
            request.setAttribute("activePath", path);
            request.setAttribute("pageTitle", "세종누리 시민지원 통합포털");

            if (path.isEmpty() || "/".equals(path)) {
                request.setAttribute("notices", Database.query("SELECT id, kind, title, published_at AS date FROM notices ORDER BY id DESC LIMIT 3"));
                forward(request, response, "home"); return;
            }
            if ("/login".equals(path)) {
                if (user != null) { redirect(response, "staff".equals(user.get("role")) ? "/admin" : "/account"); return; }
                request.setAttribute("pageTitle", "로그인 | 세종누리"); forward(request, response, "login"); return;
            }
            if ("/services".equals(path)) { request.setAttribute("pageTitle", "전체 서비스 | 세종누리"); forward(request, response, "services"); return; }
            if ("/notices".equals(path)) {
                String info = request.getPathInfo();
                if (info != null && info.matches("/\\d+")) {
                    request.setAttribute("notice", Database.one("SELECT id, kind, title, published_at AS date, body FROM notices WHERE id = ?", Long.parseLong(info.substring(1))));
                } else request.setAttribute("notices", Database.query("SELECT id, kind, title, published_at AS date FROM notices ORDER BY id DESC LIMIT 100"));
                request.setAttribute("pageTitle", "공지사항 | 세종누리"); forward(request, response, "notices"); return;
            }
            if ("/apply".equals(path)) {
                if (user == null) { redirectLogin(request, response); return; }
                request.setAttribute("pageTitle", "새 민원 신청 | 세종누리"); forward(request, response, "apply"); return;
            }
            if ("/admin".equals(path)) {
                if (user == null) { redirectLogin(request, response); return; }
                if (!"staff".equals(user.get("role"))) { redirect(response, "/account"); return; }
                request.setAttribute("pageTitle", "시민 서비스 관리자 | 세종누리"); forward(request, response, "admin"); return;
            }
            String section = path.substring(1);
            if (CIVIC.contains(section)) {
                if (user == null && !PUBLIC_CIVIC.contains(section)) { redirectLogin(request, response); return; }
                request.setAttribute("section", section);
                request.setAttribute("pageTitle", title(section) + " | 세종누리");
                forward(request, response, "civic"); return;
            }
            redirect(response, "/");
        } catch (Exception error) {
            throw new ServletException(error);
        }
    }

    private static void forward(HttpServletRequest request, HttpServletResponse response, String page) throws ServletException, IOException {
        request.getRequestDispatcher("/WEB-INF/jsp/" + page + ".jsp").forward(request, response);
    }

    private static void redirectLogin(HttpServletRequest request, HttpServletResponse response) {
        redirect(response, "/login?next=" + java.net.URLEncoder.encode(request.getRequestURI(), java.nio.charset.StandardCharsets.UTF_8));
    }

    /**
     * Emit an origin-relative redirect so reverse-proxy host or port rewriting
     * can never send a trainee from :11191-:11220 back to port 80.
     */
    private static void redirect(HttpServletResponse response, String location) {
        if (!location.startsWith("/") || location.startsWith("//")) {
            throw new IllegalArgumentException("리다이렉트는 내부 경로만 허용됩니다.");
        }
        response.setStatus(HttpServletResponse.SC_FOUND);
        response.setHeader("Location", location);
    }

    private static String title(String section) {
        return switch (section) {
            case "account" -> "내 정보";
            case "complaints" -> "나의 민원";
            case "board" -> "시민 의견 게시판";
            case "documents" -> "공개 자료실";
            case "attachments" -> "증빙자료 첨부";
            case "certificates" -> "결과문서 발급";
            case "settings" -> "알림 설정";
            case "identity" -> "본인 확인";
            default -> "서비스 이용 상태";
        };
    }
}
