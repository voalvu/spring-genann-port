package com.ai.api;

import lombok.Data;

@Data
public class VectorCommand {
    private String type; // "MOVE", "LINE", "CURVE", "STYLE"
    
    // Geometry
    private double x, y;
    private double cx, cy;
    
    // Style Data (Only used if type == "STYLE")
    private String fillColor;   // CSS rgba string or null
    private String strokeColor; // CSS rgba string or null
    private double lineWidth;

    // Geometry Constructor
    public VectorCommand(String type, double x, double y) {
        this.type = type;
        this.x = x;
        this.y = y;
    }

    // Curve Constructor
    public VectorCommand(String type, double cx, double cy, double x, double y) {
        this.type = type;
        this.cx = cx;
        this.cy = cy;
        this.x = x;
        this.y = y;
    }

    // Style Constructor (New)
    public VectorCommand(String type, String fillColor, String strokeColor, double lineWidth) {
        this.type = type;
        this.fillColor = fillColor;
        this.strokeColor = strokeColor;
        this.lineWidth = lineWidth;
    }
}