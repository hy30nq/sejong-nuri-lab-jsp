package com.sejongnuri.lab;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.Part;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@WebServlet("/api/*")
@MultipartConfig(maxFileSize = 2 * 1024 * 1024L, maxRequestSize = 3 * 1024 * 1024L)
public final class ApiServlet extends HttpServlet {
    private static final Gson GSON = new Gson();
    private static final Set<String> STATUSES = Set.of("접수 완료", "처리 중", "처리 완료");
    private static final Set<String> CATEGORIES = Set.of("주거·환경", "생활·복지", "교통·시설");

    @Override protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException { route(request, response); }
    @Override protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException { route(request, response); }
    @Override protected void doPut(HttpServletRequest request, HttpServletResponse response) throws IOException { route(request, response); }
    @Override protected void doDelete(HttpServletRequest request, HttpServletResponse response) throws IOException { route(request, response); }
    @Override protected void doPatch(HttpServletRequest request, HttpServletResponse response) throws IOException { route(request, response); }

    private void route(HttpServletRequest request, HttpServletResponse response) throws IOException {
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        String path = Optional.ofNullable(request.getPathInfo()).orElse("/");
        try {
            if ("GET".equals(request.getMethod()) && "/health".equals(path)) {
                json(response, 200, Map.of("ok", true, "service", "sejong-nuri-jsp", "runtime", "WildFly", "trainingMode", true)); return;
            }
            if ("GET".equals(request.getMethod()) && "/citizens/session".equals(path)) {
                Map<String, Object> user = SessionService.currentUser(request);
                Map<String, Object> body = new LinkedHashMap<>(); body.put("user", user); json(response, 200, body); return;
            }
            if ("GET".equals(request.getMethod()) && "/public/account-check".equals(path)) { accountCheck(request, response); return; }
            if ("POST".equals(request.getMethod()) && "/citizens/login".equals(path)) { login(request, response); return; }
            if ("POST".equals(request.getMethod()) && "/citizens/logout".equals(path)) { SessionService.clear(request, response); response.setStatus(204); return; }
            if ("GET".equals(request.getMethod()) && "/public/dashboard".equals(path)) { dashboard(request, response); return; }
            if ("GET".equals(request.getMethod()) && "/public/notices".equals(path)) { notices(response); return; }
            if ("GET".equals(request.getMethod()) && path.matches("/public/notices/\\d+")) { notice(path, response); return; }

            if ("GET".equals(request.getMethod()) && "/admin/overview".equals(path)) { adminOverview(request, response); return; }
            if ("PATCH".equals(request.getMethod()) && path.matches("/admin/applications/\\d+/status")) { adminStatus(request, response, path); return; }
            if ("POST".equals(request.getMethod()) && "/admin/notices".equals(path)) { adminNotice(request, response); return; }
            if ("DELETE".equals(request.getMethod()) && path.matches("/admin/board/posts/\\d+")) { adminDeletePost(request, response, path); return; }

            if ("POST".equals(request.getMethod()) && "/applications".equals(path)) { createApplication(request, response); return; }
            if ("GET".equals(request.getMethod()) && "/applications".equals(path)) { applications(request, response); return; }
            if (("GET".equals(request.getMethod()) || "POST".equals(request.getMethod())) && "/service/status/check".equals(path)) { serviceStatus(request, response); return; }
            if ("GET".equals(request.getMethod()) && "/citizens/identity/status".equals(path)) { identityStatus(request, response); return; }
            if ("POST".equals(request.getMethod()) && "/citizens/identity/complete".equals(path)) { identityComplete(request, response); return; }
            if ("GET".equals(request.getMethod()) && "/documents/download".equals(path)) { documentDownload(request, response); return; }
            if ("GET".equals(request.getMethod()) && "/documents/preview".equals(path)) { documentPreview(request, response); return; }
            if ("POST".equals(request.getMethod()) && "/attachments".equals(path)) { attachment(request, response); return; }
            if ("GET".equals(request.getMethod()) && "/board/posts".equals(path)) { boardPosts(response); return; }
            if ("POST".equals(request.getMethod()) && "/board/posts".equals(path)) { boardCreate(request, response); return; }
            if ("GET".equals(request.getMethod()) && "/citizens/preferences/email".equals(path)) { preferenceChange(request, response); return; }
            if ("GET".equals(request.getMethod()) && "/citizens/preferences".equals(path)) { preferences(request, response); return; }
            if ("GET".equals(request.getMethod()) && "/certificates".equals(path)) { certificates(request, response); return; }
            if ("GET".equals(request.getMethod()) && path.matches("/certificates/\\d+/download")) { certificateDownload(request, response, path); return; }

            json(response, 404, Map.of("message", "요청한 API를 찾을 수 없습니다."));
        } catch (SecurityException error) {
            json(response, error.getMessage().startsWith("관리자") ? 403 : 401, Map.of("message", error.getMessage()));
        } catch (IllegalArgumentException error) {
            json(response, 400, Map.of("message", error.getMessage()));
        } catch (Exception error) {
            getServletContext().log("[" + request.getMethod() + " " + path + "]", error);
            json(response, 500, Map.of("message", "실습 요청을 처리하지 못했습니다."));
        }
    }

