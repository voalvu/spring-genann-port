package com.ai.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    
    // Relaxed Binding gets the current URL from Azure secrets (server environment variables)
    // https://docs.spring.io/spring-boot/reference/features/external-config.html#features.external-config.typesafe-configuration-properties.relaxed-binding
    @Value("${cors.allowed.origins:http://localhost:8080}")
    private String allowedOrigins;    
    
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Maps the URL path "/images/**" to the physical "Output" folder
        registry.addResourceHandler("/images/**")
                .addResourceLocations("file:Output/");

        registry.addResourceHandler("/custom/**")
                .addResourceLocations("file:Some/");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {

        String[] origins = allowedOrigins != null ? allowedOrigins.split(",") : new String[]{"http://localhost:4200"};

        registry.addMapping("/**")
                .allowedOriginPatterns(origins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}