FROM gradle:9.2.1-jdk21 AS build
WORKDIR /workspace
COPY settings.gradle build.gradle gradle.properties ./
COPY src src
RUN gradle --no-daemon clean war sandboxJar

FROM eclipse-temurin:21-jre-noble AS command-sandbox
WORKDIR /opt/sejong
COPY --from=build /workspace/build/libs/command-sandbox.jar /opt/sejong/command-sandbox.jar
RUN mkdir -p /lab /run/s02 && chown -R 1000:1000 /lab /run/s02 /opt/sejong
USER 1000:1000
ENTRYPOINT ["java", "-jar", "/opt/sejong/command-sandbox.jar"]

FROM quay.io/wildfly/wildfly:39.0.0.Final-jdk21 AS portal
ENV TRAINING_MODE=1 ENABLE_OS_COMMAND_LAB=1 \
    S02_SOCKET_PATH=/run/s02/exec.sock \
    TARGET_DB_URL="jdbc:h2:file:/data/sejongnuri;DB_CLOSE_ON_EXIT=FALSE" \
    TARGET_UPLOAD_ROOT=/data/uploads \
    TRAINING_DATA_ROOT=/opt/sejong/training_data
USER root
RUN mkdir -p /data/uploads /run/s02 /opt/sejong && chown -R jboss:0 /data /run/s02 /opt/sejong
COPY --chown=jboss:0 src/main/webapp/WEB-INF/training_data /opt/sejong/training_data
COPY --from=build --chown=jboss:0 /workspace/build/libs/ROOT.war /opt/jboss/wildfly/standalone/deployments/ROOT.war
USER jboss
EXPOSE 8080
