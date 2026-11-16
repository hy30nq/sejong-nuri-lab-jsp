package com.sejongnuri.lab;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@WebServlet("/uploads/*")
public final class UploadServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String name = request.getPathInfo() == null ? "" : request.getPathInfo().replaceFirst("^/", "");
        Path root = Path.of(System.getenv().getOrDefault("TARGET_UPLOAD_ROOT", "build/uploads"));
        Path file = root.resolve(name).normalize();
        if (name.isBlank() || !file.startsWith(root) || !Files.isRegularFile(file)) { response.sendError(404); return; }
        String type = getServletContext().getMimeType(name);
        response.setContentType(type == null ? "application/octet-stream" : type);
        Files.copy(file, response.getOutputStream());
    }
}
