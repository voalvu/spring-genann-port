package com.ai.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
public class TrainingLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private int epoch;
    private double currentError; // Placeholder for loss logic
    private LocalDateTime timestamp;
    
    private String snapshotFile;
}