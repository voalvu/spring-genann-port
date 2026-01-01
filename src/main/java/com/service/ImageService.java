package com.ai.service;

import org.springframework.stereotype.Service;
import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.Point2D;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;

@Service
public class ImageService {
    public static final int WIDTH = 128;
    public static final int HEIGHT = 128;
    public static final int THICKNESS = 5;

    public void saveSomePng(String path, Point2D.Double[] points, Color c) {
        BufferedImage img = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, WIDTH, HEIGHT);
        
        g.setColor(c);
        g.setStroke(new BasicStroke(THICKNESS));
        
        int n = points.length;
        int[] xPoints = new int[n];
        int[] yPoints = new int[n];
        
        for (int i = 0; i < n; i++) {
            // SCALE CORRECTION: 
            // Angular sends 0.0 to 1.0. We must multiply by WIDTH/HEIGHT.
            // If the value is > 1.0, we assume it's already in pixels (legacy support).
            double x = points[i].x;
            double y = points[i].y;

            if (x <= 1.0 && x >= 0.0) x *= WIDTH;
            if (y <= 1.0 && y >= 0.0) y *= HEIGHT;

            xPoints[i] = (int) Math.round(x);
            yPoints[i] = (int) Math.round(y);
        }
        
        g.drawPolygon(xPoints, yPoints, n);
        g.dispose();
        
        try {
            ImageIO.write(img, "png", new File(path));
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    // ... (Keep savePngArc and loadAndDownsample as they were) ...
    public void savePngArc(String path, double cx, double cy, double r, double startAngle, double endAngle, Color c) throws IOException {
        BufferedImage img = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, WIDTH, HEIGHT);
        g.setColor(c);
        g.setStroke(new BasicStroke(THICKNESS));
        double degreesStart = Math.toDegrees(startAngle);
        double degreesEnd = Math.toDegrees(endAngle);
        double extent = degreesEnd - degreesStart;
        double x = cx - r;
        double y = cy - r;
        g.drawArc((int)x, (int)y, (int)(r*2), (int)(r*2), (int)-degreesStart, (int)-extent);
        g.dispose();
        ImageIO.write(img, "png", new File(path));
    }

    public double[] loadAndDownsample(File file) throws IOException {
        BufferedImage img = ImageIO.read(file);
        double[] inputs = new double[32 * 32];
        double scaleX = (double) img.getWidth() / 32;
        double scaleY = (double) img.getHeight() / 32;
        for (int y = 0; y < 32; y++) {
            for (int x = 0; x < 32; x++) {
                int srcX = (int) (x * scaleX);
                int srcY = (int) (y * scaleY);
                int rgb = img.getRGB(srcX, srcY);
                int red = (rgb >> 16) & 0xFF;
                inputs[y * 32 + x] = 1.0 - (red / 255.0);
            }
        }
        return inputs;
    }

    public double[] bufferToDownsampledArray(BufferedImage img) {
    double[] inputs = new double[32 * 32];
    double scaleX = (double) img.getWidth() / 32;
    double scaleY = (double) img.getHeight() / 32;

    for (int y = 0; y < 32; y++) {
        for (int x = 0; x < 32; x++) {
            int srcX = (int) (x * scaleX);
            int srcY = (int) (y * scaleY);
            int rgb = img.getRGB(srcX, srcY);
            int red = (rgb >> 16) & 0xFF;
            inputs[y * 32 + x] = red / 255.0; // Note: Not inverted this time, assumes black BG
        }
    }
    return inputs;
}
}