    private void accountCheck(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String username = param(request, "username", "");
        if (username.isBlank() || username.length() > 500) { json(response, 400, Map.of("message", "확인할 아이디를 입력해 주세요.")); return; }
        String query = "SELECT username FROM portal_accounts WHERE username = '" + username + "'";
        try { json(response, 200, Map.of("registered", Database.unsafeOne(query) != null)); }
        catch (SQLException error) { json(response, 400, Map.of("message", "계정 등록 여부를 확인할 수 없습니다.")); }
    }

    private void login(HttpServletRequest request, HttpServletResponse response) throws IOException, SQLException {
        Map<String, Object> input = body(request);
        String username = text(input.get("username"));
        String password = text(input.get("password"));
        if (username.length() > 300 || password.length() > 128) { json(response, 400, Map.of("message", "로그인 입력 길이를 확인해 주세요.")); return; }
        String query = """
            SELECT c.username, c.display_name AS "displayName", c.department,
                   c.training_note AS "trainingNote", a.role
              FROM portal_accounts a JOIN citizens c ON c.username = a.username
             WHERE a.username = '%s' AND a.password = '%s'
            """.formatted(username, password);
        Map<String, Object> user;
        try { user = Database.unsafeOne(query); }
        catch (SQLException error) { json(response, 400, Map.of("message", "로그인을 처리할 수 없습니다.")); return; }
        if (user == null) { json(response, 401, Map.of("message", "아이디 또는 비밀번호를 확인해 주세요.")); return; }
        SessionService.setCookie(response, SessionService.create(text(user.get("username"))));
        json(response, 200, Map.of("user", user));
    }

    private void dashboard(HttpServletRequest request, HttpServletResponse response) throws Exception {
        Map<String, Object> user = SessionService.currentUser(request);
        String username = user == null ? "hangaram" : text(user.get("username"));
        List<Map<String, Object>> applications = user == null ? List.of() : Database.query("""
            SELECT display_id AS id, title, status, updated_at AS "updatedAt", category AS department
              FROM applications WHERE owner_username = ? AND status <> '처리 완료'
             ORDER BY updated_at DESC, id DESC LIMIT 5
            """, username);
        List<Map<String, Object>> notices = Database.query("SELECT id, kind, title, published_at AS date FROM notices ORDER BY id DESC LIMIT 5");
        json(response, 200, Map.of("user", Map.of("username", username, "displayName", user == null ? "방문자" : user.get("displayName")), "complaints", applications, "notices", notices));
    }

    private void notices(HttpServletResponse response) throws Exception {
        json(response, 200, Map.of("notices", Database.query("SELECT id, kind, title, published_at AS date FROM notices ORDER BY id DESC LIMIT 100")));
    }

    private void notice(String path, HttpServletResponse response) throws Exception {
        long id = Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
        Map<String, Object> notice = Database.one("SELECT id, kind, title, published_at AS date, body FROM notices WHERE id = ?", id);
        if (notice == null) json(response, 404, Map.of("message", "공지를 찾을 수 없습니다."));
        else json(response, 200, Map.of("notice", notice));
    }

