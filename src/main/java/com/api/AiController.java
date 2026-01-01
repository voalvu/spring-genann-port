package com.ai.api;

import com.ai.service.NeuralNetService;
import com.ai.service.PuzzleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.awt.geom.Point2D;
import java.awt.Image;
import java.awt.image.BufferedImage;
import java.util.List;
import java.util.stream.Collectors;
import javax.imageio.ImageIO;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") 
public class AiController {

    @Autowired private PuzzleService puzzleService;

    @PostMapping("/puzzle/solve")
    public ResponseEntity<String> solvePuzzle(@RequestParam("screenshot") MultipartFile file) {
        try {
            BufferedImage img = ImageIO.read(file.getInputStream());
            // Fire and forget: Train on vectors, find in screenshot
            puzzleService.trainPuzzleSolver(img); 
            return ResponseEntity.ok("Analyzing screenshot...");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    @Autowired
    private NeuralNetService nnService;

    @PostMapping("/train")
    public ResponseEntity<String> startTraining() {
        try {
            nnService.startTraining(false);
            return ResponseEntity.ok("Training started asynchronously. Check logs.");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }
    
    @Autowired private com.ai.service.SwfService swfService;
    @PostMapping("/swf/upload")
    public ResponseEntity<SwfResponse> uploadSwf(@RequestParam("file") MultipartFile file) {
        try {
            SwfResponse response = swfService.parseSwf(file);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/points")
    public ResponseEntity<String> startSomeTraining(@RequestBody List<PointRequest> pointDtos) {
        try {
            System.out.println("Received " + pointDtos.size() + " points from Angular.");

            // Convert List<PointRequest> -> Point2D.Double[]
            Point2D.Double[] points = pointDtos.stream()
                    .map(dto -> new Point2D.Double(dto.getX(), dto.getY()))
                    .toArray(Point2D.Double[]::new);

            nnService.generateSomeShapeDataset(points);
            
            nnService.startTraining(true);

            return ResponseEntity.ok("Received points. Starting custom training.");
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Error: " + e.getMessage());
        }
    }
}