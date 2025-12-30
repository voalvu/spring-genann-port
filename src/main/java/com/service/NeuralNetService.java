package com.ai.service;

import com.ai.core.GenAnn;
import com.ai.entity.TrainingLog;
import com.ai.repo.TrainingLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.awt.*;
import java.io.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.List;
import java.awt.geom.Point2D;

@Service
public class NeuralNetService {

    @Autowired private TrainingLogRepository logRepo;
    @Autowired private ImageService imageService;

    private static final String OUTPUT_DIR = "Output";
    private static final String SOME_DIR = "Some";
    
    private GenAnn ann;
    
    // Main data containers
    private final List<double[]> trainingInputs = new ArrayList<>();
    private final List<double[]> trainingOutputs = new ArrayList<>();
    private final List<File> groundTruthFiles = new ArrayList<>();

    private boolean isCustomMode = false;
    private int customOutputSize = 0;

    public void initEnvironment(boolean custom) throws IOException {
        String targetDir = custom ? SOME_DIR : OUTPUT_DIR;
        Files.createDirectories(Paths.get(targetDir));

        // If in custom mode but no data sent yet, create a default square
        if (custom) {
             Point2D.Double[] defaultSquare = new Point2D.Double[] {
                 new Point2D.Double(0.2, 0.2), // Normalized coordinates (0.0 - 1.0)
                 new Point2D.Double(0.2, 0.8),
                 new Point2D.Double(0.8, 0.8),
                 new Point2D.Double(0.8, 0.2)
             };
             generateSomeShapeDataset(defaultSquare);
        } else {
             // Default Arc Mode
             if (new File(targetDir).list().length < 5) {
                generateDefaultDataset();
             }
        }
    }

    private void clearData() {
        trainingInputs.clear();
        trainingOutputs.clear();
        groundTruthFiles.clear();
    }

    // --- GENERATORS ---

    public void generateSomeShapeDataset(Point2D.Double[] shapePoints) throws IOException {
        clearData();
        isCustomMode = true;
        customOutputSize = shapePoints.length * 2; // x and y for every point

        // Flatten the points into one single target array for the neural net
        // Expected format: [x1, y1, x2, y2, x3, y3...]
        double[] flatTarget = new double[customOutputSize];
        for (int k = 0; k < shapePoints.length; k++) {
            flatTarget[k*2]     = shapePoints[k].x;
            flatTarget[k*2 + 1] = shapePoints[k].y;
        }

        // Generate 10 sample images (overfitting to this specific shape)
        Random r = new Random();
        for (int i = 1; i <= 10; i++) {
            String filename = String.format("%s/output_%03d.png", SOME_DIR, i);
            
            // Draw the shape (ImageService will handle scaling 0-1 to 128px)
            imageService.saveSomePng(filename, shapePoints, Color.BLACK);
            
            groundTruthFiles.add(new File(filename));
            
            // Add the flattened target. 
            // Note: Since we want the NN to learn THIS specific shape for any input,
            // we give it the same target output for all samples.
            trainingOutputs.add(flatTarget);
        }
    }

    private void generateDefaultDataset() throws IOException {
        clearData();
        isCustomMode = false;
        Random r = new Random();
        for (int i = 1; i <= 10; i++) {
            double cx = 14 + r.nextInt(100);
            double cy = 14 + r.nextInt(100);
            double rad = 20 + r.nextInt(60);
            double ang1 = r.nextDouble() * 2 * Math.PI;
            double ang2 = r.nextDouble() * 2 * Math.PI;
            
            String filename = String.format("%s/output_%03d.png", OUTPUT_DIR, i);
            imageService.savePngArc(filename, cx, cy, rad, Math.min(ang1, ang2), Math.max(ang1, ang2), Color.BLACK);
            
            groundTruthFiles.add(new File(filename));
            
            // Output: 5 parameters normalized
            double[] out = {cx/128.0, cy/128.0, rad/100.0, Math.min(ang1,ang2)/(2*Math.PI), Math.max(ang1,ang2)/(2*Math.PI)};
            trainingOutputs.add(out);
        }
    }

