package com.ai.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

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
        // Allow the Angular dev server (usually port 4200) to talk to Spring
        registry.addMapping("/**")
                .allowedOrigins("http://localhost:4200")
                .allowedMethods("*");
    }
}