package com.ai.api;

import lombok.Data;

@Data
public class VectorCommand {
    private String type; // "MOVE", "LINE", "CURVE"
    private double x;
    private double y;
    private double cx; // Control point X (for curves)
    private double cy; // Control point Y
    
    public VectorCommand(String type, double x, double y) {
        this.type = type;
        this.x = x;
        this.y = y;
    }

    public VectorCommand(String type, double cx, double cy, double x, double y) {
        this.type = type;
        this.cx = cx;
        this.cy = cy;
        this.x = x;
        this.y = y;
    }
}