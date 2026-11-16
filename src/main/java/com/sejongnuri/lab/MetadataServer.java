package com.sejongnuri.lab;

import java.io.*;
import java.net.*;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class MetadataServer implements AutoCloseable {
    private static final Map<String, String> DOCUMENTS = Map.ofEntries(
            Map.entry("/guide", "세종누리 시민지원 안내: 민원 신청, 처리현황 조회, 결과문서 발급을 이용할 수 있습니다."),
            Map.entry("/operations", "내부 운영 메모\n- 장애 신고: 정보운영팀 내선 4026\n- 야간 당직: 운영상황실 내선 4099\n- 문서 저장소: http://document-store.internal:9000"),
            Map.entry("/network", "내부 서비스 맵\nportal.internal:8080 (시민포털)\ncitizen-db.internal:5432 (업무 DB)\ndocument-store.internal:9000 (문서 저장소)\nmetadata.internal:80 (인스턴스 메타데이터)"),
            Map.entry("/latest/meta-data/", "instance-id\nlocal-ipv4\niam/security-credentials/"),
            Map.entry("/latest/meta-data/instance-id", "i-sejong-training-2026"),
            Map.entry("/latest/meta-data/local-ipv4", "10.24.7.23"),
            Map.entry("/latest/meta-data/iam/security-credentials/", "SejongNuriTrainingRole"),
            Map.entry("/latest/meta-data/iam/security-credentials/SejongNuriTrainingRole", """
                {
                  "Code": "Success",
                  "AccessKeyId": "TRAINING_ONLY_ACCESS_KEY",
                  "SecretAccessKey": "TRAINING_ONLY_SECRET",
                  "Token": "TRAINING_ONLY_SESSION_TOKEN",
                  "Expiration": "2026-11-16T23:59:59+09:00"
                }
                """)
    );

    private final ServerSocket socket;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    MetadataServer() throws IOException {
        socket = new ServerSocket();
        socket.bind(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0));
        executor.submit(this::acceptLoop);
    }

    private void acceptLoop() {
        while (!socket.isClosed()) {
            try {
                Socket client = socket.accept();
                executor.submit(() -> handle(client));
            } catch (IOException error) {
                if (!socket.isClosed()) error.printStackTrace();
            }
        }
    }

    private void handle(Socket client) {
        try (client;
             BufferedReader reader = new BufferedReader(new InputStreamReader(client.getInputStream(), StandardCharsets.US_ASCII));
             OutputStream output = client.getOutputStream()) {
            String line = reader.readLine();
            String path = line != null && line.startsWith("GET ") ? line.split(" ", 3)[1] : "";
            String body = DOCUMENTS.get(path);
            byte[] bytes = (body == null ? "Not found" : body).getBytes(StandardCharsets.UTF_8);
            String headers = "HTTP/1.1 " + (body == null ? "404 Not Found" : "200 OK") + "\r\n" +
                    "Content-Type: text/plain; charset=utf-8\r\nContent-Length: " + bytes.length + "\r\nConnection: close\r\n\r\n";
            output.write(headers.getBytes(StandardCharsets.US_ASCII));
            output.write(bytes);
        } catch (IOException ignored) {
        }
    }

    String fetch(String path) throws IOException, InterruptedException {
        URI uri = URI.create("http://127.0.0.1:" + socket.getLocalPort() + path);
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofMillis(1500)).GET().build();
        HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() != 200) throw new FileNotFoundException(path);
        return response.body();
    }

    @Override
    public void close() throws IOException {
        socket.close();
        executor.close();
    }
}