    // --- TRAINING ---

    @Async
    public void startTraining(boolean custom) throws Exception {
        // Ensure data is loaded (if not already by the controller)
        if (groundTruthFiles.isEmpty()) {
            initEnvironment(custom);
        }
        
        // Load Input Images
        // Note: trainingOutputs are already populated by the generate methods above
        for (File f : groundTruthFiles) {
            trainingInputs.add(imageService.loadAndDownsample(f));
        }

        int outputNeurons = custom ? customOutputSize : 5;
        
        // Re-init Network
        ann = new GenAnn(1024, 1, 64, outputNeurons);

        String targetDir = custom ? SOME_DIR : OUTPUT_DIR;

        for (int epoch = 0; epoch <= 1000; epoch++) {
            for (int i = 0; i < trainingInputs.size(); i++) {
                ann.train(trainingInputs.get(i), trainingOutputs.get(i), 3.0);
            }

            if (epoch % 10 == 0) {
                saveSnapshot(epoch, targetDir);
                TrainingLog log = new TrainingLog();
                log.setEpoch(epoch);
                log.setTimestamp(LocalDateTime.now());
                log.setSnapshotFile("swfbrain_epoch_" + epoch + ".ann");
                logRepo.save(log);
            }
        }
        
        generateEvolutionGifs(custom);
    }

    private void saveSnapshot(int epoch, String dir) throws IOException {
        try (ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream(dir + "/swfbrain_epoch_" + epoch + ".ser"))) {
            oos.writeObject(ann);
        }
    }

    // --- GIF GENERATION ---

    public void generateEvolutionGifs(boolean custom) {
        try {
            String dir = custom ? SOME_DIR : OUTPUT_DIR;
            List<Integer> epochs = Arrays.asList(0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000);
            
            for (int i = 0; i < groundTruthFiles.size(); i++) {
                String baseNum = String.format("%03d", i + 1);
                List<String> framePaths = new ArrayList<>();

                double[] input = trainingInputs.get(i);

                for (Integer epoch : epochs) {
                    try (ObjectInputStream ois = new ObjectInputStream(new FileInputStream(dir + "/swfbrain_epoch_" + epoch + ".ser"))) {
                        GenAnn snap = (GenAnn) ois.readObject();
                        double[] pred = snap.run(input);
                        
                        String frameName = String.format("%s/pred_%s_epoch_%d.png", dir, baseNum, epoch);
                        
                        if (custom) {
                            // Reconstruct Polygon Points
                            // pred array is [x1, y1, x2, y2 ...]
                            int numPoints = pred.length / 2;
                            Point2D.Double[] polyPoints = new Point2D.Double[numPoints];
                            for(int k=0; k<numPoints; k++) {
                                polyPoints[k] = new Point2D.Double(pred[k*2], pred[k*2+1]);
                            }
                            imageService.saveSomePng(frameName, polyPoints, Color.RED);
                        } else {
                            // Reconstruct Arc
                            double cx = pred[0] * 128;
                            double cy = pred[1] * 128;
                            double r = pred[2] * 100;
                            double a1 = pred[3] * 2 * Math.PI;
                            double a2 = pred[4] * 2 * Math.PI;
                            imageService.savePngArc(frameName, cx, cy, r, a1, a2, Color.RED);
                        }
                        framePaths.add(frameName);
                    }
                }

                // ImageMagick
                List<String> cmd = new ArrayList<>();
                cmd.add("convert");
                cmd.add("-delay"); cmd.add("16");
                cmd.add("-loop"); cmd.add("0");
                cmd.addAll(framePaths);
                cmd.add(dir + "/evolution_" + baseNum + ".gif");

                ProcessBuilder pb = new ProcessBuilder(cmd);
                pb.inheritIO();
                Process p = pb.start();
                p.waitFor();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}