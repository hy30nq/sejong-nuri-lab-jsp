package com.sejongnuri.lab;

import java.io.*;
import java.net.StandardProtocolFamily;
import java.net.UnixDomainSocketAddress;
import java.nio.channels.Channels;
import java.nio.channels.ServerSocketChannel;
import java.nio.channels.SocketChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

/** Networkless S02 sidecar. The intentionally unsafe shell runs only in this container. */
public final class CommandSandboxServer {
    private static final Path SOCKET = Path.of(System.getenv().getOrDefault("S02_SOCKET_PATH", "/run/s02/exec.sock"));
    private static final Path LAB = Path.of("/lab");

    public static void main(String[] args) throws Exception {
        if (args.length == 1 && "--health".equals(args[0])) {
            try (SocketChannel channel = SocketChannel.open(StandardProtocolFamily.UNIX)) {
                channel.connect(UnixDomainSocketAddress.of(SOCKET));
                DataOutputStream output = new DataOutputStream(Channels.newOutputStream(channel));
                DataInputStream input = new DataInputStream(Channels.newInputStream(channel));
                output.writeUTF("__HEALTH__");
                output.flush();
                System.exit(input.readInt() == 200 ? 0 : 1);
            } catch (Exception error) {
                System.exit(1);
            }
        }

        prepareLab();
        Files.createDirectories(SOCKET.getParent());
        Files.deleteIfExists(SOCKET);
        try (ServerSocketChannel server = ServerSocketChannel.open(StandardProtocolFamily.UNIX)) {
            server.bind(UnixDomainSocketAddress.of(SOCKET));
            while (true) {
                SocketChannel client = server.accept();
                Thread.startVirtualThread(() -> handle(client));
            }
        } finally {
            Files.deleteIfExists(SOCKET);
        }
    }

    private static void prepareLab() throws IOException {
        Path simulated = LAB.resolve("simulated-server");
        Files.createDirectories(LAB.resolve("config"));
        Files.createDirectories(simulated.resolve("var/www/html"));
        Files.createDirectories(simulated.resolve("var/lib/sejong"));
        Files.createDirectories(simulated.resolve("etc"));
        Files.writeString(LAB.resolve("config/service.txt"), "내부 서비스 점검 메모: portal.internal / 담당 정보운영팀\n");
        Files.writeString(simulated.resolve("var/www/html/index.html"), "<h1>세종누리 시민지원 통합포털</h1>\n");
        Files.writeString(simulated.resolve("etc/service.conf"), "PORTAL_DB=citizen-db.internal:5432\nDOCUMENT_STORE=document-store.internal:9000\n");
        Files.writeString(simulated.resolve("var/lib/sejong/citizens.csv"), """
            TRAINING_FAKE_DATA - 실제 개인정보가 아닙니다.
            citizen_id,name,phone,email,address,case
            C-2026-001,김다정,010-0000-2026,dajeong@example.invalid,세종시 다정동 가온마을 7단지,긴급생계 상담
            C-2026-002,한가람,010-1111-2026,hangaram@example.invalid,세종시 한솔동 누리마을 2단지,주거환경 지원
            """);
    }

    private static void handle(SocketChannel channel) {
        try (channel;
             DataInputStream input = new DataInputStream(Channels.newInputStream(channel));
             DataOutputStream output = new DataOutputStream(Channels.newOutputStream(channel))) {
            String target = input.readUTF();
            if ("__HEALTH__".equals(target)) {
                output.writeInt(200);
                output.writeBoolean(Files.exists(LAB.resolve("simulated-server")));
                output.writeUTF("ok");
                return;
            }
            if (target.length() > 1024) {
                output.writeInt(400); output.writeBoolean(false); output.writeUTF("점검 대상이 너무 깁니다."); return;
            }
            Process process = new ProcessBuilder("/bin/sh", "-c", "printf 'checked: %s\\n' " + target)
                    .directory(LAB.toFile()).redirectErrorStream(true).start();
            boolean finished = process.waitFor(Duration.ofSeconds(1).toMillis(), TimeUnit.MILLISECONDS);
            if (!finished) process.destroyForcibly();
            String text = new String(process.getInputStream().readNBytes(16 * 1024), StandardCharsets.UTF_8).trim();
            output.writeInt(finished && process.exitValue() == 0 ? 200 : 400);
            output.writeBoolean(Files.exists(LAB.resolve("simulated-server")));
            output.writeUTF(text);
        } catch (Exception ignored) {
        }
    }
}
