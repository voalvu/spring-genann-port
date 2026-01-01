package com.ai.service;

import com.ai.api.StatusResponse;
import com.ai.core.GenAnn;
import com.ai.entity.VectorLayer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.awt.*;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Service
public class PuzzleService {

    @Autowired private SwfService swfService;
    @Autowired private ImageService imageService;
    @Autowired private NeuralNetService nnService; // We'll reuse the Status/Log logic

    private GenAnn puzzleNet;
    private static final int INPUT_RES = 32;
    private static final String PUZZLE_DIR = "PuzzleOutput";

    @Async
    public void trainPuzzleSolver(BufferedImage targetScreenshot) throws Exception {
        List<VectorLayer> layers = swfService.loadSwfLayers();
        VectorLayer targetLayer = layers.get(0); // Let's try to find the "Sword"
        
        List<double[]> inputs = new ArrayList<>();
        List<double[]> outputs = new ArrayList<>();
        
        // 1. GENERATE SYNTHETIC TRAINING DATA
        // We create 1000 "fake screenshots" where the sword is in random places
        int samples = 1000;
        Random r = new Random();
        
        for(int i=0; i<samples; i++) {
            // Random Transform 0.0 to 1.0
            double tx = r.nextDouble();
            double ty = r.nextDouble();
            double rot = (r.nextDouble() - 0.5) * 1.0; // +/- 0.5 radians
            
            // Render the "Fake" screenshot
            double[] imgData = renderSyntheticSample(targetLayer, tx, ty, rot);
            inputs.add(imgData);
            
            // The Truth: Where was it?
            outputs.add(new double[]{ tx, ty, rot });
        }
        
        // 2. TRAIN NETWORK (32x32 inputs -> 3 outputs: X, Y, Rot)
        puzzleNet = new GenAnn(INPUT_RES*INPUT_RES, 1, 128, 3);
        
        for(int epoch=0; epoch<500; epoch++) {
            for(int i=0; i<samples; i++) {
                puzzleNet.train(inputs.get(i), outputs.get(i), 0.1);
            }
        }
        
        // 3. SOLVE THE REAL PUZZLE
        // Process the USER'S screenshot
        double[] realInput = imageService.bufferToDownsampledArray(targetScreenshot);
        double[] prediction = puzzleNet.run(realInput);
        
        System.out.println("FOUND ITEM AT: " + prediction[0] + ", " + prediction[1]);
        
        // Draw Result
        drawResult(targetScreenshot, targetLayer, prediction);
    }
    
    private double[] renderSyntheticSample(VectorLayer layer, double tx, double ty, double rot) {
        BufferedImage img = new BufferedImage(128, 128, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        
        // Noisy Background (Simulate game environment)
        g.setColor(Color.DARK_GRAY);
        g.fillRect(0,0,128,128);
        
        // Apply Transform
        AffineTransform at = new AffineTransform();
        at.translate(tx * 128, ty * 128);
        at.rotate(rot);
        at.scale(2.0, 2.0); // Arbitrary game scale
        
        g.setTransform(at);
        g.setColor(Color.WHITE); // Draw shape in white
        g.fill(layer.getVectorShape());
        g.dispose();
        
        // Convert to NN Input
        return imageService.bufferToDownsampledArray(img);
    }

    private void drawResult(BufferedImage original, VectorLayer layer, double[] pred) {
        Graphics2D g = original.createGraphics();
        
        AffineTransform at = new AffineTransform();
        at.translate(pred[0] * original.getWidth(), pred[1] * original.getHeight());
        at.rotate(pred[2]);
        at.scale(2.0, 2.0); // Must match synthetic scale
        
        g.setTransform(at);
        g.setColor(Color.RED); // Prediction is RED
        g.setStroke(new BasicStroke(3));
        g.draw(layer.getVectorShape());
        g.dispose();
        
        try {
             // Save for Angular to see
             javax.imageio.ImageIO.write(original, "png", new File("Some/puzzle_solved.png"));
        } catch (Exception e) {}
    }
}