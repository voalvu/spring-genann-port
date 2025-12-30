package com.ai.api;

public class PointRequest {
    private double x;
    private double y;

    // Default constructor is needed for JSON deserialization
    public PointRequest() {}

    public PointRequest(double x, double y) {
        this.x = x;
        this.y = y;
    }

    public double getX() { return x; }
    public void setX(double x) { this.x = x; }

    public double getY() { return y; }
    public void setY(double y) { this.y = y; }
}