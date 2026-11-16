package com.sejongnuri.lab;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.net.StandardProtocolFamily;
import java.net.UnixDomainSocketAddress;
import java.nio.channels.Channels;
import java.nio.channels.SocketChannel;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

final class SandboxClient {
    private SandboxClient() {}

    static Result execute(String target) throws Exception {
        Path path = Path.of(System.getenv().getOrDefault("S02_SOCKET_PATH", "/run/s02/exec.sock"));
        try (SocketChannel channel = SocketChannel.open(StandardProtocolFamily.UNIX)) {
            channel.connect(UnixDomainSocketAddress.of(path));
            DataOutputStream output = new DataOutputStream(Channels.newOutputStream(channel));
            DataInputStream input = new DataInputStream(Channels.newInputStream(channel));
            output.writeUTF(target);
            output.flush();
            return new Result(input.readInt(), input.readBoolean(), input.readUTF());
        }
    }

    record Result(int status, boolean available, String output) {
        Map<String, Object> body() {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("output", output);
            body.put("serviceAvailable", available);
            body.put("isolatedTrainingContainer", true);
            return body;
        }
    }
}
