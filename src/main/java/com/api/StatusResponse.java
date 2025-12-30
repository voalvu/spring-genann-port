package com.ai.api;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;

@Data
public class StatusResponse {
    private String state; // "IDLE", "GENERATING", "TRAINING", "GIFS", "COMPLETED"
    private int progress; // 0 to 100
    private int currentEpoch;
    private int totalEpochs;
    
    // Timing logs
    private String dataGenTime;
    private String trainingTime;
    private String gifGenTime;
    private String totalTime;
    
    // To show logs in UI
    private List<String> recentLogs = new ArrayList<>();
}