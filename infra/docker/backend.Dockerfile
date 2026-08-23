# ── Etapa 1: compilar ─────────────────────────────────────────
FROM eclipse-temurin:25-jdk AS build
WORKDIR /workspace

# Copiamos primero el wrapper y los archivos de build: si no cambian,
# Docker reutiliza la capa de dependencias descargadas.
COPY apps/backend/gradlew apps/backend/gradlew.bat ./
COPY apps/backend/gradle ./gradle
COPY apps/backend/settings.gradle.kts apps/backend/build.gradle.kts apps/backend/gradle.properties ./
COPY apps/backend/build-logic ./build-logic
RUN chmod +x ./gradlew && ./gradlew --no-daemon dependencies || true

COPY apps/backend ./
RUN chmod +x ./gradlew && ./gradlew --no-daemon :bootstrap:bootJar -x test

# ── Etapa 2: ejecutar ─────────────────────────────────────────
FROM eclipse-temurin:25-jre-alpine AS runtime
WORKDIR /app

# Nunca correr como root.
RUN addgroup -S mapit && adduser -S mapit -G mapit
COPY --from=build /workspace/bootstrap/build/libs/*.jar app.jar
RUN chown -R mapit:mapit /app
USER mapit

EXPOSE 8080
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0"
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