    private void adminOverview(HttpServletRequest request, HttpServletResponse response) throws Exception {
        requireStaff(request);
        Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("citizens", scalar("SELECT COUNT(*) AS \"value\" FROM portal_accounts WHERE role = 'citizen'"));
        counts.put("applications", scalar("SELECT COUNT(*) AS \"value\" FROM applications"));
        counts.put("pending", scalar("SELECT COUNT(*) AS \"value\" FROM applications WHERE status <> '처리 완료'"));
        counts.put("posts", scalar("SELECT COUNT(*) AS \"value\" FROM board_posts"));
        List<Map<String, Object>> applications = Database.query("""
            SELECT a.id, a.display_id AS "displayId", a.owner_username AS "ownerUsername",
                   c.display_name AS "ownerName", a.category, a.title, a.status, a.created_at AS "createdAt"
              FROM applications a JOIN citizens c ON c.username = a.owner_username
             ORDER BY a.id DESC LIMIT 50
            """);
        List<Map<String, Object>> posts = Database.query("SELECT id, author, content, created_at AS \"createdAt\" FROM board_posts ORDER BY id DESC LIMIT 30");
        List<Map<String, Object>> notices = Database.query("SELECT id, kind, title, published_at AS \"publishedAt\" FROM notices ORDER BY id DESC LIMIT 30");
        List<Map<String, Object>> accounts = Database.query("""
            SELECT c.username, c.display_name AS "displayName", c.department, a.role
              FROM portal_accounts a JOIN citizens c ON c.username = a.username ORDER BY c.id
            """);
        json(response, 200, Map.of("counts", counts, "applications", applications, "posts", posts, "notices", notices, "accounts", accounts));
    }

    private void adminStatus(HttpServletRequest request, HttpServletResponse response, String path) throws Exception {
        requireStaff(request);
        long id = Long.parseLong(path.split("/")[3]);
        String status = text(body(request).get("status"));
        if (!STATUSES.contains(status)) { json(response, 400, Map.of("message", "올바른 처리 상태를 선택해 주세요.")); return; }
        int changed = Database.execute("UPDATE applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", status, id);
        if (changed == 0) json(response, 404, Map.of("message", "민원을 찾을 수 없습니다."));
        else json(response, 200, Map.of("updated", true, "status", status));
    }

    private void adminNotice(HttpServletRequest request, HttpServletResponse response) throws Exception {
        requireStaff(request); Map<String, Object> input = body(request);
        String title = text(input.get("title")).trim(), content = text(input.get("body")).trim(), kind = text(input.get("kind"));
        if (kind.isBlank()) kind = "normal";
        if (title.isBlank() || title.length() > 120 || content.isBlank() || content.length() > 3000 || !Set.of("normal", "important").contains(kind)) {
            json(response, 400, Map.of("message", "공지 제목과 내용을 확인해 주세요.")); return;
        }
        long id = Database.insert("INSERT INTO notices (kind, title, published_at, body) VALUES (?, ?, ?, ?)", kind, title, LocalDate.now(), content);
        json(response, 201, Map.of("id", id, "kind", kind, "title", title, "body", content, "publishedAt", LocalDate.now().toString()));
    }

    private void adminDeletePost(HttpServletRequest request, HttpServletResponse response, String path) throws Exception {
        requireStaff(request); long id = Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
        if (Database.execute("DELETE FROM board_posts WHERE id = ?", id) == 0) json(response, 404, Map.of("message", "게시글을 찾을 수 없습니다."));
        else response.setStatus(204);
    }

    private void createApplication(HttpServletRequest request, HttpServletResponse response) throws Exception {
        Map<String, Object> user = requireUser(request), input = body(request);
        String category = text(input.get("category")).trim(), title = text(input.get("title")).trim(), detail = text(input.get("detail")).trim();
        if (!CATEGORIES.contains(category) || title.isBlank() || title.length() > 80 || detail.isBlank() || detail.length() > 3000) {
            json(response, 400, Map.of("message", "민원 분야와 제목(80자 이내)·상세 내용(3000자 이내)을 확인해 주세요.")); return;
        }
        if (scalar("SELECT COUNT(*) AS \"value\" FROM applications") >= 500) { json(response, 409, Map.of("message", "민원 저장 한도에 도달했습니다. 강사에게 문의해 주세요.")); return; }
        long next = scalar("SELECT COALESCE(MAX(id), 0) + 1 AS \"value\" FROM applications");
        String displayId = "SN-2026-" + (1110 + next);
        long id = Database.insert("INSERT INTO applications (display_id, owner_username, category, title, detail, status) VALUES (?, ?, ?, ?, ?, '접수 완료')",
                displayId, user.get("username"), category, title, detail);
        json(response, 201, Map.of("id", id, "displayId", displayId, "status", "접수 완료"));
    }

