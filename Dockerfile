FROM node:22 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build -- --configuration production

FROM maven:3.9.9-eclipse-temurin-17 AS backend-build
WORKDIR /app
COPY pom.xml .
COPY src ./src
COPY lib ./lib
COPY --from=frontend-build /app/frontend/dist/frontend/browser /app/src/main/resources/static
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=backend-build /app/target/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
