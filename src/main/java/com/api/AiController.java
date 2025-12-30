package com.ai.api;

import com.ai.service.NeuralNetService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.awt.geom.Point2D;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") 
public class AiController {

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