    private void applications(HttpServletRequest request, HttpServletResponse response) throws Exception {
        Map<String, Object> user = requireUser(request); String receipt = param(request, "receiptNo", "").trim();
        if (!receipt.isBlank()) {
            Map<String, Object> item = Database.one("""
                SELECT a.*, c.display_name AS applicant_name, c.phone AS applicant_phone,
                       c.email AS applicant_email, c.address AS applicant_address
                  FROM applications a JOIN citizens c ON c.username = a.owner_username
                 WHERE a.display_id = ?
                """, receipt);
            if (item == null) json(response, 404, Map.of("message", "해당 접수번호의 민원을 찾을 수 없습니다."));
            else json(response, 200, Map.of("application", item));
            return;
        }
        json(response, 200, Map.of("applications", Database.query("""
            SELECT id, display_id AS "displayId", category, title, status, created_at AS "createdAt"
              FROM applications WHERE owner_username = ? ORDER BY id DESC
            """, user.get("username"))));
    }

    private void serviceStatus(HttpServletRequest request, HttpServletResponse response) throws Exception {
        requireUser(request);
        String target = "POST".equals(request.getMethod()) ? text(body(request).get("target")) : param(request, "target", "");
        if (target.isBlank() || target.length() > 1024) { json(response, 400, Map.of("message", "점검 대상을 확인해 주세요.")); return; }
        if ("1".equals(System.getenv("ENABLE_OS_COMMAND_LAB"))) {
            try { SandboxClient.Result result = SandboxClient.execute(target); json(response, result.status(), result.body()); }
            catch (Exception error) { json(response, 503, Map.of("message", "명령 실습 환경에 연결하지 못했습니다.")); }
            return;
        }
        json(response, 200, Map.of("output", "checked: " + target.split("[;&|]")[0].trim(), "serviceAvailable", true, "mode", "safe-simulator"));
    }

    private void identityStatus(HttpServletRequest request, HttpServletResponse response) throws Exception {
        Map<String, Object> user = requireUser(request);
        Map<String, Object> row = Database.one("SELECT verified_at AS \"verifiedAt\" FROM identity_checks WHERE username = ?", user.get("username"));
        Map<String, Object> body = new LinkedHashMap<>(); body.put("verified", row != null); body.put("verifiedAt", row == null ? null : row.get("verifiedAt")); json(response, 200, body);
    }

    private void identityComplete(HttpServletRequest request, HttpServletResponse response) throws Exception {
        Map<String, Object> user = requireUser(request), input = body(request);
        String step = text(input.get("verificationStep")), code = text(input.get("code"));
        if ("complete".equals(step) || ("verify".equals(step) && "12345678".equals(code))) {
            Database.execute("MERGE INTO identity_checks (username, verified_at) KEY(username) VALUES (?, CURRENT_TIMESTAMP)", user.get("username"));
            json(response, 200, Map.of("verified", true, "message", "본인 확인이 완료되었습니다."));
        } else json(response, 400, Map.of("verified", false, "message", "휴대전화 인증 단계가 필요합니다."));
    }

    private void documentDownload(HttpServletRequest request, HttpServletResponse response) throws Exception {
        requireUser(request); String requested = param(request, "file", "guide.txt");
        Path root = Path.of(System.getenv().getOrDefault("TRAINING_DATA_ROOT", "src/main/webapp/WEB-INF/training_data")).resolve("file_lab").normalize();
        Path publicDocs = root.resolve("var/www/public");
        Path candidate = publicDocs.resolve(requested).normalize();
        if (!candidate.startsWith(root)) { json(response, 400, Map.of("message", "허용되지 않는 경로입니다.")); return; }
        if (!Files.isRegularFile(candidate)) { json(response, 404, Map.of("message", "파일을 찾을 수 없습니다.")); return; }
        response.setContentType("text/plain; charset=utf-8"); Files.copy(candidate, response.getOutputStream());
    }

    private void documentPreview(HttpServletRequest request, HttpServletResponse response) throws Exception {
        requireUser(request); URI uri;
        try { uri = URI.create(param(request, "url", "")); }
        catch (Exception error) { json(response, 400, Map.of("message", "올바른 URL을 입력해 주세요.")); return; }
        String path = null;
        if ("http".equals(uri.getScheme()) && uri.getUserInfo() == null) {
            if ("guide.sejongnuri.internal".equals(uri.getHost()) && "/info".equals(uri.getPath())) path = "/guide";
            if ("metadata.internal".equals(uri.getHost()) && Set.of("/operations", "/network").contains(uri.getPath())) path = uri.getPath();
            if ("169.254.169.254".equals(uri.getHost()) && uri.getPath().startsWith("/latest/meta-data/")) path = uri.getPath();
        }
        if (path == null) { json(response, 200, Map.of("status", 200, "body", "요청하신 페이지의 미리보기를 제공할 수 없습니다.")); return; }
        MetadataServer server = (MetadataServer) getServletContext().getAttribute(AppContextListener.METADATA_SERVER);
        json(response, 200, Map.of("status", 200, "body", server.fetch(path)));
    }

    private void attachment(HttpServletRequest request, HttpServletResponse response) throws Exception {
        requireUser(request); Part part;
        try { part = request.getPart("attachment"); }
        catch (ServletException error) { json(response, 400, Map.of("message", "첨부파일이 필요합니다.")); return; }
        if (part == null || part.getSize() == 0) { json(response, 400, Map.of("message", "첨부파일이 필요합니다.")); return; }
        Path root = Path.of(System.getenv().getOrDefault("TARGET_UPLOAD_ROOT", "build/uploads")); Files.createDirectories(root);
        long count, bytes;
        try (var files = Files.list(root)) { List<Path> all = files.toList(); count = all.size(); bytes = all.stream().mapToLong(ApiServlet::size).sum(); }
        if (count >= 50 || bytes + part.getSize() > 64L * 1024 * 1024) { json(response, 413, Map.of("message", "이 실습 포털의 첨부파일 저장 한도를 초과했습니다. 강사에게 문의해 주세요.")); return; }
        String original = Optional.ofNullable(part.getSubmittedFileName()).orElse("upload.bin");
        String extension = original.contains(".") ? original.substring(original.lastIndexOf('.')).replaceAll("[^A-Za-z0-9.]", "") : "";
        if (extension.length() > 12) extension = extension.substring(0, 12);
        String stored = UUID.randomUUID().toString().replace("-", "") + extension.toLowerCase(Locale.ROOT);
        try (var input = part.getInputStream()) { Files.copy(input, root.resolve(stored), StandardCopyOption.REPLACE_EXISTING); }
        json(response, 201, Map.of("storedName", stored, "originalName", original, "publicUrl", "/uploads/" + stored));
    }

    private void boardPosts(HttpServletResponse response) throws Exception {
        json(response, 200, Map.of("posts", Database.query("SELECT id, author, content, created_at FROM board_posts ORDER BY id DESC LIMIT 100")));
    }

    private void boardCreate(HttpServletRequest request, HttpServletResponse response) throws Exception {
        Map<String, Object> user = requireUser(request); String content = text(body(request).get("content"));
        if (content.isBlank() || content.length() > 3000) { json(response, 400, Map.of("message", "의견은 1~3000자로 입력해 주세요.")); return; }
        if (scalar("SELECT COUNT(*) AS \"value\" FROM board_posts") >= 500) { json(response, 409, Map.of("message", "게시판 저장 한도에 도달했습니다. 강사에게 문의해 주세요.")); return; }
        long id = Database.insert("INSERT INTO board_posts (author, content) VALUES (?, ?)", user.get("displayName"), content);
        json(response, 201, Map.of("id", id, "author", user.get("displayName"), "content", content));
    }

    private void preferenceChange(HttpServletRequest request, HttpServletResponse response) throws Exception {
        Map<String, Object> user = requireUser(request); boolean enabled = !"false".equals(param(request, "enabled", "true"));
        Database.execute("MERGE INTO preferences (username, email_enabled) KEY(username) VALUES (?, ?)", user.get("username"), enabled);
        json(response, 200, Map.of("emailEnabled", enabled));
    }

    private void preferences(HttpServletRequest request, HttpServletResponse response) throws Exception {
        Map<String, Object> user = requireUser(request), row = Database.one("SELECT email_enabled FROM preferences WHERE username = ?", user.get("username"));
        json(response, 200, Map.of("emailEnabled", row == null || Boolean.TRUE.equals(row.get("email_enabled"))));
    }

    private void certificates(HttpServletRequest request, HttpServletResponse response) throws Exception {
        Map<String, Object> user = requireUser(request);
        json(response, 200, Map.of("certificates", Database.query("SELECT id, title, status FROM certificates WHERE owner_username = ? ORDER BY id", user.get("username"))));
    }

    private void certificateDownload(HttpServletRequest request, HttpServletResponse response, String path) throws Exception {
        requireUser(request); long id = Long.parseLong(path.split("/")[2]);
        Map<String, Object> certificate = Database.one("""
            SELECT cert.*, c.display_name AS owner_name
              FROM certificates cert JOIN citizens c ON c.username = cert.owner_username WHERE cert.id = ?
            """, id);
        if (certificate == null) { json(response, 404, Map.of("message", "문서를 찾을 수 없습니다.")); return; }
        String title = escape(text(certificate.get("title"))), owner = escape(text(certificate.get("owner_name"))), username = escape(text(certificate.get("owner_username"))), status = escape(text(certificate.get("status")));
        String warning = "승인 완료".equals(status) ? "" : "<div class=\"notice\"><strong>검증 경고</strong><br>승인되지 않은 신청 건이지만 발급 API가 문서를 생성했습니다. 이 문서는 교육용입니다.</div>";
        response.setHeader("Content-Disposition", "attachment; filename=\"sejong-certificate-" + id + ".html\"");
        response.setContentType("text/html; charset=utf-8");
        response.getWriter().write("""
            <!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
            <title>%s</title><style>body{margin:0;background:#eef3f6;color:#102d4d;font-family:sans-serif}.sheet{position:relative;width:min(760px,calc(100%% - 48px));margin:48px auto;padding:64px;border:10px double #174266;background:#fff}.mark{color:#13878b;font-weight:800}.sheet h1{text-align:center;font-size:38px}.grid{display:grid;grid-template-columns:150px 1fr;border-top:2px solid #174266}.grid>*{padding:16px;border-bottom:1px solid #cad8e2}.grid strong{background:#f0f6f8}.notice{margin-top:32px;padding:18px;border-left:5px solid #c54136;background:#fff2ef}.footer{margin-top:45px;text-align:center}</style></head>
            <body><main class="sheet"><div class="mark">SEJONG NURI DIGITAL CERTIFICATE</div><h1>전자 증명서</h1><div class="grid"><strong>문서번호</strong><span>SN-CERT-%d-2026</span><strong>문서명</strong><span>%s</span><strong>신청인</strong><span>%s (%s)</span><strong>처리상태</strong><span>%s</span><strong>발급시각</strong><span>%s</span></div>%s<div class="footer">위 내용을 세종누리 시민지원 통합포털에서 발급합니다.<br><b>세종누리 시민지원센터</b></div></main></body></html>
            """.formatted(title, id, title, owner, username, status, ZonedDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME), warning));
    }

    private Map<String, Object> requireUser(HttpServletRequest request) throws SQLException {
        Map<String, Object> user = SessionService.currentUser(request);
        if (user == null) throw new SecurityException("로그인 후 이용할 수 있습니다.");
        return user;
    }

    private Map<String, Object> requireStaff(HttpServletRequest request) throws SQLException {
        Map<String, Object> user = requireUser(request);
        if (!"staff".equals(user.get("role"))) throw new SecurityException("관리자 권한이 필요합니다.");
        return user;
    }

    private long scalar(String sql, Object... parameters) throws SQLException {
        Map<String, Object> row = Database.one(sql, parameters); return ((Number) Objects.requireNonNull(row).get("value")).longValue();
    }

    private static Map<String, Object> body(HttpServletRequest request) throws IOException {
        if (request.getContentType() != null && request.getContentType().startsWith("application/x-www-form-urlencoded")) {
            Map<String, Object> values = new LinkedHashMap<>(); request.getParameterMap().forEach((key, value) -> values.put(key, value.length == 0 ? "" : value[0])); return values;
        }
        String json = request.getReader().lines().reduce("", (left, right) -> left + right);
        if (json.isBlank()) return new LinkedHashMap<>();
        Map<String, Object> value = GSON.fromJson(json, new TypeToken<Map<String, Object>>(){}.getType());
        return value == null ? new LinkedHashMap<>() : value;
    }

    private static void json(HttpServletResponse response, int status, Object body) throws IOException {
        response.setStatus(status); response.setContentType("application/json; charset=utf-8"); response.getWriter().write(GSON.toJson(body));
    }

    private static String param(HttpServletRequest request, String name, String fallback) {
        String value = request.getParameter(name); return value == null ? fallback : value;
    }

    private static String text(Object value) { return value == null ? "" : String.valueOf(value); }
    private static long size(Path path) { try { return Files.size(path); } catch (IOException error) { return 0; } }
    private static String escape(String value) { return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;"); }
